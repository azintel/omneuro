// apps/tech-gateway/src/public/garage/app.js

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof data === "string" ? data : data?.error || "request_failed");
  return data;
}

function hhmmToMinutes(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error("invalid time");
  return h * 60 + m;
}

function setMsg(el, text, ok = true) {
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "err");
}

// ----- Add Vehicle -----
const addForm = $("#addForm");
if (addForm) {
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#addMsg");
    try {
      const form = new FormData(addForm);
      const payload = Object.fromEntries(form.entries());
      const data = await api("/api/garage/vehicles", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMsg(msg, `Saved vehicle #${data?.vehicle?.id || "?"}`, true);
      addForm.reset();
    } catch (err) {
      setMsg(msg, err.message || "Failed to save", false);
    }
  });
}

// ----- List Vehicles -----
const listForm = $("#listForm");
if (listForm) {
  listForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#listMsg");
    const ul = $("#vehicleList");
    ul.innerHTML = "";
    try {
      const email = new FormData(listForm).get("owner_email");
      const data = await api(`/api/garage/vehicles?owner_email=${encodeURIComponent(email)}`);
      const items = data?.items || [];
      if (!items.length) {
        ul.innerHTML = `<li class="muted">No vehicles yet.</li>`;
      } else {
        ul.innerHTML = items
          .map(
            (v) =>
              `<li>
                <b>#${v.id}</b> — ${v.make} ${v.model}
                ${v.nickname ? `(<i>${v.nickname}</i>)` : ""}
                <div class="muted">${v.created_at}</div>
              </li>`
          )
          .join("");
      }
      setMsg(msg, `Loaded ${items.length} vehicle(s)`, true);
    } catch (err) {
      setMsg(msg, err.message || "Failed to load vehicles", false);
    }
  });
}

// ----- Schedule Appointment -----
const schedForm = $("#schedForm");
if (schedForm) {
  schedForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#schedMsg");
    try {
      const form = new FormData(schedForm);
      const payload = {
        owner_email: String(form.get("owner_email") || "").trim().toLowerCase(),
        vehicle_id: Number(form.get("vehicle_id")),
        date: String(form.get("date")),
        start_minute: hhmmToMinutes(form.get("start_time")),
        end_minute: hhmmToMinutes(form.get("end_time")),
      };
      if (payload.end_minute <= payload.start_minute) throw new Error("End must be after start");

      const data = await api("/api/scheduler/appointments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMsg(
        msg,
        `Booked appt #${data.id} on ${data.date} from ${form.get("start_time")} to ${form.get(
          "end_time"
        )} for ${payload.owner_email}`,
        true
      );
      schedForm.reset();
    } catch (err) {
      setMsg(msg, err.message || "Failed to schedule", false);
    }
  });
}