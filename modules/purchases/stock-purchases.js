// modules/purchases/stock-purchases.js
import { db, COLLECTIONS } from '../../src/js/firebase.js';
import { state, shopId }   from '../../src/js/state.js';
import { collection, addDoc, doc, deleteDoc, updateDoc, increment }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { currency, today, toast, confirm2, payBadge, emptyState }
  from '../../src/js/utils.js';

export function register(reg) {
  reg('stock-purchases', {
    label: 'مشتريات بضاعة', icon: '📦',
    group: 'المشتريات والمخزون',
    render,
  });
}

function render() {
  const sp     = state.stockPurchases || [];
  const total  = sp.reduce((s,x) => s+(x.cost||0)*(x.qty||0), 0);
  const units  = sp.reduce((s,x) => s+(x.qty||0), 0);
  const profit = sp.reduce((s,x) => s+((x.sell||0)-(x.cost||0))*(x.qty||0), 0);

  return `
    <div class="page-header">
      <div class="page-title">📦 مشتريات البضاعة</div>
      <div class="page-subtitle">تسجيل شراء الأجهزة والملحقات</div>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="stat-card red">   <div class="stat-icon">💸</div><div class="stat-num">${total.toFixed(0)}</div>  <div class="stat-label">تكلفة كلية د.أ</div></div>
      <div class="stat-card blue">  <div class="stat-icon">📦</div><div class="stat-num">${units}</div>            <div class="stat-label">وحدة مشتراة</div></div>
      <div class="stat-card green"> <div class="stat-icon">📈</div><div class="stat-num">${profit.toFixed(0)}</div><div class="stat-label">ربح متوقع د.أ</div></div>
      <div class="stat-card purple"><div class="stat-icon">🧾</div><div class="stat-num">${sp.length}</div>         <div class="stat-label">سجل مشترى</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:18px;align-items:start;">
      <div class="card">
        <div class="card-header"><div class="card-title">➕ تسجيل مشترى</div></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">اسم المنتج *</label>
            <input type="text" class="form-control" id="sp-name" placeholder="iPhone 15 / كابل..."></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">الفئة</label>
              <select class="form-control" id="sp-cat">
                <option value="أجهزة">📱 أجهزة</option><option value="ملحقات">🎧 ملحقات</option>
                <option value="قطع غيار">🔩 قطع غيار</option><option value="أخرى">📦 أخرى</option>
              </select></div>
            <div class="form-group"><label class="form-label">الكمية *</label>
              <input type="number" class="form-control" id="sp-qty" placeholder="1" min="1"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">سعر الشراء (د.أ) *</label>
              <input type="number" class="form-control" id="sp-cost" placeholder="0.00" step="0.01"></div>
            <div class="form-group"><label class="form-label">سعر البيع (د.أ)</label>
              <input type="number" class="form-control" id="sp-sell" placeholder="0.00" step="0.01"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">المورد</label>
              <input type="text" class="form-control" id="sp-supplier" placeholder="اسم المورد"></div>
            <div class="form-group"><label class="form-label">طريقة الدفع</label>
              <select class="form-control" id="sp-pay">
                <option value="كاش">💵 كاش</option><option value="آجل">📅 آجل</option>
                <option value="شبكة">💳 شبكة</option>
              </select></div>
          </div>
          <div class="form-group"><label class="form-label">ملاحظات</label>
            <input type="text" class="form-control" id="sp-notes" placeholder="اختياري..."></div>
          <div id="sp-alert"></div>
          <button class="btn btn-primary btn-block" onclick="window._sp.save()">تسجيل ✓</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 سجل المشتريات</div>
          <select class="form-control" id="sp-filter-cat" onchange="window._sp.filter()"
                  style="width:auto;min-width:120px;font-size:12px;padding:6px 10px;">
            <option value="">كل الفئات</option>
            <option>أجهزة</option><option>ملحقات</option><option>قطع غيار</option><option>أخرى</option>
          </select>
        </div>
        <div class="table-wrap table-card-mode">
          <table>
            <thead><tr><th>المنتج</th><th>ك</th><th>الشراء</th><th>البيع</th><th>المورد</th><th>الدفع</th><th>التاريخ</th><th></th></tr></thead>
            <tbody id="spTbody">${buildTable()}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function buildTable(catF='') {
  let rows = state.stockPurchases || [];
  if (catF) rows = rows.filter(x => x.cat === catF);
  if (!rows.length) return `<tr><td colspan="8">${emptyState('📦','لا توجد مشتريات بعد')}</td></tr>`;
  return rows.map(x => `
    <tr>
      <td data-label="المنتج"><b>${x.name}</b> <span class="tag">${x.cat||''}</span></td>
      <td data-label="الكمية" class="mono">${x.qty||0}</td>
      <td data-label="الشراء" class="mono" style="color:var(--danger);">${currency(x.cost||0)}</td>
      <td data-label="البيع"  class="mono" style="color:var(--success);">${x.sell?currency(x.sell):'—'}</td>
      <td data-label="المورد">${x.supplier||'—'}</td>
      <td data-label="الدفع">${payBadge(x.payment||'')}</td>
      <td data-label="التاريخ" style="font-size:12px;color:var(--text2);">${x.date||'—'}</td>
      <td class="no-label">
        <button onclick="window._sp.del('${x._id}','${x.name}')"
          style="background:rgba(255,71,87,0.1);color:var(--danger);border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">🗑</button>
      </td>
    </tr>`).join('');
}

window._sp = {
  filter() {
    const f = document.getElementById('sp-filter-cat')?.value||'';
    const t = document.getElementById('spTbody');
    if (t) t.innerHTML = buildTable(f);
  },

  async save() {
    const name     = document.getElementById('sp-name')?.value.trim();
    const cat      = document.getElementById('sp-cat')?.value||'أخرى';
    const qty      = parseInt(document.getElementById('sp-qty')?.value)||0;
    const cost     = parseFloat(document.getElementById('sp-cost')?.value)||0;
    const sell     = parseFloat(document.getElementById('sp-sell')?.value)||0;
    const supplier = document.getElementById('sp-supplier')?.value.trim()||'—';
    const payment  = document.getElementById('sp-pay')?.value||'كاش';
    const notes    = document.getElementById('sp-notes')?.value.trim()||'';
    const al       = document.getElementById('sp-alert');

    if (!name||qty<=0||cost<=0) {
      al.innerHTML='<div class="alert alert-danger">❌ اسم المنتج والكمية والتكلفة مطلوبة</div>'; return;
    }

    try {
      await addDoc(collection(db, COLLECTIONS.STOCK_PURCHASES), {
        shopId:shopId(), name, cat, qty, cost, sell, supplier, payment, notes, date:today(),
      });

      const emoji = cat==='أجهزة'?'📱':cat==='ملحقات'?'🎧':'📦';
      const existing = state.warehouse.find(w => w.name?.toLowerCase()===name.toLowerCase());
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.WAREHOUSE, existing._id), {
          stock: increment(qty), costPrice: cost,
          ...(sell?{sellPrice:sell}:{}), updated: today(),
        });
        const prod = state.products.find(p => p.name?.toLowerCase()===name.toLowerCase());
        if (prod) await updateDoc(doc(db, COLLECTIONS.PRODUCTS, prod._id), { stock: increment(qty) });
      } else {
        await addDoc(collection(db, COLLECTIONS.WAREHOUSE), {
          shopId:shopId(), name, cat, emoji, stock:qty, minStock:5,
          costPrice:cost, sellPrice:sell||0, updated:today(), date:today(),
        });
        if (sell>0) await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
          shopId:shopId(), name, cat, emoji, price:sell, stock:qty, date:today(),
        });
      }

      await addDoc(collection(db, COLLECTIONS.WH_MOVEMENTS), {
        shopId:shopId(), item:name, type:'شراء', qty,
        reason:`مورد: ${supplier}`, date:today(),
      });

      al.innerHTML=`<div class="alert alert-success">✅ تم تسجيل "${name}" وتحديث المخزون</div>`;
      ['sp-name','sp-qty','sp-cost','sp-sell','sp-supplier','sp-notes']
        .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    } catch(err) {
      al.innerHTML=`<div class="alert alert-danger">❌ ${err.message}</div>`;
    }
  },

  async del(id, name) {
    if (!await confirm2(`حذف "${name}"؟`)) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.STOCK_PURCHASES, id));
      toast(`تم حذف "${name}"`);
    } catch(err) { toast('❌ '+err.message,'danger'); }
  },
};
