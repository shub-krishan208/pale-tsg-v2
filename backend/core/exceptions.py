"""
Custom exception classes for the PALE application.
"""

from rest_framework.exceptions import APIException
from rest_framework import status


class TokenGenerationError(APIException):
    """Raised when JWT token generation fails."""
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = 'Failed to generate token'
    default_code = 'token_generation_error'


class TokenVerificationError(APIException):
    """Raised when JWT token verification fails."""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Invalid or expired token'
    default_code = 'token_verification_error'


class OpenEntryExistsError(APIException):
    """Raised when user tries to enter with an open entry."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'User has an open entry. Previous entry will be auto-closed.'
    default_code = 'open_entry_exists'


class NoEntryFoundError(APIException):
    """Raised when exit is attempted without a valid entry."""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'No entry record found'
    default_code = 'no_entry_found'


class DuplicateExitError(APIException):
    """Raised when user tries to exit multiple times."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Exit already recorded for this entry'
    default_code = 'duplicate_exit'

