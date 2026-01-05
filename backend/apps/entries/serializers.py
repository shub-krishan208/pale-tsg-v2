from rest_framework import serializers

from shared.apps.entries.models import EntryLog


# Entry and Exit log serializers will be implemented here
class TokenGenerateRequestSerializer(serializers.Serializer):
    roll = serializers.CharField(max_length=50)
    laptop = serializers.CharField(max_length=150, required=False, allow_null=True, allow_blank=True)
    extra = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        required=False,
        allow_empty=True
)


class EmergencyExitTokenRequestSerializer(serializers.Serializer):
    """Request serializer for emergency exit token generation."""
    roll = serializers.CharField(max_length=50)
    laptop = serializers.CharField(max_length=150, required=False, allow_null=True, allow_blank=True)
    extra = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        required=False,
        allow_empty=True
    )


# useless for now, made to return entry log object for debugs
class EntryLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EntryLog
        fields = "__all__"

