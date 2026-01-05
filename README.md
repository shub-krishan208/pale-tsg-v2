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

<details>
<summary>Project Structure</summary>


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
│   │   │   ├── models.py               # models for sync app (Processed Events Table), not on admin panel
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
│   ├── apps/
│   │   ├── __init__.py
│   │   ├── entries/              # entry_log/exit_log tables
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── migrations/
│   │   │   │   ├── 0001_initial.py
│   │   │   │   ├── 0002_remove_entrylog_entry_logs_roll_id_d07c5e_idx_and_more.py
│   │   │   │   ├── 0003_initial.py
│   │   │   │   ├── 0004_alter_entrylog_entry_flag.py
│   │   │   │   ├── 0005_exitlog_device_meta_entry_id_index.py
│   │   │   │   ├── 0006_alter_exitlog_exit_flag.py
│   │   │   │   ├── __init__.py
│   │   │   └── models.py
│   │   └── users/              # users table (related to logs, no direct input here)
│   │       ├── admin.py
│   │       ├── apps.py
│   │       ├── migrations/
│   │       │   ├── 0001_initial.py
│   │       │   ├── 0002_remove_user_users_roll_ba5404_idx_delete_user.py
│   │       │   ├── 0003_initial.py
│   │       │   ├── __init__.py
│   │       └── models.py
│   └── apps.py
│
└──  scripts/                      # Utility scripts


``` 

</details>

## Local Setup

Clone this repository then:

```bash
cd pale-tsg-v2

## Setup a pyenv
pyenv install 3.12.11 # if not already installed
pyenv local 3.12.11
```
From here, either use the [installation script](./scripts/install.sh) `chmod +x ./scripts/install.sh && ./scripts/install.sh` or follow the steps below:

<details>

<summary>Manual Setup</summary>

```bash
## Setup a venv
python -m venv .venv
source .venv/bin/activate

## Install dependencies
pip install -r requirements.txt

## Setup environment variables (manually change values if needed)
cp example.env .env 

## Get the docker containers running (use lazydocker for ease of use to manage these containers)
## Note: the containers run on :54322 and :54323 (and pg inside each container runs on port :5432)
docker compose up -d

## Initialize the database
python backend/manage.py migrate
python gate/manage.py migrate

# Generate rsa keys for jwt
ssh-keygen -t rsa -b 2048 -m PEM -f private.pem -N ""
openssl rsa -in private.pem -pubout -outform PEM -out public.pem

mv public.pem gate/keys/public.pem
mv private.pem backend/keys/private.pem
rm private.pem.pub


# create a superuser in backend for django admin panel
python backend/manage.py createsuperuser

# start the backend server
python backend/manage.py runserver


## Install frontend dependencies
cd frontend
npm install
# start the frontend server
npm run dev # --host for opening the app on local network for mobile testing
```

</details>

### Using the scanner commands

For dev environment, we can use the scanner script to scan qr codes and do sync with backend. 

> <i>For now, fetch token from Browser localstorage or scan the qr image.</i>

```bash
python gate/manage.py process_token --token <token> ## generates entry_log in local db and creates an Outbox event
python gate/manage.py process_token --token <token> --mode exit ## generates exit_log in local db and creates an Outbox event
python gate/manage.py sync_to_backend --once ## syncs all outbox event in queue with backend
python gate/manage.py sync_to_backend --loop ## runs the sync_to_backend command every 5 seconds

```
> We have one more scanner command, [repair_sync_full](./gate/scanner/management/commands/repair_sync_full.py), but haven't tested it for all cases yet.


## API Endpoints

The gate app will not accept requests, won't be opened for connection. We have the following endpoints in backend app:

|Endpoint|Description|
|---|---|
|'/api/admin/'|for django admin panel|
|'/api/entries/'|for entry logs|
|'/api/sync/gate/events/'|for sync events|
|'/api/entries/generate' | for generating entry token (normal) |
|'/api/entries/generate/exit' | for generating exit logs (emergency, flagged)|

## API Request Examples

### 1. Generate Entry Token
Creates an entry log and returns a JWT token for QR code generation.

**Endpoint:** `POST /api/entries/generate/`

<details>
<summary>Request Body</summary>

```json
{
  "roll": "24MA10063",
  "laptop": "HP Victus ix6900",
  "extra": [
    {"name": "Charger", "type": "gadgets"},
    {"name": "Atomic Habits", "type": "books"}
  ]
}
```
</details>

<details>
<summary>cURL</summary>

```bash
curl -X POST http://localhost:8000/api/entries/generate/ \
  -H "Content-Type: application/json" \
  -d '{"roll": "24MA10063", "laptop": "HP Victus", "extra": [{"name": "Charger", "type": "gadgets"}]}'
