const API_BASE = "/api/garage";

const addForm = document.getElementById("addForm");
const listForm = document.getElementById("listForm");
const addMsg  = document.getElementById("addMsg");
const listMsg = document.getElementById("listMsg");
const listUl  = document.getElementById("vehicleList");

function toast(el, text, kind = "info") {
  el.textContent = text;
  el.className = `msg ${kind}`;
  if (text) setTimeout(() => { el.textContent = ""; el.className = "msg"; }, 4000);
}

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

async function getJSON(url) {
  const r = await fetch(url, { credentials: "same-origin" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

// Add vehicle
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(addForm);
  const payload = Object.fromEntries(form.entries());
  try {
    toast(addMsg, "Saving…");
    const res = await postJSON(`${API_BASE}/vehicles`, payload);
    toast(addMsg, "Saved!", "ok");
    // Prepend to list if owner's email matches current list filter
    const listOwner = new FormData(listForm).get("owner_email");
    if (listOwner && listOwner === payload.owner_email) {
      renderList([res.vehicle, ...currentItems]);
    }
    addForm.reset();
  } catch (err) {
    toast(addMsg, err.message || "Failed to save", "err");
  }
});

let currentItems = [];

// Load vehicles for owner
listForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const owner_email = new FormData(listForm).get("owner_email");
  if (!owner_email) return toast(listMsg, "Enter your email", "err");
  try {
    toast(listMsg, "Loading…");
    const res = await getJSON(`${API_BASE}/vehicles?owner_email=${encodeURIComponent(owner_email)}`);
    currentItems = res.items || [];
    renderList(currentItems);
    toast(listMsg, `Loaded ${currentItems.length} vehicle(s)`, "ok");
  } catch (err) {
    toast(listMsg, err.message || "Failed to load", "err");
  }
});

function renderList(items) {
  listUl.innerHTML = "";
  if (!items.length) {
    listUl.innerHTML = `<li class="muted">No vehicles yet.</li>`;
    return;
  }
  for (const v of items) {
    const li = document.createElement("li");
    li.className = "row";
    li.innerHTML = `
      <div>
        <strong>${escapeHTML(v.make)} ${escapeHTML(v.model)}</strong>
        ${v.nickname ? `<span class="tag">${escapeHTML(v.nickname)}</span>` : ""}
        <div class="sub">${escapeHTML(v.owner_email)} • ${escapeHTML(v.created_at)}</div>
        ${v.notes ? `<div class="notes">${escapeHTML(v.notes)}</div>` : ""}
      </div>
    `;
    listUl.appendChild(li);
  }
}

function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}