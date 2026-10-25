import { useRef, useState } from "react";
import {
  MapPin,
  Truck,
  ShieldCheck,
  CreditCard,
  LocateFixed,
  LoaderCircle,
  ShoppingBasket,
} from "lucide-react";
import { useApi, useSession } from "@/hooks/use-marketplace";
import { useCartSummary } from "@/hooks/use-hydrated-store";
import { request } from "@/services/api";
import { naira } from "@/lib/format";
import { Field, fieldClass, commandClass, ErrorState } from "./shared";
import type { Product } from "@/types";
export function Checkout() {
  const { data: user } = useSession();
  const { data: config } = useApi<any>("/config");
  const { items, subtotal } = useCartSummary();
  const catalogue = useApi<Product[]>("/products");
  const perishables = (catalogue.data || []).filter(
    (p) => p.perishable && items.some((item) => item.productId === p.id),
  );
  const closed = perishables.filter((p) => p.ordering?.open === false);
  const [deliveryPreference, setDeliveryPreference] = useState("within-2-hours");
  const [createdOrder, setCreatedOrder] = useState<string | null>(null);
  const [zone, setZone] = useState("");
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const fee = config?.zones?.find((z: any) => z.name === zone)?.fee;
  const [locating, setLocating] = useState(false);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-accent text-primary">
            <Truck className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold">Delivery details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tell us where to bring your foodstuff.
            </p>
          </div>
        </div>
        {!user ? (
          <a className="mt-4 inline-block text-primary" href="/login">
            Log in to check out
          </a>
        ) : (
          <form
            className="mt-4 space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || createdOrder) return;
              setError(undefined);
              if (!zone || fee === undefined) {
                setError(new Error("Select an available delivery area."));
                return;
              }
              if (
                !position ||
                !Number.isFinite(position.latitude) ||
                !Number.isFinite(position.longitude)
              ) {
                setError(new Error("Set the delivery coordinates."));
                return;
              }
              setBusy(true);
              try {
                key.current ??= crypto.randomUUID();
                const order = await request("/orders", "POST", {
                  items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
                  address: new FormData(e.currentTarget).get("address"),
                  phone: new FormData(e.currentTarget).get("phone"),
                  instructions: new FormData(e.currentTarget).get("instructions"),
                  zone,
                  idempotencyKey: key.current,
                  deliveryPreference: perishables.length ? deliveryPreference : "standard",
                  ...position,
                });
                setCreatedOrder(order.id);
                const payment = await request(
                  `/payments/${order.payment.reference}/initialize`,
                  "POST",
                  {},
                );
                window.location.assign(payment.url);
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Delivery address">
              <textarea
                name="address"
                autoComplete="street-address"
                placeholder="House number, street, neighbourhood and nearest landmark"
                required
                minLength={10}
                maxLength={500}
                rows={3}
                className={fieldClass}
              />
            </Field>
            <Field label="Phone number">
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="08012345678"
                pattern="(?:0[0-9]{10}|\+234[0-9]{10})"
                title="Use an 11-digit Nigerian number or +234 followed by 10 digits"
                required
                defaultValue={user.phone}
                className={fieldClass}
              />
            </Field>
            <Field label="Delivery area">
              <select
                required
                value={zone}
                onChange={(e) => {
                  setZone(e.target.value);
                }}
                className={fieldClass}
              >
                <option value="">Choose your delivery area</option>
                {config?.zones?.map((z: any) => (
                  <option key={z.name} value={z.name}>
                    {z.name} - {naira(z.fee)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery instructions (optional)">
              <textarea
                name="instructions"
                maxLength={1000}
                rows={2}
                placeholder="Gate colour, directions or how to reach you on arrival"
                className={fieldClass}
              />
            </Field>
            {!!perishables.length && (
              <fieldset className="space-y-3 border-y border-border py-4">
                <legend className="font-semibold">Perishable delivery</legend>
                {perishables.map((p) => (
                  <p key={p.id} className="text-sm">
                    {p.name}: order {p.orderStart || "08:00"}–{p.orderCutoff || "14:00"}, Lagos
                    time. {p.ordering?.open === false ? "Closed for today." : "Ordering open."}
                  </p>
                ))}
                <Field label="Requested delivery time">
                  <select
                    value={deliveryPreference}
                    onChange={(e) => setDeliveryPreference(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="within-1-hour">Within 1 hour of ordering</option>
                    <option value="within-2-hours">Within 2 hours of ordering</option>
                  </select>
                </Field>
                <p className="text-sm text-muted-foreground">
                  Delivery time is a request, subject to store confirmation. Please be available to
                  receive and refrigerate fresh or frozen goods.
                </p>
                {!!closed.length && (
                  <p role="alert" className="text-sm text-destructive">
                    Remove closed items from your cart or return during their ordering hours.
                  </p>
                )}
              </fieldset>
            )}
            <div className="rounded-2xl border border-primary/15 bg-accent/40 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-bold">Delivery pin</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    Use your location only if you are at the delivery address. Otherwise enter the
                    destination coordinates below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={locating || busy}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 text-sm font-semibold text-primary disabled:opacity-50"
                onClick={() => {
                  if (!navigator.geolocation) {
                    setError(
                      new Error(
                        "Your browser does not support location. Enter the delivery coordinates below.",
                      ),
                    );
                    return;
                  }
                  setLocating(true);
                  setError(undefined);
                  navigator.geolocation.getCurrentPosition(
                    (p) => {
                      setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
                      setLocating(false);
                    },
                    () => {
                      setLocating(false);
                      setError(
                        new Error("Location unavailable. Enter the delivery coordinates below."),
                      );
                    },
                    { enableHighAccuracy: true, timeout: 15000 },
                  );
                }}
              >
                {locating ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
                {locating ? "Finding your location..." : "Use my current delivery location"}
              </button>
              {position && (
                <p role="status" className="mt-2 text-xs font-medium text-primary">
                  Delivery pin entered. Check it matches your delivery address.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <input
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  required
                  value={position?.latitude ?? ""}
                  onChange={(e) =>
                    setPosition({
                      latitude: Number(e.target.value),
                      longitude: position?.longitude ?? 0,
                    })
                  }
                  className={fieldClass}
                />
              </Field>
              <Field label="Longitude">
                <input
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  required
                  value={position?.longitude ?? ""}
                  onChange={(e) =>
                    setPosition({
                      longitude: Number(e.target.value),
                      latitude: position?.latitude ?? 0,
                    })
                  }
                  className={fieldClass}
                />
              </Field>
            </div>
            {!config && (
              <p role="status" className="text-sm text-muted-foreground">
                Loading delivery areas and payment options...
              </p>
            )}
            {config && !config.zones?.length && (
              <p role="alert" className="text-sm text-destructive">
                No delivery areas are available yet. Please try again later.
              </p>
            )}
            {config && !config.paymentsConfigured && (
              <p className="text-sm text-destructive">
                Online payments are currently unavailable. Your basket will be kept.
              </p>
            )}
            {!!error && <ErrorState error={error} />}
            {createdOrder && (
              <a href={`/orders?order=${createdOrder}`} className="block text-primary underline">
                View your order or retry payment
              </a>
            )}
            <button
              disabled={
                busy ||
                locating ||
                !!createdOrder ||
                fee === undefined ||
                !config?.paymentsConfigured ||
                !zone ||
                !catalogue.data ||
                catalogue.isError ||
                !!closed.length ||
                !items.length
              }
              className={`${commandClass} w-full`}
            >
              <CreditCard className="size-4" />
              {busy
                ? "Preparing secure payment..."
                : createdOrder
                  ? "Order created - use the link above"
                  : "Continue to secure payment"}
            </button>
            <p className="flex items-center justify-center gap-2 text-center text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0" />
              You will complete payment on Paystack.
            </p>
          </form>
        )}
      </section>
      <aside
        aria-label="Order summary"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:sticky lg:top-52"
      >
        <div className="flex items-center justify-between border-b border-border bg-accent/40 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingBasket className="size-5 text-primary" />
            Your order
          </h2>
          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold">
            {items.reduce((count, item) => count + item.qty, 0)} items
          </span>
        </div>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto px-5">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 py-5">
              <img
                src={item.image}
                alt=""
                className="size-14 shrink-0 rounded-xl bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.qty} &times; {item.unitLabel}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">{naira(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-4 border-t border-border p-5 text-sm">
          <p className="flex justify-between gap-3">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{naira(subtotal)}</span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-muted-foreground">Delivery fee</span>
            <span>{fee === undefined ? "Select an area" : fee === 0 ? "Free" : naira(fee)}</span>
          </p>
          <div className="border-t border-dashed border-border pt-4">
            <p className="flex justify-between gap-3 text-lg font-bold">
              <span>Estimated total</span>
              <span className="text-primary">
                {fee === undefined ? "--" : naira(subtotal + fee)}
              </span>
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {fee === undefined
                ? "Choose a delivery area to see your total."
                : "Final prices and stock are checked before payment."}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t border-border bg-muted/40 p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-xs leading-6 text-muted-foreground">
            Review your address, delivery area and order before continuing.
          </p>
        </div>
      </aside>
    </div>
  );
}
