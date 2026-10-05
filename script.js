let products = [];
let cart = [];
let currentUser = null;
let wishlist = new Set();
let personalizeFileData = '';
let personalizeFileName = '';
let personalizeProductId = null;
let personalizeMode = 'upload';
let adminCache = { orders: [], products: [], customers: [], coupons: [], settings: {} };
const STORE_CATEGORIES = ['Anime','Games','Cars','Minimal','Animals','Fantasy','Personalize'];
const $ = id => document.getElementById(id);
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

async function api(path, options = {}) {
  const r = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 2600);
}
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

async function loadSession() {
  try {
    const r = await api('/api/auth/me');
    currentUser = r.user || null;
  } catch { currentUser = null; }
  if (currentUser) {
    try {
      const w = await api('/api/wishlist');
      wishlist = new Set(w.items || []);
    } catch { wishlist.clear(); }
  }
  renderAccountState('login');
}

async function loadStoreSettings() {
  try {
    const r = await api('/api/store-settings');
    const s = r.settings || {};
    document.querySelectorAll('[data-support-email]').forEach(el => { el.textContent = s.support_email || 'thekaxro@gmail.com'; });
    document.querySelectorAll('[data-upi-id]').forEach(el => { el.textContent = s.upi_id || '9719747071@fam'; });
    const contact = document.querySelector('a[data-support-link]');
    if (contact) contact.href = `mailto:${s.support_email || 'thekaxro@gmail.com'}`;
  } catch {}
}
async function loadProducts() {
  const qRaw = ($('searchInput')?.value || '').trim();
  const cRaw = $('categoryFilter')?.value || '';
  const hasCategory = STORE_CATEGORIES.includes(cRaw);
  const tools = $('shopTools');
  try {
    const r = await api(`/api/products?q=${encodeURIComponent(hasCategory ? qRaw : '')}&category=${encodeURIComponent(hasCategory ? cRaw : '')}`);
    updateCategoryCounts(r.categoryCounts || {});
    $('searchInput').disabled = !hasCategory;
    $('sortFilter').disabled = !hasCategory;
    if (tools) tools.classList.toggle('hidden', !hasCategory);
    if (!hasCategory) {
      products = [];
      $('shopTitle').textContent = 'Frames';
      $('shopContext').textContent = 'Select a category below to browse its frames.';
      renderProducts();
      return;
    }
    products = r.products || [];
    $('shopTitle').textContent = `${cRaw} Frames`;
    $('shopContext').textContent = `${products.length} ${products.length === 1 ? 'frame' : 'frames'} in ${cRaw}.`;
    renderProducts();
  } catch (e) {
    products = [];
    $('products').innerHTML = `<p class="muted shop-error">${escapeHtml(e.message)}</p>`;
  }
}
function renderCategoryCards(counts = {}) {
  const wrap = $('categoryCards');
  if (!wrap) return;
  const selected = $('categoryFilter')?.value || '';
  wrap.innerHTML = STORE_CATEGORIES.map(category => {
    const count = Number(counts[category] || 0);
    const custom = category === 'Personalize';
    const active = category === selected ? ' active' : '';
    return `<button type="button" data-category="${escapeHtml(category)}" class="shop-category-card ${custom ? 'custom-category' : ''}${active}" onclick="filterCategory('${category}')">
      <span class="shop-category-name">${escapeHtml(category)}</span>
      <span class="shop-category-count"><b>${count}</b> ${custom ? (count === 1 ? 'custom frame' : 'custom frames') : (count === 1 ? 'frame' : 'frames')} <span>→</span></span>
    </button>`;
  }).join('');
}
function updateCategoryCounts(counts) {
  window.__kaxroCategoryCounts = counts || {};
  renderCategoryCards(counts);
  STORE_CATEGORIES.forEach(category => {
    const count = Number(counts[category] || 0);
    const el = $(`count-${category}`);
    if (el) el.textContent = count;
  });
}
function filterCategory(c) {
  if (!STORE_CATEGORIES.includes(c)) return;
  $('categoryFilter').value = c;
  $('searchInput').value = '';
  renderCategoryCards(window.__kaxroCategoryCounts || {});
  loadProducts();
  requestAnimationFrame(() => $('shop')?.scrollIntoView({ behavior:'smooth', block:'start' }));
}
function renderProducts() {
  const category = $('categoryFilter')?.value || '';
  if (!STORE_CATEGORIES.includes(category)) {
    $('products').innerHTML = '';
    return;
  }
  const sort = $('sortFilter')?.value || 'newest';
  const ordered = [...products].sort((a, b) => {
    if (sort === 'price-low') return Number(a.price || 0) - Number(b.price || 0);
    if (sort === 'price-high') return Number(b.price || 0) - Number(a.price || 0);
    if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
    return Number(b.id || 0) - Number(a.id || 0);
  });
  $('products').innerHTML = ordered.length ? ordered.map(p => `
    <article class="card">
      <button class="wish" aria-label="Save ${escapeHtml(p.name)}" onclick="toggleWishlist(${p.id})">${wishlist.has(p.id) ? 'Saved' : 'Save'}</button>
      <div class="card-img">${p.image ? `<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><div class="placeholder" hidden>Frame</div>` : '<div class="placeholder">Frame</div>'}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="price">${money(p.price)}${p.stock <= 0 ? ' · Out of stock' : ''}</div>
      <button class="add ${String(p.category || '').toLowerCase() === 'personalize' ? 'personalize-add' : ''}" ${p.stock <= 0 ? 'disabled' : ''} onclick="${String(p.category || '').toLowerCase() === 'personalize' ? `openPersonalizeForProduct(${p.id})` : `addToCart(${p.id})`}">${p.stock <= 0 ? 'Out of Stock' : (String(p.category || '').toLowerCase() === 'personalize' ? 'Customize Your Frame' : 'Add to Cart')}</button>
    </article>`).join('') : '<p class="muted">No frames found in this category yet.</p>';
}
function openPersonalizeForProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.stock <= 0) return toast('This personalized frame is currently unavailable.');
  personalizeProductId = id;
  personalizeMode = 'upload';
  $('personalizeModalFile').value = '';
  $('personalizeModalLink').value = '';
  personalizeFileData = '';
  personalizeFileName = '';
  $('personalizePreview').removeAttribute('src');
  $('personalizePreviewWrap').classList.add('hidden');
  $('personalizeModalMessage').classList.remove('show');
  choosePersonalizeMode('upload');
  openModal('personalizeModal');
}
function choosePersonalizeMode(mode) {
  personalizeMode = mode === 'pinterest' ? 'pinterest' : 'upload';
  $('personalizeUploadTab').classList.toggle('active', personalizeMode === 'upload');
  $('personalizePinterestTab').classList.toggle('active', personalizeMode === 'pinterest');
  $('personalizeUploadPane').classList.toggle('hidden', personalizeMode !== 'upload');
  $('personalizePinterestPane').classList.toggle('hidden', personalizeMode !== 'pinterest');
  $('personalizeModalMessage').classList.remove('show');
}
function showPersonalizeMessage(text) {
  const box = $('personalizeModalMessage');
  box.textContent = text;
  box.classList.add('show');
}
function clearPersonalizeSelection() {
  personalizeFileData = '';
  personalizeFileName = '';
  $('personalizeModalFile').value = '';
  $('personalizePreview').removeAttribute('src');
  $('personalizePreviewWrap').classList.add('hidden');
}
function handlePersonalizeModalLink() {
  personalizeFileData = '';
  personalizeFileName = '';
  $('personalizeModalFile').value = '';
  $('personalizePreviewWrap').classList.add('hidden');
}
function validPinterestLink(value) {
  try {
    const u = new URL(value);
    return ['pinterest.com','www.pinterest.com','pin.it','www.pin.it'].includes(u.hostname.toLowerCase());
  } catch { return false; }
}
function handlePersonalizeModalFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    event.target.value = '';
    return showPersonalizeMessage('Please choose a PNG, JPG or WebP image.');
  }
  if (file.size > 8 * 1024 * 1024) {
    event.target.value = '';
    return showPersonalizeMessage('That image is too large. Please choose an image under 8 MB.');
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1200, maxH = 1600;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let data = canvas.toDataURL('image/jpeg', quality);
      while (data.length > 650000 && quality > 0.52) {
        quality -= 0.06;
        data = canvas.toDataURL('image/jpeg', quality);
      }
      if (data.length > 700000) {
        return showPersonalizeMessage('This image could not be compressed enough. Please choose a smaller image.');
      }
      personalizeFileData = data;
      personalizeFileName = file.name;
      $('personalizePreview').src = data;
      $('personalizePreviewWrap').classList.remove('hidden');
      $('personalizeModalMessage').classList.remove('show');
    };
    img.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}
