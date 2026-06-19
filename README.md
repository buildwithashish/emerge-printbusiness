# MerchCraft AI 🎨

> Production-shaped, AI-powered **custom merchandise e-commerce platform** for the Indian market (B2C + B2B), built on React + FastAPI + MongoDB with OpenAI GPT-Image-1 for on-demand artwork generation and a configurable Razorpay payment pipeline.

![Stack](https://img.shields.io/badge/stack-React%2019%20%E2%80%A2%20FastAPI%20%E2%80%A2%20MongoDB-FF3B30)
![AI](https://img.shields.io/badge/AI-OpenAI%20gpt--image--1-black)
![Status](https://img.shields.io/badge/status-MVP%20complete-success)

---

## ✨ Features

| Module | What's inside |
|---|---|
| **Storefront** | Hero with 3 CTAs, 8 categories (bento grid), 14+ seeded products, search / filter / sort, customer reviews, corporate logo marquee, mobile-first |
| **Product Configurator** | Live preview, variant picker (size / color / fabric / capacity), custom-image upload, custom-text overlay |
| **AI Design Studio** | Prompt → artwork via **OpenAI gpt-image-1**, GPT-4o-mini prompt-enhancement, 8 style chips, tracing-beam loader, design history, download + apply-to-product |
| **Cart + Checkout** | Razorpay (admin-toggleable) + COD; addresses; order summary |
| **Auth** | JWT email + password, role-based (admin / customer) |
| **Customer Dashboard** | Orders with status timeline, saved AI designs |
| **Corporate RFQ** | Full quote form (company, products, qty, location, notes); admin RFQ inbox |
| **Admin Console** | 5 tabs — Overview KPIs, Orders + 10-state status machine, Products, RFQs, Settings (payment-provider toggles, AI-model select, editable SEO) |
| **Design system** | Cabinet Grotesk + Satoshi, vermillion (`#FF3B30`) accent, glass-morphism header, Phosphor icons |

---

## 🧱 Tech Stack

- **Frontend** — React 19 (CRA) · Tailwind CSS · ShadCN UI · `@phosphor-icons/react` · `react-router-dom` v7 · `sonner` (toasts) · `axios`
- **Backend** — FastAPI · Motor (async MongoDB) · Pydantic v2 · `bcrypt` · `pyjwt`
- **AI** — `emergentintegrations` (OpenAI `gpt-image-1` + `gpt-4o-mini`)
- **Database** — MongoDB
- **Payments** — Razorpay (live or mock) · COD
- **Auth** — JWT (HS256)

---

## 📂 Project structure

```
.
├── backend/
│   ├── server.py              # All FastAPI routes (auth, catalog, cart, orders, ai, admin, corporate)
│   ├── requirements.txt
│   └── .env                   # MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, JWT_SECRET, RAZORPAY_*
├── frontend/
│   ├── public/index.html      # Razorpay checkout script lives here
│   ├── src/
│   │   ├── App.js             # Router (public + protected)
│   │   ├── components/Layout.jsx
│   │   ├── pages/             # Home, Products, ProductDetail, DesignStudio, Cart, Checkout, Auth, Account, Corporate, Admin
│   │   └── lib/               # api.js (axios), auth.jsx, cart.jsx
│   ├── package.json
│   └── .env                   # REACT_APP_BACKEND_URL
└── README.md
```

---

## 🚀 Run locally on Mac / Linux / WSL

### 0. Prerequisites

```bash
# macOS
brew install python@3.11 node mongodb-community
npm install -g yarn
brew services start mongodb-community

# Or, run Mongo via Docker (any OS)
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

# AI (required for /studio). Use your Emergent universal key OR your own OpenAI key + adjust server.py to use it directly.
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxxxxxxxxxxxx

# Payments (optional — leave blank for mock checkout)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Start the backend (auto-seeds catalog on first boot):

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

Open `http://localhost:8001/api/` → should return `{"name":"MerchCraft AI","status":"ok"}`.

### 3. Frontend

```bash
cd ../frontend
yarn install
```

Create `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

Start the dev server:

```bash
yarn start
```

App opens at `http://localhost:3000`.

### 4. Demo credentials (auto-seeded)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@merchcraft.in` | `Admin@123` |
| Customer | `demo@merchcraft.in` | `Demo@123` |

---

## 🔐 Environment variables reference

### `backend/.env`

| Key | Required | Default / Example | Notes |
|---|---|---|---|
| `MONGO_URL` | ✅ | `mongodb://localhost:27017` | Use Atlas SRV URI in prod |
| `DB_NAME` | ✅ | `merch_db` | Mongo database name |
| `CORS_ORIGINS` | ✅ | `http://localhost:3000` | Comma-separated list; use your domain in prod |
| `JWT_SECRET` | ✅ | `change-me` | Long random string (≥ 32 chars) |
| `EMERGENT_LLM_KEY` | ⚠️ | `sk-emergent-...` | Required for AI Studio. Get one from Emergent → Profile → Universal Key. If self-hosting permanently, swap for your own OpenAI key — see [Replacing the AI provider](#-replacing-the-ai-provider) |
| `RAZORPAY_KEY_ID` | optional | `rzp_test_...` | Leave blank → checkout uses mock order IDs |
| `RAZORPAY_KEY_SECRET` | optional | — | Backend-only; never expose |

### `frontend/.env`

| Key | Required | Example |
|---|---|---|
| `REACT_APP_BACKEND_URL` | ✅ | `http://localhost:8001` locally, `https://api.yourdomain.com` in prod |
| `REACT_APP_RAZORPAY_KEY_ID` | optional | `rzp_test_...` (public Key ID for the Checkout modal) |

> All backend routes are prefixed with `/api/`. The frontend appends `/api` automatically. Don't put `/api` in `REACT_APP_BACKEND_URL`.

---

## 🤖 Replacing the AI provider

The MVP uses `emergentintegrations` with `EMERGENT_LLM_KEY` for OpenAI **gpt-image-1**.
To use your own OpenAI key instead:

```python
# In backend/server.py — replace the AI generate-image handler
from openai import AsyncOpenAI
oai = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

@api.post("/ai/generate-image")
async def generate_image(body: AIPromptIn, user=Depends(current_user)):
    r = await oai.images.generate(model="gpt-image-1", prompt=body.prompt, n=1, size="1024x1024", response_format="b64_json")
    data_url = f"data:image/png;base64,{r.data[0].b64_json}"
    ...
```

Same pattern works for Anthropic Claude / Google Gemini Nano-Banana / fal.ai Flux — drop in the appropriate SDK.

---

## 💳 Going live with Razorpay

1. Sign up at [razorpay.com](https://razorpay.com) → **Dashboard → Settings → API Keys → Generate Test Key**.
2. Add `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` to `backend/.env`; add `REACT_APP_RAZORPAY_KEY_ID` to `frontend/.env`.
3. Restart backend + frontend.
4. **Add signature verification** in `/api/orders/{oid}/verify-payment` (currently trusts the client — see TODO P0):
   ```python
   rzp.utility.verify_payment_signature({
       "razorpay_order_id": payload["razorpay_order_id"],
       "razorpay_payment_id": payload["razorpay_payment_id"],
       "razorpay_signature": payload["razorpay_signature"],
   })
   ```
5. Register a webhook at `https://api.yourdomain.com/api/webhooks/razorpay` for async `payment.captured` events (still TODO).

Test card: `4111 1111 1111 1111` · exp `12/30` · CVV `123` · OTP `1234`.

---

## ☁️ Deployment

### Option A — Quick & cheap (recommended for early traffic)

| Layer | Provider | Why |
|---|---|---|
| Frontend | **Vercel** | Zero-config for CRA, free SSL, global CDN |
| Backend | **Railway** or **Render** | One-click FastAPI, free tier, easy env-var UI |
| Database | **MongoDB Atlas** (free M0 tier) | Managed, secure, daily backups |

#### Vercel (frontend)

1. Push repo to GitHub → import on [vercel.com](https://vercel.com).
2. **Root directory** → `frontend`.
3. **Build command** → `yarn build` · **Output directory** → `build`.
4. Add env var `REACT_APP_BACKEND_URL=https://your-api.up.railway.app` (no trailing slash).
5. Deploy.

#### Railway (backend)

1. Sign up at [railway.app](https://railway.app), create a new project → **Deploy from GitHub repo**.
2. **Root directory** → `backend`.
3. Set the start command:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
4. Add all `backend/.env` variables in the Railway dashboard.
5. Generate a public domain (Settings → Networking → Generate Domain).
6. Paste that domain into Vercel's `REACT_APP_BACKEND_URL`. Re-deploy frontend.

#### MongoDB Atlas

1. [cloud.mongodb.com](https://cloud.mongodb.com) → free M0 cluster.
2. **Database Access** → add user.
3. **Network Access** → `0.0.0.0/0` (or your Railway egress IPs).
4. Copy the SRV connection string → set `MONGO_URL` in Railway.

---

### Option B — Full AWS deployment

> Production-grade: ECS Fargate (backend) + S3 + CloudFront (frontend) + DocumentDB / Atlas (Mongo).

#### B1. Backend on AWS ECS Fargate

Add a `Dockerfile` in `backend/`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

Then:

1. **Build & push image to ECR**:
   ```bash
   aws ecr create-repository --repository-name merchcraft-backend
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <acct>.dkr.ecr.ap-south-1.amazonaws.com
   docker build -t merchcraft-backend ./backend
   docker tag merchcraft-backend:latest <acct>.dkr.ecr.ap-south-1.amazonaws.com/merchcraft-backend:latest
   docker push <acct>.dkr.ecr.ap-south-1.amazonaws.com/merchcraft-backend:latest
   ```

2. **Create ECS Fargate service**:
   - Cluster → new Fargate cluster.
   - Task definition: 0.5 vCPU / 1 GB, container image from ECR, port `8001`.
   - Inject env vars (`MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `EMERGENT_LLM_KEY`, `RAZORPAY_*`, `CORS_ORIGINS`).
   - Service → 1+ task, attach to an **Application Load Balancer** with HTTPS (ACM cert for `api.yourdomain.com`).

3. **Database** — Use **MongoDB Atlas (free M0)** with the Atlas peering / IP-allow, OR **AWS DocumentDB** (Mongo-compatible). DocumentDB requires the TLS CA bundle:
   ```env
   MONGO_URL=mongodb://user:pass@docdb-cluster:27017/?tls=true&tlsCAFile=/app/global-bundle.pem&retryWrites=false
   ```

4. **DNS** — Route 53 → `api.yourdomain.com` → CNAME to the ALB.

#### B2. Frontend on AWS S3 + CloudFront

```bash
cd frontend
yarn build
aws s3 mb s3://merchcraft-frontend-prod --region ap-south-1
aws s3 sync build/ s3://merchcraft-frontend-prod --delete
```

1. Enable static-site hosting on the bucket.
2. Create a **CloudFront distribution** → origin = the S3 bucket (use OAC, block public bucket).
3. Set the **default root object** to `index.html`.
4. Add a custom error response: `403 → /index.html` (200) — needed for React Router.
5. Attach an ACM cert for `www.yourdomain.com` and point Route 53 to the distribution.
6. Set `REACT_APP_BACKEND_URL=https://api.yourdomain.com` in the build env (re-run `yarn build` after changing).

#### B3. Cost estimate (Mumbai / `ap-south-1`)

| Resource | Monthly |
|---|---|
| ECS Fargate (1 task, 0.5 vCPU, 1 GB, 24×7) | ≈ $12 |
| ALB | ≈ $18 |
| S3 + CloudFront (10 GB out) | ≈ $2 |
| Route 53 hosted zone | $0.50 |
| MongoDB Atlas M0 | Free |
| **Total** | **≈ $33 / month** |

---

### Option C — Single VPS (DigitalOcean / Hetzner / Linode)

Cheapest path for an MVP — one $6/month droplet runs the lot.

```bash
# On a fresh Ubuntu 22.04 droplet
ssh root@<droplet-ip>
apt update && apt install -y python3.11 python3.11-venv nodejs npm nginx git
npm i -g yarn pm2
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb.gpg --dearmor
echo "deb [arch=amd64,signed-by=/usr/share/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb.list
apt update && apt install -y mongodb-org && systemctl enable --now mongod

# Clone & set up your code
git clone https://github.com/<you>/<repo>.git /opt/merchcraft
cd /opt/merchcraft/backend
python3.11 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
# create /opt/merchcraft/backend/.env with prod values

cd /opt/merchcraft/frontend
yarn install && REACT_APP_BACKEND_URL=https://yourdomain.com yarn build
```

Then run with **PM2**:

```bash
pm2 start "uvicorn server:app --host 0.0.0.0 --port 8001" --name mc-api --cwd /opt/merchcraft/backend --interpreter /opt/merchcraft/backend/venv/bin/python
pm2 save && pm2 startup
```

**nginx** as reverse proxy (HTTPS via certbot):

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

### Option D — Docker Compose (any host)

Create `docker-compose.yml` at the repo root:

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
      args:
        REACT_APP_BACKEND_URL: ${PUBLIC_BACKEND_URL}
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
- [ ] Set `CORS_ORIGINS` to your real domain(s) — not `*`
- [ ] Razorpay signature verification + webhook
- [ ] Move AI image output to S3 / Cloudflare R2 (currently base64 in Mongo)
- [ ] Add Atlas backups / `--backup` schedule for DocumentDB
- [ ] Rotate `EMERGENT_LLM_KEY` / switch to your own OpenAI key
- [ ] Add rate limiting (`slowapi` on FastAPI + WAF on CloudFront)
- [ ] Enable Sentry / CloudWatch logs
- [ ] HTTPS everywhere · HSTS · secure cookies

---

## 🧪 Tests

```bash
cd backend
source venv/bin/activate
pytest tests/   # 30 tests, full coverage of auth, catalog, cart, orders, AI, admin
```

---

## 📋 Roadmap

Detailed P0 / P1 / P2 backlog in [`/memory/TODO.md`](memory/TODO.md). Highlights:

- **P0** — Razorpay signature verify + webhook · S3 storage for AI artwork · OTP login · order-success page · Next.js SSR port for SEO
- **P1** — Canva-like full editor · Shiprocket · WhatsApp Business / Brevo / MSG91 · loyalty + referral · coupons · GA4 / Meta Pixel / Clarity · corporate dashboard
- **P2** — Recommendation engine · multi-language · multi-currency · A/B testing · K8s manifests · audit logs · DPDP/GDPR tooling

---

## 📜 License

MIT — do whatever you want, attribution appreciated.

---

## 🙋 Support

Open an issue, or reach out at `hello@merchcraft.in`.
Built with ❤️ on [Emergent](https://emergent.sh).