```
</details>

**Response (201):**
```json
{
  "entryId": "f07817cd-c2f2-4d6f-b009-7db22f5f0252",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Stored in db, token generated."
}
```

---

### 2. Generate Emergency Exit Token
Generates an exit token for users with an active (ENTERED) entry. Valid for 5 minutes.

**Endpoint:** `POST /api/entries/generate/exit/`

<details>
<summary>Request Body</summary>

```json
{
  "roll": "24MA10063",
  "laptop": "HP Victus ix6900",
  "extra": [
    {"name": "Charger", "type": "gadgets"}
  ]
}
```
</details>

<details>
<summary>cURL</summary>

```bash
curl -X POST http://localhost:8000/api/entries/generate/exit/ \
  -H "Content-Type: application/json" \
  -d '{"roll": "24MA10063", "laptop": "HP Victus", "extra": []}'
```
</details>

**Response (201):**
```json
{
  "entryId": "f07817cd-c2f2-4d6f-b009-7db22f5f0252",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresInSeconds": 300,
  "message": "Emergency exit token generated. Valid for 5 minutes."
}
```

**Error (404):** No active entry found
```json
{
  "error": "No active entry found for this roll number.",
  "roll": "24MA10063"
}
```

---

### 3. Sync Gate Events
Syncs events from gate to backend. Requires `X-GATE-API-KEY` header.

**Endpoint:** `POST /api/sync/gate/events`

<details>
<summary>Request Body (Entry Event)</summary>

```json
{
  "events": [
    {
      "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "ENTRY",
      "entryId": "f07817cd-c2f2-4d6f-b009-7db22f5f0252",
      "roll": "24MA10063",
      "scannedAt": "2026-01-06T10:30:00Z",
      "status": "ENTERED",
      "entryFlag": "NORMAL_ENTRY",
      "laptop": "HP Victus",
      "extra": [{"name": "Charger", "type": "gadgets"}]
    }
  ]
}
```
</details>

<details>
<summary>Request Body (Exit Event)</summary>

```json
{
  "events": [
    {
      "eventId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "type": "EXIT",
      "exitId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "entryId": "f07817cd-c2f2-4d6f-b009-7db22f5f0252",
      "roll": "24MA10063",
      "scannedAt": "2026-01-06T12:45:00Z",
      "exitFlag": "NORMAL_EXIT",
      "laptop": "HP Victus",
      "extra": [],
      "deviceMeta": {"gateId": "GATE_A", "scannerId": "scanner-001"}
    }
  ]
}
```
</details>

<details>
<summary>cURL</summary>

```bash
curl -X POST http://localhost:8000/api/sync/gate/events \
  -H "Content-Type: application/json" \
  -H "X-GATE-API-KEY: your-gate-api-key" \
  -d '{"events": [{"eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "type": "ENTRY", "entryId": "f07817cd-c2f2-4d6f-b009-7db22f5f0252", "roll": "24MA10063", "status": "ENTERED", "entryFlag": "NORMAL_ENTRY"}]}'
```
</details>

**Response (200):**
```json
{
  "ackedEventIds": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
  "rejected": [],
  "serverTime": "2026-01-06T10:30:05.123456Z"
}
```

> **Note:** Event types: `ENTRY`, `ENTRY_EXPIRED_SEEN`, `EXIT`  
> **Entry flags:** `NORMAL_ENTRY`, `FORCED_ENTRY`, `DUPLICATE_ENTRY`  
> **Exit flags:** `NORMAL_EXIT`, `EMERGENCY_EXIT`, `ORPHAN_EXIT`, `AUTO_EXIT`, `DUPLICATE_EXIT`

---
