import json

from django.contrib import admin

from shared.apps.entries.models import EntryLog, ExitLog

@admin.register(EntryLog)
class EntryLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "roll",
        "status",
        "entry_flag",
        "source",
        "os",
        "device_id",
        "created_at",
        "scanned_at",
        "laptop",
        "short_device_meta",
    )
    list_filter = ("status", "entry_flag", "source", "os", "created_at")
    search_fields = ("id", "roll__roll", "laptop", "device_id")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("roll",)
    autocomplete_fields = ("roll",)
    readonly_fields = tuple(f.name for f in EntryLog._meta.fields)

    def short_device_meta(self, obj):
        meta = obj.device_meta or {}
        # Limit size in changelist; admin detail shows full JSON
        return json.dumps(meta)[:120] + ("…" if len(json.dumps(meta)) > 120 else "")

    short_device_meta.short_description = "deviceMeta"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ExitLog)
class ExitLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "roll",
        "entry_id",
        "exit_flag",
        "source",
        "os",
        "device_id",
        "created_at",
        "scanned_at",
        "laptop",
        "short_device_meta",
    )
    list_filter = ("exit_flag", "source", "os", "created_at")
    search_fields = ("id", "roll__roll", "laptop", "entry_id__id", "device_id")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("roll", "entry_id")
    autocomplete_fields = ("roll", "entry_id")
    readonly_fields = tuple(f.name for f in ExitLog._meta.fields)

    def short_device_meta(self, obj):
        meta = obj.device_meta or {}
        return json.dumps(meta)[:120] + ("…" if len(json.dumps(meta)) > 120 else "")

    short_device_meta.short_description = "deviceMeta"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


