import { useState, useEffect } from "react";
import { Modal, Field, Input, Textarea, Select, PrimaryBtn, GhostBtn } from "./Modal";
import { toast } from "sonner";
import api from "@/lib/api";

const EMPTY = {
  name: "", category: "", description: "", base_price: 0, image: "",
  variants: {}, variant_images: {}, tags: [], is_active: true,
  is_bestseller: false, low_stock: false, watching_count: 0,
};

const ProductForm = ({ open, onClose, product, categories, onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  const [variantsText, setVariantsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({ ...EMPTY, ...product });
      setVariantsText(Object.entries(product.variants || {}).map(([k, v]) => `${k}: ${(v || []).join(", ")}`).join("\n"));
    } else {
      setForm({ ...EMPTY, category: categories[0]?.slug || "" });
      setVariantsText("size: S, M, L\ncolor: Black, White");
    }
  }, [open, product, categories]);

  const parseVariants = (text) => {
    const obj = {};
    text.split("\n").forEach(line => {
      const [k, v] = line.split(":");
      if (k && v) obj[k.trim()] = v.split(",").map(s => s.trim()).filter(Boolean);
    });
    return obj;
  };

  const variants = parseVariants(variantsText);
  const colors = variants.color || [];

  const setColorImage = (color, url) => {
    setForm(f => ({
      ...f,
      variant_images: {
        ...f.variant_images,
        color: { ...(f.variant_images?.color || {}), [color]: url },
      },
    }));
  };

  const save = async () => {
    if (!form.name || !form.category || !form.base_price) {
      toast.error("Name, category, and price are required"); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        description: form.description || "",
        base_price: parseFloat(form.base_price),
        image: form.image || "",
        variants: parseVariants(variantsText),
        variant_images: form.variant_images || {},
        tags: typeof form.tags === "string" ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : (form.tags || []),
        is_active: !!form.is_active,
        is_bestseller: !!form.is_bestseller,
        low_stock: !!form.low_stock,
        watching_count: parseInt(form.watching_count) || 0,
      };
      if (product?.id) {
        await api.put(`/products/${product.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? "Edit Product" : "New Product"} size="lg">
      <div className="space-y-4" data-testid="product-form">
        <Field label="Name *">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="product-name-input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category *">
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="product-category-select">
              <option value="">Select…</option>
              {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Base Price (₹) *">
            <Input type="number" min={0} value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })} data-testid="product-price-input" />
          </Field>
        </div>
        <Field label="Default Image URL">
          <Input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://…" data-testid="product-image-input" />
        </Field>
        {form.image && <img src={form.image} alt="" className="w-24 h-24 object-cover border border-black/10 rounded-sm" />}
        <Field label="Description">
          <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="product-desc-input" />
        </Field>
        <Field label="Variants (one per line — key: value1, value2, …)">
          <Textarea rows={3} value={variantsText} onChange={e => setVariantsText(e.target.value)} data-testid="product-variants-input" />
        </Field>

        {/* Per-color images */}
        {colors.length > 0 && (
          <div className="border border-black/10 rounded-sm p-4 bg-black/[0.02]" data-testid="variant-images-section">
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-3">Color-specific images</div>
            <div className="space-y-2">
              {colors.map(color => (
                <div key={color} className="flex items-center gap-3">
                  <div className="text-sm font-bold w-24 truncate">{color}</div>
                  <Input
                    value={form.variant_images?.color?.[color] || ""}
                    onChange={e => setColorImage(color, e.target.value)}
                    placeholder="https://image-url-for-this-color.jpg"
                    data-testid={`color-image-${color}`}
                  />
                  {form.variant_images?.color?.[color] && (
                    <img src={form.variant_images.color[color]} alt="" className="w-10 h-10 object-cover border border-black/10 rounded-sm shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="Tags (comma-separated)">
          <Input value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} data-testid="product-tags-input" />
        </Field>

        <div className="grid grid-cols-3 gap-3 p-3 border border-black/10 rounded-sm bg-black/[0.02]">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} data-testid="product-active-toggle" />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.is_bestseller} onChange={e => setForm({ ...form, is_bestseller: e.target.checked })} data-testid="product-bestseller-toggle" />
            Mark as Bestseller
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.low_stock} onChange={e => setForm({ ...form, low_stock: e.target.checked })} data-testid="product-lowstock-toggle" />
            Few units left
          </label>
        </div>

        <Field label="People viewing now (for social-proof badge)">
          <Input type="number" min={0} value={form.watching_count} onChange={e => setForm({ ...form, watching_count: e.target.value })} data-testid="product-watching-input" />
        </Field>

        <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
          <GhostBtn onClick={onClose} data-testid="product-cancel-btn">Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving} data-testid="product-save-btn">{saving ? "Saving…" : "Save Product"}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
};

export default ProductForm;
