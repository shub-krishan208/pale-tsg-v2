from django.contrib import admin

from .models import EntryLog, ExitLog


@admin.register(EntryLog)
class EntryLogAdmin(admin.ModelAdmin):
    list_display = ("id", "roll", "status", "entry_flag", "created_at", "scanned_at", "laptop")
    list_filter = ("status", "entry_flag", "created_at")
    search_fields = ("id", "roll__roll", "laptop")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("roll",)
    autocomplete_fields = ("roll",)
    readonly_fields = tuple(f.name for f in EntryLog._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ExitLog)
class ExitLogAdmin(admin.ModelAdmin):
    list_display = ("id", "roll", "entry_id", "exit_flag", "created_at", "scanned_at", "laptop")
    list_filter = ("exit_flag", "created_at")
    search_fields = ("id", "roll__roll", "laptop", "entry_id__id")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("roll", "entry_id")
    autocomplete_fields = ("roll", "entry_id")
    readonly_fields = tuple(f.name for f in ExitLog._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


