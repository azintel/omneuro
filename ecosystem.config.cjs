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
        AWS_REGION: 'us-east-2'
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
        AWS_REGION: 'us-east-2',
        OMNEURO_OPENAI_API_KEY_PARAM: '/omneuro/prod/openai/api_key'
      },
    },
  ],
};