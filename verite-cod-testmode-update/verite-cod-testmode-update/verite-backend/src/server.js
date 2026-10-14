require('dotenv').config();
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const CATALOG = require('./catalog.json');
const { createClient } = require('@supabase/supabase-js');

const required = ['SUPABASE_URL','SUPABASE_SECRET_KEY','HOST_EMAIL','HOST_PASSWORD','JWT_SECRET','FRONTEND_ORIGIN'];
for (const k of required) if (!process.env[k]) { console.error(`Missing required environment variable: ${k}`); process.exit(1); }
if (process.env.JWT_SECRET.length < 32) { console.error('JWT_SECRET must be at least 32 characters.'); process.exit(1); }
const CURRENCY = (process.env.RAZORPAY_CURRENCY || 'INR').toUpperCase();
if (!['INR','USD'].includes(CURRENCY)) { console.error('This starter supports INR, or USD only if Razorpay has enabled it on your account.'); process.exit(1); }
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
// COD works without Razorpay activation or API keys. Online test payments become available once both TEST keys are configured.
const razorpayEnabled = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const razorpay = razorpayEnabled ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) : null;
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN.split(',').map(x => x.trim()), methods: ['GET','POST','PATCH','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));

// Razorpay webhooks require the exact raw request body for signature validation.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('x-razorpay-signature');
    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(400).send('Webhook not configured');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(req.body).digest('hex');
    const a = Buffer.from(expected, 'hex'), b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).send('Invalid signature');
    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload?.payment?.entity;
      const rOrderId = payment?.order_id || event.payload?.order?.entity?.id;
      const rPaymentId = payment?.id;
      if (rOrderId && rPaymentId) {
        const { data: order } = await supabase.from('verite_orders').select('*').eq('razorpay_order_id', rOrderId).maybeSingle();
        if (order && Number(payment?.amount ?? order.total_minor) === order.total_minor) {
          await markPaid(order, rPaymentId);
        }
      }
    } else if (event.event === 'payment.failed') {
      const p = event.payload?.payment?.entity;
      if (p?.order_id) await supabase.from('verite_orders').update({ payment_status: 'FAILED', updated_at: new Date().toISOString() }).eq('razorpay_order_id', p.order_id).eq('payment_status','PENDING');
    }
    res.json({ received: true });
  } catch (e) { console.error('Webhook error:', e.message); res.status(500).send('Webhook processing failed'); }
});
app.use(express.json({ limit: '150kb' }));

function fail(res, status, message) { return res.status(status).json({ error: message }); }
function cleanCustomer(c) {
  const keys = ['firstName','lastName','email','phone','address','city','state','zip'];
  const out = {};
  for (const k of keys) out[k] = String(c?.[k] ?? '').trim().slice(0, 300);
  if (!out.firstName || !out.lastName || !/^\S+@\S+\.\S+$/.test(out.email) || out.phone.length < 7 || !out.address || !out.city || !out.state || !out.zip) throw new Error('Please provide valid delivery details.');
  return out;
}
function authHost(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'host' || payload.email !== process.env.HOST_EMAIL) throw new Error('Unauthorized');
    req.host = payload; next();
  } catch { return fail(res, 401, 'Host login required.'); }
}
function safeOrder(row) {
  return { orderId: row.order_code, createdAt: row.created_at, customer: row.customer, items: row.items,
    subtotal: row.subtotal_minor / 100, shipping: row.shipping_minor / 100, total: row.total_minor / 100,
    currency: row.currency, paymentStatus: row.payment_status, paymentId: row.razorpay_payment_id || '',
    orderStatus: row.order_status, paymentMethod: row.payment_method || (row.razorpay_order_id ? 'RAZORPAY' : 'COD'), shipment: row.shipment, statusHistory: row.status_history || [] };
}
async function markPaid(order, paymentId) {
  const now = new Date().toISOString();
  const history = [...(order.status_history || [])];
  if (!history.some(x => x.status === 'Processing')) history.push({ status: 'Processing', description: 'Payment verified by Razorpay.', at: now });
  const { error } = await supabase.from('verite_orders').update({ payment_status: 'PAID', payment_method: 'RAZORPAY', order_status: 'Processing', razorpay_payment_id: paymentId, status_history: history, updated_at: now }).eq('id', order.id).eq('payment_status','PENDING');
  if (error) throw error;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'verite-api' }));
app.get('/api/config', (_req, res) => res.json({ razorpayEnabled, keyId: razorpayEnabled ? process.env.RAZORPAY_KEY_ID : null, currency: CURRENCY }));

