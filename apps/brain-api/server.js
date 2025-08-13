import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import { loadConfig } from './config.js';
import { sendSms } from './telnyx.js';
import { requireSharedSecret, verifyTelnyxSignatureRaw } from './verify.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// Global middleware: JSON only (no raw capture here)
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(morgan('tiny'));

const cfg = loadConfig();

// Health
app.get('/health', (_, res) => {
  res.json({
    ok: true,
    service: 'brain-api',
    ts: Date.now(),
    bookingCalendar: cfg.booking.calendarName,
    dropoff: cfg.booking.dropoffAddress
  });
});

// Config summary
app.get('/v1/config/summary', (_, res) => {
  res.json({
    ok: true,
    forms: cfg.forms,
    templates: Object.keys(cfg.templates),
    booking: {
      allowedDays: cfg.booking.allowedDays,
      windows: cfg.booking.windows,
      searchMaxDays: cfg.booking.searchMaxDays
    }
  });
});

// ===== Outbound SMS from Apps Script (HMAC shared secret) =====
app.post('/v1/sms/send', requireSharedSecret, async (req, res) => {
  try {
    const { to, text } = req.body || {};
    if (!to || !text) return res.status(400).json({ error: 'to and text required' });
    const out = await sendSms({ to, text });
    res.json({ ok: true, id: out.id, simulated: out.simulated || false });
  } catch (e) {
    console.error("SMS send error:", e.telnyx || e);
    res.status(500).json({ ok: false, error: 'telnyx_error', detail: e.telnyx || { message: e.message } });
  }
});

// ===== Inbound SMS webhook (route-specific raw parser) =====
// Use raw JSON only on this route so we can verify Telnyx's signature on the exact bytes.
// When you set TELNYX_PUBLIC_SIGNING_KEY, uncomment verifyTelnyxSignatureRaw below.
app.post('/v1/sms/inbound',
  express.raw({ type: 'application/json', limit: '1mb' }),
  // verifyTelnyxSignatureRaw, // enable once you set the public signing key
  async (req, res) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
      const json = raw ? JSON.parse(raw) : {};
      const event = json?.data?.event_type || '';
      const payload = json?.data?.payload || {};
      if (event !== 'message.received') return res.json({ ok: true });

      const from = payload?.from?.phone_number;
      const text = (payload?.text || '').trim().toLowerCase();

      let reply;
      if (/^(book|appt|schedule)/.test(text)) {
        const url = process.env.INTAKE_FORM_URL || cfg.forms.intake || 'https://docs.google.com/forms/';
        reply = [
          `Thanks for texting ${process.env.BUSINESS_NAME || 'Juice Junkiez'}!`,
          `Start here: ${url}`,
          `Once submitted, we’ll text you 3 drop-off windows.`
        ].join('\n');
      } else if (/^(status|update)/.test(text)) {
        reply = `Reply with your email used on the intake and we’ll text back your latest status.`;
      } else if (/^(help|\?)/.test(text)) {
        reply = `Text BOOK to schedule, STATUS for repair status, or call us anytime.`;
      } else {
        reply = `Hi! Text BOOK to schedule or STATUS for repair status.`;
      }

      if (reply && from) await sendSms({ to: from, text: reply });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  }
);

app.listen(PORT, () => console.log(`brain-api listening on :${PORT}`));