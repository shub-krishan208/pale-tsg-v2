import subprocess
import time
import sys
import json

# --- CONFIGURATION ---
# The command or script to run when a QR is found
COMMAND = ["/Users/shub/rack/code-rack/tsg/pale-tsg-v2/scripts/qr_commands_mac.sh"]
# How many seconds to wait before processing another scan
COOLDOWN_SECONDS = 2
# ---------------------

def start_watching():
    print("[*] Watching for QR codes via keyboard input... (Press Ctrl+C to quit)")
    print("[*] Note: Make sure this terminal is in focus when scanning!")
    
    last_scan_time = 0
    
    try:
        while True:
            # Read a line from standard input
            # This will block until the user (or the scanner) presses Enter
            qr_data = sys.stdin.readline().strip()
            
            # If EOF is reached, exit
            if not qr_data:
                continue

            # Only process if we are outside the cooldown period
            current_time = time.time()
            if current_time - last_scan_time > COOLDOWN_SECONDS:
                
                # Check if it looks like our JSON payload
                if qr_data.startswith("{") and "token" in qr_data:
                    # print(f"[!] QR Detected: {qr_data}")

                    # --- EXECUTE THE COMMAND ---
                    try:
                        subprocess.Popen(COMMAND + [qr_data])
                        print(f"    -> Command executed.")
                    except Exception as e:
                        print(f"    -> Error executing command: {e}")

                    # Reset cooldown
                    last_scan_time = time.time()
                else:
                    print(f"    -> Ignored invalid input: {qr_data}")
                    
    except KeyboardInterrupt:
        print("\n[*] Exiting...")
        sys.exit(0)

if __name__ == "__main__":
    start_watching()
