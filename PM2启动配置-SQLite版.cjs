/**
 * PM2配置文件 - SQLite版规则引擎
 * 使用方法: pm2 start PM2启动配置-SQLite版.js
 */

module.exports = {
  apps: [
    {
      name: 'xiaoliu-rule-engine-v61',
      script: './scripts/core/rule-engine-server.cjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/rule-engine-error.log',
      out_file: './logs/rule-engine-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      }
    }
  ]
};

