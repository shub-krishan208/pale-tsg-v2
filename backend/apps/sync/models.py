import uuid
from django.db import models


class ProcessedGateEvent(models.Model):
    """
    Idempotency table: a gate eventId is processed at most once.
    """

    event_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=32, blank=True, default="")
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "processed_gate_events"
        indexes = [
            models.Index(fields=["received_at"], name="pge_received_at_idx"),
        ]