function confirmPersonalization() {
  if (!personalizeProductId) return closePersonalizeModal();
  let type = 'none', value = '';
  if (personalizeMode === 'upload') {
    if (!personalizeFileData) return showPersonalizeMessage('Choose a photo first.');
    type = 'upload'; value = personalizeFileData;
  } else {
    const link = $('personalizeModalLink').value.trim();
    if (!link || !validPinterestLink(link)) return showPersonalizeMessage('Enter a valid Pinterest or pin.it link.');
    type = 'pinterest'; value = link;
  }
  const p = products.find(x => x.id === personalizeProductId);
  if (!p) return showPersonalizeMessage('This product is no longer available.');
  cart = cart.filter(x => x.id !== p.id);
  cart.push({ id:p.id, name:p.name, price:p.price, category:p.category || 'Personalize', quantity:1 });
  personalizeFileName = type === 'upload' ? personalizeFileName : '';
  personalizeFileData = type === 'upload' ? value : '';
  $('personalizeLink').value = type === 'pinterest' ? value : '';
  if (type === 'upload') {
    $('personalizeFileName').textContent = `Selected: ${personalizeFileName || 'Uploaded image'}`;
  } else {
    $('personalizeFileName').textContent = 'Pinterest reference selected.';
  }
  renderCart();
  closePersonalizeModal();
  openCart();
  toast('Personalization added to your cart.');
}
function closePersonalizeModal() {
  closeModal('personalizeModal');
  personalizeProductId = null;
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.stock <= 0) return toast('This frame is currently out of stock.');
  const found = cart.find(x => x.id === id);
  if (found) {
    if (found.quantity >= p.stock) return toast('You cannot add more than the available stock.');
    found.quantity++;
  } else cart.push({ id: p.id, name: p.name, price: p.price, category: p.category || '', quantity: 1 });
  renderCart(); openCart();
  if (currentUser) api('/api/recently-viewed', { method:'POST', body:JSON.stringify({ productId:id }) }).catch(() => {});
}
function removeItem(i) { cart.splice(i, 1); renderCart(); }
function renderCart() {
  $('cartCount').textContent = cart.reduce((s, x) => s + x.quantity, 0);
  $('cartItems').innerHTML = cart.length ? cart.map((p, i) => `<div class="cart-row"><span>${escapeHtml(p.name)}<br><small>${p.quantity} × ${money(p.price)}</small></span><span>${money(p.price*p.quantity)} <button class="remove" onclick="removeItem(${i})">Remove</button></span></div>`).join('') : '<p class="muted">Your cart is empty.</p>';
  $('cartTotal').textContent = money(cart.reduce((s,p) => s + p.price*p.quantity, 0));
  updatePersonalizeBox();
}
function openCart() { $('cart').classList.add('open'); $('overlay').classList.add('show'); }
function toggleCart() { $('cart').classList.contains('open') ? closeCart() : openCart(); }
function closeCart() { $('cart').classList.remove('open'); $('overlay').classList.remove('show'); }
function closeAllPanels() { closeCart(); document.querySelectorAll('.modal.open').forEach(x => x.classList.remove('open')); }
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

