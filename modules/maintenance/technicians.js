// modules/maintenance/technicians.js — إنجازات الفنيين
import { state } from '../../src/js/state.js';
import { currency } from '../../src/js/utils.js';

export function register(registerModule) {
  registerModule('technicians', {
    label: 'الفنيون',
    icon:  '👨‍🔧',
    group: 'العمليات',
    render: renderTechnicians,
  });
}

function renderTechnicians() {
  const emp = state.employees;
  if (!emp.length) return `
    <div class="page-header"><div class="page-title">👨‍🔧 إنجازات الفنيين</div></div>
    <div class="table-empty"><div class="icon">👷</div><p>لا يوجد فنيون بعد — أضفهم من إعدادات الفنيين</p></div>`;

  return `
    <div class="page-header">
      <div class="page-title">👨‍🔧 إنجازات الفنيين</div>
      <div class="page-subtitle">أداء وإحصائيات كل فني</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
      ${emp.map(e => {
        const mine = state.devices.filter(d => d.techId === e._id);
        const done = mine.filter(d => d.status==='تسليم').length;
        const inProg = mine.filter(d => d.status!=='تسليم').length;
        const rev  = mine.filter(d=>d.paid).reduce((s,d)=>s+(d.cost||0),0);
        const pct  = mine.length ? Math.round(done/mine.length*100) : 0;
        return `
          <div class="card" style="margin:0;">
            <div class="card-body">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
                <div class="avatar avatar-lg">${e.avatar}</div>
                <div>
                  <div style="font-size:16px;font-weight:700;">${e.name}</div>
                  <div style="font-size:12px;color:var(--text2);">${e.role} · ${e.joinDate||''}</div>
                </div>
              </div>
              <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                  <span style="color:var(--text2);font-weight:700;">معدل الإنجاز</span>
                  <span class="mono" style="color:var(--accent);font-weight:700;">${pct}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;">
                ${[['إجمالي',mine.length,'var(--info)'],['أنجز',done,'var(--success)'],['جارية',inProg,'var(--warning)']].map(([l,v,c])=>`
                  <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px;">
                    <div class="mono" style="font-size:20px;font-weight:900;color:${c};">${v}</div>
                    <div style="font-size:11px;color:var(--text2);margin-top:3px;">${l}</div>
                  </div>`).join('')}
              </div>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;color:var(--text2);">إيراد محصّل</span>
                <span class="mono" style="font-size:16px;font-weight:700;color:var(--accent3);">${currency(rev)}</span>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}
