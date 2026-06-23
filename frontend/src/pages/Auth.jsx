import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const Auth = () => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name, phone, marketingOptIn);
      toast.success(mode === "login" ? "Welcome back!" : "Account created");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Authentication failed");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16" data-testid="auth-page">
      <h1 className="font-display text-4xl font-black tracking-tighter mb-2">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="text-[#52525B] text-sm mb-8">{mode === 'login' ? 'Login to continue your design.' : 'Start designing custom merch in minutes.'}</p>

      <form onSubmit={submit} className="space-y-4 bg-white border border-black/5 p-6 rounded-sm">
        {mode === "register" && (
          <div>
            <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} required data-testid="auth-name" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" />
          </div>
        )}
        {mode === "register" && (
          <div>
            <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Phone (optional, for order updates)</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91…" data-testid="auth-phone" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" />
          </div>
        )}
        <div>
          <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required data-testid="auth-email" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] font-bold mb-1.5 block">Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required data-testid="auth-password" className="w-full px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" />
        </div>
        <button type="submit" disabled={loading} data-testid="auth-submit" className="w-full bg-[#FF3B30] hover:bg-[#D63328] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-sm">
          {loading ? "Please wait…" : (mode === 'login' ? 'Login' : 'Create Account')}
        </button>
        {mode === "register" && (
          <label className="flex items-center gap-2 text-sm pt-2">
            <input type="checkbox" checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)} data-testid="auth-marketing-optin" />
            Send me offers and new-product updates
          </label>
        )}
        <button type="button" onClick={()=>setMode(mode==='login'?'register':'login')} data-testid="auth-switch" className="w-full text-sm text-[#52525B] hover:text-[#0A0A0A]">
          {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
        </button>
      </form>

      <div className="mt-6 text-xs text-[#52525B] text-center">
        Demo: <code className="bg-black/5 px-1.5 py-0.5 rounded">demo@merchcraft.in / Demo@123</code> · Admin: <code className="bg-black/5 px-1.5 py-0.5 rounded">admin@merchcraft.in / Admin@123</code>
      </div>
    </div>
  );
};

export default Auth;