function cartHasPersonalizedFrame() { return cart.some(x => String(x.category || '').toLowerCase() === 'personalize'); }
function updatePersonalizeBox() {
  const box = $('personalizeBox');
  if (!box) return;
  const show = cartHasPersonalizedFrame();
  box.classList.toggle('hidden', !show);
  if (!show) {
    $('personalizeLink').value = '';
    $('personalizeFile').value = '';
    $('personalizeFileName').textContent = '';
    personalizeFileData = '';
    personalizeFileName = '';
  }
}
function handlePersonalizeLink() {
  if ($('personalizeLink').value.trim()) {
    $('personalizeFile').value = '';
    $('personalizeFileName').textContent = '';
    personalizeFileData = '';
    personalizeFileName = '';
  }
}
function handlePersonalizeFile(event) {
  const file = event.target.files?.[0];
  if (!file) { personalizeFileData = ''; personalizeFileName = ''; $('personalizeFileName').textContent = ''; return; }
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    event.target.value = '';
    personalizeFileData = '';
    personalizeFileName = '';
    return toast('Please upload a PNG, JPG or WebP image.');
  }
  if (file.size > 1.5 * 1024 * 1024) {
    event.target.value = '';
    personalizeFileData = '';
    personalizeFileName = '';
    return toast('Image must be 1.5 MB or smaller.');
  }
  $('personalizeLink').value = '';
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1200, maxH = 1600;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d', { alpha:false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      let quality=.82, data=canvas.toDataURL('image/jpeg',quality);
      while(data.length>650000 && quality>.52){ quality-=.06; data=canvas.toDataURL('image/jpeg',quality); }
      if(data.length>700000){ return toast('Image could not be compressed enough. Please choose a smaller image.'); }
      personalizeFileData=data; personalizeFileName=file.name;
      $('personalizeFileName').textContent=`Selected: ${file.name} (optimized)`;
    };
    img.src=String(reader.result||'');
  };
  reader.readAsDataURL(file);
}
function getPersonalization() {
  if (!cartHasPersonalizedFrame()) return { type:'none', value:'' };
  const link = $('personalizeLink').value.trim();
  if (personalizeFileData) return { type:'upload', value:personalizeFileData };
  if (link) return validPinterestLink(link) ? { type:'pinterest', value:link } : { type:'none', value:'' };
  return { type:'none', value:'' };
}

