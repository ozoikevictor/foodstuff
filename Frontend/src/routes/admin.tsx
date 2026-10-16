import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Tags,
  ChefHat,
  ShoppingBasket,
  Truck,
  Users,
  Bell,
  CreditCard,
  ChartNoAxesCombined,
  Warehouse,
  Settings,
  User,
  Menu,
  X,
} from "lucide-react";
import { useApi } from "@/hooks/use-marketplace";
import { request } from "@/services/api";
import { naira } from "@/lib/format";
import {
  Access,
  Logout,
  Loading,
  ErrorState,
  Field,
  fieldClass,
  commandClass,
  Status,
} from "@/components/marketplace/shared";
import { CatalogManager } from "@/components/marketplace/CatalogManager";
import { Notifications } from "@/components/marketplace/Notifications";
import { OrderManager } from "@/components/marketplace/OrderManager";
import { Profile } from "@/components/marketplace/Profile";
export const Route = createFileRoute("/admin")({ component: Admin });
const sections = [
  ["overview", "Overview", LayoutDashboard],
  ["products", "Products", Package],
  ["categories", "Categories", Tags],
  ["recipes", "Recipes", ChefHat],
  ["orders", "Customer orders", ShoppingBasket],
  ["delivery", "Delivery management", Truck],
  ["customers", "Customers & riders", Users],
  ["notifications", "Notifications", Bell],
  ["payments", "Payments", CreditCard],
  ["analytics", "Sales analytics", ChartNoAxesCombined],
  ["inventory", "Inventory", Warehouse],
  ["settings", "Website settings", Settings],
  ["profile", "Admin profile", User],
] as const;
function Admin() {
  const [section, setSection] = useState("overview");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("section") === "orders")
      setSection("orders");
  }, []);
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useApi<any[]>("/notifications");
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            className="p-2 lg:hidden"
            aria-label="Toggle admin navigation"
            title="Toggle admin navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <a href="/" className="text-xl font-extrabold text-primary-deep">
            Naija<span className="text-hot">Fresh</span>
          </a>
          <span className="hidden border-l border-border pl-4 text-sm text-muted-foreground sm:inline">
            Store management
          </span>
        </div>
        <button
          title="Notifications"
          aria-label="Notifications"
          onClick={() => setSection("notifications")}
          className="relative p-2"
        >
          <Bell className="size-5" />
          {notifications.some((n) => !n.read_at) && (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-hot px-1 text-[9px] font-bold text-white">
              {notifications.filter((n) => !n.read_at).length}
            </span>
          )}
        </button>
      </header>
      <Access role="ADMIN">
        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside
            className={`${open ? "fixed inset-y-16 left-0 z-40 w-64 shadow-xl" : "hidden"} border-r border-border bg-card p-4 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:overflow-y-auto`}
          >
            <nav aria-label="Admin navigation" className="space-y-1">
              {sections.map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSection(key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm ${section === key ? "bg-accent font-semibold text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="mt-6 border-t border-border pt-4">
              <Logout />
            </div>
          </aside>
          <main className="min-w-0 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              {section === "overview" ? (
                <Overview />
              ) : section === "analytics" ? (
                <Overview analytics />
              ) : section === "products" || section === "categories" || section === "recipes" ? (
                <CatalogManager key={section} kind={section} />
              ) : section === "orders" || section === "delivery" ? (
                <OrderManager key={section} role="ADMIN" deliveryOnly={section === "delivery"} />
              ) : section === "notifications" ? (
                <Notifications />
              ) : section === "customers" ? (
                <Customers />
              ) : section === "payments" ? (
                <Records
                  path="/admin/payments"
                  title="Payments"
                  columns={["reference", "order_id", "amount", "status", "verified_at"]}
                />
              ) : section === "inventory" ? (
                <Records
                  path="/admin/inventory"
                  title="Inventory transactions"
                  columns={["name", "label", "delta", "reason", "created_at"]}
                />
              ) : section === "settings" ? (
                <WebsiteSettings />
              ) : (
                <>
                  <h1 className="mb-6 text-2xl font-bold">Admin profile</h1>
                  <Profile />
                </>
              )}
            </div>
          </main>
        </div>
      </Access>
    </div>
  );
}
function Overview({ analytics = false }: { analytics?: boolean }) {
  const result = useApi<any>("/admin/overview");
  const { data: reviews = [] } = useApi<any[]>("/admin/reviews", analytics);
  if (result.isError) return <ErrorState error={result.error} />;
  if (!result.data) return <Loading />;
  const d = result.data;
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">
        {analytics ? "Sales analytics" : "Dashboard overview"}
      </h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total products", d.products],
          ["Total orders", d.orders],
          ["Total customers", d.customers],
          ["Total revenue", naira(d.revenue)],
          ["Today’s sales", naira(d.todaySales)],
          ["Low-stock variations", d.lowStock.length],
          ...[
            "Order Placed",
            "Payment Confirmed",
            "Order Confirmed",
            "Preparing Your Order",
            "Out for Delivery",
            "Completed",
            "Cancelled",
          ].map((s) => [s, d.statuses.find((v: any) => v.status === s)?.count || 0]),
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-md border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 break-words text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <section className="mt-8 border-y border-border py-6">
        <h2 className="mb-5 text-lg font-bold">Daily verified sales</h2>
        {!d.sales.length ? (
          <p className="py-6 text-sm text-muted-foreground">No verified sales yet.</p>
        ) : (
          <div className="space-y-3">
            {d.sales.map((s: any) => (
              <div
                key={s.day}
                className="grid grid-cols-[80px_1fr_100px] items-center gap-3 text-xs"
              >
                <span>{s.day}</span>
                <div className="h-5 bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${(s.total / Math.max(...d.sales.map((v: any) => v.total))) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-right font-semibold">{naira(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <h2 className="mb-4 mt-8 text-lg font-bold">Recent orders</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="py-3">Order</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {d.recentOrders.map((o: any) => (
              <tr key={o.id}>
                <td className="py-3">{o.id}</td>
                <td>
                  <Status value={o.status} />
                </td>
                <td>{naira(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Low stock</h2>
      {d.lowStock.map((v: any) => (
        <p key={v.id} className="border-b border-border py-3 text-sm">
          {v.name} - {v.label}: <strong>{v.stock}</strong> remaining
        </p>
      ))}
      {analytics && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-bold">Delivery feedback</h2>
          {reviews.map((r) => (
            <div key={r.order_id} className="border-b border-border py-3 text-sm">
              <strong>
                {r.order_id}: {r.overall}/5
              </strong>
              <p>{r.comment}</p>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
function Records({ path, title, columns }: { path: string; title: string; columns: string[] }) {
  const result = useApi<any[]>(path);
  if (result.isError) return <ErrorState error={result.error} />;
  if (!result.data) return <Loading />;
  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      {!result.data.length && <p className="py-10 text-muted-foreground">No records yet.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border">
            <tr>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-3 capitalize">
                  {c.replaceAll("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.data.map((r, i) => (
              <tr key={r.id || r.reference || i}>
                {columns.map((c) => (
                  <td key={c} className="whitespace-nowrap px-3 py-3">
                    {c === "status" ? (
                      <Status value={r[c]} />
                    ) : c === "amount" ? (
                      naira(r[c])
                    ) : (
                      String(r[c] ?? "-")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Customers() {
  const result = useApi<any[]>("/admin/customers");
  const [form, setForm] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers & riders</h1>
        <button className={commandClass} onClick={() => setForm(!form)}>
          Add rider
        </button>
      </div>
      {form && (
        <form
          className="mb-8 grid max-w-xl gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            try {
              await request("/admin/riders", "POST", d);
              await result.refetch();
              setForm(false);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {[
            ["name", "Full name", "text"],
            ["email", "Email", "email"],
            ["phone", "Phone", "tel"],
            ["password", "Initial password", "password"],
          ].map(([key, label, type]) => (
            <Field key={key} label={label!}>
              <input
                name={key}
                type={type}
                required
                minLength={key === "password" ? 12 : undefined}
                className={fieldClass}
              />
            </Field>
          ))}
          {!!error && <ErrorState error={error} />}
          <button className={commandClass} disabled={busy}>
            Create rider
          </button>
        </form>
      )}
      {result.isError && <ErrorState error={result.error} />}
      <div className="divide-y divide-border">
        {result.data?.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold">{u.name}</p>
              <p className="text-sm text-muted-foreground">
                {u.email} · {u.phone}
              </p>
            </div>
            <Status value={u.role} />
          </div>
        ))}
      </div>
    </section>
  );
}
function WebsiteSettings() {
  const result = useApi<any>("/admin/settings");
  const [draft, setDraft] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  if (!result.data) return result.isError ? <ErrorState error={result.error} /> : <Loading />;
  const d = draft || {
    zones: result.data.zones || [],
    supportPhone: result.data.supportPhone || "",
    pickup: result.data.pickup || { address: "", latitude: 0, longitude: 0 },
  };
  const change = (key: string, value: any) => setDraft({ ...d, [key]: value });
  return (
    <section className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Website settings</h1>
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await request("/admin/settings", "PUT", d);
            await result.refetch();
            setDraft(null);
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Support phone">
          <input
            value={d.supportPhone}
            onChange={(e) => change("supportPhone", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <h2 className="font-semibold">Pickup location</h2>
        <Field label="Pickup address">
          <input
            required
            value={d.pickup.address}
            onChange={(e) => change("pickup", { ...d.pickup, address: e.target.value })}
            className={fieldClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {["latitude", "longitude"].map((key) => (
            <Field key={key} label={key}>
              <input
                type="number"
                step="any"
                required
                value={d.pickup[key]}
                onChange={(e) => change("pickup", { ...d.pickup, [key]: Number(e.target.value) })}
                className={fieldClass}
              />
            </Field>
          ))}
        </div>
        <h2 className="font-semibold">Delivery zones</h2>
        {d.zones.map((z: any, i: number) => (
          <div key={i} className="grid grid-cols-[1fr_120px_auto] items-end gap-3">
            <Field label="Location">
              <input
                required
                value={z.name}
                onChange={(e) =>
                  change(
                    "zones",
                    d.zones.map((v: any, n: number) =>
                      n === i ? { ...v, name: e.target.value } : v,
                    ),
                  )
                }
                className={fieldClass}
              />
            </Field>
            <Field label="Fee (NGN)">
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={z.fee}
                onChange={(e) =>
                  change(
                    "zones",
                    d.zones.map((v: any, n: number) =>
                      n === i ? { ...v, fee: Number(e.target.value) } : v,
                    ),
                  )
                }
                className={fieldClass}
              />
            </Field>
            <button
              type="button"
              className="p-2 text-sm text-destructive"
              onClick={() =>
                change(
                  "zones",
                  d.zones.filter((_: any, n: number) => n !== i),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="block text-sm font-semibold text-primary"
          onClick={() => change("zones", [...d.zones, { name: "", fee: 0 }])}
        >
          Add delivery zone
        </button>
        {!!error && <ErrorState error={error} />}
        <button disabled={busy} className={commandClass}>
          {busy ? "Saving..." : "Save settings"}
        </button>
      </form>
    </section>
  );
}
