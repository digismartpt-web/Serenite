#!/usr/bin/env python3
"""Simple SPA-compatible HTTP server - serves index.html for all non-file routes."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
DIR = os.path.dirname(os.path.abspath(__file__)) + "/dist"

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_GET(self):
        # Try to serve the file directly
        file_path = os.path.join(DIR, self.path.lstrip("/"))
        if os.path.isfile(file_path):
            return super().do_GET()
        # SPA fallback: serve index.html for all other routes
        self.path = "/index.html"
        return super().do_GET()

if __name__ == "__main__":
    httpd = http.server.HTTPServer(("0.0.0.0", PORT), SPAHandler)
    print(f"Serving SPA on port {PORT} from {DIR}")
    httpd.serve_forever()
