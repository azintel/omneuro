// ////ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'brain-api',
      cwd: './apps/brain-api',
      script: 'dist/server.js',
      env: {
        PORT: 8081,
        NODE_ENV: 'production',
      },
    },
    {
      name: 'tech-gateway',
      cwd: './apps/tech-gateway',
      script: 'dist/server.js',
      env: {
        PORT: 8092,
        NODE_ENV: 'production',
        BRAIN_API_URL: 'http://localhost:8081',

        // AWS/SSM
        AWS_REGION: process.env.AWS_REGION || 'us-east-2',
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key',
        OMNEURO_GOOGLE_SA_PARAM: '/omneuro/google/sa_json',

        // IDs (populated by redeploy via SSM; defaults keep app bootable)
        SHEETS_SPREADSHEET_ID: process.env.SHEETS_SPREADSHEET_ID || '',
        SCHED_SPREADSHEET_ID: process.env.SCHED_SPREADSHEET_ID || '',
        GOOGLE_CALENDAR_ID:   process.env.GOOGLE_CALENDAR_ID   || '',

        // Scheduler TZ
        SCHED_TZ: process.env.SCHED_TZ || 'America/New_York',

        // BASIC auth for /api/*
        BASIC_AUTH_USER: process.env.BASIC_AUTH_USER || '',
        BASIC_AUTH_PASS: process.env.BASIC_AUTH_PASS || '',

        // Repairbot gate (required by /api/chat)
        TECH_GATEWAY_ACCESS_TOKEN: process.env.TECH_GATEWAY_ACCESS_TOKEN || '',

        // Public base URLs
        PUBLIC_TECH_BASE_URL: process.env.PUBLIC_TECH_BASE_URL || 'https://tech.juicejunkiez.com',

        // GOOGLE Places (optional)
        GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',

        // BLOG
        BLOG_S3_BUCKET:   process.env.BLOG_S3_BUCKET   || '',
        BLOG_BASE_URL:    (process.env.BLOG_BASE_URL || '').replace(/\/+$/, ''),
        PUBLIC_BLOG_BASE_URL: (process.env.PUBLIC_BLOG_BASE_URL || '').replace(/\/+$/, ''),
        BLOG_PREFIX:      process.env.BLOG_PREFIX      || 'blog',
        BLOG_AWS_REGION:  process.env.BLOG_AWS_REGION  || (process.env.AWS_REGION || 'us-east-2'),
        BLOG_SITEMAP_KEY: process.env.BLOG_SITEMAP_KEY || 'blog/sitemap.xml',

        // STORE (Stripe Checkout)
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
        STORE_SUCCESS_URL: (process.env.STORE_SUCCESS_URL || 'https://juicejunkiez.com/store/?status=success'),
        STORE_CANCEL_URL:  (process.env.STORE_CANCEL_URL  || 'https://juicejunkiez.com/store/?status=cancel'),
      },
    },
  ],
};