// Set to true to use mock responses (no server). Set to false to call API.
const USE_MOCK = false;
const API_URL = 'http://localhost:8001/chat';

// Mock response: reply = normal text, result = JSON shown in terminal box only
const MOCK_RESPONSE = {
  status: 'success',
  reply: "Here's the breakdown for your PRD based on the changes you described.",
  result: {
    requirement_summary: "New change request with multiple updates across orders and related flows.",
    assumptions: ["Existing order domain is unchanged", "New params are optional for backward compatibility"],
    services: [
      {
        name: "orders-service",
        why: "Owns Order aggregate and /orders API",
        changes: [
          {
            file: "src/main/.../OrderController.java",
            edit: "Add new query param ...; validate ...; call ...",
            constraints: ["keep existing response shape", "no new deps"],
          },
        ],
        tests: [
          { file: "src/test/.../OrderControllerTest.java", add: "covers ..." },
        ],
      },
    ],
    migrations: [],
    acceptance_criteria: ["Orders support new param", "Tests pass"],
    commands: ["mvn test", "..."],
  },
};

function getMockResponse(/* message, files */) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ...MOCK_RESPONSE }), 600);
  });
}

const form = document.getElementById('chat-form');
const textInput = document.getElementById('text-input');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const messagesEl = document.getElementById('messages');
const sendBtn = document.getElementById('send-btn');

const ALLOWED_TYPES = ['.txt', '.doc', '.docx', '.png', 'image/png'];
let selectedFiles = [];

// Remove welcome message once first message is sent
function hideWelcome() {
  const welcome = messagesEl.querySelector('.welcome');
  if (welcome) welcome.remove();
}

function addMessage(content, role, options = {}) {
  hideWelcome();
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  if (options.error) msg.classList.add('error');

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = role === 'user' ? 'You' : 'ArchMind';

  const body = document.createElement('div');
  body.className = 'content';
  if (options.isJson) {
    const pre = document.createElement('pre');
    pre.className = 'json-block';
    pre.textContent = content;
    body.appendChild(pre);
  } else {
    body.textContent = content;
  }

  msg.appendChild(meta);
  msg.appendChild(body);
  if (options.fileNames && options.fileNames.length) {
    const filesSpan = document.createElement('div');
    filesSpan.className = 'files';
    filesSpan.textContent = 'Files: ' + options.fileNames.join(', ');
    msg.appendChild(filesSpan);
  }
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return msg;
}

function prettyJson(obj) {
  return JSON.stringify(obj, null, 2);
}

/** Render markdown to safe HTML (marked + DOMPurify). */
function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text;
  const raw = marked.parse(text, { gfm: true, breaks: true });
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(raw, { ALLOWED_TAGS: ['p','br','strong','em','code','pre','ul','ol','li','h1','h2','h3','h4','a','blockquote','hr'] });
  }
  return raw;
}

function addLoadingMessage() {
  hideWelcome();
  const msg = document.createElement('div');
  msg.className = 'msg api';
  msg.innerHTML = '<div class="meta">ArchMind</div><div class="content"><span class="loading"></span> Thinking...</div>';
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return msg;
}

function updateToResponse(msgEl, data) {
  const content = msgEl.querySelector('.content');
  content.innerHTML = '';
  const loading = msgEl.querySelector('.loading');
  if (loading) loading.remove();

  if (typeof data === 'string') {
    content.innerHTML = '';
    const textEl = document.createElement('div');
    textEl.className = 'reply-text markdown-body';
    textEl.innerHTML = renderMarkdown(data);
    content.appendChild(textEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return;
  }

  const reply = data.reply ?? data.answer ?? data.message ?? data.text;
  const result = data.result ?? data.output ?? data.json;

  if (reply && typeof reply === 'string') {
    const textEl = document.createElement('div');
    textEl.className = 'reply-text markdown-body';
    textEl.innerHTML = renderMarkdown(reply);
    content.appendChild(textEl);
  }
  // Only show JSON block when there's no reply (e.g. structured-only response)
  if (!reply && result != null) {
    const pre = document.createElement('pre');
    pre.className = 'json-block';
    pre.textContent = typeof result === 'string' ? result : prettyJson(result);
    content.appendChild(pre);
  }
  if (!reply && result == null) {
    content.textContent = prettyJson(data);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showError(message) {
  addMessage(message || 'Something went wrong. Check API URL and try again.', 'api', { error: true });
}

function renderFileList() {
  fileListEl.innerHTML = '';
  selectedFiles.forEach((file, i) => {
    const tag = document.createElement('span');
    tag.className = 'file-tag';
    tag.innerHTML = `${file.name} <button type="button" data-idx="${i}" aria-label="Remove">×</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      selectedFiles.splice(i, 1);
      renderFileList();
    });
    fileListEl.appendChild(tag);
  });
}

fileInput.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  for (const file of files) {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const ok = ALLOWED_TYPES.some(t => t === ext || t === file.type);
    if (ok) selectedFiles.push(file);
  }
  fileInput.value = '';
  renderFileList();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text && selectedFiles.length === 0) return;

  const userContent = text || '(no text, files only)';
  const fileNames = selectedFiles.map(f => f.name);
  addMessage(userContent, 'user', { fileNames: fileNames.length ? fileNames : undefined });

  textInput.value = '';
  const filesToSend = [...selectedFiles];
  selectedFiles = [];
  renderFileList();

  const loadingMsg = addLoadingMessage();
  sendBtn.disabled = true;

  try {
    let data;
    if (USE_MOCK) {
      data = await getMockResponse(userContent, filesToSend);
    } else {
      const formData = new FormData();
      formData.append('message', userContent);
      filesToSend.forEach((file) => formData.append('files', file));
      const res = await fetch(API_URL, { method: 'POST', body: formData });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
        if (!res.ok) {
          updateToResponse(loadingMsg, data.error || data.message || `Error ${res.status}`);
          loadingMsg.classList.add('error');
          sendBtn.disabled = false;
          return;
        }
      } else {
        const text = await res.text();
        if (!res.ok) {
          updateToResponse(loadingMsg, text || `Error ${res.status}`);
          loadingMsg.classList.add('error');
          sendBtn.disabled = false;
          return;
        }
        data = { reply: text };
      }
    }

    updateToResponse(loadingMsg, data);
  } catch (err) {
    loadingMsg.remove();
    showError('Network error: ' + (err.message || 'Could not reach API.'));
  } finally {
    sendBtn.disabled = false;
  }
});
