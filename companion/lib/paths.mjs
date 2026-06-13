import fs from "fs";
import os from "os";
import path from "path";

export const APP_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "VAL-CN",
);

export const SESSION_FILE = path.join(APP_DIR, "session.json");
export const CERT_DIR = path.join(APP_DIR, "certs");
export const CA_CERT_FILE = path.join(CERT_DIR, "val-cn-ca.pem");

export const DEFAULT_PORT = Number(process.env.VALCN_COMPANION_PORT || 17888);

export function ensureAppDir() {
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.mkdirSync(CERT_DIR, { recursive: true });
}
