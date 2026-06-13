export interface ValboxDesktopBridge {
  isDesktop: boolean;
  minimize: () => void;
  close: () => void;
  dragStart?: () => void;
}

declare global {
  interface Window {
    valboxDesktop?: ValboxDesktopBridge;
    valcnDesktop?: ValboxDesktopBridge;
  }
}

function getBridge(): ValboxDesktopBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.valboxDesktop || window.valcnDesktop;
}

function getControlBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_VALBOX_CONTROL_URL?.trim() ||
    "http://127.0.0.1:17890/window";
  return raw.split("?")[0];
}

export function isDesktopShell(): boolean {
  return !!getBridge()?.isDesktop || isElectronShellEnv();
}

export function isElectronShellEnv(): boolean {
  return process.env.NEXT_PUBLIC_ELECTRON_SHELL === "1";
}

function pingControl(action: "minimize" | "close"): void {
  if (!isElectronShellEnv()) return;
  const url = `${getControlBaseUrl()}?action=${action}&_=${Date.now()}`;
  try {
    void fetch(url, { method: "GET", cache: "no-store", mode: "cors" });
  } catch {
    // ignore
  }
  try {
    const img = new Image();
    img.src = url;
  } catch {
    // ignore
  }
}

export function minimizeDesktopWindow(): void {
  getBridge()?.minimize?.();
  pingControl("minimize");
}

export function closeDesktopWindow(): void {
  getBridge()?.close?.();
  pingControl("close");
}

export function startDesktopWindowDrag(): void {
  getBridge()?.dragStart?.();
}
