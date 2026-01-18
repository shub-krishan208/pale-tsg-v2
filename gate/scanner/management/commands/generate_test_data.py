"""
Bulk test data generation for dashboard testing.

This command directly injects EntryLogs and ExitLogs into the gate database
with full timestamp control and proper OutboxEvents for sync testing.

Usage:
    python manage.py generate_test_data \
        --rolls "24MA10001-24MA10050" \
        --date-range "2026-01-01,2026-01-15" \
        --entries-per-user 3 \
        --exit-ratio 0.85

    python manage.py generate_test_data \
        --rolls "24MA10001,24MA10002,24MA10003" \
        --date-range "2026-01-10,2026-01-10" \
        --dry-run
"""

import random
import re
import uuid
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from scanner.models import OutboxEvent
from scanner.test_fixtures import DEVICE_META_TEMPLATES, EXTRA_ITEMS, LAPTOP_OPTIONS, biased_hour
from shared.apps.entries.models import EntryLog, ExitLog
from shared.apps.users.models import User


def parse_roll_range(rolls_str: str) -> list[str]:
    """
    Parse roll range string into list of roll numbers.
    
    Supports:
    - Range: "24MA10001-24MA10050"
    - Comma-separated: "24MA10001,24MA10002,24MA10003"
    - Mixed: "24MA10001-24MA10010,24MA20001-24MA20005"
    """
    rolls = []
    parts = rolls_str.split(",")
    
    for part in parts:
        part = part.strip()
        if "-" in part and not part.startswith("-"):
            # Check if it's a range (e.g., "24MA10001-24MA10050")
            # We need to be careful with hyphens that might be part of the roll number
            match = re.match(r"^(.+?)(\d+)-(.+?)(\d+)$", part)
            if match:
                prefix1, start_num, prefix2, end_num = match.groups()
                if prefix1 == prefix2:
                    # Same prefix, generate range
                    num_width = len(start_num)
                    for i in range(int(start_num), int(end_num) + 1):
                        rolls.append(f"{prefix1}{str(i).zfill(num_width)}")
                else:
                    # Different prefixes, treat as two separate rolls
                    rolls.append(part)
            else:
                # Not a valid range pattern, treat as single roll
                rolls.append(part)
        else:
            rolls.append(part)
    
    return rolls


def random_datetime_in_range(
    start_date: datetime,
    end_date: datetime,
    hour_start: int,
    hour_end: int,
    bias: str = "none",
) -> datetime:
    """Generate random datetime within date range and hour range."""
    # Random date between start and end
    days_diff = (end_date - start_date).days
    random_days = random.randint(0, max(0, days_diff))
    target_date = start_date + timedelta(days=random_days)
    
    # Random time within hour range (with optional bias)
    if hour_end <= hour_start:
        hour_end = 24
    random_hour = biased_hour(hour_start, hour_end, bias)
    random_minute = random.randint(0, 59)
    random_second = random.randint(0, 59)
    
    return target_date.replace(
        hour=random_hour,
        minute=random_minute,
        second=random_second,
        microsecond=random.randint(0, 999999),
    )


