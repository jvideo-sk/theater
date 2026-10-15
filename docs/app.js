(() => {
  'use strict';
  const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = `${localHost ? location.origin : 'https://theatre-api.jvideo.dev'}/api`;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix || 'id'}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
  const fmtDate = v => { if (!v) return '—'; const d = new Date(`${String(v).slice(0,10)}T12:00:00`); return Number.isNaN(+d) ? String(v) : d.toLocaleDateString(undefined, { month:'short', day:'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }); };
  const fmtLong = v => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(+d) ? v : d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); };
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
  const timeNow = () => new Date().toISOString();
  const today = () => new Date().toISOString().slice(0,10);
  const sameDate = (a,b) => String(a || '').slice(0,10) === String(b || '').slice(0,10);
  const dateTime = (date,time='00:00') => new Date(`${date || today()}T${time || '00:00'}:00`).getTime();
  const isAdmin = () => user?.role === 'Administrator';
  let user = null, state = null, revision = 0, currentPage = 'overview', currentMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1), currentEventDetail = null;
  let currentFilter = '', currentStatusFilter = 'All', currentPriorityFilter = 'All', settingsTab = 'venue', eventTab = 'calendar', lastSavedAt = null, saving = false, lastToastTimer = null;

  const NAV = [
    {group:'OPERATIONS',items:[['overview','⌂','Overview / My Work'],['events','▦','Events & Bookings'],['crew','♙','Crew Schedule'],['checklist','☑','Shift Checklist'],['handoffs','⇄','Shift Handoff'],['incidents','⚠','Incident Register']]},
    {group:'VENUE',items:[['rooms','▤','Rooms & Facilities'],['inventory','▥','Equipment Inventory'],['maintenance','⌁','Maintenance & Service Desk']]},
    {group:'ADMINISTRATION',items:[['settings','⚙','Settings & Admin',true]]}
  ];
  const PAGE_NAMES = {overview:'Overview / My Work',events:'Events & Bookings',rooms:'Rooms & Facilities',inventory:'Equipment Inventory',maintenance:'Maintenance & Service Desk',crew:'Crew Schedule & Call Sheet',checklist:'Shift Checklist',handoffs:'Shift Handoff',incidents:'Incident Register',settings:'Settings & Administration'};
  const ACTIVE_EVENT = () => state?.events?.find(e => e.id === state.activeEventId) || state?.events?.[0] || null;
  const workFor = eventId => {
    if (!state.workspaces[eventId]) state.workspaces[eventId] = { shifts:[], incidents:[], handoffs:[] };
    const ws = state.workspaces[eventId]; ws.shifts ||= []; ws.incidents ||= []; ws.handoffs ||= []; return ws;
  };
  const accountName = id => state?.users?.find(u => u.id === id)?.displayName || state?.users?.find(u => u.id === id)?.username || 'Unassigned';
  const getRoom = id => state?.rooms?.find(r => r.id === id);
  const getAsset = id => state?.assets?.find(a => a.id === id);
  const roomNames = ids => (ids || []).map(id => getRoom(id)?.name || 'Unknown room').join(', ') || 'No rooms selected';
  const options = (values, selected, blank = 'Select…') => `${blank !== null ? `<option value="">${esc(blank)}</option>` : ''}${(values || []).map(v => { const value = typeof v === 'object' ? v.value : v; const label = typeof v === 'object' ? v.label : v; return `<option value="${esc(value)}" ${String(selected ?? '') === String(value) ? 'selected' : ''}>${esc(label)}</option>`; }).join('')}`;
  const statusTone = status => ({'Available':'green','Confirmed':'green','Complete':'green','Resolved':'green','In progress':'blue','Assigned':'blue','Limited access':'amber','Tentative':'amber','Needs service':'amber','Blocked':'amber','High':'amber','Urgent':'red','Out of service':'red','Missing':'red','Closed':'red','Under maintenance':'red','Cancelled':'red','Performance':'purple'}[status] || '');
  const badge = status => `<span class="status ${statusTone(status)}">${esc(status || 'Unknown')}</span>`;
  const btn = (label, action, kind='secondary', extras='') => { const actionMatch = extras.match(/data-action="([^"]+)"/); const typeMatch = extras.match(/type="([^"]+)"/); const actionValue = actionMatch ? actionMatch[1] : action; const typeValue = typeMatch ? typeMatch[1] : 'button'; const attrs = extras.replace(/class="[^"]*"/g,'').replace(/data-action="[^"]*"/g,'').replace(/type="[^"]*"/g,''); return `<button type="${typeValue}" class="btn btn-${kind}" data-action="${esc(actionValue)}" ${attrs}>${label}</button>`; };
  const iconBtn = (label, action, title='') => `<button type="button" class="icon-btn" aria-label="${esc(title || label)}" title="${esc(title || label)}" data-action="${esc(action)}">${label}</button>`;
  const empty = (title, description, action = '', label = '') => `<div class="empty"><div class="empty-icon">⌁</div><strong>${esc(title)}</strong><span>${esc(description)}</span>${action ? `<div style="margin-top:13px">${btn(label,action,'primary')}</div>` : ''}</div>`;
  const metric = (label,value,icon,foot='') => `<div class="metric"><div class="metric-top"><span>${esc(label)}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${esc(value)}</div>${foot ? `<div class="metric-foot">${esc(foot)}</div>`:''}</div>`;
  const panel = (title,body,action='',subtitle='') => `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">${title}</h2>${subtitle ? `<div class="panel-subtitle">${subtitle}</div>`:''}</div>${action ? `<button class="panel-link" data-action="${action}">View all →</button>`:''}</div><div class="panel-body">${body}</div></section>`;
  const tableEmptyRow = (span, label) => `<tr><td colspan="${span}" style="text-align:center;padding:32px;color:#8794a4">${esc(label)}</td></tr>`;

  async function api(path, method='GET', body=null) {
    const response = await fetch(`${API}${path}`, { method, credentials:'include', headers: body === null ? {} : {'Content-Type':'application/json'}, body:body === null ? undefined : JSON.stringify(body) });
    let data = {}; try { data = await response.json(); } catch { /* no json body */ }
    if (!response.ok) { const e = new Error(data.error || `Request failed (${response.status})`); e.status = response.status; e.details = data.details; e.retryAfter = response.headers.get('Retry-After'); throw e; }
    return data;
  }
  async function loadState() {
    const result = await api('/state'); state = result.state; user = result.user; revision = result.revision;
    state._revision = revision; lastSavedAt = state.meta?.lastUpdatedAt || null;
  }
  function toast(message, type='success') {
    const region = $('#toast-region'); if (!region) return;
    const box = document.createElement('div'); box.className = `toast ${type}`; box.textContent = message; region.appendChild(box);
    setTimeout(() => box.remove(), 3600);
  }
  async function refreshAll(notify=false) {
    try { await loadState(); render(); if (notify) toast('Shared venue record refreshed.'); }
    catch (err) { if (err.status === 401) renderLogin(); else toast(err.message || 'Could not refresh shared data.', 'error'); }
  }
  async function saveState(mutator, successMessage='Changes saved.') {
    if (saving) { toast('A save is already in progress.', 'error'); return false; }
    const previous = clone(state); const revBefore = revision;
    if (typeof mutator === 'function') mutator(state);
    state.meta ||= {}; state.meta.lastUpdatedAt = timeNow();
    saving = true; updateConnection('warning','Saving changes…');
    try {
      const result = await api('/state','PUT',{ revision:revBefore, state });
      revision = result.revision; state._revision = revision; lastSavedAt = result.savedAt;
      updateConnection('online',`Saved ${new Date(result.savedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`);
      saving = false; render(); if (successMessage) toast(successMessage); return true;
    } catch (err) {
      saving = false;
      state = previous;
      if (err.status === 409) {
        try { await loadState(); render(); } catch { /* preserve error below */ }
        toast('A newer version exists. Latest data loaded; please reapply your change.', 'error');
      } else if (err.status === 401) { user = null; renderLogin(); }
      else { updateConnection('offline','Save failed'); toast(err.message || 'Save failed. Your change was not saved.', 'error'); }
      return false;
    }
  }
  function updateConnection(mode,text) {
    const el = $('#connection-indicator'); if (!el) return;
    el.className = `connection ${mode === 'online' ? '' : mode === 'offline' ? 'offline' : 'warning'}`; el.innerHTML = `<span class="connection-dot"></span><span>${esc(text)}</span>`;
  }

  function renderLogin(error='') {
    $('#modal-root').innerHTML = '';
    $('#app').innerHTML = `<div class="login-wrap"><div class="login-brand"><div class="side-brand" style="padding:0;border:0"><span class="brand-mark">B</span><div><div class="brand-title" style="font-size:22px">Backstage</div><div class="brand-sub">VENUE OPERATIONS</div></div></div><h1>Keep the show<br>moving.</h1><p>One operational workspace for events, technical crews, equipment, maintenance, and the handoff between every shift.</p><div class="login-highlights"><span><i></i> Shared venue records</span><span><i></i> Role-based access</span><span><i></i> Event-by-event history</span></div></div><form class="login-card" id="login-form"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.13em;color:#4b8edb;margin-bottom:12px">VENUE WORKSPACE</div><h2>Sign in to Backstage</h2><p>Use your individual technician or administrator account.</p>${error ? `<div class="login-error" role="alert">${esc(error)}</div>`:''}<div class="field"><label for="login-username">Username</label><input id="login-username" name="username" autocomplete="username" required autofocus /></div><div class="field"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required /></div><button class="btn btn-primary" type="submit" style="width:100%;margin-top:7px;padding:11px">Sign in <span>→</span></button><div class="helper" style="margin-top:17px;text-align:center">Access is provided by your venue administrator.</div></form></div>`;
    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget); const button = $('button[type="submit"]',e.currentTarget); button.disabled = true; button.textContent = 'Signing in…';
      try { await api('/auth/login','POST',{username:form.get('username'),password:form.get('password')}); await loadState(); currentPage='overview'; render(); }
      catch(err) { renderLogin(err.message); }
    });
  }
  function render() {
    if (!user || !state) return renderLogin();
    const active = ACTIVE_EVENT();
    const nav = NAV.map(group => `<div class="nav-group"><div class="nav-heading">${group.group}</div>${group.items.filter(([id,icon,label,adminOnly])=>!adminOnly || isAdmin()).map(([id,icon,label,adminOnly]) => {
      if (adminOnly && !isAdmin()) return '';
      const count = id === 'incidents' ? state.events.reduce((sum,e)=>sum+workFor(e.id).incidents.filter(i=>i.status!=='Resolved').length,0) : id === 'maintenance' ? state.maintenance.filter(x=>x.status!=='Complete').length : 0;
      return `<button class="nav-item ${currentPage===id?'active':''}" data-page="${id}"><span class="nav-icon">${icon}</span><span>${label}</span>${count>0?`<span class="nav-count">${count}</span>`:''}</button>`;
    }).join('')}</div>`).join('');
    $('#app').innerHTML = `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="side-brand"><span class="brand-mark">B</span><div><div class="brand-title">Backstage</div><div class="brand-sub">Venue Operations</div></div></div><nav>${nav}</nav><div class="side-bottom"><div class="connection" id="connection-indicator"><span class="connection-dot"></span><span>Connected · saved</span></div><div class="user-mini"><span class="avatar">${esc(initials(user.displayName))}</span><div><div class="user-mini-name">${esc(user.displayName)}</div><div class="user-mini-role">${esc(user.role)}</div></div><button class="signout" type="button" title="Sign out" aria-label="Sign out" data-action="logout">↗</button></div></div></aside><div class="main-column"><header class="topbar"><div style="display:flex;align-items:center;gap:12px;min-width:0"><button type="button" class="icon-btn mobile-menu" data-action="toggle-menu" aria-label="Open navigation">☰</button><div><div class="breadcrumb">${esc(state.venue.name)} / OPERATIONS</div><div class="page-title">${esc(PAGE_NAMES[currentPage] || 'Backstage')}</div></div></div><div class="top-actions">${state.events.length ? `<select class="active-event-select" id="active-event-select" aria-label="Active event workspace" ${!isAdmin()?'disabled':''}>${state.events.map(e=>`<option value="${esc(e.id)}" ${e.id===state.activeEventId?'selected':''}>${esc(e.name)}</option>`).join('')}</select>` : ''}<button class="btn btn-secondary hide-small" type="button" data-action="refresh">↻ <span>Refresh</span></button><button class="btn btn-secondary hide-small" type="button" data-action="print">Print</button></div></header><main id="main-content" class="main-content">${renderPage()}</main></div></div>`;
    updateConnection('online',`Shared record · ${lastSavedAt ? 'saved '+new Date(lastSavedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : 'connected'}`);
  }
  function pageIntro(title, description, actions='') { return `<div class="page-intro"><div><h1>${title}</h1><p>${description}</p></div><div class="intro-actions">${actions}</div></div>`; }
  function renderPage() {
    switch(currentPage) {
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
  function isOpenStatus(status) { return !['Complete','Resolved','Cancelled'].includes(status); }
  function renderOverview() {
    const active = ACTIVE_EVENT();
    const upcoming = [...state.events].filter(e=>e.status!=='Cancelled' && e.date>=today() && e.status!=='Complete').sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(0,5);
    const openMaintenance = state.maintenance.filter(m=>m.status!=='Complete');
    const eventIncidents = state.events.flatMap(e=>workFor(e.id).incidents.filter(i=>i.status!=='Resolved').map(i=>({...i,eventName:e.name,eventId:e.id}))).sort((a,b)=>({Urgent:0,High:1,Normal:2,Low:3}[a.priority]??2)-({Urgent:0,High:1,Normal:2,Low:3}[b.priority]??2));
    const allShifts = state.events.flatMap(e=>workFor(e.id).shifts.map(s=>({...s,event:e}))).filter(s=>s.date>=today()).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
    const myShifts = allShifts.filter(s=>s.userId===user.id);
    const todaysShifts = allShifts.filter(s=>sameDate(s.date,today()));
    const shift = (isAdmin()?allShifts:myShifts)[0];
    const personalShift = myShifts[0] || null;
    const personalProgress = personalShift ? checklistProgress(personalShift) : {done:0,total:state.checklistTemplate.flatMap(s=>s.tasks||[]).length,percent:0};
    const recentHandoffs = active ? workFor(active.id).handoffs.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,3) : [];
    const overviewMetrics = isAdmin()
      ? `${metric('Upcoming events',state.events.filter(e=>e.date>=today()&&!['Cancelled','Complete'].includes(e.status)).length,'▦','Confirmed and tentative bookings')}${metric('Assets needing attention',state.assets.filter(a=>['Needs service','Out of service','Missing'].includes(a.status)).length,'⚠','Service, out of service, or missing')}${metric('Open maintenance',openMaintenance.length,'⌁','Venue-wide requests')}${metric('Available rooms',state.rooms.filter(r=>r.status==='Available').length,'▤',`${state.rooms.length} tracked spaces`)}`
      : `${metric('My next call',personalShift?fmtDate(personalShift.date):'—','♙',personalShift?`${personalShift.startTime}–${personalShift.endTime}`:'No upcoming assignment')}${metric('My calls today',myShifts.filter(s=>sameDate(s.date,today())).length,'◷','Shifts assigned to you')}${metric('Open incidents',eventIncidents.length,'⚠','Across venue event history')}${metric('Service requests',openMaintenance.length,'⌁','Open venue maintenance')}`;
    let mainBody = active ? `<div class="record-row"><span class="alert-mark blue">▦</span><div class="row-main"><div class="row-title">${esc(active.name)}</div><div class="row-sub">${esc(active.type)} · ${fmtDate(active.date)} · ${esc(roomNames(active.roomIds))}</div><div class="row-sub" style="margin-top:7px">Phase: ${esc(active.phase||'Not set')} ${badge(active.status)}</div></div><div>${btn('Open workspace','open-event:'+active.id,'secondary','class="btn btn-secondary btn-small" data-action="open-event" data-id="'+esc(active.id)+'"')}</div></div><div class="detail-side-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:15px"><div class="detail-box"><div class="detail-label">Access / Call</div><div class="detail-value">${esc(active.accessTime||'—')} / ${esc(active.callTime||'—')}</div></div><div class="detail-box"><div class="detail-label">Technical lead</div><div class="detail-value">${esc(active.technicalLead||'Not assigned')}</div></div><div class="detail-box"><div class="detail-label">Radio channel</div><div class="detail-value">${esc(active.radioChannel||'—')}</div></div></div>` : empty('No active event','Create an event booking to start a workspace.','new-event','Create event');
    const alertItems = [
      ...eventIncidents.slice(0,4).map(i=>({icon:'⚠',tone:i.priority==='Urgent'||i.priority==='High'?'danger':'',title:i.title,sub:`${i.eventName} · ${i.location||'Location not set'}`,right:i.priority||'Normal',action:'open-incident',id:i.id,eventId:i.eventId})),
      ...openMaintenance.filter(m=>m.priority==='Urgent'||m.priority==='High').slice(0,3).map(m=>({icon:'⌁',tone:'danger',title:m.title,sub:`Maintenance · ${m.roomName||getRoom(m.roomId)?.name||getAsset(m.assetId)?.name||'Venue-wide'}`,right:m.priority,action:'go-maintenance'}))
    ].slice(0,5);
    const shiftBody = (isAdmin()?allShifts:myShifts).slice(0,5).map(s=>`<div class="record-row"><span class="avatar" style="width:30px;height:30px">${esc(initials(accountName(s.userId)))}</span><div class="row-main"><div class="row-title">${esc(accountName(s.userId))} <span class="muted" style="font-weight:400">· ${esc(s.event.name)}</span></div><div class="row-sub">${fmtDate(s.date)} · ${esc(s.startTime)}–${esc(s.endTime)}${s.notes?` · ${esc(s.notes)}`:''}</div></div><div class="row-right">${sameDate(s.date,today())?'<span class="status blue">Today</span>':`<span class="small muted">${fmtDate(s.date)}</span>`}</div></div>`).join('');
    return `${pageIntro(`Good ${new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}, ${esc(user.displayName.split(' ')[0])}.`,`Your venue status at a glance. ${isAdmin()?'Manage the whole venue and keep the crew ready.':'Here is your next call, assigned work, and anything that needs a hand.'}`,`${isAdmin()?btn('＋ New event','new-event','primary'):btn('＋ Report issue','new-maintenance','primary')}${btn('View call sheet','goto-crew','secondary')}`)}<div class="metrics">${overviewMetrics}</div><div class="grid-2"><div class="stack">${panel('Active event',mainBody,'goto-events','Current workspace and technical context')}${panel(isAdmin()?'Crew coverage':'My upcoming calls',shiftBody||empty(isAdmin()?'No upcoming crew calls':'No upcoming calls',isAdmin()?'Add shift assignments to populate the call sheet.':'You have no upcoming shifts assigned.'),'goto-crew')}${!isAdmin()?panel('My shift progress',personalShift?`<div class="record-row"><div class="row-main"><div class="row-title">${esc(personalShift.notes||'Technical coverage')}</div><div class="row-sub">${fmtDate(personalShift.date)} · ${esc(personalShift.startTime)}–${esc(personalShift.endTime)}</div><div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:${personalProgress.percent}%"></div></div><div class="row-sub" style="margin-top:5px">${personalProgress.done} of ${personalProgress.total} tasks complete</div></div></div>${btn('Open checklist','goto-checklist','secondary')}`:empty('No shift assigned','Your next shift checklist will appear here.'),'goto-checklist'):''}${!isAdmin()?panel('Recent handoffs',recentHandoffs.length?`<div class="record-list">${recentHandoffs.map(h=>`<div class="record-row"><span class="alert-mark blue">⇄</span><div class="row-main"><div class="row-title">${esc(accountName(h.outgoingUserId))} → ${esc(accountName(h.incomingUserId))}</div><div class="row-sub">${esc(h.currentSituation||'No situation summary').slice(0,90)}</div><div class="row-sub">${fmtLong(h.createdAt)}</div></div></div>`).join('')}</div>`:empty('No handoffs yet','Saved handoffs for the active event appear here.'),'goto-handoffs'):''}</div><div class="stack">${panel('Needs attention',alertItems.length?`<div class="alert-list">${alertItems.map(a=>`<div class="alert-row"><span class="alert-mark ${a.tone}">${a.icon}</span><div class="row-main"><div class="row-title">${esc(a.title)}</div><div class="row-sub">${esc(a.sub)}</div></div><div class="row-right">${a.right?badge(a.right):''}</div>${a.action?`<button class="icon-btn" style="align-self:center" data-action="${a.action}" ${a.id?`data-id="${esc(a.id)}"`:''} ${a.eventId?`data-event-id="${esc(a.eventId)}"`:''}>›</button>`:''}</div>`).join('')}</div>`:empty('All caught up','No open high-priority issues are waiting.'),'goto-incidents')}${panel('Upcoming events',upcoming.length?`<div class="record-list">${upcoming.map(e=>`<div class="record-row"><div class="row-main"><div class="row-title">${esc(e.name)}</div><div class="row-sub">${fmtDate(e.date)} · ${esc(e.type)} · ${esc(roomNames(e.roomIds))}</div></div><div class="row-right">${badge(e.status)}</div></div>`).join('')}</div>`:empty('No upcoming bookings','New confirmed and tentative events will show here.'),'goto-events')}</div></div><div class="footer-note">Backstage · Shared venue record · Revision ${revision}</div>`;
  }

  function renderEvents() {
    const all = [...state.events].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const events = all.filter(e => (!currentFilter || `${e.name} ${e.type} ${e.technicalLead||''} ${e.notes||''}`.toLowerCase().includes(currentFilter.toLowerCase())) && (currentStatusFilter==='All'||e.status===currentStatusFilter));
    const month = currentMonth; const monthName = month.toLocaleDateString(undefined,{month:'long',year:'numeric'}); const firstDay = new Date(month.getFullYear(),month.getMonth(),1).getDay(); const days = new Date(month.getFullYear(),month.getMonth()+1,0).getDate(); const prevDays = new Date(month.getFullYear(),month.getMonth(),0).getDate();
    const cells=[]; for(let i=0;i<42;i++){const raw=i-firstDay+1;let day=raw,muted=false,date='';if(raw<1){day=prevDays+raw;muted=true;date=`${month.getFullYear()}-${String(month.getMonth()).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}else if(raw>days){day=raw-days;muted=true;const nm=new Date(month.getFullYear(),month.getMonth()+1,1);date=`${nm.getFullYear()}-${String(nm.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}else date=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(i>=35&&raw>days)continue;const dayEvents=all.filter(e=>sameDate(e.date,date));cells.push(`<div class="calendar-day ${muted?'muted-day':''} ${date===today()?'today':''}"><div class="calendar-day-number">${day}${date===today()?' <span style="color:#397fc9">· today</span>':''}</div>${dayEvents.slice(0,3).map(e=>`<button class="event-chip ${e.status==='Cancelled'?'cancelled':''}" title="${esc(e.name)}" data-action="open-event" data-id="${esc(e.id)}">${esc(e.name)}</button>`).join('')}${dayEvents.length>3?`<div class="small muted">+${dayEvents.length-3} more</div>`:''}</div>`);}
    const calendar = `<div class="panel"><div class="panel-header"><div class="calendar-toolbar">${iconBtn('‹','calendar-prev','Previous month')}<span class="calendar-title">${monthName}</span>${iconBtn('›','calendar-next','Next month')}${btn('Today','calendar-today','secondary','class="btn btn-secondary btn-small" data-action="calendar-today"')}</div><div class="small muted">${state.events.length} booking${state.events.length===1?'':'s'}</div></div><div class="calendar">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="calendar-head">${d}</div>`).join('')}${cells.join('')}</div></div>`;
    const table = `<div class="panel"><div class="toolbar"><div class="search-box"><span class="search-icon">⌕</span><input id="event-search" value="${esc(currentFilter)}" placeholder="Search events, leads, notes…" /></div><select id="event-status-filter">${options(['All','Confirmed','Tentative','In progress','Complete','Cancelled'],currentStatusFilter,null)}</select><div class="small muted">${events.length} results</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Event</th><th>Date / Call</th><th>Rooms</th><th>Technical lead</th><th>Status</th><th></th></tr></thead><tbody>${events.length?events.map(e=>`<tr><td><div class="table-primary">${esc(e.name)}</div><div class="table-meta">${esc(e.type)} · ${esc(e.phase||'No phase')}</div></td><td>${fmtDate(e.date)}<div class="table-meta">Access ${esc(e.accessTime||'—')} · Call ${esc(e.callTime||'—')}</div></td><td>${esc(roomNames(e.roomIds))}</td><td>${esc(e.technicalLead||'—')}</td><td>${badge(e.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="open-event" data-id="${esc(e.id)}">Workspace</button>${isAdmin()?`<button class="btn btn-quiet btn-small" data-action="edit-event" data-id="${esc(e.id)}">Edit</button>`:''}</div></td></tr>`).join(''):tableEmptyRow(6,'No events match your filters.')}</tbody></table></div></div>`;
    return `${pageIntro('Events & Bookings','Schedule every production, performance, rehearsal, rental, meeting, and technical call. Each event has its own operational history.',`${isAdmin()?btn('＋ Create booking','new-event','primary'):''}${btn('Print view','print','secondary')}`)}<div class="pill-tabs" style="margin-bottom:14px"><button class="pill-tab ${eventTab==='calendar'?'active':''}" data-action="event-tab" data-tab="calendar">Calendar</button><button class="pill-tab ${eventTab==='list'?'active':''}" data-action="event-tab" data-tab="list">Event catalogue</button></div>${eventTab==='calendar'?calendar:table}`;
  }

  function renderRooms() {
    const rooms = state.rooms.filter(r => (!currentFilter || `${r.name} ${r.code} ${r.type} ${r.accessNotes||''}`.toLowerCase().includes(currentFilter.toLowerCase())) && (currentStatusFilter==='All'||r.status===currentStatusFilter));
    return `${pageIntro('Rooms & Facilities','A shared directory of stages, rehearsal spaces, public areas, backstage rooms, storage, and offices.',`${isAdmin()?btn('＋ Add room','new-room','primary'):''}`)}<div class="metrics">${metric('Tracked spaces',state.rooms.length,'▤','Venue rooms and facilities')}${metric('Available',state.rooms.filter(r=>r.status==='Available').length,'✓','Ready to book')}${metric('Limited access',state.rooms.filter(r=>r.status==='Limited access').length,'⌁','Review access notes')}${metric('Unavailable',state.rooms.filter(r=>['Under maintenance','Closed'].includes(r.status)).length,'⚠','Booking is blocked')}</div><div class="panel"><div class="toolbar"><div class="search-box"><span class="search-icon">⌕</span><input id="room-search" value="${esc(currentFilter)}" placeholder="Search name, code, type…" /></div><select id="room-status-filter">${options(['All','Available','Limited access','Under maintenance','Closed'],currentStatusFilter,null)}</select><span class="small muted">${rooms.length} spaces</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Room</th><th>Type</th><th>Capacity</th><th>Upcoming bookings</th><th>Status</th><th></th></tr></thead><tbody>${rooms.length?rooms.map(r=>{const count=state.events.filter(e=>(e.roomIds||[]).includes(r.id)&&e.date>=today()&&!['Cancelled','Complete'].includes(e.status)).length;return `<tr><td><div class="table-primary">${esc(r.name)}</div><div class="table-meta">${esc(r.code)} ${r.accessNotes?`· ${esc(r.accessNotes)}`:''}</div></td><td>${esc(r.type)}</td><td>${r.capacity?esc(r.capacity):'—'}</td><td>${count}</td><td>${badge(r.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="view-room" data-id="${esc(r.id)}">Details</button>${isAdmin()?`<button class="btn btn-quiet btn-small" data-action="edit-room" data-id="${esc(r.id)}">Edit</button><button class="btn btn-quiet btn-small" data-action="delete-room" data-id="${esc(r.id)}">Remove</button>`:''}</div></td></tr>`;}).join(''):tableEmptyRow(6,'No rooms match your filters.')}</tbody></table></div></div>`;
  }

  function renderInventory() {
    const assets = state.assets.filter(a => (!currentFilter || `${a.name} ${a.tag} ${a.department} ${a.model||''} ${a.serial||''}`.toLowerCase().includes(currentFilter.toLowerCase())) && (currentStatusFilter==='All'||a.status===currentStatusFilter));
    const needs = state.assets.filter(a=>['Needs service','Out of service','Missing'].includes(a.status)).length;
    return `${pageIntro('Equipment Inventory','Track shared technical assets across Audio, Lighting, Video, Rigging, Comms, Power, Tools, Staging, IT, and other departments.',`${isAdmin()?btn('＋ Register equipment','new-asset','primary'):''}`)}<div class="metrics">${metric('Tracked assets',state.assets.length,'▥','Unique asset tags')}${metric('Available',state.assets.filter(a=>a.status==='Available').length,'✓','Ready for use')}${metric('Assigned',state.assets.filter(a=>a.status==='Assigned').length,'♙','Marked as assigned')}${metric('Needs attention',needs,'⚠','Service, out of service, or missing')}</div><div class="panel"><div class="toolbar"><div class="search-box"><span class="search-icon">⌕</span><input id="asset-search" value="${esc(currentFilter)}" placeholder="Search asset, tag, model, department…" /></div><select id="asset-status-filter">${options(['All','Available','Assigned','Needs service','Out of service','Missing'],currentStatusFilter,null)}</select><span class="small muted">${assets.length} assets</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Asset</th><th>Department</th><th>Location</th><th>Model / Serial</th><th>Status</th><th></th></tr></thead><tbody>${assets.length?assets.map(a=>`<tr><td><div class="table-primary">${esc(a.name)}</div><div class="table-meta">${esc(a.tag)}</div></td><td>${esc(a.department)}</td><td>${esc(getRoom(a.roomId)?.name||'Unassigned')}</td><td>${esc(a.model||'—')}<div class="table-meta">${esc(a.serial||'No serial recorded')}</div></td><td>${badge(a.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="view-asset" data-id="${esc(a.id)}">Details</button><button class="btn btn-quiet btn-small" data-action="report-asset" data-id="${esc(a.id)}">Report issue</button>${isAdmin()?`<button class="btn btn-quiet btn-small" data-action="edit-asset" data-id="${esc(a.id)}">Edit</button>`:''}</div></td></tr>`).join(''):tableEmptyRow(6,'No assets match your filters.')}</tbody></table></div></div><div class="helper" style="margin-top:12px">Inventory is a venue-wide asset register. Gear checkout and per-event equipment reservations are not included.</div>`;
  }

  function renderMaintenance() {
    const all = state.maintenance.filter(m => (!currentFilter || `${m.title} ${m.description||''} ${m.reporter||''} ${getAsset(m.assetId)?.name||''} ${getRoom(m.roomId)?.name||''}`.toLowerCase().includes(currentFilter.toLowerCase())) && (currentStatusFilter==='All'||m.status===currentStatusFilter));
    const priorityOrder={Urgent:0,High:1,Normal:2,Low:3}; all.sort((a,b)=>(priorityOrder[a.priority]??2)-(priorityOrder[b.priority]??2)||String(b.createdAt).localeCompare(String(a.createdAt)));
    return `${pageIntro('Maintenance & Service Desk','Venue-wide repair and service queue. Keep equipment maintenance separate from an incident’s event history.',`${btn('＋ New service request','new-maintenance','primary')}`)}<div class="metrics">${metric('Total requests',state.maintenance.length,'⌁','All records')}${metric('Open',state.maintenance.filter(m=>m.status==='Open').length,'◷','Awaiting triage')}${metric('In progress',state.maintenance.filter(m=>m.status==='In progress').length,'↻','Being worked')}${metric('High / urgent',state.maintenance.filter(m=>isOpenStatus(m.status)&&['High','Urgent'].includes(m.priority)).length,'⚠','Needs prioritization')}</div><div class="panel"><div class="toolbar"><div class="search-box"><span class="search-icon">⌕</span><input id="maintenance-search" value="${esc(currentFilter)}" placeholder="Search request, asset, room, reporter…" /></div><select id="maintenance-status-filter">${options(['All','Open','In progress','Blocked','Complete'],currentStatusFilter,null)}</select><span class="small muted">${all.length} requests</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Request</th><th>Location / Asset</th><th>Priority</th><th>Reporter</th><th>Status</th><th></th></tr></thead><tbody>${all.length?all.map(m=>`<tr><td><div class="table-primary">${esc(m.title)}</div><div class="table-meta">${esc(m.type)} · ${fmtDate(m.createdAt)}</div></td><td>${esc(getRoom(m.roomId)?.name||getAsset(m.assetId)?.name||'Venue-wide')}<div class="table-meta">${m.assignedTo?`Owner: ${esc(m.assignedTo)}`:'No owner assigned'}</div></td><td>${badge(m.priority)}</td><td>${esc(m.reporter||'—')}</td><td>${badge(m.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="view-maintenance" data-id="${esc(m.id)}">Details</button>${isAdmin()?`<button class="btn btn-quiet btn-small" data-action="edit-maintenance" data-id="${esc(m.id)}">Update</button>`:''}</div></td></tr>`).join(''):tableEmptyRow(6,'No maintenance requests match your filters.')}</tbody></table></div></div>`;
  }

  function renderCrew() {
    const event = ACTIVE_EVENT(); const ws = event ? workFor(event.id) : {shifts:[]};
    const filter = currentStatusFilter;
    let shifts = event ? [...ws.shifts] : [];
    if (filter==='Upcoming') shifts=shifts.filter(s=>s.date>=today()); if(filter==='Today') shifts=shifts.filter(s=>sameDate(s.date,today())); if(filter==='Past') shifts=shifts.filter(s=>s.date<today());
    if(currentFilter) shifts=shifts.filter(s=>`${accountName(s.userId)} ${state.users.find(u=>u.id===s.userId)?.username||''} ${s.notes||''} ${s.date}`.toLowerCase().includes(currentFilter.toLowerCase()));
    shifts.sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
    const allShifts = event ? ws.shifts : []; const todayCount=allShifts.filter(s=>sameDate(s.date,today())).length; const next=allShifts.filter(s=>`${s.date}T${s.startTime}`>=`${today()}T${new Date().toTimeString().slice(0,5)}`).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime))[0];
    return `${pageIntro('Crew Schedule & Call Sheet',event?`Technical coverage for ${esc(event.name)}. This is a call sheet, not a time clock or payroll timesheet.`:'Select an event workspace to manage crew coverage.',`${isAdmin()&&event?btn('＋ Schedule shift','new-shift','primary'):''}`)}<div class="metrics">${metric('Scheduled shifts',allShifts.length,'♙','This event')}${metric('Today’s calls',todayCount,'◷','Scheduled for today')}${metric('Next on duty',next?accountName(next.userId):'—','⇢',next?`${fmtDate(next.date)} · ${next.startTime}`:'No next assignment')}${metric('Crew assigned',new Set(allShifts.map(s=>s.userId)).size,'◎','Unique technicians')}</div><div class="panel"><div class="toolbar"><div class="search-box"><span class="search-icon">⌕</span><input id="crew-search" value="${esc(currentFilter)}" placeholder="Search technician, date, assignment notes…" /></div><select id="crew-filter">${options(['All','Upcoming','Today','Past'],currentStatusFilter,null)}</select><span class="small muted">${shifts.length} shifts shown</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Technician</th><th>Date</th><th>Shift time</th><th>Post / assignment notes</th><th>Checklist</th><th></th></tr></thead><tbody>${shifts.length?shifts.map(s=>{const done=checklistProgress(s);return `<tr><td><div class="table-primary">${esc(accountName(s.userId))}</div><div class="table-meta">${esc(state.users.find(u=>u.id===s.userId)?.username||'')}</div></td><td>${fmtDate(s.date)} ${sameDate(s.date,today())?'<div class="table-meta" style="color:#2d7fcf">Today</div>':''}</td><td>${esc(s.startTime)}–${esc(s.endTime)}</td><td>${esc(s.notes||'General technical coverage')}</td><td><div style="min-width:85px"><div class="small">${done.done}/${done.total} tasks</div><div class="progress-track" style="margin-top:5px"><div class="progress-fill" style="width:${done.percent}%"></div></div></div></td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="shift-checklist" data-id="${esc(s.id)}">Checklist</button>${isAdmin()?`<button class="btn btn-quiet btn-small" data-action="remove-shift" data-id="${esc(s.id)}">Remove</button>`:''}</div></td></tr>`;}).join(''):tableEmptyRow(6,isAdmin()?'No shifts have been scheduled for this event.':'No shifts are assigned to your account for this event.')}</tbody></table></div></div>`;
  }
  function checklistProgress(shift) {
    const tasks = state.checklistTemplate.flatMap(s=>s.tasks||[]); const completed=shift.completedTasks||{}; const done=tasks.filter(t=>!!completed[t.id]).length; return {done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0};
  }
  function myShiftForEvent(eventId) {
    const ws=workFor(eventId); return ws.shifts.filter(s=>s.userId===user.id).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime)).find(s=>s.date>=today()) || ws.shifts.filter(s=>s.userId===user.id).sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime))[0] || null;
  }
  function renderChecklist() {
    const event=ACTIVE_EVENT(); const ws=event?workFor(event.id):null; let selectedShiftId = currentEventDetail;
    let shift=selectedShiftId && ws?.shifts.find(s=>s.id===selectedShiftId);
    if(!shift) shift=isAdmin() ? (ws?.shifts.slice().sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime)).find(s=>s.date>=today())||ws?.shifts[0]) : myShiftForEvent(event?.id);
    if(shift) currentEventDetail=shift.id;
    const progress=shift?checklistProgress(shift):{done:0,total:state.checklistTemplate.flatMap(s=>s.tasks||[]).length,percent:0};
    const allowedShift=shift && (isAdmin()||shift.userId===user.id);
    const sections=state.checklistTemplate.map(sec=>`<div class="panel checklist-section"><div class="checklist-section-head"><div><h3>${esc(sec.name)}</h3>${sec.description?`<div class="row-sub">${esc(sec.description)}</div>`:''}</div><span class="tag">${(sec.tasks||[]).filter(t=>shift?.completedTasks?.[t.id]).length}/${(sec.tasks||[]).length}</span></div>${(sec.tasks||[]).map(task=>`<label class="checklist-task ${shift?.completedTasks?.[task.id]?'task-done':''}"><input type="checkbox" data-action="toggle-task" data-task-id="${esc(task.id)}" ${shift?.completedTasks?.[task.id]?'checked':''} ${!allowedShift?'disabled':''}><span><span class="task-label">${esc(task.label)}</span>${task.instructions?`<div class="task-instructions">${esc(task.instructions)}</div>`:''}</span></label>`).join('')}</div>`).join('');
    const shiftOptions=ws?.shifts.filter(s=>isAdmin()||s.userId===user.id).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime)).map(s=>({value:s.id,label:`${fmtDate(s.date)} · ${s.startTime} · ${accountName(s.userId)}`}))||[];
    return `${pageIntro('Shift Checklist','A per-shift operational checklist. Progress is saved on the selected assignment, not shared across every technician.',`${isAdmin()?btn('Edit checklist template','edit-template','secondary'):''}`)}<div class="panel" style="margin-bottom:17px"><div class="panel-body"><div class="fields-2" style="align-items:end"><div class="field"><label for="checklist-shift-select">Shift assignment</label><select id="checklist-shift-select">${options(shiftOptions,shift?.id,shiftOptions.length?'Select a shift':'No shifts assigned')}</select></div><div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px"><div><div style="font:700 13px Manrope,sans-serif">${progress.percent}% complete</div><div class="small muted">${progress.done} of ${progress.total} checklist tasks</div></div>${shift?badge(fmtDate(shift.date)) : ''}</div><div class="progress-track" style="height:9px"><div class="progress-fill" style="width:${progress.percent}%"></div></div></div></div>${shift?`<div class="helper" style="margin-top:13px">${esc(event?.name||'No event')} · ${esc(accountName(shift.userId))} · ${esc(shift.startTime)}–${esc(shift.endTime)} ${shift.notes?`· ${esc(shift.notes)}`:''}</div>`:''}</div></div>${shift?sections:empty('No shift selected','Create a shift in Crew Schedule before completing checklist tasks.','goto-crew','Open call sheet')}`;
  }

  function renderHandoffs() {
    const event=ACTIVE_EVENT(); const ws=event?workFor(event.id):{handoffs:[]}; const all=[...ws.handoffs].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const filtered=all.filter(h=>!currentFilter||`${h.currentSituation||''} ${h.completedWork||''} ${h.outstandingTasks||''} ${accountName(h.outgoingUserId)} ${accountName(h.incomingUserId)}`.toLowerCase().includes(currentFilter.toLowerCase()));
    const last = all[0];
    return `${pageIntro('Shift Handoff','Pass on the operational context the next technician needs: current situation, work status, technical details, blockers, and next actions.',`${btn('＋ Create handoff','new-handoff','primary')}`)}${last?`<div class="panel" style="margin-bottom:17px"><div class="panel-header"><div><h2 class="panel-title">Latest handoff</h2><div class="panel-subtitle">${fmtLong(last.createdAt)} · ${esc(accountName(last.outgoingUserId))} → ${esc(accountName(last.incomingUserId))}</div></div>${badge(last.priority)}</div><div class="panel-body"><div class="grid-3" style="margin-bottom:14px"><div><div class="detail-label">Current situation</div><div class="detail-value">${esc(last.currentSituation||'No situation summary')}</div></div><div><div class="detail-label">Outstanding work</div><div class="detail-value">${esc(last.outstandingTasks||'None recorded')}</div></div><div><div class="detail-label">Next actions</div><div class="detail-value">${esc(last.nextActions||'None recorded')}</div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Use as starting point','handoff-from:'+last.id,'secondary','class="btn btn-secondary" data-action="handoff-from" data-id="'+esc(last.id)+'"')}${btn(last.acknowledgedBy?.includes(user.id)?'Undo acknowledgement':'Mark as read','ack-handoff:'+last.id,'secondary','class="btn btn-secondary" data-action="ack-handoff" data-id="'+esc(last.id)+'"')}</div></div></div>`:''}<div class="panel"><div class="toolbar"><div class="search-box"><span class="search-icon">⌕</span><input id="handoff-search" value="${esc(currentFilter)}" placeholder="Search handoff notes, staff…" /></div><span class="small muted">${filtered.length} entries</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Handoff</th><th>Shift timing</th><th>Priority</th><th>Read status</th><th></th></tr></thead><tbody>${filtered.length?filtered.map(h=>`<tr><td><div class="table-primary">${esc(accountName(h.outgoingUserId))} → ${esc(accountName(h.incomingUserId))}</div><div class="table-meta">${esc(h.currentSituation||'No situation summary').slice(0,100)}</div></td><td>${fmtLong(h.shiftEnd)}<div class="table-meta">Next shift: ${h.nextShiftDate?fmtDate(h.nextShiftDate):'—'} ${esc(h.nextShiftStart||'')}</div></td><td>${badge(h.priority)}</td><td>${h.acknowledgedBy?.includes(user.id)?'<span class="status green">Read by you</span>':'<span class="status amber">Not acknowledged</span>'}<div class="table-meta">${(h.acknowledgedBy||[]).length} acknowledgements</div></td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="view-handoff" data-id="${esc(h.id)}">Open</button><button class="btn btn-quiet btn-small" data-action="ack-handoff" data-id="${esc(h.id)}">${h.acknowledgedBy?.includes(user.id)?'Undo read':'Mark read'}</button>${isAdmin()?`<button class="btn btn-quiet btn-small" data-action="delete-handoff" data-id="${esc(h.id)}">Delete</button>`:''}</div></td></tr>`).join(''):tableEmptyRow(5,'No handoffs have been recorded for this event.')}</tbody></table></div></div>`;
  }

  function renderIncidents() {
    const event=ACTIVE_EVENT(); const ws=event?workFor(event.id):{incidents:[]}; const all=[...ws.incidents].sort((a,b)=>({Urgent:0,High:1,Normal:2,Low:3}[a.priority]??2)-({Urgent:0,High:1,Normal:2,Low:3}[b.priority]??2)||String(b.createdAt).localeCompare(String(a.createdAt)));
    const list=all.filter(i=>(!currentFilter||`${i.title} ${i.description||''} ${i.location||''} ${i.reporter||''} ${i.followUpOwner||''}`.toLowerCase().includes(currentFilter.toLowerCase()))&&(currentStatusFilter==='All'||(currentStatusFilter==='Open'?i.status!=='Resolved':currentStatusFilter===i.status))&&(currentPriorityFilter==='All'||i.priority===currentPriorityFilter));
    const open=all.filter(i=>i.status!=='Resolved');
    return `${pageIntro('Incident Register','Event-specific log for technical faults, hazards, damage, communication issues, and other operational problems. Urgent hazards still need direct escalation.',`${btn('＋ Log incident','new-incident','primary')}`)}<div class="metrics">${metric('Total incidents',all.length,'⚠','This event only')}${metric('Open',open.length,'◷','Needs follow-up')}${metric('High / urgent',open.filter(i=>['High','Urgent'].includes(i.priority)).length,'▲','Open priority incidents')}${metric('Resolved',all.filter(i=>i.status==='Resolved').length,'✓','Resolution recorded')}</div><div class="panel"><div class="toolbar"><div class="search-box"><span class="search-icon">⌕</span><input id="incident-search" value="${esc(currentFilter)}" placeholder="Search incidents, details, location, reporter…" /></div><select id="incident-status-filter">${options(['All','Open','Resolved'],currentStatusFilter,null)}</select><select id="incident-priority-filter">${options(['All','Low','Normal','High','Urgent'],currentPriorityFilter,null)}</select><span class="small muted">${list.length} entries</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Incident</th><th>Location / equipment</th><th>Priority</th><th>Reported by</th><th>Status</th><th></th></tr></thead><tbody>${list.length?list.map(i=>`<tr><td><div class="table-primary">${esc(i.title)}</div><div class="table-meta">${esc(i.category)} · ${fmtDate(i.createdAt)}</div></td><td>${esc(i.location||getAsset(i.assetId)?.name||'Not specified')}</td><td>${badge(i.priority)}</td><td>${esc(i.reporter||'—')}</td><td>${badge(i.status)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-action="view-incident" data-id="${esc(i.id)}">Details</button>${i.status==='Resolved'?`<button class="btn btn-quiet btn-small" data-action="resolve-incident" data-id="${esc(i.id)}" data-resolve="false">Reopen</button>`:`<button class="btn btn-quiet btn-small" data-action="resolve-incident" data-id="${esc(i.id)}" data-resolve="true">Resolve</button>`}${isAdmin()?`<button class="btn btn-quiet btn-small" data-action="delete-incident" data-id="${esc(i.id)}">Delete</button>`:''}</div></td></tr>`).join(''):tableEmptyRow(6,'No incidents match your filters.')}</tbody></table></div></div><div class="helper" style="margin-top:12px">Incidents belong to this event’s history. Venue-wide equipment and facility repairs belong in Maintenance & Service Desk.</div>`;
  }

  function renderSettings() {
    const tabs=[['venue','Venue identity'],['accounts','User accounts'],['checklist','Checklist template'],['options','Workflow options'],['data','Backup & shared data']];
    let body='';
    if(settingsTab==='venue') body=`<div class="subpanel"><h3>Venue identity</h3><p>The venue name appears across the app and in operational records.</p><form data-form="venue" class="stack"><div class="field"><label>Venue / facility name</label><input name="name" value="${esc(state.venue.name)}" required maxlength="120"/></div><div class="field"><label>Venue time zone</label><select name="timezone">${options(['America/Denver','America/Los_Angeles','America/Chicago','America/New_York','UTC'],state.venue.timezone,null)}</select><div class="helper">Used to label operational schedules. Server timestamps remain in UTC.</div></div><div>${btn('Save venue settings','submit-venue','primary','class="btn btn-primary" type="submit"')}</div></form></div><div class="subpanel"><h3>Shared record status</h3><p>All users read and write the same host-backed venue record. Each save is revision-checked to prevent stale overwrites.</p><div class="detail-box"><div class="detail-label">Current revision</div><div class="detail-value">${revision}</div><div class="detail-label" style="margin-top:12px">Last shared change</div><div class="detail-value">${lastSavedAt?fmtLong(lastSavedAt):'No saved timestamp'}</div></div></div>`;
    if(settingsTab==='accounts') body=`<div class="subpanel"><h3>Individual accounts</h3><p>Technicians and administrators use separate accounts. Passwords are stored as salted scrypt hashes.</p><div style="margin-bottom:13px">${btn('＋ Create account','new-user','primary')}</div><div>${state.users.map(u=>`<div class="account-row"><span class="avatar">${esc(initials(u.displayName))}</span><div class="account-info"><strong>${esc(u.displayName)} ${u.id===user.id?'<span class="tag">You</span>':''}</strong><span>@${esc(u.username)} · ${esc(u.role)} · Created ${fmtDate(u.createdAt)}</span></div>${badge(u.enabled?'Enabled':'Disabled')}<button class="btn btn-secondary btn-small" data-action="reset-user-password" data-id="${esc(u.id)}">Reset password</button>${u.id!==user.id?`<button class="btn btn-quiet btn-small" data-action="toggle-user" data-id="${esc(u.id)}" data-enabled="${u.enabled?'false':'true'}">${u.enabled?'Disable':'Enable'}</button>`:''}</div>`).join('')}</div></div><div class="warning-note">Disabling an account revokes its active sessions. Existing crew assignments remain in historical records.</div>`;
    if(settingsTab==='checklist') body=`<div class="subpanel"><h3>Shift checklist template</h3><p>Configure sections, descriptions, task labels, and instructions. Each section uses a unique ID and contains a tasks array.</p><form data-form="checklist-template" class="stack"><div class="field"><label>Template JSON</label><textarea name="template" rows="19" spellcheck="false">${esc(JSON.stringify(state.checklistTemplate,null,2))}</textarea><div class="helper">Keep each section's <code>id</code> and each task's <code>id</code> stable if you want existing shift progress to follow renamed tasks.</div></div><div>${btn('Save checklist template','save-template','primary','class="btn btn-primary" type="submit"')}</div></form></div><div class="subpanel"><h3>Progress management</h3><p>Resetting progress clears completed task markers for all shift assignments.</p>${btn('Reset all shift checklist progress','reset-checklists','danger')}</div>`;
    if(settingsTab==='options') body=`<div class="subpanel"><h3>Configurable workflow dropdowns</h3><p>Enter one option per line. These options are used across event and incident workflows.</p><form data-form="workflow-options" class="stack">${[['eventPhases','Event phases'],['incidentCategories','Incident categories'],['incidentPriorities','Incident priorities'],['handoffPriorities','Handoff priorities']].map(([key,label])=>`<div class="field"><label>${label}</label><textarea name="${key}" rows="3">${esc((state.settings[key]||[]).join('\n'))}</textarea></div>`).join('')}<div>${btn('Save workflow options','save-options','primary','class="btn btn-primary" type="submit"')}</div></form></div>`;
    if(settingsTab==='data') body=`<div class="subpanel"><h3>Back up this venue</h3><p>Exports contain venue data, events, and operational histories. They do not include password hashes or session credentials.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Export JSON backup','export-backup','primary')}${btn('Print current view','print','secondary')}${isAdmin()?btn('Import JSON backup','choose-import','secondary'):''}<input type="file" id="import-file" accept="application/json,.json" class="hidden"/></div></div><div class="subpanel"><h3>API and persistence</h3><p>The desk is configured to use the shared theatre API. Host availability and save status are shown in the sidebar.</p><div class="detail-box"><div class="detail-label">API endpoint</div><div class="detail-value" style="word-break:break-all">${esc(API)}</div><div class="detail-label" style="margin-top:12px">Application version</div><div class="detail-value">Backstage 1.0.0</div></div></div><div class="warning-note">Importing a backup replaces the shared venue record. Use a current export before importing. Revision conflicts are rejected rather than silently overwritten.</div>`;
    return `${pageIntro('Settings & Administration','Configure the venue, manage access, maintain operational templates, and protect the shared data record.', '')}<div class="settings-grid"><div class="panel" style="padding:9px;height:max-content"><div class="settings-nav">${tabs.map(([id,label])=>`<button class="${settingsTab===id?'active':''}" data-action="settings-tab" data-tab="${id}">${esc(label)}</button>`).join('')}</div></div><div class="panel"><div class="panel-header"><div><h2 class="panel-title">${esc(tabs.find(t=>t[0]===settingsTab)?.[1]||'Settings')}</h2><div class="panel-subtitle">${settingsTab==='accounts'?'Accounts and role access':settingsTab==='data'?'Backup, print, and persistence':'Venue-level configuration'}</div></div></div><div class="panel-body settings-content">${body}</div></div></div>`;
  }

  const fInput=(label,name,value='',type='text',extra='')=>`<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${extra}/></div>`;
  const fSelect=(label,name,items,selected,blank='Select…',extra='')=>`<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><select id="f-${esc(name)}" name="${esc(name)}" ${extra}>${options(items,selected,blank)}</select></div>`;
  const fText=(label,name,value='',rows=3,extra='')=>`<div class="field full"><label for="f-${esc(name)}">${esc(label)}</label><textarea id="f-${esc(name)}" name="${esc(name)}" rows="${rows}" ${extra}>${esc(value)}</textarea></div>`;
  const fieldOptions = (a, selected) => options(a,selected,null);
  const usersOptions = () => state.users.filter(u=>u.enabled).map(u=>({value:u.id,label:`${u.displayName} (@${u.username})`}));
  const roomOptions = (selected='') => state.rooms.map(r=>({value:r.id,label:`${r.name} · ${r.code} (${r.status})`}));
  const assetOptions = () => state.assets.map(a=>({value:a.id,label:`${a.tag} · ${a.name}`}));
  function openModal(kind, record=null, optionsExtra={}) {
    const isEdit=!!(record && record.id); const r=record||{}; const event=ACTIVE_EVENT(); let title='',desc='',html='',submitLabel='Save changes';
    if(kind==='event') {
      title=isEdit?'Edit event booking':'Create event booking'; desc='Set the event details and technical schedule. A workspace is created for each booking.'; submitLabel=isEdit?'Save booking':'Create workspace';
      html=`<form data-form="event" data-id="${esc(r.id||'')}" class="stack"><div class="fields-2">${fInput('Event / booking name','name',r.name||'','text','required maxlength="160"')}${fSelect('Event type','type',['Production','Rehearsal','Performance','Concert','Rental','Meeting','Workshop','Other'],r.type||'Production',null)}${fInput('Event date','date',r.date||today(),'date','required')}${fSelect('Booking status','status',['Confirmed','Tentative','In progress','Complete','Cancelled'],r.status||'Confirmed',null)}${fSelect('Event phase','phase',state.settings.eventPhases||[],r.phase||'Planning')}${fInput('Technical lead','technicalLead',r.technicalLead||'','text','maxlength="120"')}${fInput('Access time','accessTime',r.accessTime||'','time')}${fInput('Call time','callTime',r.callTime||'','time')}${fInput('End time','endTime',r.endTime||'','time')}${fInput('Strike time','strikeTime',r.strikeTime||'','time')}${fInput('Contact / radio channel','contact',r.contact||'','text','maxlength="160"')}${fInput('Radio channel','radioChannel',r.radioChannel||'','text','maxlength="60"')}</div><div class="field"><label>Rooms in use</label><div class="checkbox-grid">${state.rooms.map(room=>`<label class="check-option"><input type="checkbox" name="roomIds" value="${esc(room.id)}" ${(r.roomIds||[]).includes(room.id)?'checked':''} ${['Closed','Under maintenance'].includes(room.status)&&!(r.roomIds||[]).includes(room.id)?'disabled':''}><span><strong>${esc(room.name)}</strong><br><span class="muted">${esc(room.code)} · ${esc(room.status)}</span></span></label>`).join('')}</div><div class="helper">Closed and under-maintenance rooms cannot be selected. Room overlaps are checked before saving.</div></div>${fText('Technical requirements','requirements',r.requirements||'',3)}${fText('Schedule / operational notes','notes',r.notes||'',3)}</form>`;
    } else if(kind==='room') {
      title=isEdit?'Edit room / facility':'Register room / facility'; desc='Maintain a shared directory of physical spaces and access conditions.';
      html=`<form data-form="room" data-id="${esc(r.id||'')}" class="stack"><div class="fields-2">${fInput('Room name','name',r.name||'','text','required maxlength="120"')}${fInput('Short code','code',r.code||'','text','required maxlength="20"')}${fSelect('Space type','type',['Performance','Rehearsal','Lobby / public','Backstage','Storage','Office','Other'],r.type||'Performance',null)}${fInput('Capacity','capacity',r.capacity??'','number','min="0" max="100000"')}${fSelect('Room status','status',['Available','Limited access','Under maintenance','Closed'],r.status||'Available',null)}</div>${fText('Access notes','accessNotes',r.accessNotes||'',3)}</form>`;
    } else if(kind==='asset') {
      title=isEdit?'Edit equipment record':'Register equipment'; desc='Assign a unique asset tag and record its department, location, model, and current status.';
      html=`<form data-form="asset" data-id="${esc(r.id||'')}" class="stack"><div class="fields-2">${fInput('Asset ID / tag','tag',r.tag||'','text','required maxlength="50"')}${fInput('Equipment name','name',r.name||'','text','required maxlength="160"')}${fSelect('Department','department',['Audio','Lighting','Video/Projection','Rigging','Comms','Power/Cable','Tools','Furniture/Staging','IT','Other'],r.department||'Audio',null)}${fSelect('Assigned room','roomId',roomOptions(),r.roomId||'','Unassigned')}${fInput('Model','model',r.model||'','text','maxlength="120"')}${fInput('Serial number','serial',r.serial||'','text','maxlength="120"')}${fSelect('Equipment status','status',['Available','Assigned','Needs service','Out of service','Missing'],r.status||'Available',null)}</div>${fText('Notes','notes',r.notes||'',3)}</form>`;
    } else if(kind==='maintenance') {
      title=isEdit?'Update service request':'New maintenance request'; desc='Venue-wide repair queue for equipment, facilities, safety, inspections, and stock.';
      html=`<form data-form="maintenance" data-id="${esc(r.id||'')}" class="stack"><div class="fields-2">${fInput('Request title','title',r.title||'','text','required maxlength="160"')}${fSelect('Request type','type',['Equipment repair','Facility / room','Electrical','Safety concern','Inspection','Replacement / stock','Other'],r.type||'Equipment repair',null)}${fSelect('Priority','priority',['Low','Normal','High','Urgent'],r.priority||'Normal',null)}${fSelect('Related room','roomId',roomOptions(),r.roomId||'','No room selected')}${fSelect('Related equipment','assetId',assetOptions(),r.assetId||'','No asset selected')}${fInput('Reported by','reporter',r.reporter||user.displayName,'text','required maxlength="120"')}</div>${fText('Problem description','description',r.description||'',4,'required maxlength="5000"')}${isAdmin()?`<div class="fields-2">${fInput('Follow-up owner','assignedTo',r.assignedTo||'','text','maxlength="120"')}${fSelect('Request status','status',['Open','In progress','Blocked','Complete'],r.status||'Open',null)}</div>`:''}</form>`;
    } else if(kind==='shift') {
      title='Schedule a technician'; desc=`Assign a crew member to a date and coverage window${event?` for ${event.name}`:''}.`;
      html=`<form data-form="shift" class="stack"><div class="fields-2">${fSelect('Technician','userId',usersOptions(),r.userId||'','Select technician…','required')}${fInput('Shift date','date',r.date||today(),'date','required')}${fInput('Start time','startTime',r.startTime||'16:00','time','required')}${fInput('End time','endTime',r.endTime||'22:00','time','required')}</div>${fText('Post / assignment notes','notes',r.notes||'',3,'maxlength="1000"')}</form>`;
    } else if(kind==='handoff') {
      title=isEdit?'Handoff details':'Create shift handoff'; desc='Record what changed, what is unfinished, who has been notified, and what the incoming technician needs next.';
      const d=r.data||r; const nextIncoming = event ? workFor(event.id).shifts.filter(sh=>sh.userId!==user.id && `${sh.date}T${sh.startTime}`>=`${today()}T${new Date().toTimeString().slice(0,5)}`).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime))[0]?.userId : '';
      html=`<form data-form="handoff" data-id="${esc(r.id||'')}" class="stack"><div class="fields-2">${fSelect('Outgoing technician','outgoingUserId',isAdmin()?usersOptions():[{value:user.id,label:user.displayName}],d.outgoingUserId||user.id,null,'required')}${fSelect('Incoming technician','incomingUserId',usersOptions(),d.incomingUserId||nextIncoming||'','Choose incoming technician…','required')}${fSelect('Handoff priority','priority',state.settings.handoffPriorities||['Routine','Important','Urgent'],d.priority||'Routine',null)}${fInput('Shift ended at','shiftEnd',d.shiftEnd||timeNow().slice(0,16),'datetime-local')}${fInput('Next shift date','nextShiftDate',d.nextShiftDate||'','date')}${fInput('Next shift start','nextShiftStart',d.nextShiftStart||'','time')}</div>${fText('Current situation','currentSituation',d.currentSituation||'',3)}<div class="fields-2">${fInput('Event status','eventStatus',d.eventStatus||event?.status||'','text','maxlength="120"')}${fInput('Room / booth condition','roomCondition',d.roomCondition||'','text','maxlength="240"')}</div><div class="form-section-title">Work status</div>${fText('Completed work','completedWork',d.completedWork||'',3)}${fText('Outstanding tasks','outstandingTasks',d.outstandingTasks||'',3)}<div class="fields-2">${fText('Blockers','blockers',d.blockers||'',3)}${fText('Next actions','nextActions',d.nextActions||'',3)}</div><div class="form-section-title">Technical context</div><div class="fields-2">${fText('Equipment condition','equipmentCondition',d.equipmentCondition||'',3)}${fText('Communication / radio','communication',d.communication||'',3)}</div><div class="fields-2">${fText('People notified','peopleNotified',d.peopleNotified||'',2)}${fText('Additional notes','notes',d.notes||'',2)}</div></form>`;
    } else if(kind==='incident') {
      title='Log an incident'; desc='Log an event-related technical fault, hazard, damage, or operational issue with the action already taken.';
      html=`<form data-form="incident" class="stack"><div class="fields-2">${fInput('Incident title','title',r.title||'','text','required maxlength="160"')}${fSelect('Category','category',state.settings.incidentCategories||['Equipment fault','Safety hazard','Damage','Communication','Schedule','Other'],r.category||'Equipment fault',null)}${fSelect('Priority','priority',state.settings.incidentPriorities||['Low','Normal','High','Urgent'],r.priority||'Normal',null)}${fInput('Location / area','location',r.location||'','text','maxlength="180"')}${fSelect('Related equipment','assetId',assetOptions(),r.assetId||'','No asset selected')}${fInput('Reported / witnessed by','reporter',r.reporter||user.displayName,'text','required maxlength="120"')}${fInput('Follow-up owner','followUpOwner',r.followUpOwner||'','text','maxlength="120"')}${fInput('Who was notified','notified',r.notified||'','text','maxlength="180"')}</div>${fText('What happened?','description',r.description||'',4,'required maxlength="5000"')}${fText('Action already taken','actionTaken',r.actionTaken||'',3,'maxlength="3000"')}</form>`;
    } else if(kind==='user') {
      title='Create user account'; desc='Create an individual sign-in with the correct role. Use a unique password of at least 12 characters.';
      html=`<form data-form="user" class="stack"><div class="fields-2">${fInput('Username','username','','text','required minlength="3" maxlength="80" pattern="[A-Za-z0-9._-]{3,80}"')}${fInput('Display name','displayName','','text','required maxlength="120"')}${fSelect('Role','role',['Technician','Administrator'],'Technician',null,'required')}${fInput('Initial password','password','','password','required minlength="12" autocomplete="new-password"')}</div><div class="helper">The account is active immediately. Password values are never included in venue backups.</div></form>`;
    } else if(kind==='view-asset') {
      title=r.name||'Equipment asset'; desc=`${r.tag} · ${r.department}`;
      html=`<div class="stack"><div class="fields-2"><div class="detail-box"><div class="detail-label">Asset tag</div><div class="detail-value">${esc(r.tag)}</div></div><div class="detail-box"><div class="detail-label">Current status</div><div class="detail-value">${badge(r.status)}</div></div><div class="detail-box"><div class="detail-label">Department</div><div class="detail-value">${esc(r.department)}</div></div><div class="detail-box"><div class="detail-label">Assigned room</div><div class="detail-value">${esc(getRoom(r.roomId)?.name||'Unassigned')}</div></div><div class="detail-box"><div class="detail-label">Model</div><div class="detail-value">${esc(r.model||'—')}</div></div><div class="detail-box"><div class="detail-label">Serial number</div><div class="detail-value">${esc(r.serial||'—')}</div></div></div><div class="detail-box"><div class="detail-label">Notes</div><div class="detail-value">${esc(r.notes||'No notes recorded')}</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Report issue','report-asset','secondary','data-id="'+esc(r.id)+'" data-action="report-asset"')}${isAdmin()?btn('Edit asset','edit-asset','secondary','data-id="'+esc(r.id)+'" data-action="edit-asset"'):''}</div></div>`;
      return showModal(title,desc,html,'',false);
    } else if(kind==='view-maintenance') {
      title=r.title||'Maintenance request'; desc=`Request reported ${fmtLong(r.createdAt)}.`;
      html=`<div class="stack"><div class="fields-2"><div class="detail-box"><div class="detail-label">Status</div><div class="detail-value">${badge(r.status)}</div></div><div class="detail-box"><div class="detail-label">Priority</div><div class="detail-value">${badge(r.priority)}</div></div><div class="detail-box"><div class="detail-label">Related location / asset</div><div class="detail-value">${esc(getRoom(r.roomId)?.name||getAsset(r.assetId)?.name||'Venue-wide')}</div></div><div class="detail-box"><div class="detail-label">Follow-up owner</div><div class="detail-value">${esc(r.assignedTo||'Unassigned')}</div></div></div><div class="detail-box"><div class="detail-label">Description</div><div class="detail-value">${esc(r.description||'No description provided')}</div></div><div class="detail-box"><div class="detail-label">Reported by</div><div class="detail-value">${esc(r.reporter||'Unknown')}</div></div>${isAdmin()?btn('Edit request','edit-maintenance:'+r.id,'secondary','data-id="'+esc(r.id)+'" data-action="edit-maintenance"'):''}</div>`;
      return showModal(title,desc,html,'',false);
    } else if(kind==='view-incident') {
      title=r.title||'Incident';desc=`${r.category||'Incident'} · Reported ${fmtLong(r.createdAt)}`;
      html=`<div class="stack"><div class="fields-2"><div class="detail-box"><div class="detail-label">Priority</div><div class="detail-value">${badge(r.priority)}</div></div><div class="detail-box"><div class="detail-label">Status</div><div class="detail-value">${badge(r.status)}</div></div><div class="detail-box"><div class="detail-label">Location / equipment</div><div class="detail-value">${esc(r.location||getAsset(r.assetId)?.name||'Not specified')}</div></div><div class="detail-box"><div class="detail-label">Reporter</div><div class="detail-value">${esc(r.reporter||'Unknown')}</div></div></div><div class="detail-box"><div class="detail-label">What happened</div><div class="detail-value">${esc(r.description||'')}</div></div><div class="detail-box"><div class="detail-label">Action taken</div><div class="detail-value">${esc(r.actionTaken||'No action recorded')}</div></div><div class="fields-2"><div class="detail-box"><div class="detail-label">Follow-up owner</div><div class="detail-value">${esc(r.followUpOwner||'Not assigned')}</div></div><div class="detail-box"><div class="detail-label">Notified</div><div class="detail-value">${esc(r.notified||'Not recorded')}</div></div></div>${r.resolvedAt?`<div class="success-note">Resolved by ${esc(r.resolvedBy||'Unknown')} · ${fmtLong(r.resolvedAt)}</div>`:''}</div>`;
      return showModal(title,desc,html,'',false);
    } else if(kind==='view-handoff') {
      title='Shift handoff';desc=`${accountName(r.outgoingUserId)} → ${accountName(r.incomingUserId)} · ${fmtLong(r.createdAt)}`;
      const fields=[['Current situation','currentSituation'],['Completed work','completedWork'],['Outstanding tasks','outstandingTasks'],['Blockers','blockers'],['Next actions','nextActions'],['Equipment condition','equipmentCondition'],['Communication / radio','communication'],['People notified','peopleNotified'],['Additional notes','notes']];
      html=`<div class="stack"><div class="fields-2"><div class="detail-box"><div class="detail-label">Priority</div><div class="detail-value">${badge(r.priority)}</div></div><div class="detail-box"><div class="detail-label">Next shift</div><div class="detail-value">${r.nextShiftDate?fmtDate(r.nextShiftDate):'—'} ${esc(r.nextShiftStart||'')}</div></div></div>${fields.map(([label,key])=>`<div class="detail-box"><div class="detail-label">${label}</div><div class="detail-value">${esc(r[key]||'Not recorded')}</div></div>`).join('')}<div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Use as starting point','handoff-from:'+r.id,'secondary','data-id="'+esc(r.id)+'" data-action="handoff-from"')}${btn(r.acknowledgedBy?.includes(user.id)?'Undo acknowledgement':'Mark as read','ack-handoff:'+r.id,'secondary','data-id="'+esc(r.id)+'" data-action="ack-handoff"')}</div></div>`;
      return showModal(title,desc,html,'',false);
    } else if(kind==='view-room') {
      title=r.name; desc=`${r.code} · ${r.type}`;
      const bookings=state.events.filter(e=>(e.roomIds||[]).includes(r.id)&&e.date>=today()&&!['Cancelled','Complete'].includes(e.status));
      const assets=state.assets.filter(a=>a.roomId===r.id);
      html=`<div class="stack"><div class="fields-2"><div class="detail-box"><div class="detail-label">Status</div><div class="detail-value">${badge(r.status)}</div></div><div class="detail-box"><div class="detail-label">Capacity</div><div class="detail-value">${esc(r.capacity||'—')}</div></div></div><div class="detail-box"><div class="detail-label">Access notes</div><div class="detail-value">${esc(r.accessNotes||'No access notes')}</div></div><div class="detail-box"><div class="detail-label">Upcoming / active bookings</div><div class="detail-value">${esc(bookings.map(e=>`${e.name} · ${fmtDate(e.date)}`).join('\n')||'No upcoming bookings')}</div></div><div class="detail-box"><div class="detail-label">Tracked equipment</div><div class="detail-value">${esc(assets.map(a=>`${a.tag} · ${a.name}`).join('\n')||'No assets assigned')}</div></div></div>`;
      return showModal(title,desc,html,'',false);
    }
    showModal(title,desc,html,submitLabel,true);
  }
  function showModal(title, desc, html, submitLabel='Save changes', hasForm=true) {
    $('#modal-root').innerHTML=`<div class="modal-overlay" id="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-header"><div><h2>${esc(title)}</h2>${desc?`<p>${esc(desc)}</p>`:''}</div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-body">${html}</div>${hasForm?`<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="button" class="btn btn-primary" id="modal-submit" data-action="submit-modal">${esc(submitLabel)}</button></div>`:`<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Close</button></div>`}</section></div>`;
    const form=$('form[data-form]',$('#modal-root')); const submit=$('#modal-submit');
    if(form&&submit) submit.addEventListener('click',()=>form.requestSubmit());
    $('#modal-overlay')?.addEventListener('click',e=>{if(e.target.id==='modal-overlay')closeModal();});
    
    const first=$('input,select,textarea,button',$('#modal-root')); first?.focus();
  }
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $('#modal-root .modal-overlay')) closeModal(); });
  function closeModal(){ $('#modal-root').innerHTML=''; }
  function collectForm(form) {
    const fd=new FormData(form), out={};
    for(const [key,value] of fd.entries()) {
      if (key==='roomIds') { (out.roomIds ||= []).push(value); continue; }
      out[key]=value;
    }
    return out;
  }
  function checkEventConflicts(eventRecord, omitId=null) {
    const blocked=[];
    if(['Cancelled','Complete'].includes(eventRecord.status)) return blocked;
    for(const roomId of eventRecord.roomIds||[]) {
      const room=getRoom(roomId);
      if(!room) blocked.push('Selected room does not exist.');
      else if(['Closed','Under maintenance'].includes(room.status)) blocked.push(`${room.name} is ${room.status.toLowerCase()} and cannot be booked.`);
    }
    const start=dateTime(eventRecord.date,eventRecord.accessTime||eventRecord.callTime||'00:00');
    let end=dateTime(eventRecord.date,eventRecord.strikeTime||eventRecord.endTime||'23:59');
    if(end<=start) end += 24*60*60*1000;
    for(const other of state.events) {
      if(other.id===omitId||['Cancelled','Complete'].includes(other.status)) continue;
      const shared=(eventRecord.roomIds||[]).filter(id=>(other.roomIds||[]).includes(id)); if(!shared.length) continue;
      let otherStart=dateTime(other.date,other.accessTime||other.callTime||'00:00'); let otherEnd=dateTime(other.date,other.strikeTime||other.endTime||'23:59'); if(otherEnd<=otherStart)otherEnd+=24*60*60*1000;
      if(start<otherEnd&&otherStart<end) blocked.push(`${getRoom(shared[0])?.name||'A selected room'} overlaps with “${other.name}” on ${fmtDate(other.date)}.`);
    }
    return blocked;
  }
  function shiftConflicts(shift, omitId=null) {
    const start=dateTime(shift.date,shift.startTime); let end=dateTime(shift.date,shift.endTime);if(end<=start)end+=86400000;
    return state.events.some(evt=>workFor(evt.id).shifts.some(s=>s.id!==omitId&&s.userId===shift.userId&&(()=>{let a=dateTime(s.date,s.startTime),b=dateTime(s.date,s.endTime);if(b<=a)b+=86400000;return start<b&&a<end;})()));
  }

  async function handleFormSubmit(e) {
    const form=e.target.closest('form[data-form]'); if(!form)return; e.preventDefault(); const kind=form.dataset.form; const data=collectForm(form); const id=form.dataset.id||'';
    if(!form.reportValidity())return;
    if(kind==='event') {
      const record={...(state.events.find(x=>x.id===id)||{}),...data,id:id||uid('evt'),roomIds:data.roomIds||[],createdAt:state.events.find(x=>x.id===id)?.createdAt||timeNow(),updatedAt:timeNow()};
      if(!record.date){toast('Select an event date.','error');return;}
      const conflicts=checkEventConflicts(record,id); if(conflicts.length){toast(conflicts[0],'error');return;}
      const ok=await saveState(s=>{const idx=s.events.findIndex(x=>x.id===id);if(idx>=0)s.events[idx]=record;else{s.events.push(record);s.activeEventId=record.id;}s.workspaces[record.id]||={shifts:[],incidents:[],handoffs:[]};},id?'Booking updated.':'Event workspace created.'); if(ok){closeModal();currentPage=id?'events':'overview';currentFilter='';render();} return;
    }
    if(kind==='room') {
      const record={...(state.rooms.find(x=>x.id===id)||{}),...data,id:id||uid('room'),capacity:data.capacity===''?null:Number(data.capacity)};
      if(state.rooms.some(x=>x.id!==id&&x.code.toLowerCase()===record.code.toLowerCase())){toast('That room code is already in use.','error');return;}
      if(['Closed','Under maintenance'].includes(record.status)&&state.events.some(e=>e.status!=='Cancelled'&&(e.roomIds||[]).includes(record.id)&&e.date>=today())){toast('This room has upcoming bookings. Move or cancel them before closing it.','error');return;}
      const ok=await saveState(s=>{const idx=s.rooms.findIndex(x=>x.id===id);if(idx>=0)s.rooms[idx]=record;else s.rooms.push(record);},id?'Room updated.':'Room registered.');if(ok){closeModal();render();}return;
    }
    if(kind==='asset') {
      const record={...(state.assets.find(x=>x.id===id)||{}),...data,id:id||uid('asset')};
      if(state.assets.some(x=>x.id!==id&&x.tag.toLowerCase()===record.tag.toLowerCase())){toast('Asset tag must be unique.','error');return;}
      const ok=await saveState(s=>{const idx=s.assets.findIndex(x=>x.id===id);if(idx>=0)s.assets[idx]=record;else s.assets.push(record);},id?'Equipment record updated.':'Equipment registered.');if(ok){closeModal();render();}return;
    }
    if(kind==='maintenance') {
      const prev=state.maintenance.find(x=>x.id===id); const record={...(prev||{}),...data,id:id||uid('mnt'),status:data.status||prev?.status||'Open',assignedTo:data.assignedTo??prev?.assignedTo??'',createdAt:prev?.createdAt||timeNow(),updatedAt:timeNow()};
      const ok=await saveState(s=>{const idx=s.maintenance.findIndex(x=>x.id===id);if(idx>=0)s.maintenance[idx]=record;else s.maintenance.push(record);},id?'Maintenance request updated.':'Service request submitted.');if(ok){closeModal();render();}return;
    }
    if(kind==='shift') {
      const event=ACTIVE_EVENT(); if(!event){toast('Create or select an event first.','error');return;}
      const record={...data,id:uid('shift'),completedTasks:{},createdAt:timeNow()};
      if(record.endTime===record.startTime){toast('Start and end times must be different.','error');return;}
      if(shiftConflicts(record)){toast('That technician already has an overlapping shift in this event.','error');return;}
      const ok=await saveState(s=>{workFor(event.id).shifts.push(record);},'Shift scheduled.');if(ok){closeModal();render();}return;
    }
    if(kind==='handoff') {
      const event=ACTIVE_EVENT(); if(!event){toast('Create or select an event first.','error');return;}
      const record={...data,id:uid('hand'),createdAt:timeNow(),outgoingUserId:data.outgoingUserId||user.id,acknowledgedBy:[]};
      const ok=await saveState(s=>{workFor(event.id).handoffs.push(record);},'Shift handoff saved.');if(ok){closeModal();render();}return;
    }
    if(kind==='incident') {
      const event=ACTIVE_EVENT(); if(!event){toast('Create or select an event first.','error');return;}
      const record={...data,id:uid('inc'),createdAt:timeNow(),status:'Open',reportedById:user.id};
      const ok=await saveState(s=>{workFor(event.id).incidents.push(record);},'Incident recorded.');if(ok){closeModal();render();}return;
    }
    if(kind==='user') {
      try { await api('/admin/users','POST',data); await loadState(); closeModal(); render(); toast('Account created.'); }
      catch(err){toast(err.message,'error');} return;
    }
    if(kind==='venue') {
      const ok=await saveState(s=>{s.venue.name=data.name.trim();s.venue.timezone=data.timezone;},'Venue settings saved.');if(ok){render();}return;
    }
    if(kind==='checklist-template') {
      try { const template=JSON.parse(data.template); if(!Array.isArray(template)) throw new Error('Template must be a JSON array.');
        const seen=new Set(); const taskSeen=new Set(); for(const sec of template){if(!sec.id||!sec.name||!Array.isArray(sec.tasks))throw new Error('Every section needs id, name, and tasks.');if(seen.has(sec.id))throw new Error('Section IDs must be unique.');seen.add(sec.id);for(const t of sec.tasks){if(!t.id||!t.label)throw new Error('Every task needs an id and label.');if(taskSeen.has(t.id))throw new Error('Task IDs must be unique within a section.');taskSeen.add(t.id);}}
        const ok=await saveState(s=>{s.checklistTemplate=template;},'Checklist template saved.'); if(ok)render();
      }catch(err){toast(`Invalid template: ${err.message}`,'error');} return;
    }
    if(kind==='workflow-options') {
      const keys=['eventPhases','incidentCategories','incidentPriorities','handoffPriorities'];const parsed={};
      for(const key of keys){parsed[key]=String(data[key]||'').split('\n').map(v=>v.trim()).filter(Boolean);if(!parsed[key].length){toast(`${key} needs at least one option.`,'error');return;}}
      const ok=await saveState(s=>{s.settings={...s.settings,...parsed};},'Workflow options saved.');if(ok)render();return;
    }
  }

  document.addEventListener('submit',handleFormSubmit);
  document.addEventListener('click',async e=>{
    const pageButton=e.target.closest('[data-page]');
    if(pageButton){currentPage=pageButton.dataset.page;currentFilter='';currentStatusFilter='All';currentPriorityFilter='All';$('#sidebar')?.classList.remove('open');render();return;}
    const b=e.target.closest('[data-action]'); if(!b)return;
    const action=b.dataset.action, id=b.dataset.id;
    if(action==='close-modal'){closeModal();return;}
    if(action==='submit-modal'){const form=$('#modal-root form[data-form]');if(form)form.requestSubmit();return;}
    if(action==='toggle-menu'){ $('#sidebar')?.classList.toggle('open');return; }
    if(action==='logout'){
      try{await api('/auth/logout','POST',{});}catch{}
      user=null;state=null;renderLogin();return;
    }
    if(action==='refresh'){await refreshAll(true);return;}
    if(action==='print'){window.print();return;}
    if(action==='goto-events'){currentPage='events';render();return;}
    if(action==='go-maintenance'){currentPage='maintenance';currentFilter='';currentStatusFilter='All';render();return;}
    if(action==='goto-crew'){currentPage='crew';render();return;}
    if(action==='goto-checklist'){currentEventDetail=null;currentPage='checklist';render();return;}
    if(action==='goto-handoffs'){currentPage='handoffs';render();return;}
    if(action==='goto-incidents'){currentPage='incidents';render();return;}
    if(action==='new-event'){if(isAdmin())openModal('event');return;}
    if(action==='new-room'){if(isAdmin())openModal('room');return;}
    if(action==='new-asset'){if(isAdmin())openModal('asset');return;}
    if(action==='new-maintenance'){openModal('maintenance');return;}
    if(action==='new-shift'){if(isAdmin())openModal('shift');return;}
    if(action==='new-handoff'){openModal('handoff');return;}
    if(action==='new-incident'){openModal('incident');return;}
    if(action==='new-user'){if(isAdmin())openModal('user');return;}
    if(action==='edit-template'){if(isAdmin()){settingsTab='checklist';currentPage='settings';render();}return;}
    if(action==='save-template'||action==='save-options'||action==='submit-venue') { const f=b.closest('form');if(f)f.requestSubmit();return; }
    if(action==='event-tab'){eventTab=b.dataset.tab;render();return;}
    if(action==='calendar-prev'){currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);render();return;}
    if(action==='calendar-next'){currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);render();return;}
    if(action==='calendar-today'){currentMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);render();return;}
    if(action==='settings-tab'){settingsTab=b.dataset.tab;render();return;}
    if(action==='open-event'){
      const target=state.events.find(x=>x.id===id);if(!target)return;
      if(!isAdmin()&&target.id!==state.activeEventId){toast('Your administrator controls the active event workspace. You can still view the event catalogue.','error');return;}
      if(isAdmin()&&target.id!==state.activeEventId){const ok=await saveState(s=>{s.activeEventId=target.id;},'Active event workspace changed.');if(!ok)return;}
      currentEventDetail=null;currentPage='overview';render();return;
    }
    if(action==='edit-event'){if(isAdmin()){const r=state.events.find(x=>x.id===id);if(r)openModal('event',r);}return;}
    if(action==='edit-room'){if(isAdmin()){const r=state.rooms.find(x=>x.id===id);if(r)openModal('room',r);}return;}
    if(action==='view-room'){const r=state.rooms.find(x=>x.id===id);if(r)openModal('view-room',r);return;}
    if(action==='delete-room'){
      if(!isAdmin())return; const r=state.rooms.find(x=>x.id===id);if(!r)return;
      const used=state.events.some(x=>(x.roomIds||[]).includes(id))||state.assets.some(x=>x.roomId===id)||state.maintenance.some(x=>x.roomId===id);
      if(used){toast('This room is referenced by a booking, asset, or maintenance request and cannot be removed.','error');return;}
      if(!confirm(`Remove room “${r.name}”? This cannot be undone.`))return;
      const ok=await saveState(s=>{s.rooms=s.rooms.filter(x=>x.id!==id);},'Room removed.');if(ok)render();return;
    }
    if(action==='edit-asset'){if(isAdmin()){const r=state.assets.find(x=>x.id===id);if(r)openModal('asset',r);}return;}
    if(action==='view-asset'){const r=state.assets.find(x=>x.id===id);if(r)openModal('view-asset',r);return;}
    if(action==='report-asset'){const a=state.assets.find(x=>x.id===id);openModal('maintenance',{title:`Service request — ${a?.name||'equipment'}`,type:'Equipment repair',priority:'Normal',assetId:id,roomId:a?.roomId||'',reporter:user.displayName,description:''});return;}
    if(action==='view-maintenance'){const r=state.maintenance.find(x=>x.id===id);if(r)openModal('view-maintenance',r);return;}
    if(action==='edit-maintenance'){if(isAdmin()){const r=state.maintenance.find(x=>x.id===id);if(r)openModal('maintenance',r);}return;}
    if(action==='shift-checklist'){currentEventDetail=id;currentPage='checklist';render();return;}
    if(action==='remove-shift'){
      if(!isAdmin())return; const event=ACTIVE_EVENT();if(!event)return;
      const shift=workFor(event.id).shifts.find(x=>x.id===id);if(!shift)return;
      if(!confirm(`Remove ${accountName(shift.userId)}’s shift on ${fmtDate(shift.date)}?`))return;
      const ok=await saveState(s=>{workFor(event.id).shifts=workFor(event.id).shifts.filter(x=>x.id!==id);},'Shift removed.');if(ok){currentEventDetail=null;render();}return;
    }
    if(action==='ack-handoff'){
      const event=ACTIVE_EVENT();if(!event)return;const h=workFor(event.id).handoffs.find(x=>x.id===id);if(!h)return;
      const already=(h.acknowledgedBy||[]).includes(user.id);
      const ok=await saveState(s=>{const entry=workFor(event.id).handoffs.find(x=>x.id===id);entry.acknowledgedBy||=[];entry.acknowledgedBy=already?entry.acknowledgedBy.filter(x=>x!==user.id):[...entry.acknowledgedBy,user.id];},already?'Acknowledgement removed.':'Handoff marked as read.');if(ok){closeModal();render();}return;
    }
    if(action==='handoff-from'){
      const h=workFor(ACTIVE_EVENT()?.id).handoffs.find(x=>x.id===id);if(!h)return;
      const copy=clone(h);copy.id='';copy.outgoingUserId=user.id;copy.createdAt='';copy.acknowledgedBy=[];openModal('handoff',{data:copy});return;
    }
    if(action==='view-handoff'){const h=workFor(ACTIVE_EVENT()?.id).handoffs.find(x=>x.id===id);if(h)openModal('view-handoff',h);return;}
    if(action==='delete-handoff'){
      if(!isAdmin())return;const event=ACTIVE_EVENT();if(!event)return;const h=workFor(event.id).handoffs.find(x=>x.id===id);if(!h)return;
      if(!confirm('Delete this handoff from the event history?'))return;
      const ok=await saveState(s=>{workFor(event.id).handoffs=workFor(event.id).handoffs.filter(x=>x.id!==id);},'Handoff deleted.');if(ok){closeModal();render();}return;
    }
    if(action==='view-incident'){
      const ev=state.events.find(e=>workFor(e.id).incidents.some(i=>i.id===id));const r=ev&&workFor(ev.id).incidents.find(i=>i.id===id);if(r)openModal('view-incident',r);return;
    }
    if(action==='open-incident'){
      const eventId=b.dataset.eventId||ACTIVE_EVENT()?.id;const r=workFor(eventId).incidents.find(i=>i.id===id);if(r){if(eventId!==state.activeEventId&&isAdmin()){const ok=await saveState(s=>{s.activeEventId=eventId;},'Switched to incident event.');if(!ok)return;}currentPage='incidents';openModal('view-incident',r);render();}return;
    }
    if(action==='resolve-incident'){
      const event=ACTIVE_EVENT();if(!event)return;const inc=workFor(event.id).incidents.find(x=>x.id===id);if(!inc)return;const resolving=b.dataset.resolve==='true';
      const ok=await saveState(s=>{const r=workFor(event.id).incidents.find(x=>x.id===id);r.status=resolving?'Resolved':'Open';r.resolvedBy=resolving?user.displayName:'';r.resolvedAt=resolving?timeNow():null;},resolving?'Incident resolved.':'Incident reopened.');if(ok)render();return;
    }
    if(action==='delete-incident'){
      if(!isAdmin())return;const event=ACTIVE_EVENT();if(!event)return;const inc=workFor(event.id).incidents.find(x=>x.id===id);if(!inc)return;
      if(!confirm(`Delete incident “${inc.title}” from the event history?`))return;
      const ok=await saveState(s=>{workFor(event.id).incidents=workFor(event.id).incidents.filter(x=>x.id!==id);},'Incident deleted.');if(ok)render();return;
    }
    if(action==='export-backup'){
      const backup=clone(state);delete backup._revision;delete backup.users;
      const blob=new Blob([JSON.stringify({format:'backstage-backup',version:1,exportedAt:timeNow(),state:backup},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`backstage-backup-${today()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Backup exported.');return;
    }
    if(action==='choose-import'){$('#import-file')?.click();return;}
    if(action==='reset-checklists'){
      if(!isAdmin())return;if(!confirm('Reset checklist progress for every scheduled shift? This cannot be undone.'))return;
      const ok=await saveState(s=>{for(const ws of Object.values(s.workspaces))for(const sh of ws.shifts)sh.completedTasks={};},'All checklist progress reset.');if(ok)render();return;
    }
    if(action==='reset-user-password'){
      if(!isAdmin())return;const account=state.users.find(u=>u.id===id);if(!account)return;const password=prompt(`New password for ${account.username} (at least 12 characters):`);if(password===null)return;
      try{await api(`/admin/users/${encodeURIComponent(id)}/password`,'PUT',{password});await refreshAll();toast('Password reset. The account must sign in again.');}catch(err){toast(err.message,'error');}return;
    }
    if(action==='toggle-user'){
      if(!isAdmin())return;const enabled=b.dataset.enabled==='true';const account=state.users.find(u=>u.id===id);if(!account)return;
      if(!confirm(`${enabled?'Enable':'Disable'} ${account.displayName} (@${account.username})?`))return;
      try{await api(`/admin/users/${encodeURIComponent(id)}/enabled`,'PUT',{enabled});await refreshAll();toast(`Account ${enabled?'enabled':'disabled'}.`);}catch(err){toast(err.message,'error');}return;
    }
  });

  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.id==='active-event-select'){
      if(!isAdmin())return;const id=t.value;if(id===state.activeEventId)return;
      const ok=await saveState(s=>{s.activeEventId=id;},'Active event workspace changed.');if(ok){currentEventDetail=null;render();}return;
    }
    const filters={
      'event-search':v=>{currentFilter=v;},'room-search':v=>{currentFilter=v;},'asset-search':v=>{currentFilter=v;},'maintenance-search':v=>{currentFilter=v;},'crew-search':v=>{currentFilter=v;},'handoff-search':v=>{currentFilter=v;},'incident-search':v=>{currentFilter=v;},
      'event-status-filter':v=>{currentStatusFilter=v;},'room-status-filter':v=>{currentStatusFilter=v;},'asset-status-filter':v=>{currentStatusFilter=v;},'maintenance-status-filter':v=>{currentStatusFilter=v;},'crew-filter':v=>{currentStatusFilter=v;},'incident-status-filter':v=>{currentStatusFilter=v;},'incident-priority-filter':v=>{currentPriorityFilter=v;},'checklist-shift-select':v=>{currentEventDetail=v;}
    };
    if(filters[t.id]){filters[t.id](t.value);render();return;}
    if(t.matches('input[data-action="toggle-task"]')){
      const taskId=t.dataset.taskId;const shiftId=currentEventDetail;const event=ACTIVE_EVENT();if(!event||!shiftId)return;
      const shift=workFor(event.id).shifts.find(s=>s.id===shiftId);if(!shift||(!isAdmin()&&shift.userId!==user.id)){t.checked=!t.checked;return;}
      const checked=t.checked;const ok=await saveState(s=>{const sh=workFor(event.id).shifts.find(x=>x.id===shiftId);sh.completedTasks||={};if(checked)sh.completedTasks[taskId]=true;else delete sh.completedTasks[taskId];},'Checklist progress saved.');if(!ok)render();return;
    }
  });
  document.addEventListener('input',e=>{
    const t=e.target;if(!t.id||!t.id.endsWith('-search'))return;
    currentFilter=t.value;
    const cursor=t.selectionStart;const id=t.id;
    render();const next=$(`#${id}`);if(next){next.focus();try{next.setSelectionRange(cursor,cursor);}catch{}}
  });
  document.addEventListener('change',async e=>{
    const t=e.target;if(t.id!=='import-file'||!t.files?.[0])return;
    if(!isAdmin()){toast('Administrator access required.','error');return;}
    const file=t.files[0];try{
      const parsed=JSON.parse(await file.text());const incoming=parsed.state||parsed;
      if(!confirm('Importing replaces the shared venue record. Export a backup first. Continue?')){t.value='';return;}
      await api('/admin/import','POST',{revision,state:incoming});await loadState();currentPage='overview';render();toast('Backup imported successfully.');
    }catch(err){toast(`Import failed: ${err.message}`,'error');}finally{t.value='';}
  });

  (async function boot(){
    try {
      const me=await api('/auth/me'); user=me.user;
      await loadState();render();
    } catch(err) {
      if(err.status===401){renderLogin();return;}
      $('#app').innerHTML=`<div style="min-height:100vh;display:grid;place-items:center;padding:24px"><div class="panel" style="max-width:520px;padding:26px"><div class="brand-mark">B</div><h2 style="font:800 22px Manrope,sans-serif;margin:19px 0 6px">Backstage can’t reach the venue API</h2><p class="muted">The web app is configured for <strong>${esc(API)}</strong>, but that endpoint did not respond. Check that the API server is running and that the domain / TLS / CORS settings are correct.</p><button class="btn btn-primary" type="button" id="retry-api">Retry connection</button><div class="helper" style="margin-top:14px">${esc(err.message||'Unknown connection error')}</div></div></div>`;
      $('#retry-api')?.addEventListener('click',()=>location.reload());
    }
  })();
})();
