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

        // OpenAI key path already used elsewhere
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key',

        // Google Service Account JSON (SSM SecureString)
        OMNEURO_GOOGLE_SA_PARAM: '/omneuro/google/sa_json',

        // Spreadsheet ID will be injected from redeploy (exported env)
        SHEETS_SPREADSHEET_ID: process.env.SHEETS_SPREADSHEET_ID || '',
      },
    },
  ],
};