async function openCheckout() {
  if (!cart.length) return toast('Your cart is empty.');
  if (!currentUser) { closeCart(); openAccount('login'); return toast('Sign in or create an account before checkout.'); }
  closeCart();
  $('orderName').value = currentUser.name || '';
  $('orderEmail').value = currentUser.email || '';
  $('orderPhone').value = currentUser.phone || '';
  $('orderAddress').value = currentUser.address || '';
  $('frameSize').value = 'A4';
  $('orderUtr').value = '';
  $('orderCoupon').value = '';
  $('couponResult').textContent = '';
  $('orderResult').classList.remove('show');
  if (!cartHasPersonalizedFrame()) {
    $('personalizeLink').value = '';
    $('personalizeFile').value = '';
    $('personalizeFileName').textContent = '';
    personalizeFileData = '';
    personalizeFileName = '';
  } else if (personalizeFileData) {
    $('personalizeFileName').textContent = `Selected: ${personalizeFileName || 'Uploaded image'} (optimized)`;
  } else if ($('personalizeLink').value.trim()) {
    $('personalizeFileName').textContent = 'Pinterest reference selected.';
  }
  updatePersonalizeBox();
  renderCheckoutSummary();
  openModal('checkoutModal');
}
const SIZE_PRICES = { A4:249, A3:399, A2:599, A1:899 };
function sizePrice(size) { return SIZE_PRICES[size] || SIZE_PRICES.A4; }
function renderCheckoutSummary(discount = 0, couponCode = '') {
  const size = $('frameSize')?.value || 'A4';
  const unit = sizePrice(size);
  const subtotal = cart.reduce((s,p) => s + unit*p.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  $('checkoutSummary').innerHTML = `<div class="order-item"><strong>Order summary</strong><br>${cart.map(x => `${escapeHtml(x.name)} × ${x.quantity}`).join('<br>')}<br><br>Frame size: <strong>${escapeHtml(size)}</strong> · ${money(unit)} each<br>Subtotal: ${money(subtotal)}${discount ? `<br>Discount${couponCode ? ` (${escapeHtml(couponCode)})` : ''}: −${money(discount)}` : ''}<br><strong>Total: ${money(total)}</strong></div>`;
}
async function applyCoupon() {
  const code = $('orderCoupon').value.trim().toUpperCase();
  if (!code) { $('couponResult').textContent = ''; renderCheckoutSummary(); return; }
  try {
    const r = await api('/api/coupon/preview', { method:'POST', body:JSON.stringify({ code, frameSize:$('frameSize').value, items:cart.map(x => ({id:x.id, quantity:x.quantity}))}) });
    $('couponResult').textContent = `${r.coupon.code}: ${r.discount ? `−${money(r.discount)}` : 'No discount'}`;
    $('couponResult').dataset.discount = r.discount;
    $('couponResult').dataset.code = r.coupon.code;
    renderCheckoutSummary(r.discount, r.coupon.code);
  } catch (e) {
    $('couponResult').textContent = e.message;
    $('couponResult').dataset.discount = '0';
    $('couponResult').dataset.code = '';
    renderCheckoutSummary();
  }
}
async function submitOrder(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  const personalization = getPersonalization();
  if (cartHasPersonalizedFrame() && personalization.type === 'none') {
    btn.disabled = false;
    return toast('Add a Pinterest image link or upload an image for your Personalize frame.');
  }
  try {
    const r = await api('/api/orders', { method:'POST', body:JSON.stringify({
      customerName:$('orderName').value, email:$('orderEmail').value, phone:$('orderPhone').value,
      address:$('orderAddress').value, frameSize:$('frameSize').value, utr:$('orderUtr').value, couponCode:$('orderCoupon').value,
      personalizationType:personalization.type, personalizationValue:personalization.value,
      items:cart.map(x => ({id:x.id, quantity:x.quantity}))
    })});
    $('orderResult').innerHTML = `<strong>Order ${escapeHtml(r.order.orderNumber)} placed successfully.</strong><p class="muted">Payment reference submitted. Your payment will remain unverified until the owner checks the transfer.</p><button class="button" type="button" onclick="showOrderTracking('${escapeHtml(r.order.orderNumber)}')">Track Order</button>`;
    $('orderResult').classList.add('show');
    cart = []; renderCart();
    toast('Order placed successfully.');
  } catch (err) { toast(err.message); }
  finally { btn.disabled = false; }
}

function openAccount(tab='login') { renderAccountState(tab); openModal('accountModal'); }
function renderAccountState(tab='login') {
  if (!currentUser) {
    const signup = tab === 'signup';
    $('accountContent').innerHTML = `<p class="eyebrow">ACCOUNT</p><h2>${signup ? 'Welcome' : 'Welcome back'}</h2>
      <div class="auth-tabs"><button class="${!signup?'active':''}" onclick="renderAccountState('login')">Sign in</button><button class="${signup?'active':''}" onclick="renderAccountState('signup')">Create account</button></div>
      ${signup ? signupForm() : loginForm()}`;
  } else {
    $('accountContent').innerHTML = `<p class="eyebrow">ACCOUNT</p><h2>${escapeHtml(currentUser.name)}</h2>
      <div class="account-box">
        <div class="order-item"><strong>${escapeHtml(currentUser.email)}</strong><br><span class="muted">${currentUser.role === 'owner' ? 'Owner account' : 'Customer account'}</span></div>
        <div class="account-actions"><button class="button" onclick="showProfile()">Profile</button><button class="button" onclick="showOrders()">My Orders</button>${currentUser.role==='owner'?'<button class="button secondary" onclick="openAdmin()">Admin Panel</button>':''}<button class="button secondary" onclick="logout()">Sign Out</button></div>
        <div id="accountOrders"></div><div id="profileBox"></div>
      </div>`;
  }
}
function loginForm() { return `<form class="auth-form" onsubmit="login(event)"><label>Email<input id="loginEmail" type="email" maxlength="190" required autocomplete="email"></label><label>Password<input id="loginPassword" type="password" maxlength="128" required autocomplete="current-password"></label><button class="button" type="submit">Sign In</button><button class="text-button" type="button" onclick="showForgotPassword()">Forgot password?</button></form>`; }
function showForgotPassword(message='') { $('accountContent').innerHTML = `<p class="eyebrow">ACCOUNT</p><h2>Forgot password?</h2><p class="muted">Enter your account email and we’ll send you a secure reset link.</p>${message ? `<div class="auth-message">${escapeHtml(message)}</div>` : ''}<form class="auth-form" onsubmit="requestPasswordReset(event)"><label>Email<input id="forgotEmail" type="email" maxlength="190" required autocomplete="email"></label><button class="button" type="submit">Send reset link</button><button class="text-button" type="button" onclick="renderAccountState('login')">Back to sign in</button></form>`; }
async function requestPasswordReset(e) { e.preventDefault(); try { const r=await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:$('forgotEmail').value})}); showForgotPassword(r.message||'If an account exists for that email, a password reset link has been sent.'); } catch(err) { toast(err.message); } }
function renderResetPassword() { const token=new URLSearchParams(location.search).get('token')||''; const content=document.querySelector('#resetContent'); if(!content) return; if(!token) { content.innerHTML='<p class="eyebrow">ACCOUNT</p><h2>Invalid reset link</h2><p class="muted">This password reset link is missing or invalid.</p><button class="button" onclick="location.href='/'">Back to store</button>'; return; } content.innerHTML=`<p class="eyebrow">ACCOUNT SECURITY</p><h2>Set a new password</h2><p class="muted">Choose a new password between 8 and 128 characters.</p><form class="auth-form" onsubmit="submitResetPassword(event)"><label>New password<input id="resetPassword" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label>Confirm password<input id="resetPasswordConfirm" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><button class="button" type="submit">Reset password</button></form>`; }
async function submitResetPassword(e) { e.preventDefault(); const token=new URLSearchParams(location.search).get('token')||''; const password=$('resetPassword').value; if(password!==$('resetPasswordConfirm').value) return toast('Passwords do not match.'); try { const r=await api('/api/auth/reset-password',{method:'POST',body:JSON.stringify({token,password})}); const content=$('resetContent'); content.innerHTML=`<p class="eyebrow">ACCOUNT SECURITY</p><h2>Password updated</h2><p class="muted">${escapeHtml(r.message)}</p><button class="button" onclick="location.href='/?account=login'">Sign in</button>`; } catch(err) { toast(err.message); } }
function signupForm() { return `<form class="auth-form" onsubmit="signup(event)"><label>Name<input id="signupName" required maxlength="80" autocomplete="name"></label><label>Email<input id="signupEmail" type="email" maxlength="190" required autocomplete="email"></label><label>Password<input id="signupPassword" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label>Phone<input id="signupPhone" maxlength="40" autocomplete="tel"></label><label>Delivery address<textarea id="signupAddress" maxlength="300" autocomplete="street-address"></textarea></label><button class="button" type="submit">Create Account</button></form>`; }
async function login(e) { e.preventDefault(); try { const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:$('loginEmail').value,password:$('loginPassword').value})}); currentUser=r.user; closeModal('accountModal'); toast('Signed in.'); renderAccountState(); } catch(err) { toast(err.message); } }
async function signup(e) { e.preventDefault(); try { const r=await api('/api/auth/signup',{method:'POST',body:JSON.stringify({name:$('signupName').value,email:$('signupEmail').value,password:$('signupPassword').value,phone:$('signupPhone').value,address:$('signupAddress').value})}); currentUser=r.user; closeModal('accountModal'); toast('Account created.'); renderAccountState(); } catch(err) { toast(err.message); } }
async function logout() { await api('/api/auth/logout',{method:'POST'}).catch(()=>{}); currentUser=null; wishlist.clear(); closeModal('accountModal'); toast('Signed out.'); renderAccountState(); }
async function showProfile() {
  const box = $('profileBox');
  box.innerHTML = `<div class="order-item"><strong>Profile</strong><form class="auth-form" onsubmit="saveProfile(event)"><label>Name<input id="profileName" value="${escapeHtml(currentUser.name)}" maxlength="80" required></label><label>Phone<input id="profilePhone" value="${escapeHtml(currentUser.phone||'')}" maxlength="40"></label><label>Delivery address<textarea id="profileAddress" maxlength="300">${escapeHtml(currentUser.address||'')}</textarea></label><button class="button">Save Profile</button></form></div>`;
}
async function saveProfile(e) { e.preventDefault(); try { const r=await api('/api/profile',{method:'PATCH',body:JSON.stringify({name:$('profileName').value,phone:$('profilePhone').value,address:$('profileAddress').value})}); currentUser=r.user; renderAccountState(); toast('Profile saved.'); } catch(err) { toast(err.message); } }
async function showOrders() { if(!currentUser)return; const box=$('accountOrders'); box.innerHTML='<p class="muted">Loading orders...</p>'; try { const r=await api('/api/orders'); box.innerHTML=r.orders.length?`<div class="order-list">${r.orders.map(o=>`<div class="order-item"><strong>${escapeHtml(o.order_number)}</strong><br>${money(o.total)}${o.discount?` · Saved ${money(o.discount)}`:''}<br><span class="muted">Frame ${escapeHtml(o.frame_size||'A4')} · ${escapeHtml(orderStatusLabel(o.status))}</span><div class="order-actions"><button class="button tiny" type="button" onclick="showOrderTracking('${escapeHtml(o.order_number)}')">Track Order</button></div></div>`).join('')}</div>`:'<p class="muted">No orders yet.</p>'; } catch(e) { box.innerHTML=`<p class="muted">${escapeHtml(e.message)}</p>`; } }

