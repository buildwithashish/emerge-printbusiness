import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { ShoppingBag, User, Sparkles, List, X } from "@phosphor-icons/react";
import { useState } from "react";

const Layout = () => {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const navItem = "text-sm font-medium text-[#0A0A0A]/80 hover:text-[#FF3B30] transition-colors";

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-black/5" data-testid="site-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-black text-xl tracking-tighter" data-testid="logo-link">
            <span className="inline-block w-7 h-7 bg-[#FF3B30] rounded-sm flex items-center justify-center text-white text-xs font-black">M</span>
            <span>MERCHCRAFT<span className="text-[#FF3B30]">.</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            <NavLink to="/products" className={navItem} data-testid="nav-shop">Shop</NavLink>
            <NavLink to="/studio" className={navItem} data-testid="nav-studio">AI Studio</NavLink>
            <NavLink to="/corporate" className={navItem} data-testid="nav-corporate">Corporate</NavLink>
            {user?.role === "admin" && (
              <NavLink to="/admin" className={navItem} data-testid="nav-admin">Admin</NavLink>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative p-2 hover:bg-black/5 rounded-sm" data-testid="cart-icon">
              <ShoppingBag size={22} weight="duotone" />
              {items?.length > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] bg-[#FF3B30] text-white rounded-full w-5 h-5 flex items-center justify-center font-bold" data-testid="cart-count">{items.length}</span>
              )}
            </Link>
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/account" className="text-sm font-medium hover:text-[#FF3B30]" data-testid="account-link">{user.name?.split(" ")[0]}</Link>
                <button onClick={() => { logout(); nav("/"); }} className="text-xs uppercase tracking-wider text-[#52525B] hover:text-[#0A0A0A]" data-testid="logout-btn">Logout</button>
              </div>
            ) : (
              <Link to="/auth" className="hidden md:inline-flex items-center gap-1 text-sm font-medium hover:text-[#FF3B30]" data-testid="login-link">
                <User size={18} weight="duotone" /> Login
              </Link>
            )}
            <button className="md:hidden p-2" onClick={() => setOpen(!open)} data-testid="mobile-menu-btn">
              {open ? <X size={22} /> : <List size={22} />}
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-black/5 bg-white px-4 py-3 space-y-2">
            <Link to="/products" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium" data-testid="m-nav-shop">Shop</Link>
            <Link to="/studio" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium" data-testid="m-nav-studio">AI Studio</Link>
            <Link to="/corporate" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium" data-testid="m-nav-corporate">Corporate</Link>
            {user?.role === "admin" && <Link to="/admin" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium" data-testid="m-nav-admin">Admin</Link>}
            {user ? (
              <>
                <Link to="/account" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium" data-testid="m-account-link">Account</Link>
                <button onClick={() => { logout(); setOpen(false); nav("/"); }} className="block py-2 text-sm font-medium" data-testid="m-logout-btn">Logout</button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium" data-testid="m-login-link">Login / Register</Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t border-black/5 bg-white mt-20" data-testid="site-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="font-display font-black text-lg mb-3">MERCHCRAFT<span className="text-[#FF3B30]">.</span></div>
            <p className="text-[#52525B] leading-relaxed">Premium custom merchandise, designed by AI. Made in India, shipped worldwide.</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest font-bold mb-3">Shop</div>
            <ul className="space-y-2 text-[#52525B]">
              <li><Link to="/products?category=t-shirts" className="hover:text-[#0A0A0A]">T-Shirts</Link></li>
              <li><Link to="/products?category=hoodies" className="hover:text-[#0A0A0A]">Hoodies</Link></li>
              <li><Link to="/products?category=mugs" className="hover:text-[#0A0A0A]">Mugs</Link></li>
              <li><Link to="/products?category=corporate-gifts" className="hover:text-[#0A0A0A]">Corporate</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest font-bold mb-3">Company</div>
            <ul className="space-y-2 text-[#52525B]">
              <li><Link to="/corporate" className="hover:text-[#0A0A0A]">Bulk Orders</Link></li>
              <li><Link to="/studio" className="hover:text-[#0A0A0A]">AI Studio</Link></li>
              <li><a href="#" className="hover:text-[#0A0A0A]">About</a></li>
              <li><a href="#" className="hover:text-[#0A0A0A]">Contact</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest font-bold mb-3">Trust</div>
            <ul className="space-y-2 text-[#52525B]">
              <li>Secure Payments</li>
              <li>Fast Delivery (3–5 days)</li>
              <li>Quality Guarantee</li>
              <li>Easy Returns</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-black/5 py-5 text-center text-xs text-[#52525B]">© 2026 MerchCraft AI. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default Layout;
