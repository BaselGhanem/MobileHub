// modules/settings/settings.js
import { db, COLLECTIONS } from '../../src/js/firebase.js';
import { state, shopId }   from '../../src/js/state.js';
import { doc, setDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { toast } from '../../src/js/utils.js';

export function register(reg) {
  reg('settings', { label:'الإعدادات', icon:'⚙️', group:'الإعدادات', render });
}

function render() {
  const s = state.settings || {};
  return `
    <div class="page-header">
      <div class="page-title">⚙️ إعدادات المحل</div>
      <div class="page-subtitle">معلومات المحل، الضريبة، وربط JoFotara</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">

      <!-- بيانات المحل -->
      <div class="card">
        <div class="card-header"><div class="card-title">🏪 بيانات المحل</div></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">اسم المحل *</label>
            <input type="text" class="form-control" id="set-name" value="${s.name||''}"></div>
          <div class="form-group"><label class="form-label">رقم الهاتف</label>
            <input type="tel"  class="form-control" id="set-phone" value="${s.phone||''}"></div>
          <div class="form-group"><label class="form-label">العنوان</label>
            <input type="text" class="form-control" id="set-address" value="${s.address||''}"></div>
          <div class="form-group"><label class="form-label">بادئة الفاتورة</label>
            <input type="text" class="form-control" id="set-prefix" value="${s.invoicePrefix||'INV'}"
                   placeholder="INV" style="font-family:'JetBrains Mono',monospace;"></div>
          <button class="btn btn-primary" onclick="window._settings.save()">حفظ التغييرات ✓</button>
        </div>
      </div>

      <!-- معلومات النظام -->
      <div class="card">
        <div class="card-header"><div class="card-title">ℹ️ معلومات النظام</div></div>
        <div class="card-body">
          <div style="font-size:13px;color:var(--text2);line-height:2.4;">
            <div>🔑 Shop ID:</div>
            <div class="mono" style="color:var(--accent);font-size:11px;word-break:break-all;
                 background:var(--bg);padding:6px 10px;border-radius:6px;margin-bottom:10px;">
              ${shopId()||'—'}
            </div>
            <div>📅 تاريخ الإنشاء: ${s.createdAt?new Date(s.createdAt).toLocaleDateString('ar-JO'):'—'}</div>
            <div>💱 العملة: دينار أردني (JOD)</div>
            <div>🏛️ ضمان: موظف 7.5٪ + صاحب عمل 14.25٪</div>
            <div>🧾 الفواتير المُصدرة: ${s.invoiceSeq||0}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- إعدادات الضريبة وJoFotara -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">🏛️ إعدادات الضريبة وJoFotara</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:13px;font-weight:700;color:${s.taxEnabled?'var(--success)':'var(--text2)'};">
            ${s.taxEnabled?'✅ مفعّلة':'غير مفعّلة'}
          </span>
        </div>
      </div>
      <div class="card-body">

        <!-- Toggle -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:16px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:20px;">
          <div>
            <div style="font-weight:700;font-size:14px;">تفعيل الفوترة الإلكترونية (JoFotara)</div>
            <div style="font-size:12px;color:var(--text2);margin-top:4px;">
              عند التفعيل، الفواتير تُرسل تلقائياً لنظام ضريبة الدخل والمبيعات الأردني
            </div>
          </div>
          <label style="position:relative;width:52px;height:28px;cursor:pointer;flex-shrink:0;">
            <input type="checkbox" id="set-tax-enabled" ${s.taxEnabled?'checked':''}
                   onchange="window._settings.toggleTax(this.checked)"
                   style="opacity:0;width:0;height:0;">
            <div id="tax-toggle-slider" style="position:absolute;inset:0;border-radius:100px;
                 background:${s.taxEnabled?'var(--success)':'var(--border)'};transition:all 0.3s;">
              <div style="position:absolute;width:22px;height:22px;background:#fff;border-radius:50%;
                   top:3px;transition:all 0.3s;
                   ${s.taxEnabled?'right:3px;':'left:3px;'}
                   box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>
            </div>
          </label>
        </div>

        <!-- Tax fields (shown when enabled) -->
        <div id="tax-fields" style="${!s.taxEnabled?'opacity:0.4;pointer-events:none;':''}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">الرقم الضريبي (TIN) *</label>
              <input type="text" class="form-control" id="set-tax-num"
                     value="${s.taxNumber||''}"
                     placeholder="الرقم الضريبي المسجل"
                     style="font-family:'JetBrains Mono',monospace;">
            </div>
            <div class="form-group">
              <label class="form-label">تسلسل مصدر الدخل</label>
              <input type="text" class="form-control" id="set-income-seq"
                     value="${s.incomeSequence||''}"
                     placeholder="من بوابة JoFotara"
                     style="font-family:'JetBrains Mono',monospace;">
            </div>
            <div class="form-group">
              <label class="form-label">نسبة ضريبة المبيعات %</label>
              <input type="number" class="form-control" id="set-tax-rate"
                     value="${s.taxRate||16}" min="0" max="100" step="0.5">
            </div>
            <div class="form-group">
              <label class="form-label">فئة الضريبة</label>
              <select class="form-control" id="set-tax-cat">
                <option value="Standard"  ${s.taxCategory==='Standard'?'selected':''}>Standard (16%)</option>
                <option value="ZeroTax"   ${s.taxCategory==='ZeroTax'?'selected':''}>Zero Tax (0%)</option>
                <option value="Exempted"  ${s.taxCategory==='Exempted'?'selected':''}>Exempted</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">رمز المدينة</label>
              <input type="text" class="form-control" id="set-city-code"
                     value="${s.cityCode||'JO-AM'}"
                     placeholder="JO-AM / JO-IR..."
                     style="font-family:'JetBrains Mono',monospace;">
            </div>
            <div class="form-group">
              <label class="form-label">البيئة</label>
              <select class="form-control" id="set-jof-env">
                <option value="staging"    ${(!s.jofotaraEnv||s.jofotaraEnv==='staging')?'selected':''}>🧪 Staging (تجريبي)</option>
                <option value="production" ${s.jofotaraEnv==='production'?'selected':''}>🟢 Production (حقيقي)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">🔑 Flick API Key (JoFotara Middleware)</label>
            <input type="password" class="form-control" id="set-jof-key"
                   value="${s.jofotaraApiKey||''}"
                   placeholder="x-flick-auth-key من حسابك على Flick Network"
                   style="font-family:'JetBrains Mono',monospace;">
            <div style="font-size:11px;color:var(--text2);margin-top:6px;">
              احصل على الـ API Key من
              <a href="https://flick.network" target="_blank" style="color:var(--accent);">flick.network</a>
              · يدعم sandbox وproduction
            </div>
          </div>

          <div style="padding:12px 16px;background:rgba(108,99,255,0.08);border:1px solid rgba(108,99,255,0.2);
               border-radius:var(--radius-sm);font-size:13px;color:var(--text2);margin-bottom:16px;">
            💡 <strong>كيف تبدأ:</strong>
            سجّل على <strong>portal.jofotara.gov.jo</strong> واحصل على Client ID وSecret.
            ثم سجّل على <strong>flick.network</strong> للحصول على API Key يتوسط بينك وبين JoFotara.
          </div>

          <button class="btn btn-info btn-sm" onclick="window._settings.testJoFotara()">
            🧪 اختبار الاتصال بـ JoFotara
          </button>
          <div id="jof-test-result" style="margin-top:8px;"></div>
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
          <button class="btn btn-primary" onclick="window._settings.save()">حفظ جميع الإعدادات ✓</button>
        </div>
      </div>
    </div>
  `;
}

window._settings = {
  toggleTax(enabled) {
    const slider = document.getElementById('tax-toggle-slider');
    const fields = document.getElementById('tax-fields');
    if (slider) {
      slider.style.background = enabled ? 'var(--success)' : 'var(--border)';
      const dot = slider.querySelector('div');
      if (dot) { dot.style.right = enabled?'3px':''; dot.style.left = enabled?'':'3px'; }
    }
    if (fields) { fields.style.opacity = enabled?'1':'0.4'; fields.style.pointerEvents = enabled?'':'none'; }
  },

  async save() {
    const name     = document.getElementById('set-name')?.value.trim();
    const phone    = document.getElementById('set-phone')?.value.trim()||'';
    const address  = document.getElementById('set-address')?.value.trim()||'';
    const prefix   = document.getElementById('set-prefix')?.value.trim()||'INV';
    const taxEnabled = document.getElementById('set-tax-enabled')?.checked || false;
    const taxNumber  = document.getElementById('set-tax-num')?.value.trim()||'';
    const incomeSeq  = document.getElementById('set-income-seq')?.value.trim()||'';
    const taxRate    = parseFloat(document.getElementById('set-tax-rate')?.value)||16;
    const taxCat     = document.getElementById('set-tax-cat')?.value||'Standard';
    const cityCode   = document.getElementById('set-city-code')?.value.trim()||'JO-AM';
    const jofEnv     = document.getElementById('set-jof-env')?.value||'staging';
    const jofKey     = document.getElementById('set-jof-key')?.value.trim()||'';

    if (!name) { toast('اسم المحل مطلوب', 'danger'); return; }
    if (taxEnabled && !taxNumber) { toast('الرقم الضريبي مطلوب عند تفعيل JoFotara', 'danger'); return; }

    try {
      await setDoc(doc(db, COLLECTIONS.SETTINGS, shopId()), {
        shopId:           shopId(),
        name, phone, address,
        invoicePrefix:    prefix,
        invoiceSeq:       state.settings?.invoiceSeq || 0,
        currency:         'JOD',
        frozen:           state.settings?.frozen || false,
        createdAt:        state.settings?.createdAt || new Date().toISOString(),
        // Tax & JoFotara
        taxEnabled,
        taxNumber,
        incomeSequence:   incomeSeq,
        taxRate,
        taxCategory:      taxCat,
        cityCode,
        jofotaraEnv:      jofEnv,
        jofotaraApiKey:   jofKey,
      });
      toast('✅ تم حفظ الإعدادات');
    } catch(err) { toast('❌ ' + err.message, 'danger'); }
  },

  async testJoFotara() {
    const key     = document.getElementById('set-jof-key')?.value.trim();
    const env     = document.getElementById('set-jof-env')?.value||'staging';
    const resEl   = document.getElementById('jof-test-result');
    if (!key) { if(resEl) resEl.innerHTML='<div class="alert alert-warning">⚠️ أدخل API Key أولاً</div>'; return; }

    const base = env==='production'
      ? 'https://api.flick.network/jo'
      : 'https://staging-api.flick.network/jo';

    if(resEl) resEl.innerHTML='<div class="alert alert-info">🔄 جاري الاختبار...</div>';
    try {
      const res = await fetch(base + '/health', {
        headers: { 'x-flick-auth-key': key }
      });
      if (res.ok) {
        if(resEl) resEl.innerHTML='<div class="alert alert-success">✅ الاتصال بـ JoFotara (' + env + ') يعمل بنجاح</div>';
      } else {
        if(resEl) resEl.innerHTML='<div class="alert alert-danger">❌ فشل الاتصال — تحقق من الـ API Key (status: ' + res.status + ')</div>';
      }
    } catch(err) {
      if(resEl) resEl.innerHTML='<div class="alert alert-warning">⚠️ لا يمكن الوصول — تحقق من الاتصال بالإنترنت</div>';
    }
  },
};
