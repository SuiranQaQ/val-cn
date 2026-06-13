const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  dialog,
  shell,
  ipcMain,
  screen,
  session,
} = require("electron");
const path = require("path");
const fs = require("fs");
const {
  getAppRoot,
  getCaCertPath,
  getCompanionDir,
  isDevMode,
  clearWindowCommandFile,
} = require("./paths");
const {
  getWebOrigin,
  startWebServer,
  startCompanion,
  stopAll,
} = require("./process-manager");
const {
  startControlServer,
  stopControlServer,
} = require("./control-server");

const APP_NAME = "VALBOX";

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let quitting = false;

/** @type {Map<number, { cursorX: number; cursorY: number; winX: number; winY: number }>} */
const dragStates = new Map();

if (process.platform === "win32") {
  app.setAppUserModelId("xyz.suiran.valbox");
  // Companion 会开系统代理；VALBOX 自身 UI 必须直连 localhost，否则 /api/me 会挂起
  app.commandLine.appendSwitch(
    "proxy-bypass-list",
    "127.0.0.1;localhost;<-loopback>",
  );
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusMainWindow();
  });
}

function getAssetsDir() {
  return path.join(__dirname, "..", "assets");
}

function loadAppIcon() {
  const assets = getAssetsDir();
  const candidates = ["icon.ico", "icon.png", "tray-icon.png"];
  for (const name of candidates) {
    const file = path.join(assets, name);
    if (fs.existsSync(file)) {
      const image = nativeImage.createFromPath(file);
      if (!image.isEmpty()) return image;
    }
  }
  return nativeImage.createEmpty();
}

function buildTrayIcon() {
  const assets = getAssetsDir();
  const candidates = ["tray-icon.png", "icon.png", "icon.ico"];
  for (const name of candidates) {
    const file = path.join(assets, name);
    if (!fs.existsSync(file)) continue;
    const image = nativeImage.createFromPath(file);
    if (image.isEmpty()) continue;
    return image.resize({ width: 16, height: 16, quality: "best" });
  }
  return loadAppIcon().resize({ width: 16, height: 16, quality: "best" });
}

function focusWindowContents() {
  if (!mainWindow) return;
  mainWindow.focus();
  mainWindow.webContents.focus();
}

function scheduleWindowFocus() {
  focusWindowContents();
  setTimeout(focusWindowContents, 30);
  setTimeout(focusWindowContents, 120);
}

function focusMainWindow() {
  if (!mainWindow) return;
  clearWindowCommandFile();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  scheduleWindowFocus();
}

function openUrl(relativePath = "/") {
  const target = `${getWebOrigin()}${relativePath}`;
  if (!mainWindow) {
    shell.openExternal(target);
    return;
  }

  clearWindowCommandFile();
  const current = mainWindow.webContents.getURL().split("?")[0];
  if (current !== target) {
    mainWindow.loadURL(target);
  }
  focusMainWindow();
}

