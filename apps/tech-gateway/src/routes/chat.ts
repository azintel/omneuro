////apps/tech-gateway/src/routes/chat.ts
//
// Repairbot chat route with access-token guard.
// - Accepts:
//    GET  /api/chat         -> returns embedded HTML UI (no auth here; UI asks for code)
//    POST /api/chat         -> { messages: [{role, content}, ...] } (guarded by X-Access-Token if env is set)
// - Uses ../lib/ssm.getOpenAIKey() to fetch OpenAI key from AWS SSM.

import express from "express";
import type { Request, Response } from "express";
import { getOpenAIKey } from "../lib/ssm.js";

const router = express.Router();

type Msg = { role: "system" | "user" | "assistant"; content: string };

const OPENAI_API_BASE = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OMNEURO_OPENAI_MODEL || "gpt-4o-mini";
const ACCESS_TOKEN = process.env.TECH_GATEWAY_ACCESS_TOKEN || ""; // set via SSM/PM2 env

const SYSTEM_PROMPT = `
You are Repairbot, the senior service advisor for Omneuro's EV repair operations.
- Stay concise and precise.
- Follow Omneuro ops rules: small, testable steps; log before code; docs are source of truth.
- If a task needs data or action, clearly say the action (e.g., "lookup_job VIN=..."); internal tools may execute it.
- Never expose secrets.
`.trim();

function requireAccess(req: Request): void {
  if (!ACCESS_TOKEN) return; // if not set, do not block
  const header = (req.header("x-access-token") || "").trim();
  if (header !== ACCESS_TOKEN) {
    const err: any = new Error("unauthorized");
    err.status = 401;
    throw err;
  }
}

async function callOpenAI(messages: Msg[]): Promise<string> {
  const OPENAI_API_KEY = await getOpenAIKey();
  const resp = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages,
      stream: false,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }
  const json = (await resp.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response missing content");
  return content;
}

const HTML_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Omneuro • Repairbot</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,sans-serif;margin:0;background:#0b0f16;color:#e6edf3}
header{padding:16px 20px;border-bottom:1px solid #1f2633;display:flex;gap:10px;align-items:center}
header h1{font-size:16px;margin:0}
main{max-width:900px;margin:0 auto;padding:20px}
#log{display:flex;flex-direction:column;gap:12px}
.msg{border:1px solid #1f2633;background:#0f1622;border-radius:12px;padding:12px 14px;white-space:pre-wrap}
.role{font-size:12px;opacity:.7;margin-bottom:6px}
form{position:sticky;bottom:0;background:linear-gradient(180deg,rgba(11,15,22,.2),rgba(11,15,22,1));padding:16px 0;margin-top:20px}
input[type="text"]{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #1f2633;background:#0f1622;color:#e6edf3}
button{margin-top:8px;padding:10px 14px;border-radius:10px;border:1px solid #2a3a55;background:#132238;color:#e6edf3;cursor:pointer}
button:disabled{opacity:.6;cursor:not-allowed}
.small{font-size:12px;opacity:.6;margin-top:6px}
.pill{display:inline-block;padding:3px 8px;border:1px solid #1f2633;border-radius:999px;color:#9fb0c3;font-size:12px}
.ok{color:#8df58d}.err{color:#ff8d8d}
</style>
</head>
<body>
<header>
  <h1>Omneuro Repairbot</h1>
  <span class="small">tech.juicejunkiez.com</span>
  <span class="pill" id="status">locked</span>
</header>
<main>
  <div id="log"></div>
  <form id="f">
    <input id="q" type="text" placeholder="Ask Repairbot (access code required)" autocomplete="off" />
    <button id="send" type="submit">Send</button>
    <div class="small">Internal use only. Avoid PHI/PII in prompts.</div>
  </form>
</main>
<script>
const log = document.getElementById('log');
const f = document.getElementById('f');
const q = document.getElementById('q');
const send = document.getElementById('send');
const statusEl = document.getElementById('status');
const messages = [];

function add(role, content){
  const div = document.createElement('div');
  div.className = 'msg';
  const r = document.createElement('div');
  r.className = 'role';
  r.textContent = role.toUpperCase();
  const c = document.createElement('div');
  c.textContent = content;
  div.appendChild(r); div.appendChild(c);
  log.appendChild(div);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function getToken(force=false) {
  let t = localStorage.getItem('ACCESS_TOKEN') || '';
  if (!t || force) {
    t = prompt('Enter access code to use Repairbot:') || '';
    if (t) localStorage.setItem('ACCESS_TOKEN', t);
  }
  statusEl.textContent = t ? 'unlocked' : 'locked';
  statusEl.className = 'pill ' + (t ? 'ok' : 'err');
  return t;
}

f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = q.value.trim();
  if (!text) return;
  const token = getToken();
  if (!token) { add('system', 'Missing access code.'); return; }

  q.value = ''; send.disabled = true;
  messages.push({ role: 'user', content: text });
  add('user', text);

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Access-Token': token },
      body: JSON.stringify({ messages })
    });
    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 401) {
        localStorage.removeItem('ACCESS_TOKEN');
        getToken(true);
      }
      add('system', 'Error: ' + t);
      send.disabled = false;
      return;
    }
    const { reply } = await resp.json();
    messages.push({ role: 'assistant', content: reply });
    add('assistant', reply);
  } catch (err) {
    add('system', 'Network error: ' + err);
  } finally {
    send.disabled = false;
  }
});

// boot
add('system', 'Repairbot ready. Access code required.');
getToken();
</script>
</body>
</html>
`;

// Serve UI at /api/chat (no extra suffix)
router.get("/chat", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(HTML_PAGE);
});

// Also allow GET /api/chat/ (trailing slash)
router.get("/chat/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(HTML_PAGE);
});

// POST /api/chat { messages: Msg[] }
router.post("/chat", express.json(), async (req: Request, res: Response) => {
  try {
    requireAccess(req);
    const userMsgs = (req.body?.messages || []) as Msg[];
    const messages: Msg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...userMsgs];
    const reply = await callOpenAI(messages);
    res.status(200).json({ reply });
  } catch (err: any) {
    const status = err?.status || 500;
    const msg = status === 401 ? "unauthorized" : "chat error";
    console.error("[chat] error:", err?.message || err);
    res.status(status).send(msg);
  }
});

export default router;