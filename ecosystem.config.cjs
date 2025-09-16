// ecosystem.config.cjs  (paste-over)
module.exports = {
  apps: [
    {
      name: 'brain-api',
      cwd: './apps/brain-api',
      script: 'dist/server.js',
      env: { PORT: 8081, NODE_ENV: 'production' },
    },
    {
      name: 'tech-gateway',
      cwd: './apps/tech-gateway',
      script: 'dist/server.js',
      env: {
        PORT: 8092,
        NODE_ENV: 'production',
        BRAIN_API_URL: 'http://localhost:8081',

        // IDs (from SSM via 04-redeploy.sh)
        SHEETS_SPREADSHEET_ID: process.env.SHEETS_SPREADSHEET_ID || '',
        SCHED_SPREADSHEET_ID: process.env.SCHED_SPREADSHEET_ID || '',
        GOOGLE_CALENDAR_ID:   process.env.GOOGLE_CALENDAR_ID   || '',

        // Scheduler TZ
        SCHED_TZ: process.env.SCHED_TZ || 'America/New_York',

        // BLOG (pass-through from SSM; DO NOT hard-code)
        BLOG_S3_BUCKET:   process.env.BLOG_S3_BUCKET   || '',
        BLOG_BASE_URL:    process.env.BLOG_BASE_URL    || '',   // e.g. https://juicejunkiez.com
        BLOG_AWS_REGION:  process.env.BLOG_AWS_REGION  || (process.env.AWS_REGION || 'us-east-2'),
        BLOG_SITEMAP_KEY: process.env.BLOG_SITEMAP_KEY || 'blog/sitemap.xml',

        // Mailer (from SSM)
        MAIL_TRANSPORT:      process.env.MAIL_TRANSPORT,
        MAIL_FROM:           process.env.MAIL_FROM,
        MAIL_SES_REGION:     process.env.MAIL_SES_REGION,
        SMTP_HOST:           process.env.SMTP_HOST,
        SMTP_PORT:           process.env.SMTP_PORT,
        SMTP_SECURE:         process.env.SMTP_SECURE,
        SMTP_USER:           process.env.SMTP_USER,
        SMTP_PASS:           process.env.SMTP_PASS,

        // Magic-link base
        PUBLIC_TECH_BASE_URL: process.env.PUBLIC_TECH_BASE_URL,

        // AWS/SSM
        AWS_REGION: process.env.AWS_REGION || 'us-east-2',
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key',
        OMNEURO_GOOGLE_SA_PARAM: '/omneuro/google/sa_json'
      },
    },
  ],
};