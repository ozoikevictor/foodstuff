import { useEffect, useState } from "react";
import { useCart, cartCount, cartSubtotal } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import { toast } from "sonner";
import type { Product, MeasurementOption } from "@/types";
import { useSession } from "@/hooks/use-marketplace";

function askToLogIn() {
  toast.info("Please log in to save foodstuff or add it to your cart.", {
    action: { label: "Log in", onClick: () => window.location.assign("/login") },
  });
}

/** Avoids SSR/localStorage hydration mismatches: returns false until mounted. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function useCartSummary() {
  const items = useCart((s) => s.items);
  const mounted = useMounted();
  const safe = mounted ? items : [];
  return { items: safe, count: cartCount(safe), subtotal: cartSubtotal(safe) };
}

export function useAddToCart() {
  const add = useCart((s) => s.add);
  const session = useSession();
  return (p: Product, option: MeasurementOption = p.options[0]!, qty = 1, silent = false) => {
    if (!session.data) { askToLogIn(); return false; }
    if (p.ordering?.open === false) { toast.error(`Ordering hours: ${p.ordering.start}–${p.ordering.cutoff} Lagos time.`); return false; }
    const existing = useCart.getState().items.find(i => i.variantId === option.id);
    if (!option.id || !Number.isInteger(qty) || qty < 1 || p.available === false || (option.stock ?? 0) < qty + (existing?.qty ?? 0)) {
      toast.error("This quantity is not available."); return false;
    }
    add({ variantId: option.id, productId: p.id, name: p.name, image: p.images[0] ?? "", unit: option.unit, unitLabel: option.label, price: option.price }, qty);
    if (!silent) toast.success(`${p.name} added`, { description: `${qty} × ${option.label}` });
    return true;
  };
}

export function useToggleWishlist() {
  const session = useSession();
  const toggle = useWishlist((s) => s.toggle);
  return (id: string) => {
    if (!session.data) { askToLogIn(); return false; }
    return toggle(id);
  };
}

export function useIsWished(id: string) {
  const ids = useWishlist((s) => s.ids);
  const mounted = useMounted();
  return mounted && ids.includes(id);
}
