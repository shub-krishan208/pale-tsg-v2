# Gate Web User Interface (Gate Monitor)

A modern, high-contrast, professional web interface for Central Library entry and exit gate monitors. It serves as a browser-native equivalent of `gate_tui` designed for high visibility on counters, tablets, and large kiosk displays.

---

## 📌 Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Running the Gate Web UI](#running-the-gate-web-ui)
- [User Interface States](#user-interface-states)
- [Scanner Input Methods](#scanner-input-methods)
- [API Route Reference](#api-route-reference)
- [Components & File Structure](#components--file-structure)

---

## Overview

The Gate Web UI replaces the need for a command-line terminal (`scripts/gate_tui.py`) when deploying gate monitoring stations. Guards and students can view entry/exit permissions, student roll numbers, and declared assets (laptops, books, electronic devices) instantly in real time.

The scanner operates in a **Common Scanning Mode**: it automatically verifies both **Entry** and **Exit** QR codes without requiring guards or operators to manually toggle between modes.

---

## Key Features

- 🖥️ **High-Contrast Monitor Design**: Large typography, clean dark theme, and high-visibility status indicators easily legible from across the gate counter.
- ⚡ **Zero-Click Hardware Scanner Support**: Automatic keyboard-wedge detection for handheld USB/Bluetooth barcode/QR scanners.
- 🌐 **Universal Common Scanning Mode**: Seamlessly handles both Entry passes and Exit passes automatically based on the token.
- 📝 **Collapsible Manual Input Bar**: Easily paste raw JWT tokens or JSON scan payloads for manual verification or troubleshooting.
- 🔄 **Auto-Reset Countdown**: Visual progress bar smoothly resetting the screen back to `GATE SCANNER READY` after 6 seconds.
- 🏷️ **Asset Declaration Inspection**: Dedicated visual cards for declared laptops (model/serial number), books, and gadgets.
- 🚩 **Flag Categorization**:
  - `NORMAL_ENTRY` & `NORMAL_EXIT` (Emerald Green)
  - `FORCED_ENTRY`, `DUPLICATE_EXIT`, `EMERGENCY_EXIT` (Amber/Yellow)
  - `ORPHAN_EXIT` & `DENIED` (Coral Red)
- 🔔 **Web Audio Feedback**: Distinct chime tones for `ALLOWED` and `DENIED` generated using the browser's Web Audio API (no external sound files required).
- 📜 **Session Scan History**: Slide-out drawer tracking the history of all scans during the current session.
- 🧪 **One-Click Simulator**: Built-in test buttons for quick demonstrations (`Normal Entry`, `Entry w/ Assets`, `Exit Scan`, `Denied Scan`).

---

## How It Works

```
                     +----------------------------------------+
                     |  Student Displays Pass (App / Web)     |
                     +----------------------------------------+
                                         |
                                         v
                     +----------------------------------------+
                     |  Handheld Barcode/QR Scanner Scans QR  |
                     +----------------------------------------+
                                         |
                                         v (Keystroke wedge or manual input)
+-------------------------------------------------------------------------------+
| Next.js Web Application (/frontend/gate/)                                     |
|                                                                               |
|  1. Captures scan payload globally via keyboard-wedge or manual input         |
|  2. Calls /frontend/api/gate/process/                                         |
|  3. Decodes JWT token, checks RSA signature & claims (Entry or Exit)          |
|  4. Determines permission status & entry/exit flag                            |
|  5. Renders large student roll number & declared items                        |
|  6. Plays audio confirmation chime                                            |
|  7. Starts 6-second countdown timer to return to IDLE state                   |
+-------------------------------------------------------------------------------+
```

---

## Running the Gate Web UI

### 1. Prerequisites
Ensure Node.js (v18+) is installed.

### 2. Start the Frontend Server
From the repository root:
```bash
cd frontend
npm install
npm run dev
```

### 3. Open the Gate Monitor
Navigate in your browser to:
- **Gate Monitor URL**: [http://localhost:3000/frontend/gate/](http://localhost:3000/frontend/gate/)
- **Student Pass Portal**: [http://localhost:3000/frontend/](http://localhost:3000/frontend/)

> [!TIP]
> Click the **Maximize / Fullscreen** icon in the top-right corner of the Gate Monitor header to enter dedicated kiosk mode for gate monitors.

---

## User Interface States

### 1. IDLE State (`GATE SCANNER READY`)
- Active pulsing radar icon indicating that the hardware scanner listener is operational.
- Live digital clock and calendar in the header.
- Status badges indicating active scanner listening and unified entry/exit verification.

### 2. ALLOWED State (`ENTRY / EXIT PERMITTED`)
- Prominent status banner with color-coded flag (`NORMAL_ENTRY`, `NORMAL_EXIT`, etc.).
- Extra-large student roll number (e.g. `21CS10042`).
- Three-column declared items grid:
  - 💻 **Laptop**: Device brand, model, and serial number (or `NONE`).
  - 📚 **Books**: Total count badge and list of declared titles (or `NONE`).
  - 🎧 **Gadgets**: Total count badge and list of declared electronic accessories (or `NONE`).
- 6-second auto-reset progress bar with a manual "Clear Now" button.

### 3. DENIED State (`ACCESS DENIED`)
- High-visibility red alert banner.
- Specific denial explanation (e.g., token expired, invalid signature, or access rejected).
- Audible warning buzzer.
- Auto-reset progress bar.

---

## Scanner Input Methods

The Gate Web UI supports three input modes:

1. **Hardware Handheld Barcode/QR Scanner (Primary)**:
   - Connect any standard USB or Bluetooth scanner in HID / keyboard-wedge mode.
   - Simply scan the QR code. The application automatically detects the rapid burst of keystrokes globally without needing to focus on an input box.
2. **Collapsible Manual Input Bar**:
   - Click **"Manual Input"** in the footer bar.
   - An input field slides up to allow pasting raw JWT tokens or JSON scan payloads (`{"token": "..."}`).
   - Press **Enter** or click **"Submit Scan"** to process. Click "✕ Close" or "Hide Manual Input" to dismiss.
3. **Built-in Simulation Bar**:
   - Click any of the simulation buttons in the footer for instant testing and demonstrations:
     - `Normal Entry`
     - `Entry w/ Assets`
     - `Exit Scan`
     - `Denied Scan`

---

## API Route Reference

### `POST /frontend/api/gate/process/`

Processes and verifies an incoming student pass token.

#### Request Body:
```json
{
  "token": "<JWT_TOKEN_STRING>"
}
```
*Note: Also accepts raw JSON scan strings such as `{"token": "...", "mode": "entry"}`.*

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "status": "ALLOWED",
  "flag": "NORMAL_ENTRY",
  "mode": "entry",
  "roll": "22EE30018",
  "laptop": "MacBook Pro M3 - SN: C02X892J",
  "extra": [
    { "type": "books", "name": "Introduction to Algorithms (CLRS)" },
    { "type": "gadgets", "name": "Sony WH-1000XM5 Headphones" }
  ],
  "message": "ENTRY verified successfully",
  "timestamp": "2026-09-14T17:45:00.000Z",
  "isVerified": true
}
```

#### Denied Response (`200 OK` or `400 Bad Request`):
```json
{
  "success": false,
  "status": "DENIED",
  "flag": "TOKEN_EXPIRED",
  "mode": "entry",
  "message": "Token has expired. Please regenerate your pass.",
  "timestamp": "2026-09-14T17:45:00.000Z"
}
```

---

## Components & File Structure

```
frontend/
├── app/
│   ├── api/
│   │   └── gate/
│   │       └── process/
│   │           └── route.ts         # Scan processing & JWT verification API (Common Mode)
│   ├── gate/
│   │   └── page.tsx                 # Gate Monitor page route (/gate)
│   └── page.tsx                     # Student pass generator with Gate Monitor link
├── components/
│   └── gate/
│       ├── gate-monitor.tsx         # Interactive gate monitor component with manual input bar
│       └── types.ts                 # TypeScript types & interfaces
└── GATE_UI_README.md                # This documentation
```
