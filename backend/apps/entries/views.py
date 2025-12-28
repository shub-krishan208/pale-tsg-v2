from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from backend.core.jwt_utils import generate_jwt_token
from shared.models.entry_log import EntryLog
from .serializers import TokenGenerateRequestSerializer

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