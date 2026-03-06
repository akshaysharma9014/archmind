# Connecting Your Knowledge Base to Supercoder

## Flow

```
User types query (or uploads file) → UI sends POST /chat
    → Your backend (server_kb.py) receives query
    → Backend calls your knowledge base (search/retrieve)
    → Backend returns { "reply": "...", "result": { ... } }
    → UI shows reply as normal text and result in the terminal box
```

## Steps

### 1. Run the backend

```bash
cd /Users/vivek.jha/Desktop/project/supercoder
pip install flask flask-cors
python3 server_kb.py
```

Backend will be at **http://localhost:8001/chat**.

### 2. Point the UI to the backend

In **app.js**, set:

```js
const USE_MOCK = false;
const API_URL = 'http://localhost:8001/chat';
```

### 3. Plug in your knowledge base

Edit **server_kb.py** and implement `query_knowledge_base(query, file_names)`.

**Option A – Your KB has an HTTP API**

```python
import requests

def query_knowledge_base(query: str, file_names: list = None) -> dict:
    r = requests.post(
        "https://your-kb-api.com/search",  # or /query, /retrieve, etc.
        json={"query": query, "top_k": 5},
        headers={"Authorization": "Bearer YOUR_API_KEY"},
    )
    r.raise_for_status()
    data = r.json()
    return {
        "reply": data.get("summary") or f"Found {len(data.get('results', []))} results.",
        "result": data,
    }
```

**Option B – Pinecone**

```python
from pinecone import Pinecone

pc = Pinecone(api_key="YOUR_KEY")
index = pc.Index("your-index-name")

def query_knowledge_base(query: str, file_names: list = None) -> dict:
    # Embed query (use your embedding model)
    # embed = your_embedding_model.embed(query)
    # res = index.query(vector=embed, top_k=5, include_metadata=True)
    # hits = [{"text": m["metadata"].get("text"), "score": s} for m, s in ...]
    return {"reply": "Results from Pinecone.", "result": {"matches": []}}
```

**Option C – AWS Kendra**

```python
import boto3

kendra = boto3.client("kendra")

def query_knowledge_base(query: str, file_names: list = None) -> dict:
    res = kendra.query(
        IndexId="YOUR_INDEX_ID",
        QueryText=query,
        PageNumber=1,
        PageSize=5,
    )
    items = res.get("ResultItems", [])
    return {
        "reply": f"Found {len(items)} relevant results.",
        "result": {"items": items},
    }
```

**Option D – Any other SDK or database**

Call your search/retrieve API inside `query_knowledge_base`, then return:

```python
return {
    "reply": "Short summary for the user (normal text in UI).",
    "result": { ... },  # Any dict/list – shown in terminal box as JSON.
}
```

### 4. Response shape for the UI

- **reply** (string): Shown as normal chat text.
- **result** (object or null): Shown in the terminal-style JSON block. Can be a list of chunks, a structured breakdown, or whatever your KB returns.

No changes are needed in the frontend; it already displays `reply` and `result` in this way.
