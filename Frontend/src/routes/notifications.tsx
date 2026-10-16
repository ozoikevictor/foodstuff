import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shop/AppShell";
import { Access } from "@/components/marketplace/shared";
import { Notifications } from "@/components/marketplace/Notifications";
export const Route = createFileRoute("/notifications")({
  component: () => (
    <AppShell>
      <Access>
        <Notifications />
      </Access>
    </AppShell>
  ),
});
