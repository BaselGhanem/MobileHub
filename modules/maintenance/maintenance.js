// modules/maintenance/maintenance.js
import { db, COLLECTIONS }  from '../../src/js/firebase.js';
import { state, shopId }    from '../../src/js/state.js';
import { currentUser }      from '../../src/js/auth.js';
import {
  collection, addDoc, doc, updateDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  statusBadge, MAINT_STATUSES, openModal, closeModal,
  toast, confirm2, waBtn, currency, genId, today
} from '../../src/js/utils.js';

export function register(registerModule) {
  registerModule('maintenance', {
    label: 'الصيانة',
    icon:  '🔧',
    group: 'العمليات',
    render: renderMaintenance,
  });
}

// ── Render ──
function renderMaintenance() {
  // Inject modals once
  injectModals();

  const rows = buildRows();
  return `
    <div class="page-header">
      <div class="page-title">🔧 إدارة الصيانة</div>
      <div class="page-subtitle">متابعة جميع أجهزة الصيانة</div>
    </div>

    <div class="search-bar">
      <input class="search-input" id="maintSearch"
             placeholder="🔍 بحث بالاسم أو الجهاز أو رقم الهاتف..."
             oninput="window._maint.search()">
      <select class="form-control" id="maintStatusFilter"
              onchange="window._maint.search()"
              style="width:auto;min-width:140px;">
        <option value="">كل الحالات</option>
        ${MAINT_STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('')}
      </select>
      <button class="btn btn-primary" onclick="window._maint.openAdd()">
        + إضافة جهاز
      </button>
    </div>

    <div class="card">
      <div class="table-wrap table-card-mode">
        <table>
          <thead>
            <tr>
              <th>الجهاز</th>
              <th>الزبون</th>
              <th>الهاتف</th>
              <th>العطل</th>
              <th>الفني</th>
              <th>التكلفة</th>
              <th>الحالة</th>
              <th>التاريخ</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="maintTbody">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildRows(search = '', statusF = '') {
  let items = state.devices;

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(d =>
      d.customer?.toLowerCase().includes(q) ||
      d.device?.toLowerCase().includes(q) ||
      d.phone?.includes(q)
    );
  }
  if (statusF) items = items.filter(d => d.status === statusF);

  if (!items.length) return `
    <tr><td colspan="9">
      <div class="table-empty">
        <div class="icon">📭</div>
        <p>لا توجد أجهزة</p>
      </div>
    </td></tr>`;

  return items.map(d => {
    const tech = state.employees.find(e => e._id === d.techId);
    const late = d.status !== 'تسليم' && daysDiff(d.date) > 3;
    return `
      <tr style="${late?'border-right:3px solid var(--danger)':''}">
        <td data-label="الجهاز">
          <div style="font-weight:700;">${d.device||'—'}</div>
          <div style="font-size:11px;color:var(--text2);">${d.model||''}</div>
        </td>
        <td data-label="الزبون">${d.customer||'—'}</td>
        <td data-label="الهاتف">
          ${d.phone ? waBtn(d.phone, `مرحباً ${d.customer}، جهازك ${d.device} رقم تتبع: ${d._id} — الحالة: ${d.status}`) : '—'}
        </td>
        <td data-label="العطل" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.issue||'—'}</td>
        <td data-label="الفني">${tech?.name||'—'}</td>
        <td data-label="التكلفة">
          <span class="mono" style="color:var(--accent3);">${currency(d.cost)}</span>
          ${d.paid
            ? '<span class="badge badge-ready" style="font-size:10px;margin-right:4px;">مدفوع</span>'
            : '<span class="badge badge-pending" style="font-size:10px;margin-right:4px;">معلق</span>'}
        </td>
        <td data-label="الحالة">${statusBadge(d.status)}</td>
        <td data-label="التاريخ" style="font-size:12px;color:var(--text2);">${d.date||'—'}</td>
        <td class="no-label">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-info btn-xs"    onclick="window._maint.openDetail('${d._id}')">تفاصيل</button>
            ${d.status!=='تسليم' ? `<button class="btn btn-success btn-xs" onclick="window._maint.nextStatus('${d._id}')">التالي ›</button>` : ''}
            ${!d.paid ? `<button class="btn btn-warning btn-xs" onclick="window._maint.markPaid('${d._id}')">💰</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Modal HTML ──
function injectModals() {
  if (document.getElementById('maintAddModal')) return;

  const techOptions = () => state.employees
    .map(e => `<option value="${e._id}">${e.name}</option>`).join('');

  document.body.insertAdjacentHTML('beforeend', `
    <!-- Add Modal -->
    <div class="modal-overlay" id="maintAddModal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title">📱 إضافة جهاز صيانة</div>
          <button class="modal-close" onclick="closeModal('maintAddModal')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">اسم الزبون *</label>
              <input type="text" class="form-control" id="mf-customer" placeholder="محمد أحمد">
            </div>
            <div class="form-group">
              <label class="form-label">رقم الهاتف *</label>
              <input type="tel" class="form-control" id="mf-phone" placeholder="07XXXXXXXX">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">نوع الجهاز *</label>
              <input type="text" class="form-control" id="mf-device" placeholder="iPhone 15 Pro">
            </div>
            <div class="form-group">
              <label class="form-label">الإصدار / اللون</label>
              <input type="text" class="form-control" id="mf-model" placeholder="128GB / أسود">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">وصف العطل *</label>
            <input type="text" class="form-control" id="mf-issue" placeholder="شاشة مكسورة / لا يشتغل...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">تكلفة الإصلاح (د.أ)</label>
              <input type="number" class="form-control" id="mf-cost" placeholder="0" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">إسناد إلى فني</label>
              <select class="form-control" id="mf-tech">
                <option value="">— اختر فني —</option>
                ${techOptions()}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">ملاحظات</label>
            <input type="text" class="form-control" id="mf-notes" placeholder="اختياري...">
          </div>
          <div class="modal-footer" style="padding:0;margin-top:16px;">
            <button class="btn btn-ghost" onclick="closeModal('maintAddModal')">إلغاء</button>
            <button class="btn btn-primary" onclick="window._maint.saveDevice()">حفظ الجهاز ✓</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div class="modal-overlay" id="maintDetailModal">
      <div class="modal modal-lg">
        <div class="modal-header">
          <div class="modal-title" id="maintDetailTitle">تفاصيل الجهاز</div>
          <button class="modal-close" onclick="closeModal('maintDetailModal')">✕</button>
        </div>
        <div class="modal-body" id="maintDetailBody"></div>
      </div>
    </div>
  `);

  // close on overlay
  ['maintAddModal','maintDetailModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) closeModal(id);
    });
  });
}

// ── Actions ──
window._maint = {

  search() {
    const s = document.getElementById('maintSearch')?.value || '';
    const f = document.getElementById('maintStatusFilter')?.value || '';
    const tbody = document.getElementById('maintTbody');
    if (tbody) tbody.innerHTML = buildRows(s, f);
  },

  openAdd() {
    // refresh tech options
    const sel = document.getElementById('mf-tech');
    if (sel) sel.innerHTML = '<option value="">— اختر فني —</option>' +
      state.employees.map(e=>`<option value="${e._id}">${e.name}</option>`).join('');
    openModal('maintAddModal');
  },

  async saveDevice() {
    const customer = document.getElementById('mf-customer').value.trim();
    const phone    = document.getElementById('mf-phone').value.trim();
    const device   = document.getElementById('mf-device').value.trim();
    const model    = document.getElementById('mf-model').value.trim();
    const issue    = document.getElementById('mf-issue').value.trim();
    const cost     = parseFloat(document.getElementById('mf-cost').value) || 0;
    const techId   = document.getElementById('mf-tech').value;
    const notes    = document.getElementById('mf-notes').value.trim();

    if (!customer || !phone || !device || !issue) {
      toast('يرجى ملء الحقول المطلوبة *', 'danger'); return;
    }

    try {
      await addDoc(collection(db, COLLECTIONS.DEVICES), {
        shopId:   shopId(),
        customer, phone, device,
        model:    model || '—',
        issue, cost, techId,
        notes, status: 'استلام',
        date:  today(),
        paid:  false,
        createdBy: currentUser?.uid || '',
      });
      closeModal('maintAddModal');
      // clear form
      ['mf-customer','mf-phone','mf-device','mf-model','mf-issue','mf-cost','mf-notes']
        .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      document.getElementById('mf-tech').value = '';
      toast('✅ تم إضافة الجهاز بنجاح');
    } catch(err) {
      toast('❌ خطأ: ' + err.message, 'danger');
    }
  },

  openDetail(id) {
    const d = state.devices.find(x => x._id === id);
    if (!d) return;
    const si = MAINT_STATUSES.indexOf(d.status);
    const icons = ['📥','🔍','🔧','✅','📦'];

    const timeline = MAINT_STATUSES.map((s,i) => {
      const cls  = i < si ? 'done' : i === si ? 'active' : '';
      const line = i > 0 ? `<div class="timeline-line ${i<=si?'done':''}"></div>` : '';
      return `${line}
        <div class="timeline-step ${cls}">
          <div class="timeline-dot">${icons[i]}</div>
          <div class="timeline-label">${s}</div>
        </div>`;
    }).join('');

    const tech = state.employees.find(e => e._id === d.techId);
    document.getElementById('maintDetailTitle').textContent = `📱 ${d.device}`;
    document.getElementById('maintDetailBody').innerHTML = `
      <div class="timeline">${timeline}</div>
      <div class="form-row" style="margin-top:18px;">
        <div><div class="form-label">الزبون</div><div style="font-weight:700;">${d.customer}</div></div>
        <div><div class="form-label">الهاتف</div>${waBtn(d.phone, `جهازك ${d.device} — الحالة: ${d.status}`)}</div>
        <div><div class="form-label">الجهاز</div><div style="font-weight:700;">${d.device}</div><div style="font-size:12px;color:var(--text2);">${d.model}</div></div>
        <div><div class="form-label">الفني</div><div>${tech?.name||'—'}</div></div>
        <div><div class="form-label">العطل</div><div>${d.issue}</div></div>
        <div>
          <div class="form-label">التكلفة</div>
          <div class="mono" style="font-size:18px;font-weight:900;color:var(--accent3);">${currency(d.cost)}</div>
          ${d.paid ? '<span class="badge badge-ready">✅ مدفوع</span>' : '<span class="badge badge-pending">⚠ معلق</span>'}
        </div>
      </div>
      ${d.notes ? `<div style="margin-top:12px;padding:12px;background:var(--bg);border-radius:8px;font-size:13px;"><strong>ملاحظات:</strong> ${d.notes}</div>` : ''}
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;">
        ${d.status!=='تسليم' ? `<button class="btn btn-success" onclick="window._maint.nextStatus('${d._id}');closeModal('maintDetailModal')">نقل للمرحلة التالية ›</button>` : ''}
        ${!d.paid ? `<button class="btn btn-warning" onclick="window._maint.markPaid('${d._id}');closeModal('maintDetailModal')">💰 تسجيل الدفع</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="window._maint.deleteDevice('${d._id}')">🗑 حذف</button>
      </div>
    `;
    openModal('maintDetailModal');
  },

  async nextStatus(id) {
    const d = state.devices.find(x => x._id === id);
    if (!d) return;
    const ci = MAINT_STATUSES.indexOf(d.status);
    if (ci >= MAINT_STATUSES.length - 1) return;
    const next = MAINT_STATUSES[ci + 1];
    try {
      await updateDoc(doc(db, COLLECTIONS.DEVICES, id), { status: next });
      toast(`تم تحديث الحالة إلى: ${next}`);
      window._maint.search();
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  },

  async markPaid(id) {
    try {
      await updateDoc(doc(db, COLLECTIONS.DEVICES, id), { paid: true });
      toast('✅ تم تسجيل الدفع');
      window._maint.search();
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  },

  async deleteDevice(id) {
    if (!await confirm2('هل تريد حذف هذا الجهاز نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.DEVICES, id));
      closeModal('maintDetailModal');
      toast('تم الحذف');
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  },
};

const daysDiff = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
