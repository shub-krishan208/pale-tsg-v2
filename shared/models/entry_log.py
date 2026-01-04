from django.db import models
import uuid

from shared.models.user import User

class EntryLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    roll = models.ForeignKey(User, on_delete=models.CASCADE, related_name='entry_logs')
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ENTERED', 'Entered'),
        ('EXITED', 'Exited'),
        ('EXPIRED', 'Expired'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, null=False, default='PENDING')
    
    ENTRY_FLAG_CHOICES = [
        ('NORMAL_ENTRY', 'Normal Entry'),
        ('FORCED_ENTRY', 'Forced Entry'),
        ('DUPLICATE_ENTRY', 'Duplicate Entry'),
    ]
    
    entry_flag = models.CharField(max_length=30, choices=ENTRY_FLAG_CHOICES, null=True, blank=True)
    laptop = models.CharField(max_length=150, null=True, blank=True)
    extra = models.JSONField(default=list, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        app_label = "entries"
        db_table = 'entry_logs'
        
        indexes = [
            models.Index(fields=['roll', 'status'], name='entry_logs_roll_id_d07c5e_idx'),
            models.Index(fields=['created_at'], name='entry_logs_created_2443f2_idx'),
        ]
    
    @classmethod
    def create_with_roll(cls, roll, **kwargs):
        user, _ = User.objects.get_or_create(roll=roll)
        return cls.objects.create(roll=user, **kwargs)
    
    def __str__(self):
        return f"{self.roll} | {self.id}"