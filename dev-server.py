# Local dev server that tells the browser never to cache, so edits show up on reload.
import http.server

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

http.server.ThreadingHTTPServer(("", 5173), NoCache).serve_forever()
