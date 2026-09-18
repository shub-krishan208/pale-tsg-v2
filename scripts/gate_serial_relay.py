#!/usr/bin/env python3
import sys
import time
import json
import urllib.request
import serial
import serial.tools.list_ports

def find_usb_serial_port():
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        if "USB" in p.description or "usbmodem" in p.device or "usbserial" in p.device:
            return p.device
    if ports:
        return ports[0].device
    return None

def main():
    port = find_usb_serial_port()
    if not port:
        print("Error: Could not detect a serial port.")
        sys.exit(1)
        
    baudrate = 115200
    print(f"Connecting to {port} at {baudrate} baud...")
    
    try:
        ser = serial.Serial(port, baudrate, timeout=0.1)
    except Exception as e:
        print(f"Failed to open port: {e}")
        sys.exit(1)
        
    print("Relay active. Reading scans and forwarding to Web UI...")
    
    chars = []
    while True:
        try:
            c_bytes = ser.read(1)
            if not c_bytes:
                time.sleep(0.01)
                continue
                
            c = c_bytes.decode('utf-8', errors='ignore')
            if c == '\n' or c == '\r':
                if chars:
                    line = "".join(chars).strip()
                    chars = []
                    if line.startswith("{") and "token" in line:
                        print(f"[*] Forwarding scan to UI: {line[:30]}...")
                        try:
                            req = urllib.request.Request(
                                "http://localhost:3000/frontend/api/gate/local_relay/",
                                data=json.dumps({"raw": line}).encode("utf-8"),
                                headers={"Content-Type": "application/json"}
                            )
                            urllib.request.urlopen(req, timeout=2)
                        except Exception as e:
                            print(f"[!] Failed to forward: {e}")
            else:
                chars.append(c)
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Serial error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()
