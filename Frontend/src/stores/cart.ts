import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {tabStorage} from "@/lib/test-tab-session";
import type { CartItem } from "@/types";

interface CartState {
  items: CartItem[];
  drawerOpen: boolean;
  add: (item: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setDrawer: (open: boolean) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      drawerOpen: false,
      add: (item, qty = 1) =>
        set((s) => {
          const key = item.variantId ?? `${item.productId}:${item.unitLabel}`;
          const existing = s.items.find((i) => i.key === key);
          if (existing)
            return { items: s.items.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i)) };
          return { items: [...s.items, { ...item, key, qty }] };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.key !== key)
              : s.items.map((i) => (i.key === key ? { ...i, qty } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
      setDrawer: (drawerOpen) => set({ drawerOpen }),
    }),
    {
      name: "naijafresh-cart",
      storage: createJSONStorage(tabStorage),
      version: 2,
      migrate: () => ({ items: [] }),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.qty * i.price, 0);
