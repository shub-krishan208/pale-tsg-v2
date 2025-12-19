"""
Custom middleware for the PALE application.
"""

import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log incoming requests and responses.
    Useful for debugging and audit trail.
    """
    
    def process_request(self, request):
        """Log incoming request details."""
        logger.info(
            f"Request: {request.method} {request.path} "
            f"from {request.META.get('REMOTE_ADDR')}"
        )
        return None
    
    def process_response(self, request, response):
        """Log response status."""
        logger.info(
            f"Response: {request.method} {request.path} "
            f"-> {response.status_code}"
        )
        return response


class ConcurrentRequestMiddleware(MiddlewareMixin):
    """
    Middleware to handle concurrent request detection.
    Can be extended to add rate limiting or duplicate request detection.
    """
    
    def process_request(self, request):
        """Process request for concurrent access patterns."""
        # Placeholder for concurrent request handling logic
        # Can be extended with Redis-based locking or rate limiting
        return None

