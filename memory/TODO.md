# MerchCraft AI — Open TODO List

## 🔥 P0 — Production must-have
- [ ] **Razorpay**: keys + HMAC signature verify + webhook
- [ ] **S3 storage** for AI artwork (env vars already wired; drop in credentials to activate)
- [ ] **Real notification senders** — currently MOCKED (logged to `notifications_log`). Swap in:
  - SMS: Twilio / MSG91
  - WhatsApp: Twilio WhatsApp Business / Gupshup
  - Email: SendGrid / Brevo / Resend
  - 1-line change inside `_log_notification` per channel
- [ ] **Remove `dev_code` from `/auth/send-otp` response** before going live (currently exposed for dev convenience)
- [ ] **Order confirmation page** after checkout
- [ ] **Next.js SSR port** for true SEO

## 🚀 P1 — Growth & differentiation
- [ ] Canva-style full editor
- [ ] Shiprocket auto-label + tracking webhook
- [ ] Loyalty + referral program
- [ ] Coupons + gift cards + corporate pricing tiers
- [ ] GA4 / Meta Pixel / Clarity / Search Console
- [ ] Corporate dashboard (RFQ timeline, invoices, approvals)

## 💎 P2 — Polish / scale
- [ ] Recommendations engine
- [ ] Multi-language (Hindi + regional)
- [ ] Multi-currency
- [ ] Audit logs + DPDP/GDPR export-or-delete
- [ ] A/B testing infrastructure
- [ ] Docker Compose + K8s manifests
- [ ] Wishlist / save-for-later
- [ ] Split Admin.jsx (685 lines) into per-tab components
- [ ] Guard empty-string `<img src="">` to silence React warnings

## ✅ Done

### Feb 19, 2026 — MVP
Storefront, AI Studio, Cart, COD checkout, JWT auth, Customer dashboard, Corporate RFQ, Admin v1

### Feb 22, 2026 — Admin CRUD pack
Backend CRUD + admin Products/Categories/Users/Orders modals, cart qty inline

### Feb 23, 2026 — Feature pack 1
3-role (Customer/Admin/SuperAdmin), Admins tab, CSV bulk import, color-image swap, bestseller/low-stock badges, trending strip, watching count, free-shipping threshold flash card, global search bar, S3 storage helper (with base64 fallback)

### Feb 24, 2026 — Feature pack 2 (this iteration)
- ✅ **Guest checkout** + phone OTP (3-step: details → OTP → payment)
- ✅ Cart works for guests (localStorage) and merges into server cart on login
- ✅ **Optional registration** at checkout — guest order creates user with temp password, emailed
- ✅ Corporate orders still require login
- ✅ **Verified-customer model** — `phone_verified`, `email_verified`, `marketing_opt_in`, `is_guest` columns
- ✅ Admin Customers tab shows verification badges + 1-click **Send Verification** buttons (SMS / Email)
- ✅ **Order notifications** — Email + SMS + WhatsApp on order placed (channel routing respects verification)
- ✅ **APScheduler** — daily-status-change job (hour configurable), auto-bestseller job at 02:00
- ✅ **Manual order notify** endpoint `/admin/orders/{id}/notify` with channel chooser
- ✅ **Broadcast** to all customers with channel-by-verification routing (opted-out registered users skipped; guests always notified)
- ✅ **Customizable templates** for order_placed / status_change / guest_welcome / broadcast / otp (live editor in Admin → Notifications)
- ✅ **Notifications log** tab — every send (real or mocked) captured + searchable
- ✅ **Auto-bestseller cron** — products with sold_count ≥ threshold (default 200) in active categories get auto-marked
- ✅ **Bestseller low-stock alert** — admin overview shows dismissible strip; deduped per alert
- ✅ **Sample CSV download** button on Products tab
- ✅ **"Add color" button** in ProductForm — prompts for new color + creates row for image
- ✅ **Dynamic hero** — replaces "Classic Cotton Tee" hardcode with the top-ranked seeded bestseller
- ✅ **Corporate kits** info gallery (Standard / Premium / Elite + Customize tile), kit picker drives RFQ form

### Test results
- Backend: 100% (19/19 new + all prior tests pass)
- Frontend: 100% on all 9 features after 2 retest cycles (3 minor bugs found + fixed mid-iteration)
- Scheduler running: daily-status @ configurable hour, auto-bestseller @ 02:00
