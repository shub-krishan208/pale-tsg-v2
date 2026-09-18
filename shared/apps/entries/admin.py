import json

from django.contrib import admin

from shared.apps.entries.models import EntryLog, ExitLog


class DatePickerFilter(admin.SimpleListFilter):
    title = 'Date'
    parameter_name = 'created_at__date'

    def lookups(self, request, model_admin):
        return []

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(created_at__date=self.value())
        return queryset


@admin.register(EntryLog)
class EntryLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "roll",
        "get_name",
        "status",
        "entry_flag",
        "source",
        "os",
        "created_at",
        "scanned_at",
        "laptop",
        "short_device_meta",
    )
    list_filter = ("status", "entry_flag", "source", "os", "created_at", DatePickerFilter)
    search_fields = ("id", "roll__name", "roll__roll", "laptop")
    ordering = ("-created_at",)
    list_select_related = ("roll",)
    autocomplete_fields = ("roll",)
    readonly_fields = tuple(f.name for f in EntryLog._meta.fields)
    change_list_template = "admin/entries/change_list.html"

    def get_name(self, obj):
        return obj.roll.name if obj.roll else None
    get_name.short_description = "Name"
    get_name.admin_order_field = "roll__name"

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
        "get_name",
        "entry_id",
        "exit_flag",
        "source",
        "os",
        "created_at",
        "scanned_at",
        "laptop",
        "short_device_meta",
    )
    list_filter = ("exit_flag", "source", "os", "created_at", DatePickerFilter)
    search_fields = ("id", "roll__name", "roll__roll", "laptop", "entry_id__id")
    ordering = ("-created_at",)
    list_select_related = ("roll", "entry_id")
    autocomplete_fields = ("roll", "entry_id")
    readonly_fields = tuple(f.name for f in ExitLog._meta.fields)
    change_list_template = "admin/entries/change_list.html"

    def get_name(self, obj):
        return obj.roll.name if obj.roll else None
    get_name.short_description = "Name"
    get_name.admin_order_field = "roll__name"

    def short_device_meta(self, obj):
        meta = obj.device_meta or {}
        return json.dumps(meta)[:120] + ("…" if len(json.dumps(meta)) > 120 else "")

    short_device_meta.short_description = "deviceMeta"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
