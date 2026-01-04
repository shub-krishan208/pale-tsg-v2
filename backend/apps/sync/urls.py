from django.urls import path

from . import views


urlpatterns = [
    # Gate sync endpoint will be defined here
    path("gate/events", views.gate_events, name="gate_events"),
]

