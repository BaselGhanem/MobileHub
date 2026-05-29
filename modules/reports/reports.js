// modules/reports/reports.js — P&L كامل
import { state } from '../../src/js/state.js';
import { currency, pct, bar } from '../../src/js/utils.js';

export function register(reg) {
  reg('reports', { label:'التقارير المالية', icon:'📈', group:'التقارير', render });
}

const INS = 0.075 + 0.1425;

// ── Period filter state ──
let period = 'all'; // all | month | year

function render() {
  return `
    <div class="page-header">
      <div class="page-title">📈 التقارير المالية</div>
      <div class="page-subtitle">P&L شامل — أرباح وخسائر</div>
    </div>

    <!-- Period selector -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;
         padding:14px 18px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);">
      <span style="font-weight:700;font-size:13px;">📅 الفترة:</span>
      <div style="display:flex;gap:4px;background:var(--bg);padding:3px;border-radius:8px;">
        ${[['all','كل الوقت'],['month','هذا الشهر'],['year','هذه السنة']].map(([v,l])=>`
          <button onclick="window._rep.setPeriod('${v}')"
                  class="rep-period-btn ${period===v?'pos-tab-active pos-tab':''}"
                  style="padding:7px 16px;border:none;border-radius:6px;
                         background:${period===v?'var(--accent)':'transparent'};
                         color:${period===v?'#fff':'var(--text2)'};
                         font-family:'Cairo',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
            ${l}
          </button>`).join('')}
      </div>
      <div style="margin-right:auto;display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ طباعة</button>
      </div>
    </div>

    <div id="rep-content">${buildReports()}</div>
  `;
}

function filterByPeriod(arr, dateField = 'date') {
  if (period === 'all') return arr;
  const now  = new Date();
  const year = now.getFullYear();
  const month= String(now.getMonth()+1).padStart(2,'0');
  return arr.filter(x => {
    const d = x[dateField] || '';
    if (period === 'month') return d.startsWith(`${year}-${month}`);
    if (period === 'year')  return d.startsWith(`${year}`);
    return true;
  });
}

