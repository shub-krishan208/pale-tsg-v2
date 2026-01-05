from django.contrib import admin
from django.forms.models import BaseInlineFormSet
from django.urls import reverse
from django.utils.html import format_html
from django.utils.http import urlencode
from django.db.models import Count

from shared.apps.entries.models import EntryLog, ExitLog
from .models import User

INLINE_LOG_LIMIT = 50

class _LimitedInlineFormSet(BaseInlineFormSet):
    """
    Limits inline records to the most recent 50.
    CRITICAL: This only works safely because can_delete=False.
    If can_delete is True, Django attempts to filter this sliced queryset,
    causing a TypeError.
    """
    limit = INLINE_LOG_LIMIT

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # We assume the queryset is already filtered by the parent instance via super()
        # We apply the slice here.
        self.queryset = self.queryset[:self.limit]

class EntryLogInlineFormSet(_LimitedInlineFormSet):
    pass

class ExitLogInlineFormSet(_LimitedInlineFormSet):
    pass

class EntryLogInline(admin.TabularInline):
    model = EntryLog
    fk_name = "roll"
    formset = EntryLogInlineFormSet
    extra = 0
    can_delete = False # Vital for the slicing hack to work
    show_change_link = True
    ordering = ("-created_at",)
    fields = ("status", "entry_flag", "laptop", "extra_count", "created_at", "scanned_at")
    readonly_fields = fields

    @admin.display(description="Extra")
    def extra_count(self, obj):
        """Function to display no. of objects in extra"""
        if not obj.extra or not isinstance(obj.extra, list):
            return "-"
        count = len(obj.extra)
        return str(count) if count > 0 else "-"
    
    def get_queryset(self, request):
        # REMOVED: select_related("roll") is redundant inside an Inline for User
        qs = super().get_queryset(request)
        return qs.order_by("-created_at")

    def has_add_permission(self, request, obj=None):
        return False

class ExitLogInline(admin.TabularInline):
    model = ExitLog
    fk_name = "roll"
    formset = ExitLogInlineFormSet
    extra = 0
    can_delete = False
    show_change_link = True
    ordering = ("-created_at",)
    fields = ("entry_id", "exit_flag", "laptop", "extra_count", "created_at", "scanned_at")
    readonly_fields = fields

    @admin.display(description="Extra")
    def extra_count(self, obj):
        if not obj.extra or not isinstance(obj.extra, list):
            return "-"
        count = len(obj.extra)
        return str(count) if count > 0 else "-"
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # REMOVED: select_related("roll"). 
        # Kept entry_id because that links to a different model (EntryLog)
        return qs.select_related("entry_id").order_by("-created_at")

    def has_add_permission(self, request, obj=None):
        return False

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("roll", "entry_log_count", "exit_log_count", "view_logs_actions")
    search_fields = ("roll",)
    ordering = ("roll",)
    inlines = (EntryLogInline, ExitLogInline)
    # entry_logs_link and exit_logs_link removed from fields/readonly 
    # in favor of a cleaner "actions" column or grouping, 
    # but kept in fields if you want them on the detail view.
    readonly_fields = ("view_logs_actions",) 
    
    def get_queryset(self, request):
        """
        Optimization: Annotate counts to solve N+1 query problem.
        """
        qs = super().get_queryset(request)
        return qs.annotate(
            _entry_count=Count('entry_logs'),
            _exit_count=Count('exit_logs')
        )

    @admin.display(description="Entries", ordering="_entry_count")
    def entry_log_count(self, obj):
        # Use the annotated value. Fallback to 0 if not present.
        return getattr(obj, '_entry_count', 0)

    @admin.display(description="Exits", ordering="_exit_count")
    def exit_log_count(self, obj):
        # Use the annotated value.
        return getattr(obj, '_exit_count', 0)

    @admin.display(description="Log Actions")
    def view_logs_actions(self, obj):
        """
        Combines links into one column for cleaner list view
        """
        entry_url = reverse("admin:entries_entrylog_changelist")
        exit_url = reverse("admin:entries_exitlog_changelist")
        
        # We filter by 'roll' (the ForeignKey field name). 
        # Since User PK is 'roll', this works perfectly.
        params = urlencode({"roll": obj.pk}) 
        
        return format_html(
            '<a href="{}?{}" style="margin-right:10px;">Entries</a>'
            '<a href="{}?{}">Exits</a>',
            entry_url, params,
            exit_url, params,
        )