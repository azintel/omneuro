// ecosystem.config.cjs
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

        // BLOG
        BLOG_S3_BUCKET:  process.env.BLOG_S3_BUCKET  || '',
        BLOG_BASE_URL:   process.env.BLOG_BASE_URL   || '',
        PUBLIC_BLOG_BASE_URL: process.env.PUBLIC_BLOG_BASE_URL || '',
        BLOG_PREFIX:     process.env.BLOG_PREFIX     || 'blog',
        BLOG_AWS_REGION: process.env.BLOG_AWS_REGION || (process.env.AWS_REGION || 'us-east-2'),
        BLOG_SITEMAP_KEY:process.env.BLOG_SITEMAP_KEY|| 'blog/sitemap.xml',

        // Mailer
        MAIL_TRANSPORT: process.env.MAIL_TRANSPORT || 'ses',
        MAIL_FROM: process.env.MAIL_FROM || 'Juice Junkiez <notifications@juicejunkiez.com>',
        MAIL_SES_REGION: process.env.MAIL_SES_REGION || (process.env.AWS_REGION || 'us-east-2'),
        SMTP_HOST: process.env.SMTP_HOST || '',
        SMTP_PORT: process.env.SMTP_PORT || '',
        SMTP_SECURE: process.env.SMTP_SECURE || '',
        SMTP_USER: process.env.SMTP_USER || '',
        SMTP_PASS: process.env.SMTP_PASS || '',

        // Tech Portal (for magic links, etc.)
        PUBLIC_TECH_BASE_URL: process.env.PUBLIC_TECH_BASE_URL || 'https://tech.juicejunkiez.com',

        // === NEW: Google Places Reviews (future feature) ===
        GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || '',
      },
    },
  ],
};