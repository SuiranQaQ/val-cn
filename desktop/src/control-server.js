const http = require("http");
const { URL } = require("url");

const CONTROL_HOST = process.env.VALBOX_CONTROL_HOST || "127.0.0.1";
const CONTROL_PORT = Number(process.env.VALBOX_CONTROL_PORT || 17890);

/** @type {http.Server | null} */
let server = null;

function runAction(handlers, action, res) {
  if (action === "minimize") {
    handlers.onMinimize?.();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, action }));
    return true;
  }
  if (action === "close") {
    handlers.onClose?.();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, action }));
    return true;
  }
  return false;
}

/**
 * @param {{ onMinimize?: () => void; onClose?: () => void; allowOrigin?: string }} handlers
 */
function startControlServer(handlers = {}) {
  if (server) return CONTROL_PORT;

  const allowOrigin = handlers.allowOrigin || "*";

  server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const pathname = (req.url || "").split("?")[0];
    if (pathname !== "/window") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    if (req.method === "GET") {
      const action = new URL(req.url || "", "http://local").searchParams
        .get("action")
        ?.trim();
      if (action && runAction(handlers, action, res)) return;
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_action" }));
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024) req.destroy();
    });

    req.on("end", () => {
      let action = "";
      try {
        action = String(JSON.parse(body || "{}").action || "").trim();
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_json" }));
        return;
      }

      if (action && runAction(handlers, action, res)) return;
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_action" }));
    });
  });

  server.listen(CONTROL_PORT, CONTROL_HOST);
  return CONTROL_PORT;
}

function stopControlServer() {
  if (!server) return;
  try {
    server.close();
  } catch {
    // ignore
  }
  server = null;
}

function getControlOrigin() {
  return `http://${CONTROL_HOST}:${CONTROL_PORT}`;
}

module.exports = {
  CONTROL_PORT,
  getControlOrigin,
  startControlServer,
  stopControlServer,
};
