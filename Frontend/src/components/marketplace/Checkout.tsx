import { useRef, useState } from "react";
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
  const perishables = (catalogue.data || []).filter(p => p.perishable && items.some(item => item.productId === p.id));
  const closed = perishables.filter(p => p.ordering?.open === false);
  const [deliveryPreference, setDeliveryPreference] = useState("within-2-hours");
  const [createdOrder, setCreatedOrder] = useState<string | null>(null);
  const [zone, setZone] = useState("");
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const fee = config?.zones.find((z: any) => z.name === zone)?.fee;
  return (
    <section>
      <h2 className="text-xl font-bold">Delivery details</h2>
      {!user ? (
        <a className="mt-4 inline-block text-primary" href="/login">
          Log in to check out
        </a>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(undefined);
            if (!position) {
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
              const payment = await request(`/payments/${order.payment.reference}/initialize`, "POST", {});
              window.location.assign(payment.url);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Delivery address">
            <textarea name="address" required minLength={10} className={fieldClass} />
          </Field>
          <Field label="Phone number">
            <input
              name="phone"
              type="tel"
              required
              defaultValue={user.phone}
              className={fieldClass}
            />
          </Field>
          <Field label="Delivery location">
            <select
              required
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className={fieldClass}
            >
              <option value="">Select location</option>
              {config?.zones.map((z: any) => (
                <option key={z.name}>{z.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Delivery instructions">
            <textarea name="instructions" className={fieldClass} />
          </Field>
          {!!perishables.length && <fieldset className="space-y-3 border-y border-border py-4">
            <legend className="font-semibold">Perishable delivery</legend>
            {perishables.map(p => <p key={p.id} className="text-sm">{p.name}: order {p.orderStart || "08:00"}–{p.orderCutoff || "14:00"}, Lagos time. {p.ordering?.open === false ? "Closed for today." : "Ordering open."}</p>)}
            <Field label="Requested delivery time">
              <select value={deliveryPreference} onChange={e => setDeliveryPreference(e.target.value)} className={fieldClass}>
                <option value="within-1-hour">Within 1 hour of ordering</option>
                <option value="within-2-hours">Within 2 hours of ordering</option>
              </select>
            </Field>
            <p className="text-sm text-muted-foreground">Delivery time is a request, subject to store confirmation. Please be available to receive and refrigerate fresh or frozen goods.</p>
            {!!closed.length && <p role="alert" className="text-sm text-destructive">Remove closed items from your cart or return during their ordering hours.</p>}
          </fieldset>}
          <button
            type="button"
            className="text-sm font-semibold text-primary"
            onClick={() =>
              navigator.geolocation.getCurrentPosition(
                (p) => setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
                () =>
                  setError(
                    new Error("Location unavailable. Enter the delivery coordinates below."),
                  ),
                { enableHighAccuracy: true, timeout: 15000 },
              )
            }
          >
            Use my current delivery location
          </button>
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
          <p className="text-sm">Delivery: {fee === undefined ? "Select location" : naira(fee)}</p>
          <p className="font-bold">Estimated total: {naira(subtotal + (fee ?? 0))}</p>
          {!config?.paymentsConfigured && (
            <p className="text-sm text-destructive">
              Online payments are currently unavailable. Your basket will be kept.
            </p>
          )}
          {!!error && <ErrorState error={error} />}
          {createdOrder && <a href={`/orders?order=${createdOrder}`} className="block text-primary underline">View your order or retry payment</a>}
          <button
            disabled={busy || !config?.paymentsConfigured || !zone || !catalogue.data || catalogue.isError || !!closed.length || !items.length}
            className={`${commandClass} w-full`}
          >
            {busy ? "Preparing secure payment..." : "Continue to secure payment"}
          </button>
        </form>
      )}
    </section>
  );
}
