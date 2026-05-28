// modules/pos/pos.js
import { db, COLLECTIONS }   from '../../src/js/firebase.js';
import { state, shopId }     from '../../src/js/state.js';
import { currentUser }       from '../../src/js/auth.js';
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  runTransaction, increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  currency, today, toast, confirm2,
  openModal, closeModal, payBadge, debounce
} from '../../src/js/utils.js';

// ── Cart state (in-memory per session) ──
let cart = [];
let activeSaleTab = 'cashier'; // 'cashier' | 'log'

// ── Barcode scanner state ──
let _barcodeBuffer = '';
let _barcodeTimer  = null;
const BARCODE_TIMEOUT = 80; // ms between keystrokes — scanner is faster than human

// ── Init barcode listener (USB/Bluetooth scanner acts as keyboard) ──
function initBarcodeListener() {
  // Remove old listener if re-rendering
  document.removeEventListener('keydown', _onBarcodeKey);
  document.addEventListener('keydown', _onBarcodeKey);
}

function _onBarcodeKey(e) {
  // Only capture when no modal is open and POS is active module
  const modalOpen = document.querySelector('.modal-overlay.open');
  if (modalOpen) return;

  // Ignore modifier keys
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.key === 'Enter') {
    if (_barcodeBuffer.length >= 3) {
      _processBarcodeOrSKU(_barcodeBuffer.trim());
    }
    _barcodeBuffer = '';
    clearTimeout(_barcodeTimer);
    return;
  }

  // Only collect printable chars
  if (e.key.length === 1) {
    _barcodeBuffer += e.key;
    clearTimeout(_barcodeTimer);
    _barcodeTimer = setTimeout(() => {
      // Timeout — not a scanner (too slow), clear buffer
      _barcodeBuffer = '';
    }, BARCODE_TIMEOUT);
  }
}

function _processBarcodeOrSKU(code) {
  // Search by barcode field OR name match
  const product = state.products.find(p =>
    p.barcode === code ||
    p.sku     === code ||
    p.name?.toLowerCase() === code.toLowerCase()
  );

  const barcodeEl = document.getElementById('barcodeFeedback');

  if (!product) {
    if (barcodeEl) {
      barcodeEl.textContent = `❌ لم يتم العثور على: "${code}"`;
      barcodeEl.style.color = 'var(--danger)';
      setTimeout(() => { if(barcodeEl) barcodeEl.textContent = ''; }, 2000);
    }
    toast(`باركود غير معروف: ${code}`, 'warning');
    return;
  }

  window._pos.addToCart(product._id);

  if (barcodeEl) {
    barcodeEl.textContent = `✅ تم إضافة: ${product.name}`;
    barcodeEl.style.color = 'var(--success)';
    setTimeout(() => { if(barcodeEl) barcodeEl.textContent = ''; }, 1500);
  }
}

export function register(registerModule) {
  registerModule('pos', {
    label: 'المبيعات / POS',
    icon:  '🛒',
    group: 'العمليات',
    render: renderPOS,
  });
}

