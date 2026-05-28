// modules/hr/hr.js
import { db, COLLECTIONS } from '../../src/js/firebase.js';
import { state, shopId, currentMonth, today } from '../../src/js/state.js';
import { collection, addDoc, doc, updateDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { currency, toast, confirm2, emptyState, empName }
  from '../../src/js/utils.js';

export function register(reg) {
  reg('hr', { label:'الموارد البشرية', icon:'👥', group:'الموارد البشرية', render });
}

let hrTab = 'salary';
const INS_EMP = 0.075, INS_EMPR = 0.1425;

// ════ RENDER ════
function render() {
  return `
    <div class="page-header">
      <div class="page-title">👥 الموارد البشرية</div>
      <div class="page-subtitle">الرواتب، الحضور، الضمان الاجتماعي</div>
    </div>
    <div style="display:flex;gap:4px;background:var(--bg);border-radius:10px;padding:4px;width:fit-content;margin-bottom:20px;">
      ${[['salary','💰 الرواتب'],['attendance','📅 الحضور'],['insurance','🏛️ الضمان']].map(([t,l])=>`
        <button class="pos-tab ${hrTab===t?'pos-tab-active':''}"
                onclick="window._hr.tab('${t}')">${l}</button>`).join('')}
    </div>
    <div id="hr-content">${renderTab()}</div>`;
}

function renderTab() {
  if (hrTab==='salary')     return salaryPanel();
  if (hrTab==='attendance') return attendancePanel();
  if (hrTab==='insurance')  return insurancePanel();
  return '';
}

// ════ SALARY ════
function salaryPanel() {
  const month = currentMonth();
  const emps  = state.employees||[];
  const adv   = state.advances||[];
  const recs  = state.salaryRecords||[];

  const totalSal   = emps.reduce((s,e)=>s+(e.salary||0),0);
  const totalAdv   = adv.filter(a=>a.month===month).reduce((s,a)=>s+(a.amount||0),0);
  const paidCount  = recs.filter(r=>r.month===month&&r.status==='مدفوع').length;

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="stat-card purple"><div class="stat-icon">👥</div><div class="stat-num">${emps.length}</div><div class="stat-label">الموظفون</div></div>
      <div class="stat-card red">   <div class="stat-icon">💸</div><div class="stat-num">${totalSal}</div><div class="stat-label">إجمالي الرواتب</div></div>
      <div class="stat-card orange"><div class="stat-icon">⏰</div><div class="stat-num">${totalAdv}</div><div class="stat-label">سلف الشهر د.أ</div></div>
      <div class="stat-card green"> <div class="stat-icon">✅</div><div class="stat-num">${paidCount}</div><div class="stat-label">رواتب صُرفت</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">💰 كشف رواتب ${month}</div>
          <button class="btn btn-success btn-sm" onclick="window._hr.payAll('${month}')">صرف الكل ✓</button>
        </div>
        <div class="table-wrap table-card-mode">
          <table>
            <thead><tr><th>الموظف</th><th>الراتب</th><th>الحضور</th><th>السلف</th><th>الصافي</th><th>الحالة</th><th></th></tr></thead>
            <tbody>${buildSalaryRows(month)}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">➕ تسجيل سلفة</div></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">الموظف</label>
            <select class="form-control" id="adv-emp">
              <option value="">— اختر —</option>
              ${emps.map(e=>`<option value="${e._id}">${e.name}</option>`).join('')}
            </select></div>
          <div class="form-group"><label class="form-label">المبلغ (د.أ)</label>
            <input type="number" class="form-control" id="adv-amount" placeholder="0"></div>
          <div class="form-group"><label class="form-label">السبب</label>
            <input type="text" class="form-control" id="adv-reason" placeholder="ظرف طارئ..."></div>
          <div id="adv-alert"></div>
          <button class="btn btn-warning btn-block" onclick="window._hr.addAdv('${month}')">تسجيل سلفة ✓</button>
          <div style="margin-top:16px;font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;">📋 سجل السلف</div>
          ${(adv.filter(a=>a.month===month)||[]).map(a=>`
            <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
              <div><div style="font-weight:700;font-size:13px;">${empName(state.employees,a.empId)}</div>
                   <div style="font-size:11px;color:var(--text2);">${a.reason||''} · ${a.date||''}</div></div>
              <span class="mono" style="color:var(--danger);">-${currency(a.amount)}</span>
            </div>`).join('') || '<p style="color:var(--text2);font-size:13px;text-align:center;padding:12px;">لا سلف هذا الشهر</p>'}
        </div>
      </div>
    </div>`;
}

function buildSalaryRows(month) {
  const emps = state.employees||[];
  if (!emps.length) return `<tr><td colspan="7">${emptyState('👥','لا يوجد موظفون')}</td></tr>`;
  return emps.map(emp => {
    const rec    = state.salaryRecords.find(r=>r.empId===emp._id&&r.month===month);
    const empAdv = state.advances.filter(a=>a.empId===emp._id&&a.month===month).reduce((s,a)=>s+(a.amount||0),0);
    const days   = rec?.daysPresent ?? 26;
    const total  = rec?.totalDays   ?? 27;
    const earned = ((emp.salary||0)/total*days).toFixed(2);
    const net    = (parseFloat(earned)-empAdv).toFixed(2);
    const paid   = rec?.status==='مدفوع';
    return `<tr>
      <td data-label="الموظف"><div style="display:flex;align-items:center;gap:8px;">
        <div class="avatar avatar-sm">${emp.avatar||'؟'}</div><b>${emp.name}</b></div></td>
      <td data-label="الراتب"  class="mono">${emp.salary||0}</td>
      <td data-label="الحضور"  class="mono" style="color:${days<total?'var(--warning)':'var(--success)'};">${days}/${total}</td>
      <td data-label="السلف"   class="mono" style="color:var(--danger);">${empAdv?'-'+empAdv:'—'}</td>
      <td data-label="الصافي"  class="mono" style="font-weight:900;color:var(--accent3);">${net} د.أ</td>
      <td data-label="الحالة"><span class="badge ${paid?'badge-ready':'badge-pending'}">${paid?'✅ مدفوع':'⏳ معلق'}</span></td>
      <td class="no-label">
        ${paid
          ? `<span style="font-size:11px;color:var(--text2);">${rec?.paidDate||''}</span>`
          : `<button class="btn btn-success btn-xs" onclick="window._hr.pay('${emp._id}','${month}','${net}')">صرف</button>`}
      </td>
    </tr>`;
  }).join('');
}

// ════ ATTENDANCE ════
function attendancePanel() {
  const emps = state.employees||[];
  const att  = state.attendance||[];
  const present = att.filter(a=>a.status==='حاضر').length;
  const absent  = att.filter(a=>a.status==='غائب').length;
  const leave   = att.filter(a=>a.status==='إجازة').length;
  const late    = att.filter(a=>a.status==='تأخر').length;

  return `
    <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:18px;align-items:start;">
      <div class="card">
        <div class="card-header"><div class="card-title">⏱️ تسجيل حضور</div></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">الموظف</label>
            <select class="form-control" id="att-emp">
              <option value="">— اختر —</option>
              ${emps.map(e=>`<option value="${e._id}">${e.name}</option>`).join('')}
            </select></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">التاريخ</label>
              <input type="date" class="form-control" id="att-date" value="${today()}"></div>
            <div class="form-group"><label class="form-label">الحالة</label>
              <select class="form-control" id="att-status">
                <option value="حاضر">✅ حاضر</option><option value="غائب">❌ غائب</option>
                <option value="إجازة">🌴 إجازة</option><option value="تأخر">⏰ تأخر</option>
                <option value="مأذون">📝 مأذون</option>
              </select></div>
          </div>
          <div class="form-group"><label class="form-label">ملاحظة</label>
            <input type="text" class="form-control" id="att-note" placeholder="اختياري..."></div>
          <div id="att-alert"></div>
          <button class="btn btn-primary btn-block" onclick="window._hr.saveAtt()">تسجيل ✓</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📅 سجل الحضور</div>
          <select class="form-control" id="att-filter-emp" onchange="window._hr.filterAtt()"
                  style="width:auto;font-size:12px;padding:6px 10px;">
            <option value="">كل الموظفين</option>
            ${emps.map(e=>`<option value="${e._id}">${e.name}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 16px;border-bottom:1px solid var(--border);">
          ${[['✅ حضور',present,'var(--success)'],['❌ غياب',absent,'var(--danger)'],['🌴 إجازة',leave,'var(--info)'],['⏰ تأخر',late,'var(--warning)']].map(([l,v,c])=>`
            <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px;">
              <div style="font-weight:900;color:${c};font-size:18px;">${v}</div>
              <div style="font-size:11px;color:var(--text2);">${l}</div>
            </div>`).join('')}
        </div>
        <div class="table-wrap table-card-mode">
          <table>
            <thead><tr><th>الموظف</th><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th><th></th></tr></thead>
            <tbody id="attTbody">${buildAttRows()}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function buildAttRows(empF='') {
  const ICONS = {حاضر:'✅',غائب:'❌',إجازة:'🌴',تأخر:'⏰',مأذون:'📝'};
  const CLS   = {حاضر:'badge-ready',غائب:'badge-pending',إجازة:'badge-received',تأخر:'badge-diagnosing',مأذون:'badge-diagnosing'};
  let rows = state.attendance||[];
  if (empF) rows = rows.filter(a=>a.empId===empF);
  rows = rows.slice(0,40);
  if (!rows.length) return `<tr><td colspan="5">${emptyState('📅','لا توجد سجلات')}</td></tr>`;
  return rows.map(a=>`
    <tr>
      <td data-label="الموظف">${empName(state.employees,a.empId)}</td>
      <td data-label="التاريخ" class="mono" style="font-size:12px;">${a.date||'—'}</td>
      <td data-label="الحالة"><span class="badge ${CLS[a.status]||''}">${ICONS[a.status]||''} ${a.status}</span></td>
      <td data-label="ملاحظة" style="font-size:12px;color:var(--text2);">${a.note||'—'}</td>
      <td class="no-label">
        <button onclick="window._hr.delAtt('${a._id}')"
          style="background:rgba(255,71,87,0.1);color:var(--danger);border:none;border-radius:6px;padding:3px 7px;cursor:pointer;">✕</button>
      </td>
    </tr>`).join('');
}

// ════ INSURANCE ════
function insurancePanel() {
  const emps     = state.employees||[];
  const monthly  = emps.reduce((s,e)=>s+(e.salary||0)*(INS_EMP+INS_EMPR),0);
  const payments = state.insurancePayments||[];
  const thisM    = currentMonth();
  const paidThis = payments.find(p=>p.month===thisM&&p.status==='مدفوع');
  const due      = payments.filter(p=>p.status==='مستحق').length;

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="stat-card blue">  <div class="stat-icon">👥</div><div class="stat-num">${emps.filter(e=>e.insuranceNum).length}</div><div class="stat-label">مسجلون بالضمان</div></div>
      <div class="stat-card green"> <div class="stat-icon">✅</div><div class="stat-num">${paidThis?1:0}</div><div class="stat-label">مدفوع هذا الشهر</div></div>
      <div class="stat-card red">   <div class="stat-icon">⚠️</div><div class="stat-num">${due}</div><div class="stat-label">مستحق الدفع</div></div>
      <div class="stat-card orange"><div class="stat-icon">💰</div><div class="stat-num">${monthly.toFixed(0)}</div><div class="stat-label">الاشتراك الشهري د.أ</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;align-items:start;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏛️ ملف الضمان — ${thisM}</div>
          <button class="btn btn-success btn-sm" onclick="window._hr.payIns('${thisM}','${monthly.toFixed(2)}')">دفع الكل ✓</button>
        </div>
        <div class="table-wrap table-card-mode">
          <table>
            <thead><tr><th>الموظف</th><th>رقم الضمان</th><th>الراتب</th><th>حصة الموظف 7.5%</th><th>حصة صاحب العمل 14.25%</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
            <tbody>
              ${emps.length ? emps.map(e=>{
                const empS  = ((e.salary||0)*INS_EMP).toFixed(2);
                const emprS = ((e.salary||0)*INS_EMPR).toFixed(2);
                const tot   = ((e.salary||0)*(INS_EMP+INS_EMPR)).toFixed(2);
                return `<tr>
                  <td data-label="الموظف"><div style="display:flex;align-items:center;gap:8px;"><div class="avatar avatar-sm">${e.avatar||'؟'}</div><b>${e.name}</b></div></td>
                  <td data-label="رقم الضمان"><span class="mono" style="font-size:12px;">${e.insuranceNum||'غير مسجل'}</span></td>
                  <td data-label="الراتب" class="mono">${currency(e.salary||0)}</td>
                  <td data-label="حصة الموظف"    class="mono" style="color:var(--danger);">${empS} د.أ</td>
                  <td data-label="حصة صاحب العمل" class="mono" style="color:var(--warning);">${emprS} د.أ</td>
                  <td data-label="الإجمالي" class="mono" style="font-weight:900;color:var(--accent3);">${tot} د.أ</td>
                  <td data-label="الحالة"><span class="badge ${paidThis?'badge-ready':'badge-pending'}">${paidThis?'✅ مدفوع':'⏳ مستحق'}</span></td>
                </tr>`;
              }).join('') : `<tr><td colspan="7">${emptyState('👥','لا يوجد موظفون')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📋 سجل مدفوعات الضمان</div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الشهر</th><th>المبلغ</th><th>تاريخ الدفع</th><th>الحالة</th></tr></thead>
            <tbody>
              ${payments.length ? payments.map(p=>`
                <tr>
                  <td class="mono">${p.month}</td>
                  <td class="mono" style="color:var(--accent3);">${currency(p.total||0)}</td>
                  <td style="font-size:12px;color:var(--text2);">${p.paidDate||'—'}</td>
                  <td><span class="badge ${p.status==='مدفوع'?'badge-ready':'badge-pending'}">${p.status}</span></td>
                </tr>`).join('')
              : `<tr><td colspan="4">${emptyState('🏛️','لا توجد سجلات')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ════ ACTIONS ════
window._hr = {
  tab(t) {
    hrTab = t;
    const el = document.getElementById('hr-content');
    if (el) el.innerHTML = renderTab();
    document.querySelectorAll('.pos-tab').forEach(b => {
      b.classList.toggle('pos-tab-active', b.textContent.includes(
        t==='salary'?'الرواتب':t==='attendance'?'الحضور':'الضمان'
      ));
    });
  },

  async pay(empId, month, net) {
    const emp = state.employees.find(e=>e._id===empId);
    if (!window.confirm(`صرف راتب ${emp?.name} — ${net} د.أ؟`)) return;
    try {
      const existing = state.salaryRecords.find(r=>r.empId===empId&&r.month===month);
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.SALARY_RECORDS, existing._id),
          { status:'مدفوع', paidDate:today() });
      } else {
        await addDoc(collection(db, COLLECTIONS.SALARY_RECORDS), {
          shopId:shopId(), empId, month,
          baseSalary: emp?.salary||0, daysPresent:26, totalDays:27,
          status:'مدفوع', paidDate:today(),
        });
      }
      toast(`✅ تم صرف راتب ${emp?.name}`);
      this.tab('salary');
    } catch(err) { toast('❌ '+err.message,'danger'); }
  },

  async payAll(month) {
    if (!window.confirm(`صرف جميع الرواتب المعلقة لشهر ${month}؟`)) return;
    try {
      for (const emp of (state.employees||[])) {
        const existing = state.salaryRecords.find(r=>r.empId===emp._id&&r.month===month);
        if (existing && existing.status==='مدفوع') continue;
        if (existing) {
          await updateDoc(doc(db, COLLECTIONS.SALARY_RECORDS, existing._id),
            { status:'مدفوع', paidDate:today() });
        } else {
          await addDoc(collection(db, COLLECTIONS.SALARY_RECORDS), {
            shopId:shopId(), empId:emp._id, month,
            baseSalary:emp.salary||0, daysPresent:26, totalDays:27,
            status:'مدفوع', paidDate:today(),
          });
        }
      }
      toast('✅ تم صرف جميع الرواتب');
      this.tab('salary');
    } catch(err) { toast('❌ '+err.message,'danger'); }
  },

  async addAdv(month) {
    const empId  = document.getElementById('adv-emp')?.value;
    const amount = parseFloat(document.getElementById('adv-amount')?.value)||0;
    const reason = document.getElementById('adv-reason')?.value.trim()||'—';
    const al     = document.getElementById('adv-alert');
    if (!empId||amount<=0) { al.innerHTML='<div class="alert alert-danger">❌ اختر موظفاً وأدخل مبلغاً</div>'; return; }
    try {
      await addDoc(collection(db, COLLECTIONS.ADVANCES), {
        shopId:shopId(), empId, amount, reason, month, date:today(),
      });
      al.innerHTML='<div class="alert alert-success">✅ تم تسجيل السلفة</div>';
      document.getElementById('adv-amount').value='';
      document.getElementById('adv-reason').value='';
      this.tab('salary');
    } catch(err) { al.innerHTML=`<div class="alert alert-danger">❌ ${err.message}</div>`; }
  },

  async saveAtt() {
    const empId  = document.getElementById('att-emp')?.value;
    const date   = document.getElementById('att-date')?.value;
    const status = document.getElementById('att-status')?.value;
    const note   = document.getElementById('att-note')?.value.trim()||'';
    const al     = document.getElementById('att-alert');
    if (!empId||!date) { al.innerHTML='<div class="alert alert-danger">❌ اختر موظفاً وتاريخاً</div>'; return; }
    try {
      // Remove existing record for same day
      const ex = state.attendance.find(a=>a.empId===empId&&a.date===date);
      if (ex) await deleteDoc(doc(db, COLLECTIONS.ATTENDANCE, ex._id));
      await addDoc(collection(db, COLLECTIONS.ATTENDANCE), {
        shopId:shopId(), empId, date, status, note,
      });
      al.innerHTML=`<div class="alert alert-success">✅ تم تسجيل ${status}</div>`;
      this.tab('attendance');
    } catch(err) { al.innerHTML=`<div class="alert alert-danger">❌ ${err.message}</div>`; }
  },

  filterAtt() {
    const f = document.getElementById('att-filter-emp')?.value||'';
    const t = document.getElementById('attTbody');
    if (t) t.innerHTML = buildAttRows(f);
  },

  async delAtt(id) {
    try { await deleteDoc(doc(db, COLLECTIONS.ATTENDANCE, id)); toast('تم الحذف'); this.tab('attendance'); }
    catch(err) { toast('❌ '+err.message,'danger'); }
  },

  async payIns(month, total) {
    if (!window.confirm(`دفع اشتراك الضمان لشهر ${month}؟\nالإجمالي: ${total} د.أ`)) return;
    try {
      const ex = state.insurancePayments.find(p=>p.month===month);
      if (ex) {
        await updateDoc(doc(db, COLLECTIONS.INSURANCE, ex._id), { status:'مدفوع', paidDate:today() });
      } else {
        await addDoc(collection(db, COLLECTIONS.INSURANCE), {
          shopId:shopId(), month, total:parseFloat(total), status:'مدفوع', paidDate:today(),
        });
      }
      toast(`✅ تم دفع الضمان — ${total} د.أ`);
      this.tab('insurance');
    } catch(err) { toast('❌ '+err.message,'danger'); }
  },
};
