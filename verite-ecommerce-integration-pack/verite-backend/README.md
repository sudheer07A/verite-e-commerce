# VÉRITÉ shared orders API

This is a backend starter for the uploaded single-file storefront. It uses Express on Render, Supabase PostgreSQL for shared order storage, and Razorpay for real payment orders/verification. It does not mark an order paid from a timer or from the browser's success callback alone.

## Important before deployment

- The uploaded HTML currently displays `$` and product prices like 89, 95, 299, plus a free-shipping threshold of 150 and shipping fee 12. Razorpay accounts in India normally need an INR price catalogue unless international payments/currency support is enabled. This starter defaults to `INR`, and amounts are treated as minor units after multiplying the catalogue price by 100. Decide the actual selling prices/currency before live payments; do not use placeholder prices for real customers.
- The frontend must send product IDs and quantities only. This starter includes a server-side `src/catalog.json` copied from your uploaded HTML, so browser-supplied prices are ignored. Update that catalogue with your approved final prices before accepting real payments.
- Set Razorpay keys to **test mode** first. Add the webhook endpoint in Razorpay Dashboard as `https://YOUR-RENDER-SERVICE.onrender.com/api/payments/webhook`, subscribe to `payment.captured`, `order.paid`, and `payment.failed`, and set the same webhook secret in Render.
- The host credentials are server environment variables. There are no hardcoded demo credentials. The host API is protected with an 8-hour signed JWT. Do not expose Supabase secret keys, Razorpay secret keys, webhook secret, host password, or JWT secret in HTML/Vercel variables prefixed with `VITE_`/`NEXT_PUBLIC_`.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `sql/schema.sql`.
3. In Project Settings / API Keys, copy the Project URL and **secret key** (or legacy service_role key if that is what the project provides). Put it only in Render environment variables.

## Run locally

1. Copy `.env.example` to `.env` and fill every value.
2. Run `npm install` then `npm start`.
3. Health check: `http://localhost:10000/api/health`.
4. Never commit `.env`; it is ignored by default in a real project. Add `.env` to `.gitignore` before pushing.

## Deploy on Render

Create a new **Web Service** from the GitHub repository containing this folder. Set Root Directory to `verite-backend` if the backend is in a subfolder. Build command: `npm install`. Start command: `npm start`. Add all variables from `.env.example` in Render's Environment tab. `PORT` may be omitted on Render; the server uses Render's injected port.

## API routes

- `GET /api/health` — health check.
- `POST /api/host/login` — host email/password → JWT.
- `POST /api/payments/create` — creates a pending shared order + Razorpay order.
- `POST /api/payments/verify` — verifies HMAC signature and fetches payment status from Razorpay; only then marks paid.
- `POST /api/payments/webhook` — validates Razorpay webhook signature and handles captured/failed events.
- `GET /api/customer/orders?email=...` — orders matching email.
- `GET /api/customer/orders/:orderCode?email=...` — order/tracking details only if email matches.
- `GET /api/host/orders` — requires `Authorization: Bearer <JWT>`.
- `PATCH /api/host/orders/:orderCode` — requires host JWT; saves shipping/status updates.

## Production security checklist

- Review and update `src/catalog.json` with approved selling prices before live use; prices are currently copied from the uploaded HTML and are not a confirmation of your real price list.
- Add a CAPTCHA/anti-bot layer and review rate limits before opening public checkout.
- Keep customer order endpoints rate-limited and require email confirmation/OTP or an authenticated customer account for higher privacy. Email-only access is a basic lookup, not strong identity verification.
- Use a unique random `JWT_SECRET` (32+ chars), unique host password, HTTPS origins, and rotate keys if exposed.
- Configure Razorpay webhooks and reconcile payment status. Webhook events may be retried; payment updates should remain idempotent.
- Configure CORS `FRONTEND_ORIGIN` to the exact Vercel domain(s), comma-separated if needed.
