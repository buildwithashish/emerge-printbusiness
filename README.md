# MerchCraft AI 🎨

> Production-shaped, AI-powered **custom merchandise e-commerce platform** for the Indian market (B2C + B2B). Built on React + FastAPI + MongoDB with OpenAI GPT-Image-1 for on-demand artwork, a 3-role admin console (Customer / Admin / SuperAdmin), guest checkout with phone-OTP verification, customizable notification templates, an APScheduler-powered status notification cron, and an auto-bestseller engine.

![Stack](https://img.shields.io/badge/stack-React%2019%20%E2%80%A2%20FastAPI%20%E2%80%A2%20MongoDB-FF3B30)
![AI](https://img.shields.io/badge/AI-OpenAI%20gpt--image--1-black)
![Status](https://img.shields.io/badge/status-Feature--complete%20MVP-success)

---

## ✨ Features

### Storefront (B2C)
| Module | Notes |
|---|---|
| Homepage | Hero with 3 CTAs, **dynamic bestseller card**, 8 categories (bento grid), trending strip (top 6 by sold count, **excludes disabled categories**), bestseller grid, reviews, corporate-clients marquee |
| Catalog | Filter by category, search, sort (trending / new / price asc / desc); deep-linkable URL (`/products?q=hoodie&category=hoodies`) |
| **Global search bar** | Header (desktop + mobile) — type & Enter → routes to `/products?q=…` |
| Product detail | Variant configurator with **per-color image swap**, live custom-design overlay (upload or AI), custom text, bestseller / "few units left" / "X viewing now" badges |
| **AI Design Studio** | Prompt → artwork via **OpenAI gpt-image-1**, GPT-4o-mini prompt enhancement, 8 style chips, tracing-beam loader, design history, download + apply-to-product |
| Cart | **Works for guests** (localStorage) and logged-in users (server); auto-merges on login; inline qty controls; free-shipping progress bar |
| Checkout | 3-step: details → phone OTP → payment. **Guest checkout supported** with optional registration. Email/Razorpay/COD |
| **Free-shipping banner** | Site-wide top strip; admin-configurable threshold |
| Account | Orders + saved AI designs |
| Corporate | **Kits gallery** (Standard / Premium / Elite + Customize tile) → drives RFQ form (login required for corporate orders) |

### Authentication & Verification
- JWT email + password (admins/superadmin/customers)
- **3-role system** — Customer / Admin / SuperAdmin (Crown badge in admin console)
- **Phone-OTP verification** via `/auth/send-otp` + `/auth/verify-otp` (10-min expiry)
- Verified-customer tracking: `phone_verified`, `email_verified`, `marketing_opt_in`, `is_guest`
- Cart works without login; registration is offered (but optional) at checkout

### Admin Console (8 tabs)
| Tab | Notes |
|---|---|
| **Overview** | KPIs + dismissible alerts strip (e.g., `bestseller low_stock` alert from auto-bestseller cron) |
| **Products** | CRUD with modal · search/filter · 1-click toggles (Bestseller, Low-stock) · **CSV bulk import** + **Sample CSV download** · "Run auto-bestseller now" button |
| **Categories** | CRUD + enable/disable toggle (disabled categories vanish from trending/bestsellers) |
| **Orders** | Searchable table · Order-detail modal · 10-state status machine · manual notify endpoint |
| **Customers** | Search · verification badges (email/phone) · Type column (Guest / Registered) · 1-click **Send SMS / Email verification** buttons |
| **Notifications** | Templates editor (order_placed, status_change, guest_welcome, broadcast, otp × email/sms/whatsapp) · **Broadcast UI** · live **notifications log** |
| **Admins** (super-only) | Manage admin accounts (create / delete) |
| **Corporate RFQs** | Inbox + RFQ detail |
| **Settings** | Payment-provider toggles · free-shipping threshold · scheduler hour · bestseller threshold · AI model · editable SEO meta |

### Notifications & Automation
- **APScheduler** background scheduler:
  - Daily status-change notifications (configurable hour, default 8 AM)
  - Auto-bestseller cron at 02:00 (marks products with `sold_count ≥ threshold` in active categories)
- **Channel routing** with verification gating:
  - **Email** → only verified email
  - **SMS** → only verified phone
  - **WhatsApp** → any valid phone (no verification needed)
- Default notification senders are **MOCKED** (logged to `notifications_log`). Plug in Twilio / SendGrid / MSG91 with a one-line swap in `_log_notification` (see [Replacing notification providers](#-replacing-notification-providers)).
- Bestseller low-stock alert is **deduplicated** (re-running auto-bestseller doesn't pollute alerts).

---

## 🧱 Tech Stack

- **Frontend** — React 19 (CRA) · Tailwind CSS · ShadCN UI · `@phosphor-icons/react` · `react-router-dom` v7 · `sonner` · `axios`
- **Backend** — FastAPI · Motor · Pydantic v2 · `bcrypt` · `pyjwt` · **APScheduler** · `boto3` (optional S3)
- **AI** — `emergentintegrations` (OpenAI `gpt-image-1` + `gpt-4o-mini`)
- **Database** — MongoDB
- **Payments** — Razorpay (live or mock) · Cash on Delivery
- **Storage** — base64 fallback by default, S3-compatible upload when configured

---

## 📂 Project structure

```
.
├── backend/
│   ├── server.py                # All FastAPI routes + scheduler + senders
│   ├── requirements.txt
│   └── .env                     # MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, JWT_SECRET, optional RAZORPAY_*, S3_*
├── frontend/
│   ├── public/index.html        # Razorpay checkout script
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   │   ├── Layout.jsx       # header (global search + free-ship banner) + footer
│   │   │   └── admin/           # Modal, ProductForm, CategoryForm, AdminForm, OrderDetail
│   │   ├── pages/               # Home, Products, ProductDetail, DesignStudio, Cart,
│   │   │                        # Checkout (3-step), Auth, Account, Corporate, Admin (8 tabs)
│   │   └── lib/                 # api.js (axios), auth.jsx, cart.jsx (guest + logged-in)
│   ├── package.json
│   └── .env                     # REACT_APP_BACKEND_URL, optional REACT_APP_RAZORPAY_KEY_ID
└── README.md
```

---

## 🚀 Run locally (macOS / Linux / WSL)

### 0. Prerequisites

```bash
# macOS
brew install python@3.11 node mongodb-community
npm install -g yarn
brew services start mongodb-community

# Or run Mongo via Docker (any OS)
docker run -d --name mongo -p 27017:27017 mongo
```

### 1. Clone

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

### 2. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=merch_db
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=replace-with-a-long-random-string

# AI (required for /studio). Use Emergent universal key OR your own OpenAI key.
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxxxxxxxxxxxx

# Payments (optional — mock checkout when blank)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Object storage (optional — when set, AI artwork uploads here instead of base64)
S3_ENDPOINT_URL=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_PUBLIC_BASE=
```

Start the backend (auto-seeds catalog + 3 demo users + starts the scheduler):

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

Hit `http://localhost:8001/api/` → `{"name":"MerchCraft AI","status":"ok"}`.

### 3. Frontend

```bash
cd ../frontend
yarn install
```

Create `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
# Optional — public Razorpay Key ID for the Checkout modal
REACT_APP_RAZORPAY_KEY_ID=
```

Run the dev server:

```bash
yarn start          # → http://localhost:3000
```

### 4. Demo credentials (seeded automatically)

| Role | Email | Password | Phone (pre-verified) |
|---|---|---|---|
| **SuperAdmin** | `superadmin@merchcraft.in` | `Super@123` | `+919000000000` |
| Admin | `admin@merchcraft.in` | `Admin@123` | `+919000000001` |
| Customer | `demo@merchcraft.in` | `Demo@123` | `+919000000002` |

For **guest checkout** testing, the OTP code is returned in the `/auth/send-otp` JSON response (as `dev_code`) and shown on-screen during checkout as a yellow "Dev OTP" hint — convenient until you wire a real SMS provider. **Remove this in production** (see TODO).

---

## 🔐 Environment variables reference

### `backend/.env`

| Key | Required | Default / Example | Notes |
|---|---|---|---|
| `MONGO_URL` | ✅ | `mongodb://localhost:27017` | Atlas SRV URI in prod |
| `DB_NAME` | ✅ | `merch_db` | |
| `CORS_ORIGINS` | ✅ | `http://localhost:3000` | Comma-separated; use your domain in prod |
| `JWT_SECRET` | ✅ | long random string | ≥ 32 chars |
| `EMERGENT_LLM_KEY` | ⚠️ | `sk-emergent-…` | Required for AI Studio. Or swap for your own OpenAI key — see [Replacing the AI provider](#-replacing-the-ai-provider) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | optional | `rzp_test_…` | Blank → checkout uses mock order IDs |
| `S3_ENDPOINT_URL` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` / `S3_PUBLIC_BASE` | optional | — | Blank → AI artwork stored as base64 in Mongo (works but bloats DB) |

### `frontend/.env`

| Key | Required | Example |
|---|---|---|
| `REACT_APP_BACKEND_URL` | ✅ | `http://localhost:8001` (locally) · `https://api.yourdomain.com` (prod) |
| `REACT_APP_RAZORPAY_KEY_ID` | optional | `rzp_test_…` |

> All backend routes are prefixed with `/api/`. The frontend axios client appends `/api` automatically — **don't put `/api` in `REACT_APP_BACKEND_URL`**.

---

## 🔌 Replacing notification providers

The default backend logs every send to `db.notifications_log` instead of dispatching. To go live:

```python
# backend/server.py — inside _log_notification(), after db.notifications_log.insert_one(...)
import os
if channel == "sms":
    # Twilio
    from twilio.rest import Client
    Client(os.environ["TWILIO_SID"], os.environ["TWILIO_TOKEN"]).messages.create(
        from_=os.environ["TWILIO_FROM"], to=target, body=body
    )
elif channel == "email":
    # SendGrid / Brevo / Resend — pick one
    import sendgrid
    from sendgrid.helpers.mail import Mail
    sg = sendgrid.SendGridAPIClient(api_key=os.environ["SENDGRID_API_KEY"])
    sg.send(Mail(from_email=os.environ["SENDGRID_FROM"], to_emails=target, subject=subject, plain_text_content=body))
elif channel == "whatsapp":
    # Twilio WhatsApp / Gupshup / Meta Cloud API
    Client(...).messages.create(from_=f"whatsapp:{os.environ['TWILIO_WA_FROM']}", to=f"whatsapp:{target}", body=body)
```

Add the matching env keys to `backend/.env` and you're live. The Notifications log in admin will still capture every send.

---

## 🤖 Replacing the AI provider

Drop `emergentintegrations` for your own OpenAI key:

```python
# backend/server.py — replace the AI generate-image handler
from openai import AsyncOpenAI
oai = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

@api.post("/ai/generate-image")
async def generate_image(body: AIPromptIn, user=Depends(current_user)):
    r = await oai.images.generate(model="gpt-image-1", prompt=body.prompt, n=1, size="1024x1024", response_format="b64_json")
    ...
```

Same pattern for Anthropic Claude, Google Gemini Nano-Banana, or fal.ai Flux.

---

## 💳 Going live with Razorpay

1. [razorpay.com](https://razorpay.com) → **Settings → API Keys → Generate Test Key**.
2. Add `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` to `backend/.env`; `REACT_APP_RAZORPAY_KEY_ID` to `frontend/.env`.
3. Restart both.
4. **Add signature verification** in `/api/orders/{oid}/verify-payment` (currently trusts the client — see TODO P0):
   ```python
   rzp.utility.verify_payment_signature({
       "razorpay_order_id": payload["razorpay_order_id"],
       "razorpay_payment_id": payload["razorpay_payment_id"],
       "razorpay_signature": payload["razorpay_signature"],
   })
   ```
5. Register a webhook → `https://api.yourdomain.com/api/webhooks/razorpay` for async `payment.captured` events (still TODO).

Test card: `4111 1111 1111 1111` · exp `12/30` · CVV `123` · OTP `1234`.

---

## ☁️ Deployment

### Option A — Quick & cheap (recommended)

| Layer | Provider | Why |
|---|---|---|
| Frontend | **Vercel** | Zero-config for CRA, free SSL, global CDN |
| Backend | **Railway** or **Render** | One-click FastAPI, free tier, easy env-var UI |
| Database | **MongoDB Atlas** (free M0) | Managed, secure, daily backups |

**Vercel (frontend)**

1. Push repo to GitHub → import on [vercel.com](https://vercel.com).
2. Root directory → `frontend`.
3. Build command → `yarn build` · Output → `build`.
4. Add env var `REACT_APP_BACKEND_URL=https://your-api.up.railway.app` (no trailing slash).
5. Deploy.

**Railway (backend)**

1. [railway.app](https://railway.app) → **Deploy from GitHub repo**.
2. Root directory → `backend`.
3. Start command:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
4. Add every `backend/.env` variable.
5. Generate a public domain → paste into Vercel's `REACT_APP_BACKEND_URL`.

**MongoDB Atlas**

1. [cloud.mongodb.com](https://cloud.mongodb.com) → free M0 cluster.
2. Database Access → create user · Network Access → `0.0.0.0/0` (or Railway egress IPs).
3. Copy SRV URI → Railway `MONGO_URL`.

---

### Option B — AWS production setup

> ECS Fargate (backend) + S3 + CloudFront (frontend) + Atlas/DocumentDB (Mongo)

**Backend Dockerfile** (`backend/Dockerfile`):

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

```bash
# Push to ECR
aws ecr create-repository --repository-name merchcraft-backend
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <acct>.dkr.ecr.ap-south-1.amazonaws.com
docker build -t merchcraft-backend ./backend
docker tag merchcraft-backend:latest <acct>.dkr.ecr.ap-south-1.amazonaws.com/merchcraft-backend:latest
docker push <acct>.dkr.ecr.ap-south-1.amazonaws.com/merchcraft-backend:latest
```

Then: **ECS cluster → Fargate task** (0.5 vCPU / 1 GB, port 8001, all env vars injected) → **ALB with ACM cert** → **Route 53** `api.yourdomain.com` → CNAME to the ALB.

> For DocumentDB add the TLS CA bundle to your `MONGO_URL`:
> `mongodb://user:pass@docdb-cluster:27017/?tls=true&tlsCAFile=/app/global-bundle.pem&retryWrites=false`

**Frontend on S3 + CloudFront**

```bash
cd frontend && yarn build
aws s3 mb s3://merchcraft-frontend-prod --region ap-south-1
aws s3 sync build/ s3://merchcraft-frontend-prod --delete
```

- Enable static-site hosting on the bucket (or use **OAC** + block public access).
- CloudFront distribution → origin = bucket → default root object `index.html`.
- Custom error: `403 → /index.html` (200) for React Router.
- Attach ACM cert · Route 53 → CloudFront.

**Cost estimate (Mumbai, `ap-south-1`)**

| Resource | Monthly |
|---|---|
| ECS Fargate (1 task, 0.5 vCPU, 1 GB, 24×7) | ≈ $12 |
| ALB | ≈ $18 |
| S3 + CloudFront (10 GB out) | ≈ $2 |
| Route 53 | $0.50 |
| MongoDB Atlas M0 | Free |
| **Total** | **≈ $33 / month** |

---

### Option C — Single VPS (DigitalOcean / Hetzner / Linode)

```bash
ssh root@<droplet-ip>
apt update && apt install -y python3.11 python3.11-venv nodejs npm nginx git
npm i -g yarn pm2

# MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb.gpg --dearmor
echo "deb [arch=amd64,signed-by=/usr/share/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb.list
apt update && apt install -y mongodb-org && systemctl enable --now mongod

git clone https://github.com/<you>/<repo>.git /opt/merchcraft
cd /opt/merchcraft/backend
python3.11 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
# create /opt/merchcraft/backend/.env with prod values

cd /opt/merchcraft/frontend
yarn install && REACT_APP_BACKEND_URL=https://yourdomain.com yarn build
```

Run with **PM2**:

```bash
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name mc-api \
  --cwd /opt/merchcraft/backend --interpreter /opt/merchcraft/backend/venv/bin/python
pm2 save && pm2 startup
```

**nginx + Let's Encrypt:**

```nginx
# /etc/nginx/sites-available/merchcraft
server {
    server_name yourdomain.com;
    root /opt/merchcraft/frontend/build;
    index index.html;
    location / { try_files $uri /index.html; }
    location /api/ { proxy_pass http://127.0.0.1:8001; proxy_set_header Host $host; }
}
```

```bash
ln -s /etc/nginx/sites-available/merchcraft /etc/nginx/sites-enabled/
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
nginx -t && systemctl reload nginx
```

---

### Option D — Docker Compose

`docker-compose.yml`:

```yaml
version: "3.9"
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes: ["mongo_data:/data/db"]
  backend:
    build: ./backend
    env_file: ./backend/.env
    environment:
      - MONGO_URL=mongodb://mongo:27017
    depends_on: [mongo]
    ports: ["8001:8001"]
  frontend:
    build:
      context: ./frontend
      args: { REACT_APP_BACKEND_URL: ${PUBLIC_BACKEND_URL} }
    ports: ["3000:80"]
volumes:
  mongo_data:
```

`frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```bash
PUBLIC_BACKEND_URL=http://localhost:8001 docker compose up -d --build
```

---

## 🛡️ Production checklist

- [ ] Change `JWT_SECRET` to a 32+ char random string
- [ ] Set `CORS_ORIGINS` to your real domain — not `*`
- [ ] **Remove `dev_code` from `/auth/send-otp`** response
- [ ] Wire real notification senders (Twilio / SendGrid / WhatsApp Business)
- [ ] Razorpay signature verification + webhook
- [ ] Configure S3 storage (`S3_ENDPOINT_URL` etc.) so AI artwork doesn't live as base64 in Mongo
- [ ] Atlas backups / DocumentDB snapshot schedule
- [ ] Rotate `EMERGENT_LLM_KEY` or swap for your own OpenAI key
- [ ] Rate limiting (`slowapi` + WAF / CloudFront)
- [ ] Sentry / CloudWatch logs
- [ ] HTTPS + HSTS + secure cookies

---

## 🗺️ Key API reference

```
# Auth & OTP
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PATCH /api/auth/me/preferences         # marketing_opt_in, phone
POST /api/auth/send-otp                # {target, channel}
POST /api/auth/verify-otp              # {target, code}

# Catalog
GET  /api/categories
GET  /api/products?category=&q=&sort=
GET  /api/products/trending?limit=6
GET  /api/products/bestsellers?limit=8
GET  /api/products/sample-csv          # downloadable CSV template
GET  /api/products/{id}

# Cart (logged-in only; guests use localStorage in the frontend)
GET    /api/cart
POST   /api/cart/add
PUT    /api/cart/item/{id}             # update quantity
DELETE /api/cart/item/{id}

# Checkout
POST /api/checkout                     # auth required, requires phone_verified
POST /api/checkout/guest               # name/email/phone + phone_otp_code
POST /api/orders/{id}/verify-payment

# AI
POST /api/ai/generate-image
POST /api/ai/enhance-prompt

# Corporate
GET  /api/corporate/kits
POST /api/corporate/rfq

# Admin (require role admin or superadmin)
GET  /api/admin/overview
GET  /api/admin/orders
GET  /api/admin/orders/{id}
PUT  /api/admin/orders/{id}/status
POST /api/admin/orders/{id}/notify     # manual channel send

GET    /api/admin/users                # customers only
PUT    /api/admin/users/{id}
POST   /api/admin/users/{id}/trigger-verification   # send OTP
DELETE /api/admin/users/{id}

GET    /api/admin/categories
PUT    /api/categories/{id}
PATCH  /api/categories/{id}/toggle
DELETE /api/categories/{id}

POST   /api/products
PUT    /api/products/{id}
PATCH  /api/products/{id}/flags        # {is_bestseller?, low_stock?}
PUT    /api/products/{id}/watching     # {watching_count}
DELETE /api/products/{id}
POST   /api/products/bulk-import       # CSV upload

GET  /api/admin/notifications-log
POST /api/admin/broadcast
GET  /api/admin/alerts
PATCH /api/admin/alerts/{id}/read
POST /api/admin/run-auto-bestseller

# Admin (require role superadmin)
GET    /api/admin/admins
POST   /api/admin/admins
DELETE /api/admin/admins/{id}

# Settings
GET /api/settings
PUT /api/settings
```

---

## 📋 Roadmap

Full P0 / P1 / P2 in [`/memory/TODO.md`](memory/TODO.md). Highlights:

**P0** — Real notification senders (Twilio/SendGrid/WhatsApp) · live Razorpay + signature verify · S3 storage credentials · remove `dev_code` from OTP response · Next.js SSR port for SEO

**P1** — Canva-style full editor · Shiprocket integration · post-purchase WhatsApp upsell drip · loyalty + referral · coupons + gift cards · GA4 / Meta Pixel / Clarity · corporate dashboard

**P2** — Recommendation engine · multi-language (Hindi + regional) · multi-currency · audit logs · DPDP/GDPR tooling · A/B testing · K8s manifests · wishlist · split Admin.jsx into per-tab components

---

## 📜 License

MIT — do what you want, attribution appreciated.

## 🙋 Support

Open an issue, or reach out at `hello@merchcraft.in`.
Built with ❤️ on [Emergent](https://emergent.sh).
