import json
import sys
from datetime import datetime
from pathlib import Path

import jwt
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from shared.apps.entries.models import EntryLog, ExitLog
from scanner.models import OutboxEvent


def parse_iso_datetime(dt_str: str) -> datetime:
    """Parse ISO format datetime string to timezone-aware datetime."""
    if not dt_str:
        return None
    # Handle Z suffix
    dt_str = dt_str.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(dt_str)
        # Make timezone-aware if naive
        if dt.tzinfo is None:
            dt = timezone.make_aware(dt)
        return dt
    except ValueError as e:
        raise ValueError(f"Error: {e}\nInvalid datetime format: {dt_str}. Use ISO format (e.g., 2026-01-10T14:30:00Z)")


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
        # Test mode arguments
        parser.add_argument(
            "--test-mode",
            action="store_true",
            help="Enable test mode: skip expiry validation, allow timestamp overrides, mark source as TEST.",
        )
        parser.add_argument(
            "--override-scanned-at",
            default=None,
            help="Override scanned_at timestamp (ISO format). Requires --test-mode.",
        )
        parser.add_argument(
            "--override-created-at",
            default=None,
            help="Override created_at timestamp (ISO format). Can also be read from token's createdAt claim. Requires --test-mode.",
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
        test_mode = options.get("test_mode", False)

        # Parse timestamp overrides (require test mode)
        override_scanned_at = None
        override_created_at = None
        if options.get("override_scanned_at") or options.get("override_created_at"):
            if not test_mode:
                raise CommandError("--override-scanned-at and --override-created-at require --test-mode")
            try:
                if options.get("override_scanned_at"):
                    override_scanned_at = parse_iso_datetime(options["override_scanned_at"])
                if options.get("override_created_at"):
                    override_created_at = parse_iso_datetime(options["override_created_at"])
            except ValueError as e:
                raise CommandError(str(e))

        # Decode JWT (with expired token handling)
        payload = None
        is_expired = False
        
        if test_mode:
            # In test mode, skip expiry validation entirely
            try:
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    audience="library-gate",
                    issuer="library-backend",
                    options={"verify_exp": False},
                )
            except jwt.InvalidAudienceError:
                raise CommandError("DENY: invalid audience (aud)")
            except jwt.InvalidIssuerError:
                raise CommandError("DENY: invalid issuer (iss)")
            except jwt.InvalidTokenError as e:
                raise CommandError(f"DENY: invalid token ({e})")
            
            # Check for createdAt in token payload if not overridden via CLI
            if not override_created_at and payload.get("createdAt"):
                try:
                    override_created_at = parse_iso_datetime(payload["createdAt"])
                except ValueError:
                    pass  # Ignore invalid createdAt in token
        else:
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

        # Store test mode context in options for handlers
        options["_test_mode"] = test_mode
        options["_override_scanned_at"] = override_scanned_at
        options["_override_created_at"] = override_created_at

        if mode == "exit":
            self._handle_exit(payload, is_expired, options)
        else:
            self._handle_entry(payload, is_expired if not test_mode else False, options)

    def _extract_device_context(self, payload, is_expired=False):
        """
        Extract device context from the JWT payload.

        Supports both camelCase and snake_case keys and defensively copies the
        metadata dictionary so callers can safely mutate it.
        """
        raw_meta = (
            payload.get("deviceMetadata")
            or payload.get("deviceMeta")
            or payload.get("device_meta")
            or {}
        )
        if not isinstance(raw_meta, dict):
            raw_meta = {}
        device_meta = dict(raw_meta)

        source = payload.get("source") or device_meta.get("source")
        os_name = payload.get("os") or device_meta.get("os")
        device_id = (
            payload.get("deviceId")
            or device_meta.get("deviceId")
            or device_meta.get("id")
        )

        if is_expired:
            device_meta.setdefault("expired", True)

        gate_device_id = getattr(settings, "GATE_DEVICE_ID", None)
        if gate_device_id:
            device_meta.setdefault("gateDeviceId", gate_device_id)

        return {
            "source": source,
            "os": os_name,
            "device_id": device_id,
            "device_meta": device_meta,
        }

    def _handle_entry(self, payload, is_expired, options):
        """Handle entry scan (original behavior)."""
        entry_log_id = payload.get("entryId")
        device_ctx = self._extract_device_context(payload, is_expired=is_expired)
        source = device_ctx["source"]
        os_name = device_ctx["os"]
        device_id = device_ctx["device_id"]
        device_meta = device_ctx["device_meta"]
        
        # Test mode context
        test_mode = options.get("_test_mode", False)
        override_scanned_at = options.get("_override_scanned_at")
        override_created_at = options.get("_override_created_at")
        
        # In test mode, override source to TEST
        if test_mode:
            source = "TEST"
            device_meta["testMode"] = True

        if is_expired:
            # For entry, expired tokens mark the entry as EXPIRED and deny
            if entry_log_id:
                ts = override_scanned_at or timezone.now()
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
                            "deviceMeta": device_meta,
                            "deviceId": device_id,
                            "source": source,
                            "os": os_name,
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
                ts = override_scanned_at or timezone.now()
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
                                "scannedAt": ts.isoformat(),
                                "status": "EXPIRED",
                                "entryFlag": open_entry.entry_flag,
                                "laptop": open_entry.laptop,
                                "extra": open_entry.extra or [],
                                "deviceMeta": open_entry.device_meta or {},
                                "deviceId": open_entry.device_id,
                                "source": open_entry.source,
                                "os": open_entry.os,
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
                    source=source,
                    os=os_name,
                    device_id=device_id,
                    device_meta=device_meta,
                )
                
                # Override created_at if specified (bypass auto_now_add)
                if override_created_at:
                    EntryLog.objects.filter(id=new_entry.id).update(created_at=override_created_at)
                
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
                        "deviceMeta": device_meta,
                        "deviceId": device_id,
                        "source": source,
                        "os": os_name,
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
        self.stdout.write(f"  deviceMeta: {device_meta}")

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
        # Test mode context
        test_mode = options.get("_test_mode", False)
        override_scanned_at = options.get("_override_scanned_at")
        override_created_at = options.get("_override_created_at")
        
        ts = override_scanned_at or timezone.now()
        roll = payload.get("roll")
        entry_id_from_token = payload.get("entryId")
        token_type = payload.get("type")  # 'emergency' for emergency tokens, None/missing for entry tokens
        laptop = payload.get("laptop")
        extra = payload.get("extra") or []
        device_ctx = self._extract_device_context(payload, is_expired=is_expired)
        device_meta = dict(device_ctx["device_meta"] or {})
        source = device_ctx["source"]
        os_name = device_ctx["os"]
        device_id = device_ctx["device_id"]
        
        # In test mode, override source to TEST
        if test_mode:
            source = "TEST"
            device_meta["testMode"] = True

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
                    source=source,
                    os=os_name,
                    device_id=device_id,
                    scanned_at=ts,
                )
                
                # Override created_at if specified
                if override_created_at:
                    ExitLog.objects.filter(id=exit_log.id).update(created_at=override_created_at)
                
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
            source=source,
            os=os_name,
            device_id=device_id,
            scanned_at=ts,
        )
        
        # Override created_at if specified (bypass auto_now_add)
        if override_created_at:
            ExitLog.objects.filter(id=exit_log.id).update(created_at=override_created_at)

        # Update EntryLog status to EXITED (if we have a valid entry)
        if entry_obj:
            # ## [FIX]: Removed 'scanned_at=ts' from this update.
            # 'scanned_at' on EntryLog refers to entry time. Overwriting it with exit time destroys data.
            EntryLog.objects.filter(id=entry_obj.id).update(status="EXITED")
            
            # Emit ENTRY event to sync status change to backend
            OutboxEvent.objects.create(
                event_type="ENTRY",
                payload={
                    "eventId": None,
                    "type": "ENTRY",
                    "entryId": str(entry_obj.id),
                    "roll": roll,
                    "scannedAt": entry_obj.scanned_at.isoformat() if entry_obj.scanned_at else ts.isoformat(),
                    "status": "EXITED",
                    "entryFlag": entry_obj.entry_flag,
                    "laptop": entry_obj.laptop,
                    "extra": entry_obj.extra or [],
                    "deviceMeta": entry_obj.device_meta or {},
                    "deviceId": entry_obj.device_id,
                    "source": entry_obj.source,
                    "os": entry_obj.os,
                },
            )

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
                "deviceId": exit_log.device_id,
                "source": exit_log.source,
                "os": exit_log.os,
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