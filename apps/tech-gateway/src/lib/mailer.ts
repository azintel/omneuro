/////apps/tech-gateway/src/lib/mailer.ts
import nodemailer from "nodemailer";
import { SES, SendRawEmailCommand } from "@aws-sdk/client-ses";

type SendEmailOpts = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

function getenv(name: string, def = ""): string {
  const v = process.env[name];
  return v === undefined || v === null ? def : String(v);
}

const TRANSPORT =
  (getenv("MAIL_TRANSPORT") ||
    (process.env.NODE_ENV === "production" ? "ses" : "log")).toLowerCase();

const MAIL_FROM = getenv("MAIL_FROM", "Juice Junkiez <notifications@juicejunkiez.com>");

let transporter: any | undefined;

async function buildTransport(): Promise<any> {
  if (TRANSPORT === "ses") {
    const region = getenv("MAIL_SES_REGION") || getenv("AWS_REGION") || "us-east-2";
    const ses = new SES({ region });
    // Nodemailer + AWS SDK v3
    return nodemailer.createTransport({
      SES: { ses, aws: { SendRawEmailCommand } },
    } as any);
  }

  if (TRANSPORT === "smtp") {
    const host = getenv("SMTP_HOST", "smtp.gmail.com");
    const port = Number(getenv("SMTP_PORT", "587"));
    const secure = String(getenv("SMTP_SECURE", "false")).toLowerCase() === "true";
    const user = getenv("SMTP_USER");
    const pass = getenv("SMTP_PASS");
    if (!host || !port || !user || !pass) {
      throw new Error("SMTP_* env vars required for MAIL_TRANSPORT=smtp");
    }
    return nodemailer.createTransport({ host, port, secure, auth: { user, pass } } as any);
  }

  // default: LOG (no external calls)
  return {
    // @ts-ignore - simple logger transport
    sendMail: async (msg: any) => {
      console.log("[mailer:log] To:", msg.to);
      console.log("[mailer:log] Subject:", msg.subject);
      if (msg.text) console.log("[mailer:log] Text:\n", msg.text);
      if (msg.html) console.log("[mailer:log] HTML:\n", msg.html);
      return { messageId: "logged-" + Date.now() };
    },
  };
}

async function getTransporter(): Promise<any> {
  if (!transporter) transporter = await buildTransport();
  return transporter!;
}

export async function sendEmail(opts: SendEmailOpts) {
  const tx = await getTransporter();
  const to = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;
  const mail = {
    from: MAIL_FROM,
    to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  };
  return tx.sendMail(mail);
}

export async function sendMagicLinkEmail(toEmail: string, link: string) {
  const subject = "Your secure sign-in link • Juice Junkiez Garage";
  const text = `Tap this link to sign in: ${link}\n\nLink expires in 15 minutes. If you didn't request it, ignore this message.`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2>Sign in to Juice Junkiez Garage</h2>
      <p><a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#111;color:#fff;text-decoration:none">Sign in</a></p>
      <p>Or paste this link in your browser:</p>
      <p><code>${link}</code></p>
      <p style="color:#666">This link expires in 15 minutes.</p>
    </div>
  `;
  return sendEmail({ to: toEmail, subject, text, html });
}