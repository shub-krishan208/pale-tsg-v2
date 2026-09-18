import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
django.setup()

from django.contrib.admin.sites import site
from shared.apps.entries.models import EntryLog
from shared.apps.entries.admin import EntryLogAdmin

admin_instance = EntryLogAdmin(EntryLog, site)
print("Allowed __date?", admin_instance.lookup_allowed('created_at__date', '2023-10-10'))
print("Allowed __gte?", admin_instance.lookup_allowed('created_at__gte', '2023-10-10'))
