// modules/settings/manage-techs.js
import { db, COLLECTIONS } from '../../src/js/firebase.js';
import { state, shopId }   from '../../src/js/state.js';
import { createUser }      from '../../src/js/auth.js';
import { doc, deleteDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { toast, confirm2, openModal, closeModal, today } from '../../src/js/utils.js';

export function register(registerModule) {
  registerModule('manage-techs', {
    label: 'إدارة الفنيين',
    icon:  '⚙️',
    group: 'الإعدادات',
    render: renderManageTechs,
  });
}

function renderManageTechs() {
  injectModal();
  return `
    <div class="page-header">
      <div class="page-title">⚙️ إدارة الفنيين</div>
      <div class="page-subtitle">إضافة وحذف حسابات الفنيين</div>
    </div>
    <div class="two-col" style="display:grid;grid-template-columns:1fr 1.4fr;gap:20px;align-items:start;">
      <div class="card">
        <div class="card-header"><div class="card-title">➕ إضافة فني جديد</div></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">الاسم الكامل *</label>
            <input type="text" class="form-control" id="nt-name" placeholder="محمد العلي">
          </div>
          <div class="form-group">
            <label class="form-label">البريد الإلكتروني *</label>
            <input type="email" class="form-control" id="nt-email" placeholder="tech@mobilehub.jo">
          </div>
          <div class="form-group">
            <label class="form-label">كلمة المرور *</label>
            <input type="password" class="form-control" id="nt-pass" placeholder="6 أحرف على الأقل">
          </div>
          <div class="form-group">
            <label class="form-label">الراتب (د.أ)</label>
            <input type="number" class="form-control" id="nt-salary" placeholder="300">
          </div>
          <div id="nt-alert"></div>
          <button class="btn btn-primary btn-block" onclick="window._manageTechs.add()">إضافة الفني ✓</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">👥 الفنيون الحاليون</div></div>
        <div class="card-body" id="techManageList">
          ${buildTechList()}
        </div>
      </div>
    </div>
  `;
}

function buildTechList() {
  const techs = state.employees;
  if (!techs.length) return '<p style="color:var(--text2);text-align:center;padding:20px;font-size:13px;">لا يوجد فنيون بعد</p>';
  return techs.map(t => {
    const devs = state.devices.filter(d => d.techId === t._id);
    const done = devs.filter(d => d.status === 'تسليم').length;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:8px;border:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="avatar avatar-md">${t.avatar}</div>
          <div>
            <div style="font-weight:700;font-size:13px;">${t.name}</div>
            <div style="font-size:11px;color:var(--text2);">${devs.length} جهاز · ${done} منجز</div>
          </div>
        </div>
        <button class="btn btn-danger btn-xs" onclick="window._manageTechs.remove('${t._id}','${t.name}',${devs.filter(d=>d.status!=='تسليم').length})">🗑</button>
      </div>`;
  }).join('');
}

function injectModal() {
  if (document.getElementById('techAddedModal')) return;
}

window._manageTechs = {
  async add() {
    const name   = document.getElementById('nt-name')?.value.trim();
    const email  = document.getElementById('nt-email')?.value.trim();
    const pass   = document.getElementById('nt-pass')?.value;
    const salary = parseFloat(document.getElementById('nt-salary')?.value) || 300;
    const alertEl= document.getElementById('nt-alert');

    if (!name || !email || !pass || pass.length < 6) {
      alertEl.innerHTML = '<div class="alert alert-danger">❌ يرجى ملء جميع الحقول (كلمة المرور 6 أحرف+)</div>';
      return;
    }

    try {
      const uid = await createUser({ email, password: pass, name, role: 'tech', shopId: shopId() });
      // Employee record
      await setDoc(doc(db, COLLECTIONS.EMPLOYEES, uid), {
        shopId: shopId(), uid, name,
        role: 'فني صيانة', salary,
        insuranceNum: '', avatar: name.charAt(0),
        joinDate: today(),
        date: today(),
      });
      alertEl.innerHTML = `<div class="alert alert-success">✅ تم إضافة "${name}" بنجاح</div>`;
      ['nt-name','nt-email','nt-pass','nt-salary'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      // refresh list
      const listEl = document.getElementById('techManageList');
      if (listEl) listEl.innerHTML = buildTechList();
    } catch(err) {
      alertEl.innerHTML = `<div class="alert alert-danger">❌ ${err.message}</div>`;
    }
  },

  async remove(id, name, activeDevs) {
    if (activeDevs > 0) {
      toast(`⚠️ لا يمكن حذف "${name}" — لديه ${activeDevs} أجهزة غير منجزة`, 'warning'); return;
    }
    if (!await confirm2(`حذف الفني "${name}"؟`)) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, id));
      toast(`تم حذف ${name}`);
      const listEl = document.getElementById('techManageList');
      if (listEl) listEl.innerHTML = buildTechList();
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  }
};
