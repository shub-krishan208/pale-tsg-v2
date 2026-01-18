"""
Simulate a full day of library scanning activity.

This command generates batch tokens and processes them through process_token,
simulating realistic library entry/exit activity for a given date.

Usage:
    python manage.py simulate_day \
        --rolls "24MA10001-24MA10050" \
        --date "2026-01-15" \
        --entries-per-user 2 \
        --exit-ratio 0.85

    python manage.py simulate_day \
        --rolls "24MA10001,24MA10002" \
        --date "2026-01-15" \
        --hour-range "9,22" \
        --dry-run
"""

import io
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from scanner.test_fixtures import DEVICE_META_TEMPLATES, EXTRA_ITEMS, LAPTOP_OPTIONS, biased_hour


def parse_roll_range(rolls_str: str) -> list[str]:
    """Parse roll range string into list of roll numbers."""
    rolls = []
    parts = rolls_str.split(",")
    
    for part in parts:
        part = part.strip()
        if "-" in part and not part.startswith("-"):
            match = re.match(r"^(.+?)(\d+)-(.+?)(\d+)$", part)
            if match:
                prefix1, start_num, prefix2, end_num = match.groups()
                if prefix1 == prefix2:
                    num_width = len(start_num)
                    for i in range(int(start_num), int(end_num) + 1):
                        rolls.append(f"{prefix1}{str(i).zfill(num_width)}")
                else:
                    rolls.append(part)
            else:
                rolls.append(part)
        else:
            rolls.append(part)
    
    return rolls


def load_private_key(key_path: str = None) -> str:
    """Load RSA private key from PEM file."""
    if key_path:
        path = Path(key_path)
    else:
        candidates = [
            Path(settings.BASE_DIR) / "keys" / "private.pem",
            Path(settings.BASE_DIR).parent / "backend" / "keys" / "private.pem",
        ]
        path = None
        for candidate in candidates:
            if candidate.exists():
                path = candidate
                break
        
        if not path:
            raise FileNotFoundError(
                "Private key not found. Use --key to specify path, or copy "
                "backend/keys/private.pem to gate/keys/private.pem"
            )
    
    with open(path, "r") as f:
        return f.read()


def random_time_in_range(base_date: datetime, hour_start: int, hour_end: int, bias: str = "none") -> datetime:
    """Generate random datetime within hour range on given date."""
    if hour_end <= hour_start:
        hour_end = 24
    random_hour = biased_hour(hour_start, hour_end, bias)
    random_minute = random.randint(0, 59)
    random_second = random.randint(0, 59)
    
    return base_date.replace(
        hour=random_hour,
        minute=random_minute,
        second=random_second,
        microsecond=random.randint(0, 999999),
    )


