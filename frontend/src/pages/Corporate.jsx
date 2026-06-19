import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Buildings, ShieldCheck, Truck, ArrowRight, Check } from "@phosphor-icons/react";

const Corporate = () => {
  const [form, setForm] = useState({ company: "", contact_name: "", email: "", phone: "", products: "", quantity: 100, delivery_location: "", notes: "" });
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/corporate/rfq", form);
      setSubmitted(data);
      toast.success("Quote request submitted. We'll reply within 24 hours.");
    } catch (e) {
      toast.error("Could not submit. Please try again.");
    }
    setLoading(false);
  };

  if (submitted) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-testid="rfq-submitted">
      <Check size={48} weight="bold" className="text-[#FF3B30] mx-auto mb-4" />
      <h1 className="font-display text-4xl font-black tracking-tighter mb-3">Quote received!</h1>
      <p className="text-[#52525B] mb-6">Reference: <strong>{submitted.id.slice(0,8).toUpperCase()}</strong>. Our team will email you within 24 hours.</p>
      <button onClick={()=>setSubmitted(null)} className="text-sm font-semibold text-[#FF3B30] hover:underline" data-testid="new-rfq-btn">Submit another →</button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="corporate-page">
      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">For Business</span>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mt-2 mb-4">Bulk orders that scale with your team</h1>
          <p className="text-[#52525B] text-base leading-relaxed mb-8">
            Onboarding kits, swag drops, festive gifting, conference giveaways — we handle design, printing, packaging, and delivery across India.
          </p>
          <div className="space-y-3">
            {[
              { icon: Buildings, t: "Dedicated account manager" },
              { icon: ShieldCheck, t: "GST invoicing & PO terms" },
              { icon: Truck, t: "Pan-India delivery from 7 hubs" },
              { icon: Check, t: "Volume discounts from 50 units" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3"><f.icon size={20} weight="duotone" className="text-[#FF3B30]" /><span className="text-sm font-medium">{f.t}</span></div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <form onSubmit={submit} className="bg-white border border-black/5 p-6 lg:p-8 rounded-sm space-y-4" data-testid="rfq-form">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ["company", "Company Name *"], ["contact_name", "Your Name *"],
                ["email", "Email *", "email"], ["phone", "Phone *"],
              ].map(([k, label, type]) => (
                <div key={k}>
                  <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">{label}</label>
                  <input type={type||"text"} required={label.includes("*")} value={form[k]} onChange={e=>setForm({...form, [k]: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid={`rfq-${k}`} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Products / Items *</label>
              <input required value={form.products} onChange={e=>setForm({...form, products: e.target.value})} placeholder="e.g., 200 T-shirts + 200 mugs + 100 tote bags" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid="rfq-products" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Total Quantity *</label>
                <input type="number" min={1} required value={form.quantity} onChange={e=>setForm({...form, quantity: parseInt(e.target.value||0)})} className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid="rfq-quantity" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Delivery City *</label>
                <input required value={form.delivery_location} onChange={e=>setForm({...form, delivery_location: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid="rfq-location" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Notes</label>
              <textarea rows={3} value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Deadlines, branding requirements, design files…" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] resize-none" data-testid="rfq-notes" />
            </div>
            <button type="submit" disabled={loading} data-testid="rfq-submit" className="w-full inline-flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-sm transition-all">
              {loading ? "Submitting…" : <>Request Quote <ArrowRight weight="bold" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Corporate;
