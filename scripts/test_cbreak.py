import sys
import termios
import tty
import time
import shutil

def get_width():
    return shutil.get_terminal_size((80, 24)).columns

def main():
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setcbreak(fd)
        width = get_width()
        print("Type something. Ctrl+C to exit.")
        chars = []
        first_char = True
        while True:
            c = sys.stdin.read(1)
            if not c:
                break
            if first_char:
                sys.stdout.write("\033[1;33m" + "Scanning...".center(width) + "\033[0m\r")
                sys.stdout.flush()
                first_char = False
                
            if c == '\n' or c == '\r':
                sys.stdout.write("\033[1;32m" + "Scanned! Processing...".center(width) + "\033[0m\n")
                sys.stdout.flush()
                print(f"\nYou typed: {''.join(chars)}")
                chars = []
                first_char = True
            else:
                chars.append(c)
    except KeyboardInterrupt:
        print("\nExiting.")
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

if __name__ == "__main__":
    main()
