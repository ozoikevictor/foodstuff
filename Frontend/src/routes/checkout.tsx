import {createFileRoute, Link} from "@tanstack/react-router";
import {AppShell} from "@/components/shop/AppShell";
import {Access} from "@/components/marketplace/shared";
import {Checkout} from "@/components/marketplace/Checkout";
import {useCartSummary, useMounted} from "@/hooks/use-hydrated-store";
import {naira} from "@/lib/format";
export const Route = createFileRoute("/checkout")({
  head: () => ({meta:[{title:"Checkout — NaijaFresh"}]}),
  component: CheckoutPage,
});
function CheckoutPage() {
  const {items, subtotal}=useCartSummary();
  const mounted=useMounted();
  return <AppShell><Access role="CUSTOMER">
    <Link to="/cart" className="text-sm font-semibold text-primary">Back to cart</Link>
    <h1 className="mt-4 text-3xl font-bold">Checkout</h1>
    {!mounted ? <p role="status">Loading basket...</p> : !items.length ? <p className="mt-6">Your basket is empty. <Link to="/shop" className="text-primary underline">Continue shopping</Link></p> :
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Checkout />
        <aside className="border-t border-border py-5 lg:border-t-0 lg:border-l lg:pl-6">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 divide-y divide-border">{items.map(item=><li key={item.key} className="flex gap-3 py-3">
            <img src={item.image} alt="" className="size-12 shrink-0 rounded-md object-cover" />
            <div className="min-w-0 flex-1 text-sm"><p>{item.name}</p><p className="text-muted-foreground">{item.qty} × {item.unitLabel}</p></div>
            <span className="text-sm font-semibold">{naira(item.price*item.qty)}</span>
          </li>)}</ul><p className="mt-4 flex justify-between font-semibold"><span>Items total</span><span>{naira(subtotal)}</span></p>
        </aside>
      </div>}
  </Access></AppShell>;
}
