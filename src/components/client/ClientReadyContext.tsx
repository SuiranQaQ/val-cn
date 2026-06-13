"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ClientMePayload {
  ready?: boolean;
  token_ready?: boolean;
  account_pending?: boolean;
  waiting_game?: boolean;
  message?: string;
  display_name?: string;
  game_name?: string;
  tag_line?: string;
  subject?: string;
  game_running?: boolean;
  account_level?: number;
  player_card_icon?: string;
  player_card_wide?: string;
  error?: string;
}

interface ClientReadyContextValue {
  me: ClientMePayload | null;
  loading: boolean;
  ready: boolean;
  refresh: () => void;
}

const ClientReadyContext = createContext<ClientReadyContextValue | null>(null);

const FETCH_TIMEOUT_MS = 8_000;
const ME_CACHE_KEY = "valbox_me_cache";

function readMeCache(): ClientMePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientMePayload;
  } catch {
    return null;
  }
}

function writeMeCache(data: ClientMePayload) {
  try {
    sessionStorage.setItem(ME_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function isReadyPayload(data: ClientMePayload | null): boolean {
  return !!(data?.ready || data?.token_ready);
}

export function ClientReadyProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<ClientMePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const cacheHydrated = useRef(false);

  useLayoutEffect(() => {
    if (cacheHydrated.current) return;
    cacheHydrated.current = true;
    const cached = readMeCache();
    if (isReadyPayload(cached)) {
      setMe(cached);
      setLoading(false);
      hasLoaded.current = true;
    }
  }, []);

  const refresh = useCallback(async (isPoll = false) => {
    if (!isPoll && !hasLoaded.current) setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await res.json()) as ClientMePayload;

      if (res.ok) {
        setMe(data);
        writeMeCache(data);
      } else if (!isPoll || !hasLoaded.current) {
        const payload = {
          ready: false,
          message:
            data.error === "client_only"
              ? "客户端模式未生效，请重启 VALBOX"
              : data.message || "无法连接本地服务",
        };
        setMe(payload);
      }
    } catch (err) {
      const timedOut =
        err instanceof DOMException && err.name === "AbortError";
      const message = timedOut
        ? "连接本地服务超时，请重启 VALBOX"
        : "无法连接本地服务，请确认 VALBOX 已正常启动";

      if (!isPoll || !hasLoaded.current) {
        setMe((prev) =>
          isReadyPayload(prev) ? prev : { ready: false, message },
        );
      }
    } finally {
      clearTimeout(timeout);
      if (!hasLoaded.current) {
        hasLoaded.current = true;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const t = setInterval(() => void refresh(true), 5_000);
    return () => clearInterval(t);
  }, [refresh]);

  const value = useMemo(
    () => ({
      me,
      loading,
      ready: isReadyPayload(me),
      refresh: () => void refresh(false),
    }),
    [me, loading, refresh],
  );

  return (
    <ClientReadyContext.Provider value={value}>
      {children}
    </ClientReadyContext.Provider>
  );
}

export function useClientReady(): ClientReadyContextValue {
  const ctx = useContext(ClientReadyContext);
  if (!ctx) {
    throw new Error("useClientReady must be used within ClientReadyProvider");
  }
  return ctx;
}
