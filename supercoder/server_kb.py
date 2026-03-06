"""
Supercoder backend: takes user query → calls AWS KB API → returns result for UI.
Run: pip install -r requirements.txt
     python3 server_kb.py
Then set USE_MOCK = false in app.js and use API_URL = 'http://localhost:8001/chat'.
"""

import os

try:
    import requests
except ImportError:
    print("Install deps: pip install requests")
    raise

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError:
    print("Install deps: pip install flask flask-cors")
    raise

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get("PORT", 8001))

KNOWLEDGE_BASE_URL = "https://7b21828ak3.execute-api.us-east-1.amazonaws.com/query"
# KB can be slow (e.g. Lambda cold start). Increase if you still see read timeout.
KB_TIMEOUT = (10, 90)  # (connect, read) seconds


def query_knowledge_base(query: str, file_names: list = None) -> dict:
    """Call the knowledge base API and return reply + result for the UI."""
    resp = requests.post(
        KNOWLEDGE_BASE_URL,
        headers={"Content-Type": "application/json"},
        json={"query": query},
        timeout=KB_TIMEOUT,
    )
    resp.raise_for_status()
    try:
        data = resp.json()
    except ValueError:
        data = {"raw": resp.text[:2000]}

    # Build short reply from KB response (adjust keys if your API returns different names)
    reply = (
        data.get("answer")
        or data.get("summary")
        or data.get("reply")
        or f"Found results for: “{query}”."
    )
    if isinstance(reply, list):
        reply = reply[0] if reply else "No summary."
    return {"reply": str(reply), "result": data}


@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return "", 204

    try:
        message = request.form.get("message", "").strip() or "(no text)"
        files = request.files.getlist("files")
        file_names = [f.filename for f in files] if files else None
        if not message:
            return jsonify({"reply": "Please enter a message.", "result": None}), 200

        out = query_knowledge_base(message, file_names=file_names or None)
        reply = out.get("reply") or "No summary."
        result = out.get("result")

        return jsonify({"reply": reply, "result": result})
    except requests.RequestException as e:
        err = str(e.response.text) if getattr(e, "response", None) else str(e)
        return jsonify({"reply": f"Knowledge base error: {err}", "result": None}), 200
    except Exception as e:
        return jsonify({"reply": f"Error: {e}", "result": None}), 500


if __name__ == "__main__":
    print(f"Supercoder KB API: http://localhost:{PORT}/chat")
    print(f"KB endpoint: {KNOWLEDGE_BASE_URL}")
    app.run(host="0.0.0.0", port=PORT, debug=True)
