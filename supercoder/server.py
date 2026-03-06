"""
Mock chat API for Supercoder – runs on http://localhost:8001/chat
Returns a static JSON response for any request. Replace with your real API later.
Run: python3 server.py
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json

PORT = 8001

# Static response with ~100 words for any user query
STATIC_RESPONSE = {
    "status": "success",
    "reply": (
        "Supercoder is your tech bot designed to help with coding questions, file analysis, and quick answers. "
        "You can send text or attach files like .txt, .doc, .docx, or .png, and we process your request. "
        "This is a static reply so you can test the chat flow end to end. "
        "When you connect a real backend or AI model, the same endpoint will return dynamic answers. "
        "For now, we hope this helps you get the interface working and ready for your hackathon. "
        "Happy building and good luck with your project."
    ),
}


class ChatHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_POST(self):
        if self.path != "/chat":
            self.send_response(404)
            self.end_headers()
            return
        # Read body (optional – we ignore it for static response)
        length = int(self.headers.get("Content-Length", 0))
        if length:
            self.rfile.read(length)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._send_cors()
        self.end_headers()
        self.wfile.write(json.dumps(STATIC_RESPONSE, indent=2).encode())

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    server = HTTPServer(("", PORT), ChatHandler)
    print(f"Supercoder mock API: http://localhost:{PORT}/chat")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
