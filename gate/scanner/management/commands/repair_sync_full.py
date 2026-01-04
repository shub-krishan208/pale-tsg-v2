import json
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from shared.apps.entries.models import EntryLog, ExitLog


def _parse_dt(val: str | None):
    if not val:
        return None
    dt = parse_datetime(val)
    if not dt:
        raise CommandError(f"Invalid datetime: {val} (expected ISO-8601)")
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone=timezone.utc)
    return dt


def _post_events(url: str, api_key: str, events: list[dict], timeout_s: int) -> dict:
    body = json.dumps({"events": events}).encode("utf-8")
    req = urllib.request.Request(
        url=url,
        method="POST",
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-GATE-API-KEY": api_key,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw or "{}")


class Command(BaseCommand):
    help = "Manual repair: replay full local EntryLog/ExitLog to backend (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--since", default=None, help="ISO datetime lower bound (scanned_at/created_at).")
        parser.add_argument("--until", default=None, help="ISO datetime upper bound (scanned_at/created_at).")
        parser.add_argument("--roll", default=None, help="Limit to a single roll number.")
        parser.add_argument("--batch-size", type=int, default=None, help="Override SYNC_BATCH_SIZE.")

    def handle(self, *args, **options):
        url = getattr(settings, "BACKEND_SYNC_URL", "")
        api_key = getattr(settings, "GATE_API_KEY", "")
        if not url:
            raise CommandError("BACKEND_SYNC_URL is not set")
        if not api_key:
            raise CommandError("GATE_API_KEY is not set")

        since = _parse_dt(options.get("since"))
        until = _parse_dt(options.get("until"))
        roll = options.get("roll")
        batch_size = int(options.get("batch_size") or getattr(settings, "SYNC_BATCH_SIZE", 200))
        timeout_s = int(getattr(settings, "SYNC_TIMEOUT_SECONDS", 10))

        # Entry logs
        entry_qs = EntryLog.objects.all().order_by("created_at")
        if roll:
            entry_qs = entry_qs.filter(roll_id=roll)
        if since:
            entry_qs = entry_qs.filter(created_at__gte=since)
        if until:
            entry_qs = entry_qs.filter(created_at__lte=until)

        total_entries = entry_qs.count()
        self.stdout.write(f"repair: replaying EntryLog rows={total_entries}")
        self._replay_entries(url, api_key, entry_qs, batch_size, timeout_s)

        # Exit logs
        exit_qs = ExitLog.objects.all().order_by("created_at")
        if roll:
            exit_qs = exit_qs.filter(roll_id=roll)
        if since:
            exit_qs = exit_qs.filter(created_at__gte=since)
        if until:
            exit_qs = exit_qs.filter(created_at__lte=until)

        total_exits = exit_qs.count()
        self.stdout.write(f"repair: replaying ExitLog rows={total_exits}")
        self._replay_exits(url, api_key, exit_qs, batch_size, timeout_s)

        self.stdout.write("repair: done")

    def _replay_entries(self, url: str, api_key: str, qs, batch_size: int, timeout_s: int) -> None:
        offset = 0
        while True:
            batch = list(qs[offset : offset + batch_size])
            if not batch:
                return
            events = []
            for e in batch:
                ts = e.scanned_at or e.created_at or timezone.now()
                events.append(
                    {
                        "eventId": str(e.id),  # deterministic per-entry
                        "type": "ENTRY",
                        "entryId": str(e.id),
                        "roll": e.roll_id,
                        "scannedAt": ts.isoformat(),
                        "status": e.status,
                        "entryFlag": e.entry_flag,
                        "laptop": e.laptop,
                        "extra": e.extra or [],
                    }
                )
            resp = _post_events(url, api_key, events, timeout_s=timeout_s)
            acked = len(resp.get("ackedEventIds") or [])
            rejected = resp.get("rejected") or []
            if rejected:
                self.stderr.write(f"repair entries: rejected {len(rejected)} (showing first): {rejected[:1]}")
            self.stdout.write(f"repair entries: sent={len(batch)} acked={acked}")
            offset += len(batch)

    def _replay_exits(self, url: str, api_key: str, qs, batch_size: int, timeout_s: int) -> None:
        offset = 0
        while True:
            batch = list(qs[offset : offset + batch_size])
            if not batch:
                return
            events = []
            for x in batch:
                ts = x.scanned_at or x.created_at or timezone.now()
                events.append(
                    {
                        "eventId": str(x.id),  # deterministic per-exit
                        "type": "EXIT",
                        "exitId": str(x.id),
                        "entryId": str(x.entry_id_id) if x.entry_id_id else None,
                        "roll": x.roll_id,
                        "scannedAt": ts.isoformat(),
                        "exitFlag": x.exit_flag,
                        "laptop": x.laptop,
                        "extra": x.extra or [],
                    }
                )
            resp = _post_events(url, api_key, events, timeout_s=timeout_s)
            acked = len(resp.get("ackedEventIds") or [])
            rejected = resp.get("rejected") or []
            if rejected:
                self.stderr.write(f"repair exits: rejected {len(rejected)} (showing first): {rejected[:1]}")
            self.stdout.write(f"repair exits: sent={len(batch)} acked={acked}")
            offset += len(batch)


