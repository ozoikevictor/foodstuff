import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Checkout } from "@/components/marketplace/Checkout";
const mocks = vi.hoisted(() => ({ closed: false }));
vi.mock("@/hooks/use-marketplace", () => ({
  useSession: () => ({ data: { id: "customer", phone: "08000000000" } }),
  useApi: (path: string) => ({
    data:
      path === "/config"
        ? { zones: [{ name: "Lagos", fee: 100 }], paymentsConfigured: false }
        : [
            {
              id: "fish",
              name: "Fish",
              perishable: true,
              orderStart: "08:00",
              orderCutoff: "14:00",
              ordering: { open: !mocks.closed },
            },
          ],
  }),
}));
vi.mock("@/hooks/use-hydrated-store", () => ({
  useCartSummary: () => ({
    items: [{ key: "fish", productId: "fish", variantId: "variant", qty: 1 }],
    subtotal: 1000,
  }),
}));
afterEach(() => {
  cleanup();
  mocks.closed = false;
});
it("shows delivery details and time preferences on checkout", () => {
  render(<Checkout />);
  expect(screen.getByLabelText("Delivery address")).toBeTruthy();
  expect(screen.getByLabelText("Requested delivery time")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Continue to secure payment" }).hasAttribute("disabled"),
  ).toBe(true);
});
it("explains when a perishable in the basket has closed", () => {
  mocks.closed = true;
  render(<Checkout />);
  expect(screen.getByRole("alert").textContent).toContain("Remove closed items");
  expect(screen.getByText(/Closed for today/)).toBeTruthy();
});

it("updates the summary when a delivery area is selected", () => {
  render(<Checkout />);
  const area = screen.getByLabelText("Delivery area") as HTMLSelectElement;
  fireEvent.change(area, { target: { value: "Lagos" } });
  const summary = screen.getByRole("complementary", { name: "Order summary" });
  expect(summary.textContent).toContain("1,100");
  expect(summary.textContent).toContain("Delivery fee");
});

it("does not show an estimated total before a delivery area is selected", () => {
  render(<Checkout />);
  expect(screen.getByText("Choose a delivery area to see your total.")).toBeTruthy();
  expect(screen.getByLabelText("Phone number").getAttribute("pattern")).toContain("234");
});
