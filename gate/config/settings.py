from pathlib import Path
import os
import sys

BASE_DIR = Path(__file__).resolve().parent.parent      # .../PALE-tsg/gate
REPO_ROOT = BASE_DIR.parent                           # .../PALE-tsg
sys.path.insert(0, str(REPO_ROOT))                    # so `import shared` works

#SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key")
#DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
#ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",

    # Minimal local apps (they import models from shared/)
    "shared.apps.users",
    "shared.apps.entries",
]

MIDDLEWARE = []

ROOT_URLCONF = "config.urls"

TEMPLATES = []

WSGI_APPLICATION = "config.wsgi.application"

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'pale_gate_db'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
        'PORT': os.environ.get('DB_PORT', '54323'),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"

# CORS for Next.js frontend
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]