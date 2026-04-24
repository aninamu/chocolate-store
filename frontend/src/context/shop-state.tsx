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

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const r = localStorage.getItem(key);
    if (r) return JSON.parse(r) as T;
  } catch {
    // ignore
  }
  return fallback;
}

function writeLocal<T>(key: string, v: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(v));
  window.dispatchEvent(new Event("chocolate-store-storage"));
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setCart(readLocal<CartLine[]>(CART_KEY, []));
    setSaved(readLocal<string[]>(SAVED_KEY, []));
    setIsReady(true);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== CART_KEY && e.key !== SAVED_KEY) return;
      if (e.key === CART_KEY)
        setCart(readLocal<CartLine[]>(CART_KEY, []));
      if (e.key === SAVED_KEY)
        setSaved(readLocal<string[]>(SAVED_KEY, []));
    };
    const onCustom = () => {
      setCart(readLocal<CartLine[]>(CART_KEY, []));
      setSaved(readLocal<string[]>(SAVED_KEY, []));
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
      const rest = prev.filter((l) => l.chocolateId !== chocolateId);
      const next: CartLine[] =
        quantity <= 0 ? rest : [...rest, { chocolateId, quantity }];
      writeLocal(CART_KEY, next);
      return next;
    });
  }, []);

  const addToCart = useCallback(
    (chocolateId: string, quantity = 1) => {
      setCart((prev) => {
        const cur = prev.find((l) => l.chocolateId === chocolateId);
        const q = (cur?.quantity ?? 0) + quantity;
        const next: CartLine[] = [
          ...prev.filter((l) => l.chocolateId !== chocolateId),
          { chocolateId, quantity: q },
        ].filter((l) => l.quantity > 0);
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
