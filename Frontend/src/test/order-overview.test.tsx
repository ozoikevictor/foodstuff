import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OrderOverview, orderDate } from "@/components/marketplace/OrderOverview";
afterEach(cleanup);
it("keeps a paid order at the placed stage until preparation starts", () => {
  render(
    <OrderOverview
      order={{
        status: "Payment Confirmed",
        payment_status: "paid",
        created_at: "2026-10-25T10:00:00Z",
      }}
    />,
  );
  expect(screen.getByText("Paid")).toBeTruthy();
  expect(screen.getByText("Waiting for the store", { exact: false })).toBeTruthy();
  expect(screen.getByText("Placed").closest("li")?.getAttribute("aria-current")).toBe("step");
  expect(screen.getByText("Delivered").closest("li")?.hasAttribute("aria-current")).toBe(false);
});
it("shows a delivery exception without a misleading progress bar", () => {
  render(<OrderOverview order={{ status: "Cancelled", payment_status: "paid" }} />);
  expect(screen.queryByRole("list", { name: "Delivery stages" })).toBeNull();
  expect(screen.getByText("Cancelled")).toBeTruthy();
});
it("asks for receipt confirmation when the rider marks delivery complete", () => {
  render(<OrderOverview order={{ status: "Rider Marked Delivered", payment_status: "paid" }} />);
  expect(screen.getByText(/Please confirm receipt below/)).toBeTruthy();
});
it("handles invalid dates and legacy UTC timestamps", () => {
  expect(orderDate("invalid")).toBe("Date unavailable");
  expect(orderDate("2026-10-25 10:00:00")).toBe(orderDate("2026-10-25T10:00:00Z"));
});
