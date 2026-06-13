const { spawn, spawnSync } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const {
  getAppRoot,
  getNodeBinary,
  getCompanionDir,
  isDevMode,
} = require("./paths");

const WEB_HOST = process.env.HOSTNAME || "127.0.0.1";
const DEFAULT_WEB_PORT = Number(process.env.PORT || 3000);
const CONTROL_PORT = Number(process.env.VALBOX_CONTROL_PORT || 17890);
const CONTROL_ORIGIN = `http://127.0.0.1:${CONTROL_PORT}`;

let webProcess = null;
let companionProcess = null;
let webOrigin = `http://${WEB_HOST}:${DEFAULT_WEB_PORT}`;
/** 本次 VALBOX 是否自己拉起了 web（复用已有服务时为 false） */
let weStartedWeb = false;
let ownedWebPort = null;
/** VALBOX 当前使用的 web 端口（含复用），退出时需释放 */
let managedWebPort = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killPidTree(pid) {
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    // ignore
  }
}

function killChildTree(child) {
  if (!child || child.killed) return;
  killPidTree(child.pid);
}

function killPortListener(port) {
  const pid = findListeningPidOnPort(port);
  if (pid) killPidTree(pid);
}

function getWebOrigin() {
  return webOrigin;
}

function probeDiagnostics(origin, timeoutMs = 4_000) {
  const url = `${origin}/api/diagnostics`;
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve({ ok: res.statusCode === 200, data });
        } catch {
          resolve({ ok: false, data: null });
        }
      });
    });
    req.on("error", () => resolve({ ok: false, data: null }));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ ok: false, data: null });
    });
  });
}

function isPortInUse(port, host) {
  if (findListeningPidOnPort(port)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      resolve(err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    if (host) {
      server.listen(port, host);
    } else {
      server.listen(port);
    }
  });
}

async function isPortBusy(port) {
  if (findListeningPidOnPort(port)) return true;
  if (await isPortInUse(port)) return true;
  if (await isPortInUse(port, WEB_HOST)) return true;
  return false;
}

