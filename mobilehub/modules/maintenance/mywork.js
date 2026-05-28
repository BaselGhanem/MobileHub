// modules/maintenance/mywork.js — لوحة الفني
import { db, COLLECTIONS } from '../../src/js/firebase.js';
import { state }           from '../../src/js/state.js';
import { currentUser }     from '../../src/js/auth.js';
import { doc, updateDoc }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { statusBadge, MAINT_STATUSES, toast, currency } from '../../src/js/utils.js';

export function register(registerModule) {
  registerModule('mywork', {
    label: 'أجهزتي',
    icon:  '🛠️',
    group: 'العمليات',
    render: renderMyWork,
  });
}

function renderMyWork() {
  const uid    = currentUser?.uid;
  const myDevs = state.devices.filter(d => d.techId === uid);
  const active = myDevs.filter(d => d.status !== 'تسليم');
  const done   = myDevs.filter(d => d.status === 'تسليم').length;
  const pct    = myDevs.length ? Math.round(done/myDevs.length*100) : 0;

  return `
    <div class="page-header">
      <div class="page-title">🛠️ أجهزتي</div>
      <div class="page-subtitle">الأجهزة المسندة إليك</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="stat-icon">📱</div>
        <div class="stat-num">${myDevs.length}</div>
        <div class="stat-label">إجمالي أجهزتي</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">⚙️</div>
        <div class="stat-num">${active.length}</div>
        <div class="stat-label">قيد الإصلاح</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-num">${done}</div>
        <div class="stat-label">أنجزتها</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">⭐</div>
        <div class="stat-num">${pct}%</div>
        <div class="stat-label">معدل الإنجاز</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">📋 أجهزتي الحالية</div></div>
      <div class="table-wrap table-card-mode">
        <table>
          <thead>
            <tr><th>الجهاز</th><th>الزبون</th><th>العطل</th><th>التكلفة</th><th>الحالة</th><th>إجراء</th></tr>
          </thead>
          <tbody>
            ${active.length ? active.map(d => `
              <tr>
                <td data-label="الجهاز"><div style="font-weight:700;">${d.device}</div></td>
                <td data-label="الزبون">${d.customer}</td>
                <td data-label="العطل">${d.issue}</td>
                <td data-label="التكلفة"><span class="mono" style="color:var(--accent3);">${currency(d.cost)}</span></td>
                <td data-label="الحالة">${statusBadge(d.status)}</td>
                <td class="no-label">
                  ${d.status!=='تسليم' ? `
                    <button class="btn btn-success btn-xs"
                            onclick="window._mywork.next('${d._id}')">
                      التالي ›
                    </button>` : '<span style="color:var(--text2);font-size:12px;">مكتمل ✓</span>'}
                </td>
              </tr>`).join('') : `
              <tr><td colspan="6">
                <div class="table-empty">
                  <div class="icon">🎉</div>
                  <p>لا توجد أجهزة معلقة!</p>
                </div>
              </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window._mywork = {
  async next(id) {
    const d = state.devices.find(x => x._id === id);
    if (!d) return;
    const ci = MAINT_STATUSES.indexOf(d.status);
    if (ci >= MAINT_STATUSES.length - 1) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.DEVICES, id), { status: MAINT_STATUSES[ci+1] });
      toast(`✅ تم نقل الجهاز إلى: ${MAINT_STATUSES[ci+1]}`);
      // re-render
      _router.go('mywork');
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  }
};
