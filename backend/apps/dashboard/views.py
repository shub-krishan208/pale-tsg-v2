from django.shortcuts import render
from django.conf import settings


def dashboard_view(request):
    """
    Render the dashboard page.
    Auth is handled client-side via the summary API.
    Passes kiosk mode flag based on query param.
    """
    is_kiosk = request.GET.get('kiosk', '').lower() in ('1', 'true', 'yes')
    token = request.GET.get('token', '')
    
    context = {
        'is_kiosk': is_kiosk,
        'kiosk_token': token,
        'api_base_url': '/api/entries/summary/',
    }
    return render(request, 'dashboard/dashboard.html', context)

