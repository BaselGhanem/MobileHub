// modules/warehouse/warehouse.js
import { db, COLLECTIONS }  from '../../src/js/firebase.js';
import { state, shopId }    from '../../src/js/state.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, increment }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  currency, today, toast, confirm2,
  openModal, closeModal, debounce, emptyState
} from '../../src/js/utils.js';

export function register(registerModule) {
  registerModule('warehouse', {
    label: 'المستودع',
    icon:  '🏭',
    group: 'المشتريات والمخزون',
    render: renderWarehouse,
  });
}

// ── Barcode listener for warehouse ──
let _whBarcodeBuffer = '';
let _whBarcodeTimer  = null;

function initWhBarcodeListener() {
  document.removeEventListener('keydown', _onWhBarcodeKey);
  document.addEventListener('keydown', _onWhBarcodeKey);
}

function _onWhBarcodeKey(e) {
  const modalOpen = document.querySelector('.modal-overlay.open');
  if (modalOpen) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.key === 'Enter') {
    if (_whBarcodeBuffer.length >= 3) _lookupBarcode(_whBarcodeBuffer.trim());
    _whBarcodeBuffer = '';
    clearTimeout(_whBarcodeTimer);
    return;
  }
  if (e.key.length === 1) {
    _whBarcodeBuffer += e.key;
    clearTimeout(_whBarcodeTimer);
    _whBarcodeTimer = setTimeout(() => { _whBarcodeBuffer = ''; }, 80);
  }
}

function _lookupBarcode(code) {
  const item = state.warehouse.find(w =>
    w.barcode === code || w.sku === code
  );
  const fb = document.getElementById('whBarcodeFeedback');
  if (!item) {
    if (fb) { fb.textContent = `❌ باركود غير موجود: "${code}"`; fb.style.color='var(--danger)'; setTimeout(()=>{if(fb)fb.textContent='';},2000); }
    toast(`باركود غير معروف: ${code}`, 'warning');
    return;
  }
  if (fb) { fb.textContent = `✅ ${item.name} — مخزون: ${item.stock}`; fb.style.color='var(--success)'; setTimeout(()=>{if(fb)fb.textContent='';},2500); }
  // auto-fill adjust panel
  const sel = document.getElementById('wh-select-item');
  if (sel) { sel.value = item._id; }
  document.getElementById('wh-qty-input')?.focus();
}

