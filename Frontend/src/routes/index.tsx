import { createFileRoute } from "@tanstack/react-router";
import { SwimStore } from "@/components/swim/SwimStore";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "NaijaFresh Swim — Made for the sun" }, { name: "description", content: "Swimwear for beach days, poolside afternoons and your next escape." }] }),
  component: () => <SwimStore />,
});
