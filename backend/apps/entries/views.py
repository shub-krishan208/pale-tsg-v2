from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncHour, TruncDate
from django.views.decorators.cache import cache_page
from django.conf import settings
from datetime import timedelta
import functools

from backend.core.jwt_utils import generate_jwt_token
from shared.apps.entries.models import EntryLog, ExitLog
from .serializers import TokenGenerateRequestSerializer, EmergencyExitTokenRequestSerializer


def dashboard_auth_required(view_func):
    """
    Decorator to check for staff session OR kiosk token.
    Allows access if:
    - User is authenticated staff (session auth)
    - Valid kiosk token provided via ?token= or X-Kiosk-Token header
    """
    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Check 1: Staff session auth (DRF request wraps Django request)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and user.is_staff:
            return view_func(request, *args, **kwargs)
        
        # Check 2: Kiosk token (query param or header)
        kiosk_token = settings.DASHBOARD_KIOSK_TOKEN
        if kiosk_token:
            provided_token = (
                request.GET.get('token') or 
                request.headers.get('X-Kiosk-Token', '')
            )
            if provided_token and provided_token == kiosk_token:
                return view_func(request, *args, **kwargs)
        
        return Response(
            {'error': 'Authentication required. Provide staff session or kiosk token.'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    return wrapper

@api_view(['POST'])
def generate_token(request):
    serializer = TokenGenerateRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    # getting the final validated data
    data = serializer.validated_data
    
    entry = EntryLog.create_with_roll(
        roll=data['roll'],
        laptop=data.get('laptop') or None,
        extra=data.get('extra') or [],
        # default status is PENDING and entry_flag is NORMAL (will be changed if needed on gate)
    )
    
    payload = {
        'entryId': str(entry.id),
        'roll': data['roll'],
        'action': 'ENTERING',
        'laptop': data.get('laptop') or None,
        'extra': data.get('extra') or [],
    }
    
    token = generate_jwt_token(payload)
    
    return Response({
        "entryId": str(entry.id),
        "token": token,
        "message": "Stored in db, token generated."
    },
    status=status.HTTP_201_CREATED,
)


@api_view(['POST'])
def generate_emergency_exit_token(request):
    """
    Generate an emergency exit token for a user with an active entry.
    
    The token is valid for 5 minutes and contains type=emergency.
    Accepts laptop/extra to record what the user is taking out.
    Returns 404 if no active entry found for the given roll.
    """
    serializer = EmergencyExitTokenRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    data = serializer.validated_data
    roll = data['roll']
    laptop = data.get('laptop') or None
    extra = data.get('extra') or []
    
    # Find the most recent active entry for this roll
    active_entry = EntryLog.objects.filter(
        roll_id=roll,
        status="ENTERED"
    ).order_by("-created_at").first()
    
    if not active_entry:
        return Response({
            "error": "No active entry found for this roll number.",
            "roll": roll,
        }, status=status.HTTP_404_NOT_FOUND)
    
    # Generate emergency token with 5-minute expiry
    # Use laptop/extra from request (what user is taking out during exit)
    payload = {
        'entryId': str(active_entry.id),
        'roll': roll,
        'action': 'EXITING',
        'type': 'emergency',
        'laptop': laptop,
        'extra': extra,
    }
    
    # 5 minutes = 5/60 hours
    token = generate_jwt_token(payload, expiry_hours=5/60)
    
    return Response({
        "entryId": str(active_entry.id),
        "token": token,
        "expiresInSeconds": 300,
        "message": "Emergency exit token generated. Valid for 5 minutes."
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([AllowAny])
@dashboard_auth_required
@cache_page(60)  # Cache for 60 seconds
def summary(request):
    """
    Read-only summary endpoint for dashboard.
    Requires staff session or valid kiosk token.
    Returns: today counts, current inside, hourly today, 7d trend.
    """
    now = timezone.localtime()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = today_start - timedelta(days=7)
    
    # Today's counts
    today_entries = EntryLog.objects.filter(
        created_at__gte=today_start,
        status__in=['ENTERED', 'EXITED', 'EXPIRED']
    ).count()
    
    today_exits = ExitLog.objects.filter(
        scanned_at__gte=today_start
    ).count()
    
    # Current inside: status = ENTERED (not yet exited)
    current_inside = EntryLog.objects.filter(status='ENTERED').count()
    
    # Hourly breakdown for today (entries and exits per hour)
    hourly_entries = list(
        EntryLog.objects.filter(
            created_at__gte=today_start,
            status__in=['ENTERED', 'EXITED', 'EXPIRED']
        )
        .annotate(hour=TruncHour('created_at'))
        .values('hour')
        .annotate(count=Count('id'))
        .order_by('hour')
    )
    
    hourly_exits = list(
        ExitLog.objects.filter(scanned_at__gte=today_start)
        .annotate(hour=TruncHour('scanned_at'))
        .values('hour')
        .annotate(count=Count('id'))
        .order_by('hour')
    )
    
    # Convert to serializable format
    hourly_data = []
    hours_map = {}
    for h in hourly_entries:
        hour_str = h['hour'].isoformat() if h['hour'] else None
        if hour_str:
            hours_map[hour_str] = {'hour': hour_str, 'entries': h['count'], 'exits': 0}
    for h in hourly_exits:
        hour_str = h['hour'].isoformat() if h['hour'] else None
        if hour_str:
            if hour_str in hours_map:
                hours_map[hour_str]['exits'] = h['count']
            else:
                hours_map[hour_str] = {'hour': hour_str, 'entries': 0, 'exits': h['count']}
    hourly_data = sorted(hours_map.values(), key=lambda x: x['hour'])
    
    # 7-day trend (daily entries and exits)
    daily_entries = list(
        EntryLog.objects.filter(
            created_at__gte=seven_days_ago,
            status__in=['ENTERED', 'EXITED', 'EXPIRED']
        )
        .annotate(date=TruncDate('created_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    
    daily_exits = list(
        ExitLog.objects.filter(scanned_at__gte=seven_days_ago)
        .annotate(date=TruncDate('scanned_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    
    # Merge daily data
    daily_map = {}
    for d in daily_entries:
        date_str = d['date'].isoformat() if d['date'] else None
        if date_str:
            daily_map[date_str] = {'date': date_str, 'entries': d['count'], 'exits': 0}
    for d in daily_exits:
        date_str = d['date'].isoformat() if d['date'] else None
        if date_str:
            if date_str in daily_map:
                daily_map[date_str]['exits'] = d['count']
            else:
                daily_map[date_str] = {'date': date_str, 'entries': 0, 'exits': d['count']}
    daily_data = sorted(daily_map.values(), key=lambda x: x['date'])
    
    return Response({
        'timestamp': now.isoformat(),
        'today': {
            'entries': today_entries,
            'exits': today_exits,
            'current_inside': current_inside,
        },
        'hourly': hourly_data,
        'daily_7d': daily_data,
    })