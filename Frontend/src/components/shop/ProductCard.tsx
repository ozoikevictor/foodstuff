import { Link } from "@tanstack/react-router";
import { Heart, Plus, Star } from "lucide-react";
import type { Product } from "@/types";
import { naira, discountPct } from "@/lib/format";
import { useAddToCart, useIsWished, useToggleWishlist } from "@/hooks/use-hydrated-store";

export function ProductCard({ p }: { p: Product }) {
  const add = useAddToCart();
  const wished = useIsWished(p.id);
  const toggle = useToggleWishlist();
  const opt = p.options[0]!;
  const off = discountPct(opt.price, p.oldPrice);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Link to="/product/$id" params={{ id: p.id }} className="relative block aspect-square overflow-hidden bg-muted">
        <img src={p.images[0]} alt={p.name} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {off > 0 && <span className="absolute left-2 top-2 rounded-full bg-hot px-2 py-0.5 text-xs font-bold text-hot-foreground">-{off}%</span>}
        {p.stock <= 0 && <span className="absolute bottom-2 left-2 rounded bg-card px-2 py-1 text-xs font-semibold">Out of Stock</span>}
      </Link>
      <button aria-label="Save" onClick={() => toggle(p.id)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-card/90">
        <Heart className={`size-4 ${wished ? "fill-hot text-hot" : "text-muted-foreground"}`} />
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link to="/product/$id" params={{ id: p.id }} className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</Link>
        <span className="text-xs text-muted-foreground">{opt.label}</span>
        {p.perishable && <span className="text-xs text-muted-foreground">{p.ordering?.open === false ? "Orders closed" : "Perishable"} · {p.orderStart || "08:00"}–{p.orderCutoff || "14:00"} Lagos</span>}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="font-display font-bold text-primary-deep">{naira(opt.price)}</div>
            {off > 0 && <div className="text-xs text-muted-foreground line-through">{naira(p.oldPrice!)}</div>}
          </div>
          <button aria-label={`Add ${p.name}`} onClick={() => add(p)} disabled={!opt.stock || p.ordering?.open === false}
            className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  if (!items.length) return <p className="py-12 text-center text-muted-foreground">No products found.</p>;
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}
