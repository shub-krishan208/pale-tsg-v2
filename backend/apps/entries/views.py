from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncHour, TruncDate, TruncMonth
from django.core.cache import cache
from django.conf import settings
from datetime import timedelta, date
import functools
import calendar

from backend.core.jwt_utils import generate_jwt_token
from shared.apps.entries.models import EntryLog, ExitLog
from .serializers import TokenGenerateRequestSerializer, EmergencyExitTokenRequestSerializer

# Cache TTLs in seconds
CACHE_TTL_DEFAULT = 60       # 1 minute
CACHE_TTL_MONTH = 300        # 5 minutes
CACHE_TTL_YEAR = 900         # 15 minutes
CACHE_TTL_RANGE = 300        # 5 minutes
CACHE_TTL_FLAGS = 180        # 3 minutes


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


def _get_daily_data(start_date, end_date):
    """Get daily entries/exits between two dates."""
    daily_entries = list(
        EntryLog.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status__in=['ENTERED', 'EXITED', 'EXPIRED']
        )
        .annotate(date=TruncDate('created_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    
    daily_exits = list(
        ExitLog.objects.filter(
            scanned_at__date__gte=start_date,
            scanned_at__date__lte=end_date
        )
        .annotate(date=TruncDate('scanned_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
    
    # Merge data
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
    
    return sorted(daily_map.values(), key=lambda x: x['date'])


def _get_monthly_data(start_date, end_date):
    """Get monthly entries/exits between two dates."""
    monthly_entries = list(
        EntryLog.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status__in=['ENTERED', 'EXITED', 'EXPIRED']
        )
        .annotate(month=TruncMonth('created_at'))
        .values('month')
        .annotate(count=Count('id'))
        .order_by('month')
    )
    
    monthly_exits = list(
        ExitLog.objects.filter(
            scanned_at__date__gte=start_date,
            scanned_at__date__lte=end_date
        )
        .annotate(month=TruncMonth('scanned_at'))
        .values('month')
        .annotate(count=Count('id'))
        .order_by('month')
    )
    
    # Merge data
    monthly_map = {}
    for m in monthly_entries:
        month_str = m['month'].strftime('%Y-%m') if m['month'] else None
        if month_str:
            monthly_map[month_str] = {'month': month_str, 'entries': m['count'], 'exits': 0}
    for m in monthly_exits:
        month_str = m['month'].strftime('%Y-%m') if m['month'] else None
        if month_str:
            if month_str in monthly_map:
                monthly_map[month_str]['exits'] = m['count']
            else:
                monthly_map[month_str] = {'month': month_str, 'entries': 0, 'exits': m['count']}
    
    return sorted(monthly_map.values(), key=lambda x: x['month'])


def _parse_date(date_str):
    """Parse ISO date string to date object."""
    try:
        parts = date_str.split('-')
        return date(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, IndexError, AttributeError):
        return None


def _get_default_summary_data():
    """Get default dashboard summary data (today + hourly + 7d)."""
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
    
    # Hourly breakdown for today
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
    
    # Merge hourly data
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
    
    # 7-day trend
    daily_data = _get_daily_data(seven_days_ago.date(), now.date())
    
    return {
        'timestamp': now.isoformat(),
        'today': {
            'entries': today_entries,
            'exits': today_exits,
            'current_inside': current_inside,
        },
        'hourly': hourly_data,
        'daily_7d': daily_data,
    }


def _get_month_data(year, month):
    """Get daily data for a specific month."""
    start_date = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end_date = date(year, month, last_day)
    
    data = _get_daily_data(start_date, end_date)
    
    return {
        'range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'data': data,
    }


def _get_year_data(year):
    """Get monthly data for a specific year."""
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)
    
    data = _get_monthly_data(start_date, end_date)
    
    return {
        'range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'data': data,
    }


def _get_range_data(start_date, end_date):
    """Get data for custom date range with auto-granularity."""
    delta = (end_date - start_date).days
    
    # Use monthly granularity for ranges > 90 days
    if delta > 90:
        data = _get_monthly_data(start_date, end_date)
        granularity = 'month'
    else:
        data = _get_daily_data(start_date, end_date)
        granularity = 'day'
    
    return {
        'range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'granularity': granularity,
        'data': data,
    }


def _get_flags_data(start_date, end_date):
    """Get flag statistics for a date range with daily breakdown."""
    # Entry flag totals
    entry_flag_totals = dict(
        EntryLog.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status__in=['ENTERED', 'EXITED', 'EXPIRED'],
            entry_flag__isnull=False
        )
        .values('entry_flag')
        .annotate(count=Count('id'))
        .values_list('entry_flag', 'count')
    )
    
    # Exit flag totals
    exit_flag_totals = dict(
        ExitLog.objects.filter(
            scanned_at__date__gte=start_date,
            scanned_at__date__lte=end_date
        )
        .values('exit_flag')
        .annotate(count=Count('id'))
        .values_list('exit_flag', 'count')
    )
    
    # Ensure all flag types are represented (even with 0 count)
    entry_flags = {
        'NORMAL_ENTRY': entry_flag_totals.get('NORMAL_ENTRY', 0),
        'FORCED_ENTRY': entry_flag_totals.get('FORCED_ENTRY', 0),
        'DUPLICATE_ENTRY': entry_flag_totals.get('DUPLICATE_ENTRY', 0),
    }
    
    exit_flags = {
        'NORMAL_EXIT': exit_flag_totals.get('NORMAL_EXIT', 0),
        'EMERGENCY_EXIT': exit_flag_totals.get('EMERGENCY_EXIT', 0),
        'ORPHAN_EXIT': exit_flag_totals.get('ORPHAN_EXIT', 0),
        'AUTO_EXIT': exit_flag_totals.get('AUTO_EXIT', 0),
        'DUPLICATE_EXIT': exit_flag_totals.get('DUPLICATE_EXIT', 0),
    }
    
    # Daily breakdown for histogram
    daily_entry_flags = list(
        EntryLog.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            status__in=['ENTERED', 'EXITED', 'EXPIRED'],
            entry_flag__isnull=False
        )
        .annotate(date=TruncDate('created_at'))
        .values('date', 'entry_flag')
        .annotate(count=Count('id'))
        .order_by('date', 'entry_flag')
    )
    
    daily_exit_flags = list(
        ExitLog.objects.filter(
            scanned_at__date__gte=start_date,
            scanned_at__date__lte=end_date
        )
        .annotate(date=TruncDate('scanned_at'))
        .values('date', 'exit_flag')
        .annotate(count=Count('id'))
        .order_by('date', 'exit_flag')
    )
    
    # Build daily breakdown map
    daily_map = {}
    
    for row in daily_entry_flags:
        date_str = row['date'].isoformat() if row['date'] else None
        if date_str:
            if date_str not in daily_map:
                daily_map[date_str] = {
                    'date': date_str,
                    'entry': {'NORMAL_ENTRY': 0, 'FORCED_ENTRY': 0, 'DUPLICATE_ENTRY': 0},
                    'exit': {'NORMAL_EXIT': 0, 'EMERGENCY_EXIT': 0, 'ORPHAN_EXIT': 0, 'AUTO_EXIT': 0, 'DUPLICATE_EXIT': 0},
                }
            if row['entry_flag']:
                daily_map[date_str]['entry'][row['entry_flag']] = row['count']
    
    for row in daily_exit_flags:
        date_str = row['date'].isoformat() if row['date'] else None
        if date_str:
            if date_str not in daily_map:
                daily_map[date_str] = {
                    'date': date_str,
                    'entry': {'NORMAL_ENTRY': 0, 'FORCED_ENTRY': 0, 'DUPLICATE_ENTRY': 0},
                    'exit': {'NORMAL_EXIT': 0, 'EMERGENCY_EXIT': 0, 'ORPHAN_EXIT': 0, 'AUTO_EXIT': 0, 'DUPLICATE_EXIT': 0},
                }
            if row['exit_flag']:
                daily_map[date_str]['exit'][row['exit_flag']] = row['count']
    
    daily_breakdown = sorted(daily_map.values(), key=lambda x: x['date'])
    
    return {
        'range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'entry_flags': entry_flags,
        'exit_flags': exit_flags,
        'daily_breakdown': daily_breakdown,
    }


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([AllowAny])
@dashboard_auth_required
def summary(request):
    """
    Read-only summary endpoint for dashboard.
    Requires staff session or valid kiosk token.
    
    Query params:
    - view: default|month|year|range|flags
    - month: 1-12 (for month view)
    - year: YYYY (for month/year views)
    - start_date: YYYY-MM-DD (for range view)
    - end_date: YYYY-MM-DD (for range view)
    - flag_range: 7d|30d|90d|year|custom (for flags view)
    """
    view_type = request.GET.get('view', 'default')
    now = timezone.localtime()
    
    if view_type == 'month':
        # Month view: daily data for specific month
        try:
            year = int(request.GET.get('year', now.year))
            month = int(request.GET.get('month', now.month))
            if not (1 <= month <= 12) or not (2000 <= year <= 2100):
                raise ValueError("Invalid month/year")
        except (ValueError, TypeError):
            return Response({'error': 'Invalid month or year parameter'}, status=400)
        
        cache_key = f'summary_month_{year}_{month:02d}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        result = {
            'timestamp': now.isoformat(),
            'view': 'month',
            'monthly': _get_month_data(year, month),
        }
        cache.set(cache_key, result, CACHE_TTL_MONTH)
        return Response(result)
    
    elif view_type == 'year':
        # Year view: monthly data for specific year
        try:
            year = int(request.GET.get('year', now.year))
            if not (2000 <= year <= 2100):
                raise ValueError("Invalid year")
        except (ValueError, TypeError):
            return Response({'error': 'Invalid year parameter'}, status=400)
        
        cache_key = f'summary_year_{year}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        result = {
            'timestamp': now.isoformat(),
            'view': 'year',
            'yearly': _get_year_data(year),
        }
        cache.set(cache_key, result, CACHE_TTL_YEAR)
        return Response(result)
    
    elif view_type == 'range':
        # Custom range view
        start_str = request.GET.get('start_date')
        end_str = request.GET.get('end_date')
        
        if not start_str or not end_str:
            return Response({'error': 'start_date and end_date are required for range view'}, status=400)
        
        start_date = _parse_date(start_str)
        end_date = _parse_date(end_str)
        
        if not start_date or not end_date:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
        
        if start_date > end_date:
            return Response({'error': 'start_date must be before end_date'}, status=400)
        
        cache_key = f'summary_range_{start_str}_{end_str}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        result = {
            'timestamp': now.isoformat(),
            'view': 'range',
            'range_data': _get_range_data(start_date, end_date),
        }
        cache.set(cache_key, result, CACHE_TTL_RANGE)
        return Response(result)
    
    elif view_type == 'flags':
        # Flag statistics view
        flag_range = request.GET.get('flag_range', '7d')
        start_str = request.GET.get('start_date')
        end_str = request.GET.get('end_date')
        
        today = now.date()
        
        # Determine date range based on flag_range preset or custom dates
        if start_str and end_str:
            # Custom range provided
            start_date = _parse_date(start_str)
            end_date = _parse_date(end_str)
            if not start_date or not end_date:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)
            if start_date > end_date:
                return Response({'error': 'start_date must be before end_date'}, status=400)
            cache_key = f'summary_flags_{start_str}_{end_str}'
        elif flag_range == '7d':
            start_date = today - timedelta(days=7)
            end_date = today
            cache_key = f'summary_flags_7d_{today.isoformat()}'
        elif flag_range == '30d':
            start_date = today - timedelta(days=30)
            end_date = today
            cache_key = f'summary_flags_30d_{today.isoformat()}'
        elif flag_range == '90d':
            start_date = today - timedelta(days=90)
            end_date = today
            cache_key = f'summary_flags_90d_{today.isoformat()}'
        elif flag_range == 'year':
            start_date = date(today.year, 1, 1)
            end_date = today
            cache_key = f'summary_flags_year_{today.year}_{today.isoformat()}'
        else:
            # Default to 7 days
            start_date = today - timedelta(days=7)
            end_date = today
            cache_key = f'summary_flags_7d_{today.isoformat()}'
        
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        result = {
            'timestamp': now.isoformat(),
            'view': 'flags',
            'flags': _get_flags_data(start_date, end_date),
        }
        cache.set(cache_key, result, CACHE_TTL_FLAGS)
        return Response(result)
    
    else:
        # Default view
        cache_key = 'summary_default'
        cached = cache.get(cache_key)
        if cached:
            # Update timestamp and current_inside for freshness
            cached['timestamp'] = now.isoformat()
            cached['today']['current_inside'] = EntryLog.objects.filter(status='ENTERED').count()
            return Response(cached)
        
        result = _get_default_summary_data()
        cache.set(cache_key, result, CACHE_TTL_DEFAULT)
        return Response(result)