// ════════════════════════════════
// RENDER
// ════════════════════════════════
function renderWarehouse() {
  injectModals();
  initWhBarcodeListener();

  const items   = state.warehouse || [];
  const total   = items.length;
  const good    = items.filter(i => stockStatus(i) === 'جيد').length;
  const low     = items.filter(i => stockStatus(i) === 'منخفض').length;
  const out     = items.filter(i => stockStatus(i) === 'نافد').length;
  const value   = items.reduce((s,i) => s + (i.stock||0)*(i.costPrice||0), 0);

  return `
    <div class="page-header">
      <div class="page-title">🏭 المستودع</div>
      <div class="page-subtitle">إدارة المخزون الكامل</div>
    </div>

    <!-- Barcode bar -->
    <div class="barcode-bar">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:18px;">🔌</span>
        <div>
          <div style="font-size:12px;font-weight:700;">Scanner جاهز — امسح باركود لعرض المنتج</div>
          <div style="font-size:11px;color:var(--text2);">USB/Bluetooth scanner</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span id="whBarcodeFeedback" style="font-size:13px;font-weight:700;min-width:220px;text-align:left;"></span>
        <div class="barcode-dot"></div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);">
      <div class="stat-card blue">
        <div class="stat-icon">📦</div>
        <div class="stat-num">${total}</div>
        <div class="stat-label">إجمالي الأصناف</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-num">${good}</div>
        <div class="stat-label">متوفر بشكل جيد</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">⚠️</div>
        <div class="stat-num">${low}</div>
        <div class="stat-label">مخزون منخفض</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">🚨</div>
        <div class="stat-num">${out}</div>
        <div class="stat-label">نافد المخزون</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">💰</div>
        <div class="stat-num">${value.toFixed(0)}</div>
        <div class="stat-label">قيمة المخزون د.أ</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px;align-items:start;">

      <!-- Main table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 قائمة المخزون</div>
          <div style="display:flex;gap:8px;">
            <input class="search-input" id="whSearchInput"
                   placeholder="🔍 بحث..."
                   oninput="window._wh.filter()"
                   style="width:140px;">
            <select class="form-control" id="whCatFilter"
                    onchange="window._wh.filter()"
                    style="width:auto;min-width:110px;font-size:12px;">
              <option value="">كل الفئات</option>
              <option value="أجهزة">📱 أجهزة</option>
              <option value="ملحقات">🎧 ملحقات</option>
              <option value="قطع غيار">🔩 قطع غيار</option>
              <option value="أخرى">📦 أخرى</option>
            </select>
            <select class="form-control" id="whStatusFilter"
                    onchange="window._wh.filter()"
                    style="width:auto;min-width:100px;font-size:12px;">
              <option value="">كل الحالات</option>
              <option value="جيد">✅ جيد</option>
              <option value="منخفض">⚠️ منخفض</option>
              <option value="نافد">🚨 نافد</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="window._wh.openAdd()">+ صنف</button>
          </div>
        </div>
        <div class="table-wrap table-card-mode">
          <table>
            <thead>
              <tr>
                <th>الصنف</th>
                <th>الفئة</th>
                <th>المخزون</th>
                <th>الحد الأدنى</th>
                <th>س. الشراء</th>
                <th>س. البيع</th>
                <th>الباركود</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="whTbody">${buildWhTable()}</tbody>
          </table>
        </div>
      </div>

      <!-- Right column -->
      <div>
        <!-- Alerts -->
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><div class="card-title">🚨 تنبيهات المخزون</div></div>
          <div class="card-body" style="padding:12px;" id="whAlerts">
            ${buildAlerts()}
          </div>
        </div>

        <!-- Adjust stock -->
        <div class="card">
          <div class="card-header"><div class="card-title">⚙️ تعديل مخزون</div></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">اختر صنف</label>
              <select class="form-control" id="wh-select-item">
                <option value="">— اختر —</option>
                ${(state.warehouse||[]).map(i =>
                  `<option value="${i._id}">${i.emoji||'📦'} ${i.name} (${i.stock||0})</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">العملية</label>
              <select class="form-control" id="wh-op">
                <option value="add">➕ إضافة كمية</option>
                <option value="remove">➖ خصم كمية</option>
                <option value="set">🔁 تعيين كمية محددة</option>
                <option value="threshold">🎯 تغيير الحد الأدنى</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">الكمية / القيمة</label>
              <input type="number" class="form-control" id="wh-qty-input" placeholder="0" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">سبب التعديل</label>
              <input type="text" class="form-control" id="wh-reason" placeholder="تلف / إرجاع / تصحيح...">
            </div>
            <button class="btn btn-primary btn-block" onclick="window._wh.applyAdjust()">تطبيق ✓</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Movement log -->
    <div class="card" style="margin-top:18px;">
      <div class="card-header">
        <div class="card-title">📜 سجل حركة المخزون</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>التاريخ</th><th>الصنف</th><th>النوع</th><th>الكمية</th><th>السبب</th></tr>
          </thead>
          <tbody>
            ${buildMovLog()}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Helpers ──
function stockStatus(item) {
  if ((item.stock||0) === 0)              return 'نافد';
  if ((item.stock||0) <= (item.minStock||5)) return 'منخفض';
  return 'جيد';
}

function statusBadgeWh(st) {
  const m = { 'جيد':'badge-ready','منخفض':'badge-diagnosing','نافد':'badge-pending' };
  const i = { 'جيد':'✅','منخفض':'⚠️','نافد':'🚨' };
  return `<span class="badge ${m[st]||''}">${i[st]||''} ${st}</span>`;
}

function buildWhTable(search='', cat='', statusF='') {
  let items = state.warehouse || [];
  if (search)  items = items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()) || i.barcode?.includes(search));
  if (cat)     items = items.filter(i => i.cat === cat);
  if (statusF) items = items.filter(i => stockStatus(i) === statusF);

  if (!items.length) return `<tr><td colspan="9">${emptyState('📭','لا توجد أصناف')}</td></tr>`;

  return items.map(i => {
    const st     = stockStatus(i);
    const margin = i.sellPrice && i.costPrice
      ? Math.round((i.sellPrice - i.costPrice) / i.costPrice * 100) : null;
    return `
      <tr style="${st==='نافد'?'border-right:3px solid var(--danger)':st==='منخفض'?'border-right:3px solid var(--warning)':''}">
        <td data-label="الصنف">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">${i.emoji||'📦'}</span>
            <span style="font-weight:700;">${i.name}</span>
          </div>
        </td>
        <td data-label="الفئة"><span class="tag">${i.cat||'—'}</span></td>
        <td data-label="المخزون">
          <span class="mono" style="font-size:16px;font-weight:900;
            color:${st==='نافد'?'var(--danger)':st==='منخفض'?'var(--warning)':'var(--accent3)'};">
            ${i.stock||0}
          </span>
        </td>
        <td data-label="الحد الأدنى"><span class="mono" style="color:var(--text2);">${i.minStock||5}</span></td>
        <td data-label="س. الشراء"><span class="mono" style="color:var(--danger);">${currency(i.costPrice||0)}</span></td>
        <td data-label="س. البيع">
          <span class="mono" style="color:var(--success);">${i.sellPrice ? currency(i.sellPrice) : '—'}</span>
          ${margin!==null ? `<span style="font-size:10px;color:var(--accent);margin-right:4px;">+${margin}%</span>` : ''}
        </td>
        <td data-label="الباركود">
          ${i.barcode
            ? `<span class="mono" style="font-size:11px;color:var(--accent);">${i.barcode}</span>`
            : `<button class="btn btn-ghost btn-xs" onclick="window._wh.openBarcode('${i._id}')">+ باركود</button>`}
        </td>
        <td data-label="الحالة">${statusBadgeWh(st)}</td>
        <td class="no-label">
          <div style="display:flex;gap:4px;">
            <button class="btn btn-info btn-xs" onclick="window._wh.quickSet('${i._id}')">تعديل</button>
            <button class="btn btn-danger btn-xs" onclick="window._wh.deleteItem('${i._id}','${i.name}')">🗑</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function buildAlerts() {
  const alerts = (state.warehouse||[]).filter(i => stockStatus(i) !== 'جيد');
  if (!alerts.length) return '<div style="text-align:center;color:var(--success);padding:14px;font-weight:700;">✅ جميع الأصناف بمستوى جيد</div>';
  return alerts.map(i => {
    const st = stockStatus(i);
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:9px 11px;background:var(--bg);border-radius:8px;margin-bottom:7px;
                  border-right:3px solid ${st==='نافد'?'var(--danger)':'var(--warning)'};">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">${i.emoji||'📦'}</span>
          <div>
            <div style="font-weight:700;font-size:12px;">${i.name}</div>
            <div style="font-size:11px;color:var(--text2);">متبقي: ${i.stock||0} | حد: ${i.minStock||5}</div>
          </div>
        </div>
        ${statusBadgeWh(st)}
      </div>`;
  }).join('');
}