function createTray() {
  const icon = buildTrayIcon();
  tray = new Tray(icon.isEmpty() ? loadAppIcon() : icon);
  tray.setToolTip(APP_NAME);
  const menu = Menu.buildFromTemplate([
    { label: "我的", click: () => openUrl("/") },
    { label: "查战绩", click: () => openUrl("/search") },
    { label: "对局认人", click: () => openUrl("/live") },
    { type: "separator" },
    {
      label: "安装 Companion 证书",
      click: () => {
        const bat = path.join(getCompanionDir(getAppRoot()), "scripts", "install-ca.cmd");
        if (fs.existsSync(bat)) {
          shell.openPath(bat);
        } else {
          dialog.showMessageBox({
            type: "warning",
            title: APP_NAME,
            message: "未找到 install-ca.cmd，请在项目目录手动运行 companion:install-ca",
          });
        }
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("double-click", () => openUrl("/"));
}

function createWindow() {
  const preloadPath = path.resolve(__dirname, "preload.js");
  if (!fs.existsSync(preloadPath)) {
    dialog.showErrorBox(APP_NAME, `缺少 preload：\n${preloadPath}`);
    app.quit();
    return;
  }

  const icon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b1419",
    title: APP_NAME,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.webContents.on("console-message", (event, level, message) => {
    const text =
      typeof message === "string"
        ? message
        : typeof event === "object" && event && "message" in event
          ? String(event.message)
          : "";
    if (text === "__VALBOX_MINIMIZE__") minimizeMainWindow();
    if (text === "__VALBOX_CLOSE__") closeMainWindow();
  });

  mainWindow.on("show", () => {
    clearWindowCommandFile();
    scheduleWindowFocus();
  });

  mainWindow.on("restore", () => {
    scheduleWindowFocus();
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.loadURL(`${getWebOrigin()}/`);

  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

let lastMinimizeAt = 0;
let lastCloseAt = 0;

function minimizeMainWindow() {
  if (!mainWindow) return;
  const now = Date.now();
  if (now - lastMinimizeAt < 500) return;
  lastMinimizeAt = now;
  if (!mainWindow.isMinimized()) mainWindow.minimize();
}

function closeMainWindow() {
  if (!mainWindow) return;
  const now = Date.now();
  if (now - lastCloseAt < 500) return;
  lastCloseAt = now;
  mainWindow.close();
}

async function ensureDirectLocalNetwork() {
  await session.defaultSession.setProxy({ mode: "direct" });
}

async function bootstrap() {
  const appRoot = getAppRoot();
  if (!fs.existsSync(path.join(appRoot, "package.json"))) {
    dialog.showErrorBox(
      APP_NAME,
      `未找到项目目录：\n${appRoot}\n\n请从 val-cn 仓库内运行 desktop。`,
    );
    app.quit();
    return;
  }

  if (!fs.existsSync(getCaCertPath())) {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["继续（稍后安装）", "打开证书安装"],
      defaultId: 1,
      title: "首次使用",
      message: "尚未安装 Companion 根证书",
      detail:
        "国服需安装 MITM 根证书才能捕获 Token。\n\n右键 install-ca.cmd → 以管理员身份运行，或从托盘菜单打开。",
    });
    if (response === 1) {
      const bat = path.join(getCompanionDir(appRoot), "scripts", "install-ca.cmd");
      if (fs.existsSync(bat)) shell.openPath(bat);
    }
  }

  try {
    startCompanion();
    await startWebServer();
    await ensureDirectLocalNetwork();
  } catch (err) {
    dialog.showErrorBox(
      "启动失败",
      `${err instanceof Error ? err.message : String(err)}\n\n可尝试先关闭占用 3000 端口的程序。`,
    );
    stopAll();
    app.quit();
    return;
  }

  startControlServer({
    allowOrigin: getWebOrigin(),
    onMinimize: minimizeMainWindow,
    onClose: closeMainWindow,
  });

  createWindow();
  createTray();
  clearWindowCommandFile();
}

function windowFromEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function minimizeSenderWindow(event) {
  if (event) windowFromEvent(event);
  minimizeMainWindow();
}

function closeSenderWindow(event) {
  if (event) windowFromEvent(event);
  closeMainWindow();
}

ipcMain.on("valbox:minimize-sync", minimizeSenderWindow);
ipcMain.on("valbox:close-sync", closeSenderWindow);

ipcMain.handle("valbox:minimize", (event) => {
  minimizeSenderWindow(event);
});

ipcMain.handle("valbox:close", (event) => {
  closeSenderWindow(event);
});

ipcMain.on("valbox-drag-start", (event) => {
  const win = windowFromEvent(event);
  if (!win) return;
  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = win.getPosition();
  dragStates.set(event.sender.id, {
    cursorX: cursor.x,
    cursorY: cursor.y,
    winX,
    winY,
  });
});

ipcMain.on("valbox-drag-move", (event) => {
  const win = windowFromEvent(event);
  const state = dragStates.get(event.sender.id);
  if (!win || !state) return;
  const cursor = screen.getCursorScreenPoint();
  win.setPosition(
    state.winX + cursor.x - state.cursorX,
    state.winY + cursor.y - state.cursorY,
  );
});

ipcMain.on("valbox-drag-stop", (event) => {
  dragStates.delete(event.sender.id);
});

app.whenReady().then(bootstrap);

app.on("before-quit", () => {
  quitting = true;
  stopControlServer();
  stopAll();
});

app.on("window-all-closed", () => {
  // 托盘常驻
});

app.on("activate", () => {
  if (mainWindow) {
    focusMainWindow();
  } else if (tray) {
    openUrl("/");
  }
});
