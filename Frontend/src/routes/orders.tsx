import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shop/AppShell";
import { Access } from "@/components/marketplace/shared";
import { OrderManager } from "@/components/marketplace/OrderManager";
import { PageIntro } from "@/components/shop/PageIntro";
export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "My orders — NaijaFresh" }] }),
  component: () => (
    <AppShell>
      <Access role="CUSTOMER">
        <PageIntro
          eyebrow="From our market to your doorstep"
          title="Your foodstuff journey"
          description="Follow your current deliveries, revisit past orders, and bring your favourites back to your basket."
        />
        <OrderManager />
      </Access>
    </AppShell>
  ),
});
