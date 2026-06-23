import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";
import { useAuth } from "./auth";

const CartCtx = createContext(null);
const LS_KEY = "mc_guest_cart_v1";

const readGuest = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (_) { return []; }
};
const writeGuest = (items) => localStorage.setItem(LS_KEY, JSON.stringify(items));

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    if (user) {
      try {
        const { data } = await api.get("/cart");
        setItems(data.items || []);
      } catch (_) {}
    } else {
      // Guest cart: hydrate from localStorage, fetch product details
      const guestItems = readGuest();
      const hydrated = await Promise.all(
        guestItems.map(async (it) => {
          try {
            const { data: product } = await api.get(`/products/${it.product_id}`);
            return { ...it, product };
          } catch (_) {
            return { ...it, product: null };
          }
        })
      );
      setItems(hydrated.filter(i => i.product));
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // On login, merge guest cart into server cart, then clear localStorage
  useEffect(() => {
    if (!user) return;
    const guestItems = readGuest();
    if (guestItems.length === 0) return;
    (async () => {
      for (const it of guestItems) {
        try { await api.post("/cart/add", { product_id: it.product_id, quantity: it.quantity, variants: it.variants || {}, custom_design_url: it.custom_design_url, custom_text: it.custom_text }); }
        catch (_) {}
      }
      writeGuest([]);
      refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addToCart = async (payload) => {
    if (user) {
      await api.post("/cart/add", payload);
      refresh();
    } else {
      const guest = readGuest();
      guest.push({ id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...payload });
      writeGuest(guest);
      refresh();
    }
  };

  const removeItem = async (item_id) => {
    if (user) {
      await api.delete(`/cart/item/${item_id}`);
    } else {
      writeGuest(readGuest().filter(i => i.id !== item_id));
    }
    refresh();
  };

  const updateQty = async (item_id, quantity) => {
    if (quantity < 1) return;
    if (user) {
      await api.put(`/cart/item/${item_id}`, { quantity });
    } else {
      writeGuest(readGuest().map(i => i.id === item_id ? { ...i, quantity } : i));
    }
    refresh();
  };

  const clear = async () => {
    if (user) await api.post("/cart/clear");
    else writeGuest([]);
    refresh();
  };

  const subtotal = items.reduce((sum, it) => sum + (it.product?.base_price || 0) * (it.quantity || 1), 0);

  return (
    <CartCtx.Provider value={{ items, addToCart, removeItem, updateQty, clear, refresh, subtotal }}>
      {children}
    </CartCtx.Provider>
  );
};

export const useCart = () => useContext(CartCtx);