app.post('/api/host/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  // Compare against environment-stored host credentials. No demo credentials are shipped.
  const emailOk = email === process.env.HOST_EMAIL.toLowerCase();
  const passOk = await bcrypt.compare(password, await bcrypt.hash(process.env.HOST_PASSWORD, 10));
  if (!emailOk || !passOk) return fail(res, 401, 'Invalid host email or password.');
  const token = jwt.sign({ role: 'host', email: process.env.HOST_EMAIL }, process.env.JWT_SECRET, { expiresIn: '8h', issuer: 'verite-api', audience: 'verite-host' });
  res.json({ token, expiresIn: 28800 });
});

app.post('/api/payments/create', async (req, res) => {
  if (!razorpayEnabled || !razorpay) return fail(res, 503, 'Online payments are not configured yet. You can place a Cash on Delivery order.');
  try {
    const customer = cleanCustomer(req.body?.customer);
    const incoming = req.body?.items;
    if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 40) return fail(res, 400, 'Cart is empty or too large.');
    // Catalogue and prices are loaded on the server; browser-supplied prices are ignored.
    const normalized = [];
    for (const line of incoming) {
      const id = Number(line.id), qty = Number(line.qty);
      if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) return fail(res, 400, 'Invalid cart item.');
      const p = CATALOG[String(id)];
      if (!p || !Number.isFinite(Number(p.price)) || Number(p.price) <= 0) return fail(res, 400, `Product ${id} is unavailable.`);
      normalized.push({ id, name: String(p.name).slice(0,160), price: Number(p.price), qty, images: Array.isArray(p.images) ? [String(p.images[0] || '').slice(0,1000)] : [] });
    }
    const subtotal = normalized.reduce((s, i) => s + Math.round(i.price * 100) * i.qty, 0);
    const shipping = subtotal >= 15000 ? 0 : 1200; // Matches existing site's 150 / 12 threshold, in minor units.
    const total = subtotal + shipping;
    const orderCode = `VER-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { data: row, error: dbErr } = await supabase.from('verite_orders').insert({
      order_code: orderCode, customer, items: normalized, subtotal_minor: subtotal, shipping_minor: shipping, total_minor: total,
      currency: CURRENCY, payment_status: 'PENDING', payment_method: 'RAZORPAY', order_status: 'Awaiting Payment',
      status_history: [{ status: 'Awaiting Payment', description: 'Order created; waiting for Razorpay payment confirmation.', at: new Date().toISOString() }]
    }).select('*').single();
    if (dbErr) throw dbErr;
    let rpOrder;
    try { rpOrder = await razorpay.orders.create({ amount: total, currency: CURRENCY, receipt: orderCode, notes: { verite_order_id: row.id, order_code: orderCode } }); }
    catch (e) { await supabase.from('verite_orders').delete().eq('id', row.id); throw e; }
    const { error: linkErr } = await supabase.from('verite_orders').update({ razorpay_order_id: rpOrder.id, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (linkErr) throw linkErr;
    res.status(201).json({ orderId: orderCode, razorpayOrderId: rpOrder.id, amount: total, currency: CURRENCY, keyId: process.env.RAZORPAY_KEY_ID, customer: { name: `${customer.firstName} ${customer.lastName}`, email: customer.email, contact: customer.phone } });
  } catch (e) { console.error('Create payment order error:', e.message); return fail(res, 400, e.message || 'Could not start payment.'); }
});

app.post('/api/orders/cod', async (req, res) => {
  try {
    const customer = cleanCustomer(req.body?.customer);
    const incoming = req.body?.items;
    if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 40) return fail(res, 400, 'Cart is empty or too large.');
    // Never trust browser-supplied prices; calculate all amounts from the server catalogue.
    const normalized = [];
    for (const line of incoming) {
      const id = Number(line.id), qty = Number(line.qty);
      if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) return fail(res, 400, 'Invalid cart item.');
      const p = CATALOG[String(id)];
      if (!p || !Number.isFinite(Number(p.price)) || Number(p.price) <= 0) return fail(res, 400, `Product ${id} is unavailable.`);
      normalized.push({ id, name: String(p.name).slice(0,160), price: Number(p.price), qty, images: Array.isArray(p.images) ? [String(p.images[0] || '').slice(0,1000)] : [] });
    }
    const subtotal = normalized.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
    const shipping = subtotal >= 15000 ? 0 : 1200;
    const total = subtotal + shipping;
    const orderCode = `VER-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    const { data: row, error } = await supabase.from('verite_orders').insert({
      order_code: orderCode, customer, items: normalized, subtotal_minor: subtotal, shipping_minor: shipping, total_minor: total,
      currency: CURRENCY, payment_status: 'PENDING', payment_method: 'COD', order_status: 'Confirmed',
      status_history: [{ status: 'Confirmed', description: 'Cash on Delivery order placed. Payment is due when the order is delivered.', at: now }]
    }).select('*').single();
    if (error) throw error;
    res.status(201).json({ ok: true, order: safeOrder(row) });
  } catch (e) {
    console.error('Create COD order error:', e.message);
    return fail(res, 400, e.message || 'Could not place Cash on Delivery order.');
  }
});

