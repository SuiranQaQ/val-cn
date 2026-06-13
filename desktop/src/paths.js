const fs = require("fs");
const path = require("path");

/** val-cn 项目根目录（desktop 的上一级） */
function getAppRoot() {
  if (process.env.VALCN_APP_ROOT) {
    return path.resolve(process.env.VALCN_APP_ROOT);
  }
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, "app", "server.js"))) {
    return path.join(process.resourcesPath, "app");
  }
  return path.resolve(__dirname, "..", "..");
}

function getNodeBinary(appRoot) {
  const bundled = path.join(appRoot, "runtime", "node.exe");
  if (fs.existsSync(bundled)) return bundled;
  return process.env.VALCN_NODE || "node";
}

function getCompanionDir(appRoot) {
  return path.join(appRoot, "companion");
}

function getCaCertPath() {
  const localAppData =
    process.env.LOCALAPPDATA ||
    path.join(require("os").homedir(), "AppData", "Local");
  return path.join(localAppData, "VAL-CN", "certs", "val-cn-ca.pem");
}

function getWindowCommandPath() {
  const localAppData =
    process.env.LOCALAPPDATA ||
    path.join(require("os").homedir(), "AppData", "Local");
  return path.join(localAppData, "VAL-CN", "window.cmd");
}

function clearWindowCommandFile() {
  const file = getWindowCommandPath();
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // ignore
  }
}

function readWindowCommand() {
  const file = getWindowCommandPath();
  if (!fs.existsSync(file)) return null;
  let action = "";
  try {
    action = fs.readFileSync(file, "utf8").trim();
    fs.unlinkSync(file);
  } catch {
    return null;
  }
  if (action === "minimize" || action === "close") return action;
  return null;
}

function isDevMode() {
  if (process.env.VALCN_ELECTRON_DEV === "1") return true;
  return !fs.existsSync(path.join(getAppRoot(), "server.js"));
}

module.exports = {
  getAppRoot,
  getNodeBinary,
  getCompanionDir,
  getCaCertPath,
  getWindowCommandPath,
  clearWindowCommandFile,
  readWindowCommand,
  isDevMode,
};
