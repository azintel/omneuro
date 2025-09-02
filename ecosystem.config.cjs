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

        // SSM-backed secrets/params
        AWS_REGION: 'us-east-2',
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key',

        // Sheets wiring: set by redeploy script via --update-env
        // Value comes from SSM param /omneuro/google/sheets/vehicles_id
        SHEETS_SPREADSHEET_ID: process.env.SHEETS_SPREADSHEET_ID || '',

        // Optional: basic auth protecting /api/* (health endpoints are allowlisted)
        BASIC_AUTH_USER: process.env.BASIC_AUTH_USER || '',
        BASIC_AUTH_PASS: process.env.BASIC_AUTH_PASS || '',
      },
    },
  ],
};