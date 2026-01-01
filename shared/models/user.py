from django.db import models

class User(models.Model):
    roll = models.CharField(max_length=50, primary_key=True)
    
    class Meta:
        db_table = 'users'
        
    def __str__(self):
        return f"{self.roll}"


