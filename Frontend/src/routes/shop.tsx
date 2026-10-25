import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppShell } from "@/components/shop/AppShell";
import { ProductGrid } from "@/components/shop/ProductCard";
import { q } from "@/services/api";
import type { ProductFilters } from "@/types";

type S = { q?: string | undefined; category?: string | undefined; sort?: ProductFilters["sort"] | undefined };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): S => ({
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    category: typeof s["category"] === "string" && s["category"] ? s["category"] : undefined,
    sort: ["price-asc", "price-desc", "rating"].includes(s["sort"] as string) ? (s["sort"] as S["sort"]) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => Promise.all([
    context.queryClient.ensureQueryData(q.products(deps)),
    context.queryClient.ensureQueryData(q.categories()),
  ]),
  head: () => ({
    meta: [
      { title: "Shop foodstuff — NaijaFresh" },
      { name: "description", content: "Browse rice, beans, meat, fish, vegetables, spices and wholesale foodstuff." },
      { property: "og:title", content: "Shop foodstuff — NaijaFresh" },
      { property: "og:description", content: "Browse every category of fresh Nigerian foodstuff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const { data: items } = useSuspenseQuery(q.products(search));
  const { data: cats } = useSuspenseQuery(q.categories());
  const set = (patch: Partial<S>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const chip = (active: boolean) => `shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"}`;
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold">Shop</h1>
      <div className="mt-4 flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input defaultValue={search.q ?? ""} onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder="Search rice, ugu, crayfish…" className="h-11 flex-1 bg-transparent outline-none" />
        </label>
        <select value={search.sort ?? ""} onChange={(e) => set({ sort: (e.target.value || undefined) as S["sort"] })}
          className="rounded-xl border border-border bg-card px-3 text-sm">
          <option value="">Relevance</option>
          <option value="price-asc">Price: low–high</option>
          <option value="price-desc">Price: high–low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
      <div className="my-4 flex gap-2 overflow-x-auto pb-1">
        <button className={chip(!search.category)} onClick={() => set({ category: undefined })}>All</button>
        {cats.map((c) => <button key={c.slug} className={chip(search.category === c.slug)} onClick={() => set({ category: c.slug })}>{c.name}</button>)}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{items.length} items</p>
      <ProductGrid items={items} />
    </AppShell>
  );
}
