from pathlib import Path
import os
import sys

BASE_DIR = Path(__file__).resolve().parent.parent      # .../PALE-tsg/gate
REPO_ROOT = BASE_DIR.parent                           # .../PALE-tsg
sys.path.insert(0, str(REPO_ROOT))                    # so `import shared` works

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-gate-secret-key-change-in-production")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"]

ROOT_URLCONF = "config.urls"

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",

    # local apps
    "shared.apps.users",
    "shared.apps.entries",
    "scanner.apps.ScannerConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'pale_gate_db'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
        'PORT': os.environ.get('DB_PORT', '5434'),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"

# Gate -> backend sync worker configuration
BACKEND_SYNC_URL = os.environ.get("BACKEND_SYNC_URL", "").strip()
GATE_API_KEY = os.environ.get("GATE_API_KEY", "").strip()
SYNC_BATCH_SIZE = int(os.environ.get("SYNC_BATCH_SIZE", "200"))
SYNC_INTERVAL_SECONDS = int(os.environ.get("SYNC_INTERVAL_SECONDS", "5"))
SYNC_TIMEOUT_SECONDS = int(os.environ.get("SYNC_TIMEOUT_SECONDS", "10"))