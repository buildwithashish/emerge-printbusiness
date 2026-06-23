import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Trash, Plus, Eye, Power, MagnifyingGlass } from "@phosphor-icons/react";
import ProductForm from "@/components/admin/ProductForm";
import CategoryForm from "@/components/admin/CategoryForm";
import OrderDetail from "@/components/admin/OrderDetail";
import { PrimaryBtn, GhostBtn, DangerBtn, Input, Select } from "@/components/admin/Modal";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "orders", label: "Orders" },
  { id: "users", label: "Users" },
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
  const [rfqs, setRfqs] = useState([]);
  const [settings, setSettings] = useState(null);

  // search / filter
  const [prodSearch, setProdSearch] = useState("");
  const [prodCatFilter, setProdCatFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  // modal state
  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [categoryModal, setCategoryModal] = useState({ open: false, category: null });
  const [orderModal, setOrderModal] = useState({ open: false, order: null });

  useEffect(() => {
    if (!ready) return;
    if (!user) { nav("/auth"); return; }
    if (user.role !== "admin") { toast.error("Admin only"); nav("/"); return; }
    loadAll();
  }, [user, ready]);

  const loadAll = async () => {
    const [ov, ord, pr, cats, us, rq, st] = await Promise.all([
      api.get("/admin/overview"),
      api.get("/admin/orders"),
      api.get("/products?limit=500"),
      api.get("/admin/categories"),
      api.get("/admin/users"),
      api.get("/corporate/rfq"),
      api.get("/settings"),
    ]);
    setOverview(ov.data); setOrders(ord.data); setProducts(pr.data);
    setCategories(cats.data); setUsers(us.data); setRfqs(rq.data); setSettings(st.data);
  };

  const reloadProducts = async () => {
    const r = await api.get("/products?limit=500");
    setProducts(r.data);
  };
  const reloadCategories = async () => {
    const r = await api.get("/admin/categories");
    setCategories(r.data);
  };
  const reloadOrders = async () => {
    const r = await api.get("/admin/orders");
    setOrders(r.data);
  };
  const reloadUsers = async () => {
    const r = await api.get("/admin/users");
    setUsers(r.data);
  };

  const deleteProduct = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    await api.delete(`/products/${p.id}`);
    toast.success("Product deleted");
    reloadProducts();
  };

  const deleteCategory = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"? Products in this category will remain but become orphaned.`)) return;
    await api.delete(`/categories/${c.id}`);
    toast.success("Category deleted");
    reloadCategories();
  };

  const toggleCategory = async (c) => {
    await api.patch(`/categories/${c.id}/toggle`);
    reloadCategories();
  };

  const changeUserRole = async (u, role) => {
    await api.put(`/admin/users/${u.id}`, { role });
    toast.success("Role updated");
    reloadUsers();
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete user ${u.email}?`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("User deleted");
      reloadUsers();
    } catch (e) { toast.error(e.response?.data?.detail || "Cannot delete"); }
  };

  const saveSettings = async () => {
    await api.put("/settings", settings);
    toast.success("Settings saved");
  };

  if (!ready) return <div className="max-w-6xl mx-auto px-4 py-20 text-center text-[#52525B]" data-testid="admin-loading">Loading…</div>;
  if (!user || user.role !== "admin") return null;

  // filtered slices
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
      <div className="mb-8">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">Admin Console</span>
        <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mt-1">Operations</h1>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
            <PrimaryBtn onClick={() => setProductModal({ open: true, product: null })} data-testid="admin-new-product-btn"><span className="inline-flex items-center gap-2"><Plus weight="bold" /> New Product</span></PrimaryBtn>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-[#52525B]" data-testid="no-products">No products found.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredProducts.map(p => (
                <div key={p.id} className="bg-white border border-black/5 rounded-sm overflow-hidden flex flex-col" data-testid={`admin-product-${p.id}`}>
                  <div className="aspect-square bg-[#F4F4F5] relative">
                    {p.image && <img src={p.image} alt={p.name} className="w-full h-full object-cover" />}
                    {!p.is_active && <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-sm">Inactive</span>}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-[#52525B] mt-0.5 uppercase tracking-wider">{p.category}</div>
                    <div className="font-display font-bold text-lg mt-1">₹{p.base_price}</div>
                    <div className="text-xs text-[#52525B] mt-1">Sold: {p.sold_count || 0}</div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setProductModal({ open: true, product: p })} data-testid={`edit-product-${p.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider border border-black/15 hover:bg-black/5 py-2 rounded-sm">
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => deleteProduct(p)} data-testid={`delete-product-${p.id}`} className="inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border border-red-300 text-red-600 hover:bg-red-50 py-2 px-3 rounded-sm">
                        <Trash size={14} />
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
            <div className="text-sm text-[#52525B]">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</div>
            <PrimaryBtn onClick={() => setCategoryModal({ open: true, category: null })} data-testid="admin-new-category-btn"><span className="inline-flex items-center gap-2"><Plus weight="bold" /> New Category</span></PrimaryBtn>
          </div>
          {categories.length === 0 ? (
            <div className="text-center py-16 text-[#52525B]">No categories yet.</div>
          ) : (
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
                      <button onClick={() => setCategoryModal({ open: true, category: c })} data-testid={`edit-category-${c.id}`} className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider border border-black/15 hover:bg-black/5 py-2 rounded-sm">
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => toggleCategory(c)} data-testid={`toggle-category-${c.id}`} className={`inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border py-2 px-3 rounded-sm ${c.is_active ? 'border-black/15 hover:bg-black/5' : 'border-green-300 text-green-700 hover:bg-green-50'}`}>
                        <Power size={14} />
                      </button>
                      <button onClick={() => deleteCategory(c)} data-testid={`delete-category-${c.id}`} className="inline-flex items-center justify-center text-xs font-bold uppercase tracking-wider border border-red-300 text-red-600 hover:bg-red-50 py-2 px-3 rounded-sm">
                        <Trash size={14} />
                      </button>
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
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-[#52525B]">No orders.</div>
          ) : (
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
                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold"></th>
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

      {/* USERS */}
      {tab === "users" && (
        <div data-testid="admin-users">
          <div className="flex gap-3 mb-5 items-center">
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
              <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9" data-testid="admin-user-search" />
            </div>
            <div className="text-sm text-[#52525B]">{filteredUsers.length} user(s)</div>
          </div>
          <div className="bg-white border border-black/5 rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/5">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Name</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Email</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Orders</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Role</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold">Joined</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-t border-black/5 hover:bg-black/[0.02]" data-testid={`admin-user-row-${u.id}`}>
                    <td className="px-4 py-3 font-semibold">{u.name}</td>
                    <td className="px-4 py-3 text-[#52525B]">{u.email}</td>
                    <td className="px-4 py-3">{u.order_count}</td>
                    <td className="px-4 py-3">
                      <Select value={u.role} onChange={e => changeUserRole(u, e.target.value)} className="!py-1.5 !text-xs !w-auto" data-testid={`user-role-${u.id}`}>
                        <option value="customer">customer</option>
                        <option value="admin">admin</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#52525B]">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <DangerBtn onClick={() => deleteUser(u)} data-testid={`delete-user-${u.id}`} className="!py-1.5 !px-3 !text-xs">
                        <Trash size={14} />
                      </DangerBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          // refresh the open modal's order data from latest list (don't close)
          const fresh = (await api.get("/admin/orders")).data.find(o => o.id === orderModal.order?.id);
          if (fresh) setOrderModal({ open: true, order: fresh });
        }}
      />
    </div>
  );
};

export default Admin;
