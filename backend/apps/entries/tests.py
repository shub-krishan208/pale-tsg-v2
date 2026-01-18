from django.test import TestCase, override_settings
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from shared.apps.entries.models import EntryLog, ExitLog
from shared.apps.users.models import User


class SummaryAPITestCase(TestCase):
    """Tests for the /api/entries/summary/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create(roll="TEST001")
        self.now = timezone.localtime()
        self.today_start = self.now.replace(hour=0, minute=0, second=0, microsecond=0)

    @override_settings(DASHBOARD_KIOSK_TOKEN="test-token-123")
    def test_summary_requires_auth(self):
        """Summary endpoint should require auth (staff or kiosk token)."""
        response = self.client.get("/api/entries/summary/")
        self.assertEqual(response.status_code, 401)

    @override_settings(DASHBOARD_KIOSK_TOKEN="test-token-123")
    def test_summary_with_kiosk_token(self):
        """Summary endpoint should allow access with valid kiosk token."""
        response = self.client.get("/api/entries/summary/?token=test-token-123")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("today", data)
        self.assertIn("hourly", data)
        self.assertIn("daily_7d", data)

    @override_settings(DASHBOARD_KIOSK_TOKEN="test-token-123")
    def test_summary_with_invalid_token(self):
        """Summary endpoint should reject invalid kiosk token."""
        response = self.client.get("/api/entries/summary/?token=wrong-token")
        self.assertEqual(response.status_code, 401)

    @override_settings(DASHBOARD_KIOSK_TOKEN="test-token-123")
    def test_summary_today_counts(self):
        """Summary should return correct today counts."""
        # Create entries/exits for today
        entry1 = EntryLog.objects.create(
            roll=self.user,
            status="ENTERED",
            scanned_at=self.now - timedelta(hours=2)
        )
        entry2 = EntryLog.objects.create(
            roll=self.user,
            status="EXITED",
            scanned_at=self.now - timedelta(hours=1)
        )
        ExitLog.objects.create(
            roll=self.user,
            entry_id=entry2,
            scanned_at=self.now - timedelta(minutes=30)
        )

        response = self.client.get("/api/entries/summary/?token=test-token-123")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["today"]["entries"], 2)
        self.assertEqual(data["today"]["exits"], 1)
        self.assertEqual(data["today"]["current_inside"], 1)  # entry1 still ENTERED

    @override_settings(DASHBOARD_KIOSK_TOKEN="test-token-123")
    def test_summary_empty_day(self):
        """Summary should handle empty day gracefully."""
        response = self.client.get("/api/entries/summary/?token=test-token-123")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["today"]["entries"], 0)
        self.assertEqual(data["today"]["exits"], 0)
        self.assertEqual(data["today"]["current_inside"], 0)
        self.assertEqual(data["hourly"], [])

    @override_settings(DASHBOARD_KIOSK_TOKEN="test-token-123")
    def test_summary_timezone_awareness(self):
        """Summary should use timezone-aware datetimes."""
        response = self.client.get("/api/entries/summary/?token=test-token-123")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Timestamp should be ISO format with timezone info
        self.assertIn("timestamp", data)
        self.assertIn("+", data["timestamp"])  # Should have timezone offset