class Command(BaseCommand):
    help = "Simulate a full day of library scanning activity"

    def add_arguments(self, parser):
        parser.add_argument(
            "--rolls",
            required=True,
            help='Roll range (e.g., "24MA10001-24MA10050") or comma-separated list',
        )
        parser.add_argument(
            "--date",
            default=None,
            help="Target date for simulated scans (YYYY-MM-DD). Default: today",
        )
        parser.add_argument(
            "--hour-range",
            default="8,24",
            help='Operating hours (start,end) for entry times. Default: 8,24',
        )
        parser.add_argument(
            "--entries-per-user",
            type=int,
            default=2,
            help="Base number of entries per user (randomized +/- 50%%). Default: 2",
        )
        parser.add_argument(
            "--exit-ratio",
            type=float,
            default=0.85,
            help="Fraction of entries that get exits. Default: 0.85",
        )
        parser.add_argument(
            "--late-scan-rate",
            type=float,
            default=0.10,
            help="Rate of scans beyond 24hr tolerance. Default: 0.10",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without processing tokens",
        )
        parser.add_argument(
            "--key",
            default=None,
            help="Path to private key PEM file for signing",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Print detailed output for each token processed",
        )

    def handle(self, *args, **options):
        # Parse rolls
        rolls = parse_roll_range(options["rolls"])
        if not rolls:
            raise CommandError("No valid roll numbers parsed from --rolls")
        
        # Parse date
        if options["date"]:
            try:
                target_date = datetime.strptime(options["date"], "%Y-%m-%d")
                target_date = target_date.replace(tzinfo=timezone.utc)
            except ValueError as e:
                raise CommandError(f"Invalid date format: {e}")
        else:
            target_date = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        
        # Parse hour range
        hour_parts = options["hour_range"].split(",")
        if len(hour_parts) != 2:
            raise CommandError("--hour-range must be in format 'start,end'")
        hour_start, hour_end = int(hour_parts[0]), int(hour_parts[1])
        
        # Get other options
        entries_per_user = options["entries_per_user"]
        exit_ratio = options["exit_ratio"]
        late_scan_rate = options["late_scan_rate"]
        dry_run = options["dry_run"]
        key_path = options.get("key")
        verbose = options.get("verbose", False)
        
        # Load private key
        try:
            private_key = load_private_key(key_path)
        except FileNotFoundError as e:
            raise CommandError(str(e))
        
        self.stdout.write(f"Simulating day: {target_date.date()}")
        self.stdout.write(f"  Users: {len(rolls)}")
        self.stdout.write(f"  Hour range: {hour_start}:00 - {hour_end}:00")
        self.stdout.write(f"  Entries per user: ~{entries_per_user}")
        self.stdout.write(f"  Exit ratio: {exit_ratio:.0%}")
        
        if dry_run:
            self.stdout.write(self.style.WARNING("\n  DRY RUN - No tokens will be processed\n"))
        
        stats = {
            "entries_processed": 0,
            "exits_processed": 0,
            "late_scans": 0,
            "errors": 0,
        }
        
        # Generate and process tokens
        for roll in rolls:
            variance = random.uniform(0.5, 1.5)
            num_entries = max(1, int(entries_per_user * variance))
            
            for _ in range(num_entries):
                # Generate entry
                entry_id, entry_created_at = self._process_entry(
                    roll=roll,
                    target_date=target_date,
                    hour_start=hour_start,
                    hour_end=hour_end,
                    late_scan_rate=late_scan_rate,
                    private_key=private_key,
                    dry_run=dry_run,
                    verbose=verbose,
                    stats=stats,
                )
                
                if entry_id and random.random() < exit_ratio:
                    # Generate exit 1-8 hours after entry
                    self._process_exit(
                        roll=roll,
                        entry_id=entry_id,
                        entry_time=entry_created_at,
                        private_key=private_key,
                        dry_run=dry_run,
                        verbose=verbose,
                        stats=stats,
                    )
        
        # Summary
        self.stdout.write("\n" + self.style.SUCCESS("Summary:"))
        self.stdout.write(f"  Entries processed: {stats['entries_processed']}")
        self.stdout.write(f"  Exits processed: {stats['exits_processed']}")
        self.stdout.write(f"  Late scans: {stats['late_scans']}")
        if stats["errors"] > 0:
            self.stdout.write(self.style.ERROR(f"  Errors: {stats['errors']}"))

    def _generate_token(
        self,
        payload: dict,
        created_at: datetime,
        private_key: str,
        expiry_hours: int = 24,
        backdate_hours: int = 0,
    ) -> str:
        """Generate a signed JWT token."""
        now = datetime.now(timezone.utc)
        iat = now - timedelta(hours=backdate_hours)
        exp = iat + timedelta(hours=expiry_hours)
        
        # Add createdAt for test mode
        payload["createdAt"] = created_at.isoformat()
        payload["source"] = "TEST"
        
        # Add device meta
        device_meta = random.choice(DEVICE_META_TEMPLATES)
        payload["deviceMeta"] = {
            **device_meta,
            "testGenerated": True,
            "simulatedDay": True,
        }
        
        # Add standard JWT claims
        payload.update({
            "iss": "library-backend",
            "aud": "library-gate",
            "iat": int(iat.timestamp()),
            "exp": int(exp.timestamp()),
        })
        
        return jwt.encode(payload, private_key, algorithm="RS256")

    def _process_entry(
        self,
        roll: str,
        target_date: datetime,
        hour_start: int,
        hour_end: int,
        late_scan_rate: float,
        private_key: str,
        dry_run: bool,
        verbose: bool,
        stats: dict,
    ) -> tuple[str | None, datetime | None]:
        """Generate and process an entry token."""
        # Random entry time (biased towards early hours)
        created_at = random_time_in_range(target_date, hour_start, hour_end, bias="entry")
        
        # Calculate scan time
        if random.random() < late_scan_rate:
            # Late scan
            scan_offset = timedelta(hours=random.randint(25, 48))
            stats["late_scans"] += 1
        else:
            # Normal scan
            scan_offset = timedelta(minutes=random.randint(0, 30))
        
        scanned_at = created_at + scan_offset
        
        # Random data
        laptop = random.choice(LAPTOP_OPTIONS) or None
        extra = random.choice(EXTRA_ITEMS)
        
        # Generate entry ID
        entry_id = str(uuid.uuid4())
        
        payload = {
            "entryId": entry_id,
            "roll": roll,
            "action": "ENTERING",
            "laptop": laptop,
            "extra": extra,
        }
        
        token = self._generate_token(payload, created_at, private_key)
        
        if dry_run:
            if verbose:
                self.stdout.write(self.style.SUCCESS(f"  [DRY] Entry: {roll} @ {created_at}"))
            stats["entries_processed"] += 1
            return entry_id, created_at
        
        # Process token
        try:
            out = io.StringIO()
            call_command(
                "process_token",
                token=token,
                mode="entry",
                test_mode=True,
                override_scanned_at=scanned_at.isoformat(),
                override_created_at=created_at.isoformat(),
                stdout=out,
            )
            if verbose:
                self.stdout.write(f"  Entry: {roll} @ {created_at}")
                self.stdout.write(f"    {out.getvalue().strip()}")
            stats["entries_processed"] += 1
            return entry_id, created_at
        except Exception as e:
            self.stderr.write(f"  Error processing entry for {roll}: {e}")
            stats["errors"] += 1
            return None, None

    def _process_exit(
        self,
        roll: str,
        entry_id: str,
        entry_time: datetime,
        private_key: str,
        dry_run: bool,
        verbose: bool,
        stats: dict,
    ):
        """Generate and process an exit token."""
        # Exit 1-8 hours after entry (biased towards longer stays → later exits)
        exit_offset = timedelta(hours=random.triangular(1, 8, 5))
        exit_time = entry_time + exit_offset
        scanned_at = exit_time + timedelta(minutes=random.randint(0, 5))
        
        # Random data (often same as entry)
        laptop = random.choice(LAPTOP_OPTIONS) or None
        extra = random.choice(EXTRA_ITEMS)
        
        payload = {
            "entryId": entry_id,
            "roll": roll,
            "action": "EXITING",
            "laptop": laptop,
            "extra": extra,
        }
        
        token = self._generate_token(payload, exit_time, private_key)
        
        if dry_run:
            if verbose:
                self.stdout.write(self.style.WARNING(f"  [DRY] Exit:  {roll} @ {exit_time}"))
            stats["exits_processed"] += 1
            return
        
        # Process token
        try:
            out = io.StringIO()
            call_command(
                "process_token",
                token=token,
                mode="exit",
                test_mode=True,
                override_scanned_at=scanned_at.isoformat(),
                override_created_at=exit_time.isoformat(),
                stdout=out,
            )
            if verbose:
                self.stdout.write(f"  Exit: {roll} @ {exit_time}")
                self.stdout.write(f"    {out.getvalue().strip()}")
            stats["exits_processed"] += 1
        except Exception as e:
            self.stderr.write(f"  Error processing exit for {roll}: {e}")
            stats["errors"] += 1

