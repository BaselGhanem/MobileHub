// src/js/router.js
import { currentUser, canAccess, ROLES } from './auth.js';
import { state } from './state.js';

// ── Module registry (id → { label, icon, group, render() }) ──
const _modules = {};

export function registerModule(id, { label, icon, group, render }) {
  _modules[id] = { label, icon, group, render };
}

// ── Nav structure ──
const NAV_GROUPS = [
  {
    label: null,
    items: ['overview'],
  },
  {
    label: 'العمليات',
    items: ['maintenance', 'pos', 'invoices', 'mywork'],
  },
  {
    label: 'المشتريات والمخزون',
    items: ['stock-purchases', 'other-purchases', 'warehouse'],
  },
  {
    label: 'الموارد البشرية',
    items: ['hr'],
  },
  {
    label: 'التقارير',
    items: ['reports'],
  },
  {
    label: 'الإعدادات',
    items: ['manage-techs', 'settings'],
  },
];

// ── Build sidebar ──
export function buildSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;

  const shop = state.settings?.name || 'Mobile Hub';
  const shopEl = document.getElementById('sidebarShopName');
  if (shopEl) shopEl.textContent = shop;

  let html = '';
  NAV_GROUPS.forEach(group => {
    const visibleItems = group.items.filter(id => canAccess(id) && _modules[id]);
    if (!visibleItems.length) return;

    if (group.label) {
      html += `<div class="nav-group-label">${group.label}</div>`;
    }

    visibleItems.forEach(id => {
      const m = _modules[id];
      const isActive = state.activeModule === id;
      html += `
        <button class="nav-item ${isActive ? 'active' : ''}" onclick="window._router.go('${id}')" id="nav-${id}">
          <span class="nav-icon">${m.icon}</span>
          <span>${m.label}</span>
        </button>
      `;
    });
  });

  nav.innerHTML = html;
  buildBottomNav();
}

// ── Bottom nav (mobile — 5 most important items) ──
const BOTTOM_NAV_ITEMS = {
  admin:   ['overview', 'maintenance', 'pos', 'invoices', 'warehouse', 'reports'],
  tech:    ['mywork'],
  cashier: ['pos', 'maintenance'],
};

function buildBottomNav() {
  const el = document.getElementById('bottomNav');
  if (!el) return;
  const role = currentUser?.role || 'tech';
  const items = BOTTOM_NAV_ITEMS[role] || [];
  el.innerHTML = items
    .filter(id => _modules[id])
    .map(id => {
      const m = _modules[id];
      const active = state.activeModule === id;
      return `
        <button class="bottom-nav-item ${active ? 'active' : ''}" onclick="window._router.go('${id}')">
          <span class="icon">${m.icon}</span>
          <span>${m.label}</span>
        </button>
      `;
    }).join('');
}

// ── Navigate to a module ──
export function go(moduleId) {
  if (!canAccess(moduleId)) return;
  const m = _modules[moduleId];
  if (!m) return;

  // update active state
  state.activeModule = moduleId;

  // highlight sidebar
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${moduleId}`)?.classList.add('active');

  // update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));

  // render content
  const area = document.getElementById('contentArea');
  if (area) {
    area.innerHTML = `<div class="page fade-in">${m.render()}</div>`;
  }

  // close sidebar on mobile
  closeSidebar();

  // update bottom nav active
  buildBottomNav();
}

// ── Sidebar toggle (mobile) ──
export function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  document.getElementById('sidebar')?.classList.toggle('open', state.sidebarOpen);
  document.getElementById('sidebarOverlay')?.classList.toggle('open', state.sidebarOpen);
}

export function closeSidebar() {
  state.sidebarOpen = false;
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// ── Expose globally so onclick="" in HTML works ──
window._router = { go, toggleSidebar, closeSidebar };
