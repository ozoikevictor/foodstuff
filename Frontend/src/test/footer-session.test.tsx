import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shop/AppShell";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/hooks/use-marketplace", () => ({
  useSession: mocks.session,
  useApi: () => ({ data: [] }),
}));
vi.mock("@/hooks/use-hydrated-store", () => ({ useCartSummary: () => ({ count: 0 }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: any) => (
    <a
      href={to}
      aria-label={props["aria-label"]}
      role={props.role}
      ref={props.ref}
      tabIndex={props.tabIndex}
      onFocus={props.onFocus}
      onKeyDown={props.onKeyDown}
    >
      {children}
    </a>
  ),
}));
afterEach(cleanup);
it("hides guest footer links for an authenticated customer", () => {
  mocks.session.mockReturnValue({ data: { role: "CUSTOMER" }, isPending: false, isError: false });
  render(
    <AppShell showFooter>
      <p>Home</p>
    </AppShell>,
  );
  expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Create an account" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "My orders" }).length).toBeGreaterThan(0);
});
it("shows guest footer links after confirming a signed-out session", () => {
  mocks.session.mockReturnValue({ data: null, isPending: false, isError: false });
  render(
    <AppShell showFooter>
      <p>Home</p>
    </AppShell>,
  );
  expect(screen.getAllByRole("link", { name: "Log in" }).length).toBeGreaterThan(0);
  for (const name of [
    "My orders",
    "Wishlist",
    "Your wishlist",
    "My account",
    "Account",
    "Your basket",
    "Cart",
    "Cart, 0 items",
  ])
    expect(screen.queryByRole("link", { name })).toBeNull();
  expect(screen.getByRole("link", { name: "Create an account" })).toBeTruthy();
});
it("does not flash guest footer links while checking the session", () => {
  mocks.session.mockReturnValue({ isPending: true, isError: false });
  render(
    <AppShell showFooter>
      <p>Home</p>
    </AppShell>,
  );
  expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
});

it("keeps the account dropdown available when the backend account check fails", () => {
  mocks.session.mockReturnValue({ data: undefined, isPending: false, isError: true });
  render(
    <AppShell>
      <p>Shop</p>
    </AppShell>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Open account menu" }), { key: "Enter" });
  expect(screen.getByRole("menuitem", { name: "Log in" }).getAttribute("href")).toBe("/login");
  expect(screen.getByRole("menuitem", { name: "Create an account" }).getAttribute("href")).toBe(
    "/signup",
  );
  expect(screen.queryByRole("link", { name: "My account" })).toBeNull();
});
