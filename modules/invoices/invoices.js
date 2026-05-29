// modules/invoices/invoices.js
// نظام الفواتير الرسمية + ربط JoFotara اختياري
import { db, COLLECTIONS }  from '../../src/js/firebase.js';
import { state, shopId }    from '../../src/js/state.js';
import { currentUser }      from '../../src/js/auth.js';
import { collection, addDoc, doc, updateDoc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { currency, today, toast, confirm2, openModal, closeModal, emptyState, payBadge }
  from '../../src/js/utils.js';

export function register(reg) {
  reg('invoices', {
    label: 'الفواتير الرسمية',
    icon:  '🧾',
    group: 'العمليات',
    render,
  });
}

// ── JoFotara API (Flick Network as middleware) ──
const JOFOTARA_STAGING = 'https://staging-api.flick.network/jo';
const JOFOTARA_PROD    = 'https://api.flick.network/jo';

async function sendToJoFotara(invoice, settings) {
  const baseUrl  = settings.jofotaraEnv === 'production' ? JOFOTARA_PROD : JOFOTARA_STAGING;
  const authKey  = settings.jofotaraApiKey || '';

  const payload = {
    supplier: {
      tin:                   settings.taxNumber,
      income_source_sequence: settings.incomeSequence || '1',
      name:                  settings.name,
      phone:                 settings.phone || '',
      city_code:             settings.cityCode || 'JO-AM',
    },
    invoice: {
      invoice_type:   invoice.invoiceType || 'cash',
      invoice_number: invoice.invoiceNumber,
      issue_date:     invoice.date,
      currency:       'JOD',
      lines:          invoice.items.map(i => ({
        description: i.name,
        quantity:    i.qty,
        unit_price:  i.price,
        tax_category: settings.taxCategory || 'Standard',
        tax_percent:  settings.taxRate || 0.16,
        discount:     0,
      })),
      totals: {
        subtotal:  invoice.subtotal,
        tax:       invoice.taxAmount,
        total:     invoice.total,
      },
    },
    buyer: invoice.buyerTin ? {
      tin:  invoice.buyerTin,
      name: invoice.buyerName || '',
    } : undefined,
  };

  const res = await fetch(`${baseUrl}/invoice/issue`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-flick-auth-key': authKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'JoFotara API error: ' + res.status);
  }
  return res.json();
}

// ── Invoice number generator ──
function genInvoiceNum(settings) {
  const prefix = settings.invoicePrefix || 'INV';
  const year   = new Date().getFullYear();
  const seq    = String((settings.invoiceSeq || 0) + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}

// ════════════════════════════════
// RENDER
// ════════════════════════════════
let activeTab = 'new';

function render() {
  injectModals();
  const s        = state.settings || {};
  const taxEnabled = !!s.taxEnabled;
  const invoices = state.invoices || [];

  return `
    <div class="page-header">
      <div class="page-title">🧾 الفواتير الرسمية</div>
      <div class="page-subtitle">إصدار فواتير + ربط JoFotara اختياري</div>
    </div>

    <!-- Tax status banner -->
    <div style="padding:12px 18px;border-radius:var(--radius-sm);margin-bottom:20px;
         background:${taxEnabled?'rgba(46,213,115,0.08)':'rgba(255,165,2,0.08)'};
         border:1px solid ${taxEnabled?'rgba(46,213,115,0.25)':'rgba(255,165,2,0.25)'};
         display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:20px;">${taxEnabled?'✅':'⚠️'}</span>
        <div>
          <div style="font-weight:700;font-size:13px;color:${taxEnabled?'var(--success)':'var(--warning)'};">
            ${taxEnabled?'الفوترة الإلكترونية مفعّلة — JoFotara':'الفوترة الإلكترونية غير مفعّلة'}
          </div>
          <div style="font-size:11px;color:var(--text2);">
            ${taxEnabled
              ? 'الفواتير تُرسل لنظام الضريبة تلقائياً عند الإصدار'
              : 'الفواتير تُحفظ محلياً فقط — لا ترسل للضريبة'}
          </div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="_router.go('settings')">⚙️ إعدادات الضريبة</button>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:4px;background:var(--bg);border-radius:10px;padding:4px;width:fit-content;margin-bottom:20px;">
      <button class="pos-tab ${activeTab==='new'?'pos-tab-active':''}"
              onclick="window._inv.switchTab('new')">➕ فاتورة جديدة</button>
      <button class="pos-tab ${activeTab==='list'?'pos-tab-active':''}"
              onclick="window._inv.switchTab('list')">📋 سجل الفواتير</button>
    </div>

    <!-- New invoice panel -->
    <div id="inv-new" style="${activeTab!=='new'?'display:none':''}">
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:start;">

        <!-- Invoice builder -->
        <div class="card">
          <div class="card-header"><div class="card-title">📝 بيانات الفاتورة</div></div>
          <div class="card-body">

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">اسم الزبون *</label>
                <input type="text" class="form-control" id="inv-customer" placeholder="محمد أحمد">
              </div>
              <div class="form-group">
                <label class="form-label">رقم الهاتف</label>
                <input type="tel" class="form-control" id="inv-phone" placeholder="07XXXXXXXX">
              </div>
            </div>

            ${taxEnabled ? `
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">الرقم الضريبي للزبون</label>
                <input type="text" class="form-control" id="inv-buyer-tin"
                       placeholder="اختياري — للفواتير B2B"
                       style="font-family:'JetBrains Mono',monospace;">
              </div>
              <div class="form-group">
                <label class="form-label">نوع الفاتورة</label>
                <select class="form-control" id="inv-type">
                  <option value="cash">نقدي / كاش</option>
                  <option value="receivable">آجل</option>
                </select>
              </div>
            </div>` : `
            <div class="form-group">
              <label class="form-label">طريقة الدفع</label>
              <select class="form-control" id="inv-type">
                <option value="cash">💵 كاش</option>
                <option value="receivable">📅 آجل</option>
                <option value="network">💳 شبكة</option>
              </select>
            </div>`}

            <!-- Items -->
            <div style="font-size:12px;font-weight:700;color:var(--text2);margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">
              البنود
            </div>
            <div id="inv-lines">
              ${buildInvLine(0)}
            </div>
            <button class="btn btn-ghost btn-sm" onclick="window._inv.addLine()" style="margin-top:8px;">
              + إضافة بند
            </button>

            <!-- Totals -->
            <div id="inv-totals" style="margin-top:16px;padding:14px;background:var(--bg);border-radius:var(--radius-sm);">
              ${buildTotals()}
            </div>

            <div class="form-group" style="margin-top:16px;">
              <label class="form-label">ملاحظات</label>
              <input type="text" class="form-control" id="inv-notes" placeholder="اختياري...">
            </div>

            <div id="inv-alert"></div>

            <div style="display:flex;gap:10px;margin-top:16px;">
              <button class="btn btn-primary" style="flex:1;" onclick="window._inv.issue()">
                ${taxEnabled?'إصدار وإرسال للضريبة 🏛️':'إصدار الفاتورة 🧾'}
              </button>
              <button class="btn btn-ghost" onclick="window._inv.preview()">معاينة 👁</button>
            </div>
          </div>
        </div>

        <!-- Quick products -->
        <div class="card">
          <div class="card-header"><div class="card-title">📦 منتجات سريعة</div></div>
          <div class="card-body" style="padding:12px;">
            <input class="search-input" id="inv-prod-search"
                   placeholder="🔍 بحث عن منتج..."
                   oninput="window._inv.filterProds()"
                   style="width:100%;margin-bottom:10px;">
            <div id="inv-prod-list" style="max-height:400px;overflow-y:auto;">
              ${buildProdList()}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoices list panel -->
    <div id="inv-list" style="${activeTab!=='list'?'display:none':''}">
      ${buildInvoiceList()}
    </div>
  `;
}

// ── Line builder ──
let lineCount = 1;
function buildInvLine(idx) {
  return `
    <div class="inv-line" id="inv-line-${idx}"
         style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;">
      <input type="text"   class="form-control" placeholder="الوصف"   data-field="desc"  oninput="window._inv.calcTotals()" style="font-size:13px;padding:8px 10px;">
      <input type="number" class="form-control" placeholder="الكمية"   data-field="qty"   oninput="window._inv.calcTotals()" style="font-size:13px;padding:8px 10px;" min="1" value="1">
      <input type="number" class="form-control" placeholder="السعر"    data-field="price" oninput="window._inv.calcTotals()" style="font-size:13px;padding:8px 10px;" step="0.01">
      <button onclick="window._inv.removeLine(${idx})"
              style="background:rgba(255,71,87,0.1);color:var(--danger);border:none;border-radius:6px;padding:8px 10px;cursor:pointer;">✕</button>
    </div>`;
}

function buildTotals() {
  const lines    = getLines();
  const subtotal = lines.reduce((s,l) => s+(l.qty*l.price), 0);
  const s        = state.settings || {};
  const taxEnabled = !!s.taxEnabled;
  const taxRate  = taxEnabled ? (parseFloat(s.taxRate)||16)/100 : 0;
  const taxAmt   = subtotal * taxRate;
  const total    = subtotal + taxAmt;

  return `
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;">
      <span style="color:var(--text2);">المجموع الجزئي</span>
      <span class="mono">${currency(subtotal)}</span>
    </div>
    ${taxEnabled ? `
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;">
      <span style="color:var(--text2);">ضريبة المبيعات (${s.taxRate||16}%)</span>
      <span class="mono" style="color:var(--warning);">${currency(taxAmt)}</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:900;border-top:1px solid var(--border);margin-top:4px;">
      <span>الإجمالي</span>
      <span class="mono" style="color:var(--accent3);">${currency(total)}</span>
    </div>`;
}

function buildProdList(search = '') {
  let prods = state.products || [];
  if (search) prods = prods.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  if (!prods.length) return `<div style="text-align:center;color:var(--text2);padding:20px;font-size:13px;">لا توجد منتجات</div>`;
  return prods.map(p => `
    <div onclick="window._inv.addProduct('${p._id}')"
         style="display:flex;justify-content:space-between;align-items:center;
                padding:10px 12px;background:var(--bg);border-radius:8px;margin-bottom:6px;
                cursor:pointer;border:1px solid transparent;transition:all 0.2s;"
         onmouseover="this.style.borderColor='var(--accent)'"
         onmouseout="this.style.borderColor='transparent'">
      <div>
        <div style="font-weight:700;font-size:13px;">${p.emoji||'📦'} ${p.name}</div>
        <div style="font-size:11px;color:var(--text2);">${p.cat||''} · مخزون: ${p.stock||0}</div>
      </div>
      <span class="mono" style="color:var(--accent3);font-weight:700;">${currency(p.price)}</span>
    </div>`).join('');
}

function buildInvoiceList() {
  const invs = state.invoicesList || [];
  const totalRev = invs.reduce((s,i) => s+(i.total||0), 0);
  const taxTotal = invs.filter(i=>i.sentToJoFotara).reduce((s,i) => s+(i.taxAmount||0), 0);
  const pending  = invs.filter(i=>!i.sentToJoFotara && state.settings?.taxEnabled).length;

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px;">
      <div class="stat-card green"> <div class="stat-icon">💰</div><div class="stat-num">${totalRev.toFixed(0)}</div><div class="stat-label">إجمالي الفواتير د.أ</div></div>
      <div class="stat-card blue">  <div class="stat-icon">🧾</div><div class="stat-num">${invs.length}</div>          <div class="stat-label">عدد الفواتير</div></div>
      <div class="stat-card purple"><div class="stat-icon">🏛️</div><div class="stat-num">${taxTotal.toFixed(0)}</div>  <div class="stat-label">ضريبة مُرسلة د.أ</div></div>
      <div class="stat-card orange"><div class="stat-icon">⏳</div><div class="stat-num">${pending}</div>             <div class="stat-label">معلقة الإرسال</div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 سجل الفواتير</div>
        <div style="display:flex;gap:8px;">
          <select class="form-control" id="inv-filter-status" onchange="window._inv.filterInv()"
                  style="width:auto;font-size:12px;padding:6px 10px;">
            <option value="">كل الفواتير</option>
            <option value="sent">✅ مُرسلة للضريبة</option>
            <option value="local">💾 محلية فقط</option>
          </select>
        </div>
      </div>
      <div class="table-wrap table-card-mode">
        <table>
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>الزبون</th>
              <th>المبلغ</th>
              <th>الضريبة</th>
              <th>الإجمالي</th>
              <th>الدفع</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="inv-tbody">
            ${buildInvRows(invs)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function buildInvRows(invs) {
  if (!invs.length) return `<tr><td colspan="9">${emptyState('🧾','لا توجد فواتير بعد')}</td></tr>`;
  return invs.map(inv => {
    const taxSent = inv.sentToJoFotara;
    return `
      <tr>
        <td data-label="رقم الفاتورة"><span class="device-id">${inv.invoiceNumber||inv._id.slice(-8)}</span></td>
        <td data-label="الزبون">${inv.customerName||'—'}</td>
        <td data-label="المبلغ" class="mono">${currency(inv.subtotal||0)}</td>
        <td data-label="الضريبة" class="mono" style="color:var(--warning);">${inv.taxAmount?currency(inv.taxAmount):'—'}</td>
        <td data-label="الإجمالي" class="mono" style="font-weight:700;color:var(--accent3);">${currency(inv.total||0)}</td>
        <td data-label="الدفع">${payBadge(inv.paymentMethod||'كاش')}</td>
        <td data-label="الحالة">
          ${taxSent
            ? '<span class="badge badge-ready">✅ مُرسلة JoFotara</span>'
            : '<span class="badge badge-delivered">💾 محلية</span>'}
        </td>
        <td data-label="التاريخ" style="font-size:12px;color:var(--text2);">${inv.date||'—'}</td>
        <td class="no-label">
          <div style="display:flex;gap:5px;">
            <button class="btn btn-info btn-xs" onclick="window._inv.viewInv('${inv._id}')">عرض</button>
            ${!taxSent && state.settings?.taxEnabled
              ? `<button class="btn btn-warning btn-xs" onclick="window._inv.resend('${inv._id}')">إرسال</button>`
              : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Inject modals ──
function injectModals() {
  if (document.getElementById('invPreviewModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="invPreviewModal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title">🧾 معاينة الفاتورة</div>
          <button class="modal-close" onclick="closeModal('invPreviewModal')">✕</button>
        </div>
        <div class="modal-body" id="invPreviewBody"></div>
      </div>
    </div>
    <div class="modal-overlay" id="invViewModal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title" id="invViewTitle">تفاصيل الفاتورة</div>
          <button class="modal-close" onclick="closeModal('invViewModal')">✕</button>
        </div>
        <div class="modal-body" id="invViewBody"></div>
      </div>
    </div>
  `);
  ['invPreviewModal','invViewModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) closeModal(id);
    });
  });
}

// ── Helpers ──
function getLines() {
  return [...document.querySelectorAll('.inv-line')].map(row => ({
    desc:  row.querySelector('[data-field="desc"]')?.value.trim()  || '',
    qty:   parseFloat(row.querySelector('[data-field="qty"]')?.value)   || 0,
    price: parseFloat(row.querySelector('[data-field="price"]')?.value) || 0,
  })).filter(l => l.desc && l.qty > 0 && l.price > 0);
}

function buildInvoiceHTML(inv, settings) {
  const taxEnabled = !!settings.taxEnabled;
  const linesHtml = (inv.items||[]).map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;">${i.price.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;font-weight:700;">${(i.qty*i.price).toFixed(2)}</td>
    </tr>`).join('');

  return `
    <div id="invoice-print" style="font-family:'Cairo',sans-serif;direction:rtl;max-width:600px;margin:0 auto;padding:20px;">
      <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #333;">
        <h2 style="font-size:22px;font-weight:900;margin:0;">${settings.name||'Mobile Hub'}</h2>
        ${settings.phone?`<div style="font-size:13px;color:#666;margin-top:4px;">📞 ${settings.phone}</div>`:''}
        ${settings.address?`<div style="font-size:13px;color:#666;">${settings.address}</div>`:''}
        ${taxEnabled&&settings.taxNumber?`<div style="font-size:12px;color:#666;margin-top:4px;">الرقم الضريبي: ${settings.taxNumber}</div>`:''}
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
        <div>
          <div style="font-size:11px;color:#999;">رقم الفاتورة</div>
          <div style="font-weight:700;font-size:15px;">${inv.invoiceNumber}</div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:11px;color:#999;">التاريخ</div>
          <div style="font-weight:700;">${inv.date}</div>
        </div>
      </div>
      <div style="margin-bottom:16px;padding:10px 12px;background:#f5f5f5;border-radius:6px;">
        <div style="font-size:11px;color:#999;">الزبون</div>
        <div style="font-weight:700;">${inv.customerName||'—'}</div>
        ${inv.customerPhone?`<div style="font-size:12px;color:#666;">${inv.customerPhone}</div>`:''}
        ${inv.buyerTin?`<div style="font-size:12px;color:#666;">الرقم الضريبي: ${inv.buyerTin}</div>`:''}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#333;color:#fff;">
            <th style="padding:8px 12px;text-align:right;">الوصف</th>
            <th style="padding:8px 12px;text-align:center;">الكمية</th>
            <th style="padding:8px 12px;text-align:left;">السعر</th>
            <th style="padding:8px 12px;text-align:left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>
      <div style="text-align:left;padding:12px;background:#f9f9f9;border-radius:6px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
          <span>المجموع الجزئي:</span><span>${inv.subtotal.toFixed(2)} د.أ</span>
        </div>
        ${taxEnabled?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#e67e22;">
          <span>ضريبة المبيعات (${settings.taxRate||16}%):</span><span>${inv.taxAmount.toFixed(2)} د.أ</span>
        </div>`:''}
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:900;border-top:2px solid #333;margin-top:4px;">
          <span>الإجمالي الكلي:</span><span>${inv.total.toFixed(2)} د.أ</span>
        </div>
      </div>
      ${taxEnabled&&inv.sentToJoFotara?`
      <div style="margin-top:16px;padding:10px;background:#e8f5e9;border-radius:6px;text-align:center;font-size:12px;color:#2e7d32;">
        ✅ فاتورة إلكترونية معتمدة — مُرسلة لنظام JoFotara<br>
        ${inv.jofotaraRef?`رقم المرجع: ${inv.jofotaraRef}`:''}
      </div>`:
      `<div style="margin-top:16px;text-align:center;font-size:11px;color:#999;">
        شكراً لتعاملكم معنا · ${settings.name||'Mobile Hub'}
      </div>`}
    </div>`;
}

// ════════════════════════════════
// ACTIONS
// ════════════════════════════════
window._inv = {
  switchTab(tab) {
    activeTab = tab;
    document.getElementById('inv-new').style.display  = tab==='new'  ? '' : 'none';
    document.getElementById('inv-list').style.display = tab==='list' ? '' : 'none';
    document.querySelectorAll('.pos-tab').forEach(b => {
      b.classList.toggle('pos-tab-active',
        (tab==='new'&&b.textContent.includes('جديدة')) ||
        (tab==='list'&&b.textContent.includes('سجل')));
    });
    if (tab === 'list') {
      document.getElementById('inv-list').innerHTML = buildInvoiceList();
    }
  },

  addLine() {
    const container = document.getElementById('inv-lines');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', buildInvLine(lineCount++));
  },

  removeLine(idx) {
    document.getElementById('inv-line-'+idx)?.remove();
    this.calcTotals();
  },

  calcTotals() {
    const el = document.getElementById('inv-totals');
    if (el) el.innerHTML = buildTotals();
  },

  filterProds() {
    const q  = document.getElementById('inv-prod-search')?.value || '';
    const el = document.getElementById('inv-prod-list');
    if (el) el.innerHTML = buildProdList(q);
  },

  addProduct(pid) {
    const p = state.products.find(x => x._id === pid);
    if (!p) return;
    const lines = document.getElementById('inv-lines');
    if (!lines) return;
    // Check if already in lines
    const rows = lines.querySelectorAll('.inv-line');
    for (const row of rows) {
      const desc = row.querySelector('[data-field="desc"]');
      if (desc?.value === p.name) {
        const qty = row.querySelector('[data-field="qty"]');
        if (qty) { qty.value = (parseFloat(qty.value)||0)+1; this.calcTotals(); return; }
      }
    }
    lines.insertAdjacentHTML('beforeend', buildInvLine(lineCount));
    const newRow = document.getElementById('inv-line-'+lineCount);
    if (newRow) {
      newRow.querySelector('[data-field="desc"]').value  = p.name;
      newRow.querySelector('[data-field="qty"]').value   = 1;
      newRow.querySelector('[data-field="price"]').value = p.price;
    }
    lineCount++;
    this.calcTotals();
  },

  preview() {
    const lines = getLines();
    if (!lines.length) { toast('أضف بنوداً أولاً', 'warning'); return; }
    const s         = state.settings||{};
    const taxRate   = s.taxEnabled ? (parseFloat(s.taxRate)||16)/100 : 0;
    const subtotal  = lines.reduce((sum,l)=>sum+l.qty*l.price, 0);
    const taxAmount = subtotal * taxRate;
    const inv = {
      invoiceNumber: genInvoiceNum(s),
      date:          today(),
      customerName:  document.getElementById('inv-customer')?.value.trim()||'—',
      customerPhone: document.getElementById('inv-phone')?.value.trim()||'',
      buyerTin:      document.getElementById('inv-buyer-tin')?.value.trim()||'',
      paymentMethod: document.getElementById('inv-type')?.value||'cash',
      items:         lines.map(l=>({name:l.desc,qty:l.qty,price:l.price})),
      subtotal, taxAmount, total: subtotal+taxAmount,
    };
    document.getElementById('invPreviewBody').innerHTML =
      buildInvoiceHTML(inv, s) +
      `<div class="modal-footer" style="padding:16px 0 0;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="closeModal('invPreviewModal')">إغلاق</button>
        <button class="btn btn-info"  onclick="window.print()">🖨️ طباعة</button>
        <button class="btn btn-primary" onclick="window._inv.issue();closeModal('invPreviewModal')">إصدار ✓</button>
      </div>`;
    openModal('invPreviewModal');
  },

  async issue() {
    const customer = document.getElementById('inv-customer')?.value.trim();
    if (!customer) { toast('اسم الزبون مطلوب', 'warning'); return; }
    const lines = getLines();
    if (!lines.length) { toast('أضف بنداً واحداً على الأقل', 'warning'); return; }

    const s         = state.settings||{};
    const taxEnabled= !!s.taxEnabled;
    const taxRate   = taxEnabled ? (parseFloat(s.taxRate)||16)/100 : 0;
    const subtotal  = lines.reduce((sum,l)=>sum+l.qty*l.price, 0);
    const taxAmount = subtotal * taxRate;
    const total     = subtotal + taxAmount;
    const invNum    = genInvoiceNum(s);
    const al        = document.getElementById('inv-alert');

    const invData = {
      shopId:        shopId(),
      invoiceNumber: invNum,
      customerName:  customer,
      customerPhone: document.getElementById('inv-phone')?.value.trim()||'',
      buyerTin:      document.getElementById('inv-buyer-tin')?.value.trim()||'',
      paymentMethod: document.getElementById('inv-type')?.value||'cash',
      items:         lines.map(l=>({name:l.desc,qty:l.qty,price:l.price})),
      subtotal, taxAmount, total,
      notes:         document.getElementById('inv-notes')?.value.trim()||'',
      date:          today(),
      createdBy:     currentUser?.uid||'',
      sentToJoFotara: false,
      jofotaraRef:   '',
    };

    try {
      // Save to Firestore
      const ref = await addDoc(collection(db, 'invoices'), invData);

      // Increment invoice sequence
      await updateDoc(doc(db, COLLECTIONS.SETTINGS, shopId()), {
        invoiceSeq: (s.invoiceSeq||0) + 1,
      });

      // Send to JoFotara if enabled
      if (taxEnabled && s.jofotaraApiKey) {
        al.innerHTML = '<div class="alert alert-info">🔄 جاري الإرسال لنظام JoFotara...</div>';
        try {
          const jRes = await sendToJoFotara({ ...invData, invoiceNumber: invNum }, s);
          await updateDoc(doc(db, 'invoices', ref.id), {
            sentToJoFotara: true,
            jofotaraRef:    jRes.reference_number || jRes.id || '',
            jofotaraStatus: 'accepted',
          });
          toast('✅ تم إصدار الفاتورة وإرسالها لـ JoFotara');
          al.innerHTML = '<div class="alert alert-success">✅ فاتورة ' + invNum + ' مُرسلة لنظام الضريبة</div>';
        } catch (jErr) {
          // Invoice saved locally even if JoFotara fails
          await updateDoc(doc(db, 'invoices', ref.id), {
            sentToJoFotara: false,
            jofotaraError:  jErr.message,
          });
          al.innerHTML = `<div class="alert alert-warning">⚠️ تم حفظ الفاتورة محلياً — فشل الإرسال: ${jErr.message}</div>`;
        }
      } else {
        toast('✅ تم إصدار الفاتورة ' + invNum);
        al.innerHTML = '<div class="alert alert-success">✅ تم إصدار الفاتورة ' + invNum + '</div>';
      }

      // Clear form
      document.getElementById('inv-customer').value = '';
      document.getElementById('inv-phone').value    = '';
      document.getElementById('inv-notes').value    = '';
      if (document.getElementById('inv-buyer-tin')) document.getElementById('inv-buyer-tin').value = '';
      document.getElementById('inv-lines').innerHTML = buildInvLine(lineCount++);
      this.calcTotals();

    } catch(err) {
      al.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
    }
  },

  async resend(id) {
    const s = state.settings||{};
    if (!s.jofotaraApiKey) { toast('أدخل API Key من إعدادات JoFotara', 'warning'); return; }
    try {
      const ref   = doc(db, 'invoices', id);
      const snap  = await getDoc(ref);
      if (!snap.exists()) { toast('الفاتورة غير موجودة', 'danger'); return; }
      const inv   = { _id: id, ...snap.data() };
      toast('🔄 جاري الإرسال...', 'info');
      const jRes  = await sendToJoFotara(inv, s);
      await updateDoc(ref, {
        sentToJoFotara: true,
        jofotaraRef:    jRes.reference_number || jRes.id || '',
        jofotaraStatus: 'accepted',
      });
      toast('✅ تم الإرسال لـ JoFotara بنجاح');
      this.switchTab('list');
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  },

  async viewInv(id) {
    const inv = (state.invoicesList||[]).find(i => i._id===id);
    if (!inv) return;
    const s = state.settings||{};
    document.getElementById('invViewTitle').textContent = '🧾 ' + (inv.invoiceNumber||id);
    document.getElementById('invViewBody').innerHTML =
      buildInvoiceHTML(inv, s) +
      `<div style="padding:16px 0 0;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-ghost"  onclick="closeModal('invViewModal')">إغلاق</button>
        <button class="btn btn-info"   onclick="window.print()">🖨️ طباعة</button>
      </div>`;
    openModal('invViewModal');
  },

  filterInv() {
    const f    = document.getElementById('inv-filter-status')?.value||'';
    let invs   = state.invoicesList||[];
    if (f==='sent')  invs = invs.filter(i=>i.sentToJoFotara);
    if (f==='local') invs = invs.filter(i=>!i.sentToJoFotara);
    const t = document.getElementById('inv-tbody');
    if (t) t.innerHTML = buildInvRows(invs);
  },
};
