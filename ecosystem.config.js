/**
 * PM2 生态配置文件
 * 用于 PM2 进程管理器部署服务器监控系统
 */

module.exports = {
  apps: [{
    name: 'server-monitor',
    script: './backend/server.js',
    cwd: './',
    
    // 实例配置
    instances: 1,
    exec_mode: 'fork',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    
    // 重启策略
    max_restarts: 10,
    restart_delay: 4000,
    min_uptime: '10s',
    
    // 内存限制
    max_memory_restart: '500M',
    
    // 自动重启
    autorestart: true,
    
    // 监听文件变化重启（开发环境用）
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      '.git',
      'frontend'
    ]
  }],
  
  // 部署配置（可选，用于 pm2 deploy）
  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/server-monitor.git',
      path: '/var/www/server-monitor',
      'post-deploy': 'npm run install:all && pm2 reload ecosystem.config.js --env production'
    }
  }
};
