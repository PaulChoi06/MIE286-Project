"""
Serve the memory game over HTTP so Chrome loads HTML/CSS/JS with correct types.

Run from this folder:
  python main.py

Then open in Chrome: http://127.0.0.1:8765/
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import webbrowser
import threading


def main() -> None:
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)

    port = 8765

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:
            pass  # quiet

    server = HTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/index.html"
    print(f"Serving: {root}")
    print(f"Open in Chrome: {url}")
    print("Press Ctrl+C to stop.")

    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
