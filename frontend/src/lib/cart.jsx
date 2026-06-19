import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";
import { useAuth } from "./auth";

const CartCtx = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return; }
    try {
      const { data } = await api.get("/cart");
      setItems(data.items || []);
    } catch (_) {}
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const addToCart = async (payload) => {
    await api.post("/cart/add", payload);
    refresh();
  };
  const removeItem = async (item_id) => {
    await api.delete(`/cart/item/${item_id}`);
    refresh();
  };
  const clear = async () => { await api.post("/cart/clear"); refresh(); };

  const subtotal = items.reduce((sum, it) => sum + (it.product?.base_price || 0) * (it.quantity || 1), 0);

  return (
    <CartCtx.Provider value={{ items, addToCart, removeItem, clear, refresh, subtotal }}>
      {children}
    </CartCtx.Provider>
  );
};

export const useCart = () => useContext(CartCtx);
