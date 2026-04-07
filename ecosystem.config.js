module.exports = {
  apps: [
    {
      name: 'mini-shopify-backend',
      cwd: '/var/www/mini-shopify/packages/backend',
      script: 'dist/app.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/mini-shopify/error.log',
      out_file: '/var/log/mini-shopify/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    }
  ]
};
