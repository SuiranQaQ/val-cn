/** PM2 官网：自动合并 .env.production（含 SESSION_POOL_*） */
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const cwd = __dirname;
const fromProduction = loadEnvFile(path.join(cwd, ".env.production"));

module.exports = {
  apps: [
    {
      name: "val-cn-website",
      cwd,
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
        ...fromProduction,
      },
    },
  ],
};
