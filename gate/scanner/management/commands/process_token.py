import json
import sys
from pathlib import Path

import jwt
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


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
            raise CommandError("DENY: token expired")
        except jwt.InvalidAudienceError:
            raise CommandError("DENY: invalid audience (aud)")
        except jwt.InvalidIssuerError:
            raise CommandError("DENY: invalid issuer (iss)")
        except jwt.InvalidTokenError as e:
            raise CommandError(f"DENY: invalid token ({e})")

        entry_id = payload.get("entryId") or payload.get("exitId")
        roll = payload.get("roll")
        action = payload.get("action")
        laptop = payload.get("laptop")
        extra = payload.get("extra")
        exp = payload.get("exp")

        self.stdout.write("ALLOW:")
        self.stdout.write(f"  roll:   {roll}")
        self.stdout.write(f"  action: {action}")
        self.stdout.write(f"  laptop: {laptop}")
        self.stdout.write(f"  extra:  {extra}")
        self.stdout.write(f"  id:     {entry_id}")
        self.stdout.write(f"  exp:    {exp}")

        if options.get("json"):
            self.stdout.write(json.dumps(payload, indent=2, sort_keys=True))