const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_MESSAGING_PROFILE_ID = process.env.TELNYX_MESSAGING_PROFILE_ID || "";
const TELNYX_FROM = process.env.TELNYX_FROM || "";

export async function sendSMS({ to, body }) {
  if (!TELNYX_API_KEY || !TELNYX_MESSAGING_PROFILE_ID || !TELNYX_FROM) {
    return { ok: false, status: 500, error: "missing_telnyx_env" };
  }
  const r = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      text: body,
      from: TELNYX_FROM,
      messaging_profile_id: TELNYX_MESSAGING_PROFILE_ID
    })
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}