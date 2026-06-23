import { useState, useEffect } from "react";
import { X } from "@phosphor-icons/react";

export const Modal = ({ open, onClose, title, children, size = "md" }) => {
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  const widthCls = size === "lg" ? "max-w-3xl" : size === "xl" ? "max-w-5xl" : "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="modal-backdrop">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white border border-black/5 rounded-sm w-full ${widthCls} max-h-[90vh] overflow-y-auto`} data-testid="modal-panel">
        <div className="sticky top-0 z-10 bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-black tracking-tight">{title}</h3>
          <button onClick={onClose} data-testid="modal-close" className="p-1 hover:bg-black/5 rounded-sm"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export const Field = ({ label, children, testid }) => (
  <div>
    <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block text-[#52525B]" data-testid={testid ? `${testid}-label` : undefined}>{label}</label>
    {children}
  </div>
);

export const Input = (props) => (
  <input {...props} className={`w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] ${props.className || ''}`} />
);

export const Textarea = (props) => (
  <textarea {...props} className={`w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] resize-none ${props.className || ''}`} />
);

export const Select = (props) => (
  <select {...props} className={`w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] ${props.className || ''}`}>{props.children}</select>
);

export const PrimaryBtn = ({ children, ...p }) => (
  <button {...p} className={`bg-[#FF3B30] hover:bg-[#D63328] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-sm transition-all ${p.className || ''}`}>{children}</button>
);

export const GhostBtn = ({ children, ...p }) => (
  <button {...p} className={`bg-white border border-black/15 hover:bg-black/5 text-[#0A0A0A] font-semibold px-5 py-2.5 rounded-sm transition-all ${p.className || ''}`}>{children}</button>
);

export const DangerBtn = ({ children, ...p }) => (
  <button {...p} className={`bg-white border border-red-300 hover:bg-red-50 text-red-600 font-semibold px-5 py-2.5 rounded-sm transition-all ${p.className || ''}`}>{children}</button>
);
