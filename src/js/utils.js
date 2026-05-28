// src/js/utils.js

// ── Currency ──
export const currency = (n) => `${Number(n || 0).toFixed(2)} د.أ`;

// ── Date ──
export const today    = () => new Date().toISOString().slice(0, 10);
export const nowMonth = () => new Date().toISOString().slice(0, 7);
export const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('ar-JO') : '—';
export const daysDiff = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);

// ── ID generators ──
export const genId = (prefix) =>
  `${prefix}-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;

// ── Status badge HTML ──
const MAINT_STATUS = {
  'استلام':  { cls: 'badge-received',   icon: '📥' },
  'تشخيص':  { cls: 'badge-diagnosing',  icon: '🔍' },
  'إصلاح':  { cls: 'badge-repairing',   icon: '🔧' },
  'جاهز':   { cls: 'badge-ready',       icon: '✅' },
  'تسليم':  { cls: 'badge-delivered',   icon: '📦' },
};
export const statusBadge = (status) => {
  const s = MAINT_STATUS[status] || { cls: '', icon: '•' };
  return `<span class="badge ${s.cls}">${s.icon} ${status}</span>`;
};

export const MAINT_STATUSES = Object.keys(MAINT_STATUS);

// ── Payment badge ──
export const payBadge = (method) => {
  const map = { 'كاش': 'badge-ready', 'شبكة': 'badge-received', 'آجل': 'badge-pending', 'تحويل': 'badge-received' };
  return `<span class="badge ${map[method] || ''}">${method}</span>`;
};

// ── WhatsApp link ──
export const waLink = (phone, msg) => {
  const num = phone.startsWith('0') ? '962' + phone.slice(1) : phone;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
};
export const waBtn = (phone, msg) =>
  `<a class="whatsapp-btn" href="${waLink(phone, msg)}" target="_blank">📱 واتساب</a>`;

// ── Toast notifications ──
let _toastTimer = null;
export function toast(msg, type = 'success', duration = 3500) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(80px);
      background:var(--surface); border:1px solid var(--border); border-radius:12px;
      padding:12px 20px; font-size:14px; font-weight:700; z-index:9999;
      box-shadow:var(--shadow); display:flex; align-items:center; gap:10px;
      transition:transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.4s;
      opacity:0; font-family:'Cairo',sans-serif; direction:rtl; min-width:220px;
    `;
    document.body.appendChild(el);
  }
  const icons = { success:'✅', danger:'❌', warning:'⚠️', info:'ℹ️' };
  const colors = { success:'var(--success)', danger:'var(--danger)', warning:'var(--warning)', info:'var(--info)' };
  el.innerHTML = `<span style="color:${colors[type]}">${icons[type]}</span> ${msg}`;
  el.style.borderColor = colors[type];
  el.style.transform = 'translateX(-50%) translateY(0)';
  el.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.style.transform = 'translateX(-50%) translateY(80px)';
    el.style.opacity = '0';
  }, duration);
}

// ── Confirm dialog (returns Promise<bool>) ──
export function confirm2(msg) {
  return new Promise(resolve => {
    // use native for now — can replace with custom modal
    resolve(window.confirm(msg));
  });
}

// ── Open / Close modal ──
export function openModal(id)  { document.getElementById(id)?.classList.add('open');    }
export function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Close modals on overlay click ──
export function initModalClosers() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}

// ── Render empty state ──
export const emptyState = (icon, msg) => `
  <div class="table-empty">
    <div class="icon">${icon}</div>
    <p>${msg}</p>
  </div>
`;

// ── Number with JD formatting ──
export const jd = (n) => Number(n || 0).toFixed(2);

// ── Percentage ──
export const pct = (part, total) => total ? ((part / total) * 100).toFixed(1) : '0.0';

// ── Bar HTML ──
export const bar = (val, max, color = 'var(--accent)') => {
  const w = max ? Math.min((val / max) * 100, 100).toFixed(1) : 0;
  return `<div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color};"></div></div>`;
};

// ── Avatar initial ──
export const avatarEl = (letter, size = 'md') =>
  `<div class="avatar avatar-${size}">${letter}</div>`;

// ── Pagination helper ──
export function paginate(arr, page, perPage = 20) {
  const start = (page - 1) * perPage;
  return {
    items: arr.slice(start, start + perPage),
    total: arr.length,
    pages: Math.ceil(arr.length / perPage),
    page,
  };
}

// ── Debounce ──
export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