function buildMovLog() {
  const movs = (state.whMovements||[]).slice(0,20);
  if (!movs.length) return `<tr><td colspan="5">${emptyState('📜','لا توجد حركات')}</td></tr>`;
  const typeColors = { 'بيع':'var(--info)','شراء':'var(--success)','إضافة':'var(--accent)','خصم':'var(--danger)','تعديل':'var(--warning)' };
  return movs.map(m => `
    <tr>
      <td style="font-size:12px;color:var(--text2);">${m.date||'—'}</td>
      <td style="font-weight:700;">${m.item||'—'}</td>
      <td><span class="badge" style="background:rgba(108,99,255,0.1);color:${typeColors[m.type]||'var(--text2)'};">${m.type}</span></td>
      <td class="mono" style="font-weight:700;color:${(m.qty||0)>0?'var(--success)':'var(--danger)'};">
        ${(m.qty||0)>0?'+':''}${m.qty||0}
      </td>
      <td style="font-size:12px;color:var(--text2);">${m.reason||'—'}</td>
    </tr>`).join('');
}

// ════════════════════════════════
// MODALS
// ════════════════════════════════
function injectModals() {
  if (document.getElementById('whAddModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <!-- Add Item Modal -->
    <div class="modal-overlay" id="whAddModal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title">📦 إضافة صنف للمستودع</div>
          <button class="modal-close" onclick="closeModal('whAddModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">اسم الصنف *</label>
              <input type="text" class="form-control" id="wi-name" placeholder="iPhone 15 / كابل شحن...">
            </div>
            <div class="form-group">
              <label class="form-label">الفئة</label>
              <select class="form-control" id="wi-cat">
                <option value="أجهزة">📱 أجهزة</option>
                <option value="ملحقات">🎧 ملحقات</option>
                <option value="قطع غيار">🔩 قطع غيار</option>
                <option value="أخرى">📦 أخرى</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">الكمية الحالية</label>
              <input type="number" class="form-control" id="wi-stock" placeholder="0" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">الحد الأدنى للتنبيه</label>
              <input type="number" class="form-control" id="wi-minstock" placeholder="5" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">سعر الشراء (د.أ)</label>
              <input type="number" class="form-control" id="wi-cost" placeholder="0.00" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">سعر البيع (د.أ)</label>
              <input type="number" class="form-control" id="wi-sell" placeholder="0.00" step="0.01">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">🔌 الباركود</label>
              <input type="text" class="form-control" id="wi-barcode"
                     placeholder="امسح أو اكتب"
                     style="font-family:'JetBrains Mono',monospace;">
            </div>
            <div class="form-group">
              <label class="form-label">رمز SKU</label>
              <input type="text" class="form-control" id="wi-sku"
                     placeholder="اختياري"
                     style="font-family:'JetBrains Mono',monospace;">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">الأيقونة</label>
              <input type="text" class="form-control" id="wi-emoji" placeholder="📦" maxlength="2">
            </div>
          </div>
          <div id="wi-alert"></div>
          <div class="modal-footer" style="padding:0;margin-top:16px;">
            <button class="btn btn-ghost" onclick="closeModal('whAddModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="window._wh.saveItem()">حفظ الصنف ✓</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Barcode assign modal -->
    <div class="modal-overlay" id="whBarcodeModal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">🔌 تعيين باركود</div>
          <button class="modal-close" onclick="closeModal('whBarcodeModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">امسح الباركود أو اكتبه</label>
            <input type="text" class="form-control" id="wb-barcode"
                   placeholder="امسح بجهاز الـ Scanner أو اكتب يدوياً"
                   style="font-family:'JetBrains Mono',monospace;font-size:18px;text-align:center;letter-spacing:2px;"
                   autofocus>
          </div>
          <input type="hidden" id="wb-item-id">
          <div id="wb-alert"></div>
          <div class="modal-footer" style="padding:0;margin-top:16px;">
            <button class="btn btn-ghost" onclick="closeModal('whBarcodeModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="window._wh.saveBarcode()">حفظ الباركود ✓</button>
          </div>
        </div>
      </div>
    </div>
  `);

  ['whAddModal','whBarcodeModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) closeModal(id);
    });
  });
}

// ════════════════════════════════
// ACTIONS
// ════════════════════════════════
window._wh = {

  filter: debounce(() => {
    const search  = document.getElementById('whSearchInput')?.value || '';
    const cat     = document.getElementById('whCatFilter')?.value   || '';
    const statusF = document.getElementById('whStatusFilter')?.value|| '';
    const tbody   = document.getElementById('whTbody');
    if (tbody) tbody.innerHTML = buildWhTable(search, cat, statusF);
  }, 250),

  quickSet(id) {
    const sel = document.getElementById('wh-select-item');
    if (sel) sel.value = id;
    document.getElementById('wh-qty-input')?.focus();
    window.scrollTo({ top: document.getElementById('wh-select-item')?.offsetTop - 100, behavior:'smooth' });
  },

  openAdd() { openModal('whAddModal'); },

  async saveItem() {
    const name     = document.getElementById('wi-name')?.value.trim();
    const cat      = document.getElementById('wi-cat')?.value || 'أخرى';
    const stock    = parseInt(document.getElementById('wi-stock')?.value)    || 0;
    const minStock = parseInt(document.getElementById('wi-minstock')?.value) || 5;
    const cost     = parseFloat(document.getElementById('wi-cost')?.value)   || 0;
    const sell     = parseFloat(document.getElementById('wi-sell')?.value)   || 0;
    const barcode  = document.getElementById('wi-barcode')?.value.trim()     || '';
    const sku      = document.getElementById('wi-sku')?.value.trim()         || '';
    const emoji    = document.getElementById('wi-emoji')?.value.trim()       || '📦';
    const al       = document.getElementById('wi-alert');

    if (!name) { al.innerHTML='<div class="alert alert-danger">❌ اسم الصنف مطلوب</div>'; return; }

    try {
      await addDoc(collection(db, COLLECTIONS.WAREHOUSE), {
        shopId: shopId(), name, cat, emoji, stock, minStock,
        costPrice: cost, sellPrice: sell,
        ...(barcode ? { barcode } : {}),
        ...(sku     ? { sku }     : {}),
        updated: today(), date: today(),
      });
      // Sync to products if has sell price
      if (sell > 0) {
        await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
          shopId: shopId(), name, cat, emoji,
          price: sell, stock,
          ...(barcode ? { barcode } : {}),
          date: today(),
        });
      }
      // Movement log
      if (stock > 0) {
        await addDoc(collection(db, COLLECTIONS.WH_MOVEMENTS), {
          shopId: shopId(), item: name,
          type: 'إضافة', qty: stock,
          reason: 'إضافة صنف جديد', date: today(),
        });
      }
      closeModal('whAddModal');
      ['wi-name','wi-stock','wi-minstock','wi-cost','wi-sell','wi-barcode','wi-sku','wi-emoji']
        .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      toast(`✅ تم إضافة "${name}"`);
    } catch(err) { al.innerHTML=`<div class="alert alert-danger">❌ ${err.message}</div>`; }
  },

  openBarcode(id) {
    document.getElementById('wb-item-id').value = id;
    document.getElementById('wb-barcode').value = '';
    openModal('whBarcodeModal');
    setTimeout(() => document.getElementById('wb-barcode')?.focus(), 300);
  },

  async saveBarcode() {
    const id      = document.getElementById('wb-item-id').value;
    const barcode = document.getElementById('wb-barcode')?.value.trim();
    const al      = document.getElementById('wb-alert');
    if (!barcode) { al.innerHTML='<div class="alert alert-danger">❌ أدخل الباركود</div>'; return; }
    // Check duplicate
    if (state.warehouse.find(w => w.barcode === barcode && w._id !== id)) {
      al.innerHTML='<div class="alert alert-warning">⚠️ الباركود مستخدم لصنف آخر</div>'; return;
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.WAREHOUSE, id), { barcode });
      // Sync to products
      const prod = state.products.find(p => {
        const wItem = state.warehouse.find(w => w._id === id);
        return p.name === wItem?.name;
      });
      if (prod) await updateDoc(doc(db, COLLECTIONS.PRODUCTS, prod._id), { barcode });
      closeModal('whBarcodeModal');
      toast('✅ تم تعيين الباركود');
    } catch(err) { al.innerHTML=`<div class="alert alert-danger">❌ ${err.message}</div>`; }
  },

  async applyAdjust() {
    const id     = document.getElementById('wh-select-item')?.value;
    const op     = document.getElementById('wh-op')?.value;
    const qty    = parseInt(document.getElementById('wh-qty-input')?.value) || 0;
    const reason = document.getElementById('wh-reason')?.value.trim() || 'تعديل يدوي';

    if (!id)   { toast('اختر صنفاً أولاً', 'warning'); return; }
    if (qty<=0){ toast('أدخل كمية أكبر من صفر', 'warning'); return; }

    const item = state.warehouse.find(i => i._id === id);
    if (!item) return;

    let delta = 0; let movType = 'تعديل';
    if      (op === 'add')       { delta = qty;              movType = 'إضافة'; }
    else if (op === 'remove')    { delta = -qty;             movType = 'خصم';   }
    else if (op === 'set')       { delta = qty-(item.stock||0); movType = 'تعيين'; }
    else if (op === 'threshold') {
      await updateDoc(doc(db, COLLECTIONS.WAREHOUSE, id), { minStock: qty });
      toast(`✅ تم تحديث الحد الأدنى إلى ${qty}`);
      document.getElementById('wh-qty-input').value = '';
      return;
    }

    const newStock = (item.stock||0) + delta;
    if (newStock < 0) { toast('لا يمكن خصم أكثر من المتوفر', 'danger'); return; }

    try {
      await updateDoc(doc(db, COLLECTIONS.WAREHOUSE, id), {
        stock:   newStock,
        updated: today(),
      });
      // Sync products
      const prod = state.products.find(p => p.name === item.name);
      if (prod) await updateDoc(doc(db, COLLECTIONS.PRODUCTS, prod._id), { stock: newStock });
      // Movement log
      await addDoc(collection(db, COLLECTIONS.WH_MOVEMENTS), {
        shopId: shopId(), item: item.name,
        type: movType, qty: delta,
        reason, date: today(),
      });
      document.getElementById('wh-qty-input').value = '';
      document.getElementById('wh-reason').value    = '';
      toast(`✅ تم تحديث مخزون "${item.name}" — الجديد: ${newStock}`);
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  },

  async deleteItem(id, name) {
    if (!await confirm2(`حذف "${name}" من المستودع نهائياً؟`)) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.WAREHOUSE, id));
      toast(`تم حذف "${name}"`);
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  },
};
