import uuid

from django.db import models


class OutboxEvent(models.Model):
    """
    Durable outbox table for gate -> backend incremental sync.
    """

    event_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=32)
    payload = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    attempt_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default="")

    class Meta:
        db_table = "gate_outbox_events"
        indexes = [
            models.Index(fields=["sent_at"], name="outbox_sent_at_idx"),
            models.Index(fields=["next_retry_at"], name="outbox_next_retry_idx"),
            models.Index(fields=["created_at"], name="outbox_created_at_idx"),
        ]

    def __str__(self) -> str:
        return f"OutboxEvent(event_id={self.event_id}, event_type={self.event_type})"


