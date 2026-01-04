import json
import random
import time
import urllib.error
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import models, transaction
from django.utils import timezone

from scanner.models import OutboxEvent


def _compute_next_retry(attempt_count: int) -> int:
    """
    Exponential backoff with jitter.
    Returns seconds to wait until next retry.
    """
    base = 2 ** min(attempt_count, 10)  # caps at ~1024s
    jitter = random.random()  # 0..1
    return int(min(300, base + jitter * 2))  # cap at 5 minutes


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
    help = "Drain gate OutboxEvent rows to backend via POST /api/sync/gate/events"

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Run a single batch and exit.")
        parser.add_argument("--loop", action="store_true", help="Run forever (default).")
        parser.add_argument("--batch-size", type=int, default=None, help="Override SYNC_BATCH_SIZE.")
        parser.add_argument("--sleep", type=int, default=None, help="Override SYNC_INTERVAL_SECONDS.")

    def handle(self, *args, **options):
        url = getattr(settings, "BACKEND_SYNC_URL", "")
        api_key = getattr(settings, "GATE_API_KEY", "")
        if not url:
            raise CommandError("BACKEND_SYNC_URL is not set")
        if not api_key:
            raise CommandError("GATE_API_KEY is not set")

        batch_size = int(options.get("batch_size") or getattr(settings, "SYNC_BATCH_SIZE", 200))
        sleep_s = int(options.get("sleep") or getattr(settings, "SYNC_INTERVAL_SECONDS", 5))
        timeout_s = int(getattr(settings, "SYNC_TIMEOUT_SECONDS", 10))

        run_once = bool(options.get("once"))
        # run_loop = bool(options.get("loop")) or not run_once

        while True:
            now = timezone.now()
            with transaction.atomic():
                qs = (
                    OutboxEvent.objects.select_for_update(skip_locked=True)
                    .filter(sent_at__isnull=True)
                    .filter(models.Q(next_retry_at__isnull=True) | models.Q(next_retry_at__lte=now))
                    .order_by("created_at")[:batch_size]
                )
                batch = list(qs)

            if not batch:
                if run_once:
                    return
                time.sleep(sleep_s)
                continue

            events = []
            for row in batch:
                payload = dict(row.payload or {})
                payload["eventId"] = str(row.event_id)
                payload["type"] = row.event_type
                events.append(payload)

            try:
                resp = _post_events(url, api_key, events, timeout_s=timeout_s)
                acked_ids = set(resp.get("ackedEventIds") or [])
                rejected = resp.get("rejected") or []
                rejected_map = {str(r.get("eventId")): str(r.get("error")) for r in rejected if r.get("eventId")}

                sent_ts = timezone.now()
                with transaction.atomic():
                    if acked_ids:
                        OutboxEvent.objects.filter(event_id__in=acked_ids).update(
                            sent_at=sent_ts, last_error=""
                        )
                    if rejected_map:
                        # Treat rejects as permanently failed (mark sent) to avoid infinite retry loops.
                        for ev_id, err in rejected_map.items():
                            OutboxEvent.objects.filter(event_id=ev_id).update(
                                sent_at=sent_ts,
                                last_error=f"rejected: {err}",
                                last_attempt_at=sent_ts,
                            )

                self.stdout.write(
                    f"synced batch={len(batch)} acked={len(acked_ids)} rejected={len(rejected_map)}"
                )

            except urllib.error.HTTPError as e:
                # 4xx/5xx with body
                err_body = ""
                try:
                    err_body = e.read().decode("utf-8")
                except Exception:
                    pass
                msg = f"HTTPError {e.code}: {err_body or str(e)}"
                self._mark_batch_retry(batch, msg)
            except Exception as e:
                self._mark_batch_retry(batch, str(e))

            if run_once:
                return

            time.sleep(sleep_s)

    def _mark_batch_retry(self, batch: list[OutboxEvent], err: str) -> None:
        now = timezone.now()
    
        # Update objects in memory first
        for row in batch:
            row.attempt_count = (row.attempt_count or 0) + 1
            delay_s = _compute_next_retry(row.attempt_count)
            row.last_attempt_at = now
            row.next_retry_at = now + timedelta(seconds=delay_s)
            row.last_error = err[:2000]

        # Push all changes to DB in one go
        OutboxEvent.objects.bulk_update(
            batch, 
            fields=["attempt_count", "last_attempt_at", "next_retry_at", "last_error"]
        )
        self.stderr.write(f"sync failed; scheduled retry for {len(batch)} events: {err}")
    

