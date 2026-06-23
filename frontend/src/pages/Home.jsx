import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { ArrowRight, Sparkle, ShieldCheck, Truck, Medal, ArrowsClockwise, Star, Fire, TrendUp } from "@phosphor-icons/react";

const TRUST = [
  { icon: ShieldCheck, label: "Secure Payments" },
  { icon: Truck, label: "Fast Delivery 3–5 days" },
  { icon: Medal, label: "Quality Guarantee" },
  { icon: ArrowsClockwise, label: "Easy Returns" },
];

const CLIENTS = ["INFOSYS", "FLIPKART", "ZOMATO", "RAZORPAY", "SWIGGY", "PAYTM", "TATA", "WIPRO", "OYO", "OLA"];

const Home = () => {
  const [cats, setCats] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [trending, setTrending] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    api.get("/categories").then(r => setCats(r.data));
    api.get("/products/bestsellers?limit=8").then(r => setBestsellers(r.data));
    api.get("/products/trending?limit=6").then(r => setTrending(r.data));
    api.get("/reviews").then(r => setReviews(r.data.slice(0, 6)));
  }, []);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-black/5" data-testid="hero-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 fade-up">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-6">
              <span className="w-6 h-px bg-[#FF3B30]" /> Made in India · AI-Powered
            </span>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tighter mb-6">
              Custom merch.<br />
              <span className="text-[#FF3B30]">Designed by AI.</span><br />
              Delivered in days.
            </h1>
            <p className="text-lg text-[#52525B] max-w-xl leading-relaxed mb-10">
              From a single T-shirt to 10,000 corporate gift kits — upload your design, generate one with AI, or talk to our studio. We print it all.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/products" data-testid="hero-design-cta" className="inline-flex items-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-6 py-3.5 rounded-sm transition-all hover:-translate-y-0.5">
                Design My Product <ArrowRight size={18} weight="bold" />
              </Link>
              <Link to="/studio" data-testid="hero-ai-cta" className="inline-flex items-center gap-2 bg-white border border-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white text-[#0A0A0A] font-semibold px-6 py-3.5 rounded-sm transition-all">
                <Sparkle size={18} weight="duotone" /> Create With AI
              </Link>
              <Link to="/corporate" data-testid="hero-corp-cta" className="inline-flex items-center gap-2 bg-transparent border border-[#0A0A0A]/20 hover:border-[#0A0A0A] text-[#0A0A0A] font-semibold px-6 py-3.5 rounded-sm transition-all">
                Request Corporate Quote
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {TRUST.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#52525B]">
                  <t.icon size={20} weight="duotone" className="text-[#FF3B30]" />
                  <span className="font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative aspect-[4/5] rounded-sm overflow-hidden bg-[#F4F4F5] fade-up" data-testid="dynamic-hero-card">
              {bestsellers[0] ? (
                <Link to={`/products/${bestsellers[0].id}`} className="block w-full h-full group">
                  <img src={bestsellers[0].image} alt={bestsellers[0].name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-white/95 backdrop-blur px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider">
                    <Fire weight="fill" size={12} className="text-[#FF3B30]" /> #1 Bestseller
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display font-bold text-lg truncate" data-testid="hero-product-name">{bestsellers[0].name}</div>
                        <div className="text-xs text-[#52525B]">Print + ship in 3 days</div>
                      </div>
                      <div className="text-2xl font-display font-black shrink-0" data-testid="hero-product-price">₹{bestsellers[0].base_price}</div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#52525B] text-sm">Loading bestsellers…</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES — Bento Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20" data-testid="categories-section">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">Categories</span>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mt-2">Pick a canvas. Make it yours.</h2>
          </div>
          <Link to="/products" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold hover:text-[#FF3B30]" data-testid="view-all-categories">View all <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cats.map((c) => (
            <Link key={c.id} to={`/products?category=${c.slug}`} data-testid={`category-${c.slug}`} className="group relative aspect-square overflow-hidden rounded-sm bg-[#F4F4F5] border border-black/5 hover:-translate-y-1 hover:shadow-lg transition-all">
              <img src={c.image} alt={c.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="font-display text-white font-bold text-lg">{c.name}</div>
                <div className="text-white/80 text-xs uppercase tracking-wider mt-0.5 flex items-center gap-1">Shop <ArrowRight size={12} /></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* TRENDING NOW STRIP */}
      {trending.length > 0 && (
        <section className="bg-gradient-to-r from-[#FF3B30]/5 via-transparent to-[#FF3B30]/5 border-y border-black/5 py-12" data-testid="trending-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-6">
              <div>
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#FF3B30]">
                  <TrendUp weight="fill" /> Trending right now
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-2">Most ordered this week</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {trending.map((p, i) => (
                <Link to={`/products/${p.id}`} key={p.id} data-testid={`trending-${p.id}`} className="group relative">
                  <div className="aspect-square overflow-hidden rounded-sm bg-white border border-black/5">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 bg-[#0A0A0A] text-white text-xs font-black rounded-sm">#{i + 1}</div>
                  </div>
                  <div className="mt-2 text-xs font-semibold truncate">{p.name}</div>
                  <div className="text-xs font-display font-bold text-[#FF3B30]">₹{p.base_price}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BEST SELLERS */}
      {bestsellers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20" data-testid="best-sellers">
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">
                <Fire weight="fill" className="text-[#FF3B30]" /> Bestsellers
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mt-2">Customer favourites</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {bestsellers.map(p => (
              <Link to={`/products/${p.id}`} key={p.id} data-testid={`bestseller-card-${p.id}`} className="group block">
                <div className="aspect-square rounded-sm overflow-hidden bg-[#F4F4F5] border border-black/5 mb-3 relative">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  {p.low_stock && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-sm">Few left</span>
                  )}
                </div>
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-[#52525B] text-xs uppercase tracking-wider mt-0.5">{p.category}</div>
                <div className="font-display font-bold text-lg mt-1">₹{p.base_price}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* AI STUDIO TEASER */}
      <section className="bg-[#0A0A0A] text-white py-24" data-testid="studio-teaser">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#FF3B30] mb-6">
              <Sparkle weight="fill" /> AI Design Studio
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tight mb-5">No designer? No problem.<br />Type a prompt. Get artwork.</h2>
            <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-lg">
              Generate ready-to-print designs in seconds with our GPT-Image-1 powered studio. Refine, place on any product, and order in one flow.
            </p>
            <Link to="/studio" data-testid="studio-cta" className="inline-flex items-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-6 py-3.5 rounded-sm transition-all">
              Open AI Studio <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=600&q=80","https://images.unsplash.com/photo-1561070791-2526d30994b8?w=600&q=80","https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=600&q=80","https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80"].map((u, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-sm bg-white/5"><img src={u} alt="" className="w-full h-full object-cover" /></div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20" data-testid="reviews-section">
        <div className="mb-10">
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">Loved by</span>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mt-2">5,000+ happy customers</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {reviews.map(r => (
            <div key={r.id} className="border border-black/5 bg-white p-6 rounded-sm" data-testid={`review-${r.id}`}>
              <div className="flex gap-0.5 text-[#FF3B30] mb-3">
                {Array.from({ length: r.rating }).map((_, i) => (<Star key={i} size={16} weight="fill" />))}
              </div>
              <p className="text-sm leading-relaxed mb-4">&ldquo;{r.comment}&rdquo;</p>
              {r.image_url && <img src={r.image_url} alt="" className="w-full h-32 object-cover rounded-sm mb-3" />}
              <div className="text-xs font-bold uppercase tracking-wider">{r.user_name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CORPORATE LOGOS */}
      <section className="py-16 border-t border-black/5 overflow-hidden" data-testid="corporate-strip">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">Trusted by brands</span>
        </div>
        <div className="relative">
          <div className="flex gap-24 animate-marquee whitespace-nowrap">
            {[...CLIENTS, ...CLIENTS].map((c, i) => (
              <span key={i} className="font-display font-black text-2xl text-[#52525B]/60 tracking-tighter">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CORPORATE CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20" data-testid="corporate-cta-section">
        <div className="bg-[#FAFAFA] border border-black/10 rounded-sm p-10 md:p-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">For Business</span>
            <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mt-2 mb-4">Bulk orders. Branded gifts. Zero hassle.</h2>
            <p className="text-[#52525B] mb-6">Onboarding kits, swag drops, festive gifting — get a quote in 24 hours and dedicated account support.</p>
            <Link to="/corporate" data-testid="bottom-corp-cta" className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#FF3B30] text-white font-semibold px-6 py-3.5 rounded-sm transition-all">
              Request a Quote <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1499, 999, 599].map((p, i) => (
              <div key={i} className="aspect-square bg-white border border-black/5 p-4 flex flex-col justify-between">
                <div className="text-xs uppercase tracking-widest text-[#52525B] font-bold">Kit {i + 1}</div>
                <div className="font-display font-black text-2xl">₹{p}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
