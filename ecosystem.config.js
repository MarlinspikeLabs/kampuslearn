module.exports = {
  apps: [
    {
      name:        'kampuslearn-api',
      script:      'src/app.js',
      cwd:         '/var/www/kampuslearn/backend',
      instances:   1,
      autorestart: true,
      watch:       false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT:     5000
      },
      error_file: '/var/www/kampuslearn/logs/api-error.log',
      out_file:   '/var/www/kampuslearn/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:  true
    },
    {
      name:        'kampuslearn-web',
      script:      'node_modules/next/dist/bin/next',
      args:        'start -p 3001',
      cwd:         '/var/www/kampuslearn/frontend',
      instances:   1,
      autorestart: true,
      watch:       false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: 'http://84.8.134.180/api',
        PORT:     3001
      },
      error_file: '/var/www/kampuslearn/logs/web-error.log',
      out_file:   '/var/www/kampuslearn/logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:  true
    }
  ]
};
