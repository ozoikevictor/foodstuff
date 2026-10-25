import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  Package,
  ArrowUpRight,
  Inbox,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useApi, useSession } from "@/hooks/use-marketplace";
import { request } from "@/services/api";
import { Action, ErrorState, Loading } from "./shared";

type Notification = {
  id: string;
  message: string;
  order_id?: string | null;
  read_at?: string | null;
  created_at: string;
};
type Filter = "all" | "unread" | "read";

function notificationDate(value: string) {
  // Legacy database timestamps are UTC without an explicit offset.
  return new Date(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(" ", "T") + "Z" : value,
  );
}
function dateGroup(value: string) {
  const date = notificationDate(value);
  if (!Number.isFinite(date.getTime())) return "Earlier updates";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
function displayTime(value: string) {
  const date = notificationDate(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "Date unavailable";
}

export function Notifications() {
  const { data: user } = useSession();
  const result = useApi<Notification[]>("/notifications");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = result.data ?? [];
  const unread = rows.filter((n) => !n.read_at);
  const readCount = rows.length - unread.length;
  const visible = rows.filter(
    (n) => filter === "all" || (filter === "unread" ? !n.read_at : !!n.read_at),
  );
  const groups = new Map<string, Notification[]>();
  for (const item of visible) {
    const label = dateGroup(item.created_at);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  const orderRoute =
    user?.role === "ADMIN" ? "/admin" : user?.role === "RIDER" ? "/rider" : "/orders";

  return (
    <section className="mx-auto max-w-5xl" aria-labelledby="notifications-title">
      <header className="relative overflow-hidden rounded-3xl bg-primary-deep px-5 py-7 text-white sm:px-8 sm:py-9">
        <Bell
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -top-6 size-44 -rotate-12 text-white/5"
        />
        <div className="relative flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10">
            <BellRing aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-green-200">
              Your activity centre
            </p>
            <h1 id="notifications-title" className="font-display text-3xl font-bold sm:text-4xl">
              Notifications
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
              Order updates, delivery progress and important account activity, all in one place.
            </p>
          </div>
        </div>
        {result.data && (
          <p
            role="status"
            className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-medium"
          >
            <span
              className={`size-2 rounded-full ${unread.length ? "bg-amber-300" : "bg-green-300"}`}
            />
            {unread.length
              ? `${unread.length} unread ${unread.length === 1 ? "update" : "updates"}`
              : "You're all caught up"}
          </p>
        )}
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div
              className="flex max-w-full gap-1 rounded-xl bg-muted p-1"
              aria-label="Filter notifications"
            >
              {(
                [
                  ["all", "All", rows.length],
                  ["unread", "Unread", unread.length],
                  ["read", "Read", readCount],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                  <span className="ml-1.5 tabular-nums opacity-65">
                    {result.data ? count : "-"}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={result.isFetching}
              onClick={() => void result.refetch()}
              aria-label="Refresh notifications"
              className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${result.isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {result.isError ? (
            <div className="px-5">
              <ErrorState error={result.error} />
              <button
                type="button"
                onClick={() => void result.refetch()}
                className="mb-5 min-h-11 text-sm font-semibold text-primary underline"
              >
                Try again
              </button>
            </div>
          ) : !result.data ? (
            <div className="px-5">
              <Loading />
            </div>
          ) : !visible.length ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="mb-5 grid size-20 place-items-center rounded-full bg-accent text-primary">
                <Inbox aria-hidden="true" className="size-9" />
              </span>
              <h2 className="font-display text-xl font-bold">
                {filter === "unread"
                  ? "You're all caught up"
                  : filter === "read"
                    ? "No read notifications yet"
                    : "A fresh start"}
              </h2>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                {filter === "unread"
                  ? "You've seen every update. New notifications will appear here."
                  : filter === "read"
                    ? "Updates you mark as read will appear here."
                    : "When there's news about your orders or account, you'll find it here."}
              </p>
              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="mt-5 min-h-11 text-sm font-semibold text-primary"
                >
                  View all notifications
                </button>
              )}
            </div>
          ) : (
            <div>
              {[...groups].map(([label, items]) => (
                <section key={label} aria-label={label}>
                  <h2 className="border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </h2>
                  <ul className="divide-y divide-border">
                    {items.map((n) => (
                      <li
                        key={n.id}
                        className={`flex items-start gap-3 p-4 transition-colors sm:gap-4 sm:p-5 ${!n.read_at ? "bg-accent/35" : ""}`}
                      >
                        <span
                          className={`mt-1 grid size-10 shrink-0 place-items-center rounded-2xl ${!n.read_at ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          {n.order_id ? (
                            <Package aria-hidden="true" className="size-5" />
                          ) : (
                            <Bell aria-hidden="true" className="size-5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-foreground">
                              {n.order_id ? "Order update" : "Account update"}
                            </p>
                            {!n.read_at && (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                                <span className="size-1.5 rounded-full bg-primary" />
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="mt-2 break-words text-sm leading-6 text-foreground/85">
                            {n.message}
                          </p>
                          <time
                            dateTime={
                              Number.isFinite(notificationDate(n.created_at).getTime())
                                ? notificationDate(n.created_at).toISOString()
                                : undefined
                            }
                            className="mt-2 block text-[11px] text-muted-foreground"
                          >
                            {displayTime(n.created_at)}
                          </time>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {n.order_id && (
                              <Link
                                to={orderRoute}
                                search={() => ({
                                  order: n.order_id!,
                                  ...(user?.role === "ADMIN" ? { section: "orders" } : {}),
                                })}
                                preload="intent"
                                className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-primary"
                              >
                                View order
                                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                              </Link>
                            )}
                            {!n.read_at && (
                              <Action
                                label="Mark read"
                                icon={<Check className="size-3.5" />}
                                onClick={() =>
                                  request(`/notifications/${encodeURIComponent(n.id)}`, "PATCH", {})
                                }
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-bold">Manage your inbox</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Keep your latest updates easy to find.
            </p>
            <div className="mt-5 flex flex-col items-stretch gap-3">
              <Action
                label="Mark all as read"
                icon={<CheckCheck className="size-4" />}
                disabled={!unread.length || result.isError}
                onClick={async () => {
                  for (const n of unread)
                    await request(`/notifications/${encodeURIComponent(n.id)}`, "PATCH", {});
                }}
              />
              <Action
                label="Clear read"
                icon={<Trash2 className="size-4" />}
                disabled={!readCount || result.isError}
                onClick={() => request("/notifications", "DELETE")}
              />
            </div>
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
              Clearing read updates keeps your unread notifications and orders.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-accent/60 p-5">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-xs leading-6 text-muted-foreground">
              Your updates are private. Only activity linked to your account appears here.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
