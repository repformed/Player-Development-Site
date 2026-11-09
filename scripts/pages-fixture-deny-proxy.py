"""Local test-only deny proxy. Never opens an upstream connection."""
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit
import json
import sys

report = Path(sys.argv[1]).resolve()
port = int(sys.argv[2])
if port not in (5299, 5300):
    raise SystemExit("Unexpected fixture proxy port")
report.parent.mkdir(parents=True, exist_ok=True)
counts = Counter()
lock = Lock()

def persist():
    temporary = report.with_suffix(report.suffix + ".tmp")
    temporary.write_text(json.dumps({"guard": "deny-only loopback proxy", "forwarded_upstream": 0,
                                     "blocked": dict(counts)}, indent=2) + "\n")
    temporary.replace(report)

persist()

class Deny(BaseHTTPRequestHandler):
    def deny(self):
        target = "//" + self.path if self.command == "CONNECT" else self.path
        try:
            host = urlsplit(target).hostname or "unspecified"
        except ValueError:
            host = "invalid-target"
        with lock:
            counts[self.command + " " + host] += 1
            persist()
        self.send_response(403)
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_CONNECT = do_HEAD = deny

    def log_message(self, *_args):
        pass

ThreadingHTTPServer(("127.0.0.1", port), Deny).serve_forever()
