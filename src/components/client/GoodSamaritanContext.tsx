"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useGoodSamaritan } from "@/hooks/use-good-samaritan";

type GoodSamaritanContextValue = ReturnType<typeof useGoodSamaritan>;

const GoodSamaritanContext = createContext<GoodSamaritanContextValue | null>(
  null,
);

export function GoodSamaritanProvider({ children }: { children: ReactNode }) {
  const value = useGoodSamaritan();
  return (
    <GoodSamaritanContext.Provider value={value}>
      {children}
    </GoodSamaritanContext.Provider>
  );
}

export function useGoodSamaritanContext(): GoodSamaritanContextValue {
  const ctx = useContext(GoodSamaritanContext);
  if (!ctx) {
    throw new Error(
      "useGoodSamaritanContext must be used within GoodSamaritanProvider",
    );
  }
  return ctx;
}