function orderStatusLabel(status) { return ({payment_pending:'Payment pending',paid:'Payment verified',processing:'Processing',shipped:'Shipped',completed:'Delivered',cancelled:'Cancelled'})[status] || status || 'Order placed'; }
function orderTimeline(order) {
  const cancelled = order.status === 'cancelled';
  const steps = [
    {key:'placed',label:'Order placed'},
    {key:'paid',label:'Payment verified'},
    {key:'processing',label:'Preparing your frame'},
    {key:'shipped',label:'Shipped'},
    {key:'completed',label:'Delivered'}
  ];
  const rank = {payment_pending:0,paid:1,processing:2,shipped:3,completed:4,cancelled:-1};
  let current = rank[order.status] ?? 0;
  if (order.payment_status === 'verified' && current < 1) current = 1;
  return `<div class="tracking">${cancelled ? `<div class="tracking-cancelled"><strong>Order cancelled</strong><span>This order is no longer being processed.</span></div>` : steps.map((step,i)=>{ const done=i<=current; const active=i===current; return `<div class="tracking-step ${done?'done':''} ${active?'active':''}"><span class="tracking-dot">${done?'✓':''}</span><div><strong>${step.label}</strong>${active?`<span class="muted">Current status</span>`:''}</div></div>`; }).join('')}</div>`;
}
async function showOrderTracking(orderNumber) {
  if(!currentUser) return openAccount('login');
  openAccount('orders');
  try {
    const r = await api('/api/orders');
    const order = (r.orders || []).find(o => o.order_number === orderNumber);
    if(!order) return toast('Order not found.');
    $('accountContent').innerHTML = `<p class="eyebrow">ORDER TRACKING</p><h2>${escapeHtml(order.order_number)}</h2><div class="tracking-head"><div><strong>${escapeHtml(orderStatusLabel(order.status))}</strong><span class="muted">Updated ${new Date(order.updated_at || order.created_at).toLocaleString()}</span></div><strong>${money(order.total)}</strong></div>${orderTimeline(order)}<div class="tracking-meta"><span>Frame size: <strong>${escapeHtml(order.frame_size || 'A4')}</strong></span><span>Payment: <strong>${escapeHtml(order.payment_status || 'submitted')}</strong></span></div><button class="button secondary" type="button" onclick="renderAccountState('orders'); showOrders()">← Back to My Orders</button>`;
  } catch(e) { toast(e.message); }
}
async function toggleWishlist(id) { if(!currentUser){openAccount('login');toast('Sign in to save frames.');return;} const remove=wishlist.has(id); try { await api('/api/wishlist',{method:'POST',body:JSON.stringify({productId:id,action:remove?'remove':'add'})}); if(remove)wishlist.delete(id); else wishlist.add(id); renderProducts(); toast(remove?'Removed from saved items.':'Saved to your account.'); } catch(e){toast(e.message);} }