// ════════════════════════════════
// RENDER
// ════════════════════════════════
function renderPOS() {
  injectModals();
  initBarcodeListener(); // ← start listening for scanner
  return `
    <div class="page-header">
      <div class="page-title">🛒 نقطة البيع</div>
      <div class="page-subtitle">مبيعات الأجهزة والملحقات</div>
    </div>

    <!-- Barcode scanner status bar -->
    <div class="barcode-bar">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">🔌</span>
        <div>
          <div style="font-size:12px;font-weight:700;">Scanner USB/Bluetooth جاهز</div>
          <div style="font-size:11px;color:var(--text2);">وجّه الجهاز وامسح الباركود مباشرة</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span id="barcodeFeedback" style="font-size:13px;font-weight:700;min-width:200px;text-align:left;"></span>
        <div class="barcode-dot" title="جاهز للمسح"></div>
      </div>
    </div>

    <!-- Sub tabs -->
    <div style="display:flex;gap:4px;background:var(--bg);border-radius:10px;padding:4px;width:fit-content;margin-bottom:20px;">
      <button class="pos-tab ${activeSaleTab==='cashier'?'pos-tab-active':''}"
              onclick="window._pos.switchTab('cashier')">🛒 الكاشير</button>
      <button class="pos-tab ${activeSaleTab==='log'?'pos-tab-active':''}"
              onclick="window._pos.switchTab('log')">📋 سجل المبيعات</button>
    </div>

    <!-- Cashier panel -->
    <div id="pos-cashier" style="${activeSaleTab!=='cashier'?'display:none':''}">
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:start;">

        <!-- Products grid -->
        <div>
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">🔍 المنتجات</div>
              <div style="display:flex;gap:8px;">
                <input class="search-input" id="posSearchInput"
                       placeholder="ابحث عن منتج..."
                       oninput="window._pos.filterProducts()"
                       style="width:180px;">
                <select class="form-control" id="posCatFilter"
                        onchange="window._pos.filterProducts()"
                        style="width:auto;min-width:110px;">
                  <option value="">كل الفئات</option>
                  <option value="أجهزة">📱 أجهزة</option>
                  <option value="ملحقات">🎧 ملحقات</option>
                  <option value="قطع غيار">🔩 قطع غيار</option>
                  <option value="أخرى">📦 أخرى</option>
                </select>
              </div>
            </div>
            <div class="card-body" style="padding:14px;">
              <div id="posProductGrid"
                   style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;max-height:380px;overflow-y:auto;">
                ${buildProductGrid()}
              </div>
            </div>
          </div>
        </div>

        <!-- Cart -->
        <div>
          <div class="card" style="margin-bottom:0;">
            <div class="card-header">
              <div class="card-title">🧾 الفاتورة</div>
              <button class="btn btn-ghost btn-xs" onclick="window._pos.clearCart()">مسح ✕</button>
            </div>
            <div id="posCartWrap">
              ${buildCart()}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sales log panel -->
    <div id="pos-log" style="${activeSaleTab!=='log'?'display:none':''}">
      ${buildSalesLog()}
    </div>
  `;
}

// ── Product grid ──
function buildProductGrid(search = '', cat = '') {
  let products = state.products || [];
  if (search) products = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  if (cat)    products = products.filter(p => p.cat === cat);

  if (!products.length) return `
    <div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text2);">
      <div style="font-size:36px;margin-bottom:10px;">📦</div>
      <p style="font-size:13px;">لا توجد منتجات${search?' تطابق البحث':' — أضفها من مشتريات البضاعة'}</p>
    </div>`;

  return products.map(p => {
    const outOfStock = (p.stock || 0) <= 0;
    return `
      <div onclick="${outOfStock ? '' : `window._pos.addToCart('${p._id}')`}"
           style="background:var(--bg);border:1px solid ${outOfStock?'var(--border)':'var(--border)'};
                  border-radius:12px;padding:12px;text-align:center;
                  cursor:${outOfStock?'not-allowed':'pointer'};
                  opacity:${outOfStock?'0.45':'1'};
                  transition:all 0.2s;"
           onmouseover="if(!${outOfStock})this.style.borderColor='var(--accent)'"
           onmouseout="this.style.borderColor='var(--border)'">
        <div style="font-size:26px;margin-bottom:6px;">${p.emoji||'📦'}</div>
        <div style="font-size:12px;font-weight:700;margin-bottom:3px;line-height:1.3;">${p.name}</div>
        <div style="font-size:11px;color:var(--text2);margin-bottom:5px;">${p.cat||''}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-weight:900;color:var(--accent3);font-size:14px;">${currency(p.price)}</div>
        <div style="font-size:10px;margin-top:3px;color:${(p.stock||0)<=5?'var(--warning)':'var(--text2)'};">
          مخزون: ${p.stock||0}
        </div>
      </div>`;
  }).join('');
}

