export const STORAGE_AGENT = "valbox:preferred-agent-id";
export const STORAGE_AUTO_LOCK = "valbox:auto-lock-enabled";

export function readPreferredAgentId(): string {
  try {
    return localStorage.getItem(STORAGE_AGENT) || "";
  } catch {
    return "";
  }
}

export function writePreferredAgentId(id: string) {
  try {
    localStorage.setItem(STORAGE_AGENT, id);
  } catch {
    // ignore
  }
}

export function readAutoLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_AUTO_LOCK) === "1";
  } catch {
    return false;
  }
}

export function writeAutoLockEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_AUTO_LOCK, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}
