// apps/tech-gateway/src/types/env.d.ts
// Narrow env typing for blog + S3 so we don’t pull big type trees.
declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;

    // Basic auth guarding /api/*
    BASIC_AUTH_USER?: string;
    BASIC_AUTH_PASS?: string;

    // Repairbot access token (existing chat route)
    TECH_GATEWAY_ACCESS_TOKEN?: string;

    // Blog publishing
    BLOG_S3_BUCKET?: string;     // REQUIRED
    BLOG_BASE_URL?: string;      // REQUIRED e.g., https://juicejunkiez.com
    BLOG_SITEMAP_KEY?: string;   // default: blog/sitemap.xml
    BLOG_AWS_REGION?: string;    // optional override; falls back to AWS_REGION
    AWS_REGION?: string;         // region for S3 client

    // Misc existing
    TAX_RATE?: string;
  }
}
export {};