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

        // SSM-backed config that should be inherited from the shell at start time
        AWS_REGION: 'us-east-2',
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key',
        OMNEURO_GOOGLE_SA_PARAM: '/omneuro/google/sa_json',

        // DO NOT set SHEETS_SPREADSHEET_ID here; it is exported by redeploy.sh
        // and inherited by PM2 at start/reload.
      },
    },
  ],
};