// modules/maintenance/overview.js
import { state, shopId } from '../../src/js/state.js';
import { currency, statusBadge, empName as utilEmpName } from '../../src/js/utils.js';

export function register(registerModule) {
  registerModule('overview', {
    label: 'الرئيسية',
    icon:  '📊',
    group: null,
    render: renderOverview,
  });
}

function renderOverview() {
  const devices  = state.devices;
  const sales    = state.sales;
  const emp      = state.employees;
  const settings = state.settings;

  const total    = devices.length;
  const active   = devices.filter(d => d.status !== 'تسليم').length;
  const ready    = devices.filter(d => d.status === 'جاهز').length;
  const overdue  = devices.filter(d => d.status !== 'تسليم' && daysDiff(d.date) > 3).length;
  const revenue  = devices.filter(d => d.paid).reduce((s,d) => s + (d.cost||0), 0);
  const salesRev = sales.reduce((s,x) => s + (x.total||0), 0);

  const recent = [...devices].slice(0, 6);

  // tech mini stats
  const techStats = emp.map(e => {
    const mine = devices.filter(d => d.techId === e._id);
    const done = mine.filter(d => d.status === 'تسليم').length;
    const pct  = mine.length ? Math.round(done/mine.length*100) : 0;
    return { ...e, total: mine.length, done, pct };
  });

  return `
    <div class="page-header">
      <div class="page-title">لوحة التحكم 📊</div>
      <div class="page-subtitle">${settings.name || 'Mobile Hub'} — نظرة عامة على اليوم</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="stat-icon">📥</div>
        <div class="stat-num">${total}</div>
        <div class="stat-label">إجمالي الأجهزة</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">🔧</div>
        <div class="stat-num">${active}</div>
        <div class="stat-label">قيد الإصلاح</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-num">${ready}</div>
        <div class="stat-label">جاهزة للاستلام</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">⏰</div>
        <div class="stat-num">${overdue}</div>
        <div class="stat-label">متأخرة +3 أيام</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">💰</div>
        <div class="stat-num">${revenue}</div>
        <div class="stat-label">إيراد صيانة د.أ</div>
      </div>
    </div>

    <div class="two-col" style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px;">

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔧 آخر أجهزة الصيانة</div>
          <button class="btn btn-ghost btn-sm" onclick="_router.go('maintenance')">عرض الكل ←</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الجهاز</th>
                <th>الزبون</th>
                <th>الفني</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${recent.length ? recent.map(d => `
                <tr>
                  <td>
                    <div style="font-weight:700;">${d.device}</div>
                    <div class="device-id">${d._id.slice(-8)}</div>
                  </td>
                  <td>${d.customer}</td>
                  <td>${state.employees.find(e=>e._id===d.techId)?.name||'—'}</td>
                  <td>${statusBadge(d.status)}</td>
                </tr>
              `).join('') : `<tr><td colspan="4"><div class="table-empty"><div class="icon">📭</div><p>لا توجد أجهزة بعد</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">👨‍🔧 أداء الفنيين</div>
        </div>
        <div class="card-body">
          ${techStats.length ? techStats.map(t => `
            <div style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="avatar avatar-sm">${t.avatar}</div>
                  <span style="font-weight:700;font-size:13px;">${t.name}</span>
                </div>
                <span class="mono" style="font-size:12px;color:var(--accent);">${t.done}/${t.total}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${t.pct}%"></div>
              </div>
              <div style="font-size:11px;color:var(--text2);margin-top:3px;">${t.pct}% معدل إنجاز</div>
            </div>
          `).join('') : '<p style="color:var(--text2);font-size:13px;text-align:center;padding:16px;">لا يوجد فنيون بعد</p>'}
        </div>
      </div>
    </div>
  `;
}

const daysDiff = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);
