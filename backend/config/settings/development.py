from .base import *  # noqa: F403 to avoid linter errors

import os

DEBUG = True

ALLOWED_HOSTS = ['*']

# PostgreSQL for development (matches production)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'pale_backend_db'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '54322'),
    }
}

# CORS for Next.js frontend
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]
