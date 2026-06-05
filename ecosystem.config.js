module.exports = {
  apps: [
    {
      name: 'soultale-api',
      script: 'dist/src/main.js',
      node_args: '-r newrelic',
      cwd: '/home/ubuntu/soultale-services',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
