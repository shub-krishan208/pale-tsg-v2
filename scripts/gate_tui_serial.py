#!/usr/bin/env python3
import sys
import json
import subprocess
import os
import time
import shutil
import termios
import tty
import argparse
import serial
import serial.tools.list_ports
from pathlib import Path
from dotenv import load_dotenv

# Find project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
MANAGE_PY = PROJECT_ROOT / "gate" / "manage.py"
PYTHON_BIN = PROJECT_ROOT / ".venv" / "bin" / "python"

# Load environment
load_dotenv(dotenv_path=ENV_PATH)

def get_width():
    return shutil.get_terminal_size((80, 24)).columns

def print_centered(text, color_prefix="", color_suffix=""):
    width = get_width()
    print(color_prefix + text.center(width) + color_suffix)

def show_idle():
    print("\n")
    print_centered("GATE SCANNER READY (SERIAL)", "\033[1;36m", "\033[0m")
    print_centered("Waiting for scan...")
    sys.stdout.flush()

def show_deny(message):
    width = get_width()
    print("\n")
    print_centered("          DENIED          ", "\033[1;41;37m", "\033[0m")
    print("\n")
    for line in message.splitlines():
        print_centered(line, "\033[1;31m", "\033[0m")
    print("\n")
    sys.stdout.flush()

