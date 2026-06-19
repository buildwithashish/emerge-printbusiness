import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ShieldCheck } from "@phosphor-icons/react";

const Checkout = () => {
  const { user } = useAuth();
  const { items, subtotal, refresh } = useCart();
  const nav = useNavigate();
  const [addr, setAddr] = useState({ name: user?.name || "", phone: "", line1: "", city: "", state: "", pincode: "" });
  const [method, setMethod] = useState("razorpay");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/settings").then(r => setSettings(r.data)); }, []);

  const placeOrder = async () => {
    if (!addr.name || !addr.phone || !addr.line1 || !addr.city || !addr.pincode) {
      toast.error("Please fill all address fields"); return;
    }
    setLoading(true);
    try {
      const { data: order } = await api.post("/checkout", { address: addr, payment_method: method });

      if (method === "cod") {
        await api.post(`/orders/${order.id}/verify-payment`, { method: "cod" });
        toast.success("Order placed! Pay on delivery.");
        await refresh();
        nav("/account");
        return;
      }

      // Razorpay flow (mock if not configured)
      const rzpKey = process.env.REACT_APP_RAZORPAY_KEY_ID || "";
      if (rzpKey && order.razorpay_order_id && !order.razorpay_order_id.startsWith("order_mock_") && window.Razorpay) {
        const options = {
          key: rzpKey,
          amount: Math.round(order.total * 100),
          currency: "INR",
          name: "MerchCraft AI",
          description: `Order ${order.order_number}`,
          order_id: order.razorpay_order_id,
          handler: async (res) => {
            await api.post(`/orders/${order.id}/verify-payment`, res);
            toast.success("Payment successful!");
            await refresh();
            nav("/account");
          },
          theme: { color: "#FF3B30" },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Mock checkout
        await new Promise(r => setTimeout(r, 800));
        await api.post(`/orders/${order.id}/verify-payment`, { method: "mock" });
        toast.success("Payment successful (mock)");
        await refresh();
        nav("/account");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-[#52525B]">Your cart is empty.</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="checkout-page">
      <h1 className="font-display text-4xl font-black tracking-tighter mb-8">Checkout</h1>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-black/5 p-6 rounded-sm">
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4">Shipping Address</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ["name", "Full Name"], ["phone", "Phone"], ["line1", "Address"],
                ["city", "City"], ["state", "State"], ["pincode", "PIN code"],
              ].map(([k, label]) => (
                <input key={k} value={addr[k]} onChange={e=>setAddr({...addr, [k]: e.target.value})} placeholder={label}
                  className="px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid={`addr-${k}`} />
              ))}
            </div>
          </div>

          <div className="bg-white border border-black/5 p-6 rounded-sm">
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4">Payment Method</div>
            <div className="space-y-2">
              {settings.razorpay_enabled !== false && (
                <label className={`flex items-center gap-3 p-3 border rounded-sm cursor-pointer ${method==='razorpay'?'border-[#0A0A0A] bg-black/5':'border-black/10'}`} data-testid="pay-razorpay">
                  <input type="radio" checked={method==='razorpay'} onChange={()=>setMethod('razorpay')} />
                  <div>
                    <div className="font-semibold text-sm">Razorpay (UPI, Cards, NetBanking)</div>
                    <div className="text-xs text-[#52525B]">Pay securely via Razorpay</div>
                  </div>
                </label>
              )}
              {settings.cod_enabled !== false && (
                <label className={`flex items-center gap-3 p-3 border rounded-sm cursor-pointer ${method==='cod'?'border-[#0A0A0A] bg-black/5':'border-black/10'}`} data-testid="pay-cod">
                  <input type="radio" checked={method==='cod'} onChange={()=>setMethod('cod')} />
                  <div>
                    <div className="font-semibold text-sm">Cash on Delivery</div>
                    <div className="text-xs text-[#52525B]">Pay when your order arrives</div>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-black/5 p-6 rounded-sm sticky top-24">
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4">Order Summary</div>
            <div className="space-y-3 mb-4">
              {items.map(it => (
                <div key={it.id} className="flex gap-3 text-sm">
                  <img src={it.product?.image} alt="" className="w-12 h-12 object-cover rounded-sm" />
                  <div className="flex-1">
                    <div className="font-medium">{it.product?.name}</div>
                    <div className="text-xs text-[#52525B]">Qty {it.quantity}</div>
                  </div>
                  <div className="font-semibold">₹{(it.product?.base_price||0)*it.quantity}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-black/5 pt-3 flex justify-between font-display font-black text-xl mb-4"><span>Total</span><span data-testid="checkout-total">₹{subtotal.toFixed(2)}</span></div>
            <button onClick={placeOrder} disabled={loading} data-testid="place-order-btn" className="w-full inline-flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-sm transition-all">
              {loading ? "Processing…" : `Place Order — ₹${subtotal.toFixed(2)}`}
            </button>
            <div className="flex items-center gap-2 mt-3 text-xs text-[#52525B]"><ShieldCheck size={14} className="text-[#FF3B30]" /> Secure SSL encrypted checkout</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
