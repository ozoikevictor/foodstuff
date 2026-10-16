import { useEffect } from "react";
import {tabStorage, tabEventsUrl} from "@/lib/test-tab-session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, api } from "@/services/api";
import { useCart } from "@/stores/cart";
import { toast } from "sonner";
import { useMounted } from "@/hooks/use-hydrated-store";
import type { User } from "@/types";
export function useSession() {
  const mounted = useMounted();
  return useQuery({
    queryKey: ["session"],
    queryFn: () => request<User | null>("/auth/me"),
    enabled: mounted,
    staleTime: 30000,
    retry: false,
  });
}
export function useRealtime() {
  const { data: user } = useSession();
  const client = useQueryClient();
  useEffect(() => {
    if (user?.role !== "CUSTOMER") return;
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let saves = Promise.resolve();
    const save = () => {
      const items = useCart
        .getState()
        .items.filter((i) => i.variantId)
        .map((i) => ({ variantId: i.variantId, qty: i.qty }));
      saves = saves
        .then(async () => {
          if (!stopped) await request("/cart", "PUT", items);
        })
        .catch(() => {
          if (!stopped)
            toast.error(
              "Your basket could not be saved to your account. It is still kept on this device.",
            );
        });
    };
    void Promise.all([
      request<Array<{ variantId: string; qty: number }>>("/cart"),
      api.getProducts(),
    ])
      .then(([saved, products]) => {
        if (stopped) return;
        const owner = tabStorage().getItem("naijafresh-cart-owner");
        if (owner && owner !== user.id) useCart.getState().clear();
        for (const i of saved) {
          const p = products.find((p) => p.options.some((v) => v.id === i.variantId));
          const v = p?.options.find((v) => v.id === i.variantId);
          if (
            p &&
            v?.id &&
            !useCart.getState().items.some((item) => item.variantId === v.id) &&
            (v.stock ?? 0) > 0
          )
            useCart
              .getState()
              .add(
                {
                  variantId: v.id,
                  productId: p.id,
                  name: p.name,
                  image: p.images[0] || "",
                  unit: v.unit,
                  unitLabel: v.label,
                  price: v.price,
                },
                Math.min(i.qty, v.stock ?? 0),
              );
        }
        tabStorage().setItem("naijafresh-cart-owner", user.id);
        save();
        unsubscribe = useCart.subscribe((state, previous) => {
          if (state.items !== previous.items) {
            clearTimeout(timer);
            timer = setTimeout(save, 400);
          }
        });
      })
      .catch(() => {
        if (!stopped) toast.error("Could not restore your saved basket.");
      });
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [user?.id, user?.role]);
  useEffect(() => {
    if (!user) return;
    const events = new EventSource(tabEventsUrl());
    const invalidate = () => {
      void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "session" });
    };
    events.addEventListener("change", invalidate);
    return () => events.close();
  }, [user?.id, client]);
}
export function useApi<T = any>(path: string, enabled = true) {
  const mounted = useMounted();
  return useQuery<T>({
    queryKey: ["api", path],
    queryFn: () => request<T>(path),
    enabled: mounted && enabled,
    retry: false,
    refetchInterval: path === "/categories" || path === "/products" || path === "/config" || path.startsWith("/admin/products") || path.startsWith("/admin/recipes") ? false : 60000,
    staleTime: 60000,
  });
}
