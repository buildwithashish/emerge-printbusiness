import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { MagnifyingGlass } from "@phosphor-icons/react";

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const category = searchParams.get("category") || "";
  const urlQ = searchParams.get("q") || "";
  const [q, setQ] = useState(urlQ);
  const [sort, setSort] = useState("trending");

  // keep local q in sync with URL when navigating from header global search
  useEffect(() => { setQ(urlQ); }, [urlQ]);

  // debounce typing → URL (so deep-linking + sharing works)
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (q) next.set("q", q); else next.delete("q");
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => { api.get("/categories").then(r => setCats(r.data)); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    params.set("sort", sort);
    api.get(`/products?${params.toString()}`).then(r => setProducts(r.data));
  }, [category, q, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="products-page">
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B]">Shop</span>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mt-2">{category ? cats.find(c=>c.slug===category)?.name || "Products" : "All Products"}</h1>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
            <input data-testid="product-search" placeholder="Search merch…" value={q} onChange={e=>setQ(e.target.value)} className="pl-9 pr-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3B30]" />
          </div>
          <select data-testid="sort-select" value={sort} onChange={e=>setSort(e.target.value)} className="px-3 py-2.5 text-sm border border-black/10 rounded-sm bg-white">
            <option value="trending">Trending</option>
            <option value="new">Newest</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3">
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-[#52525B] mb-3">Categories</div>
          <div className="space-y-1">
            <button onClick={() => setSearchParams({})} className={`block w-full text-left text-sm py-2 px-3 rounded-sm hover:bg-black/5 ${!category ? 'bg-black/5 font-bold' : ''}`} data-testid="cat-filter-all">All</button>
            {cats.map(c => (
              <button key={c.id} onClick={() => setSearchParams({ category: c.slug })} className={`block w-full text-left text-sm py-2 px-3 rounded-sm hover:bg-black/5 ${category===c.slug ? 'bg-black/5 font-bold' : ''}`} data-testid={`cat-filter-${c.slug}`}>{c.name}</button>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-9">
          {products.length === 0 ? (
            <div className="text-center py-20 text-[#52525B]" data-testid="no-products">No products found.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {products.map(p => (
                <Link key={p.id} to={`/products/${p.id}`} data-testid={`product-card-${p.id}`} className="group block">
                  <div className="aspect-square overflow-hidden bg-[#F4F4F5] border border-black/5 rounded-sm mb-3">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-[#52525B] text-xs uppercase tracking-wider mt-0.5">{p.category}</div>
                  <div className="font-display font-bold text-lg mt-1">₹{p.base_price}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;
