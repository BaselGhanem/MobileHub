// modules/purchases/other-purchases.js
import { db, COLLECTIONS } from '../../src/js/firebase.js';
import { state, shopId }   from '../../src/js/state.js';
import { collection, addDoc, doc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { currency, today, toast, confirm2, payBadge, emptyState }
  from '../../src/js/utils.js';

export function register(reg) {
  reg('other-purchases', {
    label: 'مشتريات أخرى', icon: '🏪',
    group: 'المشتريات والمخزون',
    render,
  });
}

const CATS = ['إيجار','فواتير','أدوات','تنظيف','قرطاسية','تسويق','أخرى'];

function render() {
  const op    = state.otherPurchases || [];
  const total = op.reduce((s,x) => s+(x.amount||0), 0);

  const catTotals = {};
  op.forEach(x => { catTotals[x.cat] = (catTotals[x.cat]||0)+(x.amount||0); });
  const top = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];

  return `
    <div class="page-header">
      <div class="page-title">🏪 مشتريات أخرى</div>
      <div class="page-subtitle">مصروفات وتكاليف تشغيل المحل</div>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="stat-card red">   <div class="stat-icon">💸</div><div class="stat-num">${total.toFixed(0)}</div><div class="stat-label">إجمالي مصروف د.أ</div></div>
      <div class="stat-card blue">  <div class="stat-icon">📋</div><div class="stat-num">${op.length}</div>         <div class="stat-label">سجل</div></div>
      <div class="stat-card orange"><div class="stat-icon">📌</div><div class="stat-num" style="font-size:16px;">${top?top[0]:'—'}</div><div class="stat-label">أعلى فئة</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:18px;align-items:start;">
      <div class="card">
        <div class="card-header"><div class="card-title">➕ تسجيل مصروف</div></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">الوصف *</label>
            <input type="text" class="form-control" id="op-desc" placeholder="إيجار / فاتورة كهرباء..."></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">الفئة</label>
              <select class="form-control" id="op-cat">
                ${CATS.map(c=>`<option>${c}</option>`).join('')}
              </select></div>
            <div class="form-group"><label class="form-label">المبلغ (د.أ) *</label>
              <input type="number" class="form-control" id="op-amount" placeholder="0.00" step="0.01"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">الجهة / المورد</label>
              <input type="text" class="form-control" id="op-vendor" placeholder="صاحب العقار..."></div>
            <div class="form-group"><label class="form-label">طريقة الدفع</label>
              <select class="form-control" id="op-pay">
                <option value="كاش">💵 كاش</option><option value="تحويل">🏦 تحويل</option>
                <option value="شبكة">💳 شبكة</option><option value="آجل">📅 آجل</option>
              </select></div>
          </div>
          <div class="form-group"><label class="form-label">ملاحظات</label>
            <input type="text" class="form-control" id="op-notes" placeholder="اختياري..."></div>
          <div id="op-alert"></div>
          <button class="btn btn-primary btn-block" onclick="window._op.save()">تسجيل ✓</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 سجل المصروفات</div>
          <select class="form-control" id="op-filter-cat" onchange="window._op.filter()"
                  style="width:auto;min-width:120px;font-size:12px;padding:6px 10px;">
            <option value="">كل الفئات</option>
            ${CATS.map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap table-card-mode">
          <table>
            <thead><tr><th>الوصف</th><th>الفئة</th><th>المبلغ</th><th>الجهة</th><th>الدفع</th><th>التاريخ</th><th></th></tr></thead>
            <tbody id="opTbody">${buildTable()}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function buildTable(catF='') {
  let rows = state.otherPurchases || [];
  if (catF) rows = rows.filter(x => x.cat===catF);
  if (!rows.length) return `<tr><td colspan="7">${emptyState('🏪','لا توجد مصروفات بعد')}</td></tr>`;
  return rows.map(x => `
    <tr>
      <td data-label="الوصف"><b>${x.desc||'—'}</b></td>
      <td data-label="الفئة"><span class="tag">${x.cat||'—'}</span></td>
      <td data-label="المبلغ" class="mono" style="color:var(--danger);">${currency(x.amount||0)}</td>
      <td data-label="الجهة">${x.vendor||'—'}</td>
      <td data-label="الدفع">${payBadge(x.payment||'')}</td>
      <td data-label="التاريخ" style="font-size:12px;color:var(--text2);">${x.date||'—'}</td>
      <td class="no-label">
        <button onclick="window._op.del('${x._id}','${x.desc}')"
          style="background:rgba(255,71,87,0.1);color:var(--danger);border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">🗑</button>
      </td>
    </tr>`).join('');
}

window._op = {
  filter() {
    const f = document.getElementById('op-filter-cat')?.value||'';
    const t = document.getElementById('opTbody');
    if (t) t.innerHTML = buildTable(f);
  },

  async save() {
    const desc    = document.getElementById('op-desc')?.value.trim();
    const cat     = document.getElementById('op-cat')?.value||'أخرى';
    const amount  = parseFloat(document.getElementById('op-amount')?.value)||0;
    const vendor  = document.getElementById('op-vendor')?.value.trim()||'—';
    const payment = document.getElementById('op-pay')?.value||'كاش';
    const notes   = document.getElementById('op-notes')?.value.trim()||'';
    const al      = document.getElementById('op-alert');

    if (!desc||amount<=0) {
      al.innerHTML='<div class="alert alert-danger">❌ الوصف والمبلغ مطلوبان</div>'; return;
    }
    try {
      await addDoc(collection(db, COLLECTIONS.OTHER_PURCHASES), {
        shopId:shopId(), desc, cat, amount, vendor, payment, notes, date:today(),
      });
      al.innerHTML=`<div class="alert alert-success">✅ تم تسجيل المصروف</div>`;
      ['op-desc','op-amount','op-vendor','op-notes']
        .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    } catch(err) {
      al.innerHTML=`<div class="alert alert-danger">❌ ${err.message}</div>`;
    }
  },

  async del(id, desc) {
    if (!await confirm2(`حذف "${desc}"؟`)) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.OTHER_PURCHASES, id));
      toast('تم الحذف');
    } catch(err) { toast('❌ '+err.message,'danger'); }
  },
};
