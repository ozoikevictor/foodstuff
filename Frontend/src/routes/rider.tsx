import { createFileRoute, Link } from "@tanstack/react-router";
import { Access, Logout } from "@/components/marketplace/shared";
import { OrderManager } from "@/components/marketplace/OrderManager";
export const Route = createFileRoute("/rider")({
  component: () => (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="text-xl font-extrabold text-primary">
            Naija<span className="text-hot">Fresh</span>{" "}
            <span className="text-sm font-medium text-muted-foreground">Rider</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/notifications" preload="intent">
              Notifications
            </Link>
            <Link to="/account">Profile</Link>
            <Logout />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Access role="RIDER">
          <OrderManager role="RIDER" />
        </Access>
      </main>
    </div>
  ),
});
