module.exports = {
  apps: [
    {
      name: 'mini-shopify-backend',
      cwd: '/Users/yaoyaoledemac/Documents/codes/mini-shopify/packages/backend',
      script: 'dist/app.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/Users/yaoyaoledemac/Documents/codes/mini-shopify/logs/error.log',
      out_file: '/Users/yaoyaoledemac/Documents/codes/mini-shopify/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    }
  ]
};
