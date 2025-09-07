// apps/tech-gateway/src/lib/blog.ts
// Blog storage + publish-to-S3 + sitemap writer (no google monoliths)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import db from "../db.js";

// -------- ENV (typed in src/types/env.d.ts) --------
const BLOG_S3_BUCKET = process.env.BLOG_S3_BUCKET || "";
const BLOG_BASE_URL = (process.env.BLOG_BASE_URL || "").replace(/\/+$/, "");
const BLOG_SITEMAP_KEY = process.env.BLOG_SITEMAP_KEY || "blog/sitemap.xml";
const AWS_REGION = process.env.BLOG_AWS_REGION || process.env.AWS_REGION || "us-east-2";

function need(name: string, val: string) {
  if (!val) throw new Error(`Missing required env ${name}`);
}
need("BLOG_S3_BUCKET", BLOG_S3_BUCKET);
need("BLOG_BASE_URL", BLOG_BASE_URL);

const s3 = new S3Client({ region: AWS_REGION });

// -------- DB bootstrap (create-if-missing) --------
db.exec(`
CREATE TABLE IF NOT EXISTS blog_posts (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  html          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft|published
  keywords_csv  TEXT,
  links_json    TEXT,
  author_email  TEXT,
  s3_key        TEXT,
  url           TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  published_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
`);

// -------- tiny helpers --------
function logEvent(actor: string, type: string, json: any) {
  try {
    db.prepare(
      `INSERT INTO events (id, ts, actor, type, json) VALUES (?,?,?,?,?)`
    ).run(nid(), Date.now(), actor, type, JSON.stringify(json));
  } catch { /* best-effort */ }
}

function nid(): string {
  try {
    return (db as any).nid ? (db as any).nid() : "n_" + Math.random().toString(36).slice(2, 10);
  } catch {
    return "n_" + Math.random().toString(36).slice(2, 10);
  }
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return base || "post-" + Date.now();
}

function ensureUniqueSlug(base: string): string {
  let s = base, i = 1;
  while (db.prepare(`SELECT 1 FROM blog_posts WHERE slug=?`).get(s)) {
    s = `${base}-${++i}`;
  }
  return s;
}

function toCsv(arr: unknown): string | null {
  if (!Array.isArray(arr)) return null;
  const vals = arr.map(x => String(x)).filter(Boolean);
  return vals.length ? vals.join(",") : null;
}
function toJsonArray(arr: unknown): string | null {
  if (!Array.isArray(arr)) return null;
  const vals = arr.map(x => String(x)).filter(Boolean);
  return vals.length ? JSON.stringify(vals) : null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;"
  );
}
function yyyymm(d = new Date()) {
  return { y: d.getUTCFullYear(), m: String(d.getUTCMonth() + 1).padStart(2, "0") };
}

// -------- types --------
export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  html: string;
  status: "draft" | "published";
  keywords_csv?: string | null;
  links_json?: string | null;
  author_email?: string | null;
  s3_key?: string | null;
  url?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

// -------- core API --------
export function createDraft(params: {
  title: string;
  html: string;
  keywords?: (string[] | unknown[]) | undefined;   // exactOptionalPropertyTypes-safe
  links?: (string[] | unknown[]) | undefined;      // exactOptionalPropertyTypes-safe
  author_email?: string | undefined;               // exactOptionalPropertyTypes-safe
}): BlogPostRow {
  const id = nid();
  const title = String(params.title || "").trim(); if (!title) throw new Error("title required");
  const html = String(params.html || "").trim();   if (!html)  throw new Error("html required");

  const slug = ensureUniqueSlug(slugify(title));
  const keywords_csv = toCsv(params.keywords);
  const links_json = toJsonArray(params.links);

  db.prepare(`
    INSERT INTO blog_posts (id, slug, title, html, status, keywords_csv, links_json, author_email)
    VALUES (?,?,?,?, 'draft', ?, ?, ?)
  `).run(id, slug, title, html, keywords_csv, links_json, params.author_email ?? null);

  const row = db.prepare(`SELECT * FROM blog_posts WHERE id=?`).get(id) as BlogPostRow;
  logEvent("tech-portal", "blog.draft.create", { id, slug, title });
  return row;
}

export function listDrafts(): BlogPostRow[] {
  return db.prepare(`SELECT * FROM blog_posts WHERE status='draft' ORDER BY created_at DESC`).all() as BlogPostRow[];
}

