"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { DemoUser } from "@/lib/types";

const STORAGE_KEY = "cs.demoUser.v1";
export const DEFAULT_DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

type DemoUserContextValue = {
  userId: string | null;
  isReady: boolean;
  setUserId: (id: string) => void;
  demoHeaders: () => Record<string, string>;
};

const DemoUserContext = createContext<DemoUserContextValue | null>(null);

export function DemoUserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setUserIdState(stored || DEFAULT_DEMO_USER_ID);
    } catch {
      setUserIdState(DEFAULT_DEMO_USER_ID);
    } finally {
      setIsReady(true);
    }
  }, []);

  const setUserId = useCallback((id: string) => {
    setUserIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore quota errors in demo */
    }
  }, []);

  const demoHeaders = useCallback(() => {
    if (!userId) return {};
    return { "X-Demo-User-Id": userId };
  }, [userId]);

  const value = useMemo(
    () => ({ userId, isReady, setUserId, demoHeaders }),
    [userId, isReady, setUserId, demoHeaders]
  );

  return (
    <DemoUserContext.Provider value={value}>{children}</DemoUserContext.Provider>
  );
}

export function useDemoUser() {
  const ctx = useContext(DemoUserContext);
  if (!ctx) {
    throw new Error("useDemoUser must be used within DemoUserProvider");
  }
  return ctx;
}

export function demoUserLabel(user: DemoUser) {
  return user.name;
}