class Command(BaseCommand):
    help = "Generate bulk test data for dashboard testing with full timestamp control"

    def add_arguments(self, parser):
        parser.add_argument(
            "--rolls",
            required=True,
            help='Roll range (e.g., "24MA10001-24MA10050") or comma-separated list',
        )
        parser.add_argument(
            "--date-range",
            required=True,
            help='Start,End dates for created_at (e.g., "2026-01-01,2026-01-15")',
        )
        parser.add_argument(
            "--entries-per-user",
            type=int,
            default=3,
            help="Base number of entries per user (randomized +/- 50%%). Default: 3",
        )
        parser.add_argument(
            "--exit-ratio",
            type=float,
            default=0.85,
            help="Fraction of entries that get normal exits. Default: 0.85",
        )
        parser.add_argument(
            "--orphan-rate",
            type=float,
            default=0.05,
            help="Fraction of exits without matching entry. Default: 0.05",
        )
        parser.add_argument(
            "--duplicate-rate",
            type=float,
            default=0.02,
            help="Rate of duplicate entry/exit scans. Default: 0.02",
        )
        parser.add_argument(
            "--late-scan-rate",
            type=float,
            default=0.10,
            help="Rate of scans beyond 24hr window. Default: 0.10",
        )
        parser.add_argument(
            "--hour-range",
            default="8,24",
            help='Operating hours for created_at (e.g., "8,24" for 8am-midnight). Default: 8,24',
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview without inserting data",
        )

    def handle(self, *args, **options):
        # Parse rolls
        rolls = parse_roll_range(options["rolls"])
        if not rolls:
            raise CommandError("No valid roll numbers parsed from --rolls")
        
        # Parse date range
        date_parts = options["date_range"].split(",")
        if len(date_parts) != 2:
            raise CommandError("--date-range must be in format 'YYYY-MM-DD,YYYY-MM-DD'")
        
        try:
            start_date = datetime.strptime(date_parts[0].strip(), "%Y-%m-%d")
            end_date = datetime.strptime(date_parts[1].strip(), "%Y-%m-%d")
            # Make timezone aware
            start_date = timezone.make_aware(start_date)
            end_date = timezone.make_aware(end_date)
        except ValueError as e:
            raise CommandError(f"Invalid date format: {e}")
        
        # Parse hour range
        hour_parts = options["hour_range"].split(",")
        if len(hour_parts) != 2:
            raise CommandError("--hour-range must be in format 'start,end' (e.g., '8,24')")
        hour_start, hour_end = int(hour_parts[0]), int(hour_parts[1])
        
        # Get other options
        entries_per_user = options["entries_per_user"]
        exit_ratio = options["exit_ratio"]
        orphan_rate = options["orphan_rate"]
        duplicate_rate = options["duplicate_rate"]
        late_scan_rate = options["late_scan_rate"]
        dry_run = options["dry_run"]
        
        self.stdout.write(f"Generating test data for {len(rolls)} users...")
        self.stdout.write(f"  Date range: {start_date.date()} to {end_date.date()}")
        self.stdout.write(f"  Hour range: {hour_start}:00 to {hour_end}:00")
        self.stdout.write(f"  Entries per user: ~{entries_per_user} (+/- 50%)")
        self.stdout.write(f"  Exit ratio: {exit_ratio:.0%}")
        self.stdout.write(f"  Orphan rate: {orphan_rate:.0%}")
        self.stdout.write(f"  Duplicate rate: {duplicate_rate:.0%}")
        self.stdout.write(f"  Late scan rate: {late_scan_rate:.0%}")
        
        if dry_run:
            self.stdout.write(self.style.WARNING("\n  DRY RUN - No data will be inserted\n"))
        
        # Statistics
        stats = {
            "entries_created": 0,
            "exits_created": 0,
            "orphan_exits": 0,
            "duplicate_entries": 0,
            "duplicate_exits": 0,
            "forced_entries": 0,
            "late_scans": 0,
            "outbox_events": 0,
        }
        
        if not dry_run:
            with transaction.atomic():
                self._generate_data(
                    rolls=rolls,
                    start_date=start_date,
                    end_date=end_date,
                    hour_start=hour_start,
                    hour_end=hour_end,
                    entries_per_user=entries_per_user,
                    exit_ratio=exit_ratio,
                    orphan_rate=orphan_rate,
                    duplicate_rate=duplicate_rate,
                    late_scan_rate=late_scan_rate,
                    stats=stats,
                )
        else:
            # Dry run - simulate with timestamps output
            self._dry_run_preview(
                rolls=rolls,
                start_date=start_date,
                end_date=end_date,
                hour_start=hour_start,
                hour_end=hour_end,
                entries_per_user=entries_per_user,
                exit_ratio=exit_ratio,
                orphan_rate=orphan_rate,
                duplicate_rate=duplicate_rate,
                late_scan_rate=late_scan_rate,
                stats=stats,
            )
        
        # Print summary
        self.stdout.write("\n" + self.style.SUCCESS("Summary:"))
        self.stdout.write(f"  Entries created: {stats['entries_created']}")
        self.stdout.write(f"  Exits created: {stats['exits_created']}")
        self.stdout.write(f"  Orphan exits: {stats['orphan_exits']}")
        self.stdout.write(f"  Forced entries: {stats['forced_entries']}")
        self.stdout.write(f"  Duplicate entries: {stats['duplicate_entries']}")
        self.stdout.write(f"  Duplicate exits: {stats['duplicate_exits']}")
        self.stdout.write(f"  Late scans: {stats['late_scans']}")
        self.stdout.write(f"  OutboxEvents: {stats['outbox_events']}")

    def _generate_data(
        self,
        rolls: list[str],
        start_date: datetime,
        end_date: datetime,
        hour_start: int,
        hour_end: int,
        entries_per_user: int,
        exit_ratio: float,
        orphan_rate: float,
        duplicate_rate: float,
        late_scan_rate: float,
        stats: dict,
    ):
        """Generate and insert test data."""
        
        for roll in rolls:
            # Get or create user
            user, _ = User.objects.get_or_create(roll=roll)
            
            # Randomize entries per user (+/- 50%)
            variance = random.uniform(0.5, 1.5)
            num_entries = max(1, int(entries_per_user * variance))
            
            for _ in range(num_entries):
                # Generate entry
                entry = self._create_entry(
                    user=user,
                    start_date=start_date,
                    end_date=end_date,
                    hour_start=hour_start,
                    hour_end=hour_end,
                    late_scan_rate=late_scan_rate,
                    duplicate_rate=duplicate_rate,
                    stats=stats,
                )
                
                # Maybe generate exit
                if random.random() < exit_ratio:
                    self._create_exit(
                        user=user,
                        entry=entry,
                        duplicate_rate=duplicate_rate,
                        stats=stats,
                    )
            
            # Maybe generate orphan exit
            if random.random() < orphan_rate:
                self._create_orphan_exit(
                    user=user,
                    start_date=start_date,
                    end_date=end_date,
                    hour_start=hour_start,
                    hour_end=hour_end,
                    stats=stats,
                )

    def _create_entry(
        self,
        user: User,
        start_date: datetime,
        end_date: datetime,
        hour_start: int,
        hour_end: int,
        late_scan_rate: float,
        duplicate_rate: float,
        stats: dict,
    ) -> EntryLog:
        """Create an entry log with realistic data."""
        
        # Generate timestamps (biased towards early hours)
        created_at = random_datetime_in_range(start_date, end_date, hour_start, hour_end, bias="entry")
        
        # scanned_at is usually within a few minutes of created_at (token generation -> scan)
        if random.random() < late_scan_rate:
            # Late scan: >24 hours
            scan_offset = timedelta(hours=random.randint(25, 48))
            stats["late_scans"] += 1
        else:
            # Normal scan: 0-6 hours after created_at
            scan_offset = timedelta(minutes=random.randint(0, 360))
        
        scanned_at = created_at + scan_offset
        
        # Random data
        laptop = random.choice(LAPTOP_OPTIONS) or None
        extra = random.choice(EXTRA_ITEMS)
        device_meta_template = random.choice(DEVICE_META_TEMPLATES)
        device_meta = dict(device_meta_template)
        device_meta["testGenerated"] = True
        
        # Entry flag
        if random.random() < 0.05:
            entry_flag = "FORCED_ENTRY"
            stats["forced_entries"] += 1
        else:
            entry_flag = "NORMAL_ENTRY"
        
        # Determine status based on whether exit will be created
        # For now, mark as ENTERED; will be updated to EXITED if exit is created
        status = "ENTERED"
        
        os_name = device_meta.get("os")
        source = device_meta.get("source", "TEST")
        
        # Create entry
        entry = EntryLog.objects.create(
            id=uuid.uuid4(),
            roll=user,
            status=status,
            entry_flag=entry_flag,
            laptop=laptop,
            extra=extra,
            scanned_at=scanned_at,
            source=source,
            os=os_name,
            device_id=f"test-device-{user.roll}",
            device_meta=device_meta,
        )
        
        # Override created_at (bypassing auto_now_add)
        EntryLog.objects.filter(id=entry.id).update(created_at=created_at)
        
        # Create outbox event
        OutboxEvent.objects.create(
            event_type="ENTRY",
            payload={
                "eventId": None,
                "type": "ENTRY",
                "entryId": str(entry.id),
                "roll": user.roll,
                "createdAt": created_at.isoformat(),
                "scannedAt": scanned_at.isoformat(),
                "status": status,
                "entryFlag": entry_flag,
                "laptop": laptop,
                "extra": extra,
                "deviceMeta": device_meta,
                "deviceId": entry.device_id,
                "source": "TEST",
                "os": os_name,
            },
        )
        
        stats["entries_created"] += 1
        stats["outbox_events"] += 1
        
        # Maybe create duplicate entry
        if random.random() < duplicate_rate:
            self._create_duplicate_entry(entry, stats)
        
        return entry

    def _create_duplicate_entry(self, original_entry: EntryLog, stats: dict):
        """Create a duplicate entry event (same entry scanned twice)."""
        # Just create an outbox event for the duplicate scan
        # The actual behavior in process_token is to log and ignore
        OutboxEvent.objects.create(
            event_type="ENTRY",
            payload={
                "eventId": None,
                "type": "ENTRY",
                "entryId": str(original_entry.id),
                "roll": original_entry.roll_id,
                "scannedAt": (original_entry.scanned_at + timedelta(seconds=30)).isoformat(),
                "status": "ENTERED",
                "entryFlag": "DUPLICATE_ENTRY",
                "laptop": original_entry.laptop,
                "extra": original_entry.extra,
                "deviceMeta": {"duplicate": True, "originalEntryId": str(original_entry.id)},
                "source": "TEST",
            },
        )
        stats["duplicate_entries"] += 1
        stats["outbox_events"] += 1

    def _create_exit(
        self,
        user: User,
        entry: EntryLog,
        duplicate_rate: float,
        stats: dict,
    ):
        """Create an exit log linked to an entry."""
        
        # Exit happens 1-8 hours after entry scan (biased towards longer stays → later exits)
        exit_offset = timedelta(hours=random.triangular(1, 8, 5))
        scanned_at = entry.scanned_at + exit_offset
        
        # Random data - often same as entry, sometimes different
        if random.random() < 0.8:
            laptop = entry.laptop
            extra = entry.extra
        else:
            laptop = random.choice(LAPTOP_OPTIONS) or None
            extra = random.choice(EXTRA_ITEMS)
        
        # Exit flag
        exit_flags = ["NORMAL_EXIT"] * 18 + ["EMERGENCY_EXIT"] * 1 + ["NORMAL_EXIT"] * 1
        exit_flag = random.choice(exit_flags)
        
        device_meta = dict(entry.device_meta or {})
        device_meta["testGenerated"] = True
        
        # Create exit
        exit_log = ExitLog.objects.create(
            id=uuid.uuid4(),
            roll=user,
            entry_id=entry,
            exit_flag=exit_flag,
            laptop=laptop,
            extra=extra,
            scanned_at=scanned_at,
            source="TEST",
            os=entry.os,
            device_id=entry.device_id,
            device_meta=device_meta,
        )
        
        # Override created_at
        ExitLog.objects.filter(id=exit_log.id).update(created_at=scanned_at)
        
        # Update entry status to EXITED
        EntryLog.objects.filter(id=entry.id).update(status="EXITED")
        
        # Create outbox event
        OutboxEvent.objects.create(
            event_type="EXIT",
            payload={
                "eventId": None,
                "type": "EXIT",
                "exitId": str(exit_log.id),
                "entryId": str(entry.id),
                "roll": user.roll,
                "createdAt": scanned_at.isoformat(),
                "scannedAt": scanned_at.isoformat(),
                "exitFlag": exit_flag,
                "laptop": laptop,
                "extra": extra,
                "deviceMeta": device_meta,
                "deviceId": exit_log.device_id,
                "source": "TEST",
                "os": exit_log.os,
            },
        )
        
        stats["exits_created"] += 1
        stats["outbox_events"] += 1
        
        # Maybe create duplicate exit
        if random.random() < duplicate_rate:
            self._create_duplicate_exit(exit_log, entry, user, stats)

    def _create_duplicate_exit(
        self,
        original_exit: ExitLog,
        entry: EntryLog,
        user: User,
        stats: dict,
    ):
        """Create a duplicate exit (same exit scanned twice)."""
        scanned_at = original_exit.scanned_at + timedelta(seconds=45)
        
        exit_log = ExitLog.objects.create(
            id=uuid.uuid4(),
            roll=user,
            entry_id=entry,
            exit_flag="DUPLICATE_EXIT",
            laptop=original_exit.laptop,
            extra=original_exit.extra,
            scanned_at=scanned_at,
            source="TEST",
            os=original_exit.os,
            device_id=original_exit.device_id,
            device_meta={"duplicate": True, "originalExitId": str(original_exit.id)},
        )
        
        ExitLog.objects.filter(id=exit_log.id).update(created_at=scanned_at)
        
        OutboxEvent.objects.create(
            event_type="EXIT",
            payload={
                "eventId": None,
                "type": "EXIT",
                "exitId": str(exit_log.id),
                "entryId": str(entry.id),
                "roll": user.roll,
                "createdAt": scanned_at.isoformat(),
                "scannedAt": scanned_at.isoformat(),
                "exitFlag": "DUPLICATE_EXIT",
                "laptop": exit_log.laptop,
                "extra": exit_log.extra,
                "deviceMeta": exit_log.device_meta,
                "source": "TEST",
            },
        )
        
        stats["duplicate_exits"] += 1
        stats["outbox_events"] += 1

    def _create_orphan_exit(
        self,
        user: User,
        start_date: datetime,
        end_date: datetime,
        hour_start: int,
        hour_end: int,
        stats: dict,
    ):
        """Create an orphan exit (no matching entry)."""
        scanned_at = random_datetime_in_range(start_date, end_date, hour_start, hour_end, bias="exit")
        
        laptop = random.choice(LAPTOP_OPTIONS) or None
        extra = random.choice(EXTRA_ITEMS)
        device_meta = {"orphan": True, "testGenerated": True}
        
        exit_log = ExitLog.objects.create(
            id=uuid.uuid4(),
            roll=user,
            entry_id=None,  # Orphan - no entry
            exit_flag="ORPHAN_EXIT",
            laptop=laptop,
            extra=extra,
            scanned_at=scanned_at,
            source="TEST",
            device_meta=device_meta,
        )
        
        ExitLog.objects.filter(id=exit_log.id).update(created_at=scanned_at)
        
        OutboxEvent.objects.create(
            event_type="EXIT",
            payload={
                "eventId": None,
                "type": "EXIT",
                "exitId": str(exit_log.id),
                "entryId": None,
                "roll": user.roll,
                "createdAt": scanned_at.isoformat(),
                "scannedAt": scanned_at.isoformat(),
                "exitFlag": "ORPHAN_EXIT",
                "laptop": laptop,
                "extra": extra,
                "deviceMeta": device_meta,
                "source": "TEST",
            },
        )
        
        stats["orphan_exits"] += 1
        stats["exits_created"] += 1
        stats["outbox_events"] += 1

    def _dry_run_preview(
        self,
        rolls: list[str],
        start_date: datetime,
        end_date: datetime,
        hour_start: int,
        hour_end: int,
        entries_per_user: int,
        exit_ratio: float,
        orphan_rate: float,
        duplicate_rate: float,
        late_scan_rate: float,
        stats: dict,
    ):
        """Preview what would be generated with timestamps, without inserting."""
        events = []  # Collect all events for sorted output
        
        for roll in rolls:
            variance = random.uniform(0.5, 1.5)
            num_entries = max(1, int(entries_per_user * variance))
            
            for _ in range(num_entries):
                # Generate entry timestamps
                created_at = random_datetime_in_range(start_date, end_date, hour_start, hour_end, bias="entry")
                
                if random.random() < late_scan_rate:
                    scan_offset = timedelta(hours=random.randint(25, 48))
                    is_late = True
                    stats["late_scans"] += 1
                else:
                    scan_offset = timedelta(minutes=random.randint(0, 360))
                    is_late = False
                
                entry_scanned_at = created_at + scan_offset
                
                # Entry flag
                if random.random() < 0.05:
                    entry_flag = "FORCED_ENTRY"
                    stats["forced_entries"] += 1
                else:
                    entry_flag = "NORMAL_ENTRY"
                
                events.append({
                    "type": "ENTRY",
                    "roll": roll,
                    "created_at": created_at,
                    "scanned_at": entry_scanned_at,
                    "flag": entry_flag,
                    "late": is_late,
                })
                stats["entries_created"] += 1
                stats["outbox_events"] += 1
                
                # Duplicate entry
                if random.random() < duplicate_rate:
                    dup_scanned_at = entry_scanned_at + timedelta(seconds=30)
                    events.append({
                        "type": "ENTRY",
                        "roll": roll,
                        "created_at": created_at,
                        "scanned_at": dup_scanned_at,
                        "flag": "DUPLICATE_ENTRY",
                        "late": False,
                    })
                    stats["duplicate_entries"] += 1
                    stats["outbox_events"] += 1
                
                # Exit
                if random.random() < exit_ratio:
                    exit_offset = timedelta(hours=random.triangular(1, 8, 5))
                    exit_scanned_at = entry_scanned_at + exit_offset
                    
                    exit_flags = ["NORMAL_EXIT"] * 18 + ["EMERGENCY_EXIT"] * 1 + ["NORMAL_EXIT"] * 1
                    exit_flag = random.choice(exit_flags)
                    
                    events.append({
                        "type": "EXIT",
                        "roll": roll,
                        "scanned_at": exit_scanned_at,
                        "flag": exit_flag,
                        "linked_entry": entry_scanned_at,
                    })
                    stats["exits_created"] += 1
                    stats["outbox_events"] += 1
                    
                    # Duplicate exit
                    if random.random() < duplicate_rate:
                        dup_exit_at = exit_scanned_at + timedelta(seconds=45)
                        events.append({
                            "type": "EXIT",
                            "roll": roll,
                            "scanned_at": dup_exit_at,
                            "flag": "DUPLICATE_EXIT",
                            "linked_entry": entry_scanned_at,
                        })
                        stats["duplicate_exits"] += 1
                        stats["outbox_events"] += 1
            
            # Orphan exit
            if random.random() < orphan_rate:
                orphan_scanned_at = random_datetime_in_range(start_date, end_date, hour_start, hour_end, bias="exit")
                events.append({
                    "type": "EXIT",
                    "roll": roll,
                    "scanned_at": orphan_scanned_at,
                    "flag": "ORPHAN_EXIT",
                    "linked_entry": None,
                })
                stats["orphan_exits"] += 1
                stats["exits_created"] += 1
                stats["outbox_events"] += 1
        
        # Sort events by scanned_at
        events.sort(key=lambda e: e["scanned_at"])
        
        # Print timeline
        self.stdout.write("\n" + self.style.MIGRATE_HEADING("Timeline Preview:"))
        self.stdout.write("-" * 80)
        
        current_date = None
        for event in events:
            event_date = event["scanned_at"].date()
            if event_date != current_date:
                current_date = event_date
                self.stdout.write(f"\n{self.style.HTTP_INFO(str(event_date))}")
            
            ts = event["scanned_at"].strftime("%H:%M:%S")
            flag = event["flag"]
            roll = event["roll"]
            
            if event["type"] == "ENTRY":
                if flag == "DUPLICATE_ENTRY":
                    style = self.style.WARNING
                elif flag == "FORCED_ENTRY":
                    style = self.style.ERROR
                elif event.get("late"):
                    style = self.style.NOTICE
                else:
                    style = self.style.SUCCESS
                self.stdout.write(f"  {ts}  {style('ENTRY')}  {roll:15}  {flag}")
            else:
                if flag == "ORPHAN_EXIT":
                    style = self.style.ERROR
                elif flag == "DUPLICATE_EXIT":
                    style = self.style.WARNING
                elif flag == "EMERGENCY_EXIT":
                    style = self.style.NOTICE
                else:
                    style = self.style.HTTP_SUCCESS
                self.stdout.write(f"  {ts}  {style('EXIT')}   {roll:15}  {flag}")
        
        self.stdout.write("\n" + "-" * 80)