export function listPublished(): BlogPostRow[] {
  return db.prepare(`SELECT * FROM blog_posts WHERE status='published' ORDER BY published_at DESC`).all() as BlogPostRow[];
}

export function getBySlug(slug: string): BlogPostRow | undefined {
  return db.prepare(`SELECT * FROM blog_posts WHERE slug=?`).get(String(slug)) as BlogPostRow | undefined;
}

// -------- rendering + publish --------
function htmlDoc({ title, contentHtml, canonicalUrl, keywords, links }: {
  title: string;
  contentHtml: string;
  canonicalUrl: string;
  keywords?: string[];
  links?: string[];
}): string {
  const metaKeywords = (keywords && keywords.length) ? `<meta name="keywords" content="${keywords.join(",")}">` : "";
  const outlinks = (links || []).map(u => `<li><a href="${u}" rel="nofollow noopener">${u}</a></li>`).join("");
  const linksBlock = outlinks ? `<aside><h3>Related links</h3><ul>${outlinks}</ul></aside>` : "";

  const iso = new Date().toISOString();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    datePublished: iso,
    dateModified: iso,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl
  };

  return [
    "<!doctype html>",
    `<html lang="en"><head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<title>${escapeHtml(title)} | Blog</title>`,
    metaKeywords,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    `<style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 40px auto; max-width: 800px; line-height: 1.6; padding: 0 16px; }
      header { margin-bottom: 24px; }
      h1 { font-size: 2rem; margin: 0 0 8px; }
      article img { max-width: 100%; height: auto; }
      aside { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; }
      footer { margin-top: 40px; color: #666; font-size: .9rem; }
    </style>`,
    `</head><body>`,
    `<header><a href="${BLOG_BASE_URL}/blog" style="text-decoration:none">← Blog</a></header>`,
    `<article><h1>${escapeHtml(title)}</h1>${contentHtml}</article>`,
    linksBlock,
    `<footer>© ${new Date().getFullYear()} Omneuro</footer>`,
    `</body></html>`
  ].join("");
}

export async function publishByIdOrSlug(idOrSlug: { id?: string; slug?: string }) {
  const row = idOrSlug.id
    ? (db.prepare(`SELECT * FROM blog_posts WHERE id=?`).get(idOrSlug.id) as BlogPostRow | undefined)
    : (db.prepare(`SELECT * FROM blog_posts WHERE slug=?`).get(String(idOrSlug.slug)) as BlogPostRow | undefined);

  if (!row) throw new Error("post_not_found");
  if (row.status === "published" && row.url && row.s3_key) return row; // idempotent

  const { y, m } = yyyymm();
  const sKey = `blog/${y}/${m}/${row.slug}/index.html`;
  const url = `${BLOG_BASE_URL}/${sKey.replace(/index\.html$/, "")}`;

  const htmlOut = htmlDoc({
    title: row.title,
    contentHtml: row.html,
    canonicalUrl: url,
    keywords: (row.keywords_csv || "").split(",").filter(Boolean),
    links: safeParseArray(row.links_json)
  });

  await s3.send(new PutObjectCommand({
    Bucket: BLOG_S3_BUCKET,
    Key: sKey,
    Body: Buffer.from(htmlOut, "utf8"),
    ContentType: "text/html; charset=utf-8",
    CacheControl: "public, max-age=300"
  }));

  db.prepare(`
    UPDATE blog_posts
    SET status='published',
        s3_key=?,
        url=?,
        published_at=datetime('now'),
        updated_at=datetime('now')
    WHERE id=?
  `).run(sKey, url, row.id);

  await writeSitemap();

  const updated = db.prepare(`SELECT * FROM blog_posts WHERE id=?`).get(row.id) as BlogPostRow;
  logEvent("tech-portal", "blog.publish", { id: row.id, slug: row.slug, url });
  return updated;
}

// -------- sitemap --------
function safeParseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
function sitemapXml(urls: Array<{ loc: string; lastmod?: string }>): string {
  const items = urls.map(u =>
    `<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
         `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}
async function writeSitemap() {
  const posts = listPublished();
  const urls = posts.map(p => ({
    loc: p.url!,
    lastmod: (p.published_at || p.updated_at || "").replace(" ", "T") + "Z"
  }));
  const xml = sitemapXml(urls);
  await s3.send(new PutObjectCommand({
    Bucket: BLOG_S3_BUCKET,
    Key: BLOG_SITEMAP_KEY,
    Body: Buffer.from(xml, "utf8"),
    ContentType: "application/xml",
    CacheControl: "public, max-age=300"
  }));
}