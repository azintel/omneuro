import crypto from "crypto";
import nacl from "tweetnacl";

/**
 * HMAC check for internal calls (Apps Script -> brain-api).
 * Requires header: x-juice-signature = hex(HMAC_SHA256(secret, rawBodyString))
 */
export function requireSharedSecret(req, res, next) {
  try {
    const secret = process.env.APP_SHARED_SECRET || "";
    if (!secret) return res.status(500).json({ error: "Server secret not set" });

    const provided = req.get("x-juice-signature");
    if (!provided) return res.status(401).json({ error: "Missing signature" });

    // For JSON routes, body has already been parsed to object.
    // Re-create the exact string your client signed:
    const raw = JSON.stringify(req.body || {});
    const hmac = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const ok = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(provided));
    if (!ok) return res.status(401).json({ error: "Bad signature" });
    next();
  } catch {
    return res.status(401).json({ error: "Auth failed" });
  }
}

/**
 * Telnyx signature verification for webhook route that uses express.raw.
 * Must be used on a route where req.body is a Buffer (via express.raw).
 */
export function verifyTelnyxSignatureRaw(req, res, next) {
  try {
    const pub = process.env.TELNYX_PUBLIC_SIGNING_KEY;
    if (!pub) return res.status(500).json({ error: "Missing TELNYX_PUBLIC_SIGNING_KEY" });

    const sig = req.get("Telnyx-Signature-Ed25519");
    const ts = req.get("Telnyx-Timestamp");
    if (!sig || !ts) return res.status(401).json({ error: "Missing Telnyx signature headers" });

    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "", "utf8");
    const message = Buffer.from(`${ts}|${payload.toString("utf8")}`);
    const signature = Buffer.from(sig, "base64");
    const publicKey = Buffer.from(pub, "base64");

    const ok = nacl.sign.detached.verify(message, signature, publicKey);
    if (!ok) return res.status(401).json({ error: "Invalid Telnyx signature" });
    next();
  } catch {
    return res.status(401).json({ error: "Signature verify failed" });
  }
}