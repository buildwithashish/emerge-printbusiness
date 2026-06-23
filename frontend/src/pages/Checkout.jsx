import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight, Check, CircleNotch } from "@phosphor-icons/react";

const Checkout = () => {
  const { user } = useAuth();
  const { items, subtotal, refresh } = useCart();
  const nav = useNavigate();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);

  // 3-step flow: 1=details, 2=otp, 3=payment
  const [step, setStep] = useState(1);
  const [addr, setAddr] = useState({
    name: user?.name || "", email: user?.email || "", phone: user?.phone || "",
    line1: "", city: "", state: "", pincode: "",
  });
  const [register, setRegister] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [method, setMethod] = useState("cod");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpHint, setOtpHint] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => { api.get("/settings").then(r => setSettings(r.data)); }, []);
  // If user is logged in AND already phone-verified, skip step 2 entirely
  useEffect(() => {
    if (user && user.phone_verified && step === 2) setStep(3);
  }, [user, step]);

  const isFree = subtotal >= (settings.free_shipping_threshold || 999);
  const shipping = isFree ? 0 : 49;
  const total = subtotal + shipping;
  const isGuest = !user;

  const validateDetails = () => {
    if (!addr.name || !addr.email || !addr.phone || !addr.line1 || !addr.city || !addr.pincode) {
      toast.error("Please fill all required fields"); return false;
    }
    return true;
  };

  const proceedToOtp = () => {
    if (!validateDetails()) return;
    // Logged-in + phone verified → skip OTP
    if (user && user.phone_verified) { setStep(3); return; }
    setStep(2);
  };

  const sendOtp = async () => {
    setSendingOtp(true);
    try {
      const { data } = await api.post("/auth/send-otp", { target: addr.phone, channel: "sms" });
      setOtpSent(true);
      // dev_code returned in non-prod — surface as hint
      if (data.dev_code) setOtpHint(`Dev OTP: ${data.dev_code}`);
      toast.success("OTP sent to your phone");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not send OTP");
    }
    setSendingOtp(false);
  };

  const verifyOtp = async () => {
    if (!otpCode || otpCode.length < 4) { toast.error("Enter the OTP"); return; }
    try {
      await api.post("/auth/verify-otp", { target: addr.phone, code: otpCode });
      toast.success("Phone verified");
      setStep(3);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Invalid code");
    }
  };

  const placeOrder = async () => {
    setLoading(true);
    try {
      let order;
      if (user) {
        const { data } = await api.post("/checkout", { address: { name: addr.name, phone: addr.phone, line1: addr.line1, city: addr.city, state: addr.state, pincode: addr.pincode }, payment_method: method });
        order = data;
      } else {
        const payload = {
          items: items.map(it => ({
            product_id: it.product_id, quantity: it.quantity,
            variants: it.variants || {},
            custom_design_url: it.custom_design_url || null,
            custom_text: it.custom_text || null,
          })),
          customer: addr,
          payment_method: method,
          register,
          marketing_opt_in: marketingOptIn,
          phone_otp_code: otpCode,
        };
        const { data } = await api.post("/checkout/guest", payload);
        order = data;
        if (order.generated_password) {
          toast.success(`Order placed! We've emailed your temporary password to ${addr.email}`, { duration: 6000 });
        }
      }

      if (method === "cod") {
        await api.post(`/orders/${order.id}/verify-payment`, { method: "cod" });
        toast.success("Order placed!");
        await refresh();
        nav(user ? "/account" : "/");
        return;
      }
      // Razorpay flow (mock if not configured)
      const rzpKey = process.env.REACT_APP_RAZORPAY_KEY_ID || "";
      if (rzpKey && order.razorpay_order_id && !order.razorpay_order_id.startsWith("order_mock_") && window.Razorpay) {
        const options = {
          key: rzpKey, amount: Math.round(order.total * 100), currency: "INR",
          name: "MerchCraft AI", description: `Order ${order.order_number}`, order_id: order.razorpay_order_id,
          handler: async (res) => {
            await api.post(`/orders/${order.id}/verify-payment`, res);
            toast.success("Payment successful!");
            await refresh();
            nav(user ? "/account" : "/");
          },
          theme: { color: "#FF3B30" },
        };
        new window.Razorpay(options).open();
      } else {
        await new Promise(r => setTimeout(r, 600));
        await api.post(`/orders/${order.id}/verify-payment`, { method: "mock" });
        toast.success("Payment successful (mock)");
        await refresh();
        nav(user ? "/account" : "/");
      }
    } catch (e) {
      const msg = e.response?.data?.detail || "Checkout failed";
      toast.error(msg);
      if (e.response?.status === 412) {
        // phone verification required for registered users — switch to OTP step
        setStep(2);
      }
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center text-[#52525B]">
      Your cart is empty. <Link to="/products" className="text-[#FF3B30] hover:underline">Browse products</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="checkout-page">
      <h1 className="font-display text-4xl font-black tracking-tighter mb-2">Checkout</h1>
      {isGuest && (
        <p className="text-sm text-[#52525B] mb-8" data-testid="guest-checkout-note">
          Checking out as guest — no account needed. <Link to="/auth" className="text-[#FF3B30] hover:underline">Have an account? Login</Link>
        </p>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8" data-testid="checkout-stepper">
        {[
          { n: 1, label: "Details" },
          { n: 2, label: "Verify Phone" },
          { n: 3, label: "Payment" },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-[#FF3B30] text-white' : 'bg-black/10 text-[#52525B]'}`}>{step > s.n ? <Check size={14} weight="bold" /> : s.n}</div>
            <span className={`text-xs uppercase tracking-wider font-bold ${step === s.n ? 'text-[#0A0A0A]' : 'text-[#52525B]'}`}>{s.label}</span>
            {i < arr.length - 1 && <span className="w-8 h-px bg-black/10" />}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          {step === 1 && (
            <div className="bg-white border border-black/5 p-6 rounded-sm" data-testid="checkout-details-step">
              <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4">Your Details</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[["name", "Full Name"], ["email", "Email", "email"], ["phone", "Phone (with +91…)"], ["line1", "Address"], ["city", "City"], ["state", "State"], ["pincode", "PIN code"]].map(([k, label, type]) => (
                  <input key={k} type={type || "text"} value={addr[k]} onChange={e => setAddr({ ...addr, [k]: e.target.value })} placeholder={label}
                    className={`${k === "line1" ? "sm:col-span-2" : ""} px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]`} data-testid={`addr-${k}`} />
                ))}
              </div>
              {isGuest && (
                <div className="mt-4 space-y-2 pt-4 border-t border-black/5">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={register} onChange={e => setRegister(e.target.checked)} data-testid="register-toggle" />
                    Create an account with these details (we'll email you a temp password)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)} data-testid="marketing-optin-toggle" />
                    Send me offers and new-product updates
                  </label>
                </div>
              )}
              <button onClick={proceedToOtp} className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-[#FF3B30] text-white font-semibold px-6 py-3 rounded-sm transition-all" data-testid="checkout-continue-btn">
                Continue <ArrowRight />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white border border-black/5 p-6 rounded-sm" data-testid="checkout-otp-step">
              <div className="text-xs uppercase tracking-[0.2em] font-bold mb-3">Verify Phone</div>
              <p className="text-sm text-[#52525B] mb-4">
                We'll send a one-time code to <strong>{addr.phone}</strong> to confirm it's yours. {user ? "First-time verification required before placing an order." : ""}
              </p>
              {!otpSent ? (
                <button onClick={sendOtp} disabled={sendingOtp} className="bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-5 py-2.5 rounded-sm inline-flex items-center gap-2" data-testid="send-otp-btn">
                  {sendingOtp ? <><CircleNotch className="animate-spin" /> Sending…</> : "Send OTP"}
                </button>
              ) : (
                <div className="space-y-3">
                  <input value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code"
                    className="w-full px-3 py-2.5 text-lg tracking-[0.4em] text-center border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] font-mono" data-testid="otp-code-input" />
                  {otpHint && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-sm" data-testid="otp-dev-hint">{otpHint} <span className="text-[#52525B]">(dev mode — real SMS provider not configured)</span></div>}
                  <div className="flex gap-2">
                    <button onClick={verifyOtp} className="flex-1 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-5 py-2.5 rounded-sm" data-testid="verify-otp-btn">Verify & Continue</button>
                    <button onClick={sendOtp} className="text-sm text-[#52525B] hover:text-[#0A0A0A]" data-testid="resend-otp-btn">Resend</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="bg-white border border-black/5 p-6 rounded-sm" data-testid="checkout-payment-step">
              <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4">Payment Method</div>
              <div className="space-y-2">
                {settings.razorpay_enabled !== false && (
                  <label className={`flex items-center gap-3 p-3 border rounded-sm cursor-pointer ${method === 'razorpay' ? 'border-[#0A0A0A] bg-black/5' : 'border-black/10'}`} data-testid="pay-razorpay">
                    <input type="radio" checked={method === 'razorpay'} onChange={() => setMethod('razorpay')} />
                    <div><div className="font-semibold text-sm">Razorpay (UPI, Cards, NetBanking)</div><div className="text-xs text-[#52525B]">Pay securely via Razorpay</div></div>
                  </label>
                )}
                {settings.cod_enabled !== false && (
                  <label className={`flex items-center gap-3 p-3 border rounded-sm cursor-pointer ${method === 'cod' ? 'border-[#0A0A0A] bg-black/5' : 'border-black/10'}`} data-testid="pay-cod">
                    <input type="radio" checked={method === 'cod'} onChange={() => setMethod('cod')} />
                    <div><div className="font-semibold text-sm">Cash on Delivery</div><div className="text-xs text-[#52525B]">Pay when your order arrives</div></div>
                  </label>
                )}
              </div>
              <button onClick={placeOrder} disabled={loading} data-testid="place-order-btn" className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-sm">
                {loading ? "Processing…" : `Place Order — ₹${total.toFixed(2)}`}
              </button>
              <div className="flex items-center gap-2 mt-3 text-xs text-[#52525B]"><ShieldCheck size={14} className="text-[#FF3B30]" /> Secure SSL encrypted checkout</div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-black/5 p-6 rounded-sm sticky top-32">
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4">Order Summary</div>
            <div className="space-y-3 mb-4">
              {items.map(it => (
                <div key={it.id} className="flex gap-3 text-sm">
                  <img src={it.product?.image} alt="" className="w-12 h-12 object-cover rounded-sm" />
                  <div className="flex-1"><div className="font-medium">{it.product?.name}</div><div className="text-xs text-[#52525B]">Qty {it.quantity}</div></div>
                  <div className="font-semibold">₹{(it.product?.base_price || 0) * it.quantity}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-black/5 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>Shipping</span><span>{isFree ? "FREE" : `₹${shipping}`}</span></div>
              <div className="flex justify-between font-display font-black text-xl pt-2 border-t border-black/5"><span>Total</span><span data-testid="checkout-total">₹{total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
