# PALE | TSG

Entry/Exit system for Central Library. (Logging and Analysis)

## Tech Stack

| Component | Tech |
|  --- | --- |
| Frontend | Next.js |
| UI | Radix UI and Tailwind CSS v4 |
| Backend | Django (DRF) |
| Database | PostgreSQL |
| Authentication | JWT |
| QR Generation | React qrcode |
| QR Scanning | qrcode-reader |

Some notes:
- QR scanning is not implemented yet
- python scripts for scanning related commands are in `gate/scanner/management/commands/`

### Project Structure

```bash
/
├── docker-compose.yml            # docker containers for db
├── example.env                   # Environment template
├── .gitignore
├── README.md
├── .python-version               # Python version (pyenv)
├── requirements.txt              # Python dependencies (for venv)
│
├── backend/                      # For cloud hosted system: Django + DRF API
│   ├── Dockerfile
│   ├── manage.py
│   ├── apps/                     # main dir for all the subapps
│   │   ├── __init__.py
│   │   ├── entries/              # entry app
│   │   │   ├── __init__.py
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── serializers.py
│   │   │   ├── services/               # services for entry app
│   │   │   │   ├── __init__.py
│   │   │   │   ├── sync_service.py     # sync db from gate
│   │   │   │   └── token_service.py    # token generation
│   │   │   ├── urls.py
│   │   │   └── views.py
│   │   ├── sync/                       # sync app
│   │   │   ├── __init__.py
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── migrations/             # migrations for sync app (Processed Events Table)
│   │   │   │   ├── 0001_initial.py
│   │   │   │   └── __init__.py
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── urls.py
│   │   │   └── views.py
│   │   └── users/                  # users app
│   │       ├── __init__.py
│   │       ├── admin.py
│   │       ├── apps.py
│   │       ├── serializers.py
│   │       ├── tests.py
│   │       ├── urls.py
│   │       └── views.py
│   ├── config/                     # setup settings for dev and prod modes
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── settings/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # base settings for all modes
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── core/                     # core utilities
│   │   ├── __init__.py
│   │   ├── exceptions.py         # custom exceptions
│   │   ├── jwt_utils.py          # jwt utils
│   │   └── middleware.py         # basic middleware for processing sync requests
│   └── keys/                     # keys for jwt
│       └── README.md             # instructions for jwt keys generation
│
├── frontend/                     # Next.js React app (SPA, easily extendable)
│   ├── app/
│   │   ├── api.ts                # API routes
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx            # default wrapper, meta data
│   │   └── page.tsx              # landing page
│   ├── components/               # reusable components
│   │   ├── entry-pass            # entry pass related components
│   │   │   ├── asset-declaration-form.tsx
│   │   │   ├── confirmation-modal.tsx
│   │   │   ├── entry-pass-client.tsx
│   │   │   ├── index.ts                    # index file for all the components
│   │   │   ├── item-list.tsx
│   │   │   ├── qr-display.tsx
│   │   │   ├── toast-provider.tsx          # toast provider for notifications
│   │   │   ├── types.ts                    # types for the components
│   │   │   ├── user-profile.tsx            
│   │   │   ├── utils.ts                    # utils for the components
│   │   │   └── view-details-modal.tsx
│   │   └── ui                              # Radix UI components
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── switch.tsx
│   ├── components.json
│   ├── eslint.config.mjs
│   ├── lib
│   │   └── utils.ts
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── public
│   │   ├── file.svg
│   │   ├── globe.svg
│   │   ├── next.svg
│   │   ├── qr-demo.svg
│   │   ├── vercel.svg
│   │   └── window.svg
│   ├── tsconfig.json
│   └── tsconfig.tsbuildinfo
│
├── gate/                         # Gate verification system
│   ├── config/                   # Minimal Django settings for ORM
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── keys
│   │   └── public.pem            # backend's public key for JWT verification
│   ├── manage.py
│   └── scanner/                  # scanner app (main stuff for gate)
│       ├── __init__.py
│       ├── apps.py
│       ├── management/           # management commands
│       │   ├── __init__.py
│       │   └── commands
│       │       ├── __init__.py
│       │       ├── auto_exit_midnight.py    # auto-close ENTERED at midnight
│       │       ├── process_token.py         # process token
│       │       ├── repair_sync_full.py      # full manual sync command for repairs
│       │       └── sync_to_backend.py       # sync to backend on loop or once manually 
│       ├── migrations/                 # migrations for scanner app (Outbox Events Table)
│       │   ├── 0001_initial.py
│       │   └── __init__.py
│       └── models.py                   # models for scanner app (Outbox Events Table)
│
├── shared/                       # Shared code between backend & gate
│   ├── __init__.py
│   ├── models/                   # Django models (source of truth)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── entry_log.py
│   │   └── exit_log.py
│   │
│   ├── constants.py              # Entry/Exit flags, status enums
│   └── jwt_claims.py             # JWT payload structure
│
└──  scripts/                      # Utility scripts
    ├── generate_keys.sh          # RSA key-pair generation
    ├── init_db.sh                # Database initialization
    └── cron/
        ├── midnight_checkout.py  # Auto-close ENTERED at midnight
        └── cleanup_expired.py    # Mark old PENDING as EXPIRED


```