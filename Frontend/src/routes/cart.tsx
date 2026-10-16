import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBasket, ArrowRight, ShieldCheck, Truck } from "lucide-react";
import { AppShell } from "@/components/shop/AppShell";
import { Button } from "@/components/ui/button";
import { useCartSummary } from "@/hooks/use-hydrated-store";
import { useCart } from "@/stores/cart";
import { PageIntro, ShoppingEmpty } from "@/components/shop/PageIntro";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — NaijaFresh" },
      { name: "description", content: "Review your foodstuff basket and check out." },
      { property: "og:title", content: "Your cart — NaijaFresh" },
      { property: "og:description", content: "Review your foodstuff basket and check out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, count } = useCartSummary();
  const { setQty, remove } = useCart();
  return (
    <AppShell>
      <PageIntro
        eyebrow="Your market basket"
        title="Fresh picks, all in one place"
        description="A little closer to a well-stocked kitchen. Review your foodstuff and quantities before heading to checkout."
      >
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold">
          <ShoppingBasket className="size-4" />
          {count} {count === 1 ? "item" : "items"} in your basket
        </span>
      </PageIntro>
      {!items.length ? (
        <ShoppingEmpty
          icon={<ShoppingBasket className="size-9" />}
          title="Your next good meal starts here"
          description="Your basket is waiting for fresh vegetables, pantry staples, and all your kitchen favourites."
        >
          <Button asChild>
            <Link to="/shop">
              Start shopping <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </ShoppingEmpty>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Your basket</h2>
              <Link to="/shop" className="text-sm font-semibold text-primary">
                Continue shopping
              </Link>
            </div>
            <ul className="space-y-3">
              {items.map((i) => (
                <li
                  key={i.key}
                  className="flex gap-3 rounded-2xl border border-border bg-card p-3 sm:gap-5 sm:p-5"
                >
                  <img
                    src={i.image}
                    alt={i.name}
                    className="size-20 shrink-0 rounded-xl bg-accent object-cover sm:size-28"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold sm:text-base">{i.name}</h3>
                      <button
                        type="button"
                        aria-label={`Remove ${i.name}`}
                        onClick={() => remove(i.key)}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i.unitLabel} · {naira(i.price)} each
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-xl border border-border bg-background">
                        <button
                          type="button"
                          aria-label={`Decrease ${i.name} quantity`}
                          className="grid size-9 place-items-center rounded-l-xl hover:bg-accent"
                          onClick={() => setQty(i.key, i.qty - 1)}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span
                          aria-live="polite"
                          className="min-w-7 text-center text-sm font-semibold"
                        >
                          {i.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${i.name} quantity`}
                          className="grid size-9 place-items-center rounded-r-xl hover:bg-accent"
                          onClick={() => setQty(i.key, i.qty + 1)}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <strong className="text-sm text-primary-deep sm:text-base">
                        {naira(i.price * i.qty)}
                      </strong>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <aside className="overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-28">
            <div className="border-b border-border bg-accent/50 px-6 py-5">
              <h2 className="text-lg font-bold">Basket summary</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Good food, ready for the next step.
              </p>
            </div>
            <div className="p-6">
              <Row l={`Subtotal (${count} items)`} v={naira(subtotal)} />
              <Row l="Delivery" v="Calculated at checkout" />
              <div className="my-4 border-t border-border" />
              <Row l="Items total" v={naira(subtotal)} bold />
              <p className="mt-2 text-xs text-muted-foreground">
                Final delivery charges are shown before payment.
              </p>
              <Button asChild className="mt-6 min-h-12 w-full rounded-xl">
                <Link to="/checkout">
                  Proceed to checkout <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <div className="mt-5 space-y-3 border-t border-border pt-5 text-xs text-muted-foreground">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="size-4 shrink-0 text-primary" />
                  Secure payment at checkout
                </p>
                <p className="flex items-center gap-2">
                  <Truck className="size-4 shrink-0 text-primary" />
                  Delivery details confirmed at checkout
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
const Row = ({ l, v, bold }: { l: string; v: string; bold?: boolean }) => (
  <div
    className={`flex items-start justify-between gap-4 py-2 ${bold ? "text-lg font-bold" : "text-sm"}`}
  >
    <span className={bold ? "" : "text-muted-foreground"}>{l}</span>
    <span className="text-right">{v}</span>
  </div>
);
