import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Sparkle, Download, MagicWand, ArrowRight, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

const STYLES = ["Minimalist", "Anime", "Vintage", "Vaporwave", "Bauhaus", "Hand-drawn", "Photoreal", "Corporate Modern"];

const DesignStudio = () => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Minimalist");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState("");
  const [history, setHistory] = useState([]);
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get("/designs/mine").then(r => setHistory(r.data)).catch(()=>{});
  }, [user]);

  const enhance = async () => {
    if (!prompt) return;
    setEnhancing(true);
    try {
      const { data } = await api.post("/ai/enhance-prompt", { prompt });
      setPrompt(data.enhanced);
      toast.success("Prompt enhanced");
    } catch (e) { toast.error("Could not enhance prompt"); }
    setEnhancing(false);
  };

  const generate = async () => {
    if (!prompt) { toast.error("Enter a prompt"); return; }
    setLoading(true);
    setImage("");
    try {
      const { data } = await api.post("/ai/generate-image", { prompt, style });
      setImage(data.image);
      setHistory(h => [{ id: data.id, prompt, data_url: data.image }, ...h]);
      toast.success("Artwork ready");
    } catch (e) { toast.error(e.response?.data?.detail || "Generation failed"); }
    setLoading(false);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = image; a.download = `merchcraft-${Date.now()}.png`; a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="design-studio-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">AI Studio</span>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mt-2">Generate your design</h1>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] font-bold mb-2 block">Prompt</label>
            <textarea data-testid="prompt-input" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="A cyberpunk astronaut cat riding a scooter in Mumbai, neon lights, retro illustration"
              rows={4} className="w-full px-4 py-3 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30] resize-none" />
            <button onClick={enhance} disabled={enhancing || !prompt} data-testid="enhance-prompt-btn" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF3B30] hover:underline disabled:opacity-50">
              <MagicWand weight="duotone" /> {enhancing ? "Enhancing…" : "Enhance with AI"}
            </button>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] font-bold mb-2 block">Style</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(s => (
                <button key={s} onClick={()=>setStyle(s)} data-testid={`style-${s}`}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-sm transition-all ${style===s ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]' : 'bg-white border-black/15 hover:border-[#0A0A0A]'}`}>{s}</button>
              ))}
            </div>
          </div>

          <button onClick={generate} disabled={loading} data-testid="generate-btn"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] disabled:opacity-60 text-white font-semibold px-6 py-3.5 rounded-sm transition-all">
            {loading ? <><Spinner className="animate-spin" /> Generating…</> : <><Sparkle weight="fill" /> Generate Artwork</>}
          </button>

          <div className="text-xs text-[#52525B] leading-relaxed pt-3 border-t border-black/5">
            <strong>Tip:</strong> Be specific about subject, style, colors, and composition. Try "isometric, flat colors, no background".
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className={`aspect-square bg-[#F4F4F5] border border-black/5 rounded-sm overflow-hidden flex items-center justify-center ${loading ? 'tracing-border' : ''}`} data-testid="canvas-area">
            {loading ? (
              <div className="text-center text-[#52525B]">
                <Spinner size={32} className="animate-spin mx-auto mb-3 text-[#FF3B30]" />
                <div className="font-display font-bold">Generating your artwork…</div>
                <div className="text-xs uppercase tracking-wider mt-1">Powered by GPT-Image-1</div>
              </div>
            ) : image ? (
              <img src={image} alt="Generated artwork" className="w-full h-full object-contain" data-testid="generated-image" />
            ) : (
              <div className="text-center text-[#52525B] p-8">
                <Sparkle size={36} weight="duotone" className="text-[#FF3B30] mx-auto mb-3" />
                <div className="font-display font-bold">Your AI canvas</div>
                <div className="text-xs mt-1">Enter a prompt to generate artwork</div>
              </div>
            )}
          </div>

          {image && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={download} data-testid="download-btn" className="inline-flex items-center gap-2 bg-white border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white font-semibold px-5 py-2.5 rounded-sm transition-all text-sm">
                <Download weight="bold" /> Download
              </button>
              <Link to="/products" data-testid="apply-to-product-btn" className="inline-flex items-center gap-2 bg-[#FF3B30] hover:bg-[#D63328] text-white font-semibold px-5 py-2.5 rounded-sm transition-all text-sm">
                Apply to a Product <ArrowRight weight="bold" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-16">
          <h3 className="font-display text-2xl font-bold mb-4">Your designs</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {history.slice(0,12).map(h => (
              <button key={h.id} onClick={()=>setImage(h.data_url)} className="aspect-square overflow-hidden bg-[#F4F4F5] border border-black/5 rounded-sm hover:-translate-y-1 transition-all" data-testid={`history-${h.id}`}>
                <img src={h.data_url} alt={h.prompt} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignStudio;
