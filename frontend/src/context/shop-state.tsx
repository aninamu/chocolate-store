"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { CartLine } from "@/lib/types";

const CART_KEY = "cs.cart.v1";
const SAVED_KEY = "cs.saved.v1";
export const MAX_CART_QUANTITY = 99;

type ShopState = {
  cart: CartLine[];
  saved: string[];
  isReady: boolean;
  setQty: (chocolateId: string, quantity: number) => void;
  addToCart: (chocolateId: string, quantity?: number) => void;
  removeFromCart: (chocolateId: string) => void;
  clearCart: () => void;
  toggleSaved: (chocolateId: string) => void;
  isSaved: (id: string) => boolean;
};

const ShopContext = createContext<ShopState | null>(null);

function readLocal(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const r = localStorage.getItem(key);
    if (r) return JSON.parse(r) as unknown;
  } catch {
    // ignore
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCartQuantity(quantity: unknown): number {
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) return 0;
  return Math.min(MAX_CART_QUANTITY, Math.max(0, Math.floor(quantity)));
}

function readCart(): CartLine[] {
  const value = readLocal(CART_KEY);
  if (!Array.isArray(value)) return [];

  return value.flatMap((line): CartLine[] => {
    if (!isRecord(line) || typeof line.chocolateId !== "string") return [];
    const quantity = normalizeCartQuantity(line.quantity);
    return quantity > 0 ? [{ chocolateId: line.chocolateId, quantity }] : [];
  });
}

function readSaved(): string[] {
  const value = readLocal(SAVED_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string");
}

function writeLocal<T>(key: string, v: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(v));
  // Defer custom event: avoids same-tab storage sync running inside a setState updater (React 19 strict double-invoke).
  queueMicrotask(() => {
    window.dispatchEvent(new Event("chocolate-store-storage"));
  });
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setCart(readCart());
    setSaved(readSaved());
    setIsReady(true);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== CART_KEY && e.key !== SAVED_KEY) return;
      if (e.key === CART_KEY) setCart(readCart());
      if (e.key === SAVED_KEY) setSaved(readSaved());
    };
    const onCustom = () => {
      setCart(readCart());
      setSaved(readSaved());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("chocolate-store-storage", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("chocolate-store-storage", onCustom);
    };
  }, []);

  const setQty = useCallback((chocolateId: string, quantity: number) => {
    setCart((prev) => {
      const index = prev.findIndex((l) => l.chocolateId === chocolateId);
      const nextQuantity = normalizeCartQuantity(quantity);
      let next: CartLine[] = prev;

      if (index === -1) {
        next =
          nextQuantity <= 0
            ? prev
            : [...prev, { chocolateId, quantity: nextQuantity }];
      } else if (nextQuantity <= 0) {
        next = prev.filter((_, i) => i !== index);
      } else {
        next = prev.map((line, i) =>
          i === index ? { ...line, quantity: nextQuantity } : line
        );
      }

      writeLocal(CART_KEY, next);
      return next;
    });
  }, []);

  const addToCart = useCallback(
    (chocolateId: string, quantity = 1) => {
      setCart((prev) => {
        const index = prev.findIndex((l) => l.chocolateId === chocolateId);
        if (!Number.isFinite(quantity)) return prev;
        let next: CartLine[] = prev;

        if (index === -1) {
          const nextQuantity = normalizeCartQuantity(quantity);
          next =
            nextQuantity <= 0
              ? prev
              : [...prev, { chocolateId, quantity: nextQuantity }];
        } else {
          const q = Math.floor(prev[index].quantity + quantity);
          if (q <= 0) {
            next = prev.filter((_, i) => i !== index);
          } else {
            const nextQuantity = normalizeCartQuantity(q);
            next = prev.map((line, i) =>
              i === index ? { ...line, quantity: nextQuantity } : line
            );
          }
        }

        writeLocal(CART_KEY, next);
        return next;
      });
    },
    []
  );

  const removeFromCart = useCallback((chocolateId: string) => {
    setCart((prev) => {
      const next = prev.filter((l) => l.chocolateId !== chocolateId);
      writeLocal(CART_KEY, next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    writeLocal(CART_KEY, [] as CartLine[]);
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      writeLocal(SAVED_KEY, next);
      return next;
    });
  }, []);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  const value = useMemo<ShopState>(
    () => ({
      cart,
      saved,
      isReady,
      setQty,
      addToCart,
      removeFromCart,
      clearCart,
      toggleSaved,
      isSaved,
    }),
    [
      cart,
      saved,
      isReady,
      setQty,
      addToCart,
      removeFromCart,
      clearCart,
      toggleSaved,
      isSaved,
    ]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const v = useContext(ShopContext);
  if (!v) throw new Error("useShop must be used under ShopProvider");
  return v;
}
