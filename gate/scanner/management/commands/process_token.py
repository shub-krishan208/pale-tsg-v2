import json
import sys
from pathlib import Path

import jwt
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from shared.apps.entries.models import EntryLog
from scanner.models import OutboxEvent


class Command(BaseCommand):
    help = "Simulate a gate scan by verifying a backend-issued JWT (offline)."

    def add_arguments(self, parser):
        parser.add_argument("--token", help="JWT token string. If omitted, reads from stdin.")
        parser.add_argument(
            "--key",
            default=None,
            help="Path to public key PEM. Default: gate/keys/public.pem",
        )
        parser.add_argument("--json", action="store_true", help="Print full decoded payload as JSON.")

    def handle(self, *args, **options):
        token = (options.get("token") or "").strip()
        if not token:
            token = sys.stdin.read().strip()
        if not token:
            raise CommandError("DENY: no token provided (use --token or pipe token via stdin)")

        key_path = options.get("key")
        if key_path:
            pub_path = Path(key_path)
        else:
            pub_path = Path(settings.BASE_DIR) / "keys" / "public.pem"

        if not pub_path.exists():
            raise CommandError(
                "DENY: missing gate public key at gate/keys/public.pem\n"
                "Dev setup:\n"
                "  cp backend/keys/public.pem gate/keys/public.pem\n"
                "Prod setup:\n"
                "  mount gate/keys/public.pem into the container/host"
            )

        public_key = pub_path.read_text()

        try:
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience="library-gate",
                issuer="library-backend",
            )
        except jwt.ExpiredSignatureError:
            # Token is cryptographically valid but expired; best-effort update of local gate DB.
            try:
                expired_payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    audience="library-gate",
                    issuer="library-backend",
                    options={"verify_exp": False},
                )
                entry_log_id = expired_payload.get("entryId")
                if entry_log_id:
                    ts = timezone.now()
                    updated = EntryLog.objects.filter(id=entry_log_id).update(status="EXPIRED", scanned_at=ts)
                    if updated:
                        OutboxEvent.objects.create(
                            event_type="ENTRY_EXPIRED_SEEN",
                            payload={
                                "eventId": None,  # filled at send-time from OutboxEvent.event_id
                                "type": "ENTRY_EXPIRED_SEEN",
                                "entryId": str(entry_log_id),
                                "roll": expired_payload.get("roll"),
                                "scannedAt": ts.isoformat(),
                                "status": "EXPIRED",
                                "entryFlag": expired_payload.get("entryFlag") or expired_payload.get("entry_flag") or None,
                                "laptop": expired_payload.get("laptop"),
                                "extra": expired_payload.get("extra") or [],
                            },
                        )
                    self.stdout.write(f"  scanned successfully: EXPIRED at {ts}")
                else:
                    self.stdout.write(f"  entry not found: {entry_log_id}")
            except Exception:
                # If we can't decode/update, still deny as expired.
                pass
            raise CommandError("DENY: token expired")
        except jwt.InvalidAudienceError:
            raise CommandError("DENY: invalid audience (aud)")
        except jwt.InvalidIssuerError:
            raise CommandError("DENY: invalid issuer (iss)")
        except jwt.InvalidTokenError as e:
            raise CommandError(f"DENY: invalid token ({e})")

        # proceeding to update the local database
        entry_id = payload.get("entryId") or payload.get("exitId")
        entry_log_id = payload.get("entryId")
        roll = payload.get("roll")
        action = payload.get("action")
        laptop = payload.get("laptop")
        extra = payload.get("extra")
        exp = payload.get("exp")

        # Update local gate DB entry_logs status + entry_flag (only for entry tokens)
        if entry_log_id:
            entry = EntryLog.objects.filter(id=entry_log_id).only("id", "status", "entry_flag", "scanned_at").first()
            # If entry doesn't exist locally yet, create it on scan.
            if not entry:
                ts = timezone.now()
                open_entries = EntryLog.objects.filter(roll_id=roll, status="ENTERED")
                if open_entries.exists():
                    # Auto-close any previous open entry locally.
                    open_entries.update(status="EXPIRED", scanned_at=ts)
                    entry_flag = "FORCED_ENTRY"
                    for open_entry in open_entries:
                        OutboxEvent.objects.create(
                            event_type="ENTRY", # set event type as entry becuse the status expiry is handled by command, the token is never scanned for these
                            payload={
                                "eventId": None,
                                "type": "ENTRY",
                                "entryId": str(open_entry.id),
                                "roll": roll,
                                "scannedAt": None,
                                "status": "EXPIRED",
                                "entryFlag": open_entry.entry_flag,
                                "laptop": open_entry.laptop,
                                "extra": open_entry.extra or [],
                            },
                        )
                else:
                    entry_flag = "NORMAL_ENTRY"

                entry = EntryLog.create_with_roll(
                    roll=roll,
                    id=entry_log_id,
                    status="ENTERED",
                    entry_flag=entry_flag,
                    laptop=laptop,
                    extra=extra or [],
                    scanned_at=ts,
                )
                OutboxEvent.objects.create(
                    event_type="ENTRY",
                    payload={
                        "eventId": None,
                        "type": "ENTRY",
                        "entryId": str(entry.id),
                        "roll": roll,
                        "scannedAt": ts.isoformat(),
                        "status": entry.status,
                        "entryFlag": entry.entry_flag,
                        "laptop": entry.laptop,
                        "extra": entry.extra or [],
                    },
                )
                self.stdout.write(
                    f"  scanned successfully: {entry.status} {entry.entry_flag} at {entry.scanned_at}"
                )
            else:
                # DUPLICATE_SCAN: same token scanned multiple times at entry (only first scan processed)
                if entry.status == "ENTERED":
                    self.stdout.write("  scanned successfully: DUPLICATE_SCAN")
                else:
                    self.stdout.write(f"  unexpected state for entryId={entry.id}: {entry.status}, ignoring")

        self.stdout.write("ALLOW:")
        self.stdout.write(f"  roll:   {roll}")
        self.stdout.write(f"  action: {action}")
        self.stdout.write(f"  laptop: {laptop}")
        self.stdout.write(f"  extra:  {extra}")
        self.stdout.write(f"  id:     {entry_id}")
        self.stdout.write(f"  exp:    {exp}")

        if options.get("json"):
            self.stdout.write(json.dumps(payload, indent=2, sort_keys=True))