import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Trash, ArrowRight, Minus, Plus, Truck } from "@phosphor-icons/react";
import api from "@/lib/api";

const Cart = () => {
  const { items, removeItem, updateQty, subtotal } = useCart();
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [threshold, setThreshold] = useState(999);

  useEffect(() => { api.get("/settings").then(r => setThreshold(r.data.free_shipping_threshold || 999)).catch(()=>{}); }, []);

  if (!ready) return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-[#52525B]">Loading…</div>;
  // Cart works for both guests and logged-in users now — no login wall.

  const remaining = Math.max(0, threshold - subtotal);
  const progressPct = Math.min(100, (subtotal / threshold) * 100);
  const isFree = subtotal >= threshold;
  const shipping = isFree ? 0 : 49;
  const total = subtotal + shipping;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="cart-page">
      <h1 className="font-display text-4xl font-black tracking-tighter mb-8">Cart</h1>

      {items.length === 0 ? (
        <div className="text-center py-16 text-[#52525B]" data-testid="empty-cart">
          <div className="mb-4">Your cart is empty.</div>
          <Link to="/products" className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 rounded-sm font-semibold">Browse Products <ArrowRight /></Link>
        </div>
      ) : (
        <>
          {/* free-shipping progress flash card */}
          <div className={`mb-6 rounded-sm border p-4 ${isFree ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`} data-testid="free-shipping-progress">
            <div className="flex items-center gap-3 mb-2">
              <Truck weight="duotone" className={isFree ? "text-green-700" : "text-amber-700"} size={20} />
              {isFree ? (
                <div className="text-sm font-semibold text-green-800">🎉 You unlocked FREE shipping!</div>
              ) : (
                <div className="text-sm font-medium text-amber-900">
                  Add <span className="font-bold">₹{remaining.toFixed(0)}</span> more to unlock <span className="font-bold">FREE shipping</span>
                </div>
              )}
            </div>
            <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${isFree ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-4">
              {items.map(it => (
                <div key={it.id} className="flex gap-4 p-4 bg-white border border-black/5 rounded-sm" data-testid={`cart-item-${it.id}`}>
                  <img src={it.product?.image} alt={it.product?.name} className="w-24 h-24 object-cover rounded-sm" />
                  <div className="flex-1">
                    <div className="font-semibold">{it.product?.name}</div>
                    <div className="text-xs text-[#52525B] mt-0.5 uppercase tracking-wider">
                      {Object.entries(it.variants || {}).map(([k, v]) => `${k}:${v}`).join(" · ")}
                    </div>
                    {it.custom_text && <div className="text-xs text-[#52525B] mt-1">Text: &ldquo;{it.custom_text}&rdquo;</div>}
                    {it.custom_design_url && <div className="text-xs text-[#52525B] mt-1">+ Custom design</div>}
                    <div className="mt-3 inline-flex items-center border border-black/15 rounded-sm">
                      <button onClick={() => updateQty(it.id, it.quantity - 1)} data-testid={`cart-qty-dec-${it.id}`} className="px-2.5 py-1.5 hover:bg-black/5 disabled:opacity-40" disabled={it.quantity <= 1}>
                        <Minus size={14} weight="bold" />
                      </button>
                      <div className="px-4 text-sm font-semibold min-w-[2.5rem] text-center" data-testid={`cart-qty-val-${it.id}`}>{it.quantity}</div>
                      <button onClick={() => updateQty(it.id, it.quantity + 1)} data-testid={`cart-qty-inc-${it.id}`} className="px-2.5 py-1.5 hover:bg-black/5">
                        <Plus size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold">₹{(it.product?.base_price || 0) * it.quantity}</div>
                    <button onClick={() => removeItem(it.id)} data-testid={`remove-${it.id}`} className="mt-2 text-xs text-[#FF3B30] hover:underline inline-flex items-center gap-1"><Trash size={14} /> Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-4">
              <div className="bg-white border border-black/5 p-6 rounded-sm sticky top-32" data-testid="cart-summary">
                <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-3">Summary</div>
                <div className="flex justify-between text-sm py-2"><span>Subtotal</span><span data-testid="subtotal">₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm py-2"><span>Shipping</span><span data-testid="shipping-cost">{isFree ? "FREE" : `₹${shipping}`}</span></div>
                <div className="border-t border-black/5 mt-2 pt-3 flex justify-between font-display font-black text-xl"><span>Total</span><span data-testid="total">₹{total.toFixed(2)}</span></div>
                <button onClick={() => nav("/checkout")} data-testid="checkout-btn" className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-6 py-3 rounded-sm">Checkout <ArrowRight /></button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Cart;
