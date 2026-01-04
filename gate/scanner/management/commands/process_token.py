import json
import sys
import uuid
from pathlib import Path

import jwt
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from shared.apps.entries.models import EntryLog, ExitLog
from scanner.models import OutboxEvent


class Command(BaseCommand):
    help = "Simulate a gate scan by verifying a backend-issued JWT (offline). Supports entry and exit modes."

    def add_arguments(self, parser):
        parser.add_argument("--token", help="JWT token string. If omitted, reads from stdin.")
        parser.add_argument(
            "--key",
            default=None,
            help="Path to public key PEM. Default: gate/keys/public.pem",
        )
        parser.add_argument("--json", action="store_true", help="Print full decoded payload as JSON.")
        parser.add_argument(
            "--mode",
            choices=["entry", "exit"],
            default="entry",
            help="Scan mode: 'entry' (default) or 'exit'.",
        )

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
        mode = options.get("mode", "entry")

        # Decode JWT (with expired token handling)
        payload = None
        is_expired = False
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
            is_expired = True
            try:
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    audience="library-gate",
                    issuer="library-backend",
                    options={"verify_exp": False},
                )
            except Exception:
                raise CommandError("DENY: token expired and cannot be decoded")
        except jwt.InvalidAudienceError:
            raise CommandError("DENY: invalid audience (aud)")
        except jwt.InvalidIssuerError:
            raise CommandError("DENY: invalid issuer (iss)")
        except jwt.InvalidTokenError as e:
            raise CommandError(f"DENY: invalid token ({e})")

        if mode == "exit":
            self._handle_exit(payload, is_expired, options)
        else:
            self._handle_entry(payload, False, options)

    def _handle_entry(self, payload, is_expired, options):
        """Handle entry scan (original behavior)."""
        entry_log_id = payload.get("entryId")

        if is_expired:
            # For entry, expired tokens mark the entry as EXPIRED and deny
            if entry_log_id:
                ts = timezone.now()
                updated = EntryLog.objects.filter(id=entry_log_id).update(status="EXPIRED", scanned_at=ts)
                if updated:
                    OutboxEvent.objects.create(
                        event_type="ENTRY_EXPIRED_SEEN",
                        payload={
                            "eventId": None,
                            "type": "ENTRY_EXPIRED_SEEN",
                            "entryId": str(entry_log_id),
                            "roll": payload.get("roll"),
                            "scannedAt": ts.isoformat(),
                            "status": "EXPIRED",
                            "entryFlag": payload.get("entryFlag") or payload.get("entry_flag") or None,
                            "laptop": payload.get("laptop"),
                            "extra": payload.get("extra") or [],
                        },
                    )
                self.stdout.write(f"  scanned successfully: EXPIRED at {ts}")
            raise CommandError("DENY: token expired")

        # proceeding to update the local database
        entry_id = payload.get("entryId") or payload.get("exitId")
        roll = payload.get("roll")
        action = payload.get("action")
        laptop = payload.get("laptop")
        extra = payload.get("extra")
        exp = payload.get("exp")

        # Update local gate DB entry_logs status + entry_flag (only for entry tokens)
        if entry_log_id:
            # ## [FIX]: Renamed variable from 'entry' to 'existing_entry' to avoid shadowing later
            existing_entry = EntryLog.objects.filter(id=entry_log_id).only("id", "status", "entry_flag", "scanned_at").first()
            
            # If entry doesn't exist locally yet, create it on scan.
            if not existing_entry:
                ts = timezone.now()
                open_entries = EntryLog.objects.filter(roll_id=roll, status="ENTERED")
                
                if open_entries.exists():
                    # ## [FIX]: Evaluate QuerySet to a list BEFORE updating the DB.
                    # Previous code updated the DB first, which made the subsequent loop over 'open_entries' empty
                    # because the status had already changed to EXPIRED in the DB.
                    entries_to_close = list(open_entries)

                    # Auto-close any previous open entry locally.
                    open_entries.update(status="EXPIRED", scanned_at=ts)
                    entry_flag = "FORCED_ENTRY"
                    
                    # ## [FIX]: Iterate over the in-memory list 'entries_to_close', not the modified QuerySet
                    for open_entry in entries_to_close:
                        OutboxEvent.objects.create(
                            event_type="ENTRY", # set event type as entry becuse the status expiry is handled by command
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

                # ## [FIX]: Use a fresh variable name 'new_entry' to be clear and avoid shadowing
                new_entry = EntryLog.create_with_roll(
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
                        "entryId": str(new_entry.id),
                        "roll": roll,
                        "scannedAt": ts.isoformat(),
                        "status": new_entry.status,
                        "entryFlag": new_entry.entry_flag,
                        "laptop": new_entry.laptop,
                        "extra": new_entry.extra or [],
                    },
                )
                self.stdout.write(
                    f"  scanned successfully: {new_entry.status} {new_entry.entry_flag} at {new_entry.scanned_at}"
                )
            else:
                # DUPLICATE_SCAN: same token scanned multiple times at entry (only first scan processed)
                if existing_entry.status == "ENTERED":
                    self.stdout.write("  scanned successfully: DUPLICATE_SCAN")
                else:
                    self.stdout.write(f"  unexpected state for entryId={existing_entry.id}: {existing_entry.status}, ignoring")

        self.stdout.write("ALLOW:")
        self.stdout.write(f"  roll:   {roll}")
        self.stdout.write(f"  action: {action}")
        self.stdout.write(f"  laptop: {laptop}")
        self.stdout.write(f"  extra:  {extra}")
        self.stdout.write(f"  id:     {entry_id}")
        self.stdout.write(f"  exp:    {exp}")

        if options.get("json"):
            self.stdout.write(json.dumps(payload, indent=2, sort_keys=True))

    def _handle_exit(self, payload, is_expired, options):
        """
        Handle exit scan with 5-flag model:
        - NORMAL_EXIT: standard exit with matching entry
        - EMERGENCY_EXIT: exit via emergency token (type=emergency)
        - ORPHAN_EXIT: no matching entry found
        - DUPLICATE_EXIT: exit already recorded for this entry
        - AUTO_EXIT: (created by midnight job, not by scan)
        """
        ts = timezone.now()
        roll = payload.get("roll")
        entry_id_from_token = payload.get("entryId")
        token_type = payload.get("type")  # 'emergency' for emergency tokens, None/missing for entry tokens
        laptop = payload.get("laptop")
        extra = payload.get("extra") or []

        # Build device_meta
        device_meta = {}
        if is_expired:
            device_meta["expired"] = True
        if hasattr(settings, "GATE_DEVICE_ID"):
            device_meta["gateDeviceId"] = settings.GATE_DEVICE_ID

        # Determine entry reference
        entry_obj = None
        if entry_id_from_token:
            entry_obj = EntryLog.objects.filter(id=entry_id_from_token).first()
        
        # For emergency tokens without entryId, find the most recent open entry for this roll
        if not entry_obj and token_type == "emergency":
            entry_obj = EntryLog.objects.filter(
                roll_id=roll, status="ENTERED"
            ).order_by("-created_at").first()

        # Duplicate check: if entry exists and already has an exit log
        if entry_obj:
            existing_exit = ExitLog.objects.filter(entry_id=entry_obj).first()
            if existing_exit:
                # DUPLICATE_EXIT: still ALLOW but log as duplicate
                exit_log = ExitLog.create_with_roll(
                    roll=roll,
                    entry_id=entry_obj,
                    exit_flag="DUPLICATE_EXIT",
                    laptop=laptop,
                    extra=extra,
                    device_meta=device_meta,
                    scanned_at=ts,
                )
                self._emit_exit_event(exit_log, roll)
                self._print_allow(roll, "EXITING", laptop, extra, str(exit_log.id), payload.get("exp"), "DUPLICATE_EXIT", options)
                return

        # Determine exit flag
        if not entry_obj:
            # ORPHAN_EXIT: no matching entry found
            exit_flag = "ORPHAN_EXIT"
            if entry_id_from_token:
                device_meta["claimedEntryId"] = str(entry_id_from_token)
        elif token_type == "emergency":
            exit_flag = "EMERGENCY_EXIT"
        else:
            exit_flag = "NORMAL_EXIT"

        # Create ExitLog
        exit_log = ExitLog.create_with_roll(
            roll=roll,
            entry_id=entry_obj,
            exit_flag=exit_flag,
            laptop=laptop,
            extra=extra,
            device_meta=device_meta,
            scanned_at=ts,
        )

        # Update EntryLog status to EXITED (if we have a valid entry)
        if entry_obj:
            # ## [FIX]: Removed 'scanned_at=ts' from this update.
            # 'scanned_at' on EntryLog refers to entry time. Overwriting it with exit time destroys data.
            EntryLog.objects.filter(id=entry_obj.id).update(status="EXITED")

        # Emit EXIT outbox event
        self._emit_exit_event(exit_log, roll)

        self.stdout.write("  scanned successfully: EXITED")
        self._print_allow(roll, "EXITING", laptop, extra, str(exit_log.id), payload.get("exp"), exit_flag, options)

    def _emit_exit_event(self, exit_log, roll):
        """Emit an EXIT outbox event for syncing to backend."""
        OutboxEvent.objects.create(
            event_type="EXIT",
            payload={
                "eventId": None,  # filled at send-time from OutboxEvent.event_id
                "type": "EXIT",
                "exitId": str(exit_log.id),
                "entryId": str(exit_log.entry_id_id) if exit_log.entry_id_id else None,
                "roll": roll,
                "scannedAt": exit_log.scanned_at.isoformat() if exit_log.scanned_at else None,
                "exitFlag": exit_log.exit_flag,
                "laptop": exit_log.laptop,
                "extra": exit_log.extra or [],
                "deviceMeta": exit_log.device_meta or {},
            },
        )

    def _print_allow(self, roll, action, laptop, extra, exit_id, exp, exit_flag, options):
        """Print ALLOW output for exit mode."""
        self.stdout.write("ALLOW:")
        self.stdout.write(f"  roll:      {roll}")
        self.stdout.write(f"  action:    {action}")
        self.stdout.write(f"  laptop:    {laptop}")
        self.stdout.write(f"  extra:     {extra}")
        self.stdout.write(f"  exitId:    {exit_id}")
        self.stdout.write(f"  exitFlag:  {exit_flag}")
        self.stdout.write(f"  exp:       {exp}")

        if options.get("json"):
            self.stdout.write(json.dumps({
                "roll": roll,
                "action": action,
                "laptop": laptop,
                "extra": extra,
                "exitId": exit_id,
                "exitFlag": exit_flag,
            }, indent=2, sort_keys=True))