# MerchCraft AI — Product Requirements Document

## Original Problem Statement
Build a production-ready AI-powered Custom Merchandise E-Commerce Platform (Printify/Printful/Vistaprint/Printo-class) for India initially with global expansion. B2C + B2B. Mobile-first, SEO-optimized, fast, AI-generated artwork, bulk corporate orders, scalable, powerful admin panel.

## Tech Stack (as actually built)
- Frontend: React 19 (CRA) + Tailwind + ShadCN UI + Phosphor Icons + react-router 7
- Backend: FastAPI + Motor (MongoDB async) + Pydantic + JWT + bcrypt
- AI: OpenAI **gpt-image-1** + gpt-4o-mini (prompt enhance) via Emergent Universal Key
- DB: MongoDB
- Payments: Razorpay (admin-toggleable) + COD; mock when keys absent
- Auth: JWT email + password

> Note: User wanted Next.js/NestJS/PostgreSQL/Elasticsearch + K8s. Built on Emergent's React+FastAPI+MongoDB stack; user will port for self-hosted deployment.

## User Personas
- **B2C Buyer** – designs and orders 1–5 customized items.
- **Designer / AI explorer** – generates artwork in Studio, applies to products.
- **Corporate buyer** – RFQ for 50–10,000 units with branding.
- **Admin** – manages catalog, orders, settings, RFQs, SEO.

## Core Requirements (static)
- Highly converting homepage + mobile-first
- Product catalog with categories, filters, search, sort
- Product detail with variant configurator + live preview + custom upload + custom text
- AI Design Studio (prompt → image via gpt-image-1, prompt enhance via gpt-4o-mini, style picker, design history)
- Cart + Checkout (Razorpay + COD)
- Customer dashboard (orders, designs)
- Corporate RFQ form + admin RFQ inbox
- Admin: products, orders + status machine, RFQs, settings (payment toggles, AI model, SEO)
- Reviews
- JWT auth + RBAC (admin/customer)
- Auto-seed of catalog + 2 demo accounts on first boot

## Implemented (2026-02-19)
- ✅ Backend (~660 lines, 30/30 tests passing): auth, categories, products CRUD, cart, orders + state-machine, checkout (Razorpay+COD with admin toggle), AI image gen + prompt enhance, reviews, corporate RFQ, settings, admin overview/orders, auto-seed (14 products + 8 categories + 5 reviews + admin + demo)
- ✅ Frontend (10 pages): Home, Products (filter/search/sort), ProductDetail (configurator + live preview + upload + AI link), DesignStudio (prompt, style chips, AI gen + enhance + history + download), Cart, Checkout (address + payment method + Razorpay/COD), Auth (login/register), Account (orders + designs), Corporate (RFQ), Admin (5 tabs)
- ✅ Design system: Cabinet Grotesk + Satoshi fonts, #FF3B30 vermillion primary, glass-morphism header, Bento grids, tracing-beam AI loader, marquee
- ✅ AuthContext with `ready` flag — protected routes survive hard refresh
- ✅ data-testid on all interactive elements

## Prioritized Backlog (next sessions)
### P0 (production must-have)
- Razorpay signature verification on /orders/{id}/verify-payment
- Real S3-compatible image storage (currently base64 data-URLs for AI designs)
- Email/OTP/Mobile-OTP login (currently only email+password JWT)
- Server-side rendering for SEO (CRA → Next.js port for true SEO)

### P1 (growth)
- Canva-like editor (drag/resize/rotate/layers/shapes/text overlays/background removal)
- Coupons, gift cards, loyalty/referral
- Abandoned cart recovery via WhatsApp/Email/SMS (Brevo, MSG91)
- Shiprocket/Delhivery integration + auto label + tracking
- Analytics: GA4, Meta Pixel, Microsoft Clarity, Search Console
- Email marketing (Brevo/Mailchimp)
- Corporate dashboard (quote tracking, invoices, approvals)

### P2 (polish)
- Recommendation engine (similar / frequently-bought-together)
- Multi-language (Hindi + regional)
- Multi-currency for global expansion
- Audit logs + GDPR/DPDP toolkit
- CI/CD + Docker + K8s manifests
- A/B testing infrastructure
- Wishlist / save-for-later

## Test Credentials
- Admin: `admin@merchcraft.in` / `Admin@123`
- Customer: `demo@merchcraft.in` / `Demo@123`
