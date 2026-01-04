"""
Midnight auto-exit management command.

This command closes stale ENTERED entries by creating AUTO_EXIT logs
and emitting sync events. Run daily at 00:05 via cron/scheduler.

Usage:
    python manage.py auto_exit_midnight
    python manage.py auto_exit_midnight --hours 20  # custom threshold
    python manage.py auto_exit_midnight --dry-run   # preview only
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from shared.apps.entries.models import EntryLog, ExitLog
from scanner.models import OutboxEvent


class Command(BaseCommand):
    help = "Auto-exit stale ENTERED entries at midnight (creates AUTO_EXIT logs + emits sync events)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=20,
            help="Close entries older than this many hours (default: 20).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what would happen without making changes.",
        )

    def handle(self, *args, **options):
        hours_threshold = options.get("hours", 20)
        dry_run = options.get("dry_run", False)
        
        ts = timezone.now()
        cutoff = ts - timedelta(hours=hours_threshold)

        # Find stale ENTERED entries
        stale_entries = EntryLog.objects.filter(
            status="ENTERED",
            created_at__lte=cutoff,
        ).select_related("roll")

        count = stale_entries.count()
        if count == 0:
            self.stdout.write("auto_exit: No stale entries found.")
            return

        self.stdout.write(f"auto_exit: Found {count} entries older than {hours_threshold}h")

        if dry_run:
            self.stdout.write("auto_exit: DRY RUN - no changes made")
            for entry in stale_entries[:10]:  # Show first 10
                self.stdout.write(f"  Would close: {entry.id} (roll={entry.roll_id})")
            if count > 10:
                self.stdout.write(f"  ... and {count - 10} more")
            return

        # Process each stale entry
        exits_created = 0
        entries_expired = 0

        for entry in stale_entries:
            try:
                # Create AUTO_EXIT log
                exit_log = ExitLog.objects.create(
                    roll=entry.roll,
                    entry_id=entry,
                    exit_flag="AUTO_EXIT",
                    laptop=entry.laptop,
                    extra=entry.extra or [],
                    device_meta={"source": "midnight_job", "closedAt": ts.isoformat()},
                    scanned_at=ts,
                )

                # Emit EXIT event for sync
                OutboxEvent.objects.create(
                    event_type="EXIT",
                    payload={
                        "eventId": None,
                        "type": "EXIT",
                        "exitId": str(exit_log.id),
                        "entryId": str(entry.id),
                        "roll": entry.roll_id,
                        "scannedAt": ts.isoformat(),
                        "exitFlag": "AUTO_EXIT",
                        "laptop": entry.laptop,
                        "extra": entry.extra or [],
                        "deviceMeta": exit_log.device_meta,
                    },
                )

                # Update entry status to EXPIRED
                entry.status = "EXPIRED"
                entry.scanned_at = ts
                entry.save(update_fields=["status", "scanned_at"])

                # Emit ENTRY_EXPIRED_SEEN event for sync
                OutboxEvent.objects.create(
                    event_type="ENTRY_EXPIRED_SEEN",
                    payload={
                        "eventId": None,
                        "type": "ENTRY_EXPIRED_SEEN",
                        "entryId": str(entry.id),
                        "roll": entry.roll_id,
                        "scannedAt": ts.isoformat(),
                        "status": "EXPIRED",
                        "entryFlag": entry.entry_flag,
                        "laptop": entry.laptop,
                        "extra": entry.extra or [],
                    },
                )

                exits_created += 1
                entries_expired += 1
            except Exception as e:
                self.stderr.write(f"auto_exit: Error processing entry {entry.id}: {e}")

        self.stdout.write(
            f"auto_exit: Done. Created {exits_created} AUTO_EXIT logs, expired {entries_expired} entries."
        )
