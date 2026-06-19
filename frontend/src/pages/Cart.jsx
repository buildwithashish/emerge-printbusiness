import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Trash, ArrowRight } from "@phosphor-icons/react";

const Cart = () => {
  const { items, removeItem, subtotal } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();

  if (!user) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center" data-testid="cart-login-prompt">
      <h1 className="font-display text-3xl font-black mb-3">Login to view your cart</h1>
      <Link to="/auth" className="inline-flex items-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-6 py-3 rounded-sm">Login / Register <ArrowRight /></Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="cart-page">
      <h1 className="font-display text-4xl font-black tracking-tighter mb-8">Cart</h1>
      {items.length === 0 ? (
        <div className="text-center py-16 text-[#52525B]" data-testid="empty-cart">
          <div className="mb-4">Your cart is empty.</div>
          <Link to="/products" className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-5 py-2.5 rounded-sm font-semibold">Browse Products <ArrowRight /></Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-4">
            {items.map(it => (
              <div key={it.id} className="flex gap-4 p-4 bg-white border border-black/5 rounded-sm" data-testid={`cart-item-${it.id}`}>
                <img src={it.product?.image} alt={it.product?.name} className="w-24 h-24 object-cover rounded-sm" />
                <div className="flex-1">
                  <div className="font-semibold">{it.product?.name}</div>
                  <div className="text-xs text-[#52525B] mt-0.5 uppercase tracking-wider">{Object.entries(it.variants||{}).map(([k,v])=>`${k}:${v}`).join(" · ")}</div>
                  <div className="text-xs text-[#52525B] mt-0.5">Qty: {it.quantity}</div>
                  {it.custom_text && <div className="text-xs text-[#52525B] mt-1">Text: "{it.custom_text}"</div>}
                  {it.custom_design_url && <div className="text-xs text-[#52525B] mt-1">+ Custom design</div>}
                </div>
                <div className="text-right">
                  <div className="font-display font-bold">₹{(it.product?.base_price || 0) * it.quantity}</div>
                  <button onClick={()=>removeItem(it.id)} data-testid={`remove-${it.id}`} className="mt-2 text-xs text-[#FF3B30] hover:underline inline-flex items-center gap-1"><Trash size={14} /> Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div className="lg:col-span-4">
            <div className="bg-white border border-black/5 p-6 rounded-sm sticky top-24" data-testid="cart-summary">
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-3">Summary</div>
              <div className="flex justify-between text-sm py-2"><span>Subtotal</span><span data-testid="subtotal">₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm py-2"><span>Shipping</span><span>FREE</span></div>
              <div className="border-t border-black/5 mt-2 pt-3 flex justify-between font-display font-black text-xl"><span>Total</span><span data-testid="total">₹{subtotal.toFixed(2)}</span></div>
              <button onClick={()=>nav("/checkout")} data-testid="checkout-btn" className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-6 py-3 rounded-sm">Checkout <ArrowRight /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
