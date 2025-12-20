from django.db import models

class User(models.Model):
    roll = models.CharField(max_length=50, primary_key=True)
    
    class Meta:
        app_label = 'users'
        db_table = 'users'
        
        indexes = [
            models.Index(fields=['roll']),
        ]
        
    def __str__(self):
        return f"User(roll={self.roll} | entries={self.entry_logs.count()} | exits={self.exit_logs.count()})"
    