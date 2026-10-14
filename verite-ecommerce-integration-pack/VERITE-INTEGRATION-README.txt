VÉRITÉ INTEGRATION PACK

Files:
- index-verite-connected.html: your existing storefront with Razorpay checkout and shared API calls wired in. Design retained; currency display changed to INR to match the default Razorpay currency.
- verite-backend/: Express API, Supabase schema and server-side product catalogue.

START HERE:
1. Unzip verite-backend-starter.zip. Push the verite-backend folder to a GitHub repository (or place it in your existing repo).
2. Create a Supabase project; run verite-backend/sql/schema.sql in SQL Editor.
3. In verite-backend, copy .env.example to .env locally and fill it. Do not commit .env. On Render, enter these variables in the service Environment panel instead.
4. Deploy the backend to Render with build command `npm install` and start command `npm start`. Root Directory is `verite-backend` if nested in a repo.
5. Set `FRONTEND_ORIGIN` to your exact Vercel domain (for local tests use comma-separated origins such as `http://localhost:5500,https://your-site.vercel.app`).
6. Open index-verite-connected.html and replace `https://YOUR-VERITE-API.onrender.com` in `API_BASE_URL` with your actual Render service URL. Upload/commit this file as your Vercel site's index.html.
7. Keep Razorpay in TEST mode and set the test Key ID + Secret in Render. Configure webhook URL `https://YOUR-RENDER-SERVICE.onrender.com/api/payments/webhook`, enable payment.captured, order.paid, payment.failed, and set the webhook secret in Render.
8. Set `HOST_EMAIL`, `HOST_PASSWORD`, and a random 32+ character `JWT_SECRET` in Render. No host credentials belong in HTML.
9. Check `https://YOUR-RENDER-SERVICE.onrender.com/api/health`.

VERY IMPORTANT PRICING NOTE:
The original HTML displayed `$` prices. This connected version displays `₹` and the backend treats the existing numeric prices (89, 95, etc.) as rupees. These values are copied from your uploaded demo catalogue and are NOT verified commercial prices. Edit verite-backend/src/catalog.json with your approved real selling prices before accepting money. Do not switch to live Razorpay until the actual currency/prices, tax, shipping and refund policy are settled. USD checkout may require international payments/currency enablement from Razorpay.

Cross-device test:
A. Use Razorpay TEST keys and test payment methods only.
B. Device A: open the Vercel URL, place an order, complete test payment, and note the order code.
C. Device B/private window: open `/#/host-login`, sign in using HOST_EMAIL/HOST_PASSWORD. The order should appear because it is read from Supabase via the Render API, not browser localStorage.
D. Mark it Packed, then Shipped with carrier + tracking number. Device A: open `/#/track/ORDER-CODE` and use the same checkout email; verify status/shipping is visible.
E. Try an incorrect host password; login must fail. Try tracking with a different email; order lookup should fail.

Security notes:
- Supabase secret key, Razorpay secret key, webhook secret, host password and JWT secret must stay on Render only.
- The browser stores only the temporary host JWT in sessionStorage and a recent confirmation snapshot in sessionStorage; the shared order record is in Supabase.
- Customer lookup uses order code + email; for stronger privacy in a commercial launch, add email OTP/customer accounts before exposing order details.
- Razorpay must be configured to capture payments automatically, or verification will correctly refuse to label an authorized-but-not-captured payment as PAID.
