import { useState, useEffect } from "react";
import { Modal, Field, Input, Textarea, Select, PrimaryBtn, GhostBtn } from "./Modal";
import { toast } from "sonner";
import api from "@/lib/api";

const EMPTY = { name: "", category: "", description: "", base_price: 0, image: "", variants: {}, tags: [], is_active: true };

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
        tags: typeof form.tags === "string" ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : (form.tags || []),
        is_active: !!form.is_active,
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
        <Field label="Image URL">
          <Input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://…" data-testid="product-image-input" />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="product-desc-input" />
        </Field>
        <Field label="Variants (one per line — key: value1, value2, …)">
          <Textarea rows={4} value={variantsText} onChange={e => setVariantsText(e.target.value)} data-testid="product-variants-input" />
        </Field>
        <Field label="Tags (comma-separated)">
          <Input value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} data-testid="product-tags-input" />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} data-testid="product-active-toggle" />
          <span className="text-sm">Active (visible to customers)</span>
        </label>
        {form.image && (
          <div className="text-xs text-[#52525B] mb-2">Preview:</div>
        )}
        {form.image && <img src={form.image} alt="" className="w-32 h-32 object-cover border border-black/10 rounded-sm" />}
        <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
          <GhostBtn onClick={onClose} data-testid="product-cancel-btn">Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving} data-testid="product-save-btn">{saving ? "Saving…" : "Save Product"}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
};

export default ProductForm;
