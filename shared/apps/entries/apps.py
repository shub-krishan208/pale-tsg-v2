# shared/apps/entries/apps.py
from django.apps import AppConfig

class EntriesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "shared.apps.entries"
    label = "entries"