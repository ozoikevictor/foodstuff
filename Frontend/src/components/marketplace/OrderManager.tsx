import { useEffect, useState } from "react";
import { tabPrivateImage } from "@/lib/test-tab-session";
import { useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Phone,
  Package,
  ChevronRight,
  Navigation,
  Search,
  RefreshCw,
  ReceiptText,
  Truck,
} from "lucide-react";
import { useApi } from "@/hooks/use-marketplace";
import { useCart } from "@/stores/cart";
import { request, api } from "@/services/api";
import { naira } from "@/lib/format";
import { Action, Status, Loading, ErrorState, Field, fieldClass, ImageUpload } from "./shared";
import { DeliveryMap } from "./DeliveryMap";
import { Link, useLocation } from "@tanstack/react-router";
import { OrderOverview, orderDate } from "./OrderOverview";
import { ShoppingEmpty } from "@/components/shop/PageIntro";
const steps = [
  "Order Placed",
  "Payment Confirmed",
  "Order Confirmed",
  "Preparing Your Order",
  "Ready for Dispatch",
  "Rider Assigned",
  "Out for Delivery",
  "Arriving Soon",
  "Rider Marked Delivered",
  "Customer Confirmed Received",
  "Completed",
];
export function OrderManager({
  role = "CUSTOMER",
  deliveryOnly = false,
}: {
  role?: "ADMIN" | "CUSTOMER" | "RIDER";
  deliveryOnly?: boolean;
}) {
  const result = useApi<any[]>("/orders");
  const { data: config } = useApi<any>("/config");
  const { data: users = [] } = useApi<any[]>("/admin/customers", role === "ADMIN");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [gps, setGps] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [riderId, setRiderId] = useState("");
  const [stars, setStars] = useState<Record<string, number>>({
    speed: 5,
    professionalism: 5,
    freshness: 5,
    quality: 5,
    overall: 5,
  });
  const [review, setReview] = useState("");
  const client = useQueryClient();
  const searchString = useLocation({ select: (location) => location.searchStr });
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    setSelected(params.get("order"));
    const reference = params.get("reference");
    if (reference) {
      request(`/payments/${encodeURIComponent(reference)}/verify`, "POST", {})
        .then((r) => {
          setSelected(r.orderId);
          void client.invalidateQueries();
          if (r.status === "paid") useCart.getState().clear();
        })
        .catch((e) => setGpsError(e.message));
    }
  }, [client, searchString]);
  const o = result.data?.find((v) => v.id === selected);
  useEffect(() => {
    setGps(false);
    setNote("");
    setPhoto(undefined);
  }, [selected]);
  useEffect(() => {
    if (!gps || role !== "RIDER" || !o || !["Out for Delivery", "Arriving Soon"].includes(o.status))
      return;
    let inFlight = false;
    let last = 0;
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        if (inFlight || Date.now() - last < 10000) return;
        last = Date.now();
        inFlight = true;
        void request(`/orders/${o.id}/location`, "POST", {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        })
          .catch((e) => setGpsError(e.message))
          .finally(() => {
            inFlight = false;
          });
      },
      (e) => {
        setGpsError(e.message);
        setGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [gps, o?.id, o?.status, role]);
  if (result.isError) return <ErrorState error={result.error} />;
  if (!result.data) return <Loading />;
  const action = (name: string, data: any = {}) => request(`/orders/${o.id}/${name}`, "POST", data);
  const navigateLink = (latitude: number, longitude: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const visibleOrders = result.data.filter(
    (v) =>
      (!filter || v.status === filter) &&
      `${v.id} ${v.items.map((item: any) => item.name).join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (!deliveryOnly ||
        !["Order Placed", "Payment Confirmed", "Order Confirmed", "Preparing Your Order"].includes(
          v.status,
        )),
  );
  return (
    <section>
      {role === "CUSTOMER" && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "Total orders", count: result.data.length, icon: ReceiptText },
            {
              label: "In progress",
              count: result.data.filter(
                (v) => !["Completed", "Cancelled", "Returned"].includes(v.status),
              ).length,
              icon: Truck,
            },
            {
              label: "Completed",
              count: result.data.filter((v) => v.status === "Completed").length,
              icon: Package,
            },
          ].map(({ label, count, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-3 sm:p-5">
              <Icon className="mb-3 size-5 text-primary" />
              <p className="text-2xl font-bold">{count}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {deliveryOnly ? "Deliveries" : role === "CUSTOMER" ? "My orders" : "Orders"}
        </h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Search orders"
              placeholder="Search order ID or item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-w-0 bg-transparent text-sm outline-none"
            />
          </label>
          <button
            type="button"
            aria-label="Refresh orders"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
            className="grid size-11 place-items-center rounded-xl border border-border bg-card disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${result.isFetching ? "animate-spin" : ""}`} />
          </button>
          <select
            aria-label="Filter orders"
            className={`${fieldClass} max-w-xs`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {[...steps, "Cancelled", "Delivery Failed", "Returned", "Disputed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      {gpsError && <ErrorState error={new Error(gpsError)} />}
      {!result.data.length && (
        <ShoppingEmpty
          icon={<Package className="size-9" />}
          title="Your orders will feel at home here"
          description={
            role === "CUSTOMER"
              ? "Once you place your first order, you can follow its delivery and find all the details here."
              : "New orders will appear here when they are placed."
          }
        >
          {role === "CUSTOMER" && (
            <Link
              to="/shop"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Explore fresh foodstuff
            </Link>
          )}
        </ShoppingEmpty>
      )}
      <div className={`grid gap-6 ${o ? "xl:grid-cols-[minmax(280px,1fr)_minmax(0,1.8fr)]" : ""}`}>
        <ul className="space-y-3">
          {result.data.length > 0 && !visibleOrders.length && (
            <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No matching orders. Try another search or status filter.
            </li>
          )}
          {visibleOrders.map((v) => (
            <li key={v.id}>
              <button
                aria-pressed={selected === v.id}
                className={`flex w-full flex-wrap items-start gap-3 rounded-2xl border p-4 text-left transition sm:flex-nowrap sm:p-5 ${selected === v.id ? "border-primary/40 bg-accent/60 shadow-sm" : "border-border bg-card hover:border-primary/30 hover:shadow-sm"}`}
                onClick={() => {
                  setSelected(v.id);
                  window.history.replaceState(
                    null,
                    "",
                    `${window.location.pathname}?order=${v.id}`,
                  );
                }}
              >
                <img
                  src={v.items[0]?.image}
                  alt=""
                  className="size-14 shrink-0 rounded-xl bg-accent object-cover"
                />
                <div className="min-w-0 flex-1 basis-1/2">
                  <p className="break-all text-sm font-semibold">{v.id}</p>
                  <p className="my-1 text-xs text-muted-foreground">{orderDate(v.created_at)}</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {v.items.length} {v.items.length === 1 ? "foodstuff item" : "foodstuff items"}
                  </p>
                  <Status value={v.status} />
                </div>
                <span className="text-sm font-bold">{naira(v.total)}</span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        {o && (
          <div className="min-w-0 rounded-2xl border border-border bg-card p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Order details
                </p>
                <h2 className="break-all text-lg font-bold">{o.id}</h2>
              </div>
              <Status value={o.payment_status} />
            </div>
            <OrderOverview order={o} />
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <ReceiptText className="size-4 text-primary" />
              Items in your order
            </h3>
            <ul className="divide-y divide-border">
              {o.items.map((i: any) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <img
                    src={i.image}
                    alt=""
                    className="size-12 shrink-0 rounded-xl bg-muted object-cover"
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="break-words font-semibold">{i.name}</p>
                    <p className="text-muted-foreground">
                      {i.qty} x {i.label}
                    </p>
                  </div>
                  <strong className="shrink-0 text-sm">{naira(i.price * i.qty)}</strong>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-dashed border-border pt-4 text-sm">
              <span>Items subtotal</span>
              <span>
                {naira(o.items.reduce((sum: number, item: any) => sum + item.price * item.qty, 0))}
              </span>
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span>Delivery</span>
              <span>{naira(o.delivery_fee)}</span>
            </div>
            <div className="mt-3 flex justify-between font-bold">
              <span>Total</span>
              <span>{naira(o.total)}</span>
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4">
              <h3 className="mb-3 text-sm font-bold">Delivery information</h3>
              <p className="flex gap-2 break-words text-sm leading-6">
                <MapPin className="size-4 shrink-0" />
                {o.address}
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" />
                {o.phone}
              </p>
              {o.delivery_preference && o.delivery_preference !== "standard" && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Requested delivery:{" "}
                  {o.delivery_preference === "within-1-hour" ? "within 1 hour" : "within 2 hours"}{" "}
                  of ordering (subject to confirmation).
                </p>
              )}
              {o.instructions && (
                <p className="mt-2 text-sm text-muted-foreground">{o.instructions}</p>
              )}
            </div>
            <div className="my-6 flex flex-wrap gap-2">
              {role === "CUSTOMER" &&
                o.payment_status === "pending" &&
                o.status === "Order Placed" && (
                  <>
                    <Action
                      label="Pay securely with Paystack"
                      onClick={async () => {
                        const r = await request(
                          `/payments/${o.payment.reference}/initialize`,
                          "POST",
                          {},
                        );
                        window.location.assign(r.url);
                      }}
                    />
                    <Action
                      label="Check payment"
                      onClick={async () => {
                        const r = await request(
                          `/payments/${o.payment.reference}/verify`,
                          "POST",
                          {},
                        );
                        if (r.status === "paid") useCart.getState().clear();
                      }}
                    />
                  </>
                )}
              {role !== "RIDER" && ["Order Placed", "Payment Confirmed"].includes(o.status) && (
                <Action
                  label="Cancel order"
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Cancel this order? If payment was already made, refund handling may require support.",
                      )
                    )
                      await action("cancel");
                  }}
                />
              )}
              {role === "ADMIN" &&
                ["Payment Confirmed", "Order Confirmed", "Preparing Your Order"].includes(
                  o.status,
                ) && (
                  <Action
                    label={
                      {
                        "Payment Confirmed": "Confirm order",
                        "Order Confirmed": "Start preparing",
                        "Preparing Your Order": "Ready for dispatch",
                      }[
                        o.status as "Payment Confirmed" | "Order Confirmed" | "Preparing Your Order"
                      ]!
                    }
                    onClick={() =>
                      action("status", {
                        status: {
                          "Payment Confirmed": "Order Confirmed",
                          "Order Confirmed": "Preparing Your Order",
                          "Preparing Your Order": "Ready for Dispatch",
                        }[
                          o.status as
                            "Payment Confirmed" | "Order Confirmed" | "Preparing Your Order"
                        ],
                      })
                    }
                  />
                )}
              {role === "ADMIN" && o.status === "Ready for Dispatch" && (
                <>
                  <select
                    aria-label="Choose rider"
                    value={riderId}
                    onChange={(e) => setRiderId(e.target.value)}
                    className={`${fieldClass} max-w-xs`}
                  >
                    <option value="">Select rider</option>
                    {users
                      .filter((u) => u.role === "RIDER")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                  <Action
                    label="Assign rider"
                    disabled={!riderId}
                    onClick={() => action("assign", { riderId })}
                  />
                </>
              )}
              {role === "ADMIN" && ["Out for Delivery", "Arriving Soon"].includes(o.status) && (
                <Action
                  label="Record failed delivery"
                  onClick={() =>
                    action("status", {
                      status: "Delivery Failed",
                      note: "Delivery failed; follow-up required.",
                    })
                  }
                />
              )}
              {role === "RIDER" &&
                o.status === "Rider Assigned" &&
                o.rider?.assignmentStatus === "assigned" && (
                  <>
                    <Action
                      label="Accept delivery"
                      onClick={() => action("rider", { action: "accept" })}
                    />
                    <Action
                      label="Reject assignment"
                      onClick={() => action("rider", { action: "reject" })}
                    />
                  </>
                )}
              {role === "RIDER" &&
                o.status === "Rider Assigned" &&
                o.rider?.assignmentStatus === "accepted" && (
                  <Action
                    label="Confirm pickup"
                    onClick={() => action("rider", { action: "pickup" })}
                  />
                )}
              {role === "RIDER" &&
                o.rider?.assignmentStatus === "picked_up" &&
                o.status === "Rider Assigned" && (
                  <Action
                    label="Start delivery"
                    onClick={() => action("rider", { action: "start" })}
                  />
                )}
              {role === "RIDER" && config?.pickup && (
                <a
                  className="inline-flex items-center gap-2 p-2 text-sm text-primary"
                  target="_blank"
                  rel="noreferrer"
                  href={navigateLink(config.pickup.latitude, config.pickup.longitude)}
                >
                  <Navigation className="size-4" />
                  Navigate to pickup
                </a>
              )}
              {role === "RIDER" && (
                <a
                  className="inline-flex items-center gap-2 p-2 text-sm text-primary"
                  target="_blank"
                  rel="noreferrer"
                  href={navigateLink(o.latitude, o.longitude)}
                >
                  <Navigation className="size-4" />
                  Navigate to customer
                </a>
              )}
              {role === "RIDER" && o.status === "Out for Delivery" && (
                <Action
                  label="Arriving soon"
                  onClick={() => action("rider", { action: "arriving" })}
                />
              )}
              {o.rider?.phone && role === "CUSTOMER" && (
                <a
                  href={`tel:${o.rider.phone}`}
                  className="flex items-center gap-2 text-sm text-primary"
                >
                  <Phone className="size-4" />
                  Call {o.rider.name}
                </a>
              )}
              {config?.supportPhone && (
                <a
                  href={`tel:${config.supportPhone.replaceAll('"', "")}`}
                  className="p-2 text-sm text-primary"
                >
                  Contact support
                </a>
              )}
            </div>
            {["Out for Delivery", "Arriving Soon"].includes(o.status) && (
              <div className="my-6">
                <h3 className="mb-3 text-lg font-bold">Your food is on the way!</h3>
                <DeliveryMap order={o} pickup={config?.pickup} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {o.location
                    ? `Last rider update: ${o.location.created_at} UTC. Accuracy: ${Math.round(o.location.accuracy)} m.`
                    : "Waiting for an authorized rider location update."}
                </p>
                {role === "RIDER" && (
                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={gps}
                      onChange={(e) => setGps(e.target.checked)}
                    />
                    Share my location while this delivery page is open
                  </label>
                )}
              </div>
            )}
            {role === "RIDER" && ["Out for Delivery", "Arriving Soon"].includes(o.status) && (
              <div className="my-5 space-y-3 border-y border-border py-5">
                <h3 className="font-bold">Delivery evidence</h3>
                <Field label="Delivery notes">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={fieldClass}
                    placeholder="Describe the handover or approved proof method"
                  />
                </Field>
                <ImageUpload onUploaded={setPhoto} />
                {photo && (
                  <img
                    src={tabPrivateImage(photo)}
                    alt="Delivery evidence"
                    className="size-24 rounded-md object-cover"
                  />
                )}
                <Action
                  label="Mark as delivered"
                  disabled={!photo && note.trim().length < 10}
                  onClick={() =>
                    action("rider", { action: "deliver", notes: note, ...(photo ? { photo } : {}) })
                  }
                />
              </div>
            )}
            {role === "CUSTOMER" && o.status === "Rider Marked Delivered" && (
              <div className="my-5 space-y-3 border-y border-border py-5">
                <h3 className="font-bold">Has your order been delivered?</h3>
                <Action label="Yes, I have received my order" onClick={() => action("confirm")} />
                <Field label="Not received? Describe the problem">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Action
                  label="No, report a delivery problem"
                  disabled={note.trim().length < 10}
                  onClick={() => action("dispute", { reason: note })}
                />
              </div>
            )}
            {role === "ADMIN" && o.evidence && (
              <div className="my-5 border-y border-border py-4">
                <h3 className="font-bold">Delivery evidence</h3>
                <p className="mt-2 text-sm">{o.evidence.notes}</p>
                {o.evidence.image && (
                  <a href={tabPrivateImage(o.evidence.image)} target="_blank" rel="noreferrer">
                    <img
                      src={tabPrivateImage(o.evidence.image)}
                      alt="Delivery evidence"
                      className="mt-3 h-32 rounded-md"
                    />
                  </a>
                )}
                <p className="mt-2 text-xs">{orderDate(o.evidence.created_at)}</p>
                {o.confirmations.map((c: any) => (
                  <p key={c.kind} className="mt-2 text-sm">
                    {c.kind.replaceAll("_", " ")}: {c.created_at} UTC
                  </p>
                ))}
              </div>
            )}
            {o.dispute && (
              <div className="my-5 rounded-md bg-red-50 p-4">
                <h3 className="font-bold">Delivery dispute: {o.dispute.status}</h3>
                <p className="mt-2 text-sm">{o.dispute.reason}</p>
                {o.dispute.resolution && <p className="mt-2 text-sm">{o.dispute.resolution}</p>}
                {role === "ADMIN" && o.status === "Disputed" && (
                  <div className="mt-3 space-y-3">
                    <Field label="Audited resolution">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Action
                        label="Resolve as completed"
                        disabled={note.trim().length < 20}
                        onClick={() =>
                          action("resolve", { resolution: note, outcome: "Completed" })
                        }
                      />
                      <Action
                        label="Resolve as returned"
                        disabled={note.trim().length < 20}
                        onClick={() => action("resolve", { resolution: note, outcome: "Returned" })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {role === "CUSTOMER" && o.status === "Completed" && !o.review && (
              <div className="my-5 space-y-3">
                <h3 className="font-bold">Rate your delivery</h3>
                {Object.keys(stars).map((key) => (
                  <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                    <select
                      className={fieldClass}
                      value={stars[key]}
                      onChange={(e) => setStars({ ...stars, [key]: Number(e.target.value) })}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} stars
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
                <Field label="Review (optional)">
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Action
                  label="Submit review"
                  onClick={() => action("review", { ...stars, comment: review })}
                />
              </div>
            )}
            {role === "CUSTOMER" && (
              <Action
                label="Reorder available items"
                onClick={async () => {
                  const products = await api.getProducts();
                  let added = 0;
                  for (const i of o.items) {
                    const p = products.find((p) => p.id === i.product_id);
                    const v = p?.options.find((v) => v.id === i.variant_id);
                    if (p && v && v.id && (v.stock ?? 0) >= i.qty) {
                      useCart.getState().add(
                        {
                          variantId: v.id,
                          productId: p.id,
                          name: p.name,
                          image: p.images[0] || "",
                          unit: v.unit,
                          unitLabel: v.label,
                          price: v.price,
                        },
                        i.qty,
                      );
                      added++;
                    }
                  }
                  if (!added) throw new Error("These items are currently unavailable.");
                  window.location.assign("/cart");
                }}
              />
            )}
            {o.payment?.reference && (
              <p className="mt-5 break-all text-xs text-muted-foreground">
                Payment reference: {o.payment.reference}
              </p>
            )}
            {role === "CUSTOMER" &&
              ["Completed", "Delivery Failed"].includes(o.status) &&
              !o.dispute && (
                <div className="my-5 space-y-3">
                  <Field label="Report a problem">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={fieldClass}
                    />
                  </Field>
                  <Action
                    label="Submit delivery dispute"
                    disabled={note.trim().length < 10}
                    onClick={() => action("dispute", { reason: note })}
                  />
                </div>
              )}
            <h3 className="mb-3 mt-7 font-bold">Order progress</h3>
            <ol className="space-y-5 border-l-2 border-primary/15 pl-5">
              {o.events.map((e: any, i: number) => (
                <li key={i} className="relative text-sm">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-card bg-primary"
                  />
                  <p className="font-semibold">{e.status}</p>
                  <p className="text-xs text-muted-foreground">{orderDate(e.created_at)}</p>
                  {e.note && <p className="mt-1 text-xs">{e.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
