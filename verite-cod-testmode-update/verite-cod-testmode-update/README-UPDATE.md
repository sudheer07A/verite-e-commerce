# VÉRITÉ — Razorpay Test Mode + Cash on Delivery update

This update keeps the storefront design and adds server-backed Cash on Delivery orders. COD works without Razorpay account activation or API keys. Online Razorpay checkout activates only when both Razorpay TEST keys are configured on Render.

## Apply this update to GitHub
1. Download/extract this ZIP.
2. In your `sudheer07A/verite-e-commerce` repository, replace the root `index.html` with this bundle's `index.html`.
3. Replace the repository's `verite-backend` folder with this bundle's `verite-backend` folder. Ensure `verite-backend/src/server.js`, `verite-backend/src/catalog.json`, `verite-backend/package.json`, and `verite-backend/sql/schema.sql` are committed.
4. Commit and push to `main`. Render should redeploy automatically.

## Supabase
Open Supabase SQL Editor and run `verite-backend/sql/schema.sql`. This includes the `payment_method` column migration needed by the COD endpoint. Back up any real order data before applying schema changes.

## Render environment
Required for COD and host dashboard:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `HOST_EMAIL`
- `HOST_PASSWORD`
- `JWT_SECRET` (32+ characters)
- `FRONTEND_ORIGIN` (exact Vercel origin, no trailing slash)

Optional, only to enable Razorpay Test Mode:
- `RAZORPAY_KEY_ID` (test key ID)
- `RAZORPAY_KEY_SECRET` (test key secret)
- `RAZORPAY_WEBHOOK_SECRET` (webhook secret, once webhook is configured)
- `RAZORPAY_CURRENCY=INR`

Keep all secrets in Render, never in `index.html` or GitHub. Use test keys only. Live payments require provider onboarding/activation.

## Frontend API URL
In root `index.html`, find:
`const API_BASE_URL='https://YOUR-VERITE-API.onrender.com';`
Replace it with your actual Render service URL, without a trailing slash, then commit and push. Keep `FRONTEND_ORIGIN` set to the deployed Vercel site's exact origin.

## Test
1. Open `https://YOUR-RENDER-SERVICE.onrender.com/api/health`; expect `{ "ok": true, "service": "verite-api" }`.
2. Add an item to cart and checkout using a valid customer address.
3. Place a Cash on Delivery order. It should appear in Supabase and the host dashboard on another device, with payment status `PENDING` and method `COD`.
4. Host can update COD order status and shipment; do not mark COD as paid until cash is collected.
5. To test online payments, add Razorpay TEST key ID and TEST key secret to Render. Test mode never collects real money.

Important: `src/catalog.json` is the server-side source of product prices. Verify that every product price is your intended INR selling price before taking real customer orders.
