import fs from "fs";
import httpMitmProxy from "http-mitm-proxy";
import path from "path";
import {
  captureFromEntitlementsBody,
  captureFromOAuthBody,
  captureFromRequestHeaders,
} from "./capture.mjs";
import {
  getLiveTrafficMeta,
  logLiveRequest,
  logLiveResponse,
  LIVE_TRAFFIC_LOG,
  LIVE_SNAPSHOT_DIR,
} from "./live-traffic-log.mjs";
import { CA_CERT_FILE, CERT_DIR, DEFAULT_PORT, ensureAppDir } from "./paths.mjs";
import { readSessionMeta } from "./session-file.mjs";

const { Proxy } = httpMitmProxy;

const responseBuffers = new WeakMap();

function copyCaCert(sslCaDir) {
  const src = path.join(sslCaDir, "certs", "ca.pem");
  if (!fs.existsSync(src)) return null;
  ensureAppDir();
  fs.copyFileSync(src, CA_CERT_FILE);
  return CA_CERT_FILE;
}

function requestUrl(ctx) {
  const host = ctx.clientToProxyRequest.headers.host || "unknown";
  return `https://${host}${ctx.clientToProxyRequest.url || "/"}`;
}

export async function startProxy(options = {}) {
  ensureAppDir();

  const proxy = new Proxy();
  const sslCaDir = CERT_DIR;

  proxy.onError((ctx, err, callback) => {
    const where = ctx?.clientToProxyRequest?.headers?.host || "unknown";
    console.error(`[proxy] error @ ${where}:`, err?.message || err);
    if (typeof callback === "function") callback();
  });

  proxy.onRequest((ctx, callback) => {
    captureFromRequestHeaders(ctx.clientToProxyRequest.headers);
    logLiveRequest({
      host: String(ctx.clientToProxyRequest.headers.host || ""),
      url: String(ctx.clientToProxyRequest.url || ""),
      method: ctx.clientToProxyRequest.method,
    });
    callback();
  });

  proxy.onResponse((ctx, callback) => {
    responseBuffers.set(ctx, []);
    callback();
  });

  proxy.onResponseData((ctx, chunk, callback) => {
    const chunks = responseBuffers.get(ctx) || [];
    chunks.push(chunk);
    responseBuffers.set(ctx, chunks);
    callback(null, chunk);
  });

  proxy.onResponseEnd((ctx, callback) => {
    const chunks = responseBuffers.get(ctx) || [];
    const body = Buffer.concat(chunks).toString("utf8");
    responseBuffers.delete(ctx);

    const host = String(ctx.clientToProxyRequest.headers.host || "");
    const url = String(ctx.clientToProxyRequest.url || "");
    captureFromEntitlementsBody(host, url, body);
    captureFromOAuthBody(host, url, body);
    logLiveResponse({
      host,
      url,
      statusCode: ctx.serverToProxyResponse?.statusCode,
      body,
      method: ctx.clientToProxyRequest.method,
    });
    callback();
  });

  await new Promise((resolve, reject) => {
    proxy.listen(
      {
        host: "127.0.0.1",
        port: options.port || DEFAULT_PORT,
        sslCaDir,
        keepAlive: true,
        forceSNI: true,
      },
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });

  const caPath = copyCaCert(sslCaDir);
  return { proxy, port: options.port || DEFAULT_PORT, caPath };
}

export function printBanner({ port, caPath, sessionFile, systemProxy }) {
  const meta = readSessionMeta();
  console.log("");
  console.log("========================================");
  console.log("  VAL-CN Companion（国服 JWT 捕获）");
  console.log("========================================");
  console.log(`代理监听: 127.0.0.1:${port}`);
  console.log(`会话文件: ${sessionFile}`);
  if (caPath) console.log(`根证书:   ${caPath}`);
  if (systemProxy) console.log("系统代理: 已开启（本程序退出时会关闭）");
  else console.log("系统代理: 未自动开启，请用 --set-proxy 或手动设置");
  if (meta.exists) {
    console.log(`当前会话: 已有 (${meta.updated_at || "未知时间"})`);
  } else {
    console.log("当前会话: 尚无，请启动瓦罗兰特并进大厅");
  }
  const liveMeta = getLiveTrafficMeta();
  console.log(`对局探针: ${LIVE_TRAFFIC_LOG}`);
  console.log(`快照目录: ${LIVE_SNAPSHOT_DIR}`);
  if (liveMeta.snapshot_count > 0) {
    console.log(
      `已捕获快照: ${liveMeta.snapshot_count} 个 (${liveMeta.latest_snapshot_at || ""})`,
    );
  } else {
    console.log("对局快照: 尚无（进选人/对局后会自动记录）");
  }
  console.log("----------------------------------------");
  console.log("首次使用请先安装根证书（管理员 PowerShell）：");
  console.log("  npm run install-ca");
  console.log("然后：先开 Companion → 再开游戏");
  console.log("========================================");
  console.log("");
}
