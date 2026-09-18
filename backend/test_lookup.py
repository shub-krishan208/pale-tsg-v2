import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.contrib.admin.views.main import ChangeList
from django.contrib.admin.sites import site
from django.test import RequestFactory
from shared.apps.entries.models import EntryLog
from shared.apps.entries.admin import EntryLogAdmin

admin_instance = EntryLogAdmin(EntryLog, site)
factory = RequestFactory()
request = factory.get('/admin/entries/entrylog/', {'created_at__date': '2023-10-10'})
try:
    cl = admin_instance.get_changelist_instance(request)
    print("Allowed!", cl.get_queryset(request).query)
except Exception as e:
    print("Error:", type(e), e)
