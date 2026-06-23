# MerchCraft AI — Open TODO List

---

## 🔥 P0 — Production must-have (before going live)
- [ ] **Wire live Razorpay** — `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in `backend/.env`; add HMAC signature verification in `/api/orders/{id}/verify-payment`.
- [ ] **S3 storage credentials** — code is ready, just set `S3_ENDPOINT_URL / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET / S3_PUBLIC_BASE` in `backend/.env`. Without them the AI artwork falls back to base64 data-URLs in MongoDB (works but bloats DB).
- [ ] **OTP login** — Email OTP + Mobile OTP (MSG91) + Google login.
- [ ] **Razorpay webhook** for async `payment.captured` events.
- [ ] **Order confirmation page** after checkout (currently redirects to `/account`).
- [ ] **Next.js SSR port** for true SEO (Lighthouse > 90 on product pages).
- [ ] **Guard `<img src="">`** — silence the React empty-string warning by skipping the img or using a placeholder.

## 🚀 P1 — Growth & differentiation
- [ ] **Canva-style full editor** (drag/resize/rotate/layers/shapes/text/bg-removal).
- [ ] **Shiprocket** integration — auto-label, tracking webhook, status reflects in order machine.
- [ ] **WhatsApp Business + Brevo + MSG91** — order updates, abandoned-cart drip, share-to-WhatsApp on AI artwork.
- [ ] **Loyalty + referral program** — coins + ₹100 refer-a-friend.
- [ ] **Coupons + gift cards + corporate pricing tiers**.
- [ ] **Analytics stack** — GA4, Meta Pixel, Microsoft Clarity, Search Console, server-side conversions.
- [ ] **Corporate dashboard** — RFQ timeline, invoices, PO terms, approval workflow.

## 💎 P2 — Polish / scale
- [ ] Recommendation engine — "similar", "frequently bought together", "trending in your city".
- [ ] Multi-language (Hindi + regional via i18next).
- [ ] Multi-currency for global expansion (Stripe + currency switcher).
- [ ] Audit logs + RBAC granularity (per-resource permissions).
- [ ] GDPR / DPDP export-or-delete-my-data tools.
- [ ] A/B testing infrastructure (PostHog or Statsig).
- [ ] CI/CD + Docker Compose / K8s manifests.
- [ ] Wishlist / save-for-later.
- [ ] Verified-buyer badge + photo moderation flow.

## ✅ Done

### Feb 19, 2026
- Storefront, catalog, AI Design Studio, Cart, COD checkout, Razorpay scaffold
- JWT auth (admin + customer), Customer dashboard
- Corporate RFQ portal + admin RFQ inbox
- Admin console (5 tabs)
- Design system, backend tests 30/30

### Feb 22, 2026 — Admin CRUD + cart qty
- Backend: cart-item qty, category CRUD + toggle, users + role, order detail endpoints
- Admin: Products/Categories/Users CRUD modals, Order detail modal

### Feb 23, 2026 — Feature pack (this iteration)
- ✅ **3-role system** — Customer / Admin / **SuperAdmin** (Crown badge)
- ✅ **Admins tab** (superadmin-only) — create / delete admin accounts
- ✅ Customers tab — filtered to role=customer only (no admin leakage)
- ✅ **CSV bulk import** of products with `variants_*` and `|`-separated values
- ✅ **Color-specific images** — variant_images.color, auto-swaps on color pick
- ✅ **Bestseller / Few-units-left** toggles per product (1-click buttons + checkboxes in form)
- ✅ **Trending strip** on home — top sold from active categories only
- ✅ **Bestseller grid** on home — admin-flagged products from active categories
- ✅ **Live watching count** — admin sets `watching_count`, customer sees "X viewing now"
- ✅ **Free-shipping threshold** — admin-configurable; top banner + cart progress bar; checkout applies ₹49 shipping if subtotal < threshold
- ✅ **COD toggle** in admin settings (was already present, now visible & checked in checkout)
- ✅ **Global search bar** in header (desktop + mobile) — deep-links to `/products?q=`
- ✅ **S3 storage helper** with base64 fallback (drop S3 env vars to activate)
- ✅ Bestsellers/Trending automatically exclude products from disabled categories
- ✅ Backend 65/65 tests pass; frontend 100% on all 10 features
