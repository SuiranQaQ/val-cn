/**
 * 生成 Token 池密钥，并可自动写入本机 .env.local 与官网部署片段
 *
 * 用法:
 *   node scripts/generate-pool-secrets.mjs          # 仅打印
 *   node scripts/generate-pool-secrets.mjs --write  # 生成并写入文件
 *   node scripts/generate-pool-secrets.mjs --write --force  # 覆盖已有密钥
 */
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const hex = (n) => randomBytes(n).toString("hex");

const KEYS = {
  encryption: "SESSION_POOL_ENCRYPTION_KEY",
  contribute: "SESSION_POOL_CONTRIBUTE_SECRET",
  read: "SESSION_POOL_READ_SECRET",
};

function readEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
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
    out[key] = val;
  }
  return out;
}

function upsertEnvFile(filePath, updates, { commentPrefix = "" } = {}) {
  let lines = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/)
    : [];

  // 去掉已注释的同名字段行，避免重复
  const keys = new Set(Object.keys(updates));
  lines = lines.filter((line) => {
    const t = line.trim();
    if (!t.startsWith("#")) return true;
    for (const k of keys) {
      if (t.includes(k)) return false;
    }
    return true;
  });

  const pending = new Map(Object.entries(updates));
  const out = [];

  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && pending.has(m[1])) {
      out.push(`${m[1]}=${pending.get(m[1])}`);
      pending.delete(m[1]);
    } else {
      out.push(line);
    }
  }

  if (pending.size) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    if (commentPrefix) out.push(commentPrefix);
    for (const [k, v] of pending) out.push(`${k}=${v}`);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${out.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

function mergeSecrets(existing, force) {
  const enc = existing[KEYS.encryption]?.trim();
  const contrib = existing[KEYS.contribute]?.trim();
  const read = existing[KEYS.read]?.trim();

  if (!force && enc && contrib && read) {
    return {
      [KEYS.encryption]: enc,
      [KEYS.contribute]: contrib,
      [KEYS.read]: read,
      reused: true,
    };
  }

  return {
    [KEYS.encryption]: enc && !force ? enc : hex(32),
    [KEYS.contribute]: contrib && !force ? contrib : hex(24),
    [KEYS.read]: read && !force ? read : hex(24),
    reused: false,
  };
}

function buildServerEnvFragment(secrets) {
  return `# 由 scripts/generate-pool-secrets.mjs --write 生成
# 合并到服务器 /www/val-cn/.env.production 后 pm2 restart val-cn-website --update-env

NEXT_PUBLIC_APP_MODE=website
NEXT_PUBLIC_SITE_URL=https://valcn.suiran.xyz
SESSION_POOL_CONTRIBUTE=true
${KEYS.encryption}=${secrets[KEYS.encryption]}
${KEYS.contribute}=${secrets[KEYS.contribute]}
${KEYS.read}=${secrets[KEYS.read]}
VALCN_FALLBACK=true
RIOT_PD_BASE=https://alpha1-pd-redge.val.qq.com
RIOT_SHARED_BASE=https://alpha1-shared-redge.val.qq.com
`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const write = args.has("--write");
  const force = args.has("--force");

  const localEnvPath = path.join(ROOT, ".env.local");
  const existing = {
    ...readEnvFile(localEnvPath),
    ...readEnvFile(path.join(ROOT, "data", "pool-secrets.env")),
  };

  const merged = mergeSecrets(existing, force);
  const secrets = {
    [KEYS.encryption]: merged[KEYS.encryption],
    [KEYS.contribute]: merged[KEYS.contribute],
    [KEYS.read]: merged[KEYS.read],
  };

  console.log("");
  if (merged.reused) {
    console.log("# 沿用已有密钥（加 --force 可重新生成）");
  } else {
    console.log("# 新生成密钥");
  }
  console.log(`${KEYS.encryption}=${secrets[KEYS.encryption]}`);
  console.log(`${KEYS.contribute}=${secrets[KEYS.contribute]}`);
  console.log(`${KEYS.read}=${secrets[KEYS.read]}`);
  console.log("");

  if (!write) {
    console.log("写入本机与部署文件请运行:");
    console.log("  npm run setup:pool-secrets");
    console.log("");
    return;
  }

  upsertEnvFile(
    localEnvPath,
    { [KEYS.contribute]: secrets[KEYS.contribute] },
    { commentPrefix: "# 老好人模式 · 与官网 SESSION_POOL_CONTRIBUTE_SECRET 相同" },
  );

  const serverFragmentPath = path.join(ROOT, "data", "pool-secrets.env");
  fs.mkdirSync(path.dirname(serverFragmentPath), { recursive: true });
  fs.writeFileSync(serverFragmentPath, buildServerEnvFragment(secrets), "utf8");

  // 备份完整密钥供本机查阅（勿提交 git）
  const vaultPath = path.join(ROOT, "data", "pool-secrets.vault.env");
  fs.writeFileSync(
    vaultPath,
    `${buildServerEnvFragment(secrets)}\n# 客户端贡献密钥（已在 .env.local）\n`,
    "utf8",
  );

  console.log("已写入:");
  console.log(`  ${path.relative(ROOT, localEnvPath)}  → ${KEYS.contribute}`);
  console.log(`  ${path.relative(ROOT, serverFragmentPath)}  → 官网服务器用`);
  console.log("");
  console.log("下一步 — 同步到服务器:");
  console.log("  scp data/pool-secrets.env root@你的服务器:/www/val-cn/.env.production");
  console.log("  ssh root@你的服务器 \"cd /www/val-cn && pm2 restart val-cn-website --update-env\"");
  console.log("");
  console.log("然后重启 VALBOX，老好人模式即可贡献。");
  console.log("");
}

main();