// ── Cart ──
function buildCart() {
  if (!cart.length) return `
    <div style="padding:40px 20px;text-align:center;color:var(--text2);">
      <div style="font-size:40px;margin-bottom:10px;">🛒</div>
      <p style="font-size:13px;">اضغط على منتج لإضافته</p>
    </div>
    <div style="padding:16px;border-top:1px solid var(--border);">
      <button class="btn btn-primary btn-block" disabled>إتمام البيع</button>
    </div>`;

  const total = cart.reduce((s,i) => s + i.price * i.qty, 0);

  return `
    <div style="max-height:260px;overflow-y:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--bg);">
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--text2);">المنتج</th>
            <th style="padding:8px 6px;text-align:center;font-size:11px;color:var(--text2);">الكمية</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text2);">المجموع</th>
            <th style="padding:8px 6px;"></th>
          </tr>
        </thead>
        <tbody>
          ${cart.map(item => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:10px 12px;">
                <div style="font-weight:700;font-size:12px;">${item.name}</div>
                <div style="font-size:11px;color:var(--text2);">${currency(item.price)} / قطعة</div>
              </td>
              <td style="padding:10px 6px;">
                <div style="display:flex;align-items:center;justify-content:center;gap:5px;">
                  <button onclick="window._pos.changeQty('${item.pid}',-1)"
                          style="width:22px;height:22px;border:1px solid var(--border);
                                 background:var(--surface2);color:var(--text);border-radius:6px;
                                 cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">−</button>
                  <span style="font-family:'JetBrains Mono',monospace;font-weight:700;min-width:18px;text-align:center;">${item.qty}</span>
                  <button onclick="window._pos.changeQty('${item.pid}',1)"
                          style="width:22px;height:22px;border:1px solid var(--border);
                                 background:var(--surface2);color:var(--text);border-radius:6px;
                                 cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">+</button>
                </div>
              </td>
              <td style="padding:10px 12px;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent3);text-align:left;">
                ${currency(item.price * item.qty)}
              </td>
              <td style="padding:10px 6px;">
                <button onclick="window._pos.removeFromCart('${item.pid}')"
                        style="background:rgba(255,71,87,0.1);color:var(--danger);border:none;
                               border-radius:6px;padding:3px 7px;cursor:pointer;font-size:12px;">✕</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Totals & checkout -->
    <div style="padding:14px 16px;border-top:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:16px;font-weight:700;">الإجمالي</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:900;color:var(--accent3);">${currency(total)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label class="form-label" style="font-size:11px;">اسم الزبون</label>
          <input type="text" class="form-control" id="posCustomer"
                 placeholder="اختياري" style="font-size:13px;padding:8px 12px;">
        </div>
        <div>
          <label class="form-label" style="font-size:11px;">طريقة الدفع</label>
          <select class="form-control" id="posPayMethod" style="font-size:13px;padding:8px 12px;">
            <option value="كاش">💵 كاش</option>
            <option value="شبكة">💳 شبكة</option>
            <option value="آجل">📅 آجل</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;">
        <button class="btn btn-success" style="font-size:15px;" onclick="window._pos.completeSale()">
          ✅ إتمام البيع
        </button>
        <button class="btn btn-ghost" onclick="window._pos.openAddProduct()" title="إضافة منتج جديد">
          + منتج
        </button>
      </div>
    </div>`;
}

