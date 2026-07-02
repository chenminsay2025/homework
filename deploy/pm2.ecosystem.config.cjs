/** PM2 配置：在项目根目录执行 pm2 start deploy/pm2.ecosystem.config.cjs */
const path = require("path");

const root = path.resolve(__dirname, "..");
const backend = path.join(root, "backend");

module.exports = {
  apps: [
    {
      name: "homework-api",
      cwd: backend,
      script: path.join(backend, ".venv", "bin", "uvicorn"),
      args: "app.main:app --host 127.0.0.1 --port 8002",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
