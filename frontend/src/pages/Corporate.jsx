import { useState, useEffect } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Buildings, ShieldCheck, Truck, ArrowRight, Check, Sparkle } from "@phosphor-icons/react";

const Corporate = () => {
  const [kitsData, setKitsData] = useState({ kits: [], customizable: true, customize_note: "" });
  const [selectedKit, setSelectedKit] = useState("standard");
  const [form, setForm] = useState({ company: "", contact_name: "", email: "", phone: "", products: "", quantity: 100, delivery_location: "", notes: "", kit_choice: "standard" });
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/corporate/kits").then(r => setKitsData(r.data));
  }, []);

  const pickKit = (slug) => {
    setSelectedKit(slug);
    setForm(f => ({ ...f, kit_choice: slug, products: slug === "custom" ? "" : (kitsData.kits.find(k => k.slug === slug)?.name || "") }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/corporate/rfq", form);
      setSubmitted(data);
      toast.success("Quote request submitted. We'll reply within 24 hours.");
    } catch (err) {
      toast.error("Could not submit. Please try again.");
    }
    setLoading(false);
  };

  if (submitted) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-testid="rfq-submitted">
      <Check size={48} weight="bold" className="text-[#FF3B30] mx-auto mb-4" />
      <h1 className="font-display text-4xl font-black tracking-tighter mb-3">Quote received!</h1>
      <p className="text-[#52525B] mb-6">Reference: <strong>{submitted.id.slice(0, 8).toUpperCase()}</strong>. Our team will email you within 24 hours.</p>
      <button onClick={() => setSubmitted(null)} className="text-sm font-semibold text-[#FF3B30] hover:underline" data-testid="new-rfq-btn">Submit another →</button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="corporate-page">
      <div className="mb-10">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">For Business</span>
        <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mt-2">Bulk orders that scale with your team</h1>
        <p className="text-[#52525B] text-base leading-relaxed mt-3 max-w-2xl">
          Onboarding kits, swag drops, festive gifting, conference giveaways — pick a ready-made kit below or talk to our team for a fully custom one. All kits ship across India in 7–14 days.
        </p>
      </div>

      {/* KITS GALLERY */}
      <section className="mb-12" data-testid="kits-gallery">
        <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-4">Available kits</div>
        <div className="grid md:grid-cols-3 gap-5">
          {kitsData.kits.map(kit => (
            <div
              key={kit.slug}
              onClick={() => pickKit(kit.slug)}
              data-testid={`kit-card-${kit.slug}`}
              className={`bg-white border-2 rounded-sm overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${selectedKit === kit.slug ? 'border-[#FF3B30]' : 'border-black/10'}`}
            >
              <div className="aspect-[4/3] bg-[#F4F4F5]">
                {kit.image && <img src={kit.image} alt={kit.name} className="w-full h-full object-cover" />}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display font-bold text-lg">{kit.name}</h3>
                  {selectedKit === kit.slug && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FF3B30] text-white px-2 py-0.5 rounded-sm">Selected</span>
                  )}
                </div>
                <div className="font-display font-black text-2xl mb-3">From ₹{kit.price_from}<span className="text-sm font-normal text-[#52525B]"> /kit</span></div>
                <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Includes</div>
                <ul className="space-y-1 mb-3" data-testid={`kit-includes-${kit.slug}`}>
                  {kit.includes.map((item, i) => (
                    <li key={i} className="text-sm text-[#0A0A0A] flex items-start gap-2">
                      <Check weight="bold" className="text-[#FF3B30] mt-0.5 shrink-0" size={14} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-[#52525B] flex items-center gap-1.5"><Truck size={14} weight="duotone" /> Lead time: {kit.lead_time}</div>
              </div>
            </div>
          ))}
          {/* CUSTOMIZE option — last */}
          <div
            onClick={() => pickKit("custom")}
            data-testid="kit-card-custom"
            className={`bg-gradient-to-br from-[#0A0A0A] to-[#1a1a1a] text-white border-2 rounded-sm overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${selectedKit === "custom" ? 'border-[#FF3B30]' : 'border-transparent'}`}
          >
            <div className="aspect-[4/3] flex items-center justify-center">
              <Sparkle size={64} weight="duotone" className="text-[#FF3B30]" />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display font-bold text-lg">Customize Your Kit</h3>
                {selectedKit === "custom" && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FF3B30] text-white px-2 py-0.5 rounded-sm">Selected</span>
                )}
              </div>
              <p className="text-sm text-white/80 mb-3 leading-relaxed">
                {kitsData.customize_note || "Mix products, choose colours, add your logo, set any quantity. We'll send a tailored quote in 24 hours."}
              </p>
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-white/60">Pricing on request</div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-[#52525B] italic">
          ℹ️ All kits can be customized — we'll discuss colors, branding, and additional products on the call after you submit the RFQ.
        </div>
      </section>

      {/* RFQ FORM */}
      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
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
          <div className="mt-8 p-5 bg-[#FAFAFA] border border-black/5 rounded-sm">
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-2">Login required</div>
            <p className="text-sm text-[#52525B]">
              For corporate orders we require login or registration so you can track quotes, invoices and approvals in your dashboard.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <form onSubmit={submit} className="bg-white border border-black/5 p-6 lg:p-8 rounded-sm space-y-4" data-testid="rfq-form">
            <div className="grid sm:grid-cols-2 gap-3">
              {[["company", "Company Name *"], ["contact_name", "Your Name *"], ["email", "Email *", "email"], ["phone", "Phone *"]].map(([k, label, type]) => (
                <div key={k}>
                  <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">{label}</label>
                  <input type={type || "text"} required={label.includes("*")} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid={`rfq-${k}`} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">
                Selected Kit
              </label>
              <div className="text-sm font-semibold p-2.5 bg-black/5 rounded-sm" data-testid="rfq-selected-kit">
                {selectedKit === "custom" ? "Custom Kit (tell us in notes below)" : kitsData.kits.find(k => k.slug === selectedKit)?.name}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Additional products / requirements</label>
              <input value={form.products} onChange={e => setForm({ ...form, products: e.target.value })} placeholder="e.g., add a hoodie + 100 stickers" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid="rfq-products" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Quantity (kits) *</label>
                <input type="number" min={1} required value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value || 0) })} className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid="rfq-quantity" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Delivery City *</label>
                <input required value={form.delivery_location} onChange={e => setForm({ ...form, delivery_location: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid="rfq-location" />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Notes / Customization details</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Deadlines, branding, colors, logo URL, custom items…" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] resize-none" data-testid="rfq-notes" />
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
