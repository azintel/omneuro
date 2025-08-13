import axios from "axios";

export async function sendSms({ to, text, from }) {
  if (!to) throw new Error("Missing 'to'");
  const sender = from || process.env.TELNYX_FROM;
  if (!sender) throw new Error("Missing TELNYX_FROM");

  const apiKey = process.env.TELNYX_API_KEY || "";
  if (!apiKey) {
    console.warn("TELNYX_API_KEY not set; simulating SMS:", { to, text });
    return { id: "simulated-" + Date.now(), simulated: true };
  }

  try {
    const resp = await axios.post(
      "https://api.telnyx.com/v2/messages",
      { from: sender, to, text },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        timeout: 10000
      }
    );
    return resp.data?.data || { id: resp.data?.data?.id || "unknown" };
  } catch (e) {
    const detail = { status: e.response?.status, data: e.response?.data, message: e.message };
    console.error("Telnyx REST send failed:", detail);
    const err = new Error("Telnyx REST send failed");
    err.telnyx = detail;
    throw err;
  }
}