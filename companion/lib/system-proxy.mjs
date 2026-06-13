/**
 * Windows 系统代理：默认使用 PAC，仅将 Riot 国服 API 流量导向 Companion。
 * 反作弊 / 遥测 / 其它域名直连，降低被误判为全局 MITM 的风险。
 */
import fs from "fs";
import { execFileSync } from "child_process";
import { APP_DIR, DEFAULT_PORT, ensureAppDir } from "./paths.mjs";

export const PAC_FILENAME = "val-cn-proxy.pac";

function runPs(script) {
  return execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8" },
  ).trim();
}

function pacPath() {
  return `${APP_DIR.replace(/\\/g, "/")}/${PAC_FILENAME}`;
}

function pacFileUrl() {
  return `file:///${pacPath()}`;
}

/** 生成 PAC：仅 proxy 会话/对局所需 host，反作弊等直连 */
export function writePacFile(port = DEFAULT_PORT) {
  ensureAppDir();
  const file = `${APP_DIR}\\${PAC_FILENAME}`;
  const proxy = `127.0.0.1:${port}`;
  const body = `function FindProxyForURL(url, host) {
  if (!host || host === "localhost" || host === "127.0.0.1") return "DIRECT";
  if (isPlainHostName(host)) return "DIRECT";

  if (shExpMatch(host, "*anticheat*")) return "DIRECT";
  if (shExpMatch(url, "*tc-anticheat*")) return "DIRECT";
  if (shExpMatch(url, "*collector*")) return "DIRECT";
  if (shExpMatch(url, "*latency*")) return "DIRECT";
  if (shExpMatch(host, "*ap-public*")) return "DIRECT";

  if (dnsDomainIs(host, ".val.qq.com")) {
    if (shExpMatch(host, "*pd-redge*")) return "PROXY ${proxy}";
    if (shExpMatch(host, "*glz-redge*")) return "PROXY ${proxy}";
    if (shExpMatch(host, "*shared-redge*")) return "PROXY ${proxy}";
    if (shExpMatch(host, "*entitlements*")) return "PROXY ${proxy}";
    return "DIRECT";
  }
  return "DIRECT";
}
`;
  fs.writeFileSync(file, body, "utf8");
  return file;
}

export function getSystemProxyState() {
  if (process.platform !== "win32") {
    return { supported: false, enabled: false, pac: false, server: "" };
  }
  try {
    const out = runPs(
      `$p = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; ` +
        `[pscustomobject]@{ Enable = [int]$p.ProxyEnable; Server = [string]$p.ProxyServer; Pac = [string]$p.AutoConfigURL } | ConvertTo-Json -Compress`,
    );
    const data = JSON.parse(out);
    const pac = String(data.Pac || "");
    return {
      supported: true,
      enabled: Number(data.Enable) === 1 || pac.includes(PAC_FILENAME),
      pac: pac.includes(PAC_FILENAME),
      server: String(data.Server || ""),
      pac_url: pac,
    };
  } catch {
    return { supported: true, enabled: false, pac: false, server: "" };
  }
}

/** PAC 模式（推荐）：仅 Riot API 走代理 */
export function enableSystemProxy(port = DEFAULT_PORT) {
  if (process.platform !== "win32") {
    throw new Error("system_proxy_only_windows");
  }
  writePacFile(port);
  const url = pacFileUrl();
  runPs(
    `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; ` +
      `Set-ItemProperty -Path $p -Name AutoConfigURL -Value '${url}'; ` +
      `Set-ItemProperty -Path $p -Name ProxyEnable -Value 0; ` +
      `Set-ItemProperty -Path $p -Name ProxyServer -Value ''`,
  );
}

export function disableSystemProxy() {
  if (process.platform !== "win32") return;
  runPs(
    `$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; ` +
      `$pac = (Get-ItemProperty -Path $p -ErrorAction SilentlyContinue).AutoConfigURL; ` +
      `if ($pac -like '*${PAC_FILENAME}*') { Set-ItemProperty -Path $p -Name AutoConfigURL -Value '' }; ` +
      `Set-ItemProperty -Path $p -Name ProxyEnable -Value 0`,
  );
}

export function isOurProxyActive() {
  const state = getSystemProxyState();
  return state.pac || (state.enabled && state.server.includes(String(DEFAULT_PORT)));
}
