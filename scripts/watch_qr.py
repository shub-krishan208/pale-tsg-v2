import cv2
import subprocess
import time
from pyzbar.pyzbar import decode

# --- CONFIGURATION ---
# The command or script to run when a QR is found
COMMAND = ["/home/freak/rack/code_rack/tsg/pale-tsg-v2/scripts/qr_commands.sh"] 
# How many seconds to wait before scanning again
COOLDOWN_SECONDS = 2
# ---------------------

def start_watching():
    # 0 usually refers to the default webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    last_scan_time = 0
    print(f"[*] Watching for QR codes... (Press 'q' to quit)")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame")
            break

        # Only process if we are outside the cooldown period
        current_time = time.time()
        if current_time - last_scan_time > COOLDOWN_SECONDS:
            
            # Decode QR codes in the frame
            decoded_objects = decode(frame)
            
            for obj in decoded_objects:
                qr_data = obj.data.decode("utf-8")
                # print(f"[!] QR Detected: {qr_data}")
                
                # --- EXECUTE THE COMMAND ---
                # We pass the QR data as an argument to your script just in case you need it
                try:
                    subprocess.Popen(COMMAND + [qr_data])
                    print(f"    -> Command executed.")
                except Exception as e:
                    print(f"    -> Error executing command: {e}")
                
                # Reset cooldown
                last_scan_time = time.time()
                # Break loop to avoid detecting the same code multiple times in one frame
                break

        # Display the camera feed (Optional - helpful for aiming)
        cv2.imshow("QR Watcher (Press q to quit)", frame)

        # Press 'q' to exit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    start_watching()
