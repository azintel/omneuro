// apps/brain-api/tools/send.js
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const [, , toArg, ...msgParts] = process.argv;
if (!toArg || msgParts.length === 0) {
  console.error("Usage: npm run send-sms -- +1XXXXXXXXXX \"Your message here\"");
  process.exit(1);
}
const to = toArg;
const text = msgParts.join(" ");

const secret = process.env.APP_SHARED_SECRET;
if (!secret) {
  console.error("APP_SHARED_SECRET missing in .env");
  process.exit(1);
}

const url = process.env.LOCAL_SMS_URL || "http://localhost:8080/v1/sms/send";
const body = { to, text };
const signature = crypto.createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");

(async () => {
  try {
    const resp = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        "x-juice-signature": signature
      },
      validateStatus: () => true
    });
    console.log("Status:", resp.status);
    console.log("Response:", JSON.stringify(resp.data, null, 2));
  } catch (e) {
    console.error("Request failed:", e.message);
    process.exit(1);
  }
})();