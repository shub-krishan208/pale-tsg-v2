# PALE | TSG

Entry/Exit system for Central Library. (Logging and Analysis)

## Table of Contents

- [PALE | TSG](#pale--tsg)
  - [Table of Contents](#table-of-contents)
  - [Tech Stack](#tech-stack)
  - [Local Setup](#local-setup)
    - [Using the qr\_scanner script](#using-the-qr_scanner-script)
    - [Testing commands in gate scanner (Simulating/testing the commands)](#testing-commands-in-gate-scanner-simulatingtesting-the-commands)
      - [1. `process_token`](#1-process_token)
      - [2. `generate_test_token`](#2-generate_test_token)
      - [3. `simulate_day`](#3-simulate_day)
      - [4. `generate_test_data`](#4-generate_test_data)
      - [5. `auto_exit_midnight`](#5-auto_exit_midnight)
      - [6. `sync_to_backend`](#6-sync_to_backend)
      - [7. `repair_sync_full`](#7-repair_sync_full)
  - [API Endpoints](#api-endpoints)
  - [API Request Examples](#api-request-examples)
    - [1. Generate Entry Token](#1-generate-entry-token)
    - [2. Generate Emergency Exit Token](#2-generate-emergency-exit-token)
    - [3. Sync Gate Events](#3-sync-gate-events)
  - [Dashboard](#dashboard)
    - [Access URLs](#access-urls)
    - [Configuration](#configuration)
    - [Features](#features)
    - [API Endpoint](#api-endpoint)

## Tech Stack

| Component      | Tech                         |
| -------------- | ---------------------------- |
| Frontend       | Next.js                      |
| UI             | Radix UI and Tailwind CSS v4 |
| Backend        | Django (DRF)                 |
| Database       | PostgreSQL                   |
| Authentication | JWT                          |
| QR Generation  | React qrcode                 |
| QR Scanning    | qrcode-reader                |

Some notes:

- For most stable experience use APP frontend from ApnaInsti instead of web ui.
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

**IMPORTANT:** Make sure you have added pyenv to your `$PATH` in order: `$PYENV_ROOT:$PATH`. Otherwise the pyenv shims won't be used!
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

### Using the qr_scanner script

**WARNING:** this depends on `zbar`.

The commands to be run are in the script [qr_commands.sh](./scripts/qr_commands.sh)

To use the scanner:

> Make sure the backend and gate conatiners are up and running first.

```bash
# from the project root
./.venv/bin/python ./scripts/watch_qr.py

```

### Testing commands in gate scanner (Simulating/testing the commands)

Run all commands from the **gate** app directory (`gate/` -> `gate/manage.py`).

---

#### 1. `process_token`

Simulates a gate scan: verifies a backend-issued JWT (offline), updates local `EntryLog` / `ExitLog`, and creates `OutboxEvent` rows for sync. Supports entry and exit modes. Token can be passed via `--token` or stdin.

<details>
<summary>More Details</summary>

| Option                  | Description                                                                              | Default                |
| ----------------------- | ---------------------------------------------------------------------------------------- | ---------------------- |
| `--token`               | JWT string. If omitted, token is read from stdin.                                        | (stdin)                |
| `--key`                 | Path to public key PEM for verification.                                                 | `gate/keys/public.pem` |
| `--json`                | Print full decoded payload as JSON.                                                      | off                    |
| `--mode`                | Scan mode: `entry` or `exit`.                                                            | `entry`                |
| `--test-mode`           | Skip expiry validation; allow timestamp overrides; mark source as TEST.                  | off                    |
| `--override-scanned-at` | Override scanned_at (ISO). Requires `--test-mode`.                                       | —                      |
| `--override-created-at` | Override created_at (ISO). Can also come from token `createdAt`. Requires `--test-mode`. | —                      |

**Examples:**

```bash
# Entry scan (token from stdin)
echo "$TOKEN" | python manage.py process_token --mode entry

# Exit scan with custom key
python manage.py process_token --token "$TOKEN" --mode exit --key /path/to/public.pem

# Test mode: backdated scan, print payload
python manage.py process_token --mode entry --test-mode \
  --override-scanned-at "2026-01-10T14:30:00Z" --override-created-at "2026-01-10T09:00:00Z" --json
```

---

</details>

#### 2. `generate_test_token`

Generates valid JWT tokens for entry or exit that can be piped to `process_token` for realistic scan simulation. Supports backdating and custom timestamps. Requires a private key (e.g. `gate/keys/private.pem` or `backend/keys/private.pem`).

<details>
<summary>More Details</summary>

| Option             | Description                                                                              | Default     |
| ------------------ | ---------------------------------------------------------------------------------------- | ----------- |
| `--roll`           | Target roll number.                                                                      | (required)  |
| `--mode`           | Token type: `entry` or `exit`.                                                           | `entry`     |
| `--laptop`         | Laptop description string.                                                               | —           |
| `--extra`          | Comma-separated extra items (e.g. `"Bag,Charger"`).                                      | —           |
| `--backdate-hours` | Hours to backdate `iat` (issued-at).                                                     | `0`         |
| `--expiry-hours`   | Token expiry from `iat` in hours.                                                        | `24`        |
| `--created-at`     | Custom created_at (ISO); embedded in token for `process_token --test-mode`.              | —           |
| `--entry-id`       | Existing entry UUID for exit tokens (links exit to that entry). Omit for emergency exit. | —           |
| `--output`         | Output format: `token`, `json`, or `both`.                                               | `token`     |
| `--key`            | Path to private key PEM for signing.                                                     | auto-detect |

**Examples:**

```bash
# Entry token (raw JWT to stdout)
python manage.py generate_test_token --roll 24MA10001 --mode entry

# Entry with laptop, extra, and custom created_at
python manage.py generate_test_token --roll 24MA10001 --mode entry \
  --laptop "Dell XPS 15" --extra "Bag,Charger" --created-at "2026-01-10T09:30:00Z"

# Exit token for a specific entry
python manage.py generate_test_token --roll 24MA10001 --mode exit --entry-id "abc-123-uuid"

# Pipe to process_token (full scan simulation)
python manage.py generate_test_token --roll 24MA10001 | python manage.py process_token --mode entry --test-mode

# Inspect payload only
python manage.py generate_test_token --roll 24MA10001 --output json
```

---

</details>

#### 3. `simulate_day`

Simulates a full day of library activity: generates batch entry/exit tokens and processes them through `process_token` with realistic timestamps for a given date and roll range.

<details>
<summary>More Details</summary>

| Option               | Description                                                      | Default     |
| -------------------- | ---------------------------------------------------------------- | ----------- |
| `--rolls`            | Roll range (e.g. `24MA10001-24MA10050`) or comma-separated list. | (required)  |
| `--date`             | Target date for simulated scans (YYYY-MM-DD).                    | today       |
| `--hour-range`       | Operating hours as `start,end` (e.g. `8,24` = 8am–midnight).     | `8,24`      |
| `--entries-per-user` | Base number of entries per user (randomized ±50%).               | `2`         |
| `--exit-ratio`       | Fraction of entries that get an exit.                            | `0.85`      |
| `--late-scan-rate`   | Fraction of scans beyond 24h tolerance.                          | `0.10`      |
| `--dry-run`          | Print what would happen without processing tokens.               | off         |
| `--key`              | Path to private key PEM for signing.                             | auto-detect |
| `--verbose`          | Print detailed output for each token processed.                  | off         |

**Examples:**

```bash
# One day for a roll range, default options
python manage.py simulate_day --rolls "24MA10001-24MA10050" --date 2026-01-15

# Fewer users, custom entries and hours
python manage.py simulate_day --rolls "24MA10001,24MA10002" --date 2026-01-15 \
  --entries-per-user 3 --hour-range "9,22"

# Preview only (no DB changes)
python manage.py simulate_day --rolls "24MA10001-24MA10010" --date 2026-01-15 --dry-run --verbose
```

---

</details>

#### 4. `generate_test_data`

Bulk-generates test data by **directly inserting** `EntryLog` and `ExitLog` rows into the gate DB with full timestamp control and matching `OutboxEvent` rows. Use for dashboard and sync testing without going through tokens.

<details>
<summary>More Details</summary>

| Option               | Description                                                          | Default    |
| -------------------- | -------------------------------------------------------------------- | ---------- |
| `--rolls`            | Roll range (e.g. `24MA10001-24MA10050`) or comma-separated list.     | (required) |
| `--date-range`       | Start and end dates for `created_at` (e.g. `2026-01-01,2026-01-15`). | (required) |
| `--entries-per-user` | Base entries per user (randomized ±50%).                             | `3`        |
| `--exit-ratio`       | Fraction of entries that get a normal exit.                          | `0.85`     |
| `--orphan-rate`      | Fraction of exits with no matching entry.                            | `0.05`     |
| `--duplicate-rate`   | Rate of duplicate entry/exit scans.                                  | `0.02`     |
| `--late-scan-rate`   | Rate of scans beyond 24h window.                                     | `0.10`     |
| `--hour-range`       | Operating hours as `start,end` (e.g. `8,24`).                        | `8,24`     |
| `--dry-run`          | Preview timeline and counts without inserting data.                  | off        |

**Examples:**

```bash
# Two weeks of data for 50 users
python manage.py generate_test_data \
  --rolls "24MA10001-24MA10050" \
  --date-range "2026-01-01,2026-01-15" \
  --entries-per-user 3 \
  --exit-ratio 0.85

# Single day, specific rolls, with orphans and duplicates
python manage.py generate_test_data \
  --rolls "24MA10001,24MA10002,24MA10003" \
  --date-range "2026-01-10,2026-01-10" \
  --orphan-rate 0.1 --duplicate-rate 0.05

# Preview only (timeline and stats, no inserts)
python manage.py generate_test_data \
  --rolls "24MA10001-24MA10010" \
  --date-range "2026-01-01,2026-01-07" \
  --dry-run
```

---

</details>

#### 5. `auto_exit_midnight`

Closes stale `ENTERED` entries by creating `AUTO_EXIT` logs and emitting sync events. Intended to be run daily (e.g. cron at 00:05). Entries older than the threshold are marked EXPIRED and get an AUTO_EXIT exit log.

<details>
<summary>More Details</summary>

| Option      | Description                                                   | Default |
| ----------- | ------------------------------------------------------------- | ------- |
| `--hours`   | Close entries older than this many hours.                     | `20`    |
| `--dry-run` | Preview which entries would be closed without making changes. | off     |

**Examples:**

```bash
# Default: close entries older than 20 hours
python manage.py auto_exit_midnight

# Custom threshold: 24 hours
python manage.py auto_exit_midnight --hours 24

# Preview only
python manage.py auto_exit_midnight --dry-run
python manage.py auto_exit_midnight --hours 20 --dry-run
```

---

</details>

#### 6. `sync_to_backend`

Drains gate `OutboxEvent` rows to the backend via `POST /api/sync/gate/events`. Uses `BACKEND_SYNC_URL` and `GATE_API_KEY` from settings. Supports one-shot or continuous loop with configurable batch size and sleep.

<details>
<summary>More Details</summary>

| Option         | Description                                       | Default                   |
| -------------- | ------------------------------------------------- | ------------------------- |
| `--once`       | Run a single batch and exit.                      | off (loop)                |
| `--loop`       | Run forever, polling for new events.              | default when not `--once` |
| `--batch-size` | Override `SYNC_BATCH_SIZE` (events per request).  | from settings (e.g. 200)  |
| `--sleep`      | Override `SYNC_INTERVAL_SECONDS` between batches. | from settings (e.g. 5)    |

**Examples:**

```bash
# Single batch then exit
python manage.py sync_to_backend --once

# Run continuously (default)
python manage.py sync_to_backend
python manage.py sync_to_backend --loop

# Custom batch size and interval
python manage.py sync_to_backend --once --batch-size 50 --sleep 10
```

---

</details>

#### 7. `repair_sync_full`

Manual repair: replays **all** local `EntryLog` and `ExitLog` rows (within optional filters) to the backend as sync events. Idempotent; useful when the outbox was lost or backend state needs to be rebuilt from gate DB.

<details>
<summary>More Details</summary>

| Option         | Description                                                  | Default       |
| -------------- | ------------------------------------------------------------ | ------------- |
| `--since`      | ISO datetime lower bound (applied to created_at/scanned_at). | none          |
| `--until`      | ISO datetime upper bound (applied to created_at/scanned_at). | none          |
| `--roll`       | Limit to a single roll number.                               | all rolls     |
| `--batch-size` | Override `SYNC_BATCH_SIZE` for replay requests.              | from settings |

**Examples:**

```bash
# Replay everything
python manage.py repair_sync_full

# Replay only after a given time
python manage.py repair_sync_full --since 2026-01-01T00:00:00Z

# Replay for one roll in a time window
python manage.py repair_sync_full --since 2026-01-01T00:00:00Z --until 2026-01-15T23:59:59Z --roll 24MA10001

# Smaller batches
python manage.py repair_sync_full --batch-size 100
```

</details>

---

## API Endpoints

The gate app will not accept requests, won't be opened for connection. We have the following endpoints in backend app:

| Endpoint                     | Description                                   |
| ---------------------------- | --------------------------------------------- |
| '/api/admin/'                | for django admin panel                        |
| '/api/entries/'              | for entry logs                                |
| '/api/sync/gate/events/'     | for sync events                               |
| '/api/entries/generate'      | for generating entry token (normal)           |
| '/api/entries/generate/exit' | for generating exit logs (emergency, flagged) |

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
    { "name": "Charger", "type": "gadgets" },
    { "name": "Atomic Habits", "type": "books" }
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
  "extra": [{ "name": "Charger", "type": "gadgets" }]
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
      "extra": [{ "name": "Charger", "type": "gadgets" }]
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
      "deviceMeta": { "gateId": "GATE_A", "scannerId": "scanner-001" }
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

## Dashboard

A real-time summary dashboard to monitor occupancy and trends.

### Access URLs

| URL                                       | Description                                            |
| ----------------------------------------- | ------------------------------------------------------ |
| `/dashboard/`                             | Staff dashboard (requires admin login)                 |
| `/dashboard/?kiosk=1&token=<KIOSK_TOKEN>` | Kiosk mode (public display, large fonts, auto-refresh) |
| `/admin/`                                 | Django admin panel (has link to dashboard)             |

### Configuration

Set the kiosk token in your environment:

```bash
# Generate a secure token
python -c "import secrets; print(secrets.token_hex(32))"

# Add to .env
DASHBOARD_KIOSK_TOKEN=your-generated-token-here
```

### Features

- **Today's Stats**: Current people inside, total entries, total exits
- **Hourly Chart**: Bar chart showing entries/exits per hour today
- **7-Day Trend**: Line chart showing daily patterns over the past week
- **Kiosk Mode**: Large fonts, high contrast, auto-refresh every 30 seconds
- **Admin Mode**: Full charts, 60-second refresh, link to admin panel

### API Endpoint

The dashboard fetches data from `/api/entries/summary/` which returns:

```json
{
  "timestamp": "2026-01-18T10:30:00+05:30",
  "today": {
    "entries": 150,
    "exits": 120,
    "current_inside": 30
  },
  "hourly": [
    { "hour": "2026-01-18T09:00:00+05:30", "entries": 45, "exits": 10 }
  ],
  "daily_7d": [{ "date": "2026-01-12", "entries": 200, "exits": 195 }]
}
```

Authentication: Admin session (admin login) OR kiosk token via `?token=` query param or `X-Kiosk-Token` header.

---
