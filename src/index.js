const JSON_HEADERS = { "content-type": "application/json; charset=UTF-8" };
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 100000;
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const rateBuckets = new Map();
const RESET_TOKEN_MINUTES = 30;
const RESET_FROM_EMAIL_DEFAULT = "The KaXro <thekaxro@gmail.com>";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, "cache-control": "no-store", ...headers },
  });
}
function bad(message, status = 400) { return json({ ok: false, error: message }, status); }
async function body(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) throw new Error("Request too large.");
  try { return await request.json(); } catch { return {}; }
}
function clean(value, max = 500) { return String(value ?? "").trim().slice(0, max); }
function email(value) { return clean(value, 190).toLowerCase(); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function validPhone(value) { return /^[0-9+()\-\s]{7,40}$/.test(value); }
function money(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0; }
function int(value, fallback = 0) { const n = Number(value); return Number.isInteger(n) ? n : fallback; }
function cookieToken(request) {
  const raw = request.headers.get("Cookie") || "";
  const m = raw.match(/(?:^|;\s*)kaxro_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
function setCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function clearCookie(name) { return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`; }
function randomBytes(n = 32) { return crypto.getRandomValues(new Uint8Array(n)); }
function hex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return hex(new Uint8Array(digest));
}
async function timingSafeHexEqual(a, b) {
  if (a.length !== b.length) return false;
  const [aa, bb] = [a, b].map(x => Uint8Array.from(x.match(/.{2}/g).map(v => parseInt(v, 16))));
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(aa, bb) : aa.every((v, i) => v === bb[i]);
}
async function hashPassword(password, saltHex = hex(randomBytes(16))) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(x => parseInt(x, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${saltHex}$${hex(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  const [kind, iterationsRaw, saltHex, expected] = String(stored || "").split("$");
  const iterations = Number(iterationsRaw);
  if (kind !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || !/^[0-9a-f]{32}$/.test(saltHex || "") || !/^[0-9a-f]{64}$/.test(expected || "")) return false;
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(x => parseInt(x, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return timingSafeHexEqual(hex(new Uint8Array(bits)), expected);
}
function rateKey(request, suffix) { return `${request.headers.get("CF-Connecting-IP") || "unknown"}:${suffix}`; }
function rateLimit(request, suffix, limit = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const key = rateKey(request, suffix);
  const current = rateBuckets.get(key) || { count: 0, reset: now + windowMs };
  if (current.reset <= now) { current.count = 0; current.reset = now + windowMs; }
  current.count += 1;
  rateBuckets.set(key, current);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (v.reset <= now) rateBuckets.delete(k);
  }
  return current.count <= limit;
}
async function newSession(env, userId) {
  const token = hex(randomBytes(32));
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash, userId, expires).run();
  return token;
}
async function auth(env, request) {
  if (!env.DB) return null;
  const token = cookieToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT u.id,u.name,u.email,u.phone,u.address,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > CURRENT_TIMESTAMP`).bind(tokenHash).first();
  return row || null;
}
function requireDB(env) { return env.DB ? null : bad("Database is not connected yet. Add the existing thekaxro-db D1 binding as DB in Wrangler.", 503); }
function orderNumber() { return `KX-${Date.now().toString(36).toUpperCase()}-${hex(randomBytes(3)).toUpperCase()}`; }
function publicUser(row) { return row ? { id: row.id, name: row.name, email: row.email, role: row.role, phone: row.phone || "", address: row.address || "" } : null; }
function assertAdminId(id) { const n = Number(id); return Number.isInteger(n) && n > 0 ? n : null; }

async function products(env, request) {
  const q = clean(new URL(request.url).searchParams.get("q"), 80);
  const category = clean(new URL(request.url).searchParams.get("category"), 50);
  let sql = `SELECT id,name,description,price,image,category,stock,active FROM products WHERE active=1`;
  const args = [];
  if (q) { sql += ` AND (name LIKE ? OR description LIKE ?)`; args.push(`%${q}%`, `%${q}%`); }
  if (category) { sql += ` AND category=?`; args.push(category); }
  sql += ` ORDER BY id DESC`;
  const result = await env.DB.prepare(sql).bind(...args).all();
  const counts = (await env.DB.prepare(`SELECT category, COUNT(*) AS count FROM products WHERE active=1 GROUP BY category`).all()).results || [];
  const categoryCounts = Object.fromEntries(counts.map(x => [x.category, Number(x.count || 0)]));
  return json({ ok: true, products: result.results || [], categoryCounts });
}

async function authMe(env, request) { return json({ ok: true, user: publicUser(await auth(env, request)) }); }

async function signup(env, request) {
  if (!rateLimit(request, "signup", 6)) return bad("Too many account attempts. Please try again later.", 429);
  const d = await body(request);
  const name = clean(d.name, 80), em = email(d.email), password = String(d.password || ""), phone = clean(d.phone, 40), address = clean(d.address, 300);
  if (name.length < 2 || name.length > 80 || !validEmail(em) || password.length < 8 || password.length > 128) return bad("Use a valid name and email, and a password between 8 and 128 characters.");
  if (phone && !validPhone(phone)) return bad("Enter a valid phone number.");
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(em).first();
  if (exists) return bad("An account with this email already exists.", 409);
  const hash = await hashPassword(password);
  try {
    const result = await env.DB.prepare("INSERT INTO users (name,email,password_hash,phone,address,role) VALUES (?,?,?,?,?,'customer')").bind(name, em, hash, phone, address).run();
    const token = await newSession(env, result.meta.last_row_id);
    return json({ ok: true, user: { id: result.meta.last_row_id, name, email: em, role: "customer", phone, address } }, 201, { "set-cookie": setCookie("kaxro_session", token, SESSION_DAYS * 86400) });
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e?.message))) return bad("An account with this email already exists.", 409);
    throw e;
  }
}

