from django.urls import path

from . import views


urlpatterns = [
    # Entry/Exit token generation endpoints will be defined here
    path('generate/', views.generate_token, name='generate_token'),
    path('generate/exit/', views.generate_emergency_exit_token, name='generate_emergency_exit_token'),
]


