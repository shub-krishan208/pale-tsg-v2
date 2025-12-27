from rest_framework import serializers

from shared.models.entry_log import EntryLog


# Entry and Exit log serializers will be implemented here
class TokenGenerateRequestSerializer(serializers.Serializer):
    roll = serializers.CharField(max_length=50)
    laptop = serializers.CharField(max_length=150, required=False, allow_null=True, allow_blank=True)
    extra = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )

class EntryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EntryLog
        fields = "__all__"
