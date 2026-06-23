import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Trash, Plus, Eye, Power, MagnifyingGlass, Upload, Fire, Warning, Crown, Download, BellRinging, EnvelopeSimple, ChatCircleText, WhatsappLogo, CheckCircle, X as XIcon } from "@phosphor-icons/react";
import ProductForm from "@/components/admin/ProductForm";
import CategoryForm from "@/components/admin/CategoryForm";
import OrderDetail from "@/components/admin/OrderDetail";
import AdminForm from "@/components/admin/AdminForm";
import { PrimaryBtn, GhostBtn, DangerBtn, Input, Select } from "@/components/admin/Modal";

const BASE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "orders", label: "Orders" },
  { id: "users", label: "Customers" },
  { id: "notifications", label: "Notifications" },
  { id: "rfqs", label: "Corporate RFQs" },
  { id: "settings", label: "Settings" },
];

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  design_approved: "bg-indigo-100 text-indigo-800",
  printing: "bg-indigo-100 text-indigo-800",
  packed: "bg-purple-100 text-purple-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-red-100 text-red-800",
};

const Admin = () => {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");

  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [notifLog, setNotifLog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [broadcastForm, setBroadcastForm] = useState({ subject: "", body: "", channels: ["email", "sms", "whatsapp"] });

  const [prodSearch, setProdSearch] = useState("");
  const [prodCatFilter, setProdCatFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [categoryModal, setCategoryModal] = useState({ open: false, category: null });
  const [orderModal, setOrderModal] = useState({ open: false, order: null });
  const [adminModal, setAdminModal] = useState(false);

  const csvInput = useRef();

  const isSuperAdmin = user?.role === "superadmin";
  const TABS = isSuperAdmin ? [...BASE_TABS.slice(0, 5), { id: "admins", label: "Admins" }, ...BASE_TABS.slice(5)] : BASE_TABS;

  useEffect(() => {
    if (!ready) return;
    if (!user) { nav("/auth"); return; }
    if (user.role !== "admin" && user.role !== "superadmin") { toast.error("Admin only"); nav("/"); return; }
    loadAll();
  }, [user, ready]);

  const loadAll = async () => {
    const promises = [
      api.get("/admin/overview"),
      api.get("/admin/orders"),
      api.get("/products?limit=500"),
      api.get("/admin/categories"),
      api.get("/admin/users"),
      api.get("/corporate/rfq"),
      api.get("/settings"),
      api.get("/admin/notifications-log?limit=100"),
      api.get("/admin/alerts"),
    ];
    if (isSuperAdmin) promises.push(api.get("/admin/admins"));
    const results = await Promise.all(promises);
    setOverview(results[0].data); setOrders(results[1].data);
    setProducts(results[2].data); setCategories(results[3].data);
    setUsers(results[4].data); setRfqs(results[5].data);
    setSettings(results[6].data); setNotifLog(results[7].data); setAlerts(results[8].data);
    if (isSuperAdmin) setAdmins(results[9].data);
  };

  const reloadProducts = async () => setProducts((await api.get("/products?limit=500")).data);
  const reloadCategories = async () => setCategories((await api.get("/admin/categories")).data);
  const reloadOrders = async () => setOrders((await api.get("/admin/orders")).data);
  const reloadUsers = async () => setUsers((await api.get("/admin/users")).data);
  const reloadAdmins = async () => setAdmins((await api.get("/admin/admins")).data);
  const reloadNotifLog = async () => setNotifLog((await api.get("/admin/notifications-log?limit=100")).data);

  const triggerVerification = async (u, channel) => {
    try {
      const { data } = await api.post(`/admin/users/${u.id}/trigger-verification`, { channel });
      toast.success(`${channel === 'email' ? 'Email' : 'SMS'} OTP sent${data.dev_code ? ` (dev: ${data.dev_code})` : ''}`, { duration: 6000 });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const sendBroadcast = async () => {
    if (!broadcastForm.body) { toast.error("Message body required"); return; }
    try {
      const { data } = await api.post("/admin/broadcast", broadcastForm);
      toast.success(`Sent · email:${data.counts.email} sms:${data.counts.sms} whatsapp:${data.counts.whatsapp}`, { duration: 6000 });
      setBroadcastForm({ subject: "", body: "", channels: ["email", "sms", "whatsapp"] });
      reloadNotifLog();
    } catch (e) { toast.error(e.response?.data?.detail || "Broadcast failed"); }
  };

  const runAutoBestseller = async () => {
    try {
      await api.post("/admin/run-auto-bestseller");
      toast.success("Auto-bestseller rule executed");
      reloadProducts();
    } catch (e) { toast.error("Failed"); }
  };

  const downloadSampleCSV = () => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/products/sample-csv`;
    window.open(url, "_blank");
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    await api.delete(`/products/${p.id}`); toast.success("Product deleted"); reloadProducts();
  };
  const toggleBestseller = async (p) => {
    await api.patch(`/products/${p.id}/flags`, { is_bestseller: !p.is_bestseller });
    toast.success(p.is_bestseller ? "Removed from bestsellers" : "Marked as bestseller");
    reloadProducts();
  };
  const toggleLowStock = async (p) => {
    await api.patch(`/products/${p.id}/flags`, { low_stock: !p.low_stock });
    reloadProducts();
  };

  const deleteCategory = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    await api.delete(`/categories/${c.id}`); toast.success("Category deleted"); reloadCategories();
  };
  const toggleCategory = async (c) => { await api.patch(`/categories/${c.id}/toggle`); reloadCategories(); };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user ${u.email}?`)) return;
    try { await api.delete(`/admin/users/${u.id}`); toast.success("User deleted"); reloadUsers(); }
    catch (e) { toast.error(e.response?.data?.detail || "Cannot delete"); }
  };
  const deleteAdmin = async (a) => {
    if (!window.confirm(`Remove admin ${a.email}?`)) return;
    try { await api.delete(`/admin/admins/${a.id}`); toast.success("Admin removed"); reloadAdmins(); }
    catch (e) { toast.error(e.response?.data?.detail || "Cannot delete"); }
  };

  const saveSettings = async () => {
    await api.put("/settings", settings);
    toast.success("Settings saved");
  };

  const uploadCSV = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await api.post("/products/bulk-import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Imported ${r.data.created} products${r.data.errors?.length ? ` · ${r.data.errors.length} errors` : ''}`);
      if (r.data.errors?.length) console.warn("CSV errors:", r.data.errors);
      reloadProducts();
    } catch (e) { toast.error(e.response?.data?.detail || "Import failed"); }
    if (csvInput.current) csvInput.current.value = "";
  };

  if (!ready) return <div className="max-w-6xl mx-auto px-4 py-20 text-center text-[#52525B]" data-testid="admin-loading">Loading…</div>;
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return null;

  const filteredProducts = products.filter(p =>
    (!prodCatFilter || p.category === prodCatFilter) &&
    (!prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()))
  );
  const filteredUsers = users.filter(u =>
    !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.name.toLowerCase().includes(userSearch.toLowerCase())
  );
  const filteredOrders = orders.filter(o =>
    !orderSearch || o.order_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.customer?.email?.toLowerCase().includes(orderSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="admin-page">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] inline-flex items-center gap-2">
            {isSuperAdmin && <Crown weight="fill" className="text-[#FF3B30]" data-testid="admin-crown-icon" />}
            {isSuperAdmin ? "Super Admin Console" : "Admin Console"}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mt-1">Operations</h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 border-b border-black/5 pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`admin-tab-${t.id}`}
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-sm transition-all ${tab === t.id ? 'bg-[#0A0A0A] text-white' : 'bg-white border border-black/10 hover:bg-black/5'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && overview && (
        <div data-testid="admin-overview">
          {alerts.filter(a => !a.read).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 mb-6" data-testid="admin-alerts-strip">
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-amber-900 mb-2 inline-flex items-center gap-2"><Warning weight="fill" /> Alerts</div>
              {alerts.filter(a => !a.read).slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span data-testid={`alert-${a.id}`}>{a.message}</span>
                  <button onClick={async () => { await api.patch(`/admin/alerts/${a.id}/read`); setAlerts(alerts.filter(x => x.id !== a.id)); }} className="text-xs text-amber-900 hover:underline" data-testid={`alert-dismiss-${a.id}`}>Dismiss</button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              ["Revenue", `₹${overview.revenue?.toFixed(0)}`],
              ["Orders", overview.total_orders],
              ["Customers", overview.total_users],
              ["Products", overview.total_products],
              ["Pending RFQs", overview.pending_rfqs],
            ].map(([k, v]) => (
              <div key={k} className="bg-white border border-black/5 p-5 rounded-sm">
                <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">{k}</div>
                <div className="font-display text-3xl font-black mt-2">{v}</div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-black/5 p-6 rounded-sm">
            <h3 className="font-display text-xl font-bold mb-3">Recent Orders</h3>
            {overview.recent_orders.length === 0 ? <div className="text-[#52525B] text-sm">No orders yet.</div> : (
              <div className="space-y-2">
                {overview.recent_orders.map(o => (
                  <div key={o.id} className="flex justify-between text-sm p-3 border-b border-black/5">
                    <div><span className="font-bold">{o.order_number}</span> <span className="text-[#52525B]">· {o.items.length} item(s)</span></div>
                    <div><span className="font-display font-bold">₹{o.total}</span> <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${STATUS_COLORS[o.status] || 'bg-black/5'}`}>{o.status}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRODUCTS */}
      {tab === "products" && (
        <div data-testid="admin-products">
          <div className="flex flex-col sm:flex-row gap-3 mb-5 items-stretch sm:items-center justify-between">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
                <Input value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder="Search products…" className="pl-9" data-testid="admin-prod-search" />
              </div>
              <Select value={prodCatFilter} onChange={e => setProdCatFilter(e.target.value)} data-testid="admin-prod-cat-filter">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </Select>
            </div>
            <div className="flex gap-2">
              <input ref={csvInput} type="file" accept=".csv" onChange={uploadCSV} className="hidden" data-testid="csv-upload-input" />
              <GhostBtn onClick={downloadSampleCSV} data-testid="download-sample-csv-btn"><span className="inline-flex items-center gap-2"><Download weight="bold" /> Sample CSV</span></GhostBtn>
              <GhostBtn onClick={() => csvInput.current?.click()} data-testid="csv-upload-btn"><span className="inline-flex items-center gap-2"><Upload weight="bold" /> Bulk CSV Import</span></GhostBtn>
              <GhostBtn onClick={runAutoBestseller} data-testid="run-auto-bestseller-btn"><span className="inline-flex items-center gap-2"><Fire weight="bold" /> Auto-mark Bestsellers</span></GhostBtn>
              <PrimaryBtn onClick={() => setProductModal({ open: true, product: null })} data-testid="admin-new-product-btn"><span className="inline-flex items-center gap-2"><Plus weight="bold" /> New Product</span></PrimaryBtn>
            </div>
          </div>

          <div className="text-xs text-[#52525B] mb-3 bg-blue-50 border border-blue-200 px-3 py-2 rounded-sm">
            <strong>CSV format:</strong> name, category, description, base_price, image, tags, is_active, is_bestseller, low_stock, variants_size, variants_color, variants_fabric. Use <code>|</code> to separate multi-value cells (e.g., <code>S|M|L|XL</code>).
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-[#52525B]" data-testid="no-products">No products found.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white border border-black/5 rounded-sm overflow-hidden flex flex-col" data-testid={`admin-product-${p.id}`}>
                  <div className="aspect-square bg-[#F4F4F5] relative">
                    {p.image && <img src={p.image} alt={p.name} className="w-full h-full object-cover" />}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {p.is_bestseller && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#FF3B30] text-white px-2 py-0.5 rounded-sm" data-testid={`bestseller-badge-${p.id}`}><Fire weight="fill" size={10} /> Best</span>}
                      {p.low_stock && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-sm"><Warning weight="fill" size={10} /> Low</span>}
                      {!p.is_active && <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-sm">Inactive</span>}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-[#52525B] mt-0.5 uppercase tracking-wider">{p.category}</div>
                    <div className="font-display font-bold text-lg mt-1">₹{p.base_price}</div>
                    <div className="text-xs text-[#52525B] mt-1">Sold: {p.sold_count || 0} · 👁 {p.watching_count || 0}</div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => toggleBestseller(p)} data-testid={`toggle-bestseller-${p.id}`} title="Mark/Unmark Bestseller" className={`inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border py-2 px-2 rounded-sm ${p.is_bestseller ? 'bg-[#FF3B30] text-white border-[#FF3B30]' : 'border-black/15 hover:bg-black/5'}`}>
                        <Fire size={12} weight={p.is_bestseller ? "fill" : "regular"} />
                      </button>
                      <button onClick={() => toggleLowStock(p)} data-testid={`toggle-lowstock-${p.id}`} title="Mark/Unmark Few Units" className={`inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border py-2 px-2 rounded-sm ${p.low_stock ? 'bg-amber-100 text-amber-900 border-amber-300' : 'border-black/15 hover:bg-black/5'}`}>
                        <Warning size={12} weight={p.low_stock ? "fill" : "regular"} />
                      </button>
                      <button onClick={() => setProductModal({ open: true, product: p })} data-testid={`edit-product-${p.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider border border-black/15 hover:bg-black/5 py-2 rounded-sm">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => deleteProduct(p)} data-testid={`delete-product-${p.id}`} className="inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border border-red-300 text-red-600 hover:bg-red-50 py-2 px-2 rounded-sm">
                        <Trash size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORIES */}
      {tab === "categories" && (
        <div data-testid="admin-categories">
          <div className="flex justify-between mb-5">
            <div className="text-sm text-[#52525B]">{categories.length} categories</div>
            <PrimaryBtn onClick={() => setCategoryModal({ open: true, category: null })} data-testid="admin-new-category-btn"><span className="inline-flex items-center gap-2"><Plus weight="bold" /> New Category</span></PrimaryBtn>
          </div>
          {categories.length === 0 ? <div className="text-center py-16 text-[#52525B]">No categories yet.</div> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(c => (
                <div key={c.id} className="bg-white border border-black/5 rounded-sm overflow-hidden" data-testid={`admin-category-${c.id}`}>
                  <div className="aspect-[3/2] bg-[#F4F4F5] relative">
                    {c.image && <img src={c.image} alt={c.name} className="w-full h-full object-cover" />}
                    {!c.is_active && <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-sm">Disabled</span>}
                  </div>
                  <div className="p-4">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-[#52525B] mt-0.5">/{c.slug}</div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setCategoryModal({ open: true, category: c })} data-testid={`edit-category-${c.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider border border-black/15 hover:bg-black/5 py-2 rounded-sm"><Pencil size={14} /> Edit</button>
                      <button onClick={() => toggleCategory(c)} data-testid={`toggle-category-${c.id}`} className={`inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border py-2 px-3 rounded-sm ${c.is_active ? 'border-black/15 hover:bg-black/5' : 'border-green-300 text-green-700 hover:bg-green-50'}`}><Power size={14} /></button>
                      <button onClick={() => deleteCategory(c)} data-testid={`delete-category-${c.id}`} className="inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border border-red-300 text-red-600 hover:bg-red-50 py-2 px-3 rounded-sm"><Trash size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ORDERS */}
      {tab === "orders" && (
        <div data-testid="admin-orders">
          <div className="flex gap-3 mb-5 items-center">
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
              <Input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Search by order # or email…" className="pl-9" data-testid="admin-order-search" />
            </div>
            <div className="text-sm text-[#52525B]">{filteredOrders.length} order(s)</div>
          </div>
          {filteredOrders.length === 0 ? <div className="text-center py-16 text-[#52525B]">No orders.</div> : (
            <div className="bg-white border border-black/5 rounded-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-black/5">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Order</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Customer</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Items</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Total</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Status</th>
                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id} className="border-t border-black/5 hover:bg-black/[0.02]" data-testid={`admin-order-row-${o.id}`}>
                      <td className="px-4 py-3 font-bold">{o.order_number}</td>
                      <td className="px-4 py-3"><div>{o.customer?.name || "—"}</div><div className="text-xs text-[#52525B]">{o.customer?.email}</div></td>
                      <td className="px-4 py-3">{o.items.length}</td>
                      <td className="px-4 py-3 font-display font-bold">₹{o.total}</td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${STATUS_COLORS[o.status] || 'bg-black/5'}`}>{o.status}</span></td>
                      <td className="px-4 py-3 text-xs text-[#52525B]">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setOrderModal({ open: true, order: o })} data-testid={`view-order-${o.id}`} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider border border-black/15 hover:bg-black/5 py-1.5 px-3 rounded-sm">
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMERS */}
      {tab === "users" && (
        <div data-testid="admin-users">
          <div className="flex gap-3 mb-5 items-center">
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
              <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9" data-testid="admin-user-search" />
            </div>
            <div className="text-sm text-[#52525B]">{filteredUsers.length} customer(s)</div>
          </div>
          <div className="bg-white border border-black/5 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/5">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Name</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Contact</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Verified</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Type</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Orders</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-t border-black/5 hover:bg-black/[0.02]" data-testid={`admin-user-row-${u.id}`}>
                    <td className="px-4 py-3 font-semibold">{u.name}</td>
                    <td className="px-4 py-3 text-[#52525B]"><div>{u.email}</div>{u.phone && <div className="text-xs">{u.phone}</div>}</td>
                    <td className="px-4 py-3" data-testid={`user-verify-${u.id}`}>
                      <div className="flex gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${u.email_verified ? 'bg-green-100 text-green-800' : 'bg-black/5 text-[#52525B]'}`}>
                          {u.email_verified ? <CheckCircle weight="fill" size={10} /> : <XIcon size={10} />} email
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${u.phone_verified ? 'bg-green-100 text-green-800' : 'bg-black/5 text-[#52525B]'}`}>
                          {u.phone_verified ? <CheckCircle weight="fill" size={10} /> : <XIcon size={10} />} phone
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${u.is_guest ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{u.is_guest ? "Guest" : "Registered"}</span>
                    </td>
                    <td className="px-4 py-3">{u.order_count}</td>
                    <td className="px-4 py-3 text-xs text-[#52525B]">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => triggerVerification(u, "sms")} data-testid={`verify-sms-${u.id}`} title="Send SMS OTP" className="inline-flex items-center justify-center text-xs font-bold border border-black/15 hover:bg-black/5 py-1.5 px-2 rounded-sm">
                          <ChatCircleText size={12} />
                        </button>
                        <button onClick={() => triggerVerification(u, "email")} data-testid={`verify-email-${u.id}`} title="Send Email OTP" className="inline-flex items-center justify-center text-xs font-bold border border-black/15 hover:bg-black/5 py-1.5 px-2 rounded-sm">
                          <EnvelopeSimple size={12} />
                        </button>
                        <DangerBtn onClick={() => deleteUser(u)} data-testid={`delete-user-${u.id}`} className="!py-1.5 !px-2 !text-xs">
                          <Trash size={12} />
                        </DangerBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADMINS — superadmin only */}
      {tab === "admins" && isSuperAdmin && (
        <div data-testid="admin-admins">
          <div className="flex justify-between mb-5 items-center">
            <div className="text-sm text-[#52525B]">{admins.length} admin account(s)</div>
            <PrimaryBtn onClick={() => setAdminModal(true)} data-testid="new-admin-btn"><span className="inline-flex items-center gap-2"><Plus weight="bold" /> New Admin</span></PrimaryBtn>
          </div>
          <div className="bg-white border border-black/5 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/5">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Name</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Email</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Role</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} className="border-t border-black/5 hover:bg-black/[0.02]" data-testid={`admin-row-${a.id}`}>
                    <td className="px-4 py-3 font-semibold">{a.name}{a.id === user.id && <span className="ml-2 text-[10px] uppercase tracking-wider text-[#52525B]">(you)</span>}</td>
                    <td className="px-4 py-3 text-[#52525B]">{a.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${a.role === 'superadmin' ? 'bg-[#FF3B30] text-white' : 'bg-black/10'}`}>
                        {a.role === 'superadmin' && <Crown size={10} weight="fill" className="inline mr-1" />}
                        {a.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525B]">{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {a.role !== 'superadmin' && (
                        <DangerBtn onClick={() => deleteAdmin(a)} data-testid={`delete-admin-${a.id}`} className="!py-1.5 !px-3 !text-xs">
                          <Trash size={14} />
                        </DangerBtn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === "notifications" && (
        <div data-testid="admin-notifications" className="space-y-8">
          <div className="bg-white border border-black/5 p-6 rounded-sm" data-testid="broadcast-card">
            <h3 className="font-display text-xl font-bold mb-3 inline-flex items-center gap-2"><BellRinging weight="duotone" /> Send broadcast to customers</h3>
            <p className="text-xs text-[#52525B] mb-4">Goes to: <strong>verified email</strong> only · <strong>verified phone</strong> for SMS · <strong>WhatsApp</strong> to any valid phone. Guests are always included; opted-out registered users are skipped.</p>
            <Input value={broadcastForm.subject} onChange={e => setBroadcastForm({ ...broadcastForm, subject: e.target.value })} placeholder="Email subject (optional). Use {name} merge field." className="mb-2" data-testid="broadcast-subject" />
            <textarea value={broadcastForm.body} onChange={e => setBroadcastForm({ ...broadcastForm, body: e.target.value })} rows={4} placeholder="Hi {name}, our new Snapback Cap just dropped — use code WELCOME10…" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] resize-none mb-3" data-testid="broadcast-body" />
            <div className="flex flex-wrap gap-3 mb-4">
              {[["email", "Email", EnvelopeSimple], ["sms", "SMS", ChatCircleText], ["whatsapp", "WhatsApp", WhatsappLogo]].map(([ch, label, Icon]) => (
                <label key={ch} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={broadcastForm.channels.includes(ch)} onChange={e => setBroadcastForm(b => ({ ...b, channels: e.target.checked ? [...b.channels, ch] : b.channels.filter(c => c !== ch) }))} data-testid={`broadcast-channel-${ch}`} />
                  <Icon size={14} weight="duotone" /> {label}
                </label>
              ))}
            </div>
            <PrimaryBtn onClick={sendBroadcast} data-testid="send-broadcast-btn">Send Broadcast</PrimaryBtn>
          </div>

          {settings && settings.templates && (
            <div className="bg-white border border-black/5 p-6 rounded-sm" data-testid="templates-card">
              <h3 className="font-display text-xl font-bold mb-3">Notification Templates</h3>
              <p className="text-xs text-[#52525B] mb-4">Merge fields: <code>{`{name}`}</code> <code>{`{order_number}`}</code> <code>{`{total}`}</code> <code>{`{status}`}</code> <code>{`{code}`}</code> <code>{`{password}`}</code> <code>{`{email}`}</code></p>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {Object.entries(settings.templates).map(([key, tpl]) => (
                  <div key={key} className="border border-black/10 rounded-sm p-3" data-testid={`template-${key}`}>
                    <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">{key.replace(/_/g, ' ')}</div>
                    {tpl.subject !== undefined && (
                      <Input value={tpl.subject} onChange={e => setSettings({ ...settings, templates: { ...settings.templates, [key]: { ...tpl, subject: e.target.value } } })} placeholder="Subject" className="mb-2 !text-xs" data-testid={`tpl-${key}-subject`} />
                    )}
                    <textarea value={tpl.body || ""} onChange={e => setSettings({ ...settings, templates: { ...settings.templates, [key]: { ...tpl, body: e.target.value } } })} rows={2} className="w-full px-3 py-2 text-xs border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] resize-none font-mono" data-testid={`tpl-${key}-body`} />
                  </div>
                ))}
              </div>
              <PrimaryBtn onClick={saveSettings} className="mt-4" data-testid="save-templates-btn">Save Templates</PrimaryBtn>
            </div>
          )}

          <div className="bg-white border border-black/5 p-6 rounded-sm" data-testid="notifications-log-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl font-bold">Notifications log</h3>
              <GhostBtn onClick={reloadNotifLog} data-testid="refresh-log-btn" className="!py-1.5 !px-3 !text-xs">Refresh</GhostBtn>
            </div>
            <p className="text-xs text-[#52525B] mb-3 bg-amber-50 border border-amber-200 px-3 py-2 rounded-sm">
              ⚠ <strong>Notifications are MOCKED</strong> (logged here instead of sent). Plug Twilio/SendGrid/WhatsApp-Business credentials into <code>backend/.env</code> to enable real delivery.
            </p>
            {notifLog.length === 0 ? <div className="text-center py-8 text-[#52525B] text-sm">No notifications yet.</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/5"><tr className="text-left">
                    <th className="px-3 py-2 text-xs uppercase tracking-wider font-bold">Channel</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wider font-bold">Target</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wider font-bold">Subject/Body</th>
                    <th className="px-3 py-2 text-xs uppercase tracking-wider font-bold">When</th>
                  </tr></thead>
                  <tbody>
                    {notifLog.slice(0, 50).map(n => (
                      <tr key={n.id} className="border-t border-black/5" data-testid={`notif-row-${n.id}`}>
                        <td className="px-3 py-2"><span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${n.channel === 'email' ? 'bg-blue-100 text-blue-800' : n.channel === 'sms' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{n.channel}</span></td>
                        <td className="px-3 py-2 text-xs text-[#52525B]">{n.target}</td>
                        <td className="px-3 py-2 text-xs"><div className="font-semibold truncate max-w-md">{n.subject || ""}</div><div className="text-[#52525B] truncate max-w-md">{n.body}</div></td>
                        <td className="px-3 py-2 text-xs text-[#52525B] whitespace-nowrap">{new Date(n.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {/* RFQs */}
      {tab === "rfqs" && (
        <div className="space-y-3" data-testid="admin-rfqs">
          {rfqs.length === 0 ? <div className="text-[#52525B] text-center py-16">No RFQs yet.</div> : rfqs.map(r => (
            <div key={r.id} className="bg-white border border-black/5 p-5 rounded-sm">
              <div className="flex justify-between mb-2">
                <div className="font-bold text-lg">{r.company}</div>
                <span className="text-xs uppercase tracking-wider bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-sm">{r.status}</span>
              </div>
              <div className="text-sm text-[#52525B]">{r.contact_name} · {r.email} · {r.phone}</div>
              <div className="text-sm mt-2">{r.products} · Qty {r.quantity} · {r.delivery_location}</div>
              {r.notes && <div className="text-xs text-[#52525B] mt-2 italic">&ldquo;{r.notes}&rdquo;</div>}
              <div className="text-[10px] uppercase tracking-wider text-[#52525B] mt-3">Received {new Date(r.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && settings && (
        <div className="bg-white border border-black/5 p-6 rounded-sm space-y-5 max-w-2xl" data-testid="admin-settings">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-3">Payment Providers</div>
            {[["razorpay_enabled", "Razorpay (India)"], ["stripe_enabled", "Stripe (Global)"], ["cod_enabled", "Cash on Delivery"]].map(([k, label]) => (
              <label key={k} className="flex items-center justify-between py-2 border-b border-black/5">
                <span className="text-sm">{label}</span>
                <input type="checkbox" checked={!!settings[k]} onChange={e => setSettings({ ...settings, [k]: e.target.checked })} data-testid={`toggle-${k}`} />
              </label>
            ))}
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">Free Shipping Threshold (₹)</div>
            <Input type="number" min={0} value={settings.free_shipping_threshold || 0} onChange={e => setSettings({ ...settings, free_shipping_threshold: parseInt(e.target.value || 0) })} data-testid="free-shipping-threshold-input" />
            <div className="text-xs text-[#52525B] mt-1">Orders ≥ this amount get FREE shipping (else ₹49). Shown to customers as a flash card.</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">Notification Scheduler Hour (24h, IST)</div>
            <Input type="number" min={0} max={23} value={settings.scheduler_hour ?? 8} onChange={e => setSettings({ ...settings, scheduler_hour: parseInt(e.target.value || 0) })} data-testid="scheduler-hour-input" />
            <div className="text-xs text-[#52525B] mt-1">Daily status-change notifications run at this hour. Default 8 = 8:00 AM.</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">Auto-bestseller threshold (sold count)</div>
            <Input type="number" min={1} value={settings.bestseller_threshold ?? 200} onChange={e => setSettings({ ...settings, bestseller_threshold: parseInt(e.target.value || 0) })} data-testid="bestseller-threshold-input" />
            <div className="text-xs text-[#52525B] mt-1">Products with sold_count ≥ this (in active categories) get auto-marked bestseller daily at 2 AM.</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">AI Model</div>
            <Select value={settings.ai_model || 'gpt-image-1'} onChange={e => setSettings({ ...settings, ai_model: e.target.value })} data-testid="ai-model-select">
              <option value="gpt-image-1">OpenAI GPT-Image-1</option>
              <option value="dall-e-3">OpenAI DALL·E 3</option>
            </Select>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">SEO Meta</div>
            <Input value={settings.seo?.title || ''} onChange={e => setSettings({ ...settings, seo: { ...settings.seo, title: e.target.value } })} placeholder="Meta title" className="mb-2" data-testid="seo-title" />
            <textarea value={settings.seo?.description || ''} onChange={e => setSettings({ ...settings, seo: { ...settings.seo, description: e.target.value } })} placeholder="Meta description" rows={2} className="w-full px-3 py-2 text-sm border border-black/10 rounded-sm mb-2" data-testid="seo-desc" />
            <Input value={settings.seo?.keywords || ''} onChange={e => setSettings({ ...settings, seo: { ...settings.seo, keywords: e.target.value } })} placeholder="Meta keywords" data-testid="seo-keywords" />
          </div>
          <PrimaryBtn onClick={saveSettings} data-testid="save-settings-btn">Save Settings</PrimaryBtn>
        </div>
      )}

      {/* MODALS */}
      <ProductForm
        open={productModal.open}
        onClose={() => setProductModal({ open: false, product: null })}
        product={productModal.product}
        categories={categories}
        onSaved={reloadProducts}
      />
      <CategoryForm
        open={categoryModal.open}
        onClose={() => setCategoryModal({ open: false, category: null })}
        category={categoryModal.category}
        onSaved={reloadCategories}
      />
      <OrderDetail
        open={orderModal.open}
        onClose={() => setOrderModal({ open: false, order: null })}
        order={orderModal.order}
        onChanged={async () => {
          await reloadOrders();
          const fresh = (await api.get("/admin/orders")).data.find(o => o.id === orderModal.order?.id);
          if (fresh) setOrderModal({ open: true, order: fresh });
        }}
      />
      <AdminForm
        open={adminModal}
        onClose={() => setAdminModal(false)}
        onSaved={reloadAdmins}
      />
    </div>
  );
};

export default Admin;