// ── Sales log ──
function buildSalesLog(filter = '') {
  const sales = (state.sales || []).filter(s =>
    !filter || s.payment === filter
  );

  const totalRev  = sales.reduce((s,x) => s+(x.total||0), 0);
  const cashRev   = sales.filter(x=>x.payment==='كاش').reduce((s,x)=>s+(x.total||0),0);
  const netRev    = sales.filter(x=>x.payment!=='آجل').reduce((s,x)=>s+(x.total||0),0);

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px;">
      <div class="stat-card green">
        <div class="stat-icon">💰</div>
        <div class="stat-num">${totalRev.toFixed(0)}</div>
        <div class="stat-label">إجمالي المبيعات د.أ</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">🧾</div>
        <div class="stat-num">${sales.length}</div>
        <div class="stat-label">عدد الفواتير</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">💵</div>
        <div class="stat-num">${cashRev.toFixed(0)}</div>
        <div class="stat-label">نقدي د.أ</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">📅</div>
        <div class="stat-num">${(totalRev - netRev).toFixed(0)}</div>
        <div class="stat-label">آجل د.أ</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 سجل الفواتير</div>
        <div style="display:flex;gap:8px;">
          <select class="form-control" id="salesPayFilter"
                  onchange="window._pos.filterSales()"
                  style="width:auto;min-width:120px;font-size:12px;padding:6px 10px;">
            <option value="">كل طرق الدفع</option>
            <option value="كاش">💵 كاش</option>
            <option value="شبكة">💳 شبكة</option>
            <option value="آجل">📅 آجل</option>
          </select>
        </div>
      </div>
      <div class="table-wrap table-card-mode">
        <table>
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>الزبون</th>
              <th>المنتجات</th>
              <th>الإجمالي</th>
              <th>الدفع</th>
              <th>التاريخ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${sales.length ? sales.map(s => `
              <tr>
                <td data-label="الفاتورة"><span class="device-id">${s._id.slice(-8)}</span></td>
                <td data-label="الزبون">${s.customer||'—'}</td>
                <td data-label="المنتجات" style="font-size:12px;color:var(--text2);">
                  ${(s.items||[]).map(i=>`${i.name} ×${i.qty}`).join(' · ')}
                </td>
                <td data-label="الإجمالي">
                  <span class="mono" style="font-weight:700;color:var(--accent3);">${currency(s.total)}</span>
                </td>
                <td data-label="الدفع">${payBadge(s.payment)}</td>
                <td data-label="التاريخ" style="font-size:12px;color:var(--text2);">${s.date||'—'}</td>
                <td class="no-label">
                  <button class="btn btn-info btn-xs"
                          onclick="window._pos.viewSale('${s._id}')">عرض</button>
                </td>
              </tr>`).join('')
            : `<tr><td colspan="7"><div class="table-empty"><div class="icon">📭</div><p>لا توجد مبيعات بعد</p></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ════════════════════════════════
// MODALS
// ════════════════════════════════
function injectModals() {
  if (document.getElementById('posAddProductModal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <!-- Add Product Modal -->
    <div class="modal-overlay" id="posAddProductModal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📦 إضافة منتج للـ POS</div>
          <button class="modal-close" onclick="closeModal('posAddProductModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">اسم المنتج *</label>
            <input type="text" class="form-control" id="ap-name" placeholder="iPhone 15 / كابل شحن...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">الفئة</label>
              <select class="form-control" id="ap-cat">
                <option value="أجهزة">📱 أجهزة</option>
                <option value="ملحقات">🎧 ملحقات</option>
                <option value="قطع غيار">🔩 قطع غيار</option>
                <option value="أخرى">📦 أخرى</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">الأيقونة (emoji)</label>
              <input type="text" class="form-control" id="ap-emoji" placeholder="📱" maxlength="2">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">سعر البيع (د.أ) *</label>
              <input type="number" class="form-control" id="ap-price" placeholder="0.00" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">الكمية الابتدائية</label>
              <input type="number" class="form-control" id="ap-stock" placeholder="0" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">باركود المنتج</label>
              <input type="text" class="form-control" id="ap-barcode"
                     placeholder="امسح أو اكتب الباركود"
                     style="font-family:'JetBrains Mono',monospace;">
            </div>
            <div class="form-group">
              <label class="form-label">رمز SKU (اختياري)</label>
              <input type="text" class="form-control" id="ap-sku"
                     placeholder="مثال: IPH15-BLK-128"
                     style="font-family:'JetBrains Mono',monospace;">
            </div>
          </div>
          <div id="ap-alert"></div>
          <div class="modal-footer" style="padding:0;margin-top:16px;">
            <button class="btn btn-ghost" onclick="closeModal('posAddProductModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="window._pos.saveProduct()">إضافة المنتج ✓</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sale Detail Modal -->
    <div class="modal-overlay" id="posSaleDetailModal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">🧾 تفاصيل الفاتورة</div>
          <button class="modal-close" onclick="closeModal('posSaleDetailModal')">✕</button>
        </div>
        <div class="modal-body" id="posSaleDetailBody"></div>
      </div>
    </div>
  `);

  ['posAddProductModal','posSaleDetailModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) closeModal(id);
    });
  });
}

