// modules/reports/reports.js
import { state } from '../../src/js/state.js';
import { currency, pct, bar } from '../../src/js/utils.js';

export function register(reg) {
  reg('reports', { label:'التقارير المالية', icon:'📈', group:'التقارير', render });
}

const INS = 0.075 + 0.1425;

function render() {
  const devices  = state.devices  || [];
  const sales    = state.sales    || [];
  const sp       = state.stockPurchases  || [];
  const op       = state.otherPurchases  || [];
  const emps     = state.employees || [];

  const maintRev  = devices.filter(d=>d.paid).reduce((s,d)=>s+(d.cost||0),0);
  const salesRev  = sales.reduce((s,x)=>s+(x.total||0),0);
  const totalRev  = maintRev + salesRev;

  const stockCost = sp.reduce((s,x)=>s+(x.cost||0)*(x.qty||0),0);
  const otherExp  = op.reduce((s,x)=>s+(x.amount||0),0);
  const salaries  = emps.reduce((s,e)=>s+(e.salary||0),0);
  const insurance = emps.reduce((s,e)=>s+(e.salary||0)*INS,0);
  const hrTotal   = salaries + insurance;
  const totalExp  = stockCost + otherExp + hrTotal;
  const netProfit = totalRev - totalExp;
  const margin    = totalRev ? (netProfit/totalRev*100).toFixed(1) : 0;

  const invVal    = (state.warehouse||[]).reduce((s,i)=>s+(i.stock||0)*(i.costPrice||0),0);
  const maintRate = devices.length ? (devices.filter(d=>d.status==='تسليم').length/devices.length*100).toFixed(0) : 0;

  // top products
  const prodMap = {};
  sales.forEach(s=>(s.items||[]).forEach(i=>{
    prodMap[i.name] = (prodMap[i.name]||{qty:0,rev:0});
    prodMap[i.name].qty += i.qty||0;
    prodMap[i.name].rev += (i.qty||0)*(i.price||0);
  }));
  const topProds = Object.entries(prodMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);
  const maxProd  = topProds[0]?.[1].rev || 1;

  // expense breakdown
  const expCats = {};
  op.forEach(x=>{ expCats[x.cat]=(expCats[x.cat]||0)+(x.amount||0); });

  return `
    <div class="page-header">
      <div class="page-title">📈 التقارير المالية</div>
      <div class="page-subtitle">P&L — أرباح وخسائر شاملة</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="window.print()">🖨️ طباعة</button>
    </div>

    <!-- KPI cards -->
    <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);">
      <div class="stat-card green"> <div class="stat-icon">💰</div><div class="stat-num">${totalRev.toFixed(0)}</div>  <div class="stat-label">إجمالي الإيراد د.أ</div></div>
      <div class="stat-card blue">  <div class="stat-icon">🔧</div><div class="stat-num">${maintRev.toFixed(0)}</div>  <div class="stat-label">إيراد صيانة</div></div>
      <div class="stat-card purple"><div class="stat-icon">🛒</div><div class="stat-num">${salesRev.toFixed(0)}</div>  <div class="stat-label">إيراد مبيعات</div></div>
      <div class="stat-card red">   <div class="stat-icon">📤</div><div class="stat-num">${totalExp.toFixed(0)}</div>  <div class="stat-label">إجمالي المصروفات</div></div>
      <div class="stat-card orange"><div class="stat-icon">👥</div><div class="stat-num">${hrTotal.toFixed(0)}</div>   <div class="stat-label">رواتب وضمان</div></div>
      <div class="stat-card" style="border:2px solid ${netProfit>=0?'var(--accent3)':'var(--danger)'};">
        <div class="stat-icon" style="background:${netProfit>=0?'rgba(67,233,123,0.12)':'rgba(255,71,87,0.12)'};">📊</div>
        <div class="stat-num" style="color:${netProfit>=0?'var(--accent3)':'var(--danger)'};">${netProfit.toFixed(0)}</div>
        <div class="stat-label">صافي الربح د.أ</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">

      <!-- P&L Statement -->
      <div class="card">
        <div class="card-header"><div class="card-title">📋 قائمة الأرباح والخسائر</div></div>
        <div style="padding:0 20px 20px;">
          <div style="font-size:11px;font-weight:700;color:var(--text2);letter-spacing:1px;padding:14px 0 8px;border-bottom:2px solid var(--border);margin-bottom:10px;">الإيرادات</div>
          ${plRow('إيراد الصيانة',  maintRev, totalRev, 'var(--success)')}
          ${plRow('إيراد المبيعات', salesRev, totalRev, 'var(--info)')}
          ${plTotal('إجمالي الإيرادات', totalRev, 'var(--success)')}
          <div style="font-size:11px;font-weight:700;color:var(--text2);letter-spacing:1px;padding:14px 0 8px;border-bottom:2px solid var(--border);margin-bottom:10px;">المصروفات</div>
          ${plRow('تكلفة البضاعة',    stockCost, totalRev, 'var(--danger)')}
          ${plRow('رواتب الموظفين',   salaries,  totalRev, 'var(--danger)')}
          ${plRow('الضمان الاجتماعي', insurance.toFixed(0), totalRev, 'var(--danger)')}
          ${plRow('مصروفات التشغيل',  otherExp,  totalRev, 'var(--danger)')}
          ${plTotal('إجمالي المصروفات', totalExp.toFixed(0), 'var(--danger)')}
          <div style="margin-top:14px;padding:14px;background:${netProfit>=0?'rgba(67,233,123,0.07)':'rgba(255,71,87,0.07)'};
               border:2px solid ${netProfit>=0?'var(--accent3)':'var(--danger)'};border-radius:12px;
               display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:15px;font-weight:900;">📊 صافي الربح</span>
            <div style="text-align:left;">
              <div class="mono" style="font-size:22px;font-weight:900;color:${netProfit>=0?'var(--accent3)':'var(--danger)'};">${netProfit.toFixed(2)} د.أ</div>
              <div style="font-size:11px;color:var(--text2);">هامش الربح: ${margin}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bar chart -->
      <div class="card">
        <div class="card-header"><div class="card-title">📊 توزيع بصري</div></div>
        <div class="card-body">
          ${[
            ['إيراد صيانة',    maintRev,           'var(--success)'],
            ['إيراد مبيعات',   salesRev,           'var(--info)'],
            ['تكلفة البضاعة',  stockCost,          'var(--danger)'],
            ['رواتب وضمان',    hrTotal,            'var(--warning)'],
            ['مصروفات أخرى',   otherExp,           'var(--accent2)'],
            ['صافي الربح',     Math.max(netProfit,0),'var(--accent3)'],
          ].map(([l,v,c])=>`
            <div class="bar-wrap">
              <div class="bar-label">
                <span>${l}</span>
                <span class="mono" style="color:${c};">${Number(v).toFixed(0)} د.أ</span>
              </div>
              ${bar(v, Math.max(totalRev,totalExp,1), c)}
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:18px;">

      <!-- Top products -->
      <div class="card">
        <div class="card-header"><div class="card-title">🏆 أكثر المنتجات مبيعاً</div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيراد</th><th>الحصة</th></tr></thead>
            <tbody>
              ${topProds.length ? topProds.map(([name,d],i)=>`
                <tr>
                  <td style="color:${['var(--accent3)','var(--text2)','var(--warning)'][i]||'var(--text2)'};">${['🥇','🥈','🥉'][i]||'#'+(i+1)}</td>
                  <td style="font-weight:700;">${name}</td>
                  <td class="mono">${d.qty}</td>
                  <td class="mono" style="color:var(--accent3);">${currency(d.rev)}</td>
                  <td style="width:80px;">${bar(d.rev,maxProd,'var(--accent)')}</td>
                </tr>`).join('')
              : `<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:24px;">لا توجد مبيعات</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- KPIs -->
      <div class="card">
        <div class="card-header"><div class="card-title">🎯 مؤشرات الأداء</div></div>
        <div class="card-body">
          ${[
            ['هامش الربح',         `${margin}%`,            margin>=20?'var(--success)':margin>=0?'var(--warning)':'var(--danger)',  margin>=20?'✅ ممتاز':margin>=0?'⚠️ مقبول':'❌ خسارة'],
            ['معدل إنجاز الصيانة', `${maintRate}%`,         'var(--info)',    maintRate>=80?'✅ جيد':'⚠️ تحتاج تحسين'],
            ['قيمة المخزون',       `${invVal.toFixed(0)} د.أ`,'var(--accent)', '📦 أصول'],
            ['إيراد / موظف',       emps.length?`${(totalRev/emps.length).toFixed(0)} د.أ`:'—','var(--accent3)','👤 إنتاجية'],
            ['نقطة التعادل',       `${totalExp.toFixed(0)} د.أ`,'var(--warning)','⚖️ حد أدنى'],
            ['نسبة المصروفات',     totalRev?`${(totalExp/totalRev*100).toFixed(0)}%`:'—', totalRev&&totalExp/totalRev<0.8?'var(--success)':'var(--danger)', totalRev&&totalExp/totalRev<0.8?'✅ سليم':'⚠️ مرتفعة'],
          ].map(([l,v,c,s])=>`
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:11px;background:var(--bg);border-radius:10px;margin-bottom:8px;
                        border-right:3px solid ${c};">
              <div>
                <div style="font-size:12px;color:var(--text2);font-weight:600;">${l}</div>
                <div style="font-size:11px;color:${c};margin-top:2px;">${s}</div>
              </div>
              <div class="mono" style="font-size:18px;font-weight:900;color:${c};">${v}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

const plRow = (l,v,tot,c) => `
  <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
    <span style="font-size:13px;">${l}</span>
    <div>
      <span class="mono" style="font-weight:700;color:${c};">${Number(v).toFixed(0)} د.أ</span>
      <span style="font-size:11px;color:var(--text2);margin-right:6px;">(${tot?((v/tot)*100).toFixed(0):0}%)</span>
    </div>
  </div>`;

const plTotal = (l,v,c) => `
  <div style="display:flex;justify-content:space-between;padding:9px 12px;
              background:var(--bg);border-radius:8px;margin:8px 0;">
    <span style="font-weight:700;">${l}</span>
    <span class="mono" style="font-size:16px;font-weight:900;color:${c};">${Number(v).toFixed(0)} د.أ</span>
  </div>`;