app.post('/api/payments/verify', async (req, res) => {
  if (!razorpayEnabled || !razorpay) return fail(res, 503, 'Online payments are not configured yet.');
  try {
    const { razorpay_order_id: rOrder, razorpay_payment_id: rPayment, razorpay_signature: signature, orderId } = req.body || {};
    if (![rOrder, rPayment, signature, orderId].every(x => typeof x === 'string' && x.length > 0)) return fail(res, 400, 'Missing Razorpay verification fields.');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${rOrder}|${rPayment}`).digest('hex');
    const a = Buffer.from(expected, 'hex'), b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail(res, 400, 'Payment signature verification failed.');
    const { data: order, error } = await supabase.from('verite_orders').select('*').eq('order_code', orderId).eq('razorpay_order_id', rOrder).single();
    if (error || !order) return fail(res, 404, 'Order not found.');
    // Fetch the payment from Razorpay, rather than trusting the browser callback alone.
    const payment = await razorpay.payments.fetch(rPayment);
    if (payment.order_id !== rOrder || payment.currency !== CURRENCY || Number(payment.amount) !== order.total_minor || payment.status !== 'captured') {
      return fail(res, 409, 'Razorpay has not confirmed a captured payment for this order yet.');
    }
    await markPaid(order, rPayment);
    const { data: updated, error: readErr } = await supabase.from('verite_orders').select('*').eq('id', order.id).single();
    if (readErr) throw readErr;
    res.json({ ok: true, order: safeOrder(updated) });
  } catch (e) { console.error('Verify payment error:', e.message); return fail(res, 400, 'Payment could not be verified. If money was deducted, contact support with your Razorpay payment ID.'); }
});

app.get('/api/customer/orders', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'A valid email is required.');
  const { data, error } = await supabase.from('verite_orders').select('*').ilike('customer->>email', email).order('created_at', { ascending: false }).limit(50);
  if (error) return fail(res, 500, 'Could not load orders.');
  res.json({ orders: (data || []).map(safeOrder) });
});
app.get('/api/customer/orders/:orderCode', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return fail(res, 400, 'Email is required to view order details.');
  const { data, error } = await supabase.from('verite_orders').select('*').eq('order_code', req.params.orderCode).ilike('customer->>email', email).maybeSingle();
  if (error) return fail(res, 500, 'Could not load order.');
  if (!data) return fail(res, 404, 'Order not found for that email.');
  res.json({ order: safeOrder(data) });
});
app.get('/api/host/orders', authHost, async (_req, res) => {
  const { data, error } = await supabase.from('verite_orders').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) return fail(res, 500, 'Could not load orders.');
  res.json({ orders: (data || []).map(safeOrder) });
});
app.patch('/api/host/orders/:orderCode', authHost, async (req, res) => {
  const allowed = ['Processing','Confirmed','Packed','Shipped','Out for Delivery','Delivered','Cancelled'];
  const status = String(req.body?.orderStatus || '');
  if (!allowed.includes(status)) return fail(res, 400, 'Invalid order status.');
  const shipment = {
    carrier: String(req.body?.shipment?.carrier || '').slice(0,100),
    trackingNumber: String(req.body?.shipment?.trackingNumber || '').slice(0,150),
    estimatedDelivery: String(req.body?.shipment?.estimatedDelivery || '').slice(0,30),
    trackingUrl: String(req.body?.shipment?.trackingUrl || '').slice(0,1000)
  };
  if (status === 'Shipped' && !shipment.trackingNumber) return fail(res, 400, 'Add a tracking number before marking the order shipped.');
  const { data: order, error: findErr } = await supabase.from('verite_orders').select('*').eq('order_code', req.params.orderCode).single();
  if (findErr || !order) return fail(res, 404, 'Order not found.');
  if (order.payment_status !== 'PAID' && order.payment_method !== 'COD' && status !== 'Cancelled') return fail(res, 409, 'Only paid online orders or Cash on Delivery orders can be processed or shipped.');
  const now = new Date().toISOString();
  const note = String(req.body?.note || '').trim().slice(0,500) || `Order updated to ${status}.`;
  const history = [...(order.status_history || []), { status, description: note, at: now }];
  const { data: updated, error } = await supabase.from('verite_orders').update({ order_status: status, shipment, status_history: history, updated_at: now }).eq('id', order.id).select('*').single();
  if (error) return fail(res, 500, 'Could not save order update.');
  res.json({ order: safeOrder(updated) });
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Unexpected server error.' }); });
const port = Number(process.env.PORT || 10000);
app.listen(port, () => console.log(`VÉRITÉ API listening on ${port}`));