def show_allow(data, flag, mode):
    width = get_width()
    
    # Reload env in case it changed
    load_dotenv(dotenv_path=ENV_PATH)
    all_green = os.getenv("ALL_GREEN", "false").lower() == "true"
    
    if all_green:
        color = "\033[1;32m" # Green
    else:
        if flag in ["NORMAL_ENTRY", "NORMAL_EXIT"]:
            color = "\033[1;32m" # Green
        elif flag in ["FORCED_ENTRY", "DUPLICATE_EXIT", "EMERGENCY_EXIT"]:
            color = "\033[1;33m" # Yellow
        else:
            color = "\033[1;31m" # Red (e.g., ORPHAN_EXIT)

    roll = data.get("roll", "N/A")
    laptop = data.get("laptop") or "NONE"
    
    extra = data.get("extra", [])
    books = [item.get("name") for item in extra if item.get("type") == "books"]
    gadgets = [item.get("name") for item in extra if item.get("type") == "gadgets"]
    
    books_str = ", ".join(books) if books else "NONE"
    gadgets_str = ", ".join(gadgets) if gadgets else "NONE"
    
    print("\n")
    print_centered("#" * 40, color, "\033[0m")
    print_centered(f" {flag} ", color, "\033[0m")
    print_centered("#" * 40, color, "\033[0m")
    print("\n")
    
    left_pad = max(0, (width - 30) // 2)
    fields = [
        ("ROLL:", roll),
        ("LAPTOP:", laptop),
        ("BOOKS:", books_str),
        ("GADGETS:", gadgets_str),
    ]
    for label, value in fields:
        print(" " * left_pad + f"\033[1;37m{label:<10}\033[0m \033[1;36m{value}\033[0m")
        
    print("\n")
    sys.stdout.flush()

def extract_json_from_output(output):
    try:
        lines = output.splitlines()
        for i, line in enumerate(lines):
            if line.strip() == "{":
                json_str = "\n".join(lines[i:])
                return json.loads(json_str)
    except json.JSONDecodeError:
        pass
    return None

def read_line_with_feedback(ser):
    chars = []
    first_char = True
    width = get_width()
    while True:
        try:
            # Read one byte (blocks until timeout or character received)
            c_bytes = ser.read(1)
            if not c_bytes:
                continue
                
            c = c_bytes.decode('utf-8', errors='ignore')
            
            if first_char:
                sys.stdout.write("\033[1;33m" + "Scanning...".center(width) + "\033[0m\r")
                sys.stdout.flush()
                first_char = False
                
            if c == '\n' or c == '\r':
                if chars:
                    sys.stdout.write("\033[1;32m" + "Scanned! Processing...".center(width) + "\033[0m\n")
                    sys.stdout.flush()
                    break
            else:
                chars.append(c)
        except serial.SerialException as e:
            print(f"\nSerial error: {e}")
            time.sleep(1)
            break
            
    return "".join(chars)

def start_watching(port, baudrate):
    if not PYTHON_BIN.exists():
        print(f"Error: Python binary not found at {PYTHON_BIN}")
        sys.exit(1)
        
    print_centered("Starting background sync...", "\033[1;36m", "\033[0m")
    sync_proc = subprocess.Popen(
        [str(PYTHON_BIN), str(MANAGE_PY), "sync_to_backend", "--loop", "--mute"],
        stdout=subprocess.DEVNULL, # Mute stdout since it has its own logging, but stderr will pass through if CommandError happens
    )
        
    try:
        print_centered(f"Opening serial port {port} at {baudrate} baud...", "\033[1;33m", "\033[0m")
        try:
            ser = serial.Serial(port, baudrate, timeout=0.1)
        except serial.SerialException as e:
            print(f"Failed to open port {port}: {e}")
            return
            
        show_idle()
        
        while True:
            line = read_line_with_feedback(ser)
            
            line = line.strip()
            if not line:
                continue
                
            if not line.startswith("{") or "token" not in line:
                # To prevent printing garbage on screen, only notify if it's substantial
                if len(line) > 5:
                    print(f"Ignored invalid scan data: {line}")
                show_idle()
                continue

            try:
                payload = json.loads(line)
                token = payload.get("token", "")
                mode = payload.get("mode", "entry")
                
                cmd = [str(PYTHON_BIN), str(MANAGE_PY), "process_token", "--mode", mode, "--json", "--token", token]
                
                result = subprocess.run(
                    cmd,
                    text=True,
                    capture_output=True
                )
                
                if result.returncode != 0:
                    show_deny(result.stderr or result.stdout or "Access Denied")
                else:
                    data = extract_json_from_output(result.stdout)
                    if data:
                        flag = data.get("exitFlag") or data.get("entryFlag") or data.get("entry_flag")
                        if not flag:
                            for out_line in result.stdout.splitlines():
                                if "scanned successfully:" in out_line and "ENTRY" in out_line:
                                    parts = out_line.split()
                                    for p in parts:
                                        if "ENTRY" in p or "EXIT" in p:
                                            flag = p
                                            break
                        if not flag:
                            flag = "NORMAL_ENTRY" if mode == "entry" else "NORMAL_EXIT"
                            
                        show_allow(data, flag, mode)
                    else:
                        show_deny("Failed to parse command output\n\n" + result.stdout)
                        
            except json.JSONDecodeError:
                pass
                
            show_idle()
            
    except KeyboardInterrupt:
        print("\n[*] Exiting TUI...")
    except Exception as e:
        print(f"\nError: {e}")
    finally:
        if sync_proc.poll() is None:
            sync_proc.terminate()
            sync_proc.wait()
        try:
            if 'ser' in locals() and ser.is_open:
                ser.close()
        except:
            pass

def find_usb_serial_port():
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        # Check for typical USB CDC device descriptors
        if "USB" in p.description or "usbmodem" in p.device or "usbserial" in p.device:
            return p.device
            
    # Fallback to the first available port if no explicit USB matches
    if ports:
        return ports[0].device
    return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gate Scanner TUI (Serial Mode)")
    parser.add_argument("--port", type=str, help="Serial port to read from (e.g. /dev/cu.usbmodem1101 or COM3)")
    parser.add_argument("--baudrate", type=int, default=115200, help="Baud rate (default: 115200)")
    args = parser.parse_args()
    
    port = args.port
    if not port:
        port = find_usb_serial_port()
        if not port:
            print("Error: Could not automatically detect a USB serial port.")
            print("Please specify one using --port. Available ports:")
            for p in serial.tools.list_ports.comports():
                print(f"  {p.device} - {p.description}")
            sys.exit(1)
        else:
            print(f"Auto-detected serial port: {port}")
            
    start_watching(port, args.baudrate)
