import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { ShoppingBag, Sparkle, ShieldCheck, Truck, Eye, Star, Fire, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";

const ProductDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [variants, setVariants] = useState({});
  const [qty, setQty] = useState(1);
  const [designUrl, setDesignUrl] = useState("");
  const [text, setText] = useState("");

  useEffect(() => { api.get(`/products/${id}`).then(r => setP(r.data)); }, [id]);
  useEffect(() => {
    if (!p) return;
    const init = {};
    Object.entries(p.variants || {}).forEach(([k, v]) => { init[k] = v[0]; });
    setVariants(init);
  }, [p]);

  // pick image based on selected color (or fallback)
  const displayedImage = useMemo(() => {
    if (!p) return "";
    const color = variants.color;
    const map = p.variant_images?.color;
    if (color && map && map[color]) return map[color];
    return p.image || "";
  }, [p, variants]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setDesignUrl(reader.result);
    reader.readAsDataURL(f);
  };

  const handleAdd = async () => {
    if (!user) { toast.info("Login first to add to cart"); nav("/auth"); return; }
    await addToCart({
      product_id: p.id,
      quantity: qty,
      variants,
      custom_design_url: designUrl || null,
      custom_text: text || null,
    });
    toast.success("Added to cart");
  };

  if (!p) return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-[#52525B]">Loading…</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="product-detail-page">
      <div className="grid lg:grid-cols-12 gap-10">
        {/* Preview pane */}
        <div className="lg:col-span-8">
          <div className="relative aspect-square bg-[#F4F4F5] border border-black/5 rounded-sm overflow-hidden">
            <img src={displayedImage} alt={p.name} className="w-full h-full object-cover transition-opacity duration-300" data-testid="product-main-image" />
            {designUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <img src={designUrl} alt="design" className="w-1/3 h-1/3 object-contain drop-shadow-2xl" data-testid="design-overlay" />
              </div>
            )}
            {text && !designUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="font-display font-black text-3xl text-white drop-shadow-lg">{text}</div>
              </div>
            )}
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {p.is_bestseller && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#FF3B30] text-white px-2.5 py-1 rounded-sm" data-testid="badge-bestseller">
                  <Fire weight="fill" size={12} /> Bestseller
                </span>
              )}
              {p.low_stock && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-1 rounded-sm" data-testid="badge-low-stock">
                  <Warning weight="fill" size={12} /> Few units left
                </span>
              )}
            </div>
            {p.watching_count > 0 && (
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 text-xs font-medium bg-white/95 backdrop-blur px-3 py-1.5 rounded-sm" data-testid="watching-indicator">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <Eye size={14} weight="duotone" /> {p.watching_count} viewing now
              </div>
            )}
          </div>
        </div>

        {/* Configurator */}
        <div className="lg:col-span-4 lg:sticky lg:top-32 lg:self-start space-y-6">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">{p.category}</span>
            <h1 className="font-display text-3xl font-black tracking-tight mt-1" data-testid="product-name">{p.name}</h1>
            <div className="font-display text-3xl font-black mt-3" data-testid="product-price">₹{p.base_price}</div>
            <p className="text-sm text-[#52525B] mt-3 leading-relaxed">{p.description}</p>
          </div>

          {Object.entries(p.variants || {}).map(([key, options]) => (
            <div key={key}>
              <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2 flex items-center justify-between">
                <span>{key}</span>
                <span className="text-[#52525B] normal-case tracking-normal">{variants[key]}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map(opt => (
                  <button key={opt} onClick={() => setVariants(v => ({ ...v, [key]: opt }))}
                    data-testid={`variant-${key}-${opt}`}
                    className={`px-3 py-2 text-sm border rounded-sm transition-all ${variants[key] === opt ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-black/15 bg-white hover:border-[#0A0A0A]'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold mb-2">Customize</div>
            <input type="file" accept="image/*" onChange={onFile} className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:border file:border-black/15 file:bg-white file:font-bold file:text-xs file:uppercase file:tracking-wider hover:file:bg-black/5" data-testid="upload-design-input" />
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Or add custom text…" className="mt-2 w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" data-testid="custom-text-input" />
            <Link to="/studio" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#FF3B30] hover:underline" data-testid="ai-studio-link">
              <Sparkle weight="fill" /> Generate design with AI
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs uppercase tracking-[0.2em] font-bold">Qty</div>
            <div className="flex items-center border border-black/15 rounded-sm">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-1.5 hover:bg-black/5" data-testid="qty-dec">−</button>
              <div className="px-4 text-sm font-semibold" data-testid="qty-val">{qty}</div>
              <button onClick={() => setQty(qty + 1)} className="px-3 py-1.5 hover:bg-black/5" data-testid="qty-inc">+</button>
            </div>
          </div>

          <button onClick={handleAdd} data-testid="add-to-cart-btn" className="w-full inline-flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-6 py-3.5 rounded-sm transition-all hover:-translate-y-0.5">
            <ShoppingBag weight="bold" /> Add to Cart — ₹{p.base_price * qty}
          </button>

          <div className="grid grid-cols-2 gap-3 text-xs text-[#52525B] pt-4 border-t border-black/5">
            <div className="flex items-center gap-2"><ShieldCheck size={18} weight="duotone" className="text-[#FF3B30]" /> Secure checkout</div>
            <div className="flex items-center gap-2"><Truck size={18} weight="duotone" className="text-[#FF3B30]" /> Delivery in 3-5 days</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
