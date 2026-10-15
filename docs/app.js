(() => {
  'use strict';

  // Environment & API
  const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = `${localHost ? location.origin : 'https://theatre-api.jvideo.dev'}/api`;

  // DOM Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix || 'id'}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

  // Formatting & Date Helpers
  const fmtDate = v => {
    if (!v) return '—';
    const d = new Date(`${String(v).slice(0, 10)}T12:00:00`);
    return Number.isNaN(+d)
      ? String(v)
      : d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
  };

  const fmtLong = v => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(+d)
      ? v
      : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const initials = name =>
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(x => x[0])
      .join('')
      .toUpperCase();

  const timeNow = () => new Date().toISOString();
  const today = () => new Date().toISOString().slice(0, 10);
  const sameDate = (a, b) => String(a || '').slice(0, 10) === String(b || '').slice(0, 10);

  // Modern SVG Icons Library
  const ICONS = {
    overview: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    events: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    rooms: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 21V10h12v11M9 14h6"/></svg>',
    inventory: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    maintenance: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    crew: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    checklist: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    handoffs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
    incidents: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    refresh: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    print: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  // State Management
  let user = null;
  let state = null;
  let revision = 0;
  let currentPage = 'overview';
  let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let currentEventDetail = null;
  let currentFilter = '';
  let currentStatusFilter = 'All';
  let currentPriorityFilter = 'All';
  let sortColumn = null;
  let sortAsc = true;
  let settingsTab = 'venue';
  let eventTab = 'calendar';
  let lastSavedAt = null;
  let saving = false;
  let paletteActive = false;

  const isAdmin = () => user?.role === 'Administrator';

  // Navigation Items
  const NAV = [
    {
      group: 'OPERATIONS',
      items: [
        ['overview', ICONS.overview, 'Overview / Dashboard'],
        ['events', ICONS.events, 'Events & Bookings'],
        ['crew', ICONS.crew, 'Crew Schedule & Calls'],
        ['checklist', ICONS.checklist, 'Shift Checklist'],
        ['handoffs', ICONS.handoffs, 'Shift Handoff'],
        ['incidents', ICONS.incidents, 'Incident Register']
      ]
    },
    {
      group: 'VENUE',
      items: [
        ['rooms', ICONS.rooms, 'Rooms & Facilities'],
        ['inventory', ICONS.inventory, 'Equipment Inventory'],
        ['maintenance', ICONS.maintenance, 'Maintenance & Service']
      ]
    },
    {
      group: 'ADMINISTRATION',
      items: [
        ['settings', ICONS.settings, 'Settings & Admin', true]
      ]
    }
  ];

  const PAGE_NAMES = {
    overview: 'Overview / Dashboard',
    events: 'Events & Bookings',
    rooms: 'Rooms & Facilities',
    inventory: 'Equipment Inventory',
    maintenance: 'Maintenance & Service Desk',
    crew: 'Crew Schedule & Call Sheet',
    checklist: 'Shift Checklist',
    handoffs: 'Shift Handoff',
    incidents: 'Incident Register',
    settings: 'Settings & Administration'
  };

  // Domain Queries
  const ACTIVE_EVENT = () => state?.events?.find(e => e.id === state.activeEventId) || state?.events?.[0] || null;

  const workFor = eventId => {
    if (!state.workspaces) state.workspaces = {};
    if (!state.workspaces[eventId]) state.workspaces[eventId] = { shifts: [], incidents: [], handoffs: [] };
    const ws = state.workspaces[eventId];
    ws.shifts ||= [];
    ws.incidents ||= [];
    ws.handoffs ||= [];
    return ws;
  };

  const accountName = id =>
    state?.users?.find(u => u.id === id)?.displayName ||
    state?.users?.find(u => u.id === id)?.username ||
    'Unassigned';

  const getRoom = id => state?.rooms?.find(r => r.id === id);
  const getAsset = id => state?.assets?.find(a => a.id === id);
  const roomNames = ids => (ids || []).map(id => getRoom(id)?.name || 'Unknown room').join(', ') || 'No rooms assigned';

  const options = (values, selected, blank = 'Select…') =>
    `${blank !== null ? `<option value="">${esc(blank)}</option>` : ''}${(values || [])
      .map(v => {
        const value = typeof v === 'object' ? v.value : v;
        const label = typeof v === 'object' ? v.label : v;
        return `<option value="${esc(value)}" ${String(selected ?? '') === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
      })
      .join('')}`;

  const statusTone = status =>
    ({
      Available: 'green',
      Confirmed: 'green',
      Complete: 'green',
      Resolved: 'green',
      'In progress': 'blue',
      Assigned: 'blue',
      'Limited access': 'amber',
      Tentative: 'amber',
      'Needs service': 'amber',
      Blocked: 'amber',
      High: 'amber',
      Urgent: 'red',
      'Out of service': 'red',
      Missing: 'red',
      Closed: 'red',
      'Under maintenance': 'red',
      Cancelled: 'red',
      Performance: 'purple'
    }[status] || '');

  const badge = status => `<span class="status ${statusTone(status)}">${esc(status || 'Unknown')}</span>`;

  const btn = (label, action, kind = 'secondary', extras = '') => {
    const actionMatch = extras.match(/data-action="([^"]+)"/);
    const typeMatch = extras.match(/type="([^"]+)"/);
    const actionValue = actionMatch ? actionMatch[1] : action;
    const typeValue = typeMatch ? typeMatch[1] : 'button';
    const attrs = extras
      .replace(/class="[^"]*"/g, '')
      .replace(/data-action="[^"]*"/g, '')
      .replace(/type="[^"]*"/g, '');
    return `<button type="${typeValue}" class="btn btn-${kind}" data-action="${esc(actionValue)}" ${attrs}>${label}</button>`;
  };

  const iconBtn = (iconHtml, action, title = '') =>
    `<button type="button" class="icon-btn" aria-label="${esc(title)}" title="${esc(title)}" data-action="${esc(action)}">${iconHtml}</button>`;

  const empty = (title, description, action = '', label = '') =>
    `<div class="empty"><div class="empty-icon">${ICONS.maintenance}</div><strong>${esc(title)}</strong><p>${esc(description)}</p>${
      action ? `<div style="margin-top:14px">${btn(label, action, 'primary')}</div>` : ''
    }</div>`;

  const metric = (label, value, iconHtml, foot = '') =>
    `<div class="metric"><div class="metric-top"><span>${esc(label)}</span><span class="metric-icon">${iconHtml}</span></div><div class="metric-value">${esc(
      value
    )}</div>${foot ? `<div class="metric-foot">${esc(foot)}</div>` : ''}</div>`;

  const panel = (title, body, action = '', subtitle = '') =>
    `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">${title}</h2>${
      subtitle ? `<div class="panel-subtitle">${subtitle}</div>` : ''
    }</div>${action ? `<button class="panel-link" data-action="${action}">View all →</button>` : ''}</div><div class="panel-body">${body}</div></section>`;

  const tableEmptyRow = (span, label) =>
    `<tr><td colspan="${span}" style="text-align:center;padding:36px;color:var(--text-muted)">${esc(label)}</td></tr>`;

  // API Client
  async function api(path, method = 'GET', body = null) {
    const response = await fetch(`${API}${path}`, {
      method,
      credentials: 'include',
      headers: body === null ? {} : { 'Content-Type': 'application/json' },
      body: body === null ? undefined : JSON.stringify(body)
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      /* no json body */
    }
    if (!response.ok) {
      const e = new Error(data.error || `Request failed (${response.status})`);
      e.status = response.status;
      e.details = data.details;
      e.retryAfter = response.headers.get('Retry-After');
      throw e;
    }
    return data;
  }

  async function loadState() {
    const result = await api('/state');
    state = result.state;
    user = result.user;
    revision = result.revision;
    state._revision = revision;
    lastSavedAt = state.meta?.lastUpdatedAt || null;
  }

  function toast(message, type = 'success') {
    const region = $('#toast-region');
    if (!region) return;
    const box = document.createElement('div');
    box.className = `toast ${type}`;
    box.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span><span>${esc(message)}</span>`;
    region.appendChild(box);
    setTimeout(() => {
      box.style.opacity = '0';
      box.style.transform = 'translateY(8px)';
      box.style.transition = 'all 0.2s ease';
      setTimeout(() => box.remove(), 220);
    }, 3800);
  }

  async function refreshAll(notify = false) {
    try {
      await loadState();
      render();
      if (notify) toast('Shared venue record refreshed.');
    } catch (err) {
      if (err.status === 401) renderLogin();
      else toast(err.message || 'Could not refresh shared data.', 'error');
    }
  }

  async function saveState(mutator, successMessage = 'Changes saved.') {
    if (saving) {
      toast('A save is already in progress.', 'error');
      return false;
    }
    const previous = clone(state);
    const revBefore = revision;
    if (typeof mutator === 'function') mutator(state);
    state.meta ||= {};
    state.meta.lastUpdatedAt = timeNow();
    saving = true;
    updateConnection('warning', 'Saving changes…');
    try {
      const result = await api('/state', 'PUT', { revision: revBefore, state });
      revision = result.revision;
      state._revision = revision;
      lastSavedAt = result.savedAt;
      updateConnection('online', `Saved ${new Date(result.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
      saving = false;
      render();
      if (successMessage) toast(successMessage);
      return true;
    } catch (err) {
      saving = false;
      state = previous;
      if (err.status === 409) {
        try {
          await loadState();
          render();
        } catch {
          /* preserve */
        }
        toast('A newer version exists on the server. Latest record loaded; please reapply your change.', 'error');
      } else if (err.status === 401) {
        user = null;
        renderLogin();
      } else {
        updateConnection('offline', 'Save failed');
        toast(err.message || 'Save failed. Your changes were not saved.', 'error');
      }
      return false;
    }
  }

  function updateConnection(mode, text) {
    const el = $('#connection-indicator');
    if (!el) return;
    el.className = `connection ${mode === 'online' ? '' : mode === 'offline' ? 'offline' : 'warning'}`;
    el.innerHTML = `<span class="connection-dot"></span><span>${esc(text)}</span>`;
  }

  // Theme Management (Booth / Night Mode vs Studio / Day Mode)
  function initTheme() {
    const saved = localStorage.getItem('backstage_theme') || 'dark';
    setTheme(saved);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('backstage_theme', theme);
    const meta = $('#meta-theme-color');
    if (meta) meta.content = theme === 'dark' ? '#090d16' : '#f1f5f9';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    render();
    toast(`Switched to ${next === 'dark' ? 'Booth (Night)' : 'Studio (Day)'} mode.`);
  }

  // UI Renderers
  function renderLogin(error = '') {
    $('#modal-root').innerHTML = '';
    $('#palette-root').innerHTML = '';
    $('#app').innerHTML = `
      <div class="login-wrap">
        <div class="login-brand">
          <div class="side-brand" style="padding:0;border:0">
            <span class="brand-mark">B</span>
            <div>
              <div class="brand-title" style="font-size:24px">Backstage</div>
              <div class="brand-sub">VENUE OPERATIONS</div>
            </div>
          </div>
          <h1>Keep the show<br>moving forward.</h1>
          <p>One operational workspace for technical crews, bookings, equipment inventory, service tickets, and seamless shift handoffs.</p>
          <div class="login-highlights">
            <span><i></i> Shared venue records</span>
            <span><i></i> Role-based permissions</span>
            <span><i></i> Live conflict checks</span>
          </div>
        </div>
        <form class="login-card" id="login-form">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:var(--primary);margin-bottom:10px">SECURE ACCESS</div>
          <h2>Sign in to Backstage</h2>
          <p>Sign in with your technician or administrator account.</p>
          ${error ? `<div class="login-error" role="alert">${esc(error)}</div>` : ''}
          <div class="field" style="margin-bottom:16px">
            <label for="login-username">Username</label>
            <input id="login-username" name="username" autocomplete="username" required autofocus placeholder="e.g. admin or tech_alex" />
          </div>
          <div class="field" style="margin-bottom:20px">
            <label for="login-password">Password</label>
            <input id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••••••" />
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;padding:12px">Sign in <span>→</span></button>
          <div class="helper" style="margin-top:18px;text-align:center">Accounts and access are managed by your venue administrator.</div>
        </form>
      </div>`;

    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const submitBtn = $('button[type="submit"]', e.currentTarget);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating…';
      try {
        await api('/auth/login', 'POST', {
          username: form.get('username'),
          password: form.get('password')
        });
        await loadState();
        currentPage = 'overview';
        render();
      } catch (err) {
        renderLogin(err.message);
      }
    });
  }

  function render() {
    if (!user || !state) return renderLogin();
    const active = ACTIVE_EVENT();
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    const nav = NAV.map(
      group => `
      <div class="nav-group">
        <div class="nav-heading">${group.group}</div>
        ${group.items
          .filter(([id, icon, label, adminOnly]) => !adminOnly || isAdmin())
          .map(([id, icon, label]) => {
            const count =
              id === 'incidents'
                ? state.events.reduce((sum, e) => sum + workFor(e.id).incidents.filter(i => i.status !== 'Resolved').length, 0)
                : id === 'maintenance'
                ? state.maintenance.filter(x => x.status !== 'Complete').length
                : 0;
            return `
              <button class="nav-item ${currentPage === id ? 'active' : ''}" data-page="${id}">
                <span class="nav-icon">${icon}</span>
                <span>${label}</span>
                ${count > 0 ? `<span class="nav-count">${count}</span>` : ''}
              </button>`;
          })
          .join('')}
      </div>`
    ).join('');

    $('#app').innerHTML = `
      <div class="app-shell">
        <aside class="sidebar" id="sidebar">
          <div class="side-brand">
            <span class="brand-mark">B</span>
            <div>
              <div class="brand-title">Backstage</div>
              <div class="brand-sub">Venue Operations</div>
            </div>
          </div>
          <nav>${nav}</nav>
          <div class="side-bottom">
            <div class="connection" id="connection-indicator">
              <span class="connection-dot"></span>
              <span>Connected · Saved</span>
            </div>
            <div class="user-mini">
              <span class="avatar">${esc(initials(user.displayName))}</span>
              <div>
                <div class="user-mini-name">${esc(user.displayName)}</div>
                <div class="user-mini-role">${esc(user.role)}</div>
              </div>
              <button class="signout" type="button" title="Sign out" aria-label="Sign out" data-action="logout">
                ${ICONS.logout}
              </button>
            </div>
          </div>
        </aside>
        <div class="main-column">
          <header class="topbar">
            <div class="topbar-left">
              <button type="button" class="icon-btn mobile-menu" data-action="toggle-menu" aria-label="Toggle navigation">
                ${ICONS.menu}
              </button>
              <div>
                <div class="breadcrumb">${esc(state.venue.name)} / OPERATIONS</div>
                <div class="page-title">${esc(PAGE_NAMES[currentPage] || 'Backstage')}</div>
              </div>
            </div>
            <div class="top-actions">
              <button type="button" class="cmd-trigger hide-small" data-action="open-palette">
                ${ICONS.search}
                <span>Search…</span>
                <span class="cmd-key">Ctrl+K</span>
              </button>
              ${
                state.events.length
                  ? `<select class="active-event-select" id="active-event-select" aria-label="Active workspace" ${!isAdmin() ? 'disabled' : ''}>
                      ${state.events.map(e => `<option value="${esc(e.id)}" ${e.id === state.activeEventId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
                     </select>`
                  : ''
              }
              <button type="button" class="icon-btn" data-action="toggle-theme" title="Toggle theme (Booth/Studio)">
                ${currentTheme === 'dark' ? ICONS.sun : ICONS.moon}
              </button>
              <button class="btn btn-secondary hide-small" type="button" data-action="refresh">
                ${ICONS.refresh}
                <span>Refresh</span>
              </button>
              <button class="btn btn-secondary hide-small" type="button" data-action="print">
                ${ICONS.print}
                <span>Print</span>
              </button>
            </div>
          </header>
          <main id="main-content" class="main-content">
            ${renderPage()}
          </main>
        </div>
      </div>`;

    updateConnection(
      'online',
      `Shared record · ${lastSavedAt ? 'saved ' + new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'connected'}`
    );
  }

  function pageIntro(title, description, actions = '') {
    return `<div class="page-intro"><div><h1>${title}</h1><p>${description}</p></div><div class="intro-actions">${actions}</div></div>`;
  }

  function renderPage() {
    switch (currentPage) {
      case 'events': return renderEvents();
      case 'rooms': return renderRooms();
      case 'inventory': return renderInventory();
      case 'maintenance': return renderMaintenance();
      case 'crew': return renderCrew();
      case 'checklist': return renderChecklist();
      case 'handoffs': return renderHandoffs();
      case 'incidents': return renderIncidents();
      case 'settings': return renderSettings();
      default: return renderOverview();
    }
  }

  function isOpenStatus(status) {
    return !['Complete', 'Resolved', 'Cancelled'].includes(status);
  }

  // --- OVERVIEW / DASHBOARD ---
  function renderOverview() {
    const active = ACTIVE_EVENT();
    const upcoming = [...state.events]
      .filter(e => e.status !== 'Cancelled' && e.date >= today() && e.status !== 'Complete')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 5);

    const openMaintenance = state.maintenance.filter(m => m.status !== 'Complete');
    const eventIncidents = state.events
      .flatMap(e => workFor(e.id).incidents.filter(i => i.status !== 'Resolved').map(i => ({ ...i, eventName: e.name, eventId: e.id })))
      .sort((a, b) => ({ Urgent: 0, High: 1, Normal: 2, Low: 3 }[a.priority] ?? 2) - ({ Urgent: 0, High: 1, Normal: 2, Low: 3 }[b.priority] ?? 2));

    const allShifts = state.events
      .flatMap(e => workFor(e.id).shifts.map(s => ({ ...s, event: e })))
      .filter(s => s.date >= today())
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

    const myShifts = allShifts.filter(s => s.userId === user.id);
    const personalShift = myShifts[0] || null;
    const personalProgress = personalShift
      ? checklistProgress(personalShift)
      : { done: 0, total: state.checklistTemplate.flatMap(s => s.tasks || []).length, percent: 0 };

    const recentHandoffs = active
      ? workFor(active.id).handoffs.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 3)
      : [];

    const overviewMetrics = isAdmin()
      ? `${metric('Upcoming Bookings', state.events.filter(e => e.date >= today() && !['Cancelled', 'Complete'].includes(e.status)).length, ICONS.events, 'Active productions & calls')}
         ${metric('Equipment Attention', state.assets.filter(a => ['Needs service', 'Out of service', 'Missing'].includes(a.status)).length, ICONS.incidents, 'Service, down, or missing')}
         ${metric('Open Service Desk', openMaintenance.length, ICONS.maintenance, 'Venue-wide repairs pending')}
         ${metric('Available Spaces', state.rooms.filter(r => r.status === 'Available').length, ICONS.rooms, `${state.rooms.length} tracked venue spaces`)}`
      : `${metric('My Next Call', personalShift ? fmtDate(personalShift.date) : '—', ICONS.crew, personalShift ? `${personalShift.startTime}–${personalShift.endTime}` : 'No upcoming shifts')}
         ${metric('My Calls Today', myShifts.filter(s => sameDate(s.date, today())).length, ICONS.checklist, 'Assigned shifts today')}
         ${metric('Active Incidents', eventIncidents.length, ICONS.incidents, 'Unresolved venue items')}
         ${metric('Service Tickets', openMaintenance.length, ICONS.maintenance, 'Open repair requests')}`;

    const mainBody = active
      ? `<div class="record-row">
           <span class="alert-mark blue">${ICONS.events}</span>
           <div class="row-main">
             <div class="row-title">${esc(active.name)}</div>
             <div class="row-sub">${esc(active.type)} · ${fmtDate(active.date)} · ${esc(roomNames(active.roomIds))}</div>
             <div class="row-sub" style="margin-top:6px">Phase: <strong>${esc(active.phase || 'Not set')}</strong> · Status: ${badge(active.status)}</div>
           </div>
           <div>${btn('Open workspace', 'open-event:' + active.id, 'secondary', 'class="btn btn-secondary btn-small" data-action="open-event" data-id="' + esc(active.id) + '"')}</div>
         </div>
         <div class="grid-3" style="margin-top:16px;margin-bottom:0">
           <div class="detail-box">
             <div class="detail-label">Access / Call</div>
             <div class="detail-value">${esc(active.accessTime || '—')} / ${esc(active.callTime || '—')}</div>
           </div>
           <div class="detail-box">
             <div class="detail-label">Technical Lead</div>
             <div class="detail-value">${esc(active.technicalLead || 'Not assigned')}</div>
           </div>
           <div class="detail-box">
             <div class="detail-label">Comms / Radio</div>
             <div class="detail-value">${esc(active.radioChannel || '—')}</div>
           </div>
         </div>`
      : empty('No active event', 'Select or create a booking to open an operational workspace.', 'new-event', 'Create event');

    const alertItems = [
      ...eventIncidents.slice(0, 4).map(i => ({
        icon: ICONS.incidents,
        tone: i.priority === 'Urgent' || i.priority === 'High' ? 'danger' : '',
        title: i.title,
        sub: `${i.eventName} · ${i.location || 'Location not specified'}`,
        right: i.priority || 'Normal',
        action: 'open-incident',
        id: i.id,
        eventId: i.eventId
      })),
      ...openMaintenance
        .filter(m => m.priority === 'Urgent' || m.priority === 'High')
        .slice(0, 3)
        .map(m => ({
          icon: ICONS.maintenance,
          tone: 'danger',
          title: m.title,
          sub: `Maintenance · ${m.roomName || getRoom(m.roomId)?.name || getAsset(m.assetId)?.name || 'Venue-wide'}`,
          right: m.priority,
          action: 'go-maintenance'
        }))
    ].slice(0, 5);

    const shiftBody = (isAdmin() ? allShifts : myShifts)
      .slice(0, 5)
      .map(
        s => `
        <div class="record-row">
          <span class="avatar">${esc(initials(accountName(s.userId)))}</span>
          <div class="row-main">
            <div class="row-title">${esc(accountName(s.userId))} <span class="muted" style="font-weight:400">· ${esc(s.event.name)}</span></div>
            <div class="row-sub">${fmtDate(s.date)} · ${esc(s.startTime)}–${esc(s.endTime)}${s.notes ? ` · ${esc(s.notes)}` : ''}</div>
          </div>
          <div class="row-right">
            ${sameDate(s.date, today()) ? '<span class="status blue">Today</span>' : `<span class="small muted">${fmtDate(s.date)}</span>`}
          </div>
        </div>`
      )
      .join('');

    return `
      ${pageIntro(
        `Welcome, ${esc(user.displayName.split(' ')[0])}.`,
        `Real-time operations center for ${esc(state.venue.name)}. All records are synchronized.`,
        `${isAdmin() ? btn(`${ICONS.plus} New Event`, 'new-event', 'primary') : btn(`${ICONS.plus} Report Service Need`, 'new-maintenance', 'primary')}
         ${btn('View Call Sheet', 'goto-crew', 'secondary')}
         <button class="btn btn-secondary hide-small" data-action="open-palette">${ICONS.search} Quick Search</button>`
      )}
      <div class="metrics">${overviewMetrics}</div>
      <div class="grid-2">
        <div class="stack">
          ${panel('Active Workspace', mainBody, 'goto-events', 'Current event technical scope')}
          ${panel(
            isAdmin() ? 'Crew Coverage' : 'My Upcoming Calls',
            shiftBody ||
              empty(
                isAdmin() ? 'No upcoming calls' : 'No calls assigned',
                isAdmin() ? 'Schedule technician shifts in Crew Schedule.' : 'You have no shifts assigned.'
              ),
            'goto-crew'
          )}
          ${
            !isAdmin()
              ? panel(
                  'My Shift Progress',
                  personalShift
                    ? `<div class="record-row">
                         <div class="row-main">
                           <div class="row-title">${esc(personalShift.notes || 'Technical coverage')}</div>
                           <div class="row-sub">${fmtDate(personalShift.date)} · ${esc(personalShift.startTime)}–${esc(personalShift.endTime)}</div>
                           <div class="progress-track" style="margin-top:12px">
                             <div class="progress-fill" style="width:${personalProgress.percent}%"></div>
                           </div>
                           <div class="row-sub" style="margin-top:6px">${personalProgress.done} of ${personalProgress.total} tasks completed (${personalProgress.percent}%)</div>
                         </div>
                       </div>
                       ${btn('Open Checklist', 'goto-checklist', 'secondary')}`
                    : empty('No active shift', 'Your next checklist will populate when a shift is scheduled.'),
                  'goto-checklist'
                )
              : ''
          }
        </div>
        <div class="stack">
          ${panel(
            'Needs Attention',
            alertItems.length
              ? `<div class="alert-list">
                  ${alertItems
                    .map(
                      a => `
                    <div class="alert-row">
                      <span class="alert-mark ${a.tone}">${a.icon}</span>
                      <div class="row-main">
                        <div class="row-title">${esc(a.title)}</div>
                        <div class="row-sub">${esc(a.sub)}</div>
                      </div>
                      <div class="row-right">
                        ${a.right ? badge(a.right) : ''}
                      </div>
                      ${
                        a.action
                          ? `<button class="icon-btn" style="align-self:center" data-action="${a.action}" ${a.id ? `data-id="${esc(a.id)}"` : ''} ${
                              a.eventId ? `data-event-id="${esc(a.eventId)}"` : ''
                            }>›</button>`
                          : ''
                      }
                    </div>`
                    )
                    .join('')}
                </div>`
              : empty('Everything clear', 'No open high-priority issues waiting for attention.'),
            'goto-incidents'
          )}
          ${panel(
            'Upcoming Bookings',
            upcoming.length
              ? `<div class="record-list">
                  ${upcoming
                    .map(
                      e => `
                    <div class="record-row">
                      <div class="row-main">
                        <div class="row-title">${esc(e.name)}</div>
                        <div class="row-sub">${fmtDate(e.date)} · ${esc(e.type)} · ${esc(roomNames(e.roomIds))}</div>
                      </div>
                      <div class="row-right">${badge(e.status)}</div>
                    </div>`
                    )
                    .join('')}
                </div>`
              : empty('No upcoming bookings', 'Bookings scheduled in the calendar will display here.'),
            'goto-events'
          )}
        </div>
      </div>
      <div class="footer-note">Backstage · Shared Venue Record · Revision ${revision} · ${esc(state.venue.timezone)}</div>`;
  }

  // --- EVENTS & BOOKINGS ---
  function renderEvents() {
    let all = [...state.events];
    if (sortColumn) {
      all.sort((a, b) => {
        let valA = a[sortColumn] ?? '';
        let valB = b[sortColumn] ?? '';
        return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    } else {
      all.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }

    const events = all.filter(
      e =>
        (!currentFilter || `${e.name} ${e.type} ${e.technicalLead || ''} ${e.notes || ''}`.toLowerCase().includes(currentFilter.toLowerCase())) &&
        (currentStatusFilter === 'All' || e.status === currentStatusFilter)
    );

    const month = currentMonth;
    const monthName = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const prevDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const raw = i - firstDay + 1;
      let day = raw,
        muted = false,
        date = '';
      if (raw < 1) {
        day = prevDays + raw;
        muted = true;
        date = `${month.getFullYear()}-${String(month.getMonth()).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else if (raw > days) {
        day = raw - days;
        muted = true;
        const nm = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        date = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      if (i >= 35 && raw > days) continue;

      const dayEvents = all.filter(e => sameDate(e.date, date));
      cells.push(`
        <div class="calendar-day ${muted ? 'muted-day' : ''} ${date === today() ? 'today' : ''}">
          <div class="calendar-day-number">${day}${date === today() ? ' <span style="color:var(--primary)">· today</span>' : ''}</div>
          ${dayEvents
            .slice(0, 3)
            .map(
              e => `
            <button class="event-chip ${e.status === 'Cancelled' ? 'cancelled' : ''}" title="${esc(e.name)}" data-action="open-event" data-id="${esc(e.id)}">
              ${esc(e.name)}
            </button>`
            )
            .join('')}
          ${dayEvents.length > 3 ? `<div class="small muted">+${dayEvents.length - 3} more</div>` : ''}
        </div>`);
    }

    const calendar = `
      <div class="panel">
        <div class="panel-header">
          <div class="calendar-toolbar">
            ${iconBtn('‹', 'calendar-prev', 'Previous month')}
            <span class="calendar-title">${monthName}</span>
            ${iconBtn('›', 'calendar-next', 'Next month')}
            ${btn('Today', 'calendar-today', 'secondary', 'class="btn btn-secondary btn-small" data-action="calendar-today"')}
          </div>
          <div class="small muted">${state.events.length} booking${state.events.length === 1 ? '' : 's'} registered</div>
        </div>
        <div class="calendar">
          ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="calendar-head">${d}</div>`).join('')}
          ${cells.join('')}
        </div>
      </div>`;

    const table = `
      <div class="panel">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">${ICONS.search}</span>
            <input id="event-search" value="${esc(currentFilter)}" placeholder="Search booking, lead, technical notes…" />
          </div>
          <select id="event-status-filter">
            ${options(['All', 'Confirmed', 'Tentative', 'In progress', 'Complete', 'Cancelled'], currentStatusFilter, null)}
          </select>
          <div class="small muted">${events.length} results</div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sortable" data-sort="name">Event ${sortColumn === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th class="sortable" data-sort="date">Date / Call ${sortColumn === 'date' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th>Rooms</th>
                <th class="sortable" data-sort="technicalLead">Technical Lead ${sortColumn === 'technicalLead' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th class="sortable" data-sort="status">Status ${sortColumn === 'status' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                events.length
                  ? events
                      .map(
                        e => `
                <tr>
                  <td>
                    <div class="table-primary">${esc(e.name)}</div>
                    <div class="table-meta">${esc(e.type)} · ${esc(e.phase || 'No phase')}</div>
                  </td>
                  <td>
                    ${fmtDate(e.date)}
                    <div class="table-meta">Access ${esc(e.accessTime || '—')} · Call ${esc(e.callTime || '—')}</div>
                  </td>
                  <td>${esc(roomNames(e.roomIds))}</td>
                  <td>${esc(e.technicalLead || '—')}</td>
                  <td>${badge(e.status)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-secondary btn-small" data-action="open-event" data-id="${esc(e.id)}">Workspace</button>
                      ${isAdmin() ? `<button class="btn btn-quiet btn-small" data-action="edit-event" data-id="${esc(e.id)}">Edit</button>` : ''}
                    </div>
                  </td>
                </tr>`
                      )
                      .join('')
                  : tableEmptyRow(6, 'No bookings match your search filters.')
              }
            </tbody>
          </table>
        </div>
      </div>`;

    return `
      ${pageIntro(
        'Events & Bookings',
        'Catalogue of productions, concerts, rehearsals, and venue calls. Every booking maintains dedicated operational records.',
        `${isAdmin() ? btn(`${ICONS.plus} Create Booking`, 'new-event', 'primary') : ''}
         ${btn(`${ICONS.print} Print Schedule`, 'print', 'secondary')}`
      )}
      <div class="pill-tabs" style="margin-bottom:16px">
        <button class="pill-tab ${eventTab === 'calendar' ? 'active' : ''}" data-action="event-tab" data-tab="calendar">Interactive Calendar</button>
        <button class="pill-tab ${eventTab === 'list' ? 'active' : ''}" data-action="event-tab" data-tab="list">Event Catalogue</button>
      </div>
      ${eventTab === 'calendar' ? calendar : table}`;
  }

  // --- ROOMS & FACILITIES ---
  function renderRooms() {
    let rooms = state.rooms.filter(
      r =>
        (!currentFilter || `${r.name} ${r.code} ${r.type} ${r.accessNotes || ''}`.toLowerCase().includes(currentFilter.toLowerCase())) &&
        (currentStatusFilter === 'All' || r.status === currentStatusFilter)
    );

    if (sortColumn) {
      rooms.sort((a, b) => {
        let valA = a[sortColumn] ?? '';
        let valB = b[sortColumn] ?? '';
        return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    }

    return `
      ${pageIntro(
        'Rooms & Facilities',
        'Directory of physical spaces: main stages, rehearsal studios, backstage green rooms, scene shops, and control booths.',
        `${isAdmin() ? btn(`${ICONS.plus} Add Space`, 'new-room', 'primary') : ''}`
      )}
      <div class="metrics">
        ${metric('Tracked Spaces', state.rooms.length, ICONS.rooms, 'Total venue spaces')}
        ${metric('Available Now', state.rooms.filter(r => r.status === 'Available').length, ICONS.checklist, 'Ready for bookings')}
        ${metric('Limited Access', state.rooms.filter(r => r.status === 'Limited access').length, ICONS.maintenance, 'Review procedures')}
        ${metric('Unavailable', state.rooms.filter(r => ['Under maintenance', 'Closed'].includes(r.status)).length, ICONS.incidents, 'Bookings blocked')}
      </div>
      <div class="panel">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">${ICONS.search}</span>
            <input id="room-search" value="${esc(currentFilter)}" placeholder="Search space name, code, type, access notes…" />
          </div>
          <select id="room-status-filter">
            ${options(['All', 'Available', 'Limited access', 'Under maintenance', 'Closed'], currentStatusFilter, null)}
          </select>
          <span class="small muted">${rooms.length} spaces listed</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sortable" data-sort="name">Room Name ${sortColumn === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th class="sortable" data-sort="type">Type ${sortColumn === 'type' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th class="sortable" data-sort="capacity">Capacity ${sortColumn === 'capacity' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th>Upcoming Bookings</th>
                <th class="sortable" data-sort="status">Status ${sortColumn === 'status' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                rooms.length
                  ? rooms
                      .map(r => {
                        const count = state.events.filter(
                          e => (e.roomIds || []).includes(r.id) && e.date >= today() && !['Cancelled', 'Complete'].includes(e.status)
                        ).length;
                        return `
                  <tr>
                    <td>
                      <div class="table-primary">${esc(r.name)}</div>
                      <div class="table-meta">${esc(r.code)} ${r.accessNotes ? `· ${esc(r.accessNotes)}` : ''}</div>
                    </td>
                    <td>${esc(r.type)}</td>
                    <td>${r.capacity ? esc(r.capacity) : '—'}</td>
                    <td><span class="tag">${count} active</span></td>
                    <td>${badge(r.status)}</td>
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-secondary btn-small" data-action="view-room" data-id="${esc(r.id)}">Details</button>
                        ${
                          isAdmin()
                            ? `<button class="btn btn-quiet btn-small" data-action="edit-room" data-id="${esc(r.id)}">Edit</button>
                               <button class="btn btn-quiet btn-small" data-action="delete-room" data-id="${esc(r.id)}">Remove</button>`
                            : ''
                        }
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join('')
                  : tableEmptyRow(6, 'No rooms match your filter criteria.')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // --- EQUIPMENT INVENTORY ---
  function renderInventory() {
    let assets = state.assets.filter(
      a =>
        (!currentFilter || `${a.name} ${a.tag} ${a.department} ${a.model || ''} ${a.serial || ''}`.toLowerCase().includes(currentFilter.toLowerCase())) &&
        (currentStatusFilter === 'All' || a.status === currentStatusFilter)
    );

    if (sortColumn) {
      assets.sort((a, b) => {
        let valA = a[sortColumn] ?? '';
        let valB = b[sortColumn] ?? '';
        return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    }

    const needs = state.assets.filter(a => ['Needs service', 'Out of service', 'Missing'].includes(a.status)).length;

    return `
      ${pageIntro(
        'Equipment Inventory',
        'Venue-wide technical equipment register across Audio, Lighting, Video, Rigging, Comms, Power, and Staging departments.',
        `${isAdmin() ? btn(`${ICONS.plus} Register Equipment`, 'new-asset', 'primary') : ''}`
      )}
      <div class="metrics">
        ${metric('Tracked Assets', state.assets.length, ICONS.inventory, 'Unique asset tags')}
        ${metric('Ready for Service', state.assets.filter(a => a.status === 'Available').length, ICONS.checklist, 'Operational')}
        ${metric('Assigned', state.assets.filter(a => a.status === 'Assigned').length, ICONS.crew, 'Deployed to show')}
        ${metric('Needs Attention', needs, ICONS.maintenance, 'Down, damaged, or service needed')}
      </div>
      <div class="panel">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">${ICONS.search}</span>
            <input id="asset-search" value="${esc(currentFilter)}" placeholder="Search asset tag, name, department, model, serial…" />
          </div>
          <select id="asset-status-filter">
            ${options(['All', 'Available', 'Assigned', 'Needs service', 'Out of service', 'Missing'], currentStatusFilter, null)}
          </select>
          <span class="small muted">${assets.length} assets</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sortable" data-sort="name">Equipment Tag & Name ${sortColumn === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th class="sortable" data-sort="department">Department ${sortColumn === 'department' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th>Location</th>
                <th>Model / Serial</th>
                <th class="sortable" data-sort="status">Status ${sortColumn === 'status' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                assets.length
                  ? assets
                      .map(
                        a => `
                <tr>
                  <td>
                    <div class="table-primary">${esc(a.name)}</div>
                    <div class="table-meta"><span class="tag">${esc(a.tag)}</span></div>
                  </td>
                  <td>${esc(a.department)}</td>
                  <td>${esc(getRoom(a.roomId)?.name || 'Unassigned')}</td>
                  <td>
                    ${esc(a.model || '—')}
                    <div class="table-meta">${esc(a.serial || 'No serial recorded')}</div>
                  </td>
                  <td>${badge(a.status)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-secondary btn-small" data-action="view-asset" data-id="${esc(a.id)}">Details</button>
                      <button class="btn btn-quiet btn-small" data-action="report-asset" data-id="${esc(a.id)}">Report Issue</button>
                      ${isAdmin() ? `<button class="btn btn-quiet btn-small" data-action="edit-asset" data-id="${esc(a.id)}">Edit</button>` : ''}
                    </div>
                  </td>
                </tr>`
                      )
                      .join('')
                  : tableEmptyRow(6, 'No equipment matches your search query.')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // --- MAINTENANCE & SERVICE DESK ---
  function renderMaintenance() {
    let all = state.maintenance.filter(
      m =>
        (!currentFilter || `${m.title} ${m.description || ''} ${m.reporter || ''} ${getAsset(m.assetId)?.name || ''} ${getRoom(m.roomId)?.name || ''}`.toLowerCase().includes(currentFilter.toLowerCase())) &&
        (currentStatusFilter === 'All' || m.status === currentStatusFilter)
    );

    const priorityOrder = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
    if (sortColumn) {
      all.sort((a, b) => {
        let valA = a[sortColumn] ?? '';
        let valB = b[sortColumn] ?? '';
        return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    } else {
      all.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) || String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    return `
      ${pageIntro(
        'Maintenance & Service Desk',
        'Venue-wide repair queue and equipment maintenance tracking. Resolve service items without disturbing production event records.',
        `${btn(`${ICONS.plus} New Service Ticket`, 'new-maintenance', 'primary')}`
      )}
      <div class="metrics">
        ${metric('Total Tickets', state.maintenance.length, ICONS.maintenance, 'All historical requests')}
        ${metric('Open Triage', state.maintenance.filter(m => m.status === 'Open').length, ICONS.checklist, 'Awaiting triage')}
        ${metric('In Progress', state.maintenance.filter(m => m.status === 'In progress').length, ICONS.refresh, 'Currently being serviced')}
        ${metric('High & Urgent', state.maintenance.filter(m => isOpenStatus(m.status) && ['High', 'Urgent'].includes(m.priority)).length, ICONS.incidents, 'Needs immediate triage')}
      </div>
      <div class="panel">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">${ICONS.search}</span>
            <input id="maintenance-search" value="${esc(currentFilter)}" placeholder="Search ticket title, equipment, room, reporter…" />
          </div>
          <select id="maintenance-status-filter">
            ${options(['All', 'Open', 'In progress', 'Blocked', 'Complete'], currentStatusFilter, null)}
          </select>
          <span class="small muted">${all.length} requests</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sortable" data-sort="title">Request ${sortColumn === 'title' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th>Location / Equipment</th>
                <th class="sortable" data-sort="priority">Priority ${sortColumn === 'priority' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th class="sortable" data-sort="reporter">Reporter ${sortColumn === 'reporter' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th class="sortable" data-sort="status">Status ${sortColumn === 'status' ? (sortAsc ? '▲' : '▼') : ''}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                all.length
                  ? all
                      .map(
                        m => `
                <tr>
                  <td>
                    <div class="table-primary">${esc(m.title)}</div>
                    <div class="table-meta">${esc(m.type)} · Reported ${fmtDate(m.createdAt)}</div>
                  </td>
                  <td>
                    ${esc(getRoom(m.roomId)?.name || getAsset(m.assetId)?.name || 'Venue-wide')}
                    <div class="table-meta">${m.assignedTo ? `Owner: ${esc(m.assignedTo)}` : 'Unassigned technician'}</div>
                  </td>
                  <td>${badge(m.priority)}</td>
                  <td>${esc(m.reporter || '—')}</td>
                  <td>${badge(m.status)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-secondary btn-small" data-action="view-maintenance" data-id="${esc(m.id)}">Details</button>
                      ${isAdmin() ? `<button class="btn btn-quiet btn-small" data-action="edit-maintenance" data-id="${esc(m.id)}">Update</button>` : ''}
                    </div>
                  </td>
                </tr>`
                      )
                      .join('')
                  : tableEmptyRow(6, 'No maintenance requests match your filters.')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // --- CREW SCHEDULE & CALL SHEET ---
  function renderCrew() {
    const event = ACTIVE_EVENT();
    const ws = event ? workFor(event.id) : { shifts: [] };
    const filter = currentStatusFilter;
    let shifts = event ? [...ws.shifts] : [];

    if (filter === 'Upcoming') shifts = shifts.filter(s => s.date >= today());
    if (filter === 'Today') shifts = shifts.filter(s => sameDate(s.date, today()));
    if (filter === 'Past') shifts = shifts.filter(s => s.date < today());

    if (currentFilter) {
      shifts = shifts.filter(s =>
        `${accountName(s.userId)} ${state.users.find(u => u.id === s.userId)?.username || ''} ${s.notes || ''} ${s.date}`
          .toLowerCase()
          .includes(currentFilter.toLowerCase())
      );
    }
    shifts.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

    const allShifts = event ? ws.shifts : [];
    const todayCount = allShifts.filter(s => sameDate(s.date, today())).length;
    const next = allShifts
      .filter(s => `${s.date}T${s.startTime}` >= `${today()}T${new Date().toTimeString().slice(0, 5)}`)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];

    // Visual Timeline Bar
    const timelineHours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00'];
    const timelineBars = shifts
      .filter(s => sameDate(s.date, today()) || !shifts.some(x => sameDate(x.date, today())))
      .slice(0, 6)
      .map(s => {
        const parseMin = t => {
          const [h, m] = (t || '00:00').split(':').map(Number);
          return h * 60 + (m || 0);
        };
        const startMin = Math.max(8 * 60, Math.min(24 * 60, parseMin(s.startTime)));
        let endMin = Math.max(8 * 60, Math.min(24 * 60, parseMin(s.endTime)));
        if (endMin <= startMin) endMin = 24 * 60;
        const leftPercent = ((startMin - 8 * 60) / (16 * 60)) * 100;
        const widthPercent = Math.max(4, ((endMin - startMin) / (16 * 60)) * 100);
        return `<div class="shift-timeline-block" style="left:${leftPercent}%;width:${widthPercent}%" title="${esc(accountName(s.userId))}: ${esc(s.startTime)}–${esc(s.endTime)}">${esc(accountName(s.userId))}</div>`;
      })
      .join('');

    return `
      ${pageIntro(
        'Crew Schedule & Call Sheet',
        event
          ? `Technical coverage for ${esc(event.name)}. Operational callsheet for lighting, audio, stage, and booth crew.`
          : 'Select an event workspace to view or assign technical shifts.',
        `${isAdmin() && event ? btn(`${ICONS.plus} Schedule Shift`, 'new-shift', 'primary') : ''}
         ${btn(`${ICONS.print} Print Call Sheet`, 'print', 'secondary')}`
      )}
      <div class="metrics">
        ${metric('Scheduled Shifts', allShifts.length, ICONS.crew, 'Total assigned shifts')}
        ${metric('Calls Today', todayCount, ICONS.checklist, 'Technicians on duty today')}
        ${metric('Next on Duty', next ? accountName(next.userId) : '—', ICONS.events, next ? `${fmtDate(next.date)} · ${next.startTime}` : 'No upcoming calls')}
        ${metric('Assigned Crew', new Set(allShifts.map(s => s.userId)).size, ICONS.overview, 'Unique technicians')}
      </div>
      <div class="shift-timeline-wrap">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">Visual Daily Call Coverage (08:00 – 24:00)</div>
        <div class="shift-timeline-hours">
          ${timelineHours.map(h => `<span>${h}</span>`).join('')}
        </div>
        <div class="shift-timeline-track">
          ${timelineBars || '<div style="text-align:center;font-size:10px;color:var(--text-muted);line-height:24px">No shifts scheduled in this window</div>'}
        </div>
      </div>
      <div class="panel">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">${ICONS.search}</span>
            <input id="crew-search" value="${esc(currentFilter)}" placeholder="Search crew member, date, call notes…" />
          </div>
          <select id="crew-filter">
            ${options(['All', 'Upcoming', 'Today', 'Past'], currentStatusFilter, null)}
          </select>
          <span class="small muted">${shifts.length} shifts listed</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Date</th>
                <th>Shift Call</th>
                <th>Assignment Notes</th>
                <th>Checklist Progress</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                shifts.length
                  ? shifts
                      .map(s => {
                        const done = checklistProgress(s);
                        return `
                  <tr>
                    <td>
                      <div class="table-primary">${esc(accountName(s.userId))}</div>
                      <div class="table-meta">@${esc(state.users.find(u => u.id === s.userId)?.username || '')}</div>
                    </td>
                    <td>
                      ${fmtDate(s.date)}
                      ${sameDate(s.date, today()) ? '<div class="table-meta" style="color:var(--primary);font-weight:700">Today</div>' : ''}
                    </td>
                    <td>${esc(s.startTime)}–${esc(s.endTime)}</td>
                    <td>${esc(s.notes || 'General technical operations')}</td>
                    <td>
                      <div style="min-width:110px">
                        <div class="small" style="font-weight:700">${done.done}/${done.total} tasks (${done.percent}%)</div>
                        <div class="progress-track" style="margin-top:6px">
                          <div class="progress-fill" style="width:${done.percent}%"></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-secondary btn-small" data-action="shift-checklist" data-id="${esc(s.id)}">Checklist</button>
                        ${isAdmin() ? `<button class="btn btn-quiet btn-small" data-action="remove-shift" data-id="${esc(s.id)}">Remove</button>` : ''}
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join('')
                  : tableEmptyRow(6, isAdmin() ? 'No shifts scheduled for this event yet.' : 'You have no shifts assigned for this event.')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function checklistProgress(shift) {
    const tasks = state.checklistTemplate.flatMap(s => s.tasks || []);
    const completed = shift.completedTasks || {};
    const done = tasks.filter(t => !!completed[t.id]).length;
    return {
      done,
      total: tasks.length,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0
    };
  }

  function myShiftForEvent(eventId) {
    const ws = workFor(eventId);
    return (
      ws.shifts
        .filter(s => s.userId === user.id)
        .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
        .find(s => s.date >= today()) ||
      ws.shifts
        .filter(s => s.userId === user.id)
        .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))[0] ||
      null
    );
  }

  // --- SHIFT CHECKLIST ---
  function renderChecklist() {
    const event = ACTIVE_EVENT();
    const ws = event ? workFor(event.id) : null;
    let selectedShiftId = currentEventDetail;
    let shift = selectedShiftId && ws?.shifts.find(s => s.id === selectedShiftId);

    if (!shift) {
      shift = isAdmin()
        ? ws?.shifts.slice().sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).find(s => s.date >= today()) || ws?.shifts[0]
        : myShiftForEvent(event?.id);
    }
    if (shift) currentEventDetail = shift.id;

    const progress = shift ? checklistProgress(shift) : { done: 0, total: state.checklistTemplate.flatMap(s => s.tasks || []).length, percent: 0 };
    const allowedShift = shift && (isAdmin() || shift.userId === user.id);

    const sections = state.checklistTemplate
      .map(
        sec => `
      <div class="panel checklist-section">
        <div class="checklist-section-head">
          <div>
            <h3>${esc(sec.name)}</h3>
            ${sec.description ? `<div class="row-sub">${esc(sec.description)}</div>` : ''}
          </div>
          <span class="tag">${(sec.tasks || []).filter(t => shift?.completedTasks?.[t.id]).length}/${(sec.tasks || []).length} completed</span>
        </div>
        ${(sec.tasks || [])
          .map(
            task => `
          <label class="checklist-task ${shift?.completedTasks?.[task.id] ? 'task-done' : ''}">
            <input type="checkbox" data-action="toggle-task" data-task-id="${esc(task.id)}" ${shift?.completedTasks?.[task.id] ? 'checked' : ''} ${
              !allowedShift ? 'disabled' : ''
            }>
            <div>
              <div class="task-label">${esc(task.label)}</div>
              ${task.instructions ? `<div class="task-instructions">${esc(task.instructions)}</div>` : ''}
            </div>
          </label>`
          )
          .join('')}
      </div>`
      )
      .join('');

    const shiftOptions =
      ws?.shifts
        .filter(s => isAdmin() || s.userId === user.id)
        .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
        .map(s => ({ value: s.id, label: `${fmtDate(s.date)} · ${s.startTime} · ${accountName(s.userId)}` })) || [];

    return `
      ${pageIntro(
        'Shift Checklist',
        'Operational readiness checklists for stage, audio, lighting, and venue safety. Task completions are saved per individual shift call.',
        `${isAdmin() ? btn('Edit Template JSON', 'edit-template', 'secondary') : ''}`
      )}
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-body">
          <div class="fields-2" style="align-items:end">
            <div class="field">
              <label for="checklist-shift-select">Selected Shift Call</label>
              <select id="checklist-shift-select">
                ${options(shiftOptions, shift?.id, shiftOptions.length ? 'Select a shift call' : 'No shifts assigned')}
              </select>
            </div>
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div>
                  <strong style="font-size:14px">${progress.percent}% Ready</strong>
                  <span class="small muted" style="margin-left:8px">${progress.done} of ${progress.total} tasks verified</span>
                </div>
                ${shift ? badge(fmtDate(shift.date)) : ''}
              </div>
              <div class="progress-track" style="height:10px">
                <div class="progress-fill" style="width:${progress.percent}%"></div>
              </div>
            </div>
          </div>
          ${
            shift
              ? `<div class="helper" style="margin-top:14px">${esc(event?.name || 'No event')} · Assigned: <strong>${esc(
                  accountName(shift.userId)
                )}</strong> · ${esc(shift.startTime)}–${esc(shift.endTime)} ${shift.notes ? `· ${esc(shift.notes)}` : ''}</div>`
              : ''
          }
        </div>
      </div>
      ${shift ? sections : empty('No shift assignment selected', 'Select or create a shift in Crew Schedule to track checklist completion.', 'goto-crew', 'Open Call Sheet')}`;
  }

  // --- SHIFT HANDOFF ---
  function renderHandoffs() {
    const event = ACTIVE_EVENT();
    const ws = event ? workFor(event.id) : { handoffs: [] };
    const all = [...ws.handoffs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const filtered = all.filter(
      h =>
        !currentFilter ||
        `${h.currentSituation || ''} ${h.completedWork || ''} ${h.outstandingTasks || ''} ${accountName(h.outgoingUserId)} ${accountName(h.incomingUserId)}`
          .toLowerCase()
          .includes(currentFilter.toLowerCase())
    );
    const last = all[0];

    return `
      ${pageIntro(
        'Shift Handoff',
        'Maintain operational continuity across crew shift changes: status of stage, consoles, issues encountered, and priorities for the incoming technician.',
        `${btn(`${ICONS.plus} Create Handoff Report`, 'new-handoff', 'primary')}`
      )}
      ${
        last
          ? `<div class="panel" style="margin-bottom:20px">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">Latest Handoff Log</h2>
                  <div class="panel-subtitle">${fmtLong(last.createdAt)} · Outgoing: <strong>${esc(accountName(last.outgoingUserId))}</strong> → Incoming: <strong>${esc(accountName(last.incomingUserId))}</strong></div>
                </div>
                ${badge(last.priority)}
              </div>
              <div class="panel-body">
                <div class="grid-3" style="margin-bottom:16px">
                  <div>
                    <div class="detail-label">Current Stage & Tech Status</div>
                    <div class="detail-value">${esc(last.currentSituation || 'No situation summary recorded')}</div>
                  </div>
                  <div>
                    <div class="detail-label">Outstanding Work / Blockers</div>
                    <div class="detail-value">${esc(last.outstandingTasks || 'None recorded')}</div>
                  </div>
                  <div>
                    <div class="detail-label">Immediate Next Actions</div>
                    <div class="detail-value">${esc(last.nextActions || 'None recorded')}</div>
                  </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  ${btn('Use as Template for New Handoff', 'handoff-from:' + last.id, 'secondary', 'class="btn btn-secondary" data-action="handoff-from" data-id="' + esc(last.id) + '"')}
                  ${btn(
                    last.acknowledgedBy?.includes(user.id) ? '✓ Acknowledged by You' : 'Mark as Read & Acknowledged',
                    'ack-handoff:' + last.id,
                    'secondary',
                    'class="btn btn-secondary" data-action="ack-handoff" data-id="' + esc(last.id) + '"'
                  )}
                </div>
              </div>
            </div>`
          : ''
      }
      <div class="panel">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">${ICONS.search}</span>
            <input id="handoff-search" value="${esc(currentFilter)}" placeholder="Search handoff notes, crew members, blockers…" />
          </div>
          <span class="small muted">${filtered.length} logs recorded</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Handoff Participants</th>
                <th>Shift End / Timing</th>
                <th>Priority</th>
                <th>Read Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length
                  ? filtered
                      .map(
                        h => `
                <tr>
                  <td>
                    <div class="table-primary">${esc(accountName(h.outgoingUserId))} → ${esc(accountName(h.incomingUserId))}</div>
                    <div class="table-meta">${esc(h.currentSituation || 'No situation summary').slice(0, 110)}</div>
                  </td>
                  <td>
                    ${fmtLong(h.shiftEnd)}
                    <div class="table-meta">Next shift: ${h.nextShiftDate ? fmtDate(h.nextShiftDate) : '—'} ${esc(h.nextShiftStart || '')}</div>
                  </td>
                  <td>${badge(h.priority)}</td>
                  <td>
                    ${
                      h.acknowledgedBy?.includes(user.id)
                        ? '<span class="status green">Read by you</span>'
                        : '<span class="status amber">Unacknowledged</span>'
                    }
                    <div class="table-meta">${(h.acknowledgedBy || []).length} crew acknowledgements</div>
                  </td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-secondary btn-small" data-action="view-handoff" data-id="${esc(h.id)}">Read Log</button>
                      <button class="btn btn-quiet btn-small" data-action="ack-handoff" data-id="${esc(h.id)}">
                        ${h.acknowledgedBy?.includes(user.id) ? 'Undo' : 'Mark Read'}
                      </button>
                      ${isAdmin() ? `<button class="btn btn-quiet btn-small" data-action="delete-handoff" data-id="${esc(h.id)}">Delete</button>` : ''}
                    </div>
                  </td>
                </tr>`
                      )
                      .join('')
                  : tableEmptyRow(5, 'No handoffs recorded for this event yet.')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // --- INCIDENT REGISTER ---
  function renderIncidents() {
    const event = ACTIVE_EVENT();
    const ws = event ? workFor(event.id) : { incidents: [] };
    const all = [...ws.incidents].sort(
      (a, b) =>
        ({ Urgent: 0, High: 1, Normal: 2, Low: 3 }[a.priority] ?? 2) - ({ Urgent: 0, High: 1, Normal: 2, Low: 3 }[b.priority] ?? 2) ||
        String(b.createdAt).localeCompare(String(a.createdAt))
    );

    const list = all.filter(
      i =>
        (!currentFilter || `${i.title} ${i.description || ''} ${i.location || ''} ${i.reporter || ''} ${i.followUpOwner || ''}`.toLowerCase().includes(currentFilter.toLowerCase())) &&
        (currentStatusFilter === 'All' || (currentStatusFilter === 'Open' ? i.status !== 'Resolved' : currentStatusFilter === i.status)) &&
        (currentPriorityFilter === 'All' || i.priority === currentPriorityFilter)
    );

    const open = all.filter(i => i.status !== 'Resolved');

    return `
      ${pageIntro(
        'Incident Register',
        'Record technical disruptions, safety hazards, equipment breakdowns, and show stops. Preserved in this event’s permanent history.',
        `${btn(`${ICONS.plus} Log Incident`, 'new-incident', 'primary')}`
      )}
      <div class="metrics">
        ${metric('Total Incidents', all.length, ICONS.incidents, 'This event history')}
        ${metric('Open Follow-ups', open.length, ICONS.checklist, 'Needs resolution')}
        ${metric('High / Urgent', open.filter(i => ['High', 'Urgent'].includes(i.priority)).length, ICONS.maintenance, 'Critical issues')}
        ${metric('Resolved', all.filter(i => i.status === 'Resolved').length, ICONS.overview, 'Resolution verified')}
      </div>
      <div class="panel">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">${ICONS.search}</span>
            <input id="incident-search" value="${esc(currentFilter)}" placeholder="Search incident title, location, equipment, reporter…" />
          </div>
          <select id="incident-status-filter">
            ${options(['All', 'Open', 'Resolved'], currentStatusFilter, null)}
          </select>
          <select id="incident-priority-filter">
            ${options(['All', 'Low', 'Normal', 'High', 'Urgent'], currentPriorityFilter, null)}
          </select>
          <span class="small muted">${list.length} incidents</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Incident Details</th>
                <th>Location / Gear</th>
                <th>Priority</th>
                <th>Reported By</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length
                  ? list
                      .map(
                        i => `
                <tr>
                  <td>
                    <div class="table-primary">${esc(i.title)}</div>
                    <div class="table-meta">${esc(i.category)} · Reported ${fmtDate(i.createdAt)}</div>
                  </td>
                  <td>${esc(i.location || getAsset(i.assetId)?.name || 'Not specified')}</td>
                  <td>${badge(i.priority)}</td>
                  <td>${esc(i.reporter || '—')}</td>
                  <td>${badge(i.status)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-secondary btn-small" data-action="view-incident" data-id="${esc(i.id)}">Details</button>
                      ${
                        i.status === 'Resolved'
                          ? `<button class="btn btn-quiet btn-small" data-action="resolve-incident" data-id="${esc(i.id)}" data-resolve="false">Reopen</button>`
                          : `<button class="btn btn-quiet btn-small" data-action="resolve-incident" data-id="${esc(i.id)}" data-resolve="true">Resolve</button>`
                      }
                      ${isAdmin() ? `<button class="btn btn-quiet btn-small" data-action="delete-incident" data-id="${esc(i.id)}">Delete</button>` : ''}
                    </div>
                  </td>
                </tr>`
                      )
                      .join('')
                  : tableEmptyRow(6, 'No incidents match your filter criteria.')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // --- SETTINGS & ADMINISTRATION ---
  function renderSettings() {
    const tabs = [
      ['venue', 'Venue Identity'],
      ['accounts', 'Crew Accounts'],
      ['checklist', 'Checklist Template'],
      ['options', 'Workflow Options'],
      ['data', 'Backup & Restore']
    ];

    let body = '';
    if (settingsTab === 'venue') {
      body = `
        <div class="subpanel">
          <h3>Venue Identity & Location</h3>
          <p>The venue name and time zone applied to schedules and shared records.</p>
          <form data-form="venue" class="stack">
            <div class="field">
              <label>Venue / Facility Name</label>
              <input name="name" value="${esc(state.venue.name)}" required maxlength="120" />
            </div>
            <div class="field">
              <label>Operating Time Zone</label>
              <select name="timezone">
                ${options(
                  ['America/Denver', 'America/Los_Angeles', 'America/Chicago', 'America/New_York', 'America/Phoenix', 'UTC', 'Europe/London'],
                  state.venue.timezone,
                  null
                )}
              </select>
              <div class="helper">Used for operational call sheets and room conflict calculations.</div>
            </div>
            <div>
              ${btn('Save Venue Settings', 'submit-venue', 'primary', 'class="btn btn-primary" type="submit"')}
            </div>
          </form>
        </div>
        <div class="subpanel">
          <h3>Synchronization & Revision Control</h3>
          <p>Every change is written with revision control to prevent overwriting edits by other technicians.</p>
          <div class="grid-2">
            <div class="detail-box">
              <div class="detail-label">Current Revision</div>
              <div class="detail-value">#${revision}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Last Saved At</div>
              <div class="detail-value">${lastSavedAt ? fmtLong(lastSavedAt) : 'No saved timestamp'}</div>
            </div>
          </div>
        </div>`;
    }

    if (settingsTab === 'accounts') {
      body = `
        <div class="subpanel">
          <h3>Crew & Staff Accounts</h3>
          <p>Manage individual accounts for technicians and administrators. Passwords are encrypted with salted scrypt.</p>
          <div style="margin-bottom:16px">${btn(`${ICONS.plus} Create Crew Account`, 'new-user', 'primary')}</div>
          <div>
            ${state.users
              .map(
                u => `
              <div class="account-row">
                <span class="avatar">${esc(initials(u.displayName))}</span>
                <div class="account-info">
                  <strong>${esc(u.displayName)} ${u.id === user.id ? '<span class="tag">You</span>' : ''}</strong>
                  <span>@${esc(u.username)} · ${esc(u.role)} · Registered ${fmtDate(u.createdAt)}</span>
                </div>
                ${badge(u.enabled ? 'Enabled' : 'Disabled')}
                <button class="btn btn-secondary btn-small" data-action="reset-user-password" data-id="${esc(u.id)}">Reset Password</button>
                ${
                  u.id !== user.id
                    ? `<button class="btn btn-quiet btn-small" data-action="toggle-user" data-id="${esc(u.id)}" data-enabled="${u.enabled ? 'false' : 'true'}">${
                        u.enabled ? 'Disable' : 'Enable'
                      }</button>`
                    : ''
                }
              </div>`
              )
              .join('')}
          </div>
        </div>
        <div class="warning-note">
          Disabling an account immediately revokes all of its active login sessions. Existing crew schedule history is preserved.
        </div>`;
    }

    if (settingsTab === 'checklist') {
      body = `
        <div class="subpanel">
          <h3>Shift Checklist Master Template</h3>
          <p>Configure standardized pre-call, shift, and end-of-night procedures. Each section requires a unique ID and tasks array.</p>
          <form data-form="checklist-template" class="stack">
            <div class="field">
              <label>Template JSON Definition</label>
              <textarea name="template" rows="18" spellcheck="false" style="font-family:monospace;font-size:12px">${esc(
                JSON.stringify(state.checklistTemplate, null, 2)
              )}</textarea>
              <div class="helper">Keep IDs stable so that completed task records remain intact across edits.</div>
            </div>
            <div>
              ${btn('Save Checklist Template', 'save-template', 'primary', 'class="btn btn-primary" type="submit"')}
            </div>
          </form>
        </div>
        <div class="subpanel">
          <h3>Checklist Data Operations</h3>
          <p>Clear completed checklist markers across all scheduled shifts in this workspace.</p>
          ${btn('Reset All Shift Checklist Records', 'reset-checklists', 'danger')}
        </div>`;
    }

    if (settingsTab === 'options') {
      body = `
        <div class="subpanel">
          <h3>Workflow Dropdown Values</h3>
          <p>Customize standard values used across event bookings, incident categories, and priorities (one option per line).</p>
          <form data-form="workflow-options" class="stack">
            ${[
              ['eventPhases', 'Event Phases'],
              ['incidentCategories', 'Incident Categories'],
              ['incidentPriorities', 'Incident Priorities'],
              ['handoffPriorities', 'Handoff Priorities']
            ]
              .map(
                ([key, label]) => `
              <div class="field">
                <label>${label}</label>
                <textarea name="${key}" rows="3">${esc((state.settings[key] || []).join('\n'))}</textarea>
              </div>`
              )
              .join('')}
            <div>
              ${btn('Save Workflow Options', 'save-options', 'primary', 'class="btn btn-primary" type="submit"')}
            </div>
          </form>
        </div>`;
    }

    if (settingsTab === 'data') {
      body = `
        <div class="subpanel">
          <h3>Venue Data Backup & Export</h3>
          <p>Download a complete JSON export of venue records, bookings, inventory, maintenance requests, and event history.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${btn('Export JSON Backup', 'export-backup', 'primary')}
            ${btn('Print Current Record', 'print', 'secondary')}
            ${isAdmin() ? btn('Import JSON Backup', 'choose-import', 'secondary') : ''}
            <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
          </div>
        </div>
        <div class="subpanel">
          <h3>API Host & Connection Info</h3>
          <div class="grid-2">
            <div class="detail-box">
              <div class="detail-label">API Endpoint</div>
              <div class="detail-value" style="word-break:break-all">${esc(API)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Application Version</div>
              <div class="detail-value">Backstage v1.1.0</div>
            </div>
          </div>
        </div>
        <div class="warning-note">
          Importing a backup file replaces the current venue record. Always take a fresh export before importing an older file.
        </div>`;
    }

    return `
      ${pageIntro(
        'Settings & Administration',
        'Configure venue identity, crew user accounts, operational checklist templates, and backup archives.',
        ''
      )}
      <div class="settings-grid">
        <div class="panel" style="padding:10px;height:max-content">
          <div class="settings-nav">
            ${tabs
              .map(
                ([id, label]) => `
              <button class="${settingsTab === id ? 'active' : ''}" data-action="settings-tab" data-tab="${id}">
                ${esc(label)}
              </button>`
              )
              .join('')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">${esc(tabs.find(t => t[0] === settingsTab)?.[1] || 'Settings')}</h2>
              <div class="panel-subtitle">${
                settingsTab === 'accounts'
                  ? 'Crew access and credentials'
                  : settingsTab === 'data'
                  ? 'Backups and data persistence'
                  : 'Venue-wide parameters'
              }</div>
            </div>
          </div>
          <div class="panel-body settings-content">${body}</div>
        </div>
      </div>`;
  }

  // Form Field Helpers
  const fInput = (label, name, value = '', type = 'text', extra = '') =>
    `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" type="${esc(
      type
    )}" value="${esc(value)}" ${extra} /></div>`;

  const fSelect = (label, name, items, selected, blank = 'Select…', extra = '') =>
    `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><select id="f-${esc(name)}" name="${esc(name)}" ${extra}>${options(
      items,
      selected,
      blank
    )}</select></div>`;

  const fText = (label, name, value = '', rows = 3, extra = '') =>
    `<div class="field full"><label for="f-${esc(name)}">${esc(label)}</label><textarea id="f-${esc(name)}" name="${esc(
      name
    )}" rows="${rows}" ${extra}>${esc(value)}</textarea></div>`;

  const usersOptions = () => state.users.filter(u => u.enabled).map(u => ({ value: u.id, label: `${u.displayName} (@${u.username})` }));
  const roomOptions = () => state.rooms.map(r => ({ value: r.id, label: `${r.name} · ${r.code} (${r.status})` }));
  const assetOptions = () => state.assets.map(a => ({ value: a.id, label: `${a.tag} · ${a.name}` }));

  // --- MODALS ---
  function openModal(kind, record = null) {
    const isEdit = !!(record && record.id);
    const r = record || {};
    const event = ACTIVE_EVENT();
    let title = '',
      desc = '',
      html = '',
      submitLabel = 'Save Changes';

    if (kind === 'event') {
      title = isEdit ? 'Edit Event Booking' : 'Create Event Booking';
      desc = 'Configure booking schedule and room reservations. A dedicated operational workspace is provisioned.';
      submitLabel = isEdit ? 'Save Booking' : 'Create Workspace';
      html = `
        <form data-form="event" data-id="${esc(r.id || '')}" class="stack">
          <div class="fields-2">
            ${fInput('Event / Booking Name', 'name', r.name || '', 'text', 'required maxlength="160"')}
            ${fSelect(
              'Event Type',
              'type',
              ['Production', 'Rehearsal', 'Performance', 'Concert', 'Rental', 'Meeting', 'Workshop', 'Other'],
              r.type || 'Production',
              null
            )}
            ${fInput('Event Date', 'date', r.date || today(), 'date', 'required')}
            ${fSelect(
              'Booking Status',
              'status',
              ['Confirmed', 'Tentative', 'In progress', 'Complete', 'Cancelled'],
              r.status || 'Confirmed',
              null
            )}
            ${fSelect('Event Phase', 'phase', state.settings.eventPhases || [], r.phase || 'Planning')}
            ${fInput('Technical Lead', 'technicalLead', r.technicalLead || '', 'text', 'maxlength="120"')}
            ${fInput('Access Time', 'accessTime', r.accessTime || '', 'time')}
            ${fInput('Call Time', 'callTime', r.callTime || '', 'time')}
            ${fInput('End Time', 'endTime', r.endTime || '', 'time')}
            ${fInput('Strike Time', 'strikeTime', r.strikeTime || '', 'time')}
            ${fInput('Contact Person / Phone', 'contact', r.contact || '', 'text', 'maxlength="160"')}
            ${fInput('Radio / Comms Channel', 'radioChannel', r.radioChannel || '', 'text', 'maxlength="60"')}
          </div>
          <div class="field">
            <label>Reserved Rooms & Spaces</label>
            <div class="checkbox-grid">
              ${state.rooms
                .map(
                  room => `
                <label class="check-option">
                  <input type="checkbox" name="roomIds" value="${esc(room.id)}" ${(r.roomIds || []).includes(room.id) ? 'checked' : ''} ${
                    ['Closed', 'Under maintenance'].includes(room.status) && !(r.roomIds || []).includes(room.id) ? 'disabled' : ''
                  }>
                  <div>
                    <strong>${esc(room.name)}</strong>
                    <div class="muted small">${esc(room.code)} · ${esc(room.status)}</div>
                  </div>
                </label>`
                )
                .join('')}
            </div>
            <div class="helper">Closed or under-maintenance rooms cannot be booked. Overlaps are checked before saving.</div>
          </div>
          ${fText('Technical Requirements & Rider', 'requirements', r.requirements || '', 3)}
          ${fText('Operational / Schedule Notes', 'notes', r.notes || '', 3)}
        </form>`;
    } else if (kind === 'room') {
      title = isEdit ? 'Edit Room / Facility' : 'Register New Space';
      desc = 'Track physical stages, rehearsal spaces, control rooms, and access restrictions.';
      html = `
        <form data-form="room" data-id="${esc(r.id || '')}" class="stack">
          <div class="fields-2">
            ${fInput('Space / Room Name', 'name', r.name || '', 'text', 'required maxlength="120"')}
            ${fInput('Short Code', 'code', r.code || '', 'text', 'required maxlength="20"')}
            ${fSelect(
              'Space Type',
              'type',
              ['Performance', 'Rehearsal', 'Lobby / public', 'Backstage', 'Storage', 'Office', 'Other'],
              r.type || 'Performance',
              null
            )}
            ${fInput('Seating / Crew Capacity', 'capacity', r.capacity ?? '', 'number', 'min="0" max="100000"')}
            ${fSelect('Current Status', 'status', ['Available', 'Limited access', 'Under maintenance', 'Closed'], r.status || 'Available', null)}
          </div>
          ${fText('Access Notes & Procedures', 'accessNotes', r.accessNotes || '', 3)}
        </form>`;
    } else if (kind === 'asset') {
      title = isEdit ? 'Edit Equipment Asset' : 'Register Equipment Asset';
      desc = 'Assign a unique equipment barcode/tag, department, model, and assigned space.';
      html = `
        <form data-form="asset" data-id="${esc(r.id || '')}" class="stack">
          <div class="fields-2">
            ${fInput('Asset Tag / Barcode', 'tag', r.tag || '', 'text', 'required maxlength="50"')}
            ${fInput('Equipment Description', 'name', r.name || '', 'text', 'required maxlength="160"')}
            ${fSelect(
              'Department',
              'department',
              ['Audio', 'Lighting', 'Video/Projection', 'Rigging', 'Comms', 'Power/Cable', 'Tools', 'Furniture/Staging', 'IT', 'Other'],
              r.department || 'Audio',
              null
            )}
            ${fSelect('Assigned Room', 'roomId', roomOptions(), r.roomId || '', 'Unassigned')}
            ${fInput('Manufacturer & Model', 'model', r.model || '', 'text', 'maxlength="120"')}
            ${fInput('Serial Number', 'serial', r.serial || '', 'text', 'maxlength="120"')}
            ${fSelect(
              'Operational Status',
              'status',
              ['Available', 'Assigned', 'Needs service', 'Out of service', 'Missing'],
              r.status || 'Available',
              null
            )}
          </div>
          ${fText('Technical Notes / Accessories', 'notes', r.notes || '', 3)}
        </form>`;
    } else if (kind === 'maintenance') {
      title = isEdit ? 'Update Service Ticket' : 'Create Service Ticket';
      desc = 'Report malfunctioning equipment, broken facilities, or scheduled maintenance.';
      submitLabel = isEdit ? 'Update Ticket' : 'Submit Ticket';
      html = `
        <form data-form="maintenance" data-id="${esc(r.id || '')}" class="stack">
          <div class="fields-2">
            ${fInput('Ticket Title', 'title', r.title || '', 'text', 'required maxlength="160"')}
            ${fSelect('Category / Type', 'type', ['Repair', 'Maintenance', 'Safety', 'Inspection', 'Installation', 'Other'], r.type || 'Repair', null)}
            ${fSelect('Equipment (if applicable)', 'assetId', assetOptions(), r.assetId || '', 'None (Facility-wide)')}
            ${fSelect('Room / Space', 'roomId', roomOptions(), r.roomId || '', 'Venue-wide')}
            ${fSelect('Priority', 'priority', ['Low', 'Normal', 'High', 'Urgent'], r.priority || 'Normal', null)}
            ${
              isAdmin()
                ? fSelect('Ticket Status', 'status', ['Open', 'In progress', 'Blocked', 'Complete'], r.status || 'Open', null)
                : '<input type="hidden" name="status" value="Open"/>'
            }
            ${
              isAdmin()
                ? fInput('Assigned Technician', 'assignedTo', r.assignedTo || '', 'text', 'maxlength="120"')
                : '<input type="hidden" name="assignedTo" value=""/>'
            }
          </div>
          ${fText('Issue Description & Diagnosis', 'description', r.description || '', 4, 'required')}
        </form>`;
    } else if (kind === 'shift') {
      title = 'Schedule Crew Call';
      desc = `Assign a technician shift call for ${esc(event?.name || 'this event')}.`;
      submitLabel = 'Add Shift';
      html = `
        <form data-form="shift" class="stack">
          <div class="fields-2">
            ${fSelect('Technician', 'userId', usersOptions(), r.userId || '', 'Select technician', 'required')}
            ${fInput('Shift Date', 'date', r.date || event?.date || today(), 'date', 'required')}
            ${fInput('Call Time', 'startTime', r.startTime || event?.callTime || '16:00', 'time', 'required')}
            ${fInput('End Time', 'endTime', r.endTime || event?.strikeTime || '22:30', 'time', 'required')}
          </div>
          ${fText('Post / Assignment Notes (e.g. FOH Audio, Stage Left, LD)', 'notes', r.notes || '', 3)}
        </form>`;
    } else if (kind === 'handoff') {
      title = 'Log Shift Handoff';
      desc = `Transfer operational context for ${esc(event?.name || 'this event')} to the incoming crew.`;
      submitLabel = 'Publish Handoff';
      const initialData = r.data || r;
      html = `
        <form data-form="handoff" class="stack">
          <div class="fields-2">
            ${fSelect('Incoming Crew Member', 'incomingUserId', usersOptions(), initialData.incomingUserId || '', 'Select technician', 'required')}
            ${fSelect('Priority', 'priority', state.settings.handoffPriorities || ['Routine', 'Important', 'Urgent'], initialData.priority || 'Routine', null)}
            ${fInput('Shift End Timestamp', 'shiftEnd', initialData.shiftEnd || timeNow().slice(0, 16), 'datetime-local', 'required')}
            ${fInput('Next Shift Date', 'nextShiftDate', initialData.nextShiftDate || today(), 'date')}
            ${fInput('Next Call Time', 'nextShiftStart', initialData.nextShiftStart || '', 'time')}
          </div>
          ${fText('Current State of Stage & Systems', 'currentSituation', initialData.currentSituation || '', 3, 'required')}
          ${fText('Work Completed During Shift', 'completedWork', initialData.completedWork || '', 3)}
          ${fText('Outstanding Tasks & Blockers', 'outstandingTasks', initialData.outstandingTasks || '', 3)}
          ${fText('Immediate Next Actions for Incoming Crew', 'nextActions', initialData.nextActions || '', 3)}
        </form>`;
    } else if (kind === 'incident') {
      title = 'Log Operational Incident';
      desc = `Log a fault or hazard for ${esc(event?.name || 'this event')}.`;
      submitLabel = 'Log Incident';
      html = `
        <form data-form="incident" class="stack">
          <div class="fields-2">
            ${fInput('Incident Title', 'title', '', 'text', 'required maxlength="160"')}
            ${fSelect('Category', 'category', state.settings.incidentCategories || [], 'Equipment fault', null)}
            ${fSelect('Severity / Priority', 'priority', state.settings.incidentPriorities || [], 'Normal', null)}
            ${fInput('Specific Location', 'location', '', 'text', 'placeholder="e.g. Downstage Left, FOH Mix Pos"')}
            ${fSelect('Related Equipment', 'assetId', assetOptions(), '', 'None (Not equipment related)')}
            ${fInput('Follow-up Owner', 'followUpOwner', '', 'text', 'placeholder="Technician or Lead"')}
          </div>
          ${fText('Incident Description & Immediate Impact', 'description', '', 4, 'required')}
        </form>`;
    } else if (kind === 'user') {
      title = 'Create Crew Account';
      desc = 'Provide credentials for a new technician or venue administrator.';
      submitLabel = 'Create Account';
      html = `
        <form data-form="user" class="stack">
          <div class="fields-2">
            ${fInput('Display Name', 'displayName', '', 'text', 'required maxlength="120" placeholder="e.g. Alex Rivera"')}
            ${fInput('Username', 'username', '', 'text', 'required maxlength="80" placeholder="e.g. alexr"')}
            ${fInput('Initial Password', 'password', '', 'password', 'required minlength="12" placeholder="At least 12 characters"')}
            ${fSelect('Role & Permissions', 'role', ['Technician', 'Administrator'], 'Technician', null)}
          </div>
        </form>`;
    } else if (kind === 'view-asset') {
      title = `Equipment: ${esc(r.name)}`;
      desc = `Asset Tag: ${esc(r.tag)} · Status: ${esc(r.status)}`;
      const maintenanceForAsset = state.maintenance.filter(m => m.assetId === r.id);
      html = `
        <div class="stack">
          <div class="grid-3">
            <div class="detail-box">
              <div class="detail-label">Asset Tag</div>
              <div class="detail-value">${esc(r.tag)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Department</div>
              <div class="detail-value">${esc(r.department)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Location</div>
              <div class="detail-value">${esc(getRoom(r.roomId)?.name || 'Unassigned')}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Model</div>
              <div class="detail-value">${esc(r.model || '—')}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Serial</div>
              <div class="detail-value">${esc(r.serial || '—')}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Status</div>
              <div class="detail-value">${badge(r.status)}</div>
            </div>
          </div>
          ${r.notes ? `<div class="detail-box"><div class="detail-label">Technical Notes</div><div class="detail-value">${esc(r.notes)}</div></div>` : ''}
          <div class="subpanel" style="margin-top:10px">
            <h3>Service History (${maintenanceForAsset.length})</h3>
            ${
              maintenanceForAsset.length
                ? `<div class="record-list">${maintenanceForAsset
                    .map(
                      m => `
                  <div class="record-row">
                    <div class="row-main">
                      <div class="row-title">${esc(m.title)}</div>
                      <div class="row-sub">${fmtDate(m.createdAt)} · ${esc(m.status)}</div>
                    </div>
                    <div>${badge(m.priority)}</div>
                  </div>`
                    )
                    .join('')}</div>`
                : '<p class="small muted">No maintenance requests logged for this asset.</p>'
            }
          </div>
        </div>`;
      submitLabel = '';
    } else if (kind === 'view-room') {
      title = `Room: ${esc(r.name)} (${esc(r.code)})`;
      desc = `Type: ${esc(r.type)} · Capacity: ${esc(r.capacity || '—')}`;
      const assetsInRoom = state.assets.filter(a => a.roomId === r.id);
      html = `
        <div class="stack">
          <div class="grid-2">
            <div class="detail-box">
              <div class="detail-label">Current Status</div>
              <div class="detail-value">${badge(r.status)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Seating / Capacity</div>
              <div class="detail-value">${esc(r.capacity || 'Not specified')}</div>
            </div>
          </div>
          ${r.accessNotes ? `<div class="detail-box"><div class="detail-label">Access Procedures</div><div class="detail-value">${esc(r.accessNotes)}</div></div>` : ''}
          <div class="subpanel" style="margin-top:10px">
            <h3>Stationed Assets (${assetsInRoom.length})</h3>
            ${
              assetsInRoom.length
                ? `<div class="record-list">${assetsInRoom
                    .map(
                      a => `
                  <div class="record-row">
                    <div class="row-main">
                      <div class="row-title">${esc(a.name)}</div>
                      <div class="row-sub">${esc(a.tag)} · ${esc(a.department)}</div>
                    </div>
                    <div>${badge(a.status)}</div>
                  </div>`
                    )
                    .join('')}</div>`
                : '<p class="small muted">No equipment assets assigned directly to this space.</p>'
            }
          </div>
        </div>`;
      submitLabel = '';
    } else if (kind === 'view-handoff') {
      title = `Handoff: ${esc(accountName(r.outgoingUserId))} → ${esc(accountName(r.incomingUserId))}`;
      desc = `Shift end: ${fmtLong(r.shiftEnd)} · Priority: ${esc(r.priority)}`;
      html = `
        <div class="stack">
          <div class="detail-box">
            <div class="detail-label">Current Situation & Stage Status</div>
            <div class="detail-value">${esc(r.currentSituation || '—')}</div>
          </div>
          <div class="detail-box">
            <div class="detail-label">Completed Work</div>
            <div class="detail-value">${esc(r.completedWork || '—')}</div>
          </div>
          <div class="detail-box">
            <div class="detail-label">Outstanding Work / Blockers</div>
            <div class="detail-value">${esc(r.outstandingTasks || '—')}</div>
          </div>
          <div class="detail-box">
            <div class="detail-label">Immediate Next Actions</div>
            <div class="detail-value">${esc(r.nextActions || '—')}</div>
          </div>
          <div class="helper">
            Acknowledged by: ${(r.acknowledgedBy || []).map(accountName).join(', ') || 'No crew members yet'}
          </div>
        </div>`;
      submitLabel = '';
    } else if (kind === 'view-incident') {
      title = `Incident: ${esc(r.title)}`;
      desc = `Reported: ${fmtDate(r.createdAt)} by ${esc(r.reporter || '—')}`;
      html = `
        <div class="stack">
          <div class="grid-3">
            <div class="detail-box">
              <div class="detail-label">Category</div>
              <div class="detail-value">${esc(r.category)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Priority</div>
              <div class="detail-value">${badge(r.priority)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Status</div>
              <div class="detail-value">${badge(r.status)}</div>
            </div>
          </div>
          <div class="detail-box">
            <div class="detail-label">Location / Equipment</div>
            <div class="detail-value">${esc(r.location || getAsset(r.assetId)?.name || 'Not specified')}</div>
          </div>
          <div class="detail-box">
            <div class="detail-label">Description & Impact</div>
            <div class="detail-value">${esc(r.description || '—')}</div>
          </div>
          ${
            r.status === 'Resolved'
              ? `<div class="detail-box"><div class="detail-label">Resolution</div><div class="detail-value">Resolved by ${esc(r.resolvedBy || '—')} on ${fmtLong(
                  r.resolvedAt
                )}</div></div>`
              : ''
          }
        </div>`;
      submitLabel = '';
    } else if (kind === 'view-maintenance') {
      title = `Ticket: ${esc(r.title)}`;
      desc = `Type: ${esc(r.type)} · Reported: ${fmtDate(r.createdAt)} by ${esc(r.reporter || '—')}`;
      html = `
        <div class="stack">
          <div class="grid-3">
            <div class="detail-box">
              <div class="detail-label">Priority</div>
              <div class="detail-value">${badge(r.priority)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Status</div>
              <div class="detail-value">${badge(r.status)}</div>
            </div>
            <div class="detail-box">
              <div class="detail-label">Owner</div>
              <div class="detail-value">${esc(r.assignedTo || 'Unassigned')}</div>
            </div>
          </div>
          <div class="detail-box">
            <div class="detail-label">Location / Target Equipment</div>
            <div class="detail-value">${esc(getRoom(r.roomId)?.name || getAsset(r.assetId)?.name || 'Venue-wide')}</div>
          </div>
          <div class="detail-box">
            <div class="detail-label">Description</div>
            <div class="detail-value">${esc(r.description || '—')}</div>
          </div>
        </div>`;
      submitLabel = '';
    }

    const modalMarkup = `
      <div class="modal-overlay" id="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal">
          <div class="modal-header">
            <div>
              <h2>${esc(title)}</h2>
              ${desc ? `<p>${esc(desc)}</p>` : ''}
            </div>
            <button type="button" class="modal-close" data-action="close-modal" aria-label="Close dialog">
              ${ICONS.close}
            </button>
          </div>
          <div class="modal-body">${html}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
            ${submitLabel ? `<button type="submit" class="btn btn-primary" id="modal-submit-btn">${esc(submitLabel)}</button>` : ''}
          </div>
        </div>
      </div>`;

    $('#modal-root').innerHTML = modalMarkup;

    // Attach submit if button exists
    $('#modal-submit-btn')?.addEventListener('click', () => {
      const form = $('form[data-form]', $('#modal-root'));
      if (form) form.requestSubmit();
    });
  }

  function closeModal() {
    $('#modal-root').innerHTML = '';
  }

  // --- COMMAND PALETTE (Ctrl+K) ---
  function openPalette() {
    paletteActive = true;
    const markup = `
      <div class="palette-overlay" id="palette-overlay">
        <div class="palette-box">
          <div class="palette-input-wrap">
            <span style="color:var(--text-muted)">${ICONS.search}</span>
            <input type="text" class="palette-input" id="palette-search-input" placeholder="Type to search events, rooms, equipment, staff, or actions…" autofocus autocomplete="off" />
            <span class="cmd-key">ESC</span>
          </div>
          <div class="palette-results" id="palette-results">
            ${renderPaletteResults('')}
          </div>
        </div>
      </div>`;

    $('#palette-root').innerHTML = markup;
    const input = $('#palette-search-input');
    input?.focus();

    input?.addEventListener('input', e => {
      const query = e.target.value.trim().toLowerCase();
      $('#palette-results').innerHTML = renderPaletteResults(query);
    });

    $('#palette-overlay').addEventListener('click', e => {
      if (e.target.id === 'palette-overlay') closePalette();
    });
  }

  function closePalette() {
    paletteActive = false;
    $('#palette-root').innerHTML = '';
  }

  function renderPaletteResults(q) {
    if (!state) return '';
    const results = [];

    // Pages
    for (const [id, label] of Object.entries(PAGE_NAMES)) {
      if (!q || label.toLowerCase().includes(q)) {
        results.push({ group: 'NAVIGATION', label: `Go to ${label}`, action: `goto-${id}`, icon: ICONS[id] || ICONS.overview, meta: 'Page' });
      }
    }

    // Events
    for (const e of state.events) {
      if (!q || `${e.name} ${e.type} ${e.technicalLead || ''}`.toLowerCase().includes(q)) {
        results.push({ group: 'EVENTS', label: e.name, action: `open-event:${e.id}`, icon: ICONS.events, meta: `${fmtDate(e.date)} · ${e.status}` });
      }
    }

    // Rooms
    for (const r of state.rooms) {
      if (!q || `${r.name} ${r.code}`.toLowerCase().includes(q)) {
        results.push({ group: 'ROOMS', label: `${r.name} (${r.code})`, action: `view-room:${r.id}`, icon: ICONS.rooms, meta: r.status });
      }
    }

    // Equipment Assets
    for (const a of state.assets) {
      if (!q || `${a.tag} ${a.name} ${a.department}`.toLowerCase().includes(q)) {
        results.push({ group: 'EQUIPMENT', label: `${a.tag}: ${a.name}`, action: `view-asset:${a.id}`, icon: ICONS.inventory, meta: a.department });
      }
    }

    // Maintenance
    for (const m of state.maintenance) {
      if (!q || `${m.title} ${m.priority}`.toLowerCase().includes(q)) {
        results.push({ group: 'MAINTENANCE', label: m.title, action: `view-maintenance:${m.id}`, icon: ICONS.maintenance, meta: `${m.priority} · ${m.status}` });
      }
    }

    // Actions
    if (!q || 'toggle theme mode booth day night dark light'.includes(q)) {
      results.push({ group: 'ACTIONS', label: 'Toggle Booth / Studio Theme', action: 'toggle-theme', icon: ICONS.sun, meta: 'Appearance' });
    }
    if (isAdmin() && (!q || 'create event booking'.includes(q))) {
      results.push({ group: 'ACTIONS', label: 'Create New Event Booking', action: 'new-event', icon: ICONS.plus, meta: 'Admin' });
    }
    if (!q || 'report service maintenance'.includes(q)) {
      results.push({ group: 'ACTIONS', label: 'Create Service Request', action: 'new-maintenance', icon: ICONS.plus, meta: 'Maintenance' });
    }

    if (!results.length) {
      return '<div style="padding:24px;text-align:center;color:var(--text-muted)">No matching records found.</div>';
    }

    const groups = {};
    for (const item of results.slice(0, 24)) {
      groups[item.group] ||= [];
      groups[item.group].push(item);
    }

    return Object.entries(groups)
      .map(
        ([groupName, items]) => `
      <div class="palette-group">${groupName}</div>
      ${items
        .map(
          item => `
        <div class="palette-item" data-action="${esc(item.action)}">
          <span class="palette-item-icon">${item.icon}</span>
          <span>${esc(item.label)}</span>
          <span class="palette-item-meta">${esc(item.meta)}</span>
        </div>`
        )
        .join('')}`
      )
      .join('');
  }

  // --- EVENT DELEGATION & ACTIONS ---
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const rawAction = b.dataset.action;
    const [action, paramId] = rawAction.includes(':') ? rawAction.split(':') : [rawAction, b.dataset.id];

    if (action === 'toggle-menu') {
      $('#sidebar')?.classList.toggle('open');
      return;
    }

    if (action === 'toggle-theme') {
      toggleTheme();
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'open-palette') {
      openPalette();
      return;
    }

    if (action === 'close-modal') {
      closeModal();
      return;
    }

    if (action === 'logout') {
      try {
        await api('/auth/logout', 'POST');
      } catch {
        /* ignore */
      }
      user = null;
      renderLogin();
      return;
    }

    if (action === 'refresh') {
      refreshAll(true);
      return;
    }

    if (action === 'print') {
      window.print();
      return;
    }

    if (action === 'calendar-prev') {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      render();
      return;
    }

    if (action === 'calendar-next') {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      render();
      return;
    }

    if (action === 'calendar-today') {
      currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      render();
      return;
    }

    if (action === 'event-tab') {
      eventTab = b.dataset.tab;
      render();
      return;
    }

    if (action === 'settings-tab') {
      settingsTab = b.dataset.tab;
      render();
      return;
    }

    // Navigation jumps
    if (action.startsWith('goto-')) {
      const page = action.replace('goto-', '');
      if (PAGE_NAMES[page]) {
        currentPage = page;
        currentFilter = '';
        currentStatusFilter = 'All';
        render();
        if (paletteActive) closePalette();
      }
      return;
    }

    // Workspace & Record Actions
    if (action === 'open-event') {
      const id = paramId || b.dataset.id;
      if (id && isAdmin() && id !== state.activeEventId) {
        const ok = await saveState(s => {
          s.activeEventId = id;
        }, 'Switched active workspace.');
        if (!ok) return;
      }
      currentEventDetail = null;
      currentPage = 'crew';
      render();
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'new-event') {
      if (isAdmin()) openModal('event');
      return;
    }

    if (action === 'edit-event') {
      if (isAdmin()) {
        const r = state.events.find(x => x.id === paramId);
        if (r) openModal('event', r);
      }
      return;
    }

    if (action === 'new-room') {
      if (isAdmin()) openModal('room');
      return;
    }

    if (action === 'edit-room') {
      if (isAdmin()) {
        const r = state.rooms.find(x => x.id === paramId);
        if (r) openModal('room', r);
      }
      return;
    }

    if (action === 'view-room') {
      const r = state.rooms.find(x => x.id === paramId);
      if (r) openModal('view-room', r);
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'delete-room') {
      if (!isAdmin()) return;
      const check = await api(`/admin/room-delete-check?id=${encodeURIComponent(paramId)}`);
      if (!check.canDelete) {
        toast('Cannot delete room: active events, assets, or maintenance items reference this space.', 'error');
        return;
      }
      const room = state.rooms.find(r => r.id === paramId);
      if (!confirm(`Delete space "${room?.name || paramId}"?`)) return;
      const ok = await saveState(s => {
        s.rooms = s.rooms.filter(r => r.id !== paramId);
      }, 'Space removed.');
      if (ok) render();
      return;
    }

    if (action === 'new-asset') {
      if (isAdmin()) openModal('asset');
      return;
    }

    if (action === 'edit-asset') {
      if (isAdmin()) {
        const a = state.assets.find(x => x.id === paramId);
        if (a) openModal('asset', a);
      }
      return;
    }

    if (action === 'view-asset') {
      const a = state.assets.find(x => x.id === paramId);
      if (a) openModal('view-asset', a);
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'report-asset') {
      openModal('maintenance', { assetId: paramId });
      return;
    }

    if (action === 'new-maintenance') {
      openModal('maintenance');
      return;
    }

    if (action === 'view-maintenance') {
      const r = state.maintenance.find(x => x.id === paramId);
      if (r) openModal('view-maintenance', r);
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'edit-maintenance') {
      if (isAdmin()) {
        const r = state.maintenance.find(x => x.id === paramId);
        if (r) openModal('maintenance', r);
      }
      return;
    }

    if (action === 'new-shift') {
      if (isAdmin()) openModal('shift');
      return;
    }

    if (action === 'shift-checklist') {
      currentEventDetail = paramId;
      currentPage = 'checklist';
      render();
      return;
    }

    if (action === 'remove-shift') {
      if (!isAdmin()) return;
      const event = ACTIVE_EVENT();
      if (!event) return;
      const shift = workFor(event.id).shifts.find(x => x.id === paramId);
      if (!shift) return;
      if (!confirm(`Remove shift for ${accountName(shift.userId)} on ${fmtDate(shift.date)}?`)) return;
      const ok = await saveState(s => {
        workFor(event.id).shifts = workFor(event.id).shifts.filter(x => x.id !== paramId);
      }, 'Shift removed.');
      if (ok) {
        currentEventDetail = null;
        render();
      }
      return;
    }

    if (action === 'new-handoff') {
      openModal('handoff');
      return;
    }

    if (action === 'view-handoff') {
      const h = workFor(ACTIVE_EVENT()?.id).handoffs.find(x => x.id === paramId);
      if (h) openModal('view-handoff', h);
      return;
    }

    if (action === 'handoff-from') {
      const h = workFor(ACTIVE_EVENT()?.id).handoffs.find(x => x.id === paramId);
      if (!h) return;
      const copy = clone(h);
      copy.id = '';
      copy.outgoingUserId = user.id;
      copy.createdAt = '';
      copy.acknowledgedBy = [];
      openModal('handoff', { data: copy });
      return;
    }

    if (action === 'ack-handoff') {
      const event = ACTIVE_EVENT();
      if (!event) return;
      const h = workFor(event.id).handoffs.find(x => x.id === paramId);
      if (!h) return;
      const already = (h.acknowledgedBy || []).includes(user.id);
      const ok = await saveState(s => {
        const entry = workFor(event.id).handoffs.find(x => x.id === paramId);
        entry.acknowledgedBy ||= [];
        entry.acknowledgedBy = already ? entry.acknowledgedBy.filter(x => x !== user.id) : [...entry.acknowledgedBy, user.id];
      }, already ? 'Acknowledgement removed.' : 'Shift handoff acknowledged.');
      if (ok) {
        closeModal();
        render();
      }
      return;
    }

    if (action === 'delete-handoff') {
      if (!isAdmin()) return;
      const event = ACTIVE_EVENT();
      if (!event) return;
      if (!confirm('Delete this handoff record from the event workspace?')) return;
      const ok = await saveState(s => {
        workFor(event.id).handoffs = workFor(event.id).handoffs.filter(x => x.id !== paramId);
      }, 'Handoff record deleted.');
      if (ok) {
        closeModal();
        render();
      }
      return;
    }

    if (action === 'new-incident') {
      openModal('incident');
      return;
    }

    if (action === 'view-incident') {
      const ev = state.events.find(e => workFor(e.id).incidents.some(i => i.id === paramId));
      const r = ev && workFor(ev.id).incidents.find(i => i.id === paramId);
      if (r) openModal('view-incident', r);
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'open-incident') {
      const eventId = b.dataset.eventId || ACTIVE_EVENT()?.id;
      const r = workFor(eventId).incidents.find(i => i.id === paramId);
      if (r) {
        if (eventId !== state.activeEventId && isAdmin()) {
          const ok = await saveState(s => {
            s.activeEventId = eventId;
          }, 'Switched to incident event workspace.');
          if (!ok) return;
        }
        currentPage = 'incidents';
        render();
        openModal('view-incident', r);
      }
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'go-maintenance') {
      currentPage = 'maintenance';
      currentFilter = '';
      currentStatusFilter = 'All';
      render();
      if (paletteActive) closePalette();
      return;
    }

    if (action === 'edit-template') {
      if (isAdmin()) {
        currentPage = 'settings';
        settingsTab = 'checklist';
        render();
      }
      return;
    }

    if (action === 'resolve-incident') {
      const event = ACTIVE_EVENT();
      if (!event) return;
      const inc = workFor(event.id).incidents.find(x => x.id === paramId);
      if (!inc) return;
      const resolving = b.dataset.resolve === 'true';
      const ok = await saveState(s => {
        const r = workFor(event.id).incidents.find(x => x.id === paramId);
        r.status = resolving ? 'Resolved' : 'Open';
        r.resolvedBy = resolving ? user.displayName : '';
        r.resolvedAt = resolving ? timeNow() : null;
      }, resolving ? 'Incident marked as resolved.' : 'Incident reopened.');
      if (ok) render();
      return;
    }

    if (action === 'delete-incident') {
      if (!isAdmin()) return;
      const event = ACTIVE_EVENT();
      if (!event) return;
      const inc = workFor(event.id).incidents.find(x => x.id === paramId);
      if (!inc) return;
      if (!confirm(`Delete incident "${inc.title}" from event history?`)) return;
      const ok = await saveState(s => {
        workFor(event.id).incidents = workFor(event.id).incidents.filter(x => x.id !== paramId);
      }, 'Incident deleted.');
      if (ok) render();
      return;
    }

    if (action === 'new-user') {
      if (isAdmin()) openModal('user');
      return;
    }

    if (action === 'reset-user-password') {
      if (!isAdmin()) return;
      const account = state.users.find(u => u.id === paramId);
      if (!account) return;
      const password = prompt(`Enter new password for ${account.username} (at least 12 characters):`);
      if (!password) return;
      try {
        await api(`/admin/users/${encodeURIComponent(paramId)}/password`, 'PUT', { password });
        await refreshAll();
        toast('Password updated. The crew member must sign in again.');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    if (action === 'toggle-user') {
      if (!isAdmin()) return;
      const enabled = b.dataset.enabled === 'true';
      const account = state.users.find(u => u.id === paramId);
      if (!account) return;
      if (!confirm(`${enabled ? 'Enable' : 'Disable'} account for ${account.displayName} (@${account.username})?`)) return;
      try {
        await api(`/admin/users/${encodeURIComponent(paramId)}/enabled`, 'PUT', { enabled });
        await refreshAll();
        toast(`Account ${enabled ? 'enabled' : 'disabled'}.`);
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    if (action === 'export-backup') {
      const backup = clone(state);
      delete backup._revision;
      delete backup.users;
      const blob = new Blob([JSON.stringify({ format: 'backstage-backup', version: 1, exportedAt: timeNow(), state: backup }, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backstage-backup-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Venue backup exported.');
      return;
    }

    if (action === 'choose-import') {
      $('#import-file')?.click();
      return;
    }

    if (action === 'reset-checklists') {
      if (!isAdmin()) return;
      if (!confirm('Reset checklist progress for every scheduled crew shift? This cannot be undone.')) return;
      const ok = await saveState(s => {
        for (const ws of Object.values(s.workspaces || {})) {
          for (const sh of ws.shifts || []) sh.completedTasks = {};
        }
      }, 'All checklist records reset.');
      if (ok) render();
      return;
    }
  });

  // Sidebar navigation switching
  document.addEventListener('click', e => {
    const navItem = e.target.closest('.nav-item[data-page]');
    if (!navItem) return;
    const page = navItem.dataset.page;
    if (page && PAGE_NAMES[page]) {
      currentPage = page;
      currentFilter = '';
      currentStatusFilter = 'All';
      currentPriorityFilter = 'All';
      $('#sidebar')?.classList.remove('open');
      render();
    }
  });

  // Table Column Header Sorting
  document.addEventListener('click', e => {
    const th = e.target.closest('th.sortable[data-sort]');
    if (!th) return;
    const column = th.dataset.sort;
    if (sortColumn === column) {
      sortAsc = !sortAsc;
    } else {
      sortColumn = column;
      sortAsc = true;
    }
    render();
  });

  // Form Submissions
  document.addEventListener('submit', async e => {
    const form = e.target.closest('form[data-form]');
    if (!form || form.id === 'login-form') return;
    e.preventDefault();
    const kind = form.dataset.form;
    const id = form.dataset.id;
    const data = Object.fromEntries(new FormData(form).entries());

    if (kind === 'event') {
      if (!isAdmin()) return;
      const roomIds = $$('input[name="roomIds"]:checked', form).map(x => x.value);
      const eventData = {
        name: data.name,
        type: data.type,
        date: data.date,
        status: data.status,
        phase: data.phase,
        technicalLead: data.technicalLead,
        accessTime: data.accessTime,
        callTime: data.callTime,
        endTime: data.endTime,
        strikeTime: data.strikeTime,
        contact: data.contact,
        radioChannel: data.radioChannel,
        roomIds,
        requirements: data.requirements,
        notes: data.notes
      };

      const ok = await saveState(s => {
        if (id) {
          const target = s.events.find(x => x.id === id);
          if (target) Object.assign(target, eventData, { updatedAt: timeNow() });
        } else {
          const newId = uid('evt');
          s.events.push({ id: newId, createdAt: timeNow(), updatedAt: timeNow(), ...eventData });
          s.workspaces[newId] = { shifts: [], incidents: [], handoffs: [] };
          s.activeEventId = newId;
        }
      }, id ? 'Booking updated.' : 'New event workspace created.');

      if (ok) closeModal();
      return;
    }

    if (kind === 'room') {
      if (!isAdmin()) return;
      const roomData = {
        name: data.name,
        code: data.code.toUpperCase(),
        type: data.type,
        capacity: data.capacity ? Number(data.capacity) : null,
        status: data.status,
        accessNotes: data.accessNotes
      };

      const ok = await saveState(s => {
        if (id) {
          const target = s.rooms.find(x => x.id === id);
          if (target) Object.assign(target, roomData);
        } else {
          s.rooms.push({ id: uid('room'), ...roomData });
        }
      }, id ? 'Space updated.' : 'New space registered.');

      if (ok) closeModal();
      return;
    }

    if (kind === 'asset') {
      if (!isAdmin()) return;
      const assetData = {
        tag: data.tag.toUpperCase(),
        name: data.name,
        department: data.department,
        roomId: data.roomId || '',
        model: data.model,
        serial: data.serial,
        status: data.status,
        notes: data.notes
      };

      const ok = await saveState(s => {
        if (id) {
          const target = s.assets.find(x => x.id === id);
          if (target) Object.assign(target, assetData);
        } else {
          s.assets.push({ id: uid('ast'), ...assetData });
        }
      }, id ? 'Equipment updated.' : 'Equipment registered.');

      if (ok) closeModal();
      return;
    }

    if (kind === 'maintenance') {
      const ticketData = {
        title: data.title,
        type: data.type,
        assetId: data.assetId || '',
        roomId: data.roomId || '',
        priority: data.priority,
        status: data.status || 'Open',
        assignedTo: data.assignedTo || '',
        description: data.description,
        reporter: user.displayName
      };

      const ok = await saveState(s => {
        if (id) {
          const target = s.maintenance.find(x => x.id === id);
          if (target) Object.assign(target, ticketData);
        } else {
          s.maintenance.push({ id: uid('mnt'), createdAt: timeNow(), ...ticketData });
        }
      }, id ? 'Service ticket updated.' : 'Service ticket submitted.');

      if (ok) closeModal();
      return;
    }

    if (kind === 'shift') {
      if (!isAdmin()) return;
      const event = ACTIVE_EVENT();
      if (!event) return;
      const shiftData = {
        id: uid('shf'),
        userId: data.userId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
        completedTasks: {}
      };

      const ok = await saveState(s => {
        workFor(event.id).shifts.push(shiftData);
      }, 'Crew shift scheduled.');

      if (ok) closeModal();
      return;
    }

    if (kind === 'handoff') {
      const event = ACTIVE_EVENT();
      if (!event) return;
      const handoffData = {
        id: uid('hnd'),
        outgoingUserId: user.id,
        incomingUserId: data.incomingUserId,
        priority: data.priority,
        shiftEnd: data.shiftEnd,
        nextShiftDate: data.nextShiftDate,
        nextShiftStart: data.nextShiftStart,
        currentSituation: data.currentSituation,
        completedWork: data.completedWork,
        outstandingTasks: data.outstandingTasks,
        nextActions: data.nextActions,
        createdAt: timeNow(),
        acknowledgedBy: []
      };

      const ok = await saveState(s => {
        workFor(event.id).handoffs.push(handoffData);
      }, 'Handoff report published.');

      if (ok) closeModal();
      return;
    }

    if (kind === 'incident') {
      const event = ACTIVE_EVENT();
      if (!event) return;
      const incidentData = {
        id: uid('inc'),
        title: data.title,
        category: data.category,
        priority: data.priority,
        location: data.location,
        assetId: data.assetId || '',
        followUpOwner: data.followUpOwner,
        description: data.description,
        reporter: user.displayName,
        status: 'Open',
        resolvedBy: '',
        resolvedAt: null,
        createdAt: timeNow()
      };

      const ok = await saveState(s => {
        workFor(event.id).incidents.push(incidentData);
      }, 'Operational incident logged.');

      if (ok) closeModal();
      return;
    }

    if (kind === 'user') {
      if (!isAdmin()) return;
      try {
        await api('/admin/users', 'POST', {
          displayName: data.displayName,
          username: data.username,
          password: data.password,
          role: data.role
        });
        await refreshAll();
        closeModal();
        toast('New crew account created.');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    if (kind === 'venue') {
      if (!isAdmin()) return;
      const ok = await saveState(s => {
        s.venue.name = data.name;
        s.venue.timezone = data.timezone;
      }, 'Venue settings updated.');
      return;
    }

    if (kind === 'checklist-template') {
      if (!isAdmin()) return;
      try {
        const parsed = JSON.parse(data.template);
        if (!Array.isArray(parsed)) throw new Error('Template must be an array of section objects.');
        const ok = await saveState(s => {
          s.checklistTemplate = parsed;
        }, 'Checklist template saved.');
      } catch (err) {
        toast(`Invalid JSON template: ${err.message}`, 'error');
      }
      return;
    }

    if (kind === 'workflow-options') {
      if (!isAdmin()) return;
      const parseLines = str =>
        String(str || '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean);

      const ok = await saveState(s => {
        s.settings.eventPhases = parseLines(data.eventPhases);
        s.settings.incidentCategories = parseLines(data.incidentCategories);
        s.settings.incidentPriorities = parseLines(data.incidentPriorities);
        s.settings.handoffPriorities = parseLines(data.handoffPriorities);
      }, 'Workflow options updated.');
      return;
    }
  });

  // Filter Changes
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'active-event-select') {
      if (!isAdmin()) return;
      const id = t.value;
      if (id === state.activeEventId) return;
      const ok = await saveState(s => {
        s.activeEventId = id;
      }, 'Active event workspace changed.');
      if (ok) {
        currentEventDetail = null;
        render();
      }
      return;
    }

    const filters = {
      'event-status-filter': v => { currentStatusFilter = v; },
      'room-status-filter': v => { currentStatusFilter = v; },
      'asset-status-filter': v => { currentStatusFilter = v; },
      'maintenance-status-filter': v => { currentStatusFilter = v; },
      'crew-filter': v => { currentStatusFilter = v; },
      'incident-status-filter': v => { currentStatusFilter = v; },
      'incident-priority-filter': v => { currentPriorityFilter = v; },
      'checklist-shift-select': v => { currentEventDetail = v; }
    };

    if (filters[t.id]) {
      filters[t.id](t.value);
      render();
      return;
    }

    // Interactive Checklist Task Toggle
    if (t.matches('input[data-action="toggle-task"]')) {
      const taskId = t.dataset.taskId;
      const shiftId = currentEventDetail;
      const event = ACTIVE_EVENT();
      if (!event || !shiftId) return;
      const shift = workFor(event.id).shifts.find(s => s.id === shiftId);
      if (!shift || (!isAdmin() && shift.userId !== user.id)) {
        t.checked = !t.checked;
        return;
      }
      const checked = t.checked;
      const ok = await saveState(s => {
        const sh = workFor(event.id).shifts.find(x => x.id === shiftId);
        sh.completedTasks ||= {};
        if (checked) sh.completedTasks[taskId] = true;
        else delete sh.completedTasks[taskId];
      }, 'Checklist task updated.');
      if (!ok) render();
      return;
    }

    // JSON Backup Import
    if (t.id === 'import-file' && t.files?.[0]) {
      if (!isAdmin()) {
        toast('Administrator access required.', 'error');
        return;
      }
      const file = t.files[0];
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = parsed.state || parsed;
        if (!confirm('Importing this file will replace all venue records. Continue?')) {
          t.value = '';
          return;
        }
        await api('/admin/import', 'POST', { revision, state: incoming });
        await loadState();
        currentPage = 'overview';
        render();
        toast('Venue backup imported successfully.');
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'error');
      } finally {
        t.value = '';
      }
    }
  });

  // Real-time Search Input Handling
  document.addEventListener('input', e => {
    const t = e.target;
    if (!t.id || !t.id.endsWith('-search')) return;
    currentFilter = t.value;
    const cursor = t.selectionStart;
    const id = t.id;
    render();
    const next = $(`#${id}`);
    if (next) {
      next.focus();
      try {
        next.setSelectionRange(cursor, cursor);
      } catch {
        /* ignore */
      }
    }
  });

  // Global Keyboard Shortcuts (Ctrl+K, Esc, ?)
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (paletteActive) closePalette();
      else openPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (paletteActive) {
        closePalette();
        return;
      }
      if ($('#modal-root').innerHTML) {
        closeModal();
        return;
      }
    }
  });

  // App Initialization
  (async function boot() {
    initTheme();
    try {
      const me = await api('/auth/me');
      user = me.user;
      await loadState();
      render();
    } catch (err) {
      if (err.status === 401) {
        renderLogin();
        return;
      }
      $('#app').innerHTML = `
        <div style="min-height:100vh;display:grid;place-items:center;padding:24px">
          <div class="panel" style="max-width:540px;padding:32px;text-align:center">
            <div class="brand-mark" style="margin:0 auto 18px">B</div>
            <h2 style="font-size:22px;font-weight:900;margin:0 0 10px">Backstage API Offline</h2>
            <p style="color:var(--text-secondary);font-size:14px;line-height:1.6">
              The web app could not connect to <strong>${esc(API)}</strong>. Ensure the Node API service is running and CORS/network settings allow this connection.
            </p>
            <div style="margin-top:22px">
              <button class="btn btn-primary" type="button" id="retry-api">Retry Connection</button>
            </div>
            <div class="helper" style="margin-top:16px">${esc(err.message || 'Unknown network error')}</div>
          </div>
        </div>`;
      $('#retry-api')?.addEventListener('click', () => location.reload());
    }
  })();
})();