async function login(env, request, owner = false) {
  const d = await body(request);
  const em = email(d.email);
  if (!rateLimit(request, `login:${em}`, 8)) return bad("Too many sign-in attempts. Please try again later.", 429);
  const password = String(d.password || "");
  if (!validEmail(em) || password.length < 1 || password.length > 128) return bad("Enter a valid email and password.");
  const row = await env.DB.prepare("SELECT id,name,email,password_hash,role,phone,address FROM users WHERE email=?").bind(em).first();
  if (!row || !(await verifyPassword(password, row.password_hash))) return bad("Invalid email or password.", 401);
  if (owner && (row.role !== "owner" || String(row.email || "").toLowerCase() !== OWNER_EMAIL)) return bad("Owner access required.", 403);
  const oldToken = cookieToken(request);
  if (oldToken) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(oldToken)).run();
  const token = await newSession(env, row.id);
  return json({ ok: true, user: publicUser(row) }, 200, { "set-cookie": setCookie("kaxro_session", token, SESSION_DAYS * 86400) });
}

async function sendPasswordResetEmail(env, request, user, token) {
  if (!env.RESEND_API_KEY) throw new Error("Password reset email service is not configured.");
  const from = String(env.RESET_FROM_EMAIL || RESET_FROM_EMAIL_DEFAULT).trim();
  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your The KaXro password";
  const safeName = clean(user.name, 80) || "there";
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#211d18;background:#f7f1e6;padding:32px"><div style="max-width:560px;margin:auto;background:#fffaf0;border:1px solid #ddd0bd;padding:32px"><p style="letter-spacing:.18em;font-size:12px;text-transform:uppercase">THE KAXRO</p><h1 style="font-family:Georgia,serif;font-weight:500">Reset your password</h1><p>Hi ${escapeHtmlText(safeName)},</p><p>We received a request to reset your The KaXro account password. This link expires in ${RESET_TOKEN_MINUTES} minutes.</p><p><a href="${resetUrl}" style="display:inline-block;background:#211d18;color:#fffaf0;text-decoration:none;padding:13px 20px">Reset password</a></p><p style="font-size:13px;color:#6f675d">If you did not request this, you can safely ignore this email.</p><p style="font-size:12px;color:#8a8176;word-break:break-all">${resetUrl}</p></div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [user.email], subject, html })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Password reset email failed", response.status, detail);
    throw new Error("Password reset email could not be sent.");
  }
}
function escapeHtmlText(value) {
  return String(value || "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

async function forgotPassword(env, request) {
  if (!rateLimit(request, "forgot-password", 6, 15 * 60 * 1000)) return bad("Too many password reset requests. Please try again later.", 429);
  const d = await body(request);
  const em = email(d.email);
  // Always return the same public response for valid-looking addresses so the endpoint
  // does not reveal whether an account exists.
  const generic = () => json({ ok: true, message: "If an account exists for that email, a password reset link has been sent." });
  if (!validEmail(em)) return generic();
  const user = await env.DB.prepare("SELECT id,name,email FROM users WHERE email=?").bind(em).first();
  if (!user) return generic();
  if (!env.RESEND_API_KEY) return bad("Password reset email is not configured yet. Add the RESEND_API_KEY Worker secret.", 503);
  const token = hex(randomBytes(32));
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=? OR expires_at <= CURRENT_TIMESTAMP").bind(user.id).run();
  await env.DB.prepare("INSERT INTO password_reset_tokens (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(tokenHash, user.id, expires).run();
  try {
    await sendPasswordResetEmail(env, request, user, token);
  } catch (error) {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(tokenHash).run();
    console.error("Forgot password email error", error);
    return bad("We could not send the reset email right now. Please try again later.", 503);
  }
  return generic();
}

async function resetPassword(env, request) {
  if (!rateLimit(request, "reset-password", 10, 15 * 60 * 1000)) return bad("Too many password reset attempts. Please try again later.", 429);
  const d = await body(request);
  const token = clean(d.token, 128);
  const password = String(d.password || "");
  if (!/^[0-9a-f]{64}$/.test(token)) return bad("This password reset link is invalid or has expired.", 400);
  if (password.length < 8 || password.length > 128) return bad("Use a password between 8 and 128 characters.");
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT prt.id,prt.user_id,u.email FROM password_reset_tokens prt JOIN users u ON u.id=prt.user_id WHERE prt.token_hash=? AND prt.used=0 AND prt.expires_at > CURRENT_TIMESTAMP`).bind(tokenHash).first();
  if (!row) return bad("This password reset link is invalid or has expired.", 400);
  const hash = await hashPassword(password);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash, row.user_id),
    env.DB.prepare("UPDATE password_reset_tokens SET used=1 WHERE id=?").bind(row.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id),
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=? AND id<>?").bind(row.user_id, row.id)
  ]);
  return json({ ok: true, message: "Password reset successfully. You can now sign in with your new password." });
}

async function logout(env, request) {
  if (env.DB) {
    const t = cookieToken(request);
    if (t) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(t)).run();
  }
  return json({ ok: true }, 200, { "set-cookie": clearCookie("kaxro_session") });
}

async function profile(env, request) {
  const user = await auth(env, request); if (!user) return bad("Please sign in.", 401);
  if (request.method === "GET") return json({ ok: true, user: publicUser(user) });
  const d = await body(request);
  const name = clean(d.name, 80), phone = clean(d.phone, 40), address = clean(d.address, 300);
  if (name.length < 2) return bad("Name is required.");
  if (phone && !validPhone(phone)) return bad("Enter a valid phone number.");
  await env.DB.prepare("UPDATE users SET name=?,phone=?,address=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name, phone, address,ser) return bad("Please sign in before applying a discount code.", 401);
  const d = await body(request); const code = clean(d.code, 40).toUpperCase();
  const frameSize = clean(d.frameSize, 10).toUpperCase();
  const items = Array.isArray(d.items) ? d.items.slice(0, 30) : [];
  if (!code || !items.length) return bad("Enter a discount code and keep at least one item in the cart.");
  if (!SIZE_PRICES[frameSize]) return bad("Choose a valid frame size.");
  const ids = [...new Set(items.map(x => Number(x.id)).filter(Number.isInteger))];
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await env.DB.prepare(`SELECT id,price,stock,active FROM products WHERE id IN (${placeholders})`).bind(...ids).all()).results || [];
  const byId = new Map(rows.map(r => [r.id, r]));
  let subtotal = 0;
  const unitPrice = getSizePrice(frameSize);
  for (const item of items) {
    const p = byId.get(Number(item.id)); const qty = Math.min(20, Math.max(1, Math.floor(Number(item.quantity) || 1)));
    if (!p || !p.active || p.stock < qty) return bad("One of the selected products is no longer available.");
    subtotal += unitPrice * qty;
  }
  const coupon = await env.DB.prepare("SELECT id,code,discount_type,value,active,max_uses,used_count,expires_at FROM coupons WHERE code=? COLLATE NOCASE").bind(code).first();
  if (!coupon || !coupon.active || (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) || (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)) return bad("That discount code is invalid or unavailable.");
  const discount = coupon.discount_type === "percent" ? Math.min(subtotal, Math.floor(subtotal * coupon.value / 100)) : Math.min(subtotal, Math.max(0, coupon.value));
  return json({ ok:true, coupon:{code:coupon.code, discountType:coupon.discount_type, value:coupon.value}, discount, subtotal, total:Math.max(0, subtotal-discount) });
}

async function storeSettings(env) {
  const rows = (await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('store_name','store_open')").all()).results || [];
  const settings = Object.fromEntries(rows.map(x => [x.key, x.value]));
  settings.support_email = 'thekaxro@gmail.com';
  settings.upi_id = '9719747071@fam';
  return json({ ok:true, settings });
}

async function createOrder(env, request) {
  const dbErr = requireDB(env); if (dbErr) return dbErr;
  const user = await auth(env, request); if (!user) return bad("Please sign in before placing an order.", 401);
  const store = await env.DB.prepare("SELECT value FROM settings WHERE key='store_open'").first();
  if (store?.value === '0') return bad("The store is currently closed for new orders.", 423);
  if (!rateLimit(request, `order:${user.id}`, 12, 10 * 60 * 1000)) return bad("Too many order attempts. Please try again later.", 429);
  const d = await body(request);
  const customerName = clean(d.customerName, 100), em = email(d.email), phone = clean(d.phone, 40), address = clean(d.address, 500), utr = clean(d.utr, 80), couponCode = clean(d.couponCode, 40).toUpperCase();
  conest(utr) || !items.length || !allowedSizes.includes(frameSize)) return bad("Complete your name, email, phone, address, frame size, UTR and cart items.");
  const ids = [...new Set(items.map(x => Number(x.id)).filter(Number.isInteger))];
  if (!ids.length) return bad("Your cart is empty.");
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await env.DB.prepare(`SELECT id,name,price,category,stock,active FROM products WHERE id IN (${placeholders})`).bind(...ids).all()).results || [];
  const byId = new Map(rows.map(r => [r.id, r]));
  if (!SIZE_PRICES[frameSize]) return bad("Choose a valid frame size.");
  const sizeUnitPrice = getSizePrice(frameSize);
  let subtotal = 0; const finalItems = [];
  for (const item of items) {
    const p = byId.get(Number(item.id));
    const qty = Math.min(20, Math.max(1, Math.floor(Number(item.quantity) || 1)));
    if (!p || !p.active) return bad("One of the selected products is no longer available.");
    if (p.stock < qty) return bad(`${p.name} does not have enough stock.`);
    subtotal += sizeUnitPrice * qty; finalItems.push({ p, qty, unitPrice: sizeUnitPrice });
  }
  const hasPersonalized = finalItems.some(x => String(x.p.category || '').toLowerCase() === 'personalize');
  if (hasPersonalized) {
    if (!["pinterest", "upload"].includes(personalizationType) || !personalizationValue) return bad("Choose a Pinterest image link or upload an image for your Personalize frame.");
    if (personalizationType === "pinterest") {
      try {
        const u = new URL(personalizationValue);
        if (!['pinterest.com','www.pinterest.com','pin.it','www.pin.it'].includes(u.hostname.toLowerCase())) return bad("Use a valid Pinterest or pin.it link.");
      } catch { return bad("Enter a valid Pinterest link."); }
      if (personalizationValue.length > 500) return bad("Pinterest link is too long.");
    }
    if (personalizationType === "upload" && !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(personalizationValue)) return bad("The uploaded image is invalid.");
    if (personalizationValue.length > 2500000) return bad("The uploaded image is too large. Please use an image under 1.5 MB.");
  } else {
    // Ignore personalization data if the cart contains no Personalize frame.
    d.personalizationType = "none";
  }
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = await env.DB.prepare("SELECT id,code,discount_type,value,active,max_uses,used_count,expires_at FROM coupons WHERE code=? COLLATE NOCASE").bind(couponCode).first();
    if (!coupon || !coupon.active || (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) || (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)) return bad("That discount code is invalid or unavailable.");
    discount = coupon.discount_type === "percent" ? Math.min(subtotal, Math.floor(subtotal * coupon.value / 100)) : Math.min(subtotal, Math.max(0, coupon.value));
  }
  const total = Math.max(0, subtotal - discount);
  const num = orderNumber();
  const statements = [
    env.DB.prepare(`INSERT INTO orders (order_number,user_id,customer_name,email,phone,address,utr,subtotal,discount,total,status,payment_status,note,coupon_code,frame_size,personalization_type,personalization_value) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(num, user.id, customerName, em, phone, address, utr, subtotal, discount, total, "payment_pending", "submitted", "", coupon?.code || "", frameSize, hasPersonalized ? personalizationType : "none", hasPersonalized ? personalizationValue : ""),
  ];
  for (const x of finalItems) {
    statements.push(env.DB.prepare(`INSERT INTO order_items (order_id,product_id,product_name,unit_price,quantity) SELECT id,?,?,?,? FROM orders WHERE order_number=?`).bind(x.p.id, x.p.name, x.unitPrice, x.qty, num));
    statements.push(env.DB.prepare("UPDATE products SET stock=CASE WHEN active=1 THEN stock-? ELSE -1 END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(x.qty, x.p.id));
  }
  if (coupon) statements.push(env.DB.prepare("UPDATE coupons SET used_count=used_count+1 WHERE id=?").bind(coupon.id));
  try {
    const result = await env.DB.batch(statements);
    const orderId = result[0]?.meta?.last_row_id;
    if (!orderId) throw new Error("Order creation failed.");
    await env.DB.prepare("INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)").bind(user.id, "order_created", JSON.stringify({ orderId, orderNumber: num, couponCode: coupon?.code || "", discount })).run();
    return json({ ok: true, order: { id: orderId, orderNumber: num, total, discount, status: "payment_pending", paymentStatus: "submitted" } }, 201);
  } catch (e) {
    if (/coupon (max uses reached|invalid or max uses reached)/i.test(String(e?.message))) return bad("That discount code is no longer available. Please try another code.", 409);
    if (/UNIQUE|constraint/i.test(String(e?.message))) return bad("The order could not be created. Please review your cart and try again.", 409);
    throw e;
  }
}
async function customerOrders(env, request) {
  const user = await auth(env, request); if (!user) return bad("Please sign in to view your orders.", 401);
  const rows = (await env.DB.prepare(`SELECT id,order_number,customer_name,total,discount,coupon_code,frame_size,personalization_type,status,payment_status,created_at,updated_at FROM orders WHERE user_id=? ORDER BY id DESC`).bind(user.id).all()).results || [];
  return json({ ok: true, orders: rows });
}

async function wishlist(env, request) {
  const user = await auth(env, request); if (!user) return bad("Please sign in.", 401);
  if (request.method === "GET") { const rows = (await env.DB.prepare("SELECT product_id FROM wishlist WHERE user_id=?").bind(user.id).all()).results || []; return json({ ok: true, items: rows.map(x => x.product_id) }); }
  const d = await body(request); const id = Number(d.productId); if (!Number.isInteger(id) || id <= 0) return bad("Invalid product.");
  if (d.action === "remove") await env.DB.prepare("DELETE FROM wishlist WHERE user_id=? AND product_id=?").bind(user.id, id).run();
  else await env.DB.prepare("INSERT OR IGNORE INTO wishlist (user_id,product_id) VALUES (?,?)").bind(user.id, id).run();
  return json({ ok: true });
}

async function recentlyViewed(env, request) {
  const user = await auth(env, request); if (!user) return bad("Please sign in.", 401);
  if (request.method === "GET") {
    const rows = (await env.DB.prepare(`SELECT p.id,p.name,p.description,p.price,p.image,p.category,p.stock FROM recently_viewed r JOIN products p ON p.id=r.product_id WHERE r.user_id=? ORDER BY r.viewed_at DESC LIMIT 10`).bind(user.id).all()).results || [];
    return json({ ok: true, products: rows });
  }
  const d = await body(request); const id = Number(d.productId); if (!Number.isInteger(id) || id <= 0) return bad("Invalid product.");
  const product = await env.DB.prepare("SELECT id FROM products WHERE id=? AND active=1").bind(id).first(); if (!product) return bad("Product not found.", 404);
  await env.DB.prepare("INSERT OR REPLACE INTO recently_viewed (user_id,product_id,viewed_at) VALUES (?,?,CURRENT_TIMESTAMP)").bind(user.id, id).run();
  await env.DB.prepare(`DELETE FROM recently_viewed WHERE user_id=? AND product_id NOT IN (SELECT product_id FROM recently_viewed WHERE user_id=? ORDER BY viewed_at DESC LIMIT 10)`).bind(user.id, user.id).run();
  return json({ ok: true });
}

async function reviews(env, request, productId) {
  if (request.method === "GET") { const rows = (await env.DB.prepare(`SELECT r.id,r.rating,r.body,r.created_at,u.name FROM reviews r LEFT JOIN users u ON u.id=r.user_id WHERE r.product_id=? AND r.approved=1 ORDER BY r.id DESC`).bind(productId).all()).results || []; return json({ ok: true, reviews: rows }); }
  const user = await auth(env, request); if (!user) return bad("Please sign in to review a product.", 401);
  const d = await body(request); const rating = Math.round(Number(d.rating)); const textValue = clean(d.body, 1000);
  if (rating < 1 || rating > 5 || !textValue) return bad("Rating and review text are required.");
  await env.DB.prepare("INSERT INTO reviews (user_id,product_id,rating,body,approved) VALUES (?,?,?,?,0)").bind(user.id, productId, rating, textValue).run();
  return json({ ok: true, message: "Review submitted for approval." });
}

const OWNER_EMAIL = "thekaxro@gmail.com";
async function adminGuard(env, request) {
  const user = await auth(env, request);
  return user?.role === "owner" && String(user.email || "").toLowerCase() === OWNER_EMAIL ? user : null;
}
async function adminStats(env) {
  const [orders, users, products, revenue, pending] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) c FROM orders").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM users WHERE role='customer'").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM products WHERE active=1").first(),
    env.DB.prepare("SELECT COALESCE(SUM(total),0) c FROM orders WHERE payment_status='verified' AND status!='cancelled'").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM orders WHERE payment_status='submitted'").first(),
  ]);
  return json({ ok: true, stats: { orders: orders.c, customers: users.c, products: products.c, revenue: revenue.c, pendingPayments: pending.c } });
}
async function adminOrders(env) {
  const rows = (await env.DB.prepare(`SELECT id,order_number,user_id,customer_name,email,phone,address,utr,subtotal,discount,coupon_code,total,frame_size,personalization_type,personalization_value,status,payment_status,note,created_at,updated_at FROM orders ORDER BY id DESC LIMIT 500`).all()).results || [];
  if (!rows.length) return json({ ok: true, orders: [] });
  const ids = rows.map(o => o.id);
  const placeholders = ids.map(() => '?').join(',');
  const itemRows = (await env.DB.prepare(`SELECT oi.order_id,oi.product_id,oi.product_name,oi.unit_price,oi.quantity,p.image FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id IN (${placeholders}) ORDER BY oi.id ASC`).bind(...ids).all()).results || [];
  const byOrder = new Map();
  for (const item of itemRows) {
    if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, []);
    byOrder.get(item.order_id).push(item);
  }
  return json({ ok: true, orders: rows.map(o => ({ ...o, items: byOrder.get(o.id) || [] })) });
}
async function adminDeleteOrder(env, id) {
  const order = await env.DB.prepare("SELECT id,order_number,user_id FROM orders WHERE id=?").bind(id).first();
  if (!order) return bad("Order not found.", 404);
  await env.DB.prepare("INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)").bind(order.user_id, "order_deleted_by_owner", JSON.stringify({ orderId: order.id, orderNumber: order.order_number })).run();
  const result = await env.DB.prepare("DELETE FROM orders WHERE id=?").bind(id).run();
  return result.meta.changes ? json({ ok: true }) : bad("Order not found.", 404);
}
async function adminUpdateOrder(env, request, id) {
  const d = await body(request); const allowedStatus = ["payment_pending", "paid", "processing", "shipped", "completed", "cancelled"];
  const allowedPayment = ["submitted", "verified", "rejected"];
  const status = allowedStatus.includes(d.status) ? d.status : null;
  const payment = allowedPayment.includes(d.payment_status) ? d.payment_status : null;
  const note = d.note === undefined ? null : clean(d.note, 1000);
  if (!status && !payment && note === null) return bad("No valid order changes supplied.");
  if (payment === "verified" && status === "payment_pending") return bad("A verified payment cannot remain payment pending.");
  const sets = [], args = [];
  if (status) { sets.push("status=?"); args.push(status); }
  if (payment) { sets.push("payment_status=?"); args.push(payment); }
  if (note !== null) { sets.push("note=?"); args.push(note); }
  sets.push("updated_at=CURRENT_TIMESTAMP"); args.push(id);
  const result = await env.DB.prepare(`UPDATE orders SET ${sets.join(",")} WHERE id=?`).bind(...args).run();
  if (!result.meta.changes) return bad("Order not found.", 404);
  return json({ ok: true });
}
async function adminProducts(env) { const rows = (await env.DB.prepare("SELECT * FROM products ORDER BY id DESC").all()).results || []; return json({ ok: true, products: rows }); }
async function adminProductSave(env, request, id = null) {
  const d = await body(request); const name = clean(d.name, 100), description = clean(d.description, 500), image = clean(d.image, 500), category = clean(d.category, 50) || "Minimal";
  const price = money(d.price), stock = Math.max(0, Math.floor(Number(d.stock) || 0));
  if (!name || price <= 0) return bad("Product name and a price greater than zero are required.");
  if (id) {
    const result = await env.DB.prepare("UPDATE products SET name=?,description=?,price=?,image=?,category=?,stock=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name, description, price, image, category, stock, d.active ? 1 : 0, id).run();
    if (!result.meta.changes) return bad("Product not found.", 404);
  } else {
    await env.DB.prepare("INSERT INTO products (name,description,price,image,category,stock,active) VALUES (?,?,?,?,?,?,?)").bind(name, description, price, image, category, stock, d.active === false ? 0 : 1).run();
  }
  return json({ ok: true });
}
async function adminDeleteProduct(env, id) { const result = await env.DB.prepare("UPDATE products SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run(); return result.meta.changes ? json({ ok: true }) : bad("Product not found.", 404); }
async function adminCustomers(env) {
  const rows = (await env.DB.prepare(`SELECT u.id,u.name,u.email,u.phone,u.address,u.created_at,u.updated_at,COUNT(o.id) order_count,COALESCE(SUM(CASE WHEN o.payment_status='verified' AND o.status!='cancelled' THEN o.total ELSE 0 END),0) verified_spend FROM users u LEFT JOIN orders o ON o.user_id=u.id WHERE u.role='customer' GROUP BY u.id ORDER BY u.id DESC LIMIT 500`).all()).results || [];
  return json({ ok: true, customers: rows });
}
async function adminCoupons(env) { const rows = (await env.DB.prepare("SELECT id,code,discount_type,value,active,max_uses,used_count,expires_at,created_at FROM coupons ORDER BY id DESC").all()).results || []; return json({ ok: true, coupons: rows }); }
async function adminCouponSave(env, request, id = null) {
  const d = await body(request); const code = clean(d.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ""); const type = d.discount_type === "percent" ? "percent" : "fixed"; const value = Math.max(0, Math.floor(Number(d.value) || 0)); const maxUses = d.max_uses === "" || d.max_uses == null ? null : Math.max(1, Math.floor(Number(d.max_uses) || 0)); const expiresAt = d.expires_at ? new Date(d.expires_at).toISOString() : null;
  if (code.length < 3 || value <= 0 || (type === "percent" && value > 100)) return bad("Enter a valid code and discount value.");
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return bad("Enter a valid expiry date.");
  try {
    if (id) { const result = await env.DB.prepare("UPDATE coupons SET code=?,discount_type=?,value=?,active=?,max_uses=?,expires_at=? WHERE id=?").bind(code, type, value, d.active === false ? 0 : 1, maxUses, expiresAt, id).run(); if (!result.meta.changes) return bad("Discount code not found.", 404); }
    else await env.DB.prepare("INSERT INTO coupons (code,discount_type,value,active,max_uses,expires_at) VALUES (?,?,?,1,?,?)").bind(code, type, value, maxUses, expiresAt).run();
  } catch (e) { if (/UNIQUE|constraint/i.test(String(e?.message))) return bad("That discount code already exists.", 409); throw e; }
  return json({ ok: true });
}
async function adminCouponDelete(env, id) { const result = await env.DB.prepare("UPDATE coupons SET active=0 WHERE id=?").bind(id).run(); return result.meta.changes ? json({ ok: true }) : bad("Discount code not found.", 404); }
async function adminSettings(env) { const rows = (await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('store_name','store_open') ORDER BY key").all()).results || []; const settings = Object.fromEntries(rows.map(x => [x.key, x.value])); settings.support_email = 'thekaxro@gmail.com'; settings.upi_id = '9719747071@fam'; return json({ ok: true, settings }); }
async function adminSettingsSave(env, request) {
  const d = await body(request);
  const statements = [];
  if (d.store_name !== undefined) {
    const value = clean(d.store_name, 200);
    if (!value) return bad("Store name cannot be empty.");
    statements.push(env.DB.prepare("INSERT INTO settings (key,value) VALUES ('store_name',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(value));
  }
  if (d.store_open !== undefined) {
    const value = clean(d.store_open, 1);
    if (!["0", "1"].includes(value)) return bad("Invalid store status.");
    statements.push(env.DB.prepare("INSERT INTO settings (key,value) VALUES ('store_open',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(value));
  }
  if (!statements.length) return bad("No editable settings supplied.");
  await env.DB.batch(statements);
  return json({ ok: true, support_email: 'thekaxro@gmail.com', upi_id: '9719747071@fam' });
}
async function adminSetup(env, request) {
  if (!env.ADMIN_SETUP_KEY) return bad("ADMIN_SETUP_KEY is not configured.", 503);
  if (!rateLimit(request, "admin-setup", 5, 30 * 60 * 1000)) return bad("Too many setup attempts. Please try again later.", 429);
  const supplied = request.headers.get("X-Admin-Setup-Key") || "";
  const [a, b] = await Promise.all([sha256(supplied), sha256(env.ADMIN_SETUP_KEY)]);
  if (!(await timingSafeHexEqual(a, b))) return bad("Invalid setup key.", 403);
  const existingOwner = await env.DB.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").first();
  if (existingOwner) return bad("Owner setup has already been completed.", 409);
  const d = await body(request); const name = clean(d.name, 80), em = email(d.email), password = String(d.password || "");
  if (name.length < 2 || !validEmail(em) || password.length < 10 || password.length > 128) return bad("Use a valid name, email and an owner password between 10 and 128 characters.");
  const hash = await hashPassword(password);
  try { await env.DB.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'owner')").bind(name, em, hash).run(); }
  catch (e) { if (/UNIQUE|constraint/i.test(String(e?.message))) return bad("That email is already registered. Sign in with the existing account or use another email.", 409); throw e; }
  return json({ ok: true, message: "Owner account created. You can now sign in through the admin panel." }, 201);
}

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (path === "/api/health") return json({ ok: true, service: "TheKaXro API", database: !!env.DB });
    if (path === "/admin" || path === "/admin/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }
    if (path.startsWith("/api/") && !env.DB && !["/api/health", "/api/admin/setup"].includes(path)) return requireDB(env);
    if (path === "/api/products" && request.method === "GET") return products(env, request);
    if (path === "/api/store-settings" && request.method === "GET") return storeSettings(env);
    if (path === "/api/coupon/preview" && request.method === "POST") return couponPreview(env, request);
    if (path === "/api/auth/me" && request.method === "GET") return authMe(env, request);
    if (path === "/api/auth/signup" && request.method === "POST") return signup(env, request);
    if (path === "/api/auth/login" && request.method === "POST") return login(env, request, false);
    if (path === "/api/auth/forgot-password" && request.method === "POST") return forgotPassword(env, request);
    if (path === "/api/auth/reset-password" && request.method === "POST") return resetPassword(env, request);
    if (path === "/api/auth/logout" && request.method === "POST") return logout(env, request);
    if (path === "/api/profile" && (request.method === "GET" || request.method === "PATCH")) return profile(env, request);
    if (path === "/api/orders" && request.method === "POST") return createOrder(env, request);
    if (path === "/api/orders" && request.method === "GET") return customerOrders(env, request);
    if (path === "/api/wishlist" && (request.method === "GET" || request.method === "POST")) return wishlist(env, request);
    if (path === "/api/recently-viewed" && (request.method === "GET" || request.method === "POST")) return recentlyViewed(env, request);
    const reviewMatch = path.match(/^\/api\/products\/(\d+)\/reviews$/); if (reviewMatch && (request.method === "GET" || request.method === "POST")) return reviews(env, request, Number(reviewMatch[1]));
    if (path === "/api/admin/setup" && request.method === "POST") return adminSetup(env, request);
    if (path === "/api/admin/login" && request.method === "POST") return login(env, request, true);
    if (path === "/api/admin/logout" && request.method === "POST") return logout(env, request);
    if (path.startsWith("/api/admin/")) {
      const owner = await adminGuard(env, request); if (!owner) return bad("Owner access required.", 403);
      if (path === "/api/admin/me") return json({ ok: true, user: publicUser(owner) });
      if (path === "/api/admin/stats") return adminStats(env);
      if (path === "/api/admin/orders" && request.method === "GET") return adminOrders(env);
      const orderMatch = path.match(/^\/api\/admin\/orders\/(\d+)$/); if (orderMatch && request.method === "PATCH") return adminUpdateOrder(env, request, Number(orderMatch[1])); if (orderMatch && request.method === "DELETE") return adminDeleteOrder(env, Number(orderMatch[1]));
      if (path === "/api/admin/products" && request.method === "GET") return adminProducts(env);
      if (path === "/api/admin/products" && request.method === "POST") return adminProductSave(env, request);
      const productMatch = path.match(/^\/api\/admin\/products\/(\d+)$/); if (productMatch && request.method === "PATCH") return adminProductSave(env, request, Number(productMatch[1])); if (productMatch && request.method === "DELETE") return adminDeleteProduct(env, Number(productMatch[1]));
      if (path === "/api/admin/customers" && request.method === "GET") return adminCustomers(env);
      if (path === "/api/admin/coupons" && request.method === "GET") return adminCoupons(env);
      if (path === "/api/admin/coupons" && request.method === "POST") return adminCouponSave(env, request);
      const couponMatch = path.match(/^\/api\/admin\/coupons\/(\d+)$/); if (couponMatch && request.method === "PATCH") return adminCouponSave(env, request, Number(couponMatch[1])); if (couponMatch && request.method === "DELETE") return adminCouponDelete(env, Number(couponMatch[1]));
      if (path === "/api/admin/settings" && request.method === "GET") return adminSettings(env);
      if (path === "/api/admin/settings" && request.method === "PATCH") return adminSettingsSave(env, request);
    }
    return env.ASSETS.fetch(request);
  } catch (error) {
    console.error("Request failed", error);
    return bad("Something went wrong. Please try again.", 500);
  }
}

export default { fetch: route };
