import { Bell, Check, Trash2 } from "lucide-react";
import { useApi, useSession } from "@/hooks/use-marketplace";
import { request } from "@/services/api";
import { Action, ErrorState, Loading } from "./shared";
export function Notifications() {
  const { data: user } = useSession();
  const result = useApi<any[]>("/notifications");
  if (result.isError) return <ErrorState error={result.error} />;
  if (!result.data) return <Loading />;
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Action
          label="Clear read"
          icon={<Trash2 className="size-4" />}
          onClick={() => request("/notifications", "DELETE")}
        />
      </div>
      {!result.data.length && (
        <div className="py-12 text-center text-muted-foreground">
          <Bell className="mx-auto mb-3 size-8" />
          You're all caught up.
        </div>
      )}
      <ul className="divide-y divide-border">
        {result.data.map((n) => (
          <li
            key={n.id}
            className={`flex flex-wrap items-center gap-3 py-4 ${!n.read_at ? "font-semibold" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">{n.message}</p>
              <time className="mt-1 block text-xs font-normal text-muted-foreground">
                {n.created_at} UTC
              </time>
              {n.order_id && (
                <a
                  href={`${user?.role === "ADMIN" ? "/admin?section=orders&" : user?.role === "RIDER" ? "/rider?" : "/orders?"}order=${n.order_id}`}
                  className="mt-2 inline-block text-sm text-primary"
                >
                  View order
                </a>
              )}
            </div>
            {!n.read_at && (
              <Action
                label="Mark read"
                icon={<Check className="size-4" />}
                onClick={() => request(`/notifications/${n.id}`, "PATCH", {})}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
