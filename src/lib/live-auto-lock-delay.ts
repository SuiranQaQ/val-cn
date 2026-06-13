/** 自动锁定随机延迟（降低秒锁特征） */

export const DEFAULT_AUTO_LOCK_DELAY_MIN_MS = 350;
export const DEFAULT_AUTO_LOCK_DELAY_MAX_MS = 950;
export const STORAGE_AUTO_LOCK_DELAY = "valbox:auto-lock-delay-range";

export function readAutoLockDelayRange(): { min: number; max: number } {
  try {
    const raw = localStorage.getItem(STORAGE_AUTO_LOCK_DELAY);
    if (raw) {
      const [a, b] = raw.split(",").map((s) => Number(s.trim()));
      if (Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b > a) {
        return { min: Math.round(a), max: Math.round(b) };
      }
    }
  } catch {
    // ignore
  }
  return {
    min: DEFAULT_AUTO_LOCK_DELAY_MIN_MS,
    max: DEFAULT_AUTO_LOCK_DELAY_MAX_MS,
  };
}

export function pickAutoLockDelayMs(): number {
  const { min, max } = readAutoLockDelayRange();
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function writeAutoLockDelayRange(min: number, max: number) {
  try {
    localStorage.setItem(STORAGE_AUTO_LOCK_DELAY, `${min},${max}`);
  } catch {
    // ignore
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
