import {
  disableSystemProxy,
  enableSystemProxy,
  isOurProxyActive,
} from "./lib/system-proxy.mjs";
import { DEFAULT_PORT, SESSION_FILE } from "./lib/paths.mjs";
import { printBanner, startProxy } from "./lib/proxy.mjs";

function parseArgs(argv) {
  return {
    setProxy: argv.includes("--set-proxy"),
    port: (() => {
      const i = argv.indexOf("--port");
      if (i >= 0 && argv[i + 1]) return Number(argv[i + 1]);
      return DEFAULT_PORT;
    })(),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log(`
VAL-CN Companion — 截获国服瓦罗兰特 JWT，写入 session.json

用法:
  node index.mjs [选项]

选项:
  --set-proxy     启用 PAC（仅 Riot 国服 API 走代理，反作弊直连）
  --port <端口>   代理端口，默认 ${DEFAULT_PORT}
  -h, --help      显示帮助

首次:
  cd companion && npm install
  npm run install-ca    # 管理员，安装根证书
  npm start -- --set-proxy

流程:
  1. 启动 Companion
  2. 启动 ACLOS / 瓦罗兰特并进大厅
  3. 看到 [capture] 即已写入 ${SESSION_FILE}
  4. VAL-CN / npm run dev 会自动读该文件
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let proxyEnabledByUs = false;

  if (args.setProxy) {
    try {
      enableSystemProxy(args.port);
      proxyEnabledByUs = true;
      console.log(
        "[system] 已启用 PAC 代理（仅 Riot API，反作弊/遥测直连）→ 127.0.0.1:" +
          args.port,
      );
    } catch (err) {
      console.error("[system] 无法设置系统代理:", err?.message || err);
      process.exit(1);
    }
  } else if (!isOurProxyActive()) {
    console.warn(
      "[warn] 系统代理未指向本程序。游戏流量可能不经过代理，请加 --set-proxy",
    );
  }

  const { port, caPath } = await startProxy({ port: args.port });
  printBanner({
    port,
    caPath,
    sessionFile: SESSION_FILE,
    systemProxy: proxyEnabledByUs,
  });

  const shutdown = () => {
    console.log("\n[exit] 正在退出...");
    if (proxyEnabledByUs) {
      try {
        disableSystemProxy();
        console.log("[system] 系统代理已关闭");
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  if (process.platform === "win32") {
    process.on("SIGBREAK", shutdown);
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