// ════════════════════════════════
// ACTIONS
// ════════════════════════════════
window._pos = {

  switchTab(tab) {
    activeSaleTab = tab;
    document.querySelectorAll('.pos-tab').forEach(t => t.classList.remove('pos-tab-active'));
    event.target.classList.add('pos-tab-active');
    document.getElementById('pos-cashier').style.display = tab === 'cashier' ? '' : 'none';
    document.getElementById('pos-log').style.display     = tab === 'log'     ? '' : 'none';
    if (tab === 'log') {
      document.getElementById('pos-log').innerHTML = buildSalesLog();
    }
  },

  filterProducts: debounce(() => {
    const search = document.getElementById('posSearchInput')?.value || '';
    const cat    = document.getElementById('posCatFilter')?.value   || '';
    const grid   = document.getElementById('posProductGrid');
    if (grid) grid.innerHTML = buildProductGrid(search, cat);
  }, 250),

  filterSales() {
    const f = document.getElementById('salesPayFilter')?.value || '';
    document.getElementById('pos-log').innerHTML = buildSalesLog(f);
  },

  addToCart(pid) {
    const product = state.products.find(p => p._id === pid);
    if (!product) return;
    if ((product.stock||0) <= 0) { toast('المنتج غير متوفر في المخزون', 'warning'); return; }

    const existing = cart.find(i => i.pid === pid);
    if (existing) {
      if (existing.qty >= (product.stock||0)) { toast('لا يوجد مخزون كافٍ', 'warning'); return; }
      existing.qty++;
    } else {
      cart.push({ pid, name: product.name, price: product.price, qty: 1 });
    }
    this._refreshCart();
  },

  changeQty(pid, delta) {
    const item = cart.find(i => i.pid === pid);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    this._refreshCart();
  },

  removeFromCart(pid) {
    cart = cart.filter(i => i.pid !== pid);
    this._refreshCart();
  },

  clearCart() {
    cart = [];
    this._refreshCart();
  },

  _refreshCart() {
    const wrap = document.getElementById('posCartWrap');
    if (wrap) wrap.innerHTML = buildCart();
  },

  async completeSale() {
    if (!cart.length) { toast('السلة فارغة', 'warning'); return; }

    const customer = document.getElementById('posCustomer')?.value.trim() || '—';
    const payment  = document.getElementById('posPayMethod')?.value || 'كاش';
    const total    = cart.reduce((s,i) => s + i.price * i.qty, 0);
    const sid      = shopId();

    const btn = document.querySelector('#posCartWrap .btn-success');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }

    try {
      // Firestore transaction: save sale + deduct stock atomically
      await runTransaction(db, async (t) => {
        // Verify stock for each item
        for (const item of cart) {
          const prodRef  = doc(db, COLLECTIONS.PRODUCTS, item.pid);
          const whQuery  = (state.warehouse||[]).find(w => w.name === item.name);
          // deduct from products
          t.update(prodRef, { stock: increment(-item.qty) });
          // deduct from warehouse if exists
          if (whQuery) {
            t.update(doc(db, COLLECTIONS.WAREHOUSE, whQuery._id), {
              stock: increment(-item.qty),
              updated: today(),
            });
          }
        }
        // Save sale
        const saleRef = doc(collection(db, COLLECTIONS.SALES));
        t.set(saleRef, {
          shopId:    sid,
          customer,
          payment,
          total,
          items:     cart.map(i => ({ name:i.name, qty:i.qty, price:i.price })),
          date:      today(),
          createdBy: currentUser?.uid || '',
        });
        // Add warehouse movement for each item
        for (const item of cart) {
          const movRef = doc(collection(db, COLLECTIONS.WH_MOVEMENTS));
          t.set(movRef, {
            shopId: sid,
            item:   item.name,
            type:   'بيع',
            qty:    -item.qty,
            reason: `فاتورة — ${customer}`,
            date:   today(),
          });
        }
      });

      toast(`✅ تم البيع — ${currency(total)}`);
      cart = [];
      document.getElementById('posCustomer').value  = '';
      document.getElementById('posPayMethod').value = 'كاش';
      this._refreshCart();
      // Refresh product grid
      const grid = document.getElementById('posProductGrid');
      if (grid) grid.innerHTML = buildProductGrid();

    } catch(err) {
      toast('❌ خطأ: ' + err.message, 'danger');
    }
  },

  openAddProduct() {
    openModal('posAddProductModal');
  },

  async saveProduct() {
    const name    = document.getElementById('ap-name')?.value.trim();
    const cat     = document.getElementById('ap-cat')?.value || 'أخرى';
    const emoji   = document.getElementById('ap-emoji')?.value.trim() || '📦';
    const price   = parseFloat(document.getElementById('ap-price')?.value) || 0;
    const stock   = parseInt(document.getElementById('ap-stock')?.value)   || 0;
    const barcode = document.getElementById('ap-barcode')?.value.trim()    || '';
    const sku     = document.getElementById('ap-sku')?.value.trim()        || '';
    const al      = document.getElementById('ap-alert');

    if (!name || price <= 0) {
      al.innerHTML = '<div class="alert alert-danger">❌ اسم المنتج وسعر البيع مطلوبان</div>';
      return;
    }

    // Check duplicate barcode
    if (barcode && state.products.find(p => p.barcode === barcode && p._id)) {
      al.innerHTML = '<div class="alert alert-warning">⚠️ هذا الباركود مسجل لمنتج آخر</div>';
      return;
    }

    try {
      await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
        shopId: shopId(), name, cat, emoji, price, stock,
        ...(barcode ? { barcode } : {}),
        ...(sku     ? { sku }     : {}),
        date: today(),
      });
      if (stock > 0) {
        await addDoc(collection(db, COLLECTIONS.WAREHOUSE), {
          shopId: shopId(), name, cat, emoji,
          stock, minStock: 5, costPrice: 0, sellPrice: price,
          ...(barcode ? { barcode } : {}),
          ...(sku     ? { sku }     : {}),
          updated: today(), date: today(),
        });
      }
      closeModal('posAddProductModal');
      ['ap-name','ap-emoji','ap-price','ap-stock','ap-barcode','ap-sku'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = '';
      });
      toast(`✅ تم إضافة "${name}"`);
      const grid = document.getElementById('posProductGrid');
      if (grid) grid.innerHTML = buildProductGrid();
    } catch(err) {
      al.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
    }
  },

  viewSale(id) {
    const sale = state.sales.find(s => s._id === id);
    if (!sale) return;
    document.getElementById('posSaleDetailBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
        <div><div class="form-label">الزبون</div><div style="font-weight:700;">${sale.customer||'—'}</div></div>
        <div><div class="form-label">طريقة الدفع</div>${payBadge(sale.payment)}</div>
        <div><div class="form-label">التاريخ</div><div>${sale.date||'—'}</div></div>
        <div>
          <div class="form-label">الإجمالي</div>
          <div class="mono" style="font-size:20px;font-weight:900;color:var(--accent3);">${currency(sale.total)}</div>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:14px;">
        <div class="form-label" style="margin-bottom:10px;">المنتجات</div>
        ${(sale.items||[]).map(i => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
            <span style="font-weight:700;">${i.name} <span style="color:var(--text2);font-weight:400;">× ${i.qty}</span></span>
            <span class="mono" style="color:var(--accent3);">${currency(i.price * i.qty)}</span>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:16px;font-weight:900;">
          <span>الإجمالي</span>
          <span class="mono" style="color:var(--accent3);">${currency(sale.total)}</span>
        </div>
      </div>
    `;
    openModal('posSaleDetailModal');
  },
};