function openAdmin() { if(currentUser?.role!=='owner') return openAdminLogin(); closeModal('accountModal'); openModal('adminModal'); renderAdmin('dashboard'); }
function openAdminLogin() { closeModal('accountModal'); $('adminContent').innerHTML=`<p class="eyebrow">OWNER ACCESS</p><h2>The KaXro Owner Dashboard</h2><p class="muted">Owner account: thekaxro@gmail.com</p><form class="auth-form" onsubmit="adminLogin(event)"><label>Email<input id="adminEmail" type="email" value="thekaxro@gmail.com" maxlength="190" required autocomplete="email"></label><label>Password<input id="adminPassword" type="password" maxlength="128" required autocomplete="current-password"></label><button class="button">Sign In</button></form>`; openModal('adminModal'); }
async function adminLogin(e) { e.preventDefault(); try { const r=await api('/api/admin/login',{method:'POST',body:JSON.stringify({email:$('adminEmail').value,password:$('adminPassword').value})}); currentUser=r.user; await renderAdmin('dashboard'); } catch(err){toast(err.message);} }
function adminNav(active) { return `<div class="admin-tabs">${['dashboard','orders','products','customers','discounts','settings'].map(t=>`<button class="${active===t?'active':''}" onclick="renderAdmin('${t}')">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}<button onclick="adminSignOut()">Sign Out</button></div>`; }
async function renderAdmin(tab='dashboard') {
  $('adminContent').innerHTML='<p class="muted">Loading admin panel...</p>';
  try {
    if(tab==='dashboard') {
      const s=await api('/api/admin/stats');
      $('adminContent').innerHTML=`<p class="eyebrow">OWNER ONLY</p><h2>The KaXro Admin</h2>${adminNav(tab)}<div class="admin-grid"><div class="stat"><small>Orders</small><strong>${s.stats.orders}</strong></div><div class="stat"><small>Customers</small><strong>${s.stats.customers}</strong></div><div class="stat"><small>Products</small><strong>${s.stats.products}</strong></div><div class="stat"><small>Verified revenue</small><strong>${money(s.stats.revenue)}</strong></div><div class="stat"><small>Pending payments</small><strong>${s.stats.pendingPayments}</strong></div></div><div class="order-item"><strong>Payment verification</strong><p class="muted">Customer UTRs never verify payments automatically. Use Orders to review each transfer and set its payment status manually.</p></div>`;
    } else if(tab==='orders') await renderAdminOrders();
    else if(tab==='products') await renderAdminProducts();
    else if(tab==='customers') await renderAdminCustomers();
    else if(tab==='discounts') await renderAdminDiscounts();
    else if(tab==='settings') await renderAdminSettings();
  } catch(err) { $('adminContent').innerHTML=`<p class="muted">${escapeHtml(err.message)}</p>`; }
}
async function renderAdminOrders() {
  const r=await api('/api/admin/orders'); adminCache.orders=r.orders||[];
  $('adminContent').innerHTML=`<p class="eyebrow">OWNER ONLY</p><h2>Orders</h2>${adminNav('orders')}<div class="admin-actions"><button class="button secondary" onclick="exportOrdersCsv()">Export CSV</button></div><div style="overflow:auto"><table class="admin-table"><thead><tr><th>Order</th><th>Product</th><th>Customer</th><th>Payment</th><th>Total</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>${adminCache.orders.map(o=>`<tr><td><strong>${escapeHtml(o.order_number)}</strong><br>${new Date(o.created_at).toLocaleString()}<br><span class="muted">${escapeHtml(o.coupon_code||'')}</span></td><td><div class="admin-order-items">${(o.items||[]).length?(o.items||[]).map(item=>`<div class="admin-order-item">${item.image?`<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.product_name)}" class="admin-order-thumb">`:''}<div><strong>${escapeHtml(item.product_name)}</strong><br><span class="muted">${money(item.unit_price)} × ${item.quantity}</span></div></div>`).join(''):'<span class="muted">No product items</span>'}</div></td><td>${escapeHtml(o.customer_name)}<br>${escapeHtml(o.email)}<br>${escapeHtml(o.phone)}<br>${escapeHtml(o.address)}</td><td>UTR: ${escapeHtml(o.utr)}<br><select id="pay-${o.id}" onchange="updateOrder(${o.id},'${escapeHtml(o.status)}',this.value)">${['submitted','verified','rejected'].map(s=>`<option ${s===o.payment_status?'selected':''}>${s}</option>`).join('')}</select></td><td>${money(o.total)}<br><span class="muted">Frame ${escapeHtml(o.frame_size||'A4')} · Subtotal ${money(o.subtotal)} · Discount ${money(o.discount)}</span>${o.personalization_type==='pinterest' ? `<br><a class="muted" href="${escapeHtml(o.personalization_value)}" target="_blank" rel="noopener">Pinterest image</a>` : o.personalization_type==='upload' ? `<br><a class="muted" href="${escapeHtml(o.personalization_value)}" target="_blank" rel="noopener">Uploaded image</a>` : ''}</td><td><select onchange="updateOrder(${o.id},this.value,'${escapeHtml(o.payment_status)}')">${['payment_pending','paid','processing','shipped','completed','cancelled'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td><td><textarea id="note-${o.id}" maxlength="1000" rows="3">${escapeHtml(o.note||'')}</textarea><button class="button tiny" onclick="saveOrderNote(${o.id})">Save</button></td><td><button class="button secondary tiny danger-button" onclick="deleteAdminOrder(${o.id},'${escapeHtml(o.order_number)}')">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function deleteAdminOrder(id,orderNumber) {
  if(!confirm(`Delete order ${orderNumber}? This will permanently remove the order and its order items from the admin database.`)) return;
  try { await api(`/api/admin/orders/${id}`,{method:'DELETE'}); toast('Order deleted.'); await renderAdminOrders(); } catch(e) { toast(e.message); }
}

async function updateOrder(id,status,payment_status) { try { await api(`/api/admin/orders/${id}`,{method:'PATCH',body:JSON.stringify({status,payment_status})}); toast('Order updated.'); await renderAdminOrders(); } catch(e){toast(e.message);} }
async function saveOrderNote(id) { try { await api(`/api/admin/orders/${id}`,{method:'PATCH',body:JSON.stringify({note:$(`note-${id}`).value})}); toast('Order note saved.'); } catch(e){toast(e.message);} }
function exportOrdersCsv() { const header=['Order','Customer','Email','Phone','Address','UTR','Frame size','Personalization','Personalization value','Subtotal','Discount','Coupon','Total','Status','Payment status','Note','Created']; const rows=adminCache.orders.map(o=>[o.order_number,o.customer_name,o.email,o.phone,o.address,o.utr,o.frame_size||'A4',o.personalization_type||'none',o.personalization_type==='upload'?'uploaded image':(o.personalization_value||''),o.subtotal,o.discount,o.coupon_code,o.total,o.status,o.payment_status,o.note,o.created_at]); const csv=[header,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`thekaxro-orders-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href); }