function findListeningPidOnPort(port) {
  if (process.platform !== "win32") return null;
  try {
    const out = spawnSync("netstat", ["-ano"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const needle = `:${port}`;
    for (const line of out.stdout.split(/\r?\n/)) {
      if (!line.includes("LISTENING") || !line.includes(needle)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) return pid;
    }
  } catch {
    // ignore
  }
  return null;
}

function attachWebLogs(child) {
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[web] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[web] ${chunk}`);
  });
}

function waitForHttp(url, timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`等待服务超时: ${url}`));
          return;
        }
        setTimeout(tick, 500);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    tick();
  });
}

function spawnWebServer(appRoot, port) {
  const nodeBin = getNodeBinary(appRoot);
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: WEB_HOST,
    NODE_ENV: isDevMode() ? "development" : "production",
    NEXT_PUBLIC_APP_MODE: "client",
    NEXT_PUBLIC_ELECTRON_SHELL: "1",
    NEXT_PUBLIC_VALBOX_CONTROL_URL: `${CONTROL_ORIGIN}/window`,
    NEXT_PUBLIC_SITE_URL: "https://valcn.suiran.xyz",
    NEXT_PUBLIC_POOL_SITE_URL: "https://valcn.suiran.xyz",
  };

  if (isDevMode()) {
    const nextBin = path.join(
      appRoot,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next",
    );
    webProcess = spawn(
      nodeBin,
      [nextBin, "dev", "-p", String(port), "-H", WEB_HOST],
      {
        cwd: appRoot,
        env,
        windowsHide: true,
        stdio: "pipe",
      },
    );
  } else {
    const serverJs = path.join(appRoot, "server.js");
    webProcess = spawn(nodeBin, [serverJs], {
      cwd: appRoot,
      env,
      windowsHide: true,
      stdio: "pipe",
    });
  }

  weStartedWeb = true;
  ownedWebPort = port;

  attachWebLogs(webProcess);

  webProcess.on("exit", (code) => {
    if (code && code !== 0) {
      console.error("[web] exited", code);
    }
    webProcess = null;
    weStartedWeb = false;
    ownedWebPort = null;
  });
}

async function startWebServer() {
  const appRoot = getAppRoot();

  for (let offset = 0; offset < 5; offset++) {
    const port = DEFAULT_WEB_PORT + offset;
    const origin = `http://${WEB_HOST}:${port}`;
    const existing = await probeDiagnostics(origin);

    if (existing.ok && existing.data?.app_mode === "client") {
      webOrigin = origin;
      weStartedWeb = false;
      ownedWebPort = null;
      managedWebPort = port;
      console.log("[web] 复用已有 client 服务:", webOrigin);
      return webOrigin;
    }

    const busy = await isPortBusy(port);
    if (busy) {
      if (existing.ok) {
        console.log(
          `[web] ${port} 已被其他 dev 服务占用，尝试 ${port + 1}…`,
        );
        continue;
      }
      const pid = findListeningPidOnPort(port);
      console.warn(
        `[web] ${port} 无响应${pid ? ` (PID ${pid})` : ""}，清理残留进程…`,
      );
      killPortListener(port);
      await sleep(600);
      if (await isPortBusy(port)) {
        console.warn(`[web] ${port} 仍被占用，尝试 ${port + 1}…`);
        continue;
      }
    }

    webOrigin = origin;
    spawnWebServer(appRoot, port);
    managedWebPort = port;
    await waitForHttp(`${webOrigin}/api/diagnostics`);
    console.log("[web] 已启动:", webOrigin);
    return webOrigin;
  }

  const pid = findListeningPidOnPort(DEFAULT_WEB_PORT);
  const hint = pid
    ? `可先结束旧进程：taskkill /PID ${pid} /F`
    : "请关闭占用 3000 端口的程序";
  throw new Error(`无法启动本地 Web 服务（${DEFAULT_WEB_PORT}–${DEFAULT_WEB_PORT + 4} 均被占用）。\n${hint}`);
}

function startCompanion() {
  const appRoot = getAppRoot();
  const nodeBin = getNodeBinary(appRoot);
  const companionDir = getCompanionDir(appRoot);
  const indexMjs = path.join(companionDir, "index.mjs");

  companionProcess = spawn(nodeBin, [indexMjs, "--set-proxy"], {
    cwd: companionDir,
    env: { ...process.env },
    windowsHide: true,
    stdio: "pipe",
  });

  companionProcess.on("exit", () => {
    companionProcess = null;
  });
}

function disableSystemProxy() {
  const appRoot = getAppRoot();
  const nodeBin = getNodeBinary(appRoot);
  const companionDir = getCompanionDir(appRoot);
  try {
    spawnSync(
      nodeBin,
      [
        "--input-type=module",
        "-e",
        "import { disableSystemProxy } from './lib/system-proxy.mjs'; disableSystemProxy();",
      ],
      { cwd: companionDir, windowsHide: true, stdio: "ignore" },
    );
  } catch {
    // ignore
  }
}

function stopAll() {
  disableSystemProxy();

  killChildTree(companionProcess);
  companionProcess = null;

  killChildTree(webProcess);
  webProcess = null;

  const portToFree = ownedWebPort || managedWebPort;
  if (portToFree) {
    killPortListener(portToFree);
  }

  weStartedWeb = false;
  ownedWebPort = null;
  managedWebPort = null;
}

process.on("exit", () => {
  const portToFree = ownedWebPort || managedWebPort;
  if (portToFree) {
    killPortListener(portToFree);
  }
});

module.exports = {
  getWebOrigin,
  DEFAULT_WEB_PORT,
  startWebServer,
  startCompanion,
  stopAll,
};
