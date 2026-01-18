"""
Generate test JWT tokens for entry/exit simulation.

This command generates valid JWT tokens that can be piped to process_token
for realistic scan simulation. Supports backdating and custom timestamps.

Usage:
    # Generate entry token
    python manage.py generate_test_token --roll "24MA10001" --mode entry

    # Generate with custom timestamps
    python manage.py generate_test_token \
        --roll "24MA10001" \
        --mode entry \
        --laptop "Dell XPS 15" \
        --backdate-hours 12 \
        --created-at "2026-01-10T09:30:00Z"

    # Pipe to process_token
    python manage.py generate_test_token --roll 24MA10001 | \
        python manage.py process_token --mode entry --test-mode

    # Generate exit token for specific entry
    python manage.py generate_test_token \
        --roll "24MA10001" \
        --mode exit \
        --entry-id "abc-123-uuid"
"""

import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


def load_private_key(key_path: str = None) -> str:
    """Load RSA private key from PEM file."""
    if key_path:
        path = Path(key_path)
    else:
        # Try common locations
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


class Command(BaseCommand):
    help = "Generate test JWT tokens for entry/exit simulation"

    def add_arguments(self, parser):
        parser.add_argument(
            "--roll",
            required=True,
            help="Target roll number",
        )
        parser.add_argument(
            "--mode",
            choices=["entry", "exit"],
            default="entry",
            help="Token type: entry or exit. Default: entry",
        )
        parser.add_argument(
            "--laptop",
            default=None,
            help="Laptop description",
        )
        parser.add_argument(
            "--extra",
            default=None,
            help='Comma-separated extra items (e.g., "Bag,Charger")',
        )
        parser.add_argument(
            "--backdate-hours",
            type=int,
            default=0,
            help="How many hours to backdate iat (issued-at). Default: 0",
        )
        parser.add_argument(
            "--expiry-hours",
            type=int,
            default=24,
            help="Token expiry from iat in hours. Default: 24",
        )
        parser.add_argument(
            "--created-at",
            default=None,
            help="Custom created_at timestamp (ISO format), embedded in token for process_token --test-mode",
        )
        parser.add_argument(
            "--entry-id",
            default=None,
            help="Existing entry ID for exit tokens (UUID)",
        )
        parser.add_argument(
            "--output",
            choices=["token", "json", "both"],
            default="token",
            help="Output format: token (raw JWT), json (full payload), or both. Default: token",
        )
        parser.add_argument(
            "--key",
            default=None,
            help="Path to private key PEM file for signing",
        )

    def handle(self, *args, **options):
        roll = options["roll"]
        mode = options["mode"]
        laptop = options.get("laptop")
        extra_str = options.get("extra")
        backdate_hours = options["backdate_hours"]
        expiry_hours = options["expiry_hours"]
        created_at_str = options.get("created_at")
        entry_id = options.get("entry_id")
        output_format = options["output"]
        key_path = options.get("key")

        # Parse extra items
        extra = []
        if extra_str:
            items = [item.strip() for item in extra_str.split(",") if item.strip()]
            # Convert to object format expected by the system
            extra = [{"name": item, "type": "misc"} for item in items]

        # Parse created_at
        created_at = None
        if created_at_str:
            try:
                created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            except ValueError as e:
                raise CommandError(f"Invalid --created-at format: {e}")

        # Load private key
        try:
            private_key = load_private_key(key_path)
        except FileNotFoundError as e:
            raise CommandError(str(e))

        # Calculate timestamps
        now = datetime.now(timezone.utc)
        iat = now - timedelta(hours=backdate_hours)
        exp = iat + timedelta(hours=expiry_hours)

        # Build payload
        if mode == "entry":
            entry_log_id = str(uuid.uuid4())
            payload = {
                "entryId": entry_log_id,
                "roll": roll,
                "action": "ENTERING",
                "laptop": laptop,
                "extra": extra,
                "source": "TEST",
            }
        else:  # exit
            if entry_id:
                payload = {
                    "entryId": entry_id,
                    "roll": roll,
                    "action": "EXITING",
                    "laptop": laptop,
                    "extra": extra,
                    "source": "TEST",
                }
            else:
                # Emergency exit token (no entry reference)
                payload = {
                    "exitId": str(uuid.uuid4()),
                    "roll": roll,
                    "action": "EXITING",
                    "type": "emergency",
                    "laptop": laptop,
                    "extra": extra,
                    "source": "TEST",
                }

        # Add created_at for test mode processing
        if created_at:
            payload["createdAt"] = created_at.isoformat()

        # Add device metadata
        payload["deviceMeta"] = {
            "testGenerated": True,
            "generatedAt": now.isoformat(),
        }

        # Add standard JWT claims
        payload.update({
            "iss": "library-backend",
            "aud": "library-gate",
            "iat": int(iat.timestamp()),
            "exp": int(exp.timestamp()),
        })

        # Sign token
        token = jwt.encode(payload, private_key, algorithm="RS256")

        # Output
        if output_format == "token":
            self.stdout.write(token)
        elif output_format == "json":
            self.stdout.write(json.dumps(payload, indent=2, default=str))
        else:  # both
            self.stdout.write("--- TOKEN ---")
            self.stdout.write(token)
            self.stdout.write("\n--- PAYLOAD ---")
            self.stdout.write(json.dumps(payload, indent=2, default=str))

