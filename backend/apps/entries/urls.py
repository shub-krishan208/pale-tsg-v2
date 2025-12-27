from django.urls import path

from . import views


urlpatterns = [
    # Entry/Exit token generation endpoints will be defined here
    path('generate/', views.generate_token, name='generate_token'),
    # path('token/generate/exit', views.generate_exit_token, name='generate_exit_token'),
]

