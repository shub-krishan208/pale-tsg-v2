from django.db import models

class User(models.Model):
    roll = models.CharField(max_length=50, primary_key=True)
    
    class Meta:
        app_label = "users"
        db_table = 'users'
        indexes = [
            models.Index(fields=["roll"], name="users_roll_ba5404_idx"),
        ]
        
    def __str__(self):
        return f"{self.roll}"


