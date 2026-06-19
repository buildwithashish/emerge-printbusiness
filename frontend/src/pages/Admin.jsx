import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { toast } from "sonner";

const Tab = ({ active, onClick, children, id }) => (
  <button onClick={onClick} data-testid={`admin-tab-${id}`} className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-sm ${active ? 'bg-[#0A0A0A] text-white' : 'bg-white border border-black/10 hover:bg-black/5'}`}>{children}</button>
);

const Admin = () => {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) { nav("/auth"); return; }
    if (user.role !== "admin") { toast.error("Admin only"); nav("/"); return; }
    load();
  }, [user, ready]);

  const load = async () => {
    const [ov, ord, pr, rq, st] = await Promise.all([
      api.get("/admin/overview"), api.get("/admin/orders"),
      api.get("/products?limit=200"), api.get("/corporate/rfq"), api.get("/settings"),
    ]);
    setOverview(ov.data); setOrders(ord.data); setProducts(pr.data); setRfqs(rq.data); setSettings(st.data);
  };

  const updateStatus = async (oid, status) => {
    await api.put(`/admin/orders/${oid}/status`, { status });
    toast.success("Status updated");
    load();
  };

  const saveSettings = async () => {
    await api.put("/settings", settings);
    toast.success("Settings saved");
  };

  if (!ready) return <div className="max-w-6xl mx-auto px-4 py-20 text-center text-[#52525B]" data-testid="admin-loading">Loading…</div>;
  if (!user || user.role !== "admin") return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="admin-page">
      <h1 className="font-display text-4xl font-black tracking-tighter mb-6">Admin Console</h1>

      <div className="flex flex-wrap gap-2 mb-8">
        <Tab id="overview" active={tab==='overview'} onClick={()=>setTab('overview')}>Overview</Tab>
        <Tab id="orders" active={tab==='orders'} onClick={()=>setTab('orders')}>Orders</Tab>
        <Tab id="products" active={tab==='products'} onClick={()=>setTab('products')}>Products</Tab>
        <Tab id="rfqs" active={tab==='rfqs'} onClick={()=>setTab('rfqs')}>Corporate RFQs</Tab>
        <Tab id="settings" active={tab==='settings'} onClick={()=>setTab('settings')}>Settings</Tab>
      </div>

      {tab === 'overview' && overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="admin-overview">
          {[
            ["Revenue", `₹${overview.revenue?.toFixed(0)}`],
            ["Orders", overview.total_orders],
            ["Users", overview.total_users],
            ["Products", overview.total_products],
            ["Pending RFQs", overview.pending_rfqs],
          ].map(([k, v]) => (
            <div key={k} className="bg-white border border-black/5 p-5 rounded-sm">
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">{k}</div>
              <div className="font-display text-3xl font-black mt-2">{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-3" data-testid="admin-orders">
          {orders.length === 0 ? <div className="text-[#52525B]">No orders.</div> : orders.map(o => (
            <div key={o.id} className="bg-white border border-black/5 p-4 rounded-sm flex items-center justify-between">
              <div>
                <div className="font-bold">{o.order_number}</div>
                <div className="text-xs text-[#52525B]">₹{o.total} · {o.items.length} item(s) · {new Date(o.created_at).toLocaleString()}</div>
              </div>
              <select value={o.status} onChange={e=>updateStatus(o.id, e.target.value)} className="px-3 py-2 text-sm border border-black/10 rounded-sm" data-testid={`order-status-${o.id}`}>
                {["pending","paid","processing","design_approved","printing","packed","shipped","delivered","cancelled","returned"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {tab === 'products' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-products">
          {products.map(p => (
            <div key={p.id} className="bg-white border border-black/5 p-4 rounded-sm">
              <img src={p.image} alt={p.name} className="aspect-square object-cover rounded-sm mb-3" />
              <div className="font-semibold text-sm">{p.name}</div>
              <div className="text-xs text-[#52525B] mt-0.5">{p.category}</div>
              <div className="font-display font-bold text-lg mt-1">₹{p.base_price}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'rfqs' && (
        <div className="space-y-3" data-testid="admin-rfqs">
          {rfqs.length === 0 ? <div className="text-[#52525B]">No RFQs.</div> : rfqs.map(r => (
            <div key={r.id} className="bg-white border border-black/5 p-5 rounded-sm">
              <div className="flex justify-between mb-2">
                <div className="font-bold">{r.company}</div>
                <span className="text-xs uppercase tracking-wider bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-sm">{r.status}</span>
              </div>
              <div className="text-sm text-[#52525B]">{r.contact_name} · {r.email} · {r.phone}</div>
              <div className="text-sm mt-2">{r.products} · Qty {r.quantity} · {r.delivery_location}</div>
              {r.notes && <div className="text-xs text-[#52525B] mt-2 italic">"{r.notes}"</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && settings && (
        <div className="bg-white border border-black/5 p-6 rounded-sm space-y-4 max-w-2xl" data-testid="admin-settings">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-3">Payment Providers</div>
            {[["razorpay_enabled","Razorpay (India)"],["stripe_enabled","Stripe (Global)"],["cod_enabled","Cash on Delivery"]].map(([k,label]) => (
              <label key={k} className="flex items-center justify-between py-2 border-b border-black/5">
                <span className="text-sm">{label}</span>
                <input type="checkbox" checked={!!settings[k]} onChange={e=>setSettings({...settings, [k]: e.target.checked})} data-testid={`toggle-${k}`} />
              </label>
            ))}
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">AI Model</div>
            <select value={settings.ai_model || 'gpt-image-1'} onChange={e=>setSettings({...settings, ai_model: e.target.value})} className="w-full px-3 py-2 text-sm border border-black/10 rounded-sm" data-testid="ai-model-select">
              <option value="gpt-image-1">OpenAI GPT-Image-1</option>
              <option value="dall-e-3">OpenAI DALL·E 3</option>
            </select>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">SEO</div>
            <input value={settings.seo?.title || ''} onChange={e=>setSettings({...settings, seo: {...settings.seo, title: e.target.value}})} placeholder="Meta title" className="w-full px-3 py-2 text-sm border border-black/10 rounded-sm mb-2" data-testid="seo-title" />
            <textarea value={settings.seo?.description || ''} onChange={e=>setSettings({...settings, seo: {...settings.seo, description: e.target.value}})} placeholder="Meta description" rows={2} className="w-full px-3 py-2 text-sm border border-black/10 rounded-sm mb-2" data-testid="seo-desc" />
            <input value={settings.seo?.keywords || ''} onChange={e=>setSettings({...settings, seo: {...settings.seo, keywords: e.target.value}})} placeholder="Meta keywords" className="w-full px-3 py-2 text-sm border border-black/10 rounded-sm" data-testid="seo-keywords" />
          </div>
          <button onClick={saveSettings} data-testid="save-settings-btn" className="bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-5 py-2.5 rounded-sm">Save Settings</button>
        </div>
      )}
    </div>
  );
};

export default Admin;
