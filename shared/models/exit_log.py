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
        ('EMERGENCY_EXIT', 'Emergency Exit'),
        ('ORPHAN_EXIT', 'Orphan Exit'),
        ('AUTO_EXIT', 'Auto Exit'),
        ('DUPLICATE_EXIT', 'Duplicate Exit'),
    ]
    exit_flag = models.CharField(max_length=30, choices=EXIT_FLAG_CHOICES, default='NORMAL_EXIT', null=False)
    
    laptop = models.CharField(max_length=150, null=True, blank=True)
    extra = models.JSONField(default=list, blank=True)
    device_meta = models.JSONField(default=dict, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        app_label = "entries"
        db_table = 'exit_logs'
        
        indexes = [
            models.Index(fields=['roll', 'exit_flag'], name='exit_logs_roll_id_aae378_idx'),
            models.Index(fields=['entry_id'], name='exit_logs_entry_id_idx'),
            models.Index(fields=['created_at'], name='exit_logs_created_91862c_idx'),
        ]
        
    @classmethod
    def create_with_roll(cls, roll, **kwargs):
        user, _ = User.objects.get_or_create(roll=roll)
        return cls.objects.create(roll=user, **kwargs)
    
    
    def __str__(self):
        return f"{self.roll} | {self.id}"