"""
Token generation service for entry/exit tokens.

This service handles:
- Entry token generation with JWT signing
- Exit token generation (for lost QR cases)
- Token validation and business logic
"""

from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from core.jwt_utils import generate_jwt_token
from core.exceptions import OpenEntryExistsError


def generate_entry_token(roll: str, laptop: str = None, extra: list = None) -> Dict[str, Any]:
    """
    Generate entry token for library access.
    
    Args:
        roll: Student roll number
        laptop: Laptop description (optional)
        extra: List of extra items (optional)
    
    Returns:
        Dictionary containing:
        - token: JWT token string
        - entryId: UUID of entry record
        - expiresAt: Token expiration timestamp
        - message: User-facing message
    
    Raises:
        OpenEntryExistsError: If user has an open entry
    """
    # TODO: Check for open entries in database
    # TODO: Create entry record with status='PENDING'
    
    entry_id = str(uuid4())
    
    # Prepare JWT payload
    payload = {
        'entryId': entry_id,
        'roll': roll,
        'action': 'ENTERING',
        'laptop': laptop,
        'extra': extra or [],
    }
    
    # Generate token (24 hour expiry)
    token = generate_jwt_token(payload, expiry_hours=24)
    
    return {
        'token': token,
        'entryId': entry_id,
        'expiresAt': datetime.utcnow().isoformat() + 'Z',
        'message': 'Save this QR for both entry and exit'
    }


def generate_exit_token(roll: str) -> Dict[str, Any]:
    """
    Generate emergency exit token (for lost QR cases).
    
    Args:
        roll: Student roll number
    
    Returns:
        Dictionary containing:
        - token: JWT token string
        - exitId: UUID of exit record
        - expiresAt: Token expiration timestamp
        - message: User-facing message
    """
    # TODO: Check if user has open entry
    # TODO: Create exit record with exit_flag='INVALID_TOKEN_EXIT'
    
    exit_id = str(uuid4())
    
    # Prepare JWT payload (shorter expiry for emergency exit)
    payload = {
        'exitId': exit_id,
        'roll': roll,
        'action': 'EXITING',
        'emergency': True,
    }
    
    # Generate token (1 hour expiry)
    token = generate_jwt_token(payload, expiry_hours=1)
    
    return {
        'token': token,
        'exitId': exit_id,
        'expiresAt': datetime.utcnow().isoformat() + 'Z',
        'message': 'Emergency exit token - entry QR not available'
    }

