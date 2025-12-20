import uuid
from django.db import models

from shared.models.entry_log import EntryLog
from shared.models.user import User


class ExitLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    roll=models.ForeignKey(User, on_delete=models.CASCADE, related_name='exit_logs')
    
    entry_id = models.ForeignKey(EntryLog,on_delete=models.SET_NULL, related_name='exit_id', null=True, blank=True)
    
    EXIT_FLAG_CHOICES = [
        ('NORMAL_EXIT', 'Normal Exit'),
        ('FORCED_EXIT', 'Forced Exit'),
        ('DUPLICATE_EXIT', 'Duplicate Exit'),
        ('INVALID_TOKEN_EXIT', 'Invalid Token Exit'),
    ]
    exit_flag = models.CharField(max_length=30, choices=EXIT_FLAG_CHOICES, default='NORMAL_EXIT', null=False)
    
    laptop = models.CharField(max_length=150, null=True, blank=True)
    extra = models.JSONField(default=list, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        app_label = 'entries'
        db_table = 'exit_logs'
        
        indexes = [
            models.Index(fields=['roll', 'exit_flag']),
            models.Index(fields=['created_at']),
        ]
        
    @classmethod
    def create_with_roll(cls, roll, **kwargs):
        user, _ = User.objects.get_or_create(roll=roll)
        return cls.objects.create(roll=user, **kwargs)
    
    
    def __str__(self):
        return f"ExitLog(id={self.id} | roll={self.roll} | exit_flag={self.exit_flag})"