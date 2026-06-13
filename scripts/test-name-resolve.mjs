/**
 * 单次名字解析测试（UTF-8 安全）
 * 用法: node scripts/test-name-resolve.mjs "刚果的区#45595"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const nameTag = process.argv[2] || "刚果的区#45595";
const hash = nameTag.lastIndexOf("#");
const gameName = nameTag.slice(0, hash).trim();
const tagLine = nameTag.slice(hash + 1).trim();
const VALCN = "https://valcn.top";

function sessionFile() {
  return path.join(
    process.env.LOCALAPPDATA || "",
    "VAL-CN",
    "session.json",
  );
}

async function testValcn() {
  console.log("\n=== valcn 队列 ===");
  const statusUrl = `${VALCN}/api/name_resolve_queue/status?${new URLSearchParams({ full_name: nameTag })}`;
  let res = await fetch(statusUrl);
  console.log("status:", res.status, await res.text());

  res = await fetch(`${VALCN}/api/name_resolve_queue/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ full_name: nameTag }),
  });
  console.log("enqueue:", res.status, await res.text());

  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(statusUrl);
    const body = await res.text();
    console.log(`poll ${i + 1}:`, body);
    if (body.includes('"resolved"') || body.includes('"failed"') || body.includes('"unknown"')) break;
  }
}

async function testRiotAccount() {
  console.log("\n=== Riot shared account ===");
  const file = sessionFile();
  if (!fs.existsSync(file)) {
    console.log("无 session.json，跳过");
    return;
  }
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  const headers = {
    Authorization: s.authorization,
    "X-Riot-Entitlements-JWT": s.entitlements_jwt,
    "X-Riot-ClientVersion": s.client_version,
    "X-Riot-ClientPlatform": s.client_platform,
  };
  for (const base of [
    "https://alpha1-shared-redge.val.qq.com",
    "https://shared.val.qq.com",
  ]) {
    const url = `${base}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      console.log(base, "→", res.status, text.slice(0, 200));
    } catch (e) {
      console.log(base, "→ error", e.message);
    }
  }
}

console.log("测试 ID:", nameTag, "| gameName:", gameName, "| tag:", tagLine);
await testValcn();
await testRiotAccount();
