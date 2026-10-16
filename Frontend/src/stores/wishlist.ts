import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {tabStorage} from "@/lib/test-tab-session";

interface WishlistState {
  ids: string[];
  toggle: (id: string) => boolean; // returns new state
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const has = get().ids.includes(id);
        set({ ids: has ? get().ids.filter((x) => x !== id) : [...get().ids, id] });
        return !has;
      },
    }),
    { name: "naijafresh-wishlist", storage: createJSONStorage(tabStorage) },
  ),
);
