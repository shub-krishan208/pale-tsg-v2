import uuid

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.utils import OperationalError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from shared.models.entry_log import EntryLog
from shared.models.exit_log import ExitLog
from shared.models.user import User

from .models import ProcessedGateEvent


def _require_gate_api_key(request):
    expected = getattr(settings, "GATE_API_KEY", None)
    provided = request.headers.get("X-GATE-API-KEY")

    if not expected:
        return Response(
            {"detail": "Server misconfigured: GATE_API_KEY is not set"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if not provided:
        return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    if provided != expected:
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    return None


def _parse_dt(val):
    if not val:
        return None
    if hasattr(val, "tzinfo"):
        # Already a datetime
        dt = val
    else:
        dt = parse_datetime(str(val))
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone=timezone.utc)
    return dt


def _parse_uuid(val):
    if not val:
        return None
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


def _should_apply_ts(existing_ts, incoming_ts):
    """
    Returns True if we should apply incoming data to the record.
    Latest scanned_at wins; if incoming is missing, we don't overwrite.
    """
    if incoming_ts is None:
        return False
    if existing_ts is None:
        return True
    return incoming_ts >= existing_ts


@api_view(["POST"])
def gate_events(request):
    """
    Gate -> Backend sync endpoint (API-key protected).

    Body:
      { "events": [ {eventId, type, ...}, ... ] }

    Response:
      { "ackedEventIds": [...], "rejected": [{eventId, error}], "serverTime": "..." }
    """

    auth_resp = _require_gate_api_key(request)
    if auth_resp is not None:
        return auth_resp

    data = request.data or {}
    events = data.get("events")
    if not isinstance(events, list):
        return Response(
            {"detail": "Invalid payload: 'events' must be a list"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    max_events = getattr(settings, "SYNC_MAX_EVENTS", 500)
    if len(events) > max_events:
        return Response(
            {"detail": f"Too many events in one request (max {max_events})"},
            status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        )

    acked = []
    rejected = []

    for ev in events:
        if not isinstance(ev, dict):
            rejected.append({"eventId": None, "error": "Event must be an object"})
            continue

        raw_event_id = ev.get("eventId")
        event_type = ev.get("type")

        if not raw_event_id:
            rejected.append({"eventId": None, "error": "Missing eventId"})
            continue

        try:
            event_id = _parse_uuid(raw_event_id)
        except Exception:
            rejected.append({"eventId": str(raw_event_id), "error": "Invalid eventId (must be UUID)"})
            continue

        try:
            # Transaction boundary per-event:
            # - inserting ProcessedGateEvent acts as our idempotency "lock"
            # - if processing fails, we rollback the insert so a retry can succeed later
            with transaction.atomic():
                try:
                    ProcessedGateEvent(event_id=event_id, event_type=event_type or "").save(force_insert=True)
                except IntegrityError:
                    acked.append(str(event_id))
                    continue

                if event_type in ("ENTRY", "ENTRY_EXPIRED_SEEN"):
                    entry_id = _parse_uuid(ev.get("entryId"))
                    roll = ev.get("roll")
                    scanned_at = _parse_dt(ev.get("scannedAt")) or timezone.now()
                    status_val = ev.get("status") or ("EXPIRED" if event_type == "ENTRY_EXPIRED_SEEN" else "ENTERED")
                    entry_flag = ev.get("entryFlag") or "NORMAL_ENTRY"
                    laptop = ev.get("laptop")
                    extra = ev.get("extra") or []

                    if not entry_id or not roll:
                        raise ValueError("ENTRY requires entryId and roll")

                    if not isinstance(extra, list):
                        raise ValueError("ENTRY extra must be a list")

                    user, _ = User.objects.get_or_create(roll=roll)

                    existing = EntryLog.objects.filter(id=entry_id).only("id", "scanned_at").first()
                    if existing and not _should_apply_ts(existing.scanned_at, scanned_at):
                        # Older replay; don't overwrite newer data.
                        pass
                    else:
                        EntryLog.objects.update_or_create(
                            id=entry_id,
                            defaults={
                                "roll": user,
                                "scanned_at": scanned_at,
                                "status": status_val,
                                "entry_flag": entry_flag,
                                "laptop": laptop,
                                "extra": extra,
                            },
                        )

                elif event_type == "EXIT":
                    exit_id = _parse_uuid(ev.get("exitId"))
                    entry_id = ev.get("entryId")
                    roll = ev.get("roll")
                    scanned_at = _parse_dt(ev.get("scannedAt")) or timezone.now()
                    exit_flag = ev.get("exitFlag") or "NORMAL_EXIT"
                    laptop = ev.get("laptop")
                    extra = ev.get("extra") or []
                    device_meta = ev.get("deviceMeta") or {}

                    if not exit_id or not roll:
                        raise ValueError("EXIT requires exitId and roll")

                    if not isinstance(extra, list):
                        raise ValueError("EXIT extra must be a list")
                    if not isinstance(device_meta, dict):
                        raise ValueError("EXIT deviceMeta must be an object")

                    user, _ = User.objects.get_or_create(roll=roll)
                    entry_obj = None
                    if entry_id:
                        entry_uuid = _parse_uuid(entry_id)
                        if entry_uuid:
                            entry_obj, _ = EntryLog.objects.get_or_create(
                                id=entry_uuid,
                                defaults={"roll": user, "status": "PENDING"},
                            )

                    existing = ExitLog.objects.filter(id=exit_id).only("id", "scanned_at").first()
                    if existing and not _should_apply_ts(existing.scanned_at, scanned_at):
                        pass
                    else:
                        ExitLog.objects.update_or_create(
                            id=exit_id,
                            defaults={
                                "roll": user,
                                "entry_id": entry_obj,
                                "scanned_at": scanned_at,
                                "exit_flag": exit_flag,
                                "laptop": laptop,
                                "extra": extra,
                                "device_meta": device_meta,
                            },
                        )

                else:
                    raise ValueError(f"Unknown event type: {event_type}")

            acked.append(str(event_id))
        except (ValueError, TypeError, IntegrityError) as e:
            # 1) LOGIC ERRORS (Client fault):
            # The data is invalid or duplicate. Reject it safely.
            rejected.append({"eventId": str(raw_event_id), "error": str(e)})
        except OperationalError:
            # 2) SYSTEM ERRORS (Server fault):
            # DB is down or locked. Do NOT catch this.
            # Let it raise 500 so the client retries later.
            raise
        except Exception as e:
            # 3) UNEXPECTED ERRORS:
            # Safer to crash and retry than to silently lose data.
            print(f"Critical sync error on event {raw_event_id}: {e}")
            raise

    return Response(
        {
            "ackedEventIds": acked,
            "rejected": rejected,
            "serverTime": timezone.now().isoformat(),
        },
        status=status.HTTP_200_OK,
    )

