import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, Minus, Plus, Star, Store as StoreIcon } from "lucide-react";
import { AppShell } from "@/components/shop/AppShell";
import { ProductGrid } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";
import { q } from "@/services/api";
import { naira } from "@/lib/format";
import { useAddToCart, useIsWished, useToggleWishlist } from "@/hooks/use-hydrated-store";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(q.product(params.id));
    if (!p) throw notFound();
    return { name: p.name, description: p.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — NaijaFresh` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: `${loaderData.name} — NaijaFresh` },
          { property: "og:description", content: loaderData.description },
          { property: "og:type", content: "product" },
          { name: "twitter:card", content: "summary_large_image" },
        ]
      : [{ title: "Product unavailable — NaijaFresh" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <AppShell>
      <p className="py-20 text-center">This product isn't available.</p>
    </AppShell>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(q.product(id));
  const p = data!;
  const [opt, setOpt] = useState(0);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const add = useAddToCart();
  const wished = useIsWished(p.id);
  const toggle = useToggleWishlist();
  const store = null;
  const option = p.options[opt] ?? p.options[0]!;
  const related = useSuspenseQuery(q.products())
    .data.filter((x) => x.categorySlug === p.categorySlug && x.id !== p.id)
    .slice(0, 4);
  return (
    <AppShell>
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <img
            src={p.images[img]}
            alt={p.name}
            className="aspect-square w-full rounded-3xl object-cover"
          />
          <div className="mt-3 flex gap-2">
            {p.images.map((src, i) => (
              <button
                key={i}
                onClick={() => setImg(i)}
                className={`size-16 overflow-hidden rounded-xl border-2 ${i === img ? "border-primary" : "border-transparent"}`}
              >
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{p.name}</h1>
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="size-4 fill-hot text-hot" />
            {p.rating} · {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
          </div>
          <div className="mt-4 font-display text-3xl font-extrabold text-primary-deep">
            {naira(option.price)}
          </div>
          <h2 className="mt-6 text-sm font-semibold">Choose a measure</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.options.map((o, i) => (
              <button
                key={o.label}
                disabled={!o.stock}
                onClick={() => {
                  setOpt(i);
                  setQty(1);
                }}
                className={`rounded-xl border px-4 py-2 text-sm ${i === opt ? "border-primary bg-accent font-semibold" : "border-border bg-card"}`}
              >
                {o.label} · {naira(o.price)}
              </button>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-border bg-card">
              <button
                aria-label="Less"
                className="p-3"
                onClick={() => setQty(Math.max(1, qty - 1))}
              >
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <button
                aria-label="More"
                disabled={qty >= (option.stock ?? 0)}
                className="p-3 disabled:opacity-40"
                onClick={() => setQty(qty + 1)}
              >
                <Plus className="size-4" />
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1"
              disabled={!option.stock || p.ordering?.open === false}
              onClick={() => add(p, option, qty)}
            >
              Add to cart · {naira(option.price * qty)}
            </Button>
            <Button size="icon" variant="outline" aria-label="Save" onClick={() => toggle(p.id)}>
              <Heart className={wished ? "fill-hot text-hot" : ""} />
            </Button>
          </div>
          {p.perishable && <p role="status" className="mt-4 text-sm text-muted-foreground">Perishable goods: order {p.orderStart || "08:00"}–{p.orderCutoff || "14:00"} Lagos time. {p.ordering?.open === false ? "Ordering is closed. Please return during these hours." : "Ordering is open."}</p>}
          <p className="mt-6 text-muted-foreground">{p.description}</p>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex justify-between">
            <h2 className="font-display text-2xl font-bold">You may also need</h2>
            <Link
              to="/shop"
              search={{ category: p.categorySlug }}
              className="text-sm font-semibold text-primary"
            >
              See all
            </Link>
          </div>
          <ProductGrid items={related} />
        </section>
      )}
    </AppShell>
  );
}
