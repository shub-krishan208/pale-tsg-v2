from .base import *  # noqa: F403 to avoid linter errors

import os

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']

# PostgreSQL for production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'pale_backend_db'),
        'USER': os.environ.get('DB_USER', 'pale_user'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'prodpassword'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# CORS for Next.js frontend
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]