function adminCategoryOptions(selected = 'Minimal') {
  const active = STORE_CATEGORIES.includes(selected) ? selected : 'Minimal';
  return STORE_CATEGORIES.map(category => `<option value="${escapeHtml(category)}" ${category === active ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('');
}
async function renderAdminProducts() {
  const r=await api('/api/admin/products'); adminCache.products=r.products||[];
  $('adminContent').innerHTML=`<p class="eyebrow">OWNER ONLY</p><h2>Products & Inventory</h2>${adminNav('products')}<div class="order-item"><strong>Add product</strong><form class="auth-form admin-form" onsubmit="saveProduct(event)"><label>Name<input id="pName" required maxlength="100"></label><label>Description<input id="pDescription" maxlength="500"></label><label>Price<input id="pPrice" type="number" min="1" required></label><label>Stock<input id="pStock" type="number" min="0" value="0"></label><label>Category<select id="pCategory">${adminCategoryOptions('Minimal')}</select></label><label>Image URL<input id="pImage" maxlength="500"></label><button class="button">Add Product</button></form></div><div style="overflow:auto;margin-top:20px"><table class="admin-table"><thead><tr><th>Name</th><th>Price</th><th>Stock</th><th>Category</th><th>Active</th><th>Actions</th></tr></thead><tbody>${adminCache.products.map(p=>`<tr><td><input id="pn-${p.id}" value="${escapeHtml(p.name)}"></td><td><input id="pp-${p.id}" type="number" min="1" value="${p.price}"></td><td><input id="ps-${p.id}" type="number" min="0" value="${p.stock}"></td><td><select id="pc-${p.id}">${adminCategoryOptions(p.category)}</select></td><td><select id="pa-${p.id}"><option value="1" ${p.active?'selected':''}>Active</option><option value="0" ${!p.active?'selected':''}>Hidden</option></select></td><td><button class="button tiny" onclick="editProduct(${p.id})">Save</button> <button class="button secondary tiny" onclick="deactivateProduct(${p.id})">Hide</button></td></tr>`).join('')}</tbody></table></div>`;
}
async function saveProduct(e){e.preventDefault();try{await api('/api/admin/products',{method:'POST',body:JSON.stringify({name:$('pName').value,description:$('pDescription').value,price:$('pPrice').value,stock:$('pStock').value,category:$('pCategory').value,image:$('pImage').value})});toast('Product added.');await renderAdminProducts();}catch(err){toast(err.message);}}
async function editProduct(id){try{const p=adminCache.products.find(x=>x.id===id)||{};await api(`/api/admin/products/${id}`,{method:'PATCH',body:JSON.stringify({name:$(`pn-${id}`).value,description:p.description||'',image:p.image||'',price:$(`pp-${id}`).value,stock:$(`ps-${id}`).value,category:$(`pc-${id}`).value,active:$(`pa-${id}`).value==='1'})});toast('Product saved.');await renderAdminProducts();}catch(e){toast(e.message);}}
async function deactivateProduct(id){try{await api(`/api/admin/products/${id}`,{method:'DELETE'});toast('Product hidden.');await renderAdminProducts();}catch(e){toast(e.message);}}

async function renderAdminCustomers(){const r=await api('/api/admin/customers');adminCache.customers=r.customers||[];$('adminContent').innerHTML=`<p class="eyebrow">OWNER ONLY</p><h2>Customers</h2>${adminNav('customers')}<div style="overflow:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Contact</th><th>Orders</th><th>Verified spend</th><th>Joined</th></tr></thead><tbody>${adminCache.customers.map(c=>`<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.email)}<br>${escapeHtml(c.phone||'')}<br>${escapeHtml(c.address||'')}</td><td>${c.order_count}</td><td>${money(c.verified_spend)}</td><td>${new Date(c.created_at).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div>`;}

async function renderAdminDiscounts(){const r=await api('/api/admin/coupons');adminCache.coupons=r.coupons||[];$('adminContent').innerHTML=`<p class="eyebrow">OWNER ONLY</p><h2>Discount Codes</h2>${adminNav('discounts')}<div class="order-item"><strong>Create discount</strong><form class="auth-form admin-form" onsubmit="saveCoupon(event)"><label>Code<input id="cCode" required maxlength="40"></label><label>Type<select id="cType"><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></label><label>Value<input id="cValue" type="number" min="1" required></label><label>Max uses<input id="cMax" type="number" min="1" placeholder="Leave empty for unlimited"></label><label>Expires<input id="cExpires" type="datetime-local"></label><button class="button">Create Code</button></form></div><div style="overflow:auto;margin-top:20px"><table class="admin-table"><thead><tr><th>Code</th><th>Discount</th><th>Uses</th><th>Expiry</th><th>Status</th><th>Action</th></tr></thead><tbody>${adminCache.coupons.map(c=>`<tr><td>${escapeHtml(c.code)}</td><td>${c.discount_type==='percent'?`${c.value}%`:money(c.value)}</td><td>${c.used_count}${c.max_uses===null?'':' / '+c.max_uses}</td><td>${c.expires_at?new Date(c.expires_at).toLocaleString():'None'}</td><td>${c.active?'Active':'Disabled'}</td><td><button class="button secondary tiny" onclick="disableCoupon(${c.id})">Disable</button></td></tr>`).join('')}</tbody></table></div>`;}
async function saveCoupon(e){e.preventDefault();try{await api('/api/admin/coupons',{method:'POST',body:JSON.stringify({code:$('cCode').value,discount_type:$('cType').value,value:$('cValue').value,max_uses:$('cMax').value,expires_at:$('cExpires').value?new Date($('cExpires').value).toISOString():null})});toast('Discount code created.');await renderAdminDiscounts();}catch(err){toast(err.message);}}
async function disableCoupon(id){try{await api(`/api/admin/coupons/${id}`,{method:'DELETE'});toast('Discount code disabled.');await renderAdminDiscounts();}catch(e){toast(e.message);}}

async function renderAdminSettings(){const r=await api('/api/admin/settings');adminCache.settings=r.settings||{};$('adminContent').innerHTML=`<p class="eyebrow">OWNER ONLY</p><h2>Store Settings</h2>${adminNav('settings')}<form class="auth-form order-item" onsubmit="saveSettings(event)"><label>Store name<input id="sStore" value="${escapeHtml(adminCache.settings.store_name||'The KaXro')}" maxlength="200"></label><label>Support email<input value="thekaxro@gmail.com" readonly></label><label>UPI ID<input value="9719747071@fam" readonly></label><label>Store status<select id="sOpen"><option value="1" ${(adminCache.settings.store_open||'1')==='1'?'selected':''}>Open</option><option value="0" ${(adminCache.settings.store_open||'1')==='0'?'selected':''}>Closed</option></select></label><button class="button">Save Settings</button></form><div class="order-item" style="margin-top:16px"><strong>Owner setup</strong><p class="muted">Owner creation uses the server-side ADMIN_SETUP_KEY secret. It is not stored in this website.</p></div>`;}
async function saveSettings(e){e.preventDefault();try{await api('/api/admin/settings',{method:'PATCH',body:JSON.stringify({store_name:$('sStore').value,store_open:$('sOpen').value})});toast('Settings saved.');}catch(err){toast(err.message);}}
async function adminSignOut(){await api('/api/admin/logout',{method:'POST'}).catch(()=>{});currentUser=null;closeModal('adminModal');renderAccountState();toast('Signed out.');}

$('personalizeLink')?.addEventListener('input', handlePersonalizeLink);
$('personalizeFile')?.addEventListener('change', handlePersonalizeFile);
$('frameSize')?.addEventListener('change', () => { $('couponResult').dataset.discount = '0'; $('couponResult').dataset.code = ''; renderCheckoutSummary(); });

if (location.pathname === '/reset-password') { renderResetPassword(); } else { loadSession().finally(() => { loadProducts(); loadStoreSettings(); if (location.pathname === '/admin' || location.pathname === '/admin/') openAdmin(); if (new URLSearchParams(location.search).get('account') === 'login') openAccount('login'); }); }
renderCart();
