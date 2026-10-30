import http.server
import socketserver

PORT = 3000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
try:
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"Serving HTTP on 0.0.0.0 port {PORT} with Cache-Control: no-store...")
        httpd.serve_forever()
except Exception as e:
    print(f"Server error: {e}")
