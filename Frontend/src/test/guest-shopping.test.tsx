import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAddToCart, useToggleWishlist } from "@/hooks/use-hydrated-store";
import { useCart } from "@/stores/cart";
import { useWishlist } from "@/stores/wishlist";
import type { Product } from "@/types";
const mocks = vi.hoisted(() => ({ session: { data: null as null | { id: string } }, info: vi.fn(), success: vi.fn() }));
vi.mock("@/hooks/use-marketplace", () => ({ useSession: () => mocks.session }));
vi.mock("sonner", () => ({ toast: { info: mocks.info, success: mocks.success, error: vi.fn() } }));
const product = { id: "rice", name: "Rice", images: [], options: [{ id: "rice-1", stock: 10, price: 100, label: "1 kg", unit: "kg" }] } as unknown as Product;
afterEach(() => { cleanup(); useCart.getState().clear(); useWishlist.setState({ ids: [] }); mocks.session.data = null; vi.clearAllMocks(); });
it("asks guests to log in without changing their cart or showing success", () => {
  const { result } = renderHook(() => useAddToCart());
  act(() => { expect(result.current(product)).toBe(false); });
  expect(useCart.getState().items).toHaveLength(0);
  expect(mocks.info).toHaveBeenCalled();
  expect(mocks.success).not.toHaveBeenCalled();
});
it("prevents guest wishlist changes", () => {
  const { result } = renderHook(() => useToggleWishlist());
  act(() => { result.current("rice"); });
  expect(useWishlist.getState().ids).toEqual([]);
  expect(mocks.info).toHaveBeenCalled();
});
it("allows signed-in customers to add foodstuff and save favourites", () => {
  mocks.session.data = { id: "customer" };
  const { result } = renderHook(() => ({ add: useAddToCart(), save: useToggleWishlist() }));
  act(() => { expect(result.current.add(product)).toBe(true); result.current.save("rice"); });
  expect(useCart.getState().items[0]?.qty).toBe(1);
  expect(useWishlist.getState().ids).toEqual(["rice"]);
  expect(mocks.success).toHaveBeenCalled();
});
