import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShoppingBasket, Check, MapPin, CreditCard } from "lucide-react";
import { AppShell } from "@/components/shop/AppShell";
import { ShoppingEmpty } from "@/components/shop/PageIntro";
import { Access, Loading } from "@/components/marketplace/shared";
import { Checkout } from "@/components/marketplace/Checkout";
import { useCartSummary, useMounted } from "@/hooks/use-hydrated-store";
export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout - NaijaFresh" }] }),
  component: CheckoutPage,
});
function CheckoutPage() {
  const { items } = useCartSummary();
  const mounted = useMounted();
  return (
    <AppShell>
      <Access role="CUSTOMER">
        <Link
          to="/cart"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to cart
        </Link>
        <header className="mb-7 mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Almost at your doorstep
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Checkout</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              A few final details, then you're ready to pay.
            </p>
          </div>
          <ol
            aria-label="Checkout progress"
            className="flex flex-wrap items-center gap-3 text-xs sm:gap-5"
          >
            <li className="flex items-center gap-2 text-primary">
              <Check className="size-4" />
              Basket
            </li>
            <li
              aria-current="step"
              className="flex items-center gap-2 rounded-full bg-accent px-3 py-2 font-bold text-primary"
            >
              <MapPin className="size-4" />
              Delivery
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="size-4" />
              Payment
            </li>
          </ol>
        </header>
        {!mounted ? (
          <Loading />
        ) : !items.length ? (
          <ShoppingEmpty
            icon={<ShoppingBasket className="size-9" />}
            title="Your basket is empty"
            description="Add your favourite foodstuff before checking out."
          >
            <Link
              to="/shop"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Continue shopping
            </Link>
          </ShoppingEmpty>
        ) : (
          <Checkout />
        )}
      </Access>
    </AppShell>
  );
}
