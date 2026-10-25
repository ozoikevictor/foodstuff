import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider, Outlet } from "@tanstack/react-router";
import { Notifications } from "@/components/marketplace/Notifications";
const state = vi.hoisted(() => ({ role: "CUSTOMER" }));
vi.mock("@/hooks/use-marketplace", () => ({
  useSession: () => ({ data: { role: state.role } }),
  useApi: () => ({ data: [{ id: "notification-1", message: "Your order is ready", order_id: "CRB-TEST", read_at: "2026-10-25", created_at: "2026-10-25T10:00:00Z" }], isFetching: false }),
}));
vi.mock("@/components/marketplace/shared", () => ({ Action: () => null, ErrorState: () => null, Loading: () => null }));
afterEach(cleanup);
it.each([['CUSTOMER', '/orders'], ['ADMIN', '/admin'], ['RIDER', '/rider']])("opens the matching order through app navigation for %s", async (role, path) => {
  state.role = role;
  const root = createRootRoute({ component: () => <><div data-testid="persistent-shell">App shell</div><Outlet /></> });
  const notifications = createRoute({ getParentRoute: () => root, path: '/notifications', component: Notifications });
  const routes = ['/orders', '/admin', '/rider'].map(path => createRoute({ getParentRoute: () => root, path, component: () => <h1>Order details</h1> }));
  const router = createRouter({ routeTree: root.addChildren([notifications, ...routes]), history: createMemoryHistory({ initialEntries: ['/notifications'] }) });
  render(<RouterProvider router={router} />);
  const link = await screen.findByRole('link', { name: /View order/ });
  const shell = screen.getByTestId('persistent-shell');
  expect(link.getAttribute('href')).toContain(`${path}?`);
  fireEvent.click(link);
  await screen.findByRole('heading', { name: 'Order details' });
  expect(router.state.location.pathname).toBe(path);
  expect(router.state.location.search).toMatchObject({ order: 'CRB-TEST', ...(role === 'ADMIN' ? { section: 'orders' } : {}) });
  expect(screen.getByTestId('persistent-shell')).toBe(shell);
});
