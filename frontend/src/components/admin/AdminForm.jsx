import { useState } from "react";
import { Modal, Field, Input, PrimaryBtn, GhostBtn } from "./Modal";
import api from "@/lib/api";
import { toast } from "sonner";

const AdminForm = ({ open, onClose, onSaved }) => {
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.email || !form.name || !form.password) {
      toast.error("All fields required"); return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be ≥ 6 chars"); return;
    }
    setSaving(true);
    try {
      await api.post("/admin/admins", form);
      toast.success("Admin created");
      setForm({ email: "", name: "", password: "" });
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="New Admin">
      <div className="space-y-4" data-testid="admin-form">
        <Field label="Name *">
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="admin-name-input" />
        </Field>
        <Field label="Email *">
          <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="admin-email-input" />
        </Field>
        <Field label="Initial Password *">
          <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" data-testid="admin-password-input" />
        </Field>
        <div className="flex justify-end gap-3 pt-4 border-t border-black/5">
          <GhostBtn onClick={onClose} data-testid="admin-cancel-btn">Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving} data-testid="admin-save-btn">{saving ? "Creating…" : "Create Admin"}</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
};

export default AdminForm;
