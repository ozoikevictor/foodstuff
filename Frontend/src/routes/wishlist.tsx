import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ArrowRight } from "lucide-react";
import { PageIntro, ShoppingEmpty } from "@/components/shop/PageIntro";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/shop/AppShell";
import { ProductGrid } from "@/components/shop/ProductCard";
import { useWishlist } from "@/stores/wishlist";
import { useMounted } from "@/hooks/use-hydrated-store";
import { q } from "@/services/api";
import { useSuspenseQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Saved items — NaijaFresh" },
      { name: "description", content: "Foodstuff you've saved for later." },
      { property: "og:title", content: "Saved items — NaijaFresh" },
      { property: "og:description", content: "Foodstuff you've saved for later." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Wishlist,
});

function Wishlist() {
  const ids = useWishlist((s) => s.ids);
  const mounted = useMounted();
  const products = useSuspenseQuery(q.products()).data;
  const items = mounted ? products.filter((p) => ids.includes(p.id)) : [];
  return (
    <AppShell>
      <PageIntro
        eyebrow="Your favourites"
        title="Saved for your next shop"
        description="Keep the foodstuff you love close. Build your favourites and come back whenever your kitchen needs a refill."
      >
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold">
          <Heart className="size-4" />
          {items.length} saved {items.length === 1 ? "item" : "items"}
        </span>
      </PageIntro>
      {items.length ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Your foodstuff wishlist</h2>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              Keep exploring <ArrowRight className="size-4" />
            </Link>
          </div>
          <ProductGrid items={items} />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Tap the heart on an item to remove it from your wishlist.
          </p>
        </>
      ) : (
        <ShoppingEmpty
          icon={<Heart className="size-9" />}
          title="A little room for your favourites"
          description="See something you love? Tap its heart to save it here for your next foodstuff shop."
        >
          <Button asChild>
            <Link to="/shop">
              Find your favourites <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </ShoppingEmpty>
      )}
    </AppShell>
  );
}
