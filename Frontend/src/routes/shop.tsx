import { createFileRoute } from "@tanstack/react-router";
import { SwimStore } from "@/components/swim/SwimStore";
import type { ProductFilters } from "@/types";
export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined; category?: string | undefined; sort?: ProductFilters["sort"] | undefined } => ({ q: typeof s["q"] === "string" ? s["q"] : undefined, category: typeof s["category"] === "string" ? s["category"] : undefined, sort: undefined }),
  head: () => ({ meta: [{ title: "Shop swimwear — NaijaFresh Swim" }, { name: "description", content: "Explore one-pieces, bikinis and easy beach cover-ups." }] }),
  component: Shop,
});
function Shop() { const search = Route.useSearch(); return <SwimStore shop initialCategory={search.category ?? "all"} initialQuery={search.q ?? ""} />; }
