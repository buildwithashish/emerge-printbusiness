import { useState, useEffect } from "react";
import { Modal, Field, Input, PrimaryBtn, GhostBtn } from "./Modal";
import { toast } from "sonner";
import api from "@/lib/api";

const EMPTY = { slug: "", name: "", image: "", is_active: true };

const slugify = (s) => s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");

const CategoryForm = ({ open, onClose, category, onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(category ? { ...EMPTY, ...category } : EMPTY);
  }, [open, category]);

  const save = async () => {
    if (!form.slug || !form.name) {
      toast.error("Slug and name required"); return;
    }
    setSaving(true);
    try {
      const payload = { slug: form.slug, name: form.name, image: form.image || "", is_active: !!form.is_active };
      if (category?.id) {
        await api.put(`/categories/${category.id}`, payload);
        toast.success("Category updated");
      } else {
        await api.post("/categories", payload);
        toast.success("Category created");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={category ? "Edit Category" : "New Category"}>
      <div className="space-y-4" data-testid="category-form">
        <Field label="Name *">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: category?.slug || slugify(e.target.value) })} data-testid="category-name-input" />
        </Field>
        <Field label="Slug *">
          <Input value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} data-testid="category-slug-input" />
        </Field>
        <Field label="Image URL">
          <Input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://…" data-testid="category-image-input" />
        </Field>
        {form.image && <img src={form.image} alt="" className="w-32 h-32 object-cover border border-black/10 rounded-sm" />}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} data-testid="category-active-toggle" />
          <span className="text-sm">Active (visible to customers)</span>
        </label>
        <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
          <GhostBtn onClick={onClose} data-testid="category-cancel-btn">Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving} data-testid="category-save-btn">{saving ? "Saving…" : "Save"}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
};

export default CategoryForm;