function buildReports() {
  const devices  = filterByPeriod(state.devices  || [], 'date');
  const sales    = filterByPeriod(state.sales    || [], 'date');
  const invs     = filterByPeriod(state.invoicesList||[], 'date');
  const sp       = filterByPeriod(state.stockPurchases||[], 'date');
  const op       = filterByPeriod(state.otherPurchases||[], 'date');
  const emps     = state.employees || [];

  // ── REVENUE ──
  const maintRevPaid = devices.filter(d=>d.paid).reduce((s,d)=>s+(d.cost||0),0);
  const maintRevAll  = devices.reduce((s,d)=>s+(d.cost||0),0);
  const maintRevUnpaid = maintRevAll - maintRevPaid;
  const salesRev     = sales.reduce((s,x)=>s+(x.total||0),0);
  const invRev       = invs.reduce((s,i)=>s+(i.subtotal||0),0);
  const invTax       = invs.reduce((s,i)=>s+(i.taxAmount||0),0);
  const totalRev     = maintRevPaid + salesRev + invRev;

  // ── EXPENSES ──
  const stockCost = sp.reduce((s,x)=>s+(x.cost||0)*(x.qty||0),0);
  const otherExp  = op.reduce((s,x)=>s+(x.amount||0),0);
  const salaries  = emps.reduce((s,e)=>s+(e.salary||0),0);
  const insurance = emps.reduce((s,e)=>s+(e.salary||0)*INS,0);
  const hrTotal   = salaries + insurance;
  const totalExp  = stockCost + otherExp + hrTotal;

  // ── PROFIT ──
  const grossProfit  = totalRev - stockCost;
  const netProfit    = totalRev - totalExp;
  const margin       = totalRev ? (netProfit/totalRev*100).toFixed(1) : 0;
  const grossMargin  = totalRev ? (grossProfit/totalRev*100).toFixed(1) : 0;

  // ── INVENTORY ──
  const invVal       = (state.warehouse||[]).reduce((s,i)=>s+(i.stock||0)*(i.costPrice||0),0);

  // ── MAINT STATS ──
  const maintDelivered = devices.filter(d=>d.status==='تسليم').length;
  const maintRate      = devices.length?(maintDelivered/devices.length*100).toFixed(0):0;

  // ── TOP PRODUCTS ──
  const prodMap = {};
  sales.forEach(s=>(s.items||[]).forEach(i=>{
    prodMap[i.name]=(prodMap[i.name]||{qty:0,rev:0,cost:0});
    prodMap[i.name].qty += i.qty||0;
    prodMap[i.name].rev += (i.qty||0)*(i.price||0);
  }));
  const topProds = Object.entries(prodMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,6);
  const maxProd  = topProds[0]?.[1].rev||1;

  // ── EXPENSE CATEGORIES ──
  const expCats = {};
  op.forEach(x=>{ expCats[x.cat]=(expCats[x.cat]||0)+(x.amount||0); });
  const sortedCats = Object.entries(expCats).sort((a,b)=>b[1]-a[1]);

  return `
    <!-- ── KPI CARDS ── -->
    <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:22px;">
      <div class="stat-card green"> <div class="stat-icon">💰</div><div class="stat-num">${totalRev.toFixed(0)}</div>   <div class="stat-label">إجمالي الإيراد</div></div>
      <div class="stat-card blue">  <div class="stat-icon">🔧</div><div class="stat-num">${maintRevPaid.toFixed(0)}</div><div class="stat-label">إيراد صيانة</div></div>
      <div class="stat-card purple"><div class="stat-icon">🛒</div><div class="stat-num">${salesRev.toFixed(0)}</div>   <div class="stat-label">إيراد مبيعات</div></div>
      <div class="stat-card red">   <div class="stat-icon">📤</div><div class="stat-num">${totalExp.toFixed(0)}</div>   <div class="stat-label">إجمالي المصروفات</div></div>
      <div class="stat-card orange"><div class="stat-icon">👥</div><div class="stat-num">${hrTotal.toFixed(0)}</div>    <div class="stat-label">رواتب وضمان</div></div>
      <div class="stat-card" style="border:2px solid ${netProfit>=0?'var(--accent3)':'var(--danger)'};">
        <div class="stat-icon" style="background:${netProfit>=0?'rgba(67,233,123,0.12)':'rgba(255,71,87,0.12)'};">📊</div>
        <div class="stat-num" style="color:${netProfit>=0?'var(--accent3)':'var(--danger)'};">${netProfit.toFixed(0)}</div>
        <div class="stat-label">صافي الربح</div>
      </div>
    </div>

    <!-- ── ROW 1: P&L + CHART ── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px;">

      <!-- P&L Statement -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 قائمة الأرباح والخسائر</div>
          <span style="font-size:11px;color:var(--text2);">
            ${period==='month'?'الشهر الحالي':period==='year'?'السنة الحالية':'كل الفترات'}
          </span>
        </div>
        <div style="padding:0 20px 20px;">

          <div style="font-size:10px;font-weight:700;color:var(--text2);letter-spacing:1px;padding:14px 0 6px;border-bottom:1px solid var(--border);margin-bottom:8px;">الإيرادات</div>
          ${plRow('إيراد الصيانة المحصّل',  maintRevPaid,  totalRev, 'var(--success)')}
          ${plRow('إيراد صيانة معلق',       maintRevUnpaid,totalRev, 'var(--warning)')}
          ${plRow('إيراد المبيعات (POS)',    salesRev,      totalRev, 'var(--info)')}
          ${invRev>0?plRow('إيراد الفواتير الرسمية', invRev, totalRev, 'var(--accent)'):''}
          ${plTotal('إجمالي الإيرادات', totalRev, 'var(--success)')}

          <div style="font-size:10px;font-weight:700;color:var(--text2);letter-spacing:1px;padding:14px 0 6px;border-bottom:1px solid var(--border);margin-bottom:8px;">تكلفة المبيعات</div>
          ${plRow('تكلفة البضاعة المشتراة', stockCost, totalRev, 'var(--danger)')}
          ${plTotal('إجمالي تكلفة المبيعات', stockCost, 'var(--danger)')}

          <!-- Gross Profit -->
          <div style="display:flex;justify-content:space-between;align-items:center;
               padding:10px 12px;background:rgba(30,144,255,0.08);border-radius:8px;margin:8px 0;">
            <span style="font-weight:700;">🎯 مجمل الربح (Gross Profit)</span>
            <div style="text-align:left;">
              <span class="mono" style="font-size:16px;font-weight:900;color:var(--info);">${grossProfit.toFixed(0)} د.أ</span>
              <span style="font-size:11px;color:var(--text2);margin-right:6px;">(${grossMargin}%)</span>
            </div>
          </div>

          <div style="font-size:10px;font-weight:700;color:var(--text2);letter-spacing:1px;padding:14px 0 6px;border-bottom:1px solid var(--border);margin-bottom:8px;">مصروفات التشغيل</div>
          ${plRow('رواتب الموظفين',    salaries,   totalRev, 'var(--danger)')}
          ${plRow('الضمان الاجتماعي', insurance.toFixed(0), totalRev, 'var(--danger)')}
          ${plRow('مصروفات التشغيل',  otherExp,   totalRev, 'var(--danger)')}
          ${plTotal('إجمالي مصروفات التشغيل', (hrTotal+otherExp).toFixed(0), 'var(--danger)')}

          <!-- Net Profit -->
          <div style="margin-top:12px;padding:14px;
               background:${netProfit>=0?'rgba(67,233,123,0.07)':'rgba(255,71,87,0.07)'};
               border:2px solid ${netProfit>=0?'var(--accent3)':'var(--danger)'};
               border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:15px;font-weight:900;">📊 صافي الربح</span>
            <div style="text-align:left;">
              <div class="mono" style="font-size:22px;font-weight:900;
                   color:${netProfit>=0?'var(--accent3)':'var(--danger)'};">
                ${netProfit.toFixed(2)} د.أ
              </div>
              <div style="font-size:11px;color:var(--text2);">هامش الربح: ${margin}%</div>
            </div>
          </div>

          ${invTax>0?`
          <div style="margin-top:10px;padding:10px 12px;background:rgba(108,99,255,0.08);
               border-radius:8px;display:flex;justify-content:space-between;font-size:13px;">
            <span style="color:var(--text2);">🏛️ ضريبة مبيعات مُرسلة لـ JoFotara</span>
            <span class="mono" style="color:var(--accent);font-weight:700;">${invTax.toFixed(2)} د.أ</span>
          </div>`:''}
        </div>
      </div>

      <!-- Visual bar chart -->
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><div class="card-title">📊 التوزيع البصري</div></div>
          <div class="card-body">
            ${[
              ['إيراد صيانة',   maintRevPaid, 'var(--success)'],
              ['إيراد مبيعات',  salesRev,     'var(--info)'],
              ['تكلفة بضاعة',   stockCost,    'var(--danger)'],
              ['رواتب وضمان',   hrTotal,      'var(--warning)'],
              ['مصروفات تشغيل', otherExp,     'var(--accent2)'],
              ['صافي الربح',    Math.max(netProfit,0),'var(--accent3)'],
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

        <!-- Maintenance stats -->
        <div class="card">
          <div class="card-header"><div class="card-title">🔧 إحصائيات الصيانة</div></div>
          <div class="card-body">
            ${miniStat('إجمالي الأجهزة',      devices.length,             '📱')}
            ${miniStat('مسلّمة',              maintDelivered,              '✅')}
            ${miniStat('قيد الإصلاح',        devices.length-maintDelivered,'🔧')}
            ${miniStat('إيراد محصّل',         currency(maintRevPaid),       '💰')}
            ${miniStat('إيراد غير محصّل',    currency(maintRevUnpaid),      '⏳')}
            ${miniStat('متوسط قيمة الإصلاح', devices.length?currency(maintRevAll/devices.length):'—','📊')}
            <div class="bar-wrap" style="margin-top:10px;">
              <div class="bar-label">
                <span style="font-size:12px;">معدل الإنجاز</span>
                <span class="mono" style="color:var(--success);font-size:12px;">${maintRate}%</span>
              </div>
              ${bar(maintRate,100,'var(--success)')}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── ROW 2: Top products + KPIs ── -->
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:18px;margin-bottom:18px;">

      <!-- Top products -->
      <div class="card">
        <div class="card-header"><div class="card-title">🏆 أكثر المنتجات مبيعاً</div></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيراد</th><th>الحصة</th></tr></thead>
            <tbody>
              ${topProds.length ? topProds.map(([name,d],i)=>`
                <tr>
                  <td style="color:${['var(--accent3)','var(--text2)','var(--warning)'][i]||'var(--text2)'};">
                    ${['🥇','🥈','🥉'][i]||'#'+(i+1)}
                  </td>
                  <td style="font-weight:700;">${name}</td>
                  <td class="mono">${d.qty}</td>
                  <td class="mono" style="color:var(--accent3);">${currency(d.rev)}</td>
                  <td style="min-width:80px;">${bar(d.rev,maxProd,'var(--accent)')}</td>
                </tr>`).join('')
              : `<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:24px;">لا توجد مبيعات</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- KPIs -->
      <div class="card">
        <div class="card-header"><div class="card-title">🎯 مؤشرات الأداء (KPIs)</div></div>
        <div class="card-body">
          ${kpiBlock('هامش الربح الصافي',    margin+'%',
            margin>=20?'var(--success)':margin>=0?'var(--warning)':'var(--danger)',
            margin>=20?'✅ ممتاز':margin>=0?'⚠️ مقبول':'❌ خسارة')}
          ${kpiBlock('هامش الربح الإجمالي',  grossMargin+'%', 'var(--info)', 'Gross Margin')}
          ${kpiBlock('معدل إنجاز الصيانة',   maintRate+'%',
            maintRate>=80?'var(--success)':'var(--warning)',
            maintRate>=80?'✅ جيد':'⚠️ يحتاج تحسين')}
          ${kpiBlock('قيمة المخزون الحالي',  invVal.toFixed(0)+' د.أ', 'var(--accent)', '📦 أصول')}
          ${kpiBlock('إيراد / موظف',
            emps.length?currency(totalRev/emps.length):'—', 'var(--accent3)', '👤 إنتاجية')}
          ${kpiBlock('نسبة المصروفات',
            totalRev?(totalExp/totalRev*100).toFixed(0)+'%':'—',
            totalRev&&totalExp/totalRev<0.8?'var(--success)':'var(--danger)',
            totalRev&&totalExp/totalRev<0.8?'✅ تحت السيطرة':'⚠️ مرتفعة')}
        </div>
      </div>
    </div>

    <!-- ── ROW 3: Expense breakdown ── -->
    ${sortedCats.length ? `
    <div class="card">
      <div class="card-header"><div class="card-title">📤 تفصيل مصروفات التشغيل</div></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          ${sortedCats.map(([cat,val])=>`
            <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;border:1px solid var(--border);">
              <div style="font-size:13px;font-weight:700;margin-bottom:8px;">${cat}</div>
              <div class="mono" style="font-size:18px;font-weight:900;color:var(--danger);">${currency(val)}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:4px;">${otherExp?(val/otherExp*100).toFixed(0):0}% من التشغيل</div>
              ${bar(val,otherExp||1,'var(--danger)')}
            </div>`).join('')}
        </div>
      </div>
    </div>` : ''}
  `;
}

// ── Helpers ──
const plRow = (l,v,tot,c) => `
  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
    <span style="font-size:13px;">${l}</span>
    <div>
      <span class="mono" style="font-weight:700;color:${c};">${Number(v).toFixed(0)} د.أ</span>
      <span style="font-size:10px;color:var(--text2);margin-right:5px;">(${tot?((v/tot)*100).toFixed(0):0}%)</span>
    </div>
  </div>`;

const plTotal = (l,v,c) => `
  <div style="display:flex;justify-content:space-between;padding:8px 12px;
       background:var(--bg);border-radius:8px;margin:6px 0;">
    <span style="font-weight:700;font-size:13px;">${l}</span>
    <span class="mono" style="font-size:15px;font-weight:900;color:${c};">${Number(v).toFixed(0)} د.أ</span>
  </div>`;

const miniStat = (l,v,icon) => `
  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
    <span style="color:var(--text2);">${icon} ${l}</span>
    <span style="font-weight:700;">${v}</span>
  </div>`;

const kpiBlock = (l,v,c,s) => `
  <div style="display:flex;justify-content:space-between;align-items:center;
       padding:10px;background:var(--bg);border-radius:10px;margin-bottom:8px;
       border-right:3px solid ${c};">
    <div>
      <div style="font-size:12px;color:var(--text2);font-weight:600;">${l}</div>
      <div style="font-size:11px;color:${c};margin-top:2px;">${s}</div>
    </div>
    <div class="mono" style="font-size:17px;font-weight:900;color:${c};">${v}</div>
  </div>`;

window._rep = {
  setPeriod(p) {
    period = p;
    const el = document.getElementById('rep-content');
    if (el) el.innerHTML = buildReports();
  }
};
