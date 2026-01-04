from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from backend.core.jwt_utils import generate_jwt_token
from shared.models.entry_log import EntryLog
from .serializers import TokenGenerateRequestSerializer, EmergencyExitTokenRequestSerializer

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