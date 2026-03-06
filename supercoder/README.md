# Supercoder – Chat UI

Simple hackathon chatbot UI. Accepts **text** and **files** (.txt, .doc, .docx, .png), sends them to your API, and shows the response.

## Run locally

1. Open `index.html` in a browser, or use a local server:
   ```bash
   npx serve .
   ```
   or
   ```bash
   python3 -m http.server 8080
   ```
   Then go to `http://localhost:8080` (or the port shown).

2. Set your API URL in `app.js`:
   ```js
   const API_URL = 'https://your-api.com/chat';
   ```

## API contract

- **Method:** `POST`
- **Body:** `FormData`
  - `message` (string): user text
  - `files` (File): one or more files (txt, doc, docx, png)
- **Response:** Either:
  - JSON with one of: `reply`, `response`, `text`, `message`, `output`
  - Or plain text

Example backend (Node) expecting the same:

```js
// Express example
app.post('/chat', (req, res) => {
  const message = req.body.message;
  const files = req.files?.files; // multer or similar
  // ... your logic ...
  res.json({ reply: 'Your response here' });
});
```

## Files

- `index.html` – Chat layout and file input
- `styles.css` – Layout and theme
- `app.js` – Send message + files to API, show response
