// modules/settings/settings.js
import { db, COLLECTIONS } from '../../src/js/firebase.js';
import { state, shopId }   from '../../src/js/state.js';
import { doc, setDoc, getDocs, collection, query, where, updateDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { toast, confirm2 } from '../../src/js/utils.js';

export function register(registerModule) {
  registerModule('settings', {
    label: 'الإعدادات',
    icon:  '⚙️',
    group: 'الإعدادات',
    render: renderSettings,
  });
}

function renderSettings() {
  const s = state.settings || {};
  return `
    <div class="page-header">
      <div class="page-title">⚙️ إعدادات المحل</div>
      <div class="page-subtitle">معلومات المحل والنظام</div>
    </div>

    <div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

      <div class="card">
        <div class="card-header"><div class="card-title">🏪 بيانات المحل</div></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">اسم المحل</label>
            <input type="text" class="form-control" id="set-name" value="${s.name||''}">
          </div>
          <div class="form-group">
            <label class="form-label">رقم الهاتف</label>
            <input type="tel" class="form-control" id="set-phone" value="${s.phone||''}">
          </div>
          <div class="form-group">
            <label class="form-label">العنوان</label>
            <input type="text" class="form-control" id="set-address" value="${s.address||''}">
          </div>
          <button class="btn btn-primary" onclick="window._settings.save()">حفظ التغييرات ✓</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">ℹ️ معلومات النظام</div></div>
        <div class="card-body">
          <div style="font-size:13px;color:var(--text2);line-height:2.2;">
            <div>🔑 Shop ID:</div>
            <div class="mono" style="color:var(--accent);font-size:11px;word-break:break-all;margin-bottom:8px;">${shopId()||'—'}</div>
            <div>📅 تاريخ الإنشاء: ${s.createdAt ? new Date(s.createdAt).toLocaleDateString('ar-JO') : '—'}</div>
            <div>💱 العملة: دينار أردني (JOD)</div>
            <div>🏛️ ضمان: موظف 7.5٪ + صاحب عمل 14.25٪</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

window._settings = {
  async save() {
    const name    = document.getElementById('set-name')?.value.trim();
    const phone   = document.getElementById('set-phone')?.value.trim();
    const address = document.getElementById('set-address')?.value.trim();
    if (!name) { toast('اسم المحل مطلوب', 'danger'); return; }
    try {
      await setDoc(doc(db, COLLECTIONS.SETTINGS, shopId()), {
        shopId:    shopId(),
        name, phone: phone||'', address: address||'',
        currency:  'JOD',
        frozen:    state.settings?.frozen || false,
        createdAt: state.settings?.createdAt || new Date().toISOString(),
      });
      toast('✅ تم حفظ الإعدادات');
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  }
};
