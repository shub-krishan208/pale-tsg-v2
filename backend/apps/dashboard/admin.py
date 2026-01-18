from django.contrib import admin
from django.utils.safestring import mark_safe


# Patch the default admin site to show dashboard link in the header
original_index = admin.site.index

def patched_index(request, extra_context=None):
    extra_context = extra_context or {}
    extra_context['dashboard_url'] = '/dashboard/'
    return original_index(request, extra_context=extra_context)

admin.site.index = patched_index
admin.site.site_header = mark_safe(
    'Library Admin <a href="/dashboard/" style="float: right; font-size: 14px; '
    'background: #417690; color: white; padding: 6px 12px; border-radius: 4px; '
    'text-decoration: none; margin-top: -4px;">📊 Dashboard</a>'
)
admin.site.site_title = "Library Admin"
admin.site.index_title = "Library Administration"

