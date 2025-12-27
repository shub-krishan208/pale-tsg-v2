"""
JWT utility functions for RS256 token generation and verification.

This module provides functions for:
- Generating JWT tokens signed with RSA private key
- Verifying JWT tokens using RSA public key
- Loading RSA key pairs from PEM files
"""

import jwt
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any

from core.exceptions import TokenVerificationError


def load_private_key(key_path: str = None) -> str:
    """Load RSA private key from PEM file."""
    if key_path is None:
        key_path = Path(__file__).resolve().parent.parent / 'keys' / 'private.pem'
    
    with open(key_path, 'r') as f:
        return f.read()


def load_public_key(key_path: str = None) -> str:
    """Load RSA public key from PEM file."""
    if key_path is None:
        key_path = Path(__file__).resolve().parent.parent / 'keys' / 'public.pem'
    
    with open(key_path, 'r') as f:
        return f.read()


def generate_jwt_token(payload: Dict[str, Any], expiry_hours: int = 24) -> str:
    """
    Generate JWT token with RS256 signature.
    
    Args:
        payload: Token payload data
        expiry_hours: Token expiration time in hours (default 24)
    
    Returns:
        Signed JWT token string (RS256)
    """
    private_key = load_private_key()
    
    # Add standard JWT claims
    now = datetime.now(timezone.utc)
    payload.update({
        'iss': 'library-backend',
        'aud': 'library-gate',
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(hours=expiry_hours)).timestamp()),
    })
    
    token = jwt.encode(payload, private_key, algorithm='RS256')
    return token


def verify_jwt_token(token: str) -> Dict[str, Any]:
    """
    Verify JWT token signature and decode payload.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload
    
    Raises:
        jwt.ExpiredSignatureError: Token has expired
        jwt.InvalidTokenError: Token is invalid
    """
    public_key = load_public_key()
    
    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=['RS256'],
            audience='library-gate',
            issuer='library-backend'
        )
        return payload

    except jwt.ExpiredSignatureError:
        # Token expired
        raise TokenVerificationError("Token has expired")

    except jwt.InvalidTokenError as e:
        # Other invalid token errors
        raise TokenVerificationError(f"Invalid token: {str(e)}")