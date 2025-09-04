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

        // SSM-backed config
        AWS_REGION: 'us-east-2',
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key',
        OMNEURO_GOOGLE_SA_PARAM: '/omneuro/google/sa_json',

        // Sheets (fallback/general) — already exported by redeploy
        // SHEETS_SPREADSHEET_ID comes from redeploy (process.env)

        // Scheduler-specific (optional overrides)
        // If set in SSM and exported by redeploy: /omneuro/google/scheduler_spreadsheet_id
        SCHED_SPREADSHEET_ID: process.env.SCHED_SPREADSHEET_ID || '',

        // Google Calendar (target calendar to write events to)
        GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || '',

        // Scheduler time zone for calendar events
        SCHED_TZ: process.env.SCHED_TZ || 'America/New_York',
      },
    },
  ],
};