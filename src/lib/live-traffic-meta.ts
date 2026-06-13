import fs from "fs";
import path from "path";

export interface LiveTrafficMeta {
  log_path: string;
  log_exists: boolean;
  log_bytes: number;
  snapshot_dir: string;
  snapshot_count: number;
  latest_snapshot_at: string | null;
}

function appDir(): string {
  return path.join(
    process.env.LOCALAPPDATA ||
      path.join(process.env.USERPROFILE || "", "AppData", "Local"),
    "VAL-CN",
  );
}

/** 读取 Companion 写入的对局流量探针元数据（不含响应正文） */
export function getLiveTrafficMeta(): LiveTrafficMeta {
  const dir = appDir();
  const logPath = path.join(dir, "live-traffic.log");
  const snapshotDir = path.join(dir, "live-snapshots");

  const meta: LiveTrafficMeta = {
    log_path: logPath,
    log_exists: false,
    log_bytes: 0,
    snapshot_dir: snapshotDir,
    snapshot_count: 0,
    latest_snapshot_at: null,
  };

  try {
    if (fs.existsSync(logPath)) {
      meta.log_exists = true;
      meta.log_bytes = fs.statSync(logPath).size;
    }
    if (fs.existsSync(snapshotDir)) {
      const files = fs
        .readdirSync(snapshotDir)
        .filter((f) => f.endsWith(".json"));
      meta.snapshot_count = files.length;
      if (files.length) {
        const latest = files
          .map((f) => ({
            f,
            m: fs.statSync(path.join(snapshotDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.m - a.m)[0];
        meta.latest_snapshot_at = new Date(latest.m).toISOString();
      }
    }
  } catch {
    // ignore
  }

  return meta;
}
