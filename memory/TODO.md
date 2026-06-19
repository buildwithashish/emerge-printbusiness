# MerchCraft AI — Open TODO List

Tracking deferred items from MVP and proposed enhancements. Mark `[x]` when done.

---

## 🔥 P0 — Production must-have (before going live)
- [ ] **Wire live Razorpay** — add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `/app/backend/.env`. Implement HMAC-SHA256 `razorpay_signature` verification in `/api/orders/{oid}/verify-payment` so payment success can't be spoofed from the client.
- [ ] **S3-compatible object storage for AI artwork** — currently `data:image/png;base64,...` strings are stored in MongoDB; replace with upload to S3/R2/MinIO and store only the URL (reduces DB size massively).
- [ ] **OTP login** — Email OTP + Mobile OTP (MSG91) + Google login (Emergent-managed) so users don't need a password.
- [ ] **Order confirmation page** — redirect to `/order/:id/success` after checkout with order number, ETA, and "Track" CTA (currently goes to `/account`).
- [ ] **Razorpay webhook endpoint** — handle async `payment.captured` / `payment.failed` events instead of relying on browser handler only.
- [ ] **Server-side rendering for true SEO** — Next.js port (required because current CRA setup cannot deliver Lighthouse SEO > 90 with crawler-friendly HTML for product pages).

## 🚀 P1 — Growth & differentiation
- [ ] **Canva-like full editor** — drag/resize/rotate/layers/shapes/text overlays/background removal (extend the current AI Studio + ProductDetail preview into a unified fabric.js canvas).
- [ ] **Shiprocket integration** — auto-generate label after order is `processing`, push status updates back into the order state machine, expose tracking URL in customer dashboard.
- [ ] **WhatsApp Business API + Brevo email** — order notifications (placed/shipped/delivered), abandoned cart drip (30 min / 24 h / 72 h), back-in-stock pings, **share-to-WhatsApp button on AI-generated artwork** (built-in viral loop).
- [ ] **Loyalty + referral program** — earn coins on every order, refer-a-friend ₹100 credit both sides.
- [ ] **Coupons + gift cards + corporate pricing tiers**.
- [ ] **Analytics stack** — GA4, Meta Pixel, Microsoft Clarity, Google Search Console, server-side conversion events.
- [ ] **Corporate dashboard** — RFQ status timeline, invoices, PO terms, approval workflow, dedicated AM contact widget.

## 💎 P2 — Polish / scale
- [ ] **Recommendation engine** — "similar products", "frequently bought together", "trending in your city".
- [ ] **Multi-language** — Hindi + regional (i18next).
- [ ] **Multi-currency** for global expansion (Stripe + currency switcher).
- [ ] **Audit logs + RBAC granularity + GDPR/DPDP toolkit** (export/delete-my-data).
- [ ] **A/B testing infrastructure** (PostHog or Statsig).
- [ ] **CI/CD + Docker + K8s manifests** (for self-hosted deployment).
- [ ] **Wishlist / save-for-later**.
- [ ] **Reviews with verified-buyer badge + photo moderation flow in admin**.

## ✅ Done (Feb 19, 2026)
- Storefront, catalog, search/filter/sort, product detail with variant configurator + live preview
- AI Design Studio (gpt-image-1 + prompt enhance + design history)
- Cart, COD checkout, Razorpay scaffolding (mock until keys)
- JWT auth (admin + customer), customer dashboard
- Corporate RFQ portal + admin RFQ inbox
- Admin console (5 tabs: overview, orders+status machine, products, RFQs, settings with payment toggles & editable SEO)
- Design system: Cabinet Grotesk + Satoshi, vermillion accent, Phosphor icons, mobile-first
- Backend test suite 30/30, frontend critical flows verified
