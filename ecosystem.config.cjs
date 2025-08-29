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
        // IMPORTANT: use the *real* SSM parameter that exists:
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/openai/api_key',
        // Region for SSM:
        AWS_REGION: 'us-east-2',
      },
    },
  ],
};