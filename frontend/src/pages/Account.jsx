import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { ArrowRight, Package } from "@phosphor-icons/react";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const Account = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [designs, setDesigns] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get("/orders").then(r => setOrders(r.data));
    api.get("/designs/mine").then(r => setDesigns(r.data));
  }, [user]);

  if (!user) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-black mb-3">Please login</h1>
      <Link to="/auth" className="inline-flex items-center gap-2 bg-[#FF3B30] text-white px-5 py-2.5 rounded-sm font-semibold">Login</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="account-page">
      <div className="mb-10">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">Account</span>
        <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mt-2">Hi, {user.name}</h1>
        <p className="text-[#52525B] text-sm mt-1">{user.email}</p>
      </div>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-bold mb-4 flex items-center gap-2"><Package weight="duotone" /> Your Orders</h2>
        {orders.length === 0 ? (
          <div className="text-[#52525B] text-sm">No orders yet. <Link to="/products" className="text-[#FF3B30] hover:underline">Start shopping</Link></div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="bg-white border border-black/5 p-5 rounded-sm flex items-center justify-between" data-testid={`order-${o.id}`}>
                <div>
                  <div className="font-bold">{o.order_number}</div>
                  <div className="text-xs text-[#52525B] mt-0.5">{new Date(o.created_at).toLocaleDateString()} · {o.items.length} item(s)</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold">₹{o.total}</div>
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${STATUS_COLORS[o.status] || 'bg-black/5'}`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Saved Designs</h2>
        {designs.length === 0 ? (
          <div className="text-[#52525B] text-sm">No saved designs. <Link to="/studio" className="text-[#FF3B30] hover:underline">Open AI Studio</Link></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {designs.map(d => (
              <div key={d.id} className="aspect-square overflow-hidden bg-[#F4F4F5] border border-black/5 rounded-sm" data-testid={`design-${d.id}`}>
                <img src={d.data_url} alt={d.prompt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Account;
