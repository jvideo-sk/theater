(() => {
  "use strict";

  // ===========================================================================
  // DEFAULT CUSTOMIZATION SEED
  // These defaults are used for a fresh installation only. Checklist tasks and
  // dropdown options can be edited from the Customize page in the running app.
  // ===========================================================================
  const DEFAULT_CHECKLIST_SECTIONS = [
    {
      id: "takeover",
      title: "On arrival / shift takeover",
      description: "Confirm the event status, assigned post, risks, and next actions before taking over.",
      items: [
        { id: "read-handoff", label: "Read the latest handoff", help: "Review current status, next priorities, open tasks, and any acknowledgements or updates." },
        { id: "review-incidents", label: "Review all open incidents", help: "Identify anything urgent, who owns it, and what must happen next." },
        { id: "confirm-schedule", label: "Confirm today's timing and changes", help: "Check call times, doors, start/end, breaks, strike deadline, and any updates from the event lead." },
        { id: "walk-space", label: "Walk the assigned spaces", help: "Check the room, booth, backstage routes, and work area for unexpected changes or hazards." },
        { id: "check-comms", label: "Check comms and contact chain", help: "Verify radio/comms work and know who is in charge, which channel to use, and how to escalate a problem." },
        { id: "check-equipment", label: "Verify the key equipment state", help: "Check the assigned console, playback, microphones, displays, or other gear against the handoff notes." },
        { id: "confirm-role", label: "Confirm post, responsibilities, and limits", help: "Know which area you own, what you are expected to operate, and what requires approval." },
      ],
    },
    {
      id: "during",
      title: "During the event",
      description: "Keep the event running and make changes traceable.",
      items: [
        { id: "monitor-comms", label: "Monitor comms and event timing", help: "Stay reachable on the assigned channel and track any changes to the running schedule." },
        { id: "track-changes", label: "Record changes to setup or operation", help: "Note requested/approved changes that the next technician may need to know about." },
        { id: "log-faults", label: "Log equipment faults and incidents", help: "Record observed facts, location/equipment ID, action taken, and who was notified." },
        { id: "escalate-hazards", label: "Escalate safety issues immediately", help: "Use venue radio and emergency procedures directly. A log entry is not an alert." },
        { id: "update-tasks", label: "Update task owners and blockers", help: "Make it clear what is done, what is still open, and who is expected to follow up." },
      ],
    },
    {
      id: "handoff",
      title: "Before leaving / handoff",
      description: "Do not leave the next person guessing.",
      items: [
        { id: "update-phase", label: "Confirm the current event phase", help: "Check that the administrator-set phase matches what is happening. If it needs changing, tell the event lead or administrator rather than editing the event yourself." },
        { id: "update-incidents", label: "Update incidents and follow-up owners", help: "Resolve only items that are genuinely resolved; leave the rest open with a clear owner." },
        { id: "write-status", label: "Write the current situation and next actions", help: "State what's working, what is not, and the first actions the incoming technician should take." },
        { id: "brief-incoming", label: "Brief the incoming technician directly", help: "Where possible, talk through urgent/open items and confirm they know what needs attention." },
        { id: "leave-safe", label: "Leave equipment and work areas in the required state", help: "Follow venue procedures and only perform shutdown, lockup, or equipment actions you are authorized to do." },
        { id: "save-handoff", label: "Save the handoff entry", help: "Create a timestamped record so the next shift can review the information later." },
      ],
    },
  ];

  const DEFAULT_SETTINGS = {
    checklist: DEFAULT_CHECKLIST_SECTIONS,
    eventPhases: [
      "Prepping / load-in", "Setup / sound check", "Doors open", "Event in progress",
      "Break / intermission", "Strike / load-out", "Closed / secured",
    ],
    incidentCategories: [
      "Technical / equipment", "Safety / hazard", "Damage", "Missing item",
      "Room / setup", "Access / security", "Schedule / request", "Other",
    ],
    incidentPriorities: ["Low", "Medium", "High", "Urgent"],
    handoffPriorities: ["Routine", "Needs attention", "Urgent"],
  };

  // ===========================================================================
  // APP STATE AND STORAGE
  // The published app requires a host account session before exposing shared event data.
  // ===========================================================================
  const STORAGE_KEY = "backstage-tech-handoff-v1";
  const SESSION_KEY = "backstage-technician-session-v2";
  const SESSION_USER_KEY = "backstage-technician-user-v2";
  const SIGNOUT_NOTICE_KEY = "backstage-signout-notice";
  const API_BASE_KEY = "backstage-host-api-base-v1";
  const FIXED_API_BASE_URL = "https://theatre-api.jvideo.dev";
  const $ = (id) => document.getElementById(id);
  let toastTimer;
  let saveTimer;
  let saveQueue = Promise.resolve();
  let serverStorageEnabled = false;
  let hostConnectionProblem = false;
  let serverRevision = 0;
  let activeSessionToken = "";
  let activeUser = null;
  let activeView = "operations";
  let venueCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let venueCalendarInitialized = false;
  let technicianDirectory = [];
  let reloadAfterLogin = false;
  let state = createBlankState();

  const eventFieldMap = {
    eventName: "name",
    eventDate: "date",
    eventStatus: "status",
    eventSpaces: "spaces",
    eventLead: "lead",
    eventContact: "contact",
    eventSchedule: "schedule",
  };

  const handoffFieldMap = {
    outgoingTech: "outgoing",
    incomingTech: "incoming",
    shiftEnd: "shiftEnd",
    nextShiftDate: "nextDate",
    nextShiftStart: "nextStart",
    handoffPriority: "priority",
    currentStatus: "summary",
    completedThisShift: "completed",
    openTasks: "openTasks",
    equipmentStatus: "equipment",
    commsNotes: "communications",
    nextActions: "nextActions",
    handoffNotes: "notes",
  };

  function localDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }

  function isAdmin() {
    return activeUser?.role === "admin";
  }

  function cloneDefaultSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function cleanStringList(value, fallback) {
    if (!Array.isArray(value)) return [...fallback];
    const cleaned = value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    return cleaned.length ? [...new Set(cleaned)] : [...fallback];
  }

  function normalizeSettings(savedSettings) {
    const defaults = cloneDefaultSettings();
    const saved = savedSettings && typeof savedSettings === "object" ? savedSettings : {};
    let checklist = defaults.checklist;

    if (Array.isArray(saved.checklist)) {
      const cleanedSections = saved.checklist
        .filter((section) => section && typeof section === "object")
        .map((section) => ({
          id: String(section.id || createId()),
          title: String(section.title || "Untitled section").trim(),
          description: String(section.description || "").trim(),
          items: Array.isArray(section.items) ? section.items
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              id: String(item.id || createId()),
              label: String(item.label || "Untitled task").trim(),
              help: String(item.help || "").trim(),
            })) : [],
        }));
      checklist = cleanedSections;
    }

    return {
      checklist,
      eventPhases: cleanStringList(saved.eventPhases, defaults.eventPhases),
      incidentCategories: cleanStringList(saved.incidentCategories, defaults.incidentCategories),
      incidentPriorities: cleanStringList(saved.incidentPriorities, defaults.incidentPriorities),
      handoffPriorities: cleanStringList(saved.handoffPriorities, defaults.handoffPriorities),
    };
  }

  function getChecklistSections() {
    return state.settings.checklist;
  }

  function createBlankVenue() {
    return {
      name: "Backstage Theatre",
      activeEventId: "",
      events: [],
      rooms: [],
      equipment: [],
      maintenance: [],
    };
  }

  function createBlankState() {
    return {
      version: 1,
      venue: createBlankVenue(),
      settings: cloneDefaultSettings(),
      eventId: createId(),
      event: {
        name: "",
        date: localDateString(),
        status: DEFAULT_SETTINGS.eventPhases[0],
        spaces: "",
        lead: "",
        contact: "",
        schedule: "",
      },
      shiftDraft: {
        outgoing: "",
        incoming: "",
        shiftEnd: "",
        nextDate: "",
        nextStart: "",
        priority: "Routine",
        summary: "",
        completed: "",
        openTasks: "",
        equipment: "",
        communications: "",
        nextActions: "",
        notes: "",
      },
      checks: {},
      shiftChecks: {},
      revision: 0,
      handoffs: [],
      incidents: [],
      shiftSchedule: [],
      created: Date.now(),
      updated: null,
    };
  }

  function makeVenueEventFromState(source, id, existing = {}) {
    const event = source?.event && typeof source.event === "object" ? source.event : {};
    const workspace = existing.workspace && typeof existing.workspace === "object" ? existing.workspace : {};
    return {
      ...existing,
      id: String(id || existing.id || createId()),
      name: String(event.name ?? existing.name ?? "Untitled event"),
      date: String(event.date ?? existing.date ?? localDateString()),
      phase: String(event.status ?? existing.phase ?? DEFAULT_SETTINGS.eventPhases[0]),
      spaces: String(event.spaces ?? existing.spaces ?? ""),
      lead: String(event.lead ?? existing.lead ?? ""),
      contact: String(event.contact ?? existing.contact ?? ""),
      schedule: String(event.schedule ?? existing.schedule ?? ""),
      bookingType: String(existing.bookingType || "Other"),
      bookingStatus: String(existing.bookingStatus || "Confirmed"),
      startTime: String(existing.startTime || ""),
      endTime: String(existing.endTime || ""),
      roomId: String(existing.roomId || ""),
      roomIds: Array.isArray(existing.roomIds) ? existing.roomIds.map((roomId) => String(roomId)) : (existing.roomId ? [String(existing.roomId)] : []),
      technicalNotes: String(existing.technicalNotes || event.schedule || ""),
      workspace: {
        checks: JSON.parse(JSON.stringify(source?.checks || workspace.checks || {})),
        shiftChecks: JSON.parse(JSON.stringify(source?.shiftChecks || workspace.shiftChecks || {})),
        handoffs: JSON.parse(JSON.stringify(source?.handoffs || workspace.handoffs || [])),
        incidents: JSON.parse(JSON.stringify(source?.incidents || workspace.incidents || [])),
        shiftSchedule: JSON.parse(JSON.stringify(source?.shiftSchedule || workspace.shiftSchedule || [])),
      },
    };
  }

  function normalizeVenue(savedVenue, savedState = {}) {
    const blank = createBlankVenue();
    const saved = savedVenue && typeof savedVenue === "object" ? savedVenue : {};
    const cleanList = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && item.id).map((item) => ({ ...item, id: String(item.id) })) : [];
    const venue = {
      name: String(saved.name || blank.name).slice(0, 120),
      activeEventId: String(saved.activeEventId || ""),
      events: cleanList(saved.events),
      rooms: cleanList(saved.rooms),
      equipment: cleanList(saved.equipment),
      maintenance: cleanList(saved.maintenance),
    };
    // Migrate existing single-event records without discarding their history.
    if (!venue.events.length && String(savedState.event?.name || "").trim()) {
      const id = createId();
      venue.events.push(makeVenueEventFromState(savedState, id, {}));
      venue.activeEventId = id;
    }
    if (venue.events.length && !venue.events.some((event) => event.id === venue.activeEventId)) {
      venue.activeEventId = venue.events[0].id;
    }
    venue.events = venue.events.map((event) => makeVenueEventFromState({ event: {
      name: event.name, date: event.date, status: event.phase, spaces: event.spaces, lead: event.lead, contact: event.contact, schedule: event.schedule,
    } }, event.id, event));
    venue.rooms = venue.rooms.map((room) => ({
      id: String(room.id || createId()), name: String(room.name || "Untitled space").slice(0, 120),
      code: String(room.code || "").slice(0, 24), type: String(room.type || "Other"),
      capacity: String(room.capacity ?? ""), status: String(room.status || "Available"),
      notes: String(room.notes || "").slice(0, 500), createdAt: Number(room.createdAt || Date.now()),
    }));
    venue.equipment = venue.equipment.map((item) => ({
      id: String(item.id || createId()), name: String(item.name || "Untitled equipment").slice(0, 140),
      assetId: String(item.assetId || "UNASSIGNED").slice(0, 50), category: String(item.category || "Other"),
      roomId: String(item.roomId || ""), status: String(item.status || "Available"),
      serial: String(item.serial || "").slice(0, 120), notes: String(item.notes || "").slice(0, 500),
      createdAt: Number(item.createdAt || Date.now()),
    }));
    venue.maintenance = venue.maintenance.map((item) => ({
      id: String(item.id || createId()), title: String(item.title || "Untitled request").slice(0, 140),
      category: String(item.category || "Other"), priority: String(item.priority || "Normal"),
      roomId: String(item.roomId || ""), equipmentId: String(item.equipmentId || ""),
      details: String(item.details || "").slice(0, 3000), reporter: String(item.reporter || ""),
      owner: String(item.owner || ""), status: String(item.status || "Open"),
      createdAt: Number(item.createdAt || Date.now()), updatedAt: Number(item.updatedAt || item.createdAt || Date.now()),
      createdBy: item.createdBy && typeof item.createdBy === "object" ? item.createdBy : null,
    }));
    return venue;
  }

  function normalizeState(saved) {
    const blank = createBlankState();
    const normalized = {
      ...blank,
      ...(saved || {}),
      eventId: saved?.eventId || blank.eventId,
      revision: Number.isSafeInteger(saved?.revision) && saved.revision >= 0 ? saved.revision : 0,
      settings: normalizeSettings(saved?.settings),
      event: { ...blank.event, ...(saved?.event || {}) },
      shiftDraft: { ...blank.shiftDraft, ...(saved?.shiftDraft || {}) },
      checks: saved?.checks && typeof saved.checks === "object" ? saved.checks : {},
      shiftChecks: saved?.shiftChecks && typeof saved.shiftChecks === "object" ? saved.shiftChecks : {},
      handoffs: Array.isArray(saved?.handoffs) ? saved.handoffs : [],
      incidents: Array.isArray(saved?.incidents) ? saved.incidents : [],
      shiftSchedule: Array.isArray(saved?.shiftSchedule) ? saved.shiftSchedule : [],
    };
    normalized.venue = normalizeVenue(saved?.venue, { ...normalized, ...(saved || {}) });
    return normalized;
  }

  function isValidState(saved) {
    return Boolean(
      saved && saved.version === 1 && saved.event &&
      Array.isArray(saved.handoffs) && Array.isArray(saved.incidents)
    );
  }

  function loadLocalState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return createBlankState();
      const parsed = JSON.parse(stored);
      return isValidState(parsed) ? normalizeState(parsed) : createBlankState();
    } catch (error) {
      console.warn("Could not load the local technician handoff cache.", error);
      return createBlankState();
    }
  }

  // The published GitHub Pages app is permanently tied to the theatre API.
  // Old browser settings cannot redirect it to another server. Non-static/local
  // deployments may still use an optional saved host URL.
  function getApiBaseUrl() {
    if (window.BACKSTAGE_STATIC_SITE) return FIXED_API_BASE_URL;
    try {
      const saved = (localStorage.getItem(API_BASE_KEY) || "").trim().replace(/\/+$/, "");
      if (saved) return saved;
    } catch (_) { /* use same-origin API below */ }
    return "";
  }

  function apiUrl(path) {
    const base = getApiBaseUrl();
    return base ? `${base}${path}` : path;
  }

  function renderApiConnectionPanel(message) {
    const input = $("apiBaseUrl");
    const status = $("apiConnectionStatus");
    const badge = $("apiConnectionBadge");
    if (!status || !badge) return;
    const base = getApiBaseUrl();
    if (input && document.activeElement !== input) input.value = base;
    if (message) {
      status.textContent = message;
    } else if (serverStorageEnabled && !hostConnectionProblem) {
      status.textContent = `Connected to the required API at ${base}. Shared data is stored on the theatre host.`;
    } else if (hostConnectionProblem) {
      status.textContent = `Cannot reach ${base}. This site is locked to the shared host and will not switch to browser-only storage.`;
    } else if (window.BACKSTAGE_STATIC_SITE) {
      status.textContent = `Required API: ${FIXED_API_BASE_URL}. Sign in and connect to this host to use Backstage.`;
    } else if (base) {
      status.textContent = `Saved host address: ${base}. Connect to load the shared record.`;
    } else {
      status.textContent = "Using the API served on this computer.";
    }
    badge.textContent = serverStorageEnabled ? "Host connected" : (hostConnectionProblem ? "Host unavailable" : (window.BACKSTAGE_STATIC_SITE ? "Required host" : (base ? "Host configured" : "Local API")));
    badge.className = `pill ${serverStorageEnabled ? "green" : (hostConnectionProblem ? "red" : "amber")}`;
  }

  // Individual technician accounts. Access tokens are short-lived server-issued
  // bearer tokens stored in this browser tab only; passwords are never retained.
  let loginPromise = null;
  let loginResolver = null;

  function setLoginMessage(message) {
    const messageBox = $("loginMessage");
    if (!messageBox) return;
    messageBox.textContent = message || "";
    messageBox.hidden = !message;
  }

  function showLoginPage(message) {
    const screen = $("loginScreen");
    if (!screen) return;
    setLoginMessage(message);
    screen.hidden = false;
    document.body.classList.add("loginOpen");
    const app = document.querySelector(".app");
    if (app) app.inert = true;
    window.requestAnimationFrame(() => $("loginUsername")?.focus());
  }

  function hideLoginPage() {
    const screen = $("loginScreen");
    if (screen) screen.hidden = true;
    document.body.classList.remove("loginOpen");
    const app = document.querySelector(".app");
    if (app) app.inert = false;
    if ($("loginPassword")) $("loginPassword").value = "";
    setLoginMessage("");
  }

  function requestAccountLogin(message) {
    if (loginPromise) return loginPromise;
    loginPromise = new Promise((resolve) => { loginResolver = resolve; });
    showLoginPage(message || "");
    return loginPromise;
  }

  function finishAccountLogin(token) {
    const resolve = loginResolver;
    loginPromise = null;
    loginResolver = null;
    hideLoginPage();
    if (typeof resolve === "function") resolve(token);
  }

  function clearAccountSession() {
    activeSessionToken = "";
    activeUser = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_USER_KEY);
    } catch (_) { /* browser session storage may be unavailable */ }
    updateSessionIdentity();
  }

  function updateEventEditPermissions() {
    const canEdit = isAdmin();
    Object.keys(eventFieldMap).forEach((elementId) => {
      const field = $(elementId);
      if (field) field.disabled = !canEdit;
    });
    const notice = $("eventAdminNotice");
    if (notice) notice.hidden = canEdit;
    const title = $("eventDetailsTitle");
    if (title) title.textContent = canEdit ? "Current event" : "Current event, set by an administrator";
  }

  function updateSessionIdentity() {
    const nameNode = $("sessionUserName");
    const roleNode = $("sessionUserRole");
    const avatarNode = $("sessionAvatar");
    const adminPanel = $("usersAdminPanel");
    const scheduleEditor = $("scheduleAdminEditor");
    const scheduleRoleBadge = $("scheduleRoleBadge");
    const scheduleReadOnlyBadge = $("scheduleReadOnlyBadge");
    if (scheduleEditor) scheduleEditor.hidden = !isAdmin();
    if (scheduleRoleBadge) { scheduleRoleBadge.textContent = isAdmin() ? "Administrator editor" : "Read-only"; scheduleRoleBadge.className = `pill ${isAdmin() ? "green" : ""}`; }
    if (scheduleReadOnlyBadge) { scheduleReadOnlyBadge.textContent = isAdmin() ? "Admin controls enabled" : "Shared read-only view"; scheduleReadOnlyBadge.className = `pill ${isAdmin() ? "green" : ""}`; }
    if (nameNode) nameNode.textContent = activeUser?.displayName || "Signed-in technician";
    if (roleNode) roleNode.textContent = activeUser ? `${activeUser.username} · ${activeUser.role === "admin" ? "Administrator" : "Technician"}` : "Not signed in";
    if (avatarNode) {
      const initials = String(activeUser?.displayName || "BT").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
      avatarNode.textContent = initials || "BT";
    }
    const isAdministrator = isAdmin();
    if (adminPanel) adminPanel.hidden = !isAdministrator;
    const overviewLabel = document.querySelector('[data-view="operations"] .navText');
    if (overviewLabel) overviewLabel.textContent = isAdministrator ? "Venue overview" : "My Work";
    const eventsBadge = $("eventsAccessBadge");
    if (eventsBadge) { eventsBadge.textContent = isAdministrator ? "Admin controls enabled" : "Read-only booking list"; eventsBadge.className = `pill ${isAdministrator ? "green" : ""}`; }

    // Every element marked admin-only remains hidden until an authenticated
    // administrator session is confirmed by the host API.
    document.querySelectorAll("[data-admin-only]").forEach((element) => {
      element.hidden = !isAdministrator;
    });

    const settingsView = $("view-settings");
    if (settingsView) settingsView.hidden = !isAdministrator;
    updateEventEditPermissions();
    if (!isAdministrator && settingsView?.classList.contains("active")) {
      switchView("handoff");
    }
  }

  async function validateSessionToken(token) {
    const headers = new Headers({ "X-Theatre-Session": token });
    try {
      const response = await fetch(apiUrl("/api/session"), { method: "GET", cache: "no-store", headers });
      if (response.status === 401) return { ok: false, message: "Your session expired. Please sign in again." };
      if (!response.ok) {
        let detail = "";
        try { detail = (await response.json()).error || ""; } catch (_) { /* ignore non-JSON response */ }
        return { ok: false, message: detail || `The host returned an error (${response.status}).` };
      }
      const payload = await response.json();
      return { ok: true, user: payload.user, expiresAt: payload.expiresAt };
    } catch (error) {
      return { ok: false, message: error?.name === "AbortError" ? "The theatre host did not respond." : `Couldn't reach ${FIXED_API_BASE_URL}. Check the API server and Cloudflare Tunnel.` };
    }
  }

  function setupLoginPage() {
    const cancelButton = $("loginCancel");
    if (cancelButton) cancelButton.style.display = "none";

    $("passwordToggle")?.addEventListener("click", () => {
      const input = $("loginPassword");
      const toggle = $("passwordToggle");
      if (!input || !toggle) return;
      const showPassword = input.type === "password";
      input.type = showPassword ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(showPassword));
      toggle.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
      toggle.title = showPassword ? "Hide password" : "Show password";
      input.focus();
    });

    $("loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = String($("loginUsername").value || "").trim().toLowerCase();
      const password = $("loginPassword").value;
      if (!username || !password) {
        setLoginMessage("Enter your username and password.");
        (username ? $("loginPassword") : $("loginUsername")).focus();
        return;
      }
      const submitButton = $("loginSubmit");
      const originalLabel = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.textContent = "Signing in…";
      setLoginMessage("");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(apiUrl("/api/login"), {
          method: "POST", cache: "no-store", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        let payload = {};
        try { payload = await response.json(); } catch (_) { /* show generic failure */ }
        if (!response.ok) {
          setLoginMessage(payload.error || (response.status === 401 ? "Username or password is incorrect." : `Sign-in failed (${response.status}).`));
          $("loginPassword").focus();
          return;
        }
        activeSessionToken = payload.token;
        activeUser = payload.user;
        try {
          sessionStorage.setItem(SESSION_KEY, activeSessionToken);
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(activeUser));
        } catch (_) { /* token remains in memory for this tab */ }
        updateSessionIdentity();
        if (reloadAfterLogin) {
          // A host failure locked the published UI; after re-authentication, reload
          // the canonical host state before exposing the dashboard again.
          reloadAfterLogin = false;
          window.location.reload();
          return;
        }
        finishAccountLogin(activeSessionToken);
      } catch (error) {
        setLoginMessage(error?.name === "AbortError" ? "Sign-in timed out. Check the host and try again." : `Could not reach ${FIXED_API_BASE_URL}. Check the server and Cloudflare Tunnel.`);
      } finally {
        clearTimeout(timeoutId);
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.innerHTML = originalLabel;
      }
    });
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const callerSignal = options.signal;
    const abortFromCaller = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) controller.abort(callerSignal.reason);
    else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async function hostRequest(url, options = {}) {
    if (window.BACKSTAGE_STATIC_SITE && !String(url).startsWith("/api/")) {
      throw new Error("The published site may contact only its configured theatre API.");
    }
    const targetUrl = window.BACKSTAGE_STATIC_SITE
      ? `${FIXED_API_BASE_URL}${url}`
      : (url.startsWith("/api/") ? apiUrl(url) : url);
    const headers = new Headers(options.headers || {});
    const readToken = () => {
      try { return sessionStorage.getItem(SESSION_KEY) || activeSessionToken || ""; }
      catch (_) { return activeSessionToken || ""; }
    };
    let token = readToken();
    if (token) headers.set("X-Theatre-Session", token);
    let response = await fetchWithTimeout(targetUrl, { cache: "no-store", ...options, headers });

    if (response.status === 401) {
      clearAccountSession();
      const freshToken = await requestAccountLogin("Your session expired or was revoked. Sign in again to continue.");
      if (!freshToken) {
        const error = new Error("Sign-in is required to access the shared theatre record.");
        error.hostUnavailable = true;
        throw error;
      }
      token = freshToken;
      headers.set("X-Theatre-Session", token);
      response = await fetchWithTimeout(targetUrl, { cache: "no-store", ...options, headers });
      if (response.status === 401) {
        clearAccountSession();
        showLoginPage("Your account session could not be verified. Please sign in again.");
      }
    }

    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json()).error || ""; } catch (_) { /* response may be non-JSON */ }
      const error = new Error(detail || `Host request failed (${response.status}).`);
      error.status = response.status;
      error.hostUnavailable = response.status >= 500 || response.status === 401;
      throw error;
    }
    return response;
  }

  async function loadInitialState() {
    if (window.BACKSTAGE_STATIC_SITE && !getApiBaseUrl()) {
      throw new Error(`Required API ${FIXED_API_BASE_URL} is not configured.`);
    }

    try {
      const response = await hostRequest("/api/state", { method: "GET" });
      const saved = await response.json();
      const etagRevision = parseInt(String(response.headers.get("ETag") || "").replace(/[^0-9]/g, ""), 10);
      serverRevision = Number.isSafeInteger(etagRevision) && etagRevision >= 0 ? etagRevision : (Number(saved?.revision) || 0);
      serverStorageEnabled = true;
      hostConnectionProblem = false;
      if (isValidState(saved)) {
        // Published frontend never treats browser storage as the database.
        if (!window.BACKSTAGE_STATIC_SITE) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (_) { /* host is canonical */ }
        }
        return isValidState(saved) ? normalizeState(saved) : createBlankState();
      }
      return createBlankState();
    } catch (error) {
      serverStorageEnabled = false;
      hostConnectionProblem = true;
      if (window.BACKSTAGE_STATIC_SITE) {
        error.hostUnavailable = true;
        throw error;
      }
      console.error("The host save could not be reached. Loading the local cache for this non-published deployment.", error);
      return loadLocalState();
    }
  }

  async function connectToHost() {
    if (window.BACKSTAGE_STATIC_SITE) {
      renderApiConnectionPanel(`The API endpoint is fixed to ${FIXED_API_BASE_URL} and cannot be changed here.`);
      return;
    }
    const input = $("apiBaseUrl");
    let candidate;
    try {
      const entered = String(input.value || "").trim();
      if (!entered) throw new Error("Enter your host's HTTPS base URL first.");
      const parsed = new URL(entered);
      const isLocalHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !isLocalHttp) {
        throw new Error("Use an HTTPS URL. Only localhost may use HTTP.");
      }
      if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) {
        throw new Error("Enter only the host origin, without a path, username, query, or fragment.");
      }
      candidate = parsed.origin;
    } catch (error) {
      showToast(error.message || "That host URL is not valid.");
      renderApiConnectionPanel(error.message || "That host URL is not valid.");
      return;
    }

    const previousBase = getApiBaseUrl();
    if (candidate !== previousBase) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* unavailable in private mode */ }
    }
    try { localStorage.setItem(API_BASE_KEY, candidate); }
    catch (_) { showToast("Could not save the host URL in this browser."); return; }

    renderApiConnectionPanel(`Connecting to ${candidate}…`);
    const connectButton = $("connectHostBtn");
    connectButton.disabled = true;
    try {
      await saveQueue.catch(() => undefined);
      const response = await hostRequest("/api/state", { method: "GET" });
      const saved = await response.json();

      if (isValidState(saved)) {
        const localHasWork = Boolean(state.updated || state.handoffs.length || state.incidents.length || Object.keys(state.checks || {}).length);
        const hostRecord = normalizeState(saved);
        if (localHasWork && JSON.stringify(normalizeState(state)) !== JSON.stringify(hostRecord)) {
          const continueLoading = window.confirm("The host already has a saved record. Loading it will replace the record currently open in this browser. Any browser-only changes will not be uploaded. Continue?");
          if (!continueLoading) {
            throw new Error("Connection cancelled; the host record was not loaded.");
          }
        }
        state = hostRecord;
      }

      serverStorageEnabled = true;
      hostConnectionProblem = false;
      fillEventFields();
      fillHandoffDraft();
      renderApp();
      if (!isValidState(saved)) {
        // First connection to an empty host: seed it with the open local record.
        saveState();
      } else {
        $("saveStatus").textContent = "Saved on host";
        $("saveStatus").className = "pill green";
      }
      renderApiConnectionPanel();
      showToast(isValidState(saved) ? "Connected. Loaded the host's saved record." : "Connected. Saved this record to the host.");
    } catch (error) {
      if (previousBase) {
        try { localStorage.setItem(API_BASE_KEY, previousBase); } catch (_) { /* best effort */ }
      } else {
        try { localStorage.removeItem(API_BASE_KEY); } catch (_) { /* best effort */ }
      }
      serverStorageEnabled = false;
      hostConnectionProblem = Boolean(error.hostUnavailable);
      $("saveStatus").textContent = hostConnectionProblem ? "Host unavailable · local only" : "Saved in this browser";
      $("saveStatus").className = hostConnectionProblem ? "pill red" : "pill green";
      renderApiConnectionPanel(error.message || "Could not connect. Check the URL, CORS origin setting, network access, and password.");
      showToast(error.message || "Could not connect to the host. Check the host URL and server configuration.");
      console.error("Could not connect to shared host storage.", error);
    } finally {
      connectButton.disabled = false;
    }
  }

  function disconnectFromHost() {
    if (window.BACKSTAGE_STATIC_SITE) {
      renderApiConnectionPanel(`This site must remain connected to ${FIXED_API_BASE_URL}; disconnecting is disabled.`);
      return;
    }
    if (!window.confirm("Disconnect this browser from shared host storage? Future edits will be saved only in this browser until you reconnect.")) return;
    try { localStorage.removeItem(API_BASE_KEY); } catch (_) { /* best effort */ }
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* best effort */ }
    serverStorageEnabled = false;
    hostConnectionProblem = false;
    $("saveStatus").textContent = "Saved in this browser";
    $("saveStatus").className = "pill green";
    renderApiConnectionPanel();
    showToast("Disconnected from shared host storage. This browser is now local-only.");
  }

  // ===========================================================================
  // SMALL HELPERS
  // ===========================================================================
  function escapeHtml(value) {
    const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value ?? "").replace(/[&<>"']/g, (character) => replacements[character]);
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function lockStaticSiteAfterHostFailure(message) {
    if (!window.BACKSTAGE_STATIC_SITE) return;
    serverStorageEnabled = false;
    hostConnectionProblem = true;
    reloadAfterLogin = true;
    clearAccountSession();
    document.body.classList.add("authPending");
    showLoginPage(message || "The required shared host is unavailable. Backstage is locked; browser-only mode is disabled.");
    renderApiConnectionPanel(message || "The required shared host is unavailable. Backstage is locked.");
  }

  function saveState(options = {}) {
    state.updated = Date.now();
    const localSnapshot = JSON.stringify(state);

    // The published site never saves event data as an alternate browser database.
    if (!window.BACKSTAGE_STATIC_SITE) {
      try {
        localStorage.setItem(STORAGE_KEY, localSnapshot);
      } catch (error) {
        console.warn("The local cache could not be updated; host storage may still work.", error);
      }
    }
    $("lastSaved").textContent = new Date(state.updated).toLocaleString();

    if (!serverStorageEnabled) {
      if (window.BACKSTAGE_STATIC_SITE) {
        $("saveStatus").textContent = "Host required · locked";
        $("saveStatus").className = "pill red";
        lockStaticSiteAfterHostFailure("The shared host is not connected. Backstage is locked; it will not save in this browser. Check the API and sign in again.");
        return Promise.resolve(false);
      }
      $("saveStatus").textContent = hostConnectionProblem ? "Host unavailable · local only" : "Saved in this browser";
      $("saveStatus").className = hostConnectionProblem ? "pill red" : "pill green";
      return Promise.resolve(true);
    }

    clearTimeout(saveTimer);
    saveTimer = null;
    $("saveStatus").textContent = "Saving to host…";
    $("saveStatus").className = "pill amber";

    // Button-driven actions can request an immediate, awaitable save. Typing
    // remains debounced so each keystroke does not become a separate write.
    if (options.immediate) return persistStateNow();
    saveTimer = setTimeout(() => { void persistStateNow(); }, 250);
    return Promise.resolve(true); // queued; callers requiring confirmation use immediate:true
  }

  async function persistStateNow() {
    clearTimeout(saveTimer);
    saveTimer = null;

    if (!serverStorageEnabled) {
      if (window.BACKSTAGE_STATIC_SITE) {
        lockStaticSiteAfterHostFailure("The required host is not connected. Backstage remains locked and will not save a browser-only copy.");
        return false;
      }
      return true;
    }

    // Snapshot each logical write and use If-Match so two technician tabs cannot
    // silently overwrite each other's newer work. The host increments revisions.
    const snapshotState = JSON.parse(JSON.stringify(state));
    const request = saveQueue.catch(() => undefined).then(() => {
      snapshotState.revision = serverRevision;
      return hostRequest("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "If-Match": `"${serverRevision}"` },
        body: JSON.stringify(snapshotState),
      });
    });
    saveQueue = request;

    try {
      const response = await request;
      const etagRevision = parseInt(String(response.headers.get("ETag") || "").replace(/[^0-9]/g, ""), 10);
      if (Number.isSafeInteger(etagRevision) && etagRevision >= 0) serverRevision = etagRevision;
      state.revision = serverRevision;
      hostConnectionProblem = false;
      $("saveStatus").textContent = "Saved on host";
      $("saveStatus").className = "pill green";
      return true;
    } catch (error) {
      hostConnectionProblem = true;
      $("saveStatus").textContent = "Host save failed";
      $("saveStatus").className = "pill red";
      console.error("Could not save to the host computer.", error);
      if (window.BACKSTAGE_STATIC_SITE) {
        lockStaticSiteAfterHostFailure("The required host save failed. Backstage is locked instead of switching to browser-only mode. Fix the host connection, then sign in again. Unsaved edits may not have reached the host.");
      } else {
        showToast("Host save failed. The browser cache is not shared—check the host connection and export a backup.");
      }
      return false;
    }
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return "Time not recorded";
    return new Date(timestamp).toLocaleString([], {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function eventTitle() {
    return state.event.name.trim() || "Untitled event";
  }

  function priorityClass(priority) {
    const configuredPriorities = state.settings?.incidentPriorities || [];
    const index = configuredPriorities.indexOf(priority);
    if (index >= 0) {
      if (index >= configuredPriorities.length - 2) return "red";
      if (index === configuredPriorities.length - 3) return "amber";
    }
    if (priority === "Urgent" || priority === "High") return "red";
    if (priority === "Needs attention" || priority === "Medium") return "amber";
    return "";
  }

  function renderTextBlock(label, value) {
    if (!String(value || "").trim()) return "";
    return `<div class="historyField"><strong>${escapeHtml(label)}</strong><div class="multiline">${escapeHtml(value)}</div></div>`;
  }

  // ===========================================================================
  // TECHNICIAN DIRECTORY AND ADMIN-MANAGED SHIFT SCHEDULE
  // ===========================================================================
  function setTechnicianDirectory(users) {
    technicianDirectory = (Array.isArray(users) ? users : [])
      .filter((user) => user && !user.disabled && user.username && user.displayName)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    renderIncomingTechnicianOptions(state.shiftDraft?.incoming || "");
    renderShiftScheduleTechnicianOptions();
    renderTimeSheet();
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeTechnicianSelection(value) {
    const requested = String(value || "").trim();
    if (!requested) return "";
    const byUsername = technicianDirectory.find((user) => user.username.toLowerCase() === requested.toLowerCase());
    if (byUsername) return byUsername.username;
    const byName = technicianDirectory.find((user) => user.displayName.toLowerCase() === requested.toLowerCase());
    return byName ? byName.username : "";
  }

  function renderIncomingTechnicianOptions(selectedValue = "", allowedUsernames = null) {
    const select = $("incomingTech");
    if (!select) return;
    const allowed = Array.isArray(allowedUsernames) ? new Set(allowedUsernames) : null;
    const listedUsers = technicianDirectory.filter((user) => !allowed || allowed.has(user.username));
    const selected = normalizeTechnicianSelection(selectedValue);
    const canLeaveUnassigned = !Array.isArray(allowedUsernames);
    select.innerHTML = [
      ...(canLeaveUnassigned ? ['<option value="">Unassigned / no incoming technician</option>'] : []),
      ...listedUsers.map((user) => `<option value="${escapeHtml(user.username)}">${escapeHtml(user.displayName)} (@${escapeHtml(user.username)})${user.role === "admin" ? " · Admin" : ""}</option>`),
    ].join("");
    select.value = selected && listedUsers.some((user) => user.username === selected) ? selected : "";
  }

  function renderShiftScheduleTechnicianOptions() {
    const select = $("scheduleTechnician");
    if (!select) return;
    const selected = select.value;
    select.innerHTML = [
      '<option value="">Choose a technician</option>',
      ...technicianDirectory.map((user) => `<option value="${escapeHtml(user.username)}">${escapeHtml(user.displayName)} (@${escapeHtml(user.username)})${user.role === "admin" ? " · Admin" : ""}</option>`),
    ].join("");
    select.value = technicianDirectory.some((user) => user.username === selected) ? selected : "";
  }

  async function refreshTechnicianDirectory() {
    const response = await hostRequest("/api/technicians", { method: "GET" });
    const payload = await readApiPayload(response);
    setTechnicianDirectory(Array.isArray(payload.technicians) ? payload.technicians : []);
  }

  function getScheduledShiftsForNextStart() {
    const date = String(state.shiftDraft.nextDate || state.event.date || "");
    const startTime = String(state.shiftDraft.nextStart || "");
    if (!date || !startTime) return [];
    return state.shiftSchedule
      .filter((shift) => shift.date === date && shift.startTime === startTime && technicianDirectory.some((user) => user.username === shift.technicianUsername))
      .sort((a, b) => String(a.technicianDisplayName || "").localeCompare(String(b.technicianDisplayName || "")));
  }

  function getScheduledShiftForNextStart() {
    return getScheduledShiftsForNextStart()[0] || null;
  }

  function updateIncomingScheduleHint(applySuggestion = false) {
    const hint = $("incomingTechHint");
    const select = $("incomingTech");
    if (!hint || !select) return;
    const scheduled = getScheduledShiftsForNextStart();
    if (scheduled.length) {
      const allowedNames = scheduled.map((shift) => shift.technicianDisplayName || shift.technicianUsername || "Scheduled technician");
      const allowedUsernames = scheduled.map((shift) => shift.technicianUsername).filter(Boolean);
      const currentUsername = normalizeTechnicianSelection(state.shiftDraft.incoming);
      const chosen = allowedUsernames.includes(currentUsername) ? currentUsername : allowedUsernames[0];
      if (chosen && state.shiftDraft.incoming !== chosen) {
        state.shiftDraft.incoming = chosen;
        if (applySuggestion) saveState();
      }
      renderIncomingTechnicianOptions(chosen || state.shiftDraft.incoming, allowedUsernames);
      select.value = allowedUsernames.includes(chosen) ? chosen : "";
      // One scheduled assignee is authoritative. If the admin assigned multiple
      // people for that exact shift start, allow selection only among those names.
      select.disabled = scheduled.length === 1;
      hint.textContent = scheduled.length === 1
        ? `Assigned by administrator: ${allowedNames[0]} (${scheduled[0].startTime}–${scheduled[0].endTime}). The timesheet controls this handoff target.`
        : `Administrator scheduled ${allowedNames.join(", ")}. Choose the incoming technician from these assigned accounts.`;
      hint.className = "helpText scheduleHint";
    } else {
      renderIncomingTechnicianOptions(state.shiftDraft.incoming);
      select.disabled = false;
      hint.textContent = "No scheduled technician matches this date/time. Choose an active incoming account, or ask an administrator to schedule the shift.";
      hint.className = "helpText scheduleHint mutedHint";
    }
  }

  function parseShiftDateTime(date, time) {
    if (!date || !time) return NaN;
    return new Date(`${date}T${time}:00`).getTime();
  }

  function compareShifts(a, b) {
    return `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`);
  }

  function getShiftStatus(shift, now = Date.now()) {
    const start = parseShiftDateTime(shift.date, shift.startTime);
    const end = parseShiftDateTime(shift.date, shift.endTime);
    if (Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end) return "on-duty";
    if (Number.isFinite(start) && start > now) return "upcoming";
    return "completed";
  }

  function formatShiftDate(date) {
    if (!date) return "Date not set";
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function formatShiftTime(time) {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return time || "—";
    const parsed = new Date(`${localDateString()}T${time}:00`);
    return Number.isNaN(parsed.getTime()) ? time : parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function getSortedShifts() {
    return [...(state.shiftSchedule || [])].sort(compareShifts);
  }

  function getCurrentOrNextShiftForUser(user = activeUser) {
    if (!user) return null;
    const now = Date.now();
    const own = getSortedShifts().filter((shift) => normalizeUsername(shift.technicianUsername) === normalizeUsername(user.username));
    const current = own.find((shift) => getShiftStatus(shift, now) === "on-duty");
    if (current) return current;
    // Let technicians prepare the checklist during the day before call, but don't
    // attach them to a far-future shift in place of today's actual assignment.
    const nextWithin36Hours = own.find((shift) => {
      const starts = parseShiftDateTime(shift.date, shift.startTime);
      return starts > now && starts - now <= 36 * 60 * 60 * 1000;
    });
    return nextWithin36Hours || null;
  }

  function getChecksForShift(shift = getCurrentOrNextShiftForUser()) {
    if (!shift) return {};
    const allShiftChecks = state.shiftChecks && typeof state.shiftChecks === "object" ? state.shiftChecks : {};
    const checks = allShiftChecks[shift.id];
    return checks && typeof checks === "object" ? checks : {};
  }

  function renderTimeSheet() {
    const list = $("timeSheetList");
    if (!list) return;
    renderShiftScheduleTechnicianOptions();
    const allShifts = getSortedShifts();
    const today = localDateString();
    const now = Date.now();
    const range = $("scheduleRangeFilter")?.value || "all";
    const query = String($("scheduleSearch")?.value || "").trim().toLowerCase();
    let shifts = allShifts.filter((shift) => {
      const status = getShiftStatus(shift, now);
      if (range === "today" && shift.date !== today) return false;
      if (range === "upcoming" && status === "completed") return false;
      if (range === "past" && status !== "completed") return false;
      if (query && ![shift.technicianDisplayName, shift.technicianUsername, shift.notes, shift.date].join(" ").toLowerCase().includes(query)) return false;
      return true;
    });
    const count = $("timeSheetCount");
    if (count) count.textContent = `${shifts.length} of ${allShifts.length} shifts`;
    if ($("scheduleNavCount")) $("scheduleNavCount").textContent = String(allShifts.length);
    if ($("scheduleShiftTotal")) $("scheduleShiftTotal").textContent = String(allShifts.length);
    if ($("scheduleTodayTotal")) $("scheduleTodayTotal").textContent = String(allShifts.filter((shift) => shift.date === today).length);
    const nextShift = allShifts.find((shift) => parseShiftDateTime(shift.date, shift.startTime) > now);
    if ($("scheduleNextWho")) $("scheduleNextWho").textContent = nextShift?.technicianDisplayName || "—";
    if (!shifts.length) {
      list.innerHTML = allShifts.length
        ? '<div class="empty"><strong>No shifts match those filters</strong>Change the date range or search term to see more of the call sheet.</div>'
        : '<div class="empty"><strong>No shifts scheduled</strong>An administrator can assign coverage for this event.</div>';
      updateIncomingScheduleHint(false);
      renderOperationsBoard();
      return;
    }
    list.innerHTML = shifts.map((shift) => {
      const activeAssignedUser = technicianDirectory.some((user) => user.username === shift.technicianUsername);
      const technician = `${shift.technicianDisplayName || shift.technicianUsername || "Unassigned"}${activeAssignedUser ? "" : " · inactive account"}`;
      const status = getShiftStatus(shift, now);
      const statusLabel = status === "on-duty" ? "On duty" : status === "upcoming" ? "Up next" : "Completed";
      const isMine = normalizeUsername(shift.technicianUsername) === normalizeUsername(activeUser?.username);
      return `<article class="scheduledShiftRow ${status === "on-duty" ? "shiftCurrent" : ""} ${isMine ? "shiftMine" : ""}" data-shift-row="${escapeHtml(shift.id)}">
        <div class="scheduledShiftWhen"><strong>${escapeHtml(formatShiftDate(shift.date))}</strong><span>${escapeHtml(formatShiftTime(shift.startTime))}–${escapeHtml(formatShiftTime(shift.endTime))}</span></div>
        <div class="scheduledShiftWho"><strong>${escapeHtml(technician)}${isMine ? ' <span class="youMarker">You</span>' : ""}</strong><small>@${escapeHtml(shift.technicianUsername || "unassigned")}${shift.notes ? ` · ${escapeHtml(shift.notes)}` : ""}</small></div>
        <span class="shiftStatus ${status}">${statusLabel}</span>
        ${isAdmin() ? `<button type="button" class="btn small danger" data-delete-scheduled-shift="${escapeHtml(shift.id)}">Remove</button>` : ""}
      </article>`;
    }).join("");
    updateIncomingScheduleHint(false);
    renderOperationsBoard();
  }

  async function addScheduledShift(event) {
    event.preventDefault();
    if (!isAdmin()) return showToast("Only administrators can manage the shift schedule.");
    const date = $("scheduleDate").value;
    const startTime = $("scheduleStart").value;
    const endTime = $("scheduleEnd").value;
    const username = $("scheduleTechnician").value;
    const notes = $("scheduleNotes").value.trim();
    const person = technicianDirectory.find((user) => user.username === username && !user.disabled);
    if (!date || !startTime || !endTime || !person) return showToast("Choose a date, start/end time, and active technician.");
    if (endTime <= startTime) return showToast("End time must be later than start time. Split overnight shifts across two entries.");
    const overlaps = state.shiftSchedule.some((shift) => shift.date === date && shift.technicianUsername === username && startTime < shift.endTime && shift.startTime < endTime);
    if (overlaps) return showToast("That technician already has an overlapping shift on this date.");
    state.shiftSchedule.push({
      id: createId(), date, startTime, endTime,
      technicianUserId: person.id, technicianUsername: person.username, technicianDisplayName: person.displayName,
      notes, createdAt: Date.now(), createdBy: { id: activeUser.id, username: activeUser.username, displayName: activeUser.displayName },
    });
    renderTimeSheet();
    const saved = await saveState({ immediate: true });
    if (!saved) return;
    event.target.reset();
    $("scheduleDate").value = state.event.date || localDateString();
    renderShiftScheduleTechnicianOptions();
    showToast(`Scheduled ${person.displayName} for ${date} ${startTime}–${endTime}.`);
    if (state.shiftDraft.nextDate === date && state.shiftDraft.nextStart === startTime) {
      state.shiftDraft.incoming = person.username;
      renderIncomingTechnicianOptions(person.username);
      $("incomingTech").value = person.username;
      updateIncomingScheduleHint(false);
      await saveState({ immediate: true });
    }
  }

  async function removeScheduledShift(id) {
    if (!isAdmin()) return showToast("Only administrators can manage the shift schedule.");
    const shift = state.shiftSchedule.find((entry) => entry.id === id);
    if (!shift) return;
    if (!window.confirm(`Remove ${shift.technicianDisplayName || shift.technicianUsername}'s scheduled shift on ${shift.date} (${shift.startTime}–${shift.endTime})?`)) return;
    state.shiftSchedule = state.shiftSchedule.filter((entry) => entry.id !== id);
    if (state.shiftChecks) delete state.shiftChecks[id];
    renderTimeSheet();
    if (await saveState({ immediate: true })) showToast("Scheduled shift removed.");
  }

  // ===========================================================================
  // DYNAMIC OPTIONS — edited from the Customize page
  // ===========================================================================
  function setSelectOptions(select, values, selectedValue, includeAll = false) {
    const options = includeAll ? ["all", ...values] : values;
    select.innerHTML = options.map((value) => {
      let label = value;
      if (value === "all") label = "All priorities";
      return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join("");
    select.value = options.includes(selectedValue) ? selectedValue : (includeAll ? "all" : options[0]);
  }

  function renderDynamicOptions() {
    const settings = state.settings || (state.settings = cloneDefaultSettings());
    const currentPhase = String(state.event.status || "");
    const phase = settings.eventPhases.includes(currentPhase)
      ? currentPhase
      : (isAdmin() ? settings.eventPhases[0] : (currentPhase || settings.eventPhases[0]));
    if (isAdmin()) state.event.status = phase;
    const phaseOptions = settings.eventPhases.includes(phase) ? settings.eventPhases : [phase, ...settings.eventPhases];
    setSelectOptions($("eventStatus"), phaseOptions, phase);

    if (!settings.handoffPriorities.includes(state.shiftDraft.priority)) {
      state.shiftDraft.priority = settings.handoffPriorities[0];
    }
    setSelectOptions($("handoffPriority"), settings.handoffPriorities, state.shiftDraft.priority);

    const currentCategory = $("incidentCategory").value;
    const category = settings.incidentCategories.includes(currentCategory) ? currentCategory
      : (settings.incidentCategories.includes("Technical / equipment") ? "Technical / equipment" : settings.incidentCategories[0]);
    setSelectOptions($("incidentCategory"), settings.incidentCategories, category);

    const currentPriority = $("incidentSeverity").value;
    const incidentPriority = settings.incidentPriorities.includes(currentPriority) ? currentPriority
      : (settings.incidentPriorities.includes("Medium") ? "Medium" : settings.incidentPriorities[0]);
    setSelectOptions($("incidentSeverity"), settings.incidentPriorities, incidentPriority);

    const filterPriority = $("incidentPriorityFilter").value || "all";
    setSelectOptions($("incidentPriorityFilter"), settings.incidentPriorities, filterPriority, true);
  }

  // ===========================================================================
  // SHARED EVENT DETAILS AND DRAFT AUTOSAVE
  // ===========================================================================
  function updateEventSummary() {
    const summary = $("eventSummaryText");
    if (!summary) return;
    const name = String($("eventName")?.value || state.event.name || "").trim();
    const date = String($("eventDate")?.value || state.event.date || "").trim();
    const phase = String($("eventStatus")?.value || state.event.status || "").trim();
    if (!name) {
      summary.textContent = isAdmin()
        ? "Set the active event here. Event details, handoffs, and incident reports stay attached to that event workspace."
        : "No active event has been set by an administrator yet. Contact an administrator before logging shift details.";
      return;
    }
    const dateLabel = date
      ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "Date not set";
    summary.textContent = [name, dateLabel, phase].filter(Boolean).join(" · ");
  }

  function fillEventFields() {
    renderDynamicOptions();
    Object.entries(eventFieldMap).forEach(([elementId, stateKey]) => {
      $(elementId).value = state.event[stateKey] ?? "";
    });
    updateEventSummary();
    updateEventEditPermissions();
  }

  function normalizeTimeInput(value) {
    const raw = String(value || "").trim();
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw)) return raw;
    const match = /^(\d{1,2})(?::([0-5]\d))?\s*(AM|PM)$/i.exec(raw);
    if (!match) return "";
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
    return `${String(hour).padStart(2, "0")}:${match[2] || "00"}`;
  }

  function fillHandoffDraft() {
    renderDynamicOptions();
    if (!state.shiftDraft.nextDate) state.shiftDraft.nextDate = state.event.date || localDateString();
    state.shiftDraft.shiftEnd = normalizeTimeInput(state.shiftDraft.shiftEnd);
    state.shiftDraft.nextStart = normalizeTimeInput(state.shiftDraft.nextStart);
    state.shiftDraft.outgoing = activeUser?.displayName || "";
    state.shiftDraft.incoming = normalizeTechnicianSelection(state.shiftDraft.incoming);
    Object.entries(handoffFieldMap).forEach(([elementId, stateKey]) => {
      const field = $(elementId);
      if (!field) return;
      if (elementId === "outgoingTech") {
        field.value = activeUser?.displayName || "";
        field.readOnly = true;
        return;
      }
      if (elementId === "incomingTech") {
        renderIncomingTechnicianOptions(state.shiftDraft.incoming);
        field.value = state.shiftDraft.incoming;
        return;
      }
      field.value = state.shiftDraft[stateKey] ?? "";
    });
    updateIncomingScheduleHint(true);
    if ($("scheduleDate") && !$("scheduleDate").value) $("scheduleDate").value = state.event.date || localDateString();
  }

  function bindAutoSaveFields(fieldMap, targetObjectName) {
    Object.entries(fieldMap).forEach(([elementId, stateKey]) => {
      const field = $(elementId);
      const eventName = field.tagName === "SELECT" ? "change" : "input";
      field.addEventListener(eventName, () => {
        state[targetObjectName][stateKey] = field.value;
        saveState();
        if (targetObjectName === "event") {
          updateEventSummary();
          renderOperationsBoard();
          if (isAdmin()) {
            syncCurrentEventMetadata();
            renderVenueEvents();
          }
        }
        if (targetObjectName === "shiftDraft") {
          $("handoffDraftState").textContent = "Draft autosaved";
          $("handoffDraftState").className = "pill";
        }
      });
    });
  }

  // ===========================================================================
  // HANDOFF HISTORY
  // Each saved entry is a snapshot of the draft and event phase at that moment.
  // ===========================================================================
  async function saveHandoff() {
    const draft = state.shiftDraft;
    const outgoingName = activeUser?.displayName || "";
    const incomingUser = technicianDirectory.find((user) => user.username === draft.incoming && !user.disabled);
    if (!String(state.event.name || "").trim()) {
      showToast("No active event has been assigned. Ask an administrator to set the current event before saving a handoff.");
      return;
    }
    if (!activeUser || !outgoingName || !draft.summary.trim() || !draft.nextActions.trim()) {
      showToast("Add the current situation and next shift priorities first. Your signed-in account is recorded automatically.");
      const requiredField = !draft.summary.trim() ? "currentStatus" : "nextActions";
      $(requiredField).focus();
      return;
    }

    const entry = {
      id: createId(),
      savedAt: Date.now(),
      event: { ...state.event },
      ...draft,
      outgoing: outgoingName,
      outgoingUsername: activeUser.username,
      outgoingUserId: activeUser.id,
      incoming: incomingUser?.displayName || "",
      incomingUsername: incomingUser?.username || "",
      incomingUserId: incomingUser?.id || "",
      nextDate: draft.nextDate || state.event.date || localDateString(),
      createdBy: { username: activeUser.username, displayName: activeUser.displayName, id: activeUser.id },
      eventId: state.eventId,
      reviewed: false,
      reviewedBy: "",
      reviewedAt: null,
    };
    state.handoffs.unshift(entry);
    renderHandoffs();
    const saved = await saveState({ immediate: true });
    if (!saved) return;
    $("handoffDraftState").textContent = "Saved to history";
    $("handoffDraftState").className = "pill green";
    showToast("Handoff saved to the shared host. It has not sent a notification to anyone.");
  }

  function renderHandoffCard(entry) {
    const priority = entry.priority || "Routine";
    const status = entry.event?.status || "Phase not recorded";
    const recipient = entry.incoming?.trim()
      ? `${entry.incoming}${entry.incomingUsername ? ` (@${entry.incomingUsername})` : ""}`
      : "No incoming technician assigned";
    const acknowledgement = entry.reviewed
      ? `<span class="ackStatus">✓ Read by ${escapeHtml(entry.reviewedBy || "incoming technician")}${entry.reviewedByUsername ? ` (@${escapeHtml(entry.reviewedByUsername)})` : ""} · ${escapeHtml(formatDateTime(entry.reviewedAt))}</span>`
      : `<span class="pill amber">Not acknowledged</span>`;
    const body = [
      renderTextBlock("Current situation", entry.summary),
      renderTextBlock("Completed this shift", entry.completed),
      renderTextBlock("Outstanding tasks / blockers", entry.openTasks),
      renderTextBlock("Equipment / room status", entry.equipment),
      renderTextBlock("Communications", entry.communications),
      renderTextBlock("Next shift priorities", entry.nextActions),
      renderTextBlock("Additional notes", entry.notes),
    ].filter(Boolean).join("");

    return `
      <article class="historyCard">
        <div class="historyTop">
          <div>
            <div class="historyWho">${escapeHtml(entry.outgoing || "Technician not named")} → ${escapeHtml(recipient)}</div>
            <div class="historyMeta">Saved ${escapeHtml(formatDateTime(entry.savedAt))} · ${escapeHtml(entry.event?.name || "Untitled event")} · ${escapeHtml(entry.event?.spaces || "Spaces not listed")}</div>
            ${entry.createdBy?.displayName ? `<div class="historyMeta">Recorded by ${escapeHtml(entry.createdBy.displayName)} (@${escapeHtml(entry.createdBy.username || "unknown")})</div>` : ""}
            <div class="historyMeta">Shift ended: ${escapeHtml(entry.shiftEnd || "Not given")} · Next shift: ${escapeHtml([entry.nextDate, entry.nextStart].filter(Boolean).join(" ") || "Not scheduled")} · Event phase: ${escapeHtml(status)}</div>
          </div>
          <span class="pill ${priorityClass(priority)}">${escapeHtml(priority)}</span>
        </div>
        <div class="historyBody">${body || "<div class=\"multiline\">No extra handoff notes recorded.</div>"}</div>
        <div class="historyActions">
          ${acknowledgement}
          <span style="flex:1"></span>
          <button type="button" class="btn small" data-load-handoff="${escapeHtml(entry.id)}">Load into draft</button>
          <button type="button" class="btn small" data-ack-handoff="${escapeHtml(entry.id)}">${entry.reviewed ? "Undo acknowledgement" : "Acknowledge read"}</button>
          ${isAdmin() ? `<button type="button" class="btn small danger" data-delete-handoff="${escapeHtml(entry.id)}">Delete</button>` : ""}
        </div>
      </article>
    `;
  }

  function renderHandoffs() {
    const entries = [...state.handoffs].sort((a, b) => b.savedAt - a.savedAt);
    $("handoffNavCount").textContent = entries.length;
    $("handoffHistoryCount").textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
    $("handoffHistory").innerHTML = entries.length
      ? entries.map(renderHandoffCard).join("")
      : `<div class="empty"><strong>No handoffs saved yet</strong>Save a handoff above to start a running shift history for this event.</div>`;
    renderOperationsBoard();
  }

  async function loadHandoffIntoDraft(id) {
    const entry = state.handoffs.find((handoff) => handoff.id === id);
    if (!entry) return;
    Object.keys(state.shiftDraft).forEach((key) => {
      if (typeof entry[key] !== "undefined") state.shiftDraft[key] = entry[key];
    });
    state.shiftDraft.outgoing = activeUser?.displayName || "";
    state.shiftDraft.incoming = entry.incomingUsername || "";
    state.shiftDraft.nextDate = entry.nextDate || state.event.date || localDateString();
    fillHandoffDraft();
    const saved = await saveState({ immediate: true });
    if (!saved) return;
    $("handoffDraftState").textContent = "Loaded from history";
    switchView("handoff");
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Handoff loaded into the draft. Saving it again creates a new history entry.");
  }

  async function toggleHandoffAcknowledgement(id) {
    const entry = state.handoffs.find((handoff) => handoff.id === id);
    if (!entry) return;

    if (entry.reviewed) {
      const confirmed = window.confirm("Clear this acknowledgement? The handoff entry will remain in history.");
      if (!confirmed) return;
      entry.reviewed = false;
      entry.reviewedBy = "";
      entry.reviewedByUsername = "";
      entry.reviewedAt = null;
    } else {
      entry.reviewed = true;
      entry.reviewedBy = activeUser?.displayName || "Signed-in technician";
      entry.reviewedByUsername = activeUser?.username || "";
      entry.reviewedAt = Date.now();
    }

    renderHandoffs();
    const saved = await saveState({ immediate: true });
    if (saved) showToast(entry.reviewed ? "Handoff acknowledgement saved." : "Handoff acknowledgement updated.");
  }

  // ===========================================================================
  // STAGE-MANAGEMENT OPERATIONS BOARD
  // ===========================================================================
  function formatBoardDateTime(date, time) {
    if (!date || !time) return "Time not set";
    const stamp = new Date(`${date}T${time}:00`);
    if (Number.isNaN(stamp.getTime())) return `${date} ${time}`;
    const day = stamp.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return `${day} · ${stamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  function renderOperationsBoard(refreshRelated = true) {
    if (!$("view-operations")) return;
    const eventName = String(state.event?.name || "").trim();
    const now = Date.now();
    const shifts = getSortedShifts();
    const currentShifts = shifts.filter((shift) => getShiftStatus(shift, now) === "on-duty");
    const nextShift = shifts.find((shift) => parseShiftDateTime(shift.date, shift.startTime) > now);
    const myShift = getCurrentOrNextShiftForUser();
    const progress = getChecklistProgress(myShift);
    const percentage = progress.total ? Math.round(progress.completed / progress.total * 100) : 0;
    const open = [...state.incidents].filter((incident) => !incident.resolved).sort((a, b) => (b.created || 0) - (a.created || 0));
    const urgentValues = (state.settings?.incidentPriorities || []).slice(-2);
    const urgentCount = open.filter((incident) => urgentValues.includes(incident.priority || incident.severity) || ["High", "Urgent"].includes(incident.priority || incident.severity)).length;
    const today = localDateString();

    $("boardEventName").textContent = eventName || "No event assigned";
    $("boardEventMeta").textContent = eventName
      ? [state.event.date ? formatShiftDate(state.event.date) : "Date not set", state.event.spaces, state.event.lead ? `Lead: ${state.event.lead}` : ""].filter(Boolean).join(" · ")
      : "Ask an administrator to select an active event and set the crew call sheet.";
    $("boardEventPhase").textContent = eventName ? (state.event.status || "Phase not set") : "Awaiting event";
    $("boardMyShiftStatus").textContent = myShift ? (getShiftStatus(myShift, now) === "on-duty" ? "On duty" : "Next assigned shift") : "No shift assigned";
    $("boardMyShiftStatus").className = `pill ${myShift ? "green" : "amber"}`;
    $("boardUpdatedAt").textContent = state.updated ? `Host record updated ${new Date(state.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Host record initialized";
    $("metricOnDuty").textContent = String(currentShifts.length);
    $("metricOnDutyNote").textContent = currentShifts.length ? currentShifts.map((shift) => shift.technicianDisplayName || shift.technicianUsername).join(", ") : "No one scheduled right now";
    $("metricNextOnDeck").textContent = nextShift ? (nextShift.technicianDisplayName || nextShift.technicianUsername || "Assigned technician") : "—";
    $("metricNextTime").textContent = nextShift ? formatBoardDateTime(nextShift.date, nextShift.startTime) : "No future shift scheduled";
    $("metricOpenIncidents").textContent = String(open.length);
    $("metricUrgentIncidents").textContent = urgentCount ? `${urgentCount} high / urgent require follow-up` : "No high-priority open items";
    $("metricChecklistProgress").textContent = `${percentage}%`;
    $("metricChecklistNote").textContent = myShift ? `${progress.completed} of ${progress.total} tasks for your shift` : "Waiting for a shift assignment";

    const visibleCrew = shifts.filter((shift) => {
      const end = parseShiftDateTime(shift.date, shift.endTime);
      const start = parseShiftDateTime(shift.date, shift.startTime);
      return (end >= now || start >= now) && start <= now + 7 * 24 * 60 * 60 * 1000;
    }).slice(0, 6);
    const crewList = $("boardCrewList");
    crewList.innerHTML = visibleCrew.length ? visibleCrew.map((shift) => {
      const status = getShiftStatus(shift, now);
      const isMine = normalizeUsername(shift.technicianUsername) === normalizeUsername(activeUser?.username);
      return `<div class="boardCrewRow ${status === "on-duty" ? "isOnDuty" : ""}">
        <div class="boardCrewTime"><strong>${escapeHtml(formatShiftTime(shift.startTime))}</strong><small>${escapeHtml(shift.date === today ? "Today" : formatShiftDate(shift.date))}</small></div>
        <div class="boardCrewInfo"><strong>${escapeHtml(shift.technicianDisplayName || shift.technicianUsername || "Unassigned")}${isMine ? ' <span class="youMarker">You</span>' : ""}</strong><small>${escapeHtml(shift.notes || "General coverage")}</small></div>
        <span class="shiftStatus ${status}">${status === "on-duty" ? "On duty" : status === "upcoming" ? "Up next" : "Done"}</span>
      </div>`;
    }).join("") : '<div class="empty"><strong>No upcoming crew shifts</strong>The administrator timesheet will appear here when coverage is assigned.</div>';

    const myShiftNode = $("boardMyShift");
    if (!myShift) {
      myShiftNode.innerHTML = `<div class="boardEmpty"><div class="boardEmptyIcon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><div><strong>No shift assigned to ${escapeHtml(activeUser?.displayName || "this account")}</strong><p>Ask an administrator to add you to the timesheet. Your check-in checklist opens automatically when you have an assigned shift.</p></div></div>`;
      $("boardMyShiftSub").textContent = "Your assignment and arrival checklist";
    } else {
      const status = getShiftStatus(myShift, now);
      myShiftNode.innerHTML = `<div class="myShiftCall"><span class="overline">${status === "on-duty" ? "Current shift" : "Next assignment"}</span><strong>${escapeHtml(formatShiftDate(myShift.date))}</strong><div class="myShiftTime">${escapeHtml(formatShiftTime(myShift.startTime))}–${escapeHtml(formatShiftTime(myShift.endTime))}</div><p>${escapeHtml(myShift.notes || "General technician coverage")}</p><div class="myShiftProgress"><div><span>Shift checklist</span><b>${progress.completed}/${progress.total}</b></div><div class="progress"><span style="width:${percentage}%"></span></div></div><button type="button" class="btn primary" data-view="checklist">Continue checklist</button></div>`;
      $("boardMyShiftSub").textContent = `${status === "on-duty" ? "Currently assigned" : "Next scheduled"} · checklist progress is shift-specific`;
    }

    $("boardIncidentList").innerHTML = open.length ? open.slice(0, 4).map((incident) => `<button type="button" class="boardCompactItem" data-view="incidents"><span class="priorityMark ${priorityClass(incident.priority || incident.severity)}"></span><span class="boardCompactCopy"><strong>${escapeHtml(incident.title || "Untitled incident")}</strong><small>${escapeHtml(incident.category || "Other")} · ${escapeHtml(incident.location || "Location not set")} · ${escapeHtml(incident.createdBy?.displayName || incident.reportedBy || "Technician")}</small></span><span class="incidentPriority ${priorityClass(incident.priority || incident.severity)}">${escapeHtml(incident.priority || incident.severity || "Medium")}</span></button>`).join("") : '<div class="empty"><strong>No open incidents</strong>New technical issues and hazards will appear here.</div>';

    const latestHandoffs = [...state.handoffs].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 4);
    $("boardHandoffList").innerHTML = latestHandoffs.length ? latestHandoffs.map((entry) => `<button type="button" class="boardCompactItem" data-view="handoff"><span class="handoffStamp"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg></span><span class="boardCompactCopy"><strong>${escapeHtml(entry.outgoing || entry.createdBy?.displayName || "Technician")} <span aria-hidden="true">→</span> ${escapeHtml(entry.incoming || "Next shift unassigned")}</strong><small>${escapeHtml(formatDateTime(entry.savedAt))} · ${escapeHtml(entry.summary || "No status summary")}</small></span><span class="incidentPriority ${priorityClass(entry.priority)}">${escapeHtml(entry.priority || "Routine")}</span></button>`).join("") : '<div class="empty"><strong>No handoffs yet</strong>Saved shift changes will be listed here.</div>';

    if (refreshRelated) {
      // Metrics share these renderers; they are deliberately kept in one place
      // so a save, incident resolution, or timesheet edit updates the dashboard.
      if ($("scheduleNextWho")) $("scheduleNextWho").textContent = nextShift?.technicianDisplayName || "—";
    }
  }

  // ===========================================================================
  // TECHNICIAN CHECKLIST
  // ===========================================================================
  function getChecklistProgress(shift = getCurrentOrNextShiftForUser()) {
    let total = 0;
    let completed = 0;
    const checks = getChecksForShift(shift);
    getChecklistSections().forEach((section) => section.items.forEach((item) => {
      total += 1;
      if (checks[item.id]) completed += 1;
    }));
    return { total, completed };
  }

  function renderChecklist() {
    const shift = getCurrentOrNextShiftForUser();
    const checks = getChecksForShift(shift);
    const hasEvent = Boolean(String(state.event?.name || "").trim());
    const canCheck = Boolean(shift && hasEvent);
    const context = $("checklistShiftContext");
    if (context) {
      if (!hasEvent) {
        context.innerHTML = '<strong>Waiting for event assignment</strong><span>An administrator must set the current event before shift work can be recorded.</span>';
        context.className = "checklistContext warning";
      } else if (!shift) {
        context.innerHTML = '<strong>No shift assigned to your account</strong><span>Ask an administrator to add you to the crew schedule. Your checklist progress is tracked separately for each assigned shift.</span>';
        context.className = "checklistContext warning";
      } else {
        const status = getShiftStatus(shift);
        context.innerHTML = `<strong>${status === "on-duty" ? "You are on the clock" : "Your next scheduled shift"} · ${escapeHtml(formatShiftDate(shift.date))}</strong><span>${escapeHtml(formatShiftTime(shift.startTime))}–${escapeHtml(formatShiftTime(shift.endTime))} · ${escapeHtml(shift.notes || "General technician call")} · Tasks are defined by an administrator and saved for this shift only.</span>`;
        context.className = "checklistContext";
      }
    }

    $("checklistGrid").innerHTML = getChecklistSections().map((section) => {
      const completed = section.items.filter((item) => checks[item.id]).length;
      const percent = section.items.length ? (completed / section.items.length) * 100 : 0;
      const items = section.items.map((item) => `
        <label class="checkitem ${checks[item.id] ? "done" : ""} ${canCheck ? "" : "checkDisabled"}">
          <input type="checkbox" data-check="${escapeHtml(item.id)}" ${shift ? `data-shift-id="${escapeHtml(shift.id)}"` : ""} ${checks[item.id] ? "checked" : ""} ${canCheck ? "" : "disabled"}>
          <span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.help)}</small></span>
        </label>
      `).join("");
      return `
        <article class="card checkCard">
          <div class="checkHeader"><div><h3>${escapeHtml(section.title)}</h3><div class="checkDesc">${escapeHtml(section.description)}</div></div><span class="count">${completed} / ${section.items.length}</span></div>
          <div class="progress"><span style="width:${percent}%"></span></div>
          ${items || '<div class="empty">No checklist tasks in this section.</div>'}
        </article>
      `;
    }).join("");

    const progress = getChecklistProgress(shift);
    const percent = progress.total ? progress.completed / progress.total * 100 : 0;
    $("overallProgress").textContent = `${progress.completed} / ${progress.total}`;
    $("overallProgressBar").style.width = `${percent}%`;
    $("checkNavCount").textContent = `${Math.round(percent)}%`;
    if ($("metricChecklistProgress")) $("metricChecklistProgress").textContent = `${Math.round(percent)}%`;
    if ($("metricChecklistNote")) $("metricChecklistNote").textContent = shift ? `${progress.completed} of ${progress.total} tasks complete for your shift` : "Waiting for admin schedule assignment";
    renderOperationsBoard(false);
  }

  // ===========================================================================
  // IN-APP CUSTOMIZATION
  // ===========================================================================
  function renderEditableOptionList(containerId, settingsKey) {
    const values = state.settings[settingsKey];
    $(containerId).innerHTML = values.map((value, index) => `
      <div class="editableOption">
        <input class="field" aria-label="${escapeHtml(settingsKey)} option ${index + 1}" maxlength="100"
          data-option-key="${escapeHtml(settingsKey)}" data-option-index="${index}" value="${escapeHtml(value)}">
        <button type="button" class="btn danger small" data-remove-option-key="${escapeHtml(settingsKey)}" data-remove-option-index="${index}" aria-label="Remove ${escapeHtml(value)}">Remove</button>
      </div>
    `).join("");
  }

  function renderChecklistSettings() {
    const sections = getChecklistSections();
    $("checklistSettings").innerHTML = sections.length ? sections.map((section) => `
      <article class="card settingsSection" data-settings-section="${escapeHtml(section.id)}">
        <div class="settingsSectionHead"><div><span class="eyebrow">Checklist section</span><p class="settingsHint">Changes save when you leave a field.</p></div><button type="button" class="btn danger small" data-delete-section="${escapeHtml(section.id)}">Delete section</button></div>
        <div class="fields twoCols settingsSectionFields">
          <div class="fieldgroup"><label class="label">Section name</label><input class="field" maxlength="100" required data-section-field="title" data-section-id="${escapeHtml(section.id)}" value="${escapeHtml(section.title)}"></div>
          <div class="fieldgroup"><label class="label">Description</label><input class="field" maxlength="240" data-section-field="description" data-section-id="${escapeHtml(section.id)}" value="${escapeHtml(section.description)}"></div>
        </div>
        <div class="settingsTaskList">
          ${section.items.map((item, index) => `
            <div class="settingsTask" data-settings-task="${escapeHtml(item.id)}">
              <div class="settingsTaskNumber">${index + 1}</div>
              <div class="settingsTaskFields">
                <div class="fieldgroup"><label class="label">Task</label><input class="field" required maxlength="180" data-task-field="label" data-section-id="${escapeHtml(section.id)}" data-task-id="${escapeHtml(item.id)}" value="${escapeHtml(item.label)}"></div>
                <div class="fieldgroup"><label class="label">Instructions / detail</label><textarea class="compactText" maxlength="500" data-task-field="help" data-section-id="${escapeHtml(section.id)}" data-task-id="${escapeHtml(item.id)}">${escapeHtml(item.help)}</textarea></div>
              </div>
              <button type="button" class="btn danger small settingsRemoveTask" data-delete-task="${escapeHtml(item.id)}" data-section-id="${escapeHtml(section.id)}">Remove task</button>
            </div>
          `).join("")}
        </div>
        <form class="addTaskForm" data-add-task-to="${escapeHtml(section.id)}">
          <input class="field" name="label" required maxlength="180" placeholder="New checklist task">
          <input class="field" name="help" maxlength="500" placeholder="Instructions / helpful detail (optional)">
          <button class="btn primary small" type="submit">Add task</button>
        </form>
      </article>
    `).join("") : `<div class="empty"><strong>No checklist sections</strong>Add a section below to build your technician checklist.</div>`;

    renderEditableOptionList("eventPhasesList", "eventPhases");
    renderEditableOptionList("incidentCategoriesList", "incidentCategories");
    renderEditableOptionList("incidentPrioritiesList", "incidentPriorities");
    renderEditableOptionList("handoffPrioritiesList", "handoffPriorities");
  }

  // ===========================================================================
  // VENUE OPERATIONS: event catalogue, spaces, equipment, and service requests.
  // Event workspaces are snapshotted into their catalogue entry before switching
  // so each event retains its own crew, checklist, handoff, and incident history.
  // ===========================================================================
  function getActiveVenueEvent() {
    return (state.venue?.events || []).find((event) => event.id === state.venue?.activeEventId) || null;
  }

  function roomName(roomId) {
    return (state.venue?.rooms || []).find((room) => room.id === roomId)?.name || "Unassigned space";
  }

  function equipmentName(equipmentId) {
    return (state.venue?.equipment || []).find((item) => item.id === equipmentId)?.name || "Unspecified equipment";
  }

  function snapshotActiveVenueEvent() {
    const active = getActiveVenueEvent();
    if (!active) return;
    const updated = makeVenueEventFromState(state, active.id, active);
    state.venue.events = state.venue.events.map((event) => event.id === active.id ? updated : event);
  }

  function syncCurrentEventMetadata() {
    const active = getActiveVenueEvent();
    if (!active) return;
    const next = makeVenueEventFromState({ event: state.event }, active.id, active);
    state.venue.events = state.venue.events.map((event) => event.id === active.id ? next : event);
    renderVenueSelector();
  }

  function loadVenueEventIntoWorkspace(record) {
    if (!record) return;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(record.date || ""))) {
      const eventDate = new Date(`${record.date}T12:00:00`);
      venueCalendarMonth = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1);
      venueCalendarInitialized = true;
    }
    const workspace = record.workspace || {};
    state.venue.activeEventId = record.id;
    state.event = {
      name: record.name || "", date: record.date || localDateString(),
      status: record.phase || state.settings.eventPhases[0] || "Prepping / load-in",
      spaces: record.spaces || (record.roomId ? roomName(record.roomId) : ""),
      lead: record.lead || "", contact: record.contact || "", schedule: record.schedule || record.technicalNotes || "",
    };
    state.checks = JSON.parse(JSON.stringify(workspace.checks || {}));
    state.shiftChecks = JSON.parse(JSON.stringify(workspace.shiftChecks || {}));
    state.handoffs = JSON.parse(JSON.stringify(workspace.handoffs || []));
    state.incidents = JSON.parse(JSON.stringify(workspace.incidents || []));
    state.shiftSchedule = JSON.parse(JSON.stringify(workspace.shiftSchedule || []));
    state.shiftDraft = createBlankState().shiftDraft;
    state.shiftDraft.priority = state.settings.handoffPriorities[0] || "Routine";
    fillEventFields();
    fillHandoffDraft();
    renderApp();
    updateSessionIdentity();
    renderVenueSelector();
  }

  async function activateVenueEvent(eventId) {
    if (!isAdmin()) return showToast("Only administrators can switch the active event workspace.");
    const record = (state.venue.events || []).find((event) => event.id === eventId);
    if (!record) return showToast("That booking could not be found.");
    if (record.id === state.venue.activeEventId) {
      switchView("operations");
      return;
    }
    snapshotActiveVenueEvent();
    loadVenueEventIntoWorkspace(record);
    switchView("operations");
    const saved = await saveState({ immediate: true });
    if (saved) showToast(`Active workspace changed to ${record.name}. Its event history is kept separately.`);
  }

  function renderVenueSelector() {
    const select = $("activeEventSelect");
    if (!select) return;
    const events = [...(state.venue?.events || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.name).localeCompare(String(b.name)));
    const activeId = state.venue?.activeEventId || "";
    select.innerHTML = `<option value="">No event selected</option>${events.map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.name)} · ${escapeHtml(event.date || "Date TBD")}</option>`).join("")}`;
    select.value = activeId;
    select.disabled = !isAdmin();
    select.title = isAdmin() ? "Switch the shared active event workspace" : "The active workspace is selected by an administrator";
  }

  function fillVenueRoomOptions() {
    const roomFields = ["bookingRoom", "equipmentRoom", "maintenanceRoom"];
    roomFields.forEach((id) => {
      const select = $(id);
      if (!select) return;
      const previous = select.multiple ? [...select.selectedOptions].map((option) => option.value) : [select.value];
      const emptyLabel = id === "bookingRoom" ? "No room assigned" : id === "equipmentRoom" ? "General inventory / storage" : "Unassigned / venue-wide";
      select.innerHTML = `<option value="">${emptyLabel}</option>` + [...(state.venue.rooms || [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((room) => `<option value="${escapeHtml(room.id)}">${escapeHtml(room.name)}${room.code ? ` · ${escapeHtml(room.code)}` : ""}</option>`).join("");
      if (select.multiple) {
        [...select.options].forEach((option) => { option.selected = previous.includes(option.value); });
      } else if (previous.some((value) => [...select.options].some((option) => option.value === value))) {
        select.value = previous.find((value) => [...select.options].some((option) => option.value === value)) || "";
      }
    });
    const equipmentSelect = $("maintenanceEquipment");
    if (equipmentSelect) {
      const previous = equipmentSelect.value;
      equipmentSelect.innerHTML = `<option value="">Not asset-specific</option>` + (state.venue.equipment || [])
        .slice().sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.assetId)} · ${escapeHtml(item.name)}</option>`).join("");
      if ([...equipmentSelect.options].some((option) => option.value === previous)) equipmentSelect.value = previous;
    }
  }

  function statusClass(status) {
    const value = String(status || "").toLowerCase();
    if (["complete", "available", "confirmed", "in progress", "assigned"].includes(value)) return "green";
    if (["urgent", "out of service", "missing", "cancelled", "closed"].includes(value)) return "red";
    if (["high", "needs service", "blocked", "under maintenance", "limited access", "tentative", "open"].includes(value)) return "amber";
    return "";
  }

  function renderVenuePulse() {
    const events = state.venue?.events || [];
    const today = localDateString();
    const upcoming = events.filter((event) => event.date >= today && !["Complete", "Cancelled"].includes(event.bookingStatus));
    const attention = (state.venue?.equipment || []).filter((item) => ["Needs service", "Out of service", "Missing"].includes(item.status));
    const openMaintenance = (state.venue?.maintenance || []).filter((item) => item.status !== "Complete");
    if ($("venuePulse")) $("venuePulse").hidden = !isAdmin();
    $("venueUpcomingMetric") && ($("venueUpcomingMetric").textContent = String(upcoming.length));
    $("venueEquipmentMetric") && ($("venueEquipmentMetric").textContent = String(attention.length));
    $("venueMaintenanceMetric") && ($("venueMaintenanceMetric").textContent = String(openMaintenance.length));
    $("venueRoomsMetric") && ($("venueRoomsMetric").textContent = String((state.venue?.rooms || []).filter((room) => room.status !== "Closed").length));
    $("eventsNavCount") && ($("eventsNavCount").textContent = String(events.length));
    $("roomsNavCount") && ($("roomsNavCount").textContent = String((state.venue?.rooms || []).length));
    $("equipmentNavCount") && ($("equipmentNavCount").textContent = String((state.venue?.equipment || []).length));
    $("maintenanceNavCount") && ($("maintenanceNavCount").textContent = String(openMaintenance.length));
    $("maintenanceOpenBadge") && ($("maintenanceOpenBadge").textContent = `${openMaintenance.length} open`);
    renderVenueSelector();
  }

  function renderVenueCalendar() {
    const calendar = $("venueCalendar");
    if (!calendar) return;
    if (!venueCalendarInitialized) {
      const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const activeEvent = (state.venue?.events || []).find((record) => record.id === state.venue.activeEventId);
      const nextEvent = [...(state.venue?.events || [])].filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(String(record.date || "")) && record.date >= localDateString() && !["Complete", "Cancelled"].includes(record.bookingStatus)).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
      const initialEvent = activeEvent && /^\d{4}-\d{2}-\d{2}$/.test(String(activeEvent.date || "")) ? activeEvent : nextEvent;
      if (initialEvent) {
        const initialDate = new Date(`${initialEvent.date}T12:00:00`);
        venueCalendarMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
      } else {
        venueCalendarMonth = currentMonth;
      }
      venueCalendarInitialized = true;
    }
    const year = venueCalendarMonth.getFullYear();
    const month = venueCalendarMonth.getMonth();
    const monthStart = new Date(year, month, 1);
    $("venueCalendarMonth").textContent = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const gridStart = new Date(year, month, 1 - monthStart.getDay());
    const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
    const eventMap = new Map();
    (state.venue?.events || []).forEach((record) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.date || ""))) return;
      if (!eventMap.has(record.date)) eventMap.set(record.date, []);
      eventMap.get(record.date).push(record);
    });
    eventMap.forEach((records) => records.sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")) || String(a.name).localeCompare(String(b.name))));
    const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const today = localDateString();
    const headings = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => `<div class="calendarWeekday" role="columnheader">${name}</div>`).join("");
    const cells = days.map((date) => {
      const key = localDateKey(date);
      const records = eventMap.get(key) || [];
      const contents = records.slice(0, 3).map((record) => {
        const active = record.id === state.venue.activeEventId;
        const roomIds = record.roomIds || (record.roomId ? [record.roomId] : []);
        const rooms = roomIds.map((id) => roomName(id)).filter((name) => name !== "Unassigned space").join(", ");
        const time = [record.startTime, record.endTime].filter(Boolean).join("–");
        const label = `${record.name}${time ? ` · ${time}` : ""}${rooms ? ` · ${rooms}` : ""}`;
        const cls = `calendarEventItem ${active ? "calendarEventActive" : ""} ${statusClass(record.bookingStatus)}`;
        const body = `<span class="calendarEventTime">${escapeHtml(time || "All day")}</span><strong>${escapeHtml(record.name || "Untitled event")}</strong>`;
        return isAdmin()
          ? `<button type="button" class="${cls}" data-activate-event="${escapeHtml(record.id)}" title="${escapeHtml(`Open ${label}`)}">${body}</button>`
          : `<div class="${cls}" title="${escapeHtml(label)}">${body}</div>`;
      }).join("");
      const more = records.length > 3 ? `<span class="calendarMoreEvents">+${records.length - 3} more</span>` : "";
      return `<div class="calendarDay ${date.getMonth() !== month ? "calendarDayOutside" : ""} ${key === today ? "calendarDayToday" : ""}" role="gridcell" aria-label="${escapeHtml(date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}"><span class="calendarDayNumber">${date.getDate()}</span><div class="calendarDayEvents">${contents}${more}</div></div>`;
    }).join("");
    calendar.innerHTML = headings + cells;
  }

  function renderVenueEvents() {
    if (!$ ("venueEventsList")) return;
    fillVenueRoomOptions();
    const events = [...(state.venue?.events || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.startTime || "").localeCompare(String(b.startTime || "")) || String(a.name).localeCompare(String(b.name)));
    const query = String($("eventSearch")?.value || "").trim().toLowerCase();
    const status = $("eventStatusFilter")?.value || "all";
    const filtered = events.filter((event) => {
      const haystack = [event.name, event.bookingType, event.bookingStatus, event.lead, event.spaces, event.technicalNotes, roomName(event.roomId)].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) && (status === "all" || event.bookingStatus === status);
    });
    $("eventsTotal") && ($("eventsTotal").textContent = String(events.length));
    $("eventsUpcoming") && ($("eventsUpcoming").textContent = String(events.filter((event) => event.date >= localDateString() && !["Complete", "Cancelled"].includes(event.bookingStatus)).length));
    $("eventsConfirmed") && ($("eventsConfirmed").textContent = String(events.filter((event) => event.bookingStatus === "Confirmed").length));
    if ($("eventsAccessBadge")) {
      $("eventsAccessBadge").textContent = isAdmin() ? "Admin controls enabled" : "Read-only booking list";
      $("eventsAccessBadge").className = `pill ${isAdmin() ? "green" : ""}`;
    }
    $("venueEventsList").innerHTML = filtered.length ? filtered.map((event) => {
      const active = event.id === state.venue.activeEventId;
      const time = [event.startTime, event.endTime].filter(Boolean).join("–");
      const workspace = active ? { checks: state.checks, shiftChecks: state.shiftChecks, handoffs: state.handoffs, incidents: state.incidents, shiftSchedule: state.shiftSchedule } : (event.workspace || {});
      const linkedRooms = (event.roomIds || (event.roomId ? [event.roomId] : [])).map((id) => roomName(id));
      const room = linkedRooms.length ? linkedRooms.join(", ") : event.spaces || "Space not assigned";
      const incidentCount = (workspace.incidents || []).filter((incident) => !incident.resolved).length;
      return `<article class="venueRecordRow ${active ? "recordActive" : ""}">
        <div class="venueRecordMain"><div class="recordEyebrow"><span>${escapeHtml(event.bookingType || "Event")}</span><span>${escapeHtml(event.date || "Date TBD")}${time ? ` · ${escapeHtml(time)}` : ""}</span>${active ? '<span class="recordCurrent">ACTIVE WORKSPACE</span>' : ""}</div><h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(room)}${event.lead ? ` · Lead: ${escapeHtml(event.lead)}` : ""}</p>${event.technicalNotes ? `<div class="recordNotes">${escapeHtml(event.technicalNotes)}</div>` : ""}<div class="recordMetaLine"><span>${(workspace.shiftSchedule || []).length} crew calls</span><span>${(workspace.handoffs || []).length} handoffs</span><span>${incidentCount} open event incidents</span></div></div>
        <div class="venueRecordAside"><span class="pill ${statusClass(event.bookingStatus)}">${escapeHtml(event.bookingStatus || "Tentative")}</span><span class="phaseChip">${escapeHtml(event.phase || "Phase not set")}</span><div class="venueRecordActions">${active ? '<button type="button" class="btn small" disabled>Active workspace</button>' : (isAdmin() ? `<button type="button" class="btn primary small" data-activate-event="${escapeHtml(event.id)}">Open workspace</button>` : '<span class="helpText">Active event selected by admin</span>')}${isAdmin() ? `<button type="button" class="btn small quiet" data-edit-event="${escapeHtml(event.id)}">Edit booking</button>` : ""}</div></div>
      </article>`;
    }).join("") : `<div class="empty"><strong>${events.length ? "No bookings match those filters" : "No events booked yet"}</strong>${events.length ? "Clear the search or status filter to see more bookings." : (isAdmin() ? "Create the first booking above, then activate its event workspace when the crew is ready." : "An administrator can add productions, rehearsals, performances, rentals, and other bookings here.")}</div>`;
    renderVenueCalendar();
    renderVenuePulse();
  }

  function renderVenueRooms() {
    if (!$ ("venueRoomsList")) return;
    const query = String($("roomSearch")?.value || "").trim().toLowerCase();
    const rooms = [...(state.venue?.rooms || [])].sort((a, b) => a.name.localeCompare(b.name)).filter((room) => [room.name, room.code, room.type, room.notes, room.status].join(" ").toLowerCase().includes(query));
    $("roomsAccessBadge") && ($("roomsAccessBadge").textContent = isAdmin() ? "Admin editor" : "Shared directory");
    $("roomsAccessBadge") && ($("roomsAccessBadge").className = `pill ${isAdmin() ? "green" : ""}`);
    $("roomListCaption") && ($("roomListCaption").textContent = `${(state.venue?.rooms || []).length} rooms and facilities registered.`);
    $("venueRoomsList").innerHTML = rooms.length ? rooms.map((room) => {
      const eventCount = (state.venue.events || []).filter((event) => ((event.roomIds || (event.roomId ? [event.roomId] : [])).includes(room.id)) && !["Complete", "Cancelled"].includes(event.bookingStatus)).length;
      const assetCount = (state.venue.equipment || []).filter((item) => item.roomId === room.id).length;
      return `<article class="venueRecordRow"><div class="venueRecordIcon">${room.type === "Performance" ? "STG" : room.type === "Storage" ? "STO" : room.type === "Backstage" ? "BKS" : "RM"}</div><div class="venueRecordMain"><div class="recordEyebrow"><span>${escapeHtml(room.code || room.type || "SPACE")}</span>${room.capacity !== "" ? `<span>Capacity ${escapeHtml(room.capacity)}</span>` : ""}</div><h3>${escapeHtml(room.name)}</h3><p>${escapeHtml(room.type)}${room.notes ? ` · ${escapeHtml(room.notes)}` : ""}</p><div class="recordMetaLine"><span>${eventCount} upcoming / active bookings</span><span>${assetCount} tracked assets</span></div></div><div class="venueRecordAside">${isAdmin() ? `<select class="field inlineStatusSelect" data-room-status="${escapeHtml(room.id)}" aria-label="${escapeHtml(room.name)} status">${["Available", "Limited access", "Under maintenance", "Closed"].map((option) => `<option ${room.status === option ? "selected" : ""}>${option}</option>`).join("")}</select><button class="btn small quiet" type="button" data-delete-room="${escapeHtml(room.id)}">Remove</button>` : `<span class="pill ${statusClass(room.status)}">${escapeHtml(room.status)}</span>`}</div></article>`;
    }).join("") : `<div class="empty"><strong>No spaces registered</strong>${isAdmin() ? "Add the theatre, studios, lobby, backstage areas, and storage spaces to start connecting bookings and gear to real rooms." : "The venue administrator has not added any rooms or facilities yet."}</div>`;
    fillVenueRoomOptions();
  }

  function renderVenueEquipment() {
    if (!$ ("venueEquipmentList")) return;
    const query = String($("equipmentSearch")?.value || "").trim().toLowerCase();
    const status = $("equipmentStatusFilter")?.value || "all";
    const all = [...(state.venue?.equipment || [])].sort((a, b) => String(a.assetId).localeCompare(String(b.assetId)));
    const items = all.filter((item) => [item.name, item.assetId, item.category, item.serial, item.notes, roomName(item.roomId)].join(" ").toLowerCase().includes(query) && (status === "all" || item.status === status));
    $("equipmentTotal") && ($("equipmentTotal").textContent = String(all.length));
    $("equipmentAvailable") && ($("equipmentAvailable").textContent = String(all.filter((item) => item.status === "Available").length));
    $("equipmentAttention") && ($("equipmentAttention").textContent = String(all.filter((item) => ["Needs service", "Out of service", "Missing"].includes(item.status)).length));
    $("equipmentAccessBadge") && ($("equipmentAccessBadge").textContent = isAdmin() ? "Admin inventory" : "Shared read-only inventory");
    $("equipmentAccessBadge") && ($("equipmentAccessBadge").className = `pill ${isAdmin() ? "green" : ""}`);
    $("venueEquipmentList").innerHTML = items.length ? items.map((item) => `<article class="venueRecordRow"><div class="venueRecordIcon">${escapeHtml(String(item.category || "GEAR").slice(0, 3).toUpperCase())}</div><div class="venueRecordMain"><div class="recordEyebrow"><span class="assetTag">${escapeHtml(item.assetId)}</span><span>${escapeHtml(item.category)}</span></div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(roomName(item.roomId))}${item.serial ? ` · ${escapeHtml(item.serial)}` : ""}</p>${item.notes ? `<div class="recordNotes">${escapeHtml(item.notes)}</div>` : ""}</div><div class="venueRecordAside">${isAdmin() ? `<select class="field inlineStatusSelect" data-equipment-status="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} status">${["Available", "Assigned", "Needs service", "Out of service", "Missing"].map((option) => `<option ${item.status === option ? "selected" : ""}>${option}</option>`).join("")}</select>` : `<span class="pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span>`}<button class="btn small quiet" type="button" data-report-equipment="${escapeHtml(item.id)}">Report issue</button></div></article>`).join("") : `<div class="empty"><strong>${all.length ? "No equipment matches the filters" : "Inventory is empty"}</strong>${all.length ? "Change the search or status filter." : (isAdmin() ? "Register consoles, microphones, lights, projectors, comms, cable, tools, and other shared equipment." : "The venue administrator has not registered any assets yet.")}</div>`;
    fillVenueRoomOptions();
  }

  function renderVenueMaintenance() {
    if (!$ ("venueMaintenanceList")) return;
    const query = String($("maintenanceSearch")?.value || "").trim().toLowerCase();
    const statusFilter = $("maintenanceStatusFilter")?.value || "all";
    const all = [...(state.venue?.maintenance || [])].sort((a, b) => {
      const urgency = (item) => item.priority === "Urgent" ? 0 : item.priority === "High" ? 1 : item.priority === "Normal" ? 2 : 3;
      return (a.status === "Complete") - (b.status === "Complete") || urgency(a) - urgency(b) || Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
    const open = all.filter((item) => item.status !== "Complete");
    const high = open.filter((item) => ["High", "Urgent"].includes(item.priority));
    const items = all.filter((item) => [item.title, item.category, item.details, item.reporter, item.owner, item.status, roomName(item.roomId), equipmentName(item.equipmentId)].join(" ").toLowerCase().includes(query) && (statusFilter === "all" || item.status === statusFilter));
    $("maintenanceTotal") && ($("maintenanceTotal").textContent = String(all.length));
    $("maintenanceOpen") && ($("maintenanceOpen").textContent = String(open.length));
    $("maintenanceHigh") && ($("maintenanceHigh").textContent = String(high.length));
    $("venueMaintenanceList").innerHTML = items.length ? items.map((item) => {
      const creator = item.createdBy?.displayName || item.reporter || "Signed-in technician";
      const statusControl = isAdmin() ? `<select class="field inlineStatusSelect" data-maintenance-status="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)} status">${["Open", "In progress", "Blocked", "Complete"].map((option) => `<option ${item.status === option ? "selected" : ""}>${option}</option>`).join("")}</select>` : `<span class="pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span>`;
      return `<article class="venueRecordRow maintenanceRecord ${item.status === "Complete" ? "maintenanceComplete" : ""}"><div class="maintenancePriorityMark priority-${String(item.priority || "Normal").toLowerCase().replace(/[^a-z]/g, "")}"></div><div class="venueRecordMain"><div class="recordEyebrow"><span>${escapeHtml(item.category)}</span><span>${escapeHtml(new Date(item.createdAt || Date.now()).toLocaleDateString())}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(roomName(item.roomId))}${item.equipmentId ? ` · ${escapeHtml(equipmentName(item.equipmentId))}` : ""} · Reported by ${escapeHtml(creator)}</p><div class="recordNotes">${escapeHtml(item.details)}</div>${item.owner ? `<div class="recordMetaLine"><span>Follow-up: ${escapeHtml(item.owner)}</span></div>` : ""}</div><div class="venueRecordAside"><span class="pill ${statusClass(item.priority)}">${escapeHtml(item.priority)}</span>${statusControl}${isAdmin() ? `<input class="field ownerInlineField" data-maintenance-owner="${escapeHtml(item.id)}" value="${escapeHtml(item.owner || "")}" maxlength="100" placeholder="Assign owner" aria-label="Follow-up owner for ${escapeHtml(item.title)}">` : ""}</div></article>`;
    }).join("") : `<div class="empty"><strong>${all.length ? "No requests match those filters" : "No maintenance requests"}</strong>${all.length ? "Try another search or status." : "When gear or a facility needs attention, submit a request above. Keep the issue scoped to the observed facts and notify the supervisor directly for urgent hazards."}</div>`;
    fillVenueRoomOptions();
  }

  function renderVenueViews() {
    renderVenuePulse();
    renderVenueEvents();
    renderVenueRooms();
    renderVenueEquipment();
    renderVenueMaintenance();
  }

  function startBookingCreation() {
    if (!isAdmin()) return;
    switchView("events");
    cancelBookingEdit();
    $("bookingDate").value = localDateString();
    $("bookingName")?.focus();
  }

  let editingVenueEventId = "";
  function cancelBookingEdit() {
    editingVenueEventId = "";
    $("eventBookingForm")?.reset();
    if ($("bookingDate")) $("bookingDate").value = localDateString();
    if ($("eventBookingFormTitle")) $("eventBookingFormTitle").textContent = "Create an event booking";
    if ($("saveBookingBtn")) $("saveBookingBtn").textContent = "Create booking";
    if ($("cancelBookingEditBtn")) $("cancelBookingEditBtn").hidden = true;
    fillVenueRoomOptions();
  }

  function editVenueBooking(eventId) {
    if (!isAdmin()) return showToast("Only administrators can edit bookings.");
    const record = (state.venue.events || []).find((event) => event.id === eventId);
    if (!record) return;
    editingVenueEventId = record.id;
    $("bookingName").value = record.name || "";
    $("bookingType").value = record.bookingType || "Other";
    $("bookingStatus").value = record.bookingStatus || "Confirmed";
    $("bookingDate").value = record.date || localDateString();
    const recordRoomIds = record.roomIds || (record.roomId ? [record.roomId] : []);
    [...$("bookingRoom").options].forEach((option) => { option.selected = recordRoomIds.includes(option.value); });
    $("bookingStart").value = record.startTime || "";
    $("bookingEnd").value = record.endTime || "";
    $("bookingLead").value = record.lead || "";
    $("bookingContact").value = record.contact || "";
    $("bookingNotes").value = record.technicalNotes || record.schedule || "";
    $("eventBookingFormTitle").textContent = `Edit booking · ${record.name}`;
    $("saveBookingBtn").textContent = "Save booking changes";
    $("cancelBookingEditBtn").hidden = false;
    switchView("events");
    $("bookingName").focus();
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();
    if (!isAdmin()) return showToast("Only administrators can create or edit venue bookings.");
    const name = $("bookingName").value.trim();
    const date = $("bookingDate").value;
    const startTime = $("bookingStart").value;
    const endTime = $("bookingEnd").value;
    if (!name || !date) return showToast("Event name and date are required.");
    if (startTime && endTime && endTime <= startTime) return showToast("End / strike time must be later than the call time. Split overnight bookings into separate dates.");
    const roomIds = [...$("bookingRoom").selectedOptions].map((option) => option.value).filter(Boolean);
    const roomId = roomIds[0] || "";
    const rooms = roomIds.map((id) => (state.venue.rooms || []).find((item) => item.id === id)).filter(Boolean);
    const closedRoom = rooms.find((room) => ["Closed", "Under maintenance"].includes(room.status));
    if (closedRoom) return showToast(`${closedRoom.name} is marked ${closedRoom.status.toLowerCase()} and cannot be booked.`);
    if ($("bookingStatus").value !== "Cancelled" && $("bookingStatus").value !== "Complete") {
      const conflicting = (state.venue.events || []).find((other) => {
        if (other.id === editingVenueEventId || other.date !== date || ["Cancelled", "Complete"].includes(other.bookingStatus)) return false;
        const otherRoomIds = other.roomIds || (other.roomId ? [other.roomId] : []);
        if (!roomIds.some((id) => otherRoomIds.includes(id))) return false;
        if (!startTime || !endTime || !other.startTime || !other.endTime) return true;
        return startTime < other.endTime && other.startTime < endTime;
      });
      if (conflicting) {
        const commonRoomId = roomIds.find((id) => (conflicting.roomIds || (conflicting.roomId ? [conflicting.roomId] : [])).includes(id));
        return showToast(`Room conflict: ${roomName(commonRoomId)} is also booked for “${conflicting.name}”${conflicting.startTime && conflicting.endTime ? ` (${conflicting.startTime}–${conflicting.endTime})` : " that day"}.`);
      }
    }
    const form = {
      name, date, bookingType: $("bookingType").value, bookingStatus: $("bookingStatus").value,
      startTime, endTime, roomId, roomIds, spaces: rooms.map((room) => room.name).join(", "), lead: $("bookingLead").value.trim(),
      contact: $("bookingContact").value.trim(), schedule: $("bookingNotes").value.trim(),
      technicalNotes: $("bookingNotes").value.trim(),
    };
    if (editingVenueEventId) {
      const target = state.venue.events.find((record) => record.id === editingVenueEventId);
      if (!target) return showToast("That booking was removed or is no longer available.");
      Object.assign(target, form);
      if (target.id === state.venue.activeEventId) {
        state.event = { ...state.event, name: form.name, date: form.date, spaces: form.spaces, lead: form.lead, contact: form.contact, schedule: form.schedule };
        fillEventFields();
      }
      cancelBookingEdit();
      renderVenueViews();
      const saved = await saveState({ immediate: true });
      if (saved) showToast("Booking updated on the shared venue calendar.");
      return;
    }
    snapshotActiveVenueEvent();
    const record = {
      id: createId(), ...form, phase: state.settings.eventPhases[0] || "Prepping / load-in",
      workspace: { checks: {}, shiftChecks: {}, handoffs: [], incidents: [], shiftSchedule: [] },
    };
    state.venue.events.push(record);
    cancelBookingEdit();
    loadVenueEventIntoWorkspace(record);
    switchView("operations");
    const saved = await saveState({ immediate: true });
    if (saved) showToast(`Booking created. ${record.name} is now the active workspace.`);
  }

  async function handleRoomSubmit(event) {
    event.preventDefault();
    if (!isAdmin()) return showToast("Only administrators can manage venue spaces.");
    const name = $("roomName").value.trim();
    const code = $("roomCode").value.trim();
    if (!name) return;
    if ((state.venue.rooms || []).some((room) => room.name.toLowerCase() === name.toLowerCase() || (code && room.code.toLowerCase() === code.toLowerCase()))) return showToast("A room with that name or short code already exists.");
    state.venue.rooms.push({ id: createId(), name, code, type: $("roomType").value, capacity: $("roomCapacity").value, status: $("roomStatus").value, notes: $("roomNotes").value.trim(), createdAt: Date.now() });
    $("roomForm").reset();
    renderVenueViews();
    const saved = await saveState({ immediate: true });
    if (saved) showToast(`${name} added to the venue directory.`);
  }

  async function handleEquipmentSubmit(event) {
    event.preventDefault();
    if (!isAdmin()) return showToast("Only administrators can register equipment.");
    const name = $("equipmentName").value.trim();
    const assetId = $("equipmentAssetId").value.trim();
    if (!name || !assetId) return;
    if ((state.venue.equipment || []).some((item) => item.assetId.toLowerCase() === assetId.toLowerCase())) return showToast("That asset ID already exists. Asset tags must be unique.");
    state.venue.equipment.push({ id: createId(), name, assetId, category: $("equipmentCategory").value, roomId: $("equipmentRoom").value, status: $("equipmentStatus").value, serial: $("equipmentSerial").value.trim(), notes: $("equipmentNotes").value.trim(), createdAt: Date.now() });
    $("equipmentForm").reset();
    renderVenueViews();
    const saved = await saveState({ immediate: true });
    if (saved) showToast(`${assetId} added to equipment inventory.`);
  }

  async function handleMaintenanceSubmit(event) {
    event.preventDefault();
    const title = $("maintenanceTitle").value.trim();
    const details = $("maintenanceDetails").value.trim();
    if (!title || !details) return;
    const request = {
      id: createId(), title, category: $("maintenanceCategory").value, priority: $("maintenancePriority").value,
      roomId: $("maintenanceRoom").value, equipmentId: $("maintenanceEquipment").value,
      details, reporter: String($("maintenanceReporter").value.trim() || activeUser?.displayName || "Signed-in technician").slice(0, 100),
      owner: "", status: "Open", createdAt: Date.now(), updatedAt: Date.now(), createdBy: null,
    };
    state.venue.maintenance.push(request);
    $("maintenanceForm").reset();
    if ($("maintenanceReporter")) $("maintenanceReporter").value = activeUser?.displayName || "";
    renderVenueViews();
    const saved = await saveState({ immediate: true });
    if (saved) showToast("Maintenance request submitted to the shared venue queue.");
  }

  async function handleVenueChange(event) {
    const field = event.target;
    if (field.id === "activeEventSelect") {
      if (field.value && field.value !== state.venue.activeEventId) await activateVenueEvent(field.value);
      return;
    }
    if (field.matches("[data-room-status]")) {
      if (!isAdmin()) return showToast("Only administrators can change room status.");
      const room = state.venue.rooms.find((item) => item.id === field.dataset.roomStatus);
      if (!room) return;
      room.status = field.value;
      renderVenueViews();
      if (await saveState({ immediate: true })) showToast(`${room.name} status updated.`);
      return;
    }
    if (field.matches("[data-equipment-status]")) {
      if (!isAdmin()) return showToast("Only administrators can change equipment state.");
      const item = state.venue.equipment.find((record) => record.id === field.dataset.equipmentStatus);
      if (!item) return;
      item.status = field.value;
      renderVenueViews();
      if (await saveState({ immediate: true })) showToast(`${item.assetId} status updated.`);
      return;
    }
    if (field.matches("[data-maintenance-status]")) {
      if (!isAdmin()) return showToast("Only administrators can manage request status.");
      const item = state.venue.maintenance.find((record) => record.id === field.dataset.maintenanceStatus);
      if (!item) return;
      item.status = field.value;
      item.updatedAt = Date.now();
      renderVenueViews();
      if (await saveState({ immediate: true })) showToast("Maintenance status updated.");
    }
  }

  async function handleVenueClick(event) {
    const activate = event.target.closest("[data-activate-event]");
    if (activate) return void await activateVenueEvent(activate.dataset.activateEvent);
    const edit = event.target.closest("[data-edit-event]");
    if (edit) return editVenueBooking(edit.dataset.editEvent);
    const removeRoom = event.target.closest("[data-delete-room]");
    if (removeRoom) {
      if (!isAdmin()) return showToast("Only administrators can remove venue spaces.");
      const id = removeRoom.dataset.deleteRoom;
      const room = state.venue.rooms.find((item) => item.id === id);
      if (!room) return;
      const hasReferences = state.venue.events.some((item) => item.roomId === id || (item.roomIds || []).includes(id)) || state.venue.equipment.some((item) => item.roomId === id) || state.venue.maintenance.some((item) => item.roomId === id);
      if (hasReferences) return showToast("This room is referenced by a booking, asset, or maintenance request. Keep it and mark it Closed instead.");
      if (!window.confirm(`Remove ${room.name} from the room directory?`)) return;
      state.venue.rooms = state.venue.rooms.filter((item) => item.id !== id);
      renderVenueViews();
      if (await saveState({ immediate: true })) showToast("Room removed from the directory.");
      return;
    }
    const reportAsset = event.target.closest("[data-report-equipment]");
    if (reportAsset) {
      const asset = state.venue.equipment.find((item) => item.id === reportAsset.dataset.reportEquipment);
      if (!asset) return;
      switchView("maintenance");
      $("maintenanceTitle").value = `${asset.assetId} · ${asset.name} issue`;
      $("maintenanceCategory").value = "Equipment repair";
      $("maintenanceRoom").value = asset.roomId || "";
      $("maintenanceEquipment").value = asset.id;
      $("maintenanceDetails").focus();
      showToast("Add the observed symptoms and submit the maintenance request.");
    }
  }

  async function handleMaintenanceOwnerChange(event) {
    const field = event.target.closest("[data-maintenance-owner]");
    if (!field || !isAdmin()) return;
    const item = state.venue.maintenance.find((record) => record.id === field.dataset.maintenanceOwner);
    if (!item) return;
    item.owner = field.value.trim();
    item.updatedAt = Date.now();
    if (await saveState({ immediate: true })) showToast("Follow-up owner saved.");
  }

  async function handleVenueSettingsSubmit(event) {
    event.preventDefault();
    if (!isAdmin()) return showToast("Only administrators can change venue identity.");
    const name = $("venueNameInput").value.trim();
    if (!name) return showToast("Enter a venue name.");
    state.venue.name = name.slice(0, 120);
    renderVenueName();
    if (await saveState({ immediate: true })) showToast("Venue identity saved.");
  }

  function renderVenueName() {
    const name = state.venue?.name || "Backstage Theatre";
    document.querySelectorAll(".brandCopy small").forEach((node) => { node.textContent = name; });
    if ($("venueNameInput") && document.activeElement !== $("venueNameInput")) $("venueNameInput").value = name;
  }


  function renderSettings() {
    if (!isAdmin()) return;
    renderChecklistSettings();
    renderApiConnectionPanel();
    renderVenueName();
  }

  async function handleSettingsFieldChange(event) {
    if (!isAdmin()) {
      showToast("Only administrators can customize the workspace.");
      return;
    }
    const field = event.target;

    if (field.dataset.sectionField) {
      const section = getChecklistSections().find((item) => item.id === field.dataset.sectionId);
      if (!section) return;
      const value = field.value.trim();
      if (field.dataset.sectionField === "title" && !value) {
        field.value = section.title;
        showToast("A section needs a name.");
        return;
      }
      section[field.dataset.sectionField] = value;
      renderChecklist();
      const saved = await saveState({ immediate: true });
      if (saved) showToast("Checklist section saved to the host.");
      return;
    }

    if (field.dataset.taskField) {
      const section = getChecklistSections().find((item) => item.id === field.dataset.sectionId);
      const task = section?.items.find((item) => item.id === field.dataset.taskId);
      if (!task) return;
      const value = field.value.trim();
      if (field.dataset.taskField === "label" && !value) {
        field.value = task.label;
        showToast("A checklist task needs a name.");
        return;
      }
      task[field.dataset.taskField] = value;
      renderChecklist();
      const saved = await saveState({ immediate: true });
      if (saved) showToast("Checklist task saved to the host.");
      return;
    }

    if (field.dataset.optionKey) {
      const list = state.settings[field.dataset.optionKey];
      const index = Number(field.dataset.optionIndex);
      const value = field.value.trim();
      if (!value) {
        field.value = list[index];
        showToast("An option cannot be blank. Remove it instead.");
        return;
      }
      if (list.some((entry, entryIndex) => entryIndex !== index && entry.toLowerCase() === value.toLowerCase())) {
        field.value = list[index];
        showToast("That option already exists.");
        return;
      }
      const previousValue = list[index];
      list[index] = value;
      if (field.dataset.optionKey === "eventPhases" && state.event.status === previousValue) state.event.status = value;
      if (field.dataset.optionKey === "handoffPriorities" && state.shiftDraft.priority === previousValue) state.shiftDraft.priority = value;
      if (field.dataset.optionKey === "incidentCategories" && $("incidentCategory").value === previousValue) $("incidentCategory").value = value;
      if (field.dataset.optionKey === "incidentPriorities") {
        if ($("incidentSeverity").value === previousValue) $("incidentSeverity").value = value;
        if ($("incidentPriorityFilter").value === previousValue) $("incidentPriorityFilter").value = value;
      }
      renderDynamicOptions();
      renderSettings();
      renderIncidents();
      const saved = await saveState({ immediate: true });
      if (saved) showToast("Dropdown option saved to the host.");
    }
  }

  async function handleSettingsClick(event) {
    if (!isAdmin()) {
      showToast("Only administrators can customize the workspace.");
      return;
    }
    const deleteScheduledShiftButton = event.target.closest("[data-delete-scheduled-shift]");
    if (deleteScheduledShiftButton) {
      await removeScheduledShift(deleteScheduledShiftButton.dataset.deleteScheduledShift);
      return;
    }

    const deleteSectionButton = event.target.closest("[data-delete-section]");
    if (deleteSectionButton) {
      const sectionId = deleteSectionButton.dataset.deleteSection;
      const section = getChecklistSections().find((item) => item.id === sectionId);
      if (!section) return;
      if (!window.confirm(`Delete section “${section.title}” and its ${section.items.length} task(s)?`)) return;
      section.items.forEach((item) => { delete state.checks[item.id]; });
      state.settings.checklist = getChecklistSections().filter((item) => item.id !== sectionId);
      renderSettings(); renderChecklist();
      if (await saveState({ immediate: true })) showToast("Checklist section deleted.");
      return;
    }

    const deleteTaskButton = event.target.closest("[data-delete-task]");
    if (deleteTaskButton) {
      const section = getChecklistSections().find((item) => item.id === deleteTaskButton.dataset.sectionId);
      if (!section) return;
      const task = section.items.find((item) => item.id === deleteTaskButton.dataset.deleteTask);
      if (!task || !window.confirm(`Remove checklist task “${task.label}”?`)) return;
      section.items = section.items.filter((item) => item.id !== task.id);
      delete state.checks[task.id];
      renderSettings(); renderChecklist();
      if (await saveState({ immediate: true })) showToast("Checklist task removed.");
      return;
    }

    const removeOptionButton = event.target.closest("[data-remove-option-key]");
    if (removeOptionButton) {
      const key = removeOptionButton.dataset.removeOptionKey;
      const index = Number(removeOptionButton.dataset.removeOptionIndex);
      const list = state.settings[key];
      if (!Array.isArray(list) || list.length <= 1) {
        showToast("Keep at least one option in each dropdown.");
        return;
      }
      const removedValue = list[index];
      if (!window.confirm(`Remove “${removedValue}” from this dropdown? Existing incident history will remain.`)) return;
      list.splice(index, 1);
      renderDynamicOptions();
      renderSettings(); renderIncidents();
      if (await saveState({ immediate: true })) showToast("Dropdown option removed.");
    }
  }

  async function handleSettingsSubmit(event) {
    const form = event.target;
    if (!isAdmin()) {
      event.preventDefault();
      showToast("Only administrators can customize the workspace.");
      return;
    }

    if (form.id === "timeSheetForm") {
      event.preventDefault();
      await addScheduledShift(event);
      return;
    }

    if (form.id === "addSectionForm") {
      event.preventDefault();
      const title = $("newSectionTitle").value.trim();
      const description = $("newSectionDescription").value.trim();
      if (!title) return;
      state.settings.checklist.push({ id: createId(), title, description, items: [] });
      form.reset(); renderSettings(); renderChecklist();
      if (await saveState({ immediate: true })) showToast("Checklist section added to the shared checklist.");
      return;
    }

    const taskSectionId = form.dataset.addTaskTo;
    if (taskSectionId) {
      event.preventDefault();
      const section = getChecklistSections().find((item) => item.id === taskSectionId);
      const formData = new FormData(form);
      const label = String(formData.get("label") || "").trim();
      const help = String(formData.get("help") || "").trim();
      if (!section || !label) return;
      section.items.push({ id: createId(), label, help });
      form.reset(); renderSettings(); renderChecklist();
      if (await saveState({ immediate: true })) showToast("Checklist task added to the shared checklist.");
      return;
    }

    const listKey = form.dataset.addList;
    if (listKey) {
      event.preventDefault();
      const input = form.elements.namedItem("value");
      const value = String(input.value || "").trim();
      const list = state.settings[listKey];
      if (!value || !Array.isArray(list)) return;
      if (list.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
        showToast("That option already exists.");
        return;
      }
      list.push(value);
      input.value = "";
      renderDynamicOptions(); renderSettings(); renderIncidents();
      if (await saveState({ immediate: true })) showToast("Dropdown option added to the shared options.");
    }
  }

  // ===========================================================================
  // INCIDENT LOG
  // ===========================================================================
  async function addIncident(event) {
    event.preventDefault();
    if (!String(state.event?.name || "").trim()) {
      showToast("No active event has been assigned. Ask an administrator to set the current event before logging an incident.");
      return;
    }
    const title = $("incidentTitle").value.trim();
    const details = $("incidentDetail").value.trim();
    if (!title || !details) return;

    const incident = {
      id: createId(),
      title,
      category: $("incidentCategory").value,
      priority: $("incidentSeverity").value,
      location: $("incidentLocation").value.trim(),
      reportedBy: $("incidentReportedBy").value.trim(),
      createdBy: activeUser ? { username: activeUser.username, displayName: activeUser.displayName } : null,
      details,
      action: $("incidentAction").value.trim(),
      owner: $("incidentOwner").value.trim(),
      created: Date.now(),
      resolved: false,
      resolvedBy: "",
      resolvedAt: null,
      eventId: state.eventId,
      eventName: eventTitle(),
    };

    state.incidents.unshift(incident);
    event.target.reset();
    if ($("incidentReportedBy") && activeUser) $("incidentReportedBy").value = activeUser.displayName;
    $("incidentCategory").value = state.settings.incidentCategories.includes("Technical / equipment")
      ? "Technical / equipment" : state.settings.incidentCategories[0];
    $("incidentSeverity").value = state.settings.incidentPriorities.includes("Medium")
      ? "Medium" : state.settings.incidentPriorities[0];
    renderIncidents();
    const saved = await saveState({ immediate: true });
    if (saved) showToast("Incident saved to the shared host. Remember to notify the responsible person directly.");
  }

  function renderIncidentCard(incident) {
    const category = incident.category || "Other";
    const priority = incident.priority || incident.severity || "Medium";
    const statusText = incident.resolved ? "Resolved" : "Open";
    const statusClass = incident.resolved ? "green" : "amber";
    const details = [
      renderIncidentDetail("What happened", incident.details),
      renderIncidentDetail("Location / equipment", incident.location),
      renderIncidentDetail("Reported by", incident.reportedBy),
      renderIncidentDetail("Logged by account", incident.createdBy?.displayName ? `${incident.createdBy.displayName} (@${incident.createdBy.username || "unknown"})` : ""),
      renderIncidentDetail("Action taken", incident.action),
      renderIncidentDetail("Follow-up owner / notified", incident.owner),
    ].filter(Boolean).join("");
    const resolvedText = incident.resolved
      ? `Resolved by ${escapeHtml(incident.resolvedBy || "staff member")}${incident.resolvedByUsername ? ` (@${escapeHtml(incident.resolvedByUsername)})` : ""} · ${escapeHtml(formatDateTime(incident.resolvedAt))}`
      : "Follow-up remains open";

    return `
      <article class="incident">
        <div class="incidentTop">
          <span class="pill ${priorityClass(priority)}">${escapeHtml(priority)}</span>
          <span class="pill">${escapeHtml(category)}</span>
          <strong>${escapeHtml(incident.title)}</strong>
          <span class="incidentTime">${escapeHtml(formatDateTime(incident.created))}</span>
        </div>
        <div class="historyMeta">Event: ${escapeHtml(incident.eventName || eventTitle())}</div>
        <div class="incidentDetails">${details}</div>
        <div class="incidentMeta">
          <span><span class="pill ${statusClass}">${statusText}</span> ${resolvedText}</span>
          <div class="incidentActions">
            <button type="button" class="btn small" data-resolve-incident="${escapeHtml(incident.id)}">${incident.resolved ? "Reopen" : "Mark resolved"}</button>
            ${isAdmin() ? `<button type="button" class="btn small danger" data-delete-incident="${escapeHtml(incident.id)}">Delete</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }

  function renderIncidentDetail(label, value) {
    if (!String(value || "").trim()) return "";
    return `<div class="incidentDetail"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</div>`;
  }

  function renderIncidents() {
    const query = $("incidentSearch").value.toLowerCase().trim();
    const statusFilter = $("incidentStatusFilter").value;
    const priorityFilter = $("incidentPriorityFilter").value;
    const newestFirst = [...state.incidents].sort((a, b) => b.created - a.created);

    const filtered = newestFirst.filter((incident) => {
      const resolved = Boolean(incident.resolved);
      const matchesStatus = statusFilter === "all" || (statusFilter === "open" && !resolved) || (statusFilter === "resolved" && resolved);
      const priority = incident.priority || incident.severity || "Medium";
      const matchesPriority = priorityFilter === "all" || priority === priorityFilter;
      const text = [incident.title, incident.details, incident.category, incident.location, incident.owner, incident.reportedBy, incident.action, incident.eventName].join(" ").toLowerCase();
      return matchesStatus && matchesPriority && (!query || text.includes(query));
    });

    const openIncidents = newestFirst.filter((incident) => !incident.resolved);
    const highPriorityValues = state.settings.incidentPriorities.slice(-2);
    const highPriority = openIncidents.filter((incident) => highPriorityValues.includes(incident.priority || incident.severity));
    $("incidentTotal").textContent = newestFirst.length;
    $("incidentOpen").textContent = openIncidents.length;
    $("incidentHigh").textContent = highPriority.length;
    $("openIncidentNav").textContent = `${openIncidents.length} open`;
    $("incidentCountLabel").textContent = `${filtered.length} shown · ${newestFirst.length} total`;
    $("incidentList").innerHTML = filtered.length
      ? filtered.map(renderIncidentCard).join("")
      : `<div class="empty"><strong>No matching incidents</strong>Log an incident or change the search / filters.</div>`;
    renderOperationsBoard();
  }

  async function toggleIncidentResolved(id) {
    const incident = state.incidents.find((item) => item.id === id);
    if (!incident) return;

    if (!incident.resolved) {
      incident.resolvedBy = activeUser?.displayName || "Signed-in technician";
      incident.resolvedByUsername = activeUser?.username || "";
      incident.resolvedAt = Date.now();
      incident.resolved = true;
    } else {
      incident.resolved = false;
      incident.resolvedBy = "";
      incident.resolvedByUsername = "";
      incident.resolvedAt = null;
    }
    renderIncidents();
    const saved = await saveState({ immediate: true });
    if (saved) showToast(incident.resolved ? "Incident marked resolved and saved." : "Incident reopened and saved.");
  }

  // ===========================================================================
  // NAVIGATION, EXPORT / IMPORT, AND EVENT LISTENERS
  // ===========================================================================
  function setEventDetailsExpanded(expanded) {
    const body = $("eventDetailsBody");
    const button = $("toggleEventDetailsBtn");
    const card = document.querySelector(".eventCard");
    if (!body || !button || !card) return;
    body.hidden = !expanded;
    card.classList.toggle("collapsed", !expanded);
    button.setAttribute("aria-expanded", String(expanded));
    button.innerHTML = expanded
      ? 'Hide details'
      : 'Edit details';
  }

  function switchView(viewName) {
    if (viewName === "settings" && !isAdmin()) {
      if (activeUser) showToast("Administrator access is required for workspace settings.");
      viewName = "operations";
    }
    const knownViews = new Set(["operations", "schedule", "handoff", "checklist", "incidents", "events", "rooms", "equipment", "maintenance", "settings"]);
    if (!knownViews.has(viewName)) viewName = "operations";
    activeView = viewName;
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === viewName;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    setEventDetailsExpanded(viewName === "handoff" || (viewName === "settings" && isAdmin()));
    const eventCard = document.querySelector(".eventCard");
    if (eventCard) eventCard.hidden = ["events", "rooms", "equipment", "maintenance"].includes(viewName);
    const pageInfo = {
      operations: { crumb: isAdmin() ? "Venue operations" : "Technician workspace", title: isAdmin() ? "Venue overview" : "My Work", sub: isAdmin() ? "A venue-wide snapshot of bookings, equipment readiness, maintenance, and the currently active event." : "Your active event, shift checklist, crew coverage, handoffs, and anything that needs attention." },
      schedule: { crumb: "Control room", title: "Crew schedule", sub: "One shared call sheet for the full event. Administrators assign coverage; everyone can see the run of shifts." },
      handoff: { crumb: "Shift tools", title: "Shift handoff", sub: "Leave the incoming technician the current situation, completed work, open tasks, and next priorities." },
      checklist: { crumb: "Shift tools", title: "Shift checklist", sub: "Complete the admin-defined tasks for your scheduled shift. Progress is recorded separately per shift." },
      incidents: { crumb: "Shift tools", title: "Incident register", sub: "Log event-specific problems with clear ownership, action taken, priority, and resolution status." },
      events: { crumb: "Venue management", title: "Events & bookings", sub: "Schedule productions, rehearsals, performances, rentals, and the technical calls that support them." },
      rooms: { crumb: "Venue management", title: "Rooms & facilities", sub: "Keep venue spaces, capacities, access notes, and operational status in one shared directory." },
      equipment: { crumb: "Venue management", title: "Equipment inventory", sub: "Track shared technical assets, locations, and service state across every event." },
      maintenance: { crumb: "Venue management", title: "Maintenance & service desk", sub: "Route repair and facility requests into one venue-wide queue with priority and ownership." },
      settings: { crumb: "Administration", title: "Settings & administration", sub: "Manage accounts, venue identity, checklist templates, event phases, and incident options." },
    }[viewName];
    $("breadcrumb").textContent = pageInfo.crumb;
    $("pageTitle").textContent = pageInfo.title;
    $("pageSub").textContent = pageInfo.sub;
    if (viewName === "operations") { renderOperationsBoard(); renderVenuePulse(); }
    if (viewName === "schedule") renderTimeSheet();
    if (["events", "rooms", "equipment", "maintenance"].includes(viewName)) renderVenueViews();
    if (viewName === "settings") renderVenueName();
    // Switching work areas should return to the top of the new page, not keep
    // the scroll offset from the previous view under the sticky header.
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function startNewEvent() {
    startBookingCreation();
  }

  function exportBackup() {
    const backup = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(backup);
    const link = document.createElement("a");
    const safeName = (state.event.name || "theatre-event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const date = state.event.date || localDateString();
    link.href = url;
    link.download = `${safeName || "theatre-event"}-${date}-handoff.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Event, handoffs, checklist, and incidents exported to JSON.");
  }

  function importBackup(file) {
    if (!isAdmin()) {
      showToast("Only administrators can import a backup.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = JSON.parse(reader.result);
        const valid = imported && imported.version === 1 && imported.event && Array.isArray(imported.handoffs) && Array.isArray(imported.incidents);
        if (!valid) throw new Error("That file is not a compatible Backstage technician handoff backup.");

        const confirmed = window.confirm(serverStorageEnabled
          ? "Replace the shared host record with this imported backup for everyone using the host? Export the current record first if you need to keep it."
          : "Replace the event, checklist, handoff history, and incident log in this browser with the imported backup? Export the current record first if you need to keep it.");
        if (!confirmed) return;

        state = normalizeState(imported);
        const saved = await saveState({ immediate: true });
        if (!saved) return;
        fillEventFields();
        fillHandoffDraft();
        renderApp();
        showToast("Backup imported and saved to the shared host. Review the current event and latest handoff.");
      } catch (error) {
        window.alert(`Import failed: ${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  async function handleDocumentClick(event) {
    const nav = event.target.closest("[data-view]");
    if (nav) switchView(nav.dataset.view);

    const deleteShiftButton = event.target.closest("[data-delete-scheduled-shift]");
    if (deleteShiftButton) {
      if (!isAdmin()) return showToast("Only administrators can edit the crew schedule.");
      await removeScheduledShift(deleteShiftButton.dataset.deleteScheduledShift);
    }

    const loadButton = event.target.closest("[data-load-handoff]");
    if (loadButton) loadHandoffIntoDraft(loadButton.dataset.loadHandoff);

    const acknowledgeButton = event.target.closest("[data-ack-handoff]");
    if (acknowledgeButton) toggleHandoffAcknowledgement(acknowledgeButton.dataset.ackHandoff);

    const deleteHandoffButton = event.target.closest("[data-delete-handoff]");
    if (deleteHandoffButton) {
      if (!isAdmin()) return showToast("Only administrators can delete handoff history.");
      if (!window.confirm(serverStorageEnabled
        ? "Delete this handoff entry from the shared host record? This affects everyone using the host and cannot be undone without a backup."
        : "Delete this handoff entry from the current browser record? This cannot be undone unless you have a backup.")) return;
      state.handoffs = state.handoffs.filter((entry) => entry.id !== deleteHandoffButton.dataset.deleteHandoff);
      renderHandoffs();
      if (await saveState({ immediate: true })) showToast("Handoff entry deleted from the shared record.");
    }

    const resolveButton = event.target.closest("[data-resolve-incident]");
    if (resolveButton) toggleIncidentResolved(resolveButton.dataset.resolveIncident);

    const deleteIncidentButton = event.target.closest("[data-delete-incident]");
    if (deleteIncidentButton) {
      if (!isAdmin()) return showToast("Only administrators can delete incident records.");
      if (!window.confirm(serverStorageEnabled
        ? "Delete this incident from the shared host record? This affects everyone using the host and cannot be undone without a backup."
        : "Delete this incident report from the current browser record? This cannot be undone unless you have a backup.")) return;
      state.incidents = state.incidents.filter((incident) => incident.id !== deleteIncidentButton.dataset.deleteIncident);
      renderIncidents();
      if (await saveState({ immediate: true })) showToast("Incident deleted from the shared record.");
    }
  }

  function renderApp() {
    renderDynamicOptions();
    renderSettings();
    renderTimeSheet();
    renderChecklist();
    renderHandoffs();
    renderIncidents();
    renderOperationsBoard();
    renderVenueViews();
    renderVenueName();
    $("lastSaved").textContent = state.updated ? new Date(state.updated).toLocaleString() : "Not saved yet";
    $("recordId").textContent = (state.eventId || "NEW").slice(0, 8).toUpperCase();
  }

  async function refreshSharedRecord() {
    if (!serverStorageEnabled) {
      showToast("The shared host is unavailable. Sign in again after the API is restored.");
      return;
    }
    if (!window.confirm("Refresh the shared event, crew schedule, checklist, handoffs, and incidents from the host? Any unsaved form text in this tab will be replaced.")) return;
    const button = $("refreshSharedBtn");
    if (button) { button.disabled = true; button.textContent = "Refreshing…"; }
    try {
      clearTimeout(saveTimer);
      saveTimer = null;
      const response = await hostRequest("/api/state", { method: "GET" });
      const saved = await response.json();
      const headerRevision = parseInt(String(response.headers.get("ETag") || "").replace(/[^0-9]/g, ""), 10);
      serverRevision = Number.isSafeInteger(headerRevision) && headerRevision >= 0 ? headerRevision : (Number(saved?.revision) || 0);
      state = saved ? normalizeState(saved) : createBlankState();
      state.revision = serverRevision;
      state.shiftDraft = createBlankState().shiftDraft;
      state.shiftDraft.priority = state.settings.handoffPriorities[0] || "Routine";
      fillEventFields();
      fillHandoffDraft();
      if (activeUser && $("outgoingTech")) $("outgoingTech").value = activeUser.displayName;
      if (activeUser && $("incidentReportedBy")) $("incidentReportedBy").value = activeUser.displayName;
      renderApp();
      updateSessionIdentity();
      if (isAdmin()) await refreshAdminUsers();
      showToast("Shared host record refreshed. Schedule, incidents, handoffs, and shift checklist are current.");
    } catch (error) {
      showToast(error.message || "Could not refresh the shared record. Check the host connection.");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Refresh shared record"; }
    }
  }

  async function logoutFromBackstage() {
    const logoutButton = $("logoutBtn");
    if (logoutButton?.disabled) return;
    if (logoutButton) {
      logoutButton.disabled = true;
      logoutButton.innerHTML = '<span class="logoutSpinner" aria-hidden="true"></span><span>Signing out…</span>';
    }
    const app = document.querySelector(".app");
    if (app) app.inert = true;
    document.body.classList.add("signingOut");

    const token = activeSessionToken || (() => { try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch (_) { return ""; } })();
    let warning = "";
    clearTimeout(saveTimer);
    saveTimer = null;
    if (serverStorageEnabled && token) {
      try {
        // Flush pending autosaves before the final write. Unlike hostRequest(),
        // logout must not open another interactive login if a session was revoked.
        clearTimeout(saveTimer);
        saveTimer = null;
        const endpoint = window.BACKSTAGE_STATIC_SITE ? `${FIXED_API_BASE_URL}/api/state` : apiUrl("/api/state");
        const finalSnapshot = JSON.parse(JSON.stringify(state));
        finalSnapshot.updated = Date.now();
        const finalSave = saveQueue.catch(() => undefined).then(async () => {
          finalSnapshot.revision = serverRevision;
          const response = await fetchWithTimeout(endpoint, {
            method: "PUT", cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              "X-Theatre-Session": token,
              "If-Match": `"${serverRevision}"`,
            },
            body: JSON.stringify(finalSnapshot),
          }, 8000);
          if (!response.ok) {
            let detail = "";
            try { detail = (await response.json()).error || ""; } catch (_) { /* generic fallback */ }
            throw new Error(detail || `The host returned ${response.status}.`);
          }
          const etagRevision = parseInt(String(response.headers.get("ETag") || "").replace(/[^0-9]/g, ""), 10);
          if (Number.isSafeInteger(etagRevision) && etagRevision >= 0) serverRevision = etagRevision;
          state.revision = serverRevision;
        });
        saveQueue = finalSave;
        await finalSave;
      } catch (error) {
        console.warn("Could not confirm the final save during logout.", error);
        warning = "Signed out, but the host could not confirm the latest save. Sign in again and verify the event record.";
      }
      try {
        const endpoint = window.BACKSTAGE_STATIC_SITE ? `${FIXED_API_BASE_URL}/api/logout` : apiUrl("/api/logout");
        await fetchWithTimeout(endpoint, { method: "POST", cache: "no-store", headers: { "X-Theatre-Session": token } }, 5000);
      } catch (_) { /* clear browser credentials even if logout endpoint is unavailable */ }
    }

    clearAccountSession();
    try {
      sessionStorage.removeItem(SIGNOUT_NOTICE_KEY);
      if (warning) sessionStorage.setItem(SIGNOUT_NOTICE_KEY, warning);
    } catch (_) { /* ignore storage failure */ }
    reloadAfterLogin = false;
    state = createBlankState();
    serverStorageEnabled = false;
    document.body.classList.add("authPending");
    window.location.reload();
  }

  async function readApiPayload(response) {
    let payload = {};
    try { payload = await response.json(); } catch (_) { /* handled as generic response below */ }
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }

  async function refreshAdminUsers() {
    const panel = $("usersAdminPanel");
    const list = $("adminUsersList");
    if (!panel || !list || activeUser?.role !== "admin") return;
    panel.hidden = false;
    list.innerHTML = '<div class="empty">Loading technician accounts…</div>';
    try {
      const response = await hostRequest("/api/admin/users", { method: "GET" });
      const payload = await readApiPayload(response);
      renderAdminUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (error) {
      list.innerHTML = `<div class="empty">Could not load accounts: ${escapeHtml(error.message)}</div>`;
      showToast(error.message || "Could not load technician accounts.");
    }
  }

  function renderAdminUsers(users) {
    const list = $("adminUsersList");
    if (!list) return;
    setTechnicianDirectory(users.filter((user) => !user.disabled));
    if (!users.length) {
      list.innerHTML = '<div class="empty"><strong>No accounts yet</strong>Create the first technician account using the form above.</div>';
      return;
    }
    list.innerHTML = users.map((user) => {
      const isSelf = user.id === activeUser?.id;
      const disabled = Boolean(user.disabled);
      const roleLabel = user.role === "admin" ? "Administrator" : "Technician";
      const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never signed in";
      return `<article class="adminUserRow${disabled ? " isDisabled" : ""}" data-user-row="${escapeHtml(user.id)}">
        <div class="adminUserName"><strong>${escapeHtml(user.displayName)}</strong><small>@${escapeHtml(user.username)}${isSelf ? " · You" : ""}</small><span class="accountRole">${escapeHtml(roleLabel)}</span></div>
        <div class="adminUserMeta">Created ${escapeHtml(new Date(user.createdAt).toLocaleDateString())}<br>Last sign-in: ${escapeHtml(lastLogin)}<span class="adminUserStatus pill ${disabled ? "red" : "green"}">${disabled ? "Disabled" : "Active"}</span></div>
        <div class="adminUserTools"><input class="field" data-user-new-password type="password" minlength="12" maxlength="256" autocomplete="new-password" aria-label="New password for ${escapeHtml(user.username)}" placeholder="Reset password (12+ chars)"><button type="button" class="btn small" data-reset-user="${escapeHtml(user.id)}">Set password</button></div>
        <div class="adminUserTools accountStatusTools"><button type="button" class="btn small ${disabled ? "primary" : "danger"}" data-toggle-user="${escapeHtml(user.id)}" data-next-disabled="${disabled ? "false" : "true"}" ${isSelf ? "disabled title=\"You cannot disable your current account\"" : ""}>${disabled ? "Enable" : "Disable"}</button></div>
      </article>`;
    }).join("");
  }

  function setupAccountManagement() {
    const form = $("addUserForm");
    const list = $("adminUsersList");
    const refresh = $("refreshUsersBtn");
    if (refresh) refresh.addEventListener("click", refreshAdminUsers);
    if (form) form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (activeUser?.role !== "admin") return showToast("Only administrators can create accounts.");
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const body = {
          username: $("newUsername").value.trim().toLowerCase(),
          displayName: $("newDisplayName").value.trim(),
          password: $("newUserPassword").value,
          role: $("newUserRole").value,
        };
        const response = await hostRequest("/api/admin/users", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const payload = await readApiPayload(response);
        form.reset();
        showToast(`Created ${payload.user.displayName}'s account.`);
        await refreshAdminUsers();
      } catch (error) {
        showToast(error.message || "Could not create the account.");
      } finally { submit.disabled = false; }
    });

    if (!list) return;
    list.addEventListener("click", async (event) => {
      const toggleButton = event.target.closest("[data-toggle-user]");
      const resetButton = event.target.closest("[data-reset-user]");
      if (!toggleButton && !resetButton) return;
      if (activeUser?.role !== "admin") return showToast("Only administrators can manage accounts.");
      const row = event.target.closest("[data-user-row]");
      const userId = toggleButton?.dataset.toggleUser || resetButton?.dataset.resetUser;
      if (!row || !userId) return;
      const actionButton = toggleButton || resetButton;
      actionButton.disabled = true;
      try {
        if (toggleButton) {
          const disabled = toggleButton.dataset.nextDisabled === "true";
          if (!window.confirm(`${disabled ? "Disable" : "Enable"} this technician account?${disabled ? " The technician's active sessions will be revoked." : ""}`)) return;
          const response = await hostRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disabled }),
          });
          await readApiPayload(response);
          showToast(disabled ? "Technician account disabled." : "Technician account enabled.");
          await refreshAdminUsers();
        } else {
          const passwordInput = row.querySelector("[data-user-new-password]");
          const password = passwordInput?.value || "";
          if (password.length < 12) return showToast("Enter a new password of at least 12 characters.");
          if (!window.confirm("Set this account's password? The user will need to sign in with the new password.")) return;
          const response = await hostRequest(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
          });
          await readApiPayload(response);
          if (passwordInput) passwordInput.value = "";
          if (userId === activeUser?.id) {
            clearAccountSession();
            window.location.reload();
            return;
          }
          showToast("Password updated. The technician must sign in again.");
          await refreshAdminUsers();
        }
      } catch (error) {
        showToast(error.message || "That account action failed.");
      } finally {
        if (actionButton.isConnected) actionButton.disabled = false;
      }
    });
  }

  function setupEventListeners() {
    bindAutoSaveFields(eventFieldMap, "event");
    bindAutoSaveFields(handoffFieldMap, "shiftDraft");

    $("eventBookingForm")?.addEventListener("submit", handleBookingSubmit);
    $("cancelBookingEditBtn")?.addEventListener("click", cancelBookingEdit);
    $("roomForm")?.addEventListener("submit", handleRoomSubmit);
    $("equipmentForm")?.addEventListener("submit", handleEquipmentSubmit);
    $("maintenanceForm")?.addEventListener("submit", handleMaintenanceSubmit);
    $("venueSettingsForm")?.addEventListener("submit", handleVenueSettingsSubmit);
    document.addEventListener("change", handleVenueChange);
    document.addEventListener("change", handleMaintenanceOwnerChange);
    document.addEventListener("click", handleVenueClick);
    $("eventSearch")?.addEventListener("input", renderVenueEvents);
    $("eventStatusFilter")?.addEventListener("change", renderVenueEvents);
    $("calendarPrevBtn")?.addEventListener("click", () => { venueCalendarMonth = new Date(venueCalendarMonth.getFullYear(), venueCalendarMonth.getMonth() - 1, 1); renderVenueCalendar(); });
    $("calendarNextBtn")?.addEventListener("click", () => { venueCalendarMonth = new Date(venueCalendarMonth.getFullYear(), venueCalendarMonth.getMonth() + 1, 1); renderVenueCalendar(); });
    $("calendarTodayBtn")?.addEventListener("click", () => { venueCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderVenueCalendar(); });
    $("roomSearch")?.addEventListener("input", renderVenueRooms);
    $("equipmentSearch")?.addEventListener("input", renderVenueEquipment);
    $("equipmentStatusFilter")?.addEventListener("change", renderVenueEquipment);
    $("maintenanceSearch")?.addEventListener("input", renderVenueMaintenance);
    $("maintenanceStatusFilter")?.addEventListener("change", renderVenueMaintenance);

    // Crew schedule is visible to everyone; only its edit form is admin-visible.
    $("timeSheetForm")?.addEventListener("submit", addScheduledShift);
    $("scheduleRangeFilter")?.addEventListener("change", renderTimeSheet);
    $("scheduleSearch")?.addEventListener("input", renderTimeSheet);
    $("incomingTech")?.addEventListener("change", () => {
      state.shiftDraft.incoming = normalizeTechnicianSelection($("incomingTech").value);
      updateIncomingScheduleHint(false);
      saveState();
    });
    ["nextShiftDate", "nextShiftStart"].forEach((id) => $(id)?.addEventListener("change", () => {
      const scheduled = getScheduledShiftForNextStart();
      if (scheduled) {
        state.shiftDraft.incoming = scheduled.technicianUsername;
        renderIncomingTechnicianOptions(state.shiftDraft.incoming);
        $("incomingTech").value = state.shiftDraft.incoming;
        updateIncomingScheduleHint(false);
        saveState();
      } else {
        updateIncomingScheduleHint(false);
      }
    }));

    $("saveHandoffBtn").addEventListener("click", saveHandoff);

    $("checklistGrid").addEventListener("change", async (event) => {
      const checkbox = event.target.closest("[data-check]");
      if (!checkbox) return;
      const shift = getCurrentOrNextShiftForUser();
      if (!String(state.event?.name || "").trim() || !shift || checkbox.dataset.shiftId !== shift.id) {
        renderChecklist();
        showToast(!String(state.event?.name || "").trim()
          ? "An administrator must assign the active event before this checklist can be used."
          : "No shift is assigned to your account. Ask an administrator to add you to the crew schedule.");
        return;
      }
      if (!state.shiftChecks || typeof state.shiftChecks !== "object") state.shiftChecks = {};
      if (!state.shiftChecks[shift.id] || typeof state.shiftChecks[shift.id] !== "object") state.shiftChecks[shift.id] = {};
      const previousValue = Boolean(state.shiftChecks[shift.id][checkbox.dataset.check]);
      state.shiftChecks[shift.id][checkbox.dataset.check] = checkbox.checked;
      renderChecklist();
      if (await saveState({ immediate: true })) showToast(checkbox.checked ? "Shift checklist item saved." : "Shift checklist item unchecked and saved.");
      else {
        state.shiftChecks[shift.id][checkbox.dataset.check] = previousValue;
        renderChecklist();
      }
    });

    $("resetChecksBtn").addEventListener("click", async () => {
      if (!isAdmin()) return showToast("Only administrators can reset all checklist progress at once.");
      if (!window.confirm("Reset all technician checklist checks for this event? Handoff and incident history will remain.")) return;
      state.checks = {};
      state.shiftChecks = {};
      renderChecklist();
      if (await saveState({ immediate: true })) showToast("All shift checklist progress reset on the shared host.");
    });

    $("incidentForm").addEventListener("submit", addIncident);
    $("view-settings").addEventListener("submit", handleSettingsSubmit);
    $("view-settings").addEventListener("change", handleSettingsFieldChange);
    $("view-settings").addEventListener("click", handleSettingsClick);
    if ($("connectHostBtn")) $("connectHostBtn").addEventListener("click", connectToHost);
    if ($("disconnectHostBtn")) $("disconnectHostBtn").addEventListener("click", disconnectFromHost);
    $("incidentSearch").addEventListener("input", renderIncidents);
    $("incidentStatusFilter").addEventListener("change", renderIncidents);
    $("incidentPriorityFilter").addEventListener("change", renderIncidents);
    document.addEventListener("click", handleDocumentClick);

    $("newEventBtn").addEventListener("click", startNewEvent);
    $("refreshSharedBtn")?.addEventListener("click", refreshSharedRecord);
    $("logoutBtn")?.addEventListener("click", logoutFromBackstage);
    $("toggleEventDetailsBtn")?.addEventListener("click", () => {
      const expanded = $("toggleEventDetailsBtn").getAttribute("aria-expanded") !== "true";
      setEventDetailsExpanded(expanded);
    });
    $("printBtn").addEventListener("click", () => {
      $("actionMenu")?.removeAttribute("open");
      window.print();
    });
    $("exportBtn").addEventListener("click", () => {
      $("actionMenu")?.removeAttribute("open");
      exportBackup();
    });
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      $("actionMenu")?.removeAttribute("open");
      if (file) importBackup(file);
      event.target.value = "";
    });
    document.addEventListener("click", (event) => {
      const menu = $("actionMenu");
      if (menu?.open && !menu.contains(event.target)) menu.removeAttribute("open");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const menu = $("actionMenu");
      if (!menu?.open) return;
      menu.removeAttribute("open");
      menu.querySelector("summary")?.focus();
    });
  }

  // ===========================================================================
  // START APP
  // Load the host's saved event first (when available), then wire up the UI.
  // ===========================================================================
  async function initializeApp() {
    const isPublishedSite = Boolean(window.BACKSTAGE_STATIC_SITE);
    if (isPublishedSite) document.body.classList.add("authPending");
    let token = "";
    let loginHint = "";
    try {
      const signoutNotice = sessionStorage.getItem(SIGNOUT_NOTICE_KEY) || "";
      sessionStorage.removeItem(SIGNOUT_NOTICE_KEY);
      if (signoutNotice) loginHint = signoutNotice;
      token = sessionStorage.getItem(SESSION_KEY) || "";
    } catch (_) { /* sign in again if storage is unavailable */ }

    if (token) {
      const check = await validateSessionToken(token);
      if (check.ok) {
        activeSessionToken = token;
        activeUser = check.user;
        updateSessionIdentity();
        hideLoginPage();
      } else {
        clearAccountSession();
        loginHint = check.message || "Please sign in again.";
        token = "";
      }
    }

    while (true) {
      if (!token) {
        token = await requestAccountLogin(loginHint);
        activeSessionToken = token || "";
        if (!token) {
          loginHint = "A technician account is required to continue.";
          continue;
        }
      }
      try {
        state = await loadInitialState();
        if (!serverStorageEnabled) throw new Error("The required shared host did not connect.");
        // Older releases stored one shared unsaved draft, which let one tech's
        // typing overwrite another's. Drafts are now per-tab until Save handoff.
        state.shiftDraft = createBlankState().shiftDraft;
        state.shiftDraft.priority = state.settings.handoffPriorities[0] || "Routine";
        state.revision = serverRevision;
        break;
      } catch (error) {
        clearAccountSession();
        token = "";
        hostConnectionProblem = true;
        loginHint = `Cannot load shared data from ${FIXED_API_BASE_URL}. Check the API server and Cloudflare Tunnel. ${error.message || ""}`.trim();
        showLoginPage(loginHint);
      }
    }

    try {
      await refreshTechnicianDirectory();
    } catch (error) {
      console.error("Could not load active technician directory.", error);
      technicianDirectory = [];
      showToast("The technician list could not be loaded. Incoming assignments and the schedule may be unavailable until refresh.");
    }

    fillEventFields();
    fillHandoffDraft();
    renderVenueName();
    fillVenueRoomOptions();
    if (activeUser && $("maintenanceReporter")) $("maintenanceReporter").value = activeUser.displayName;
    if (activeUser) {
      if ($("outgoingTech")) {
        $("outgoingTech").value = activeUser.displayName;
        state.shiftDraft.outgoing = activeUser.displayName;
      }
      if ($("incidentReportedBy") && !$("incidentReportedBy").value) $("incidentReportedBy").value = activeUser.displayName;
    }
    setupEventListeners();
    setupAccountManagement();
    renderApp();
    switchView("operations");
    updateSessionIdentity();

    if (activeUser?.role === "admin") await refreshAdminUsers();
    if (serverStorageEnabled) {
      $("saveStatus").textContent = "Saved on host";
      $("saveStatus").className = "pill green";
      if (!state.updated) await saveState({ immediate: true });
    }
    if (isPublishedSite && serverStorageEnabled) document.body.classList.remove("authPending");
    renderApiConnectionPanel();
  }

  // The call sheet is time-sensitive even when nobody edits the record. Refresh
  // status labels locally each minute without overwriting shared data or drafts.
  window.setInterval(() => {
    if (!activeUser || !serverStorageEnabled || document.body.classList.contains("authPending")) return;
    if (activeView === "operations") renderOperationsBoard();
    else if (activeView === "schedule") renderTimeSheet();
  }, 60000);

  window.addEventListener("pageshow", (event) => {
    if (!window.BACKSTAGE_STATIC_SITE || !event.persisted) return;
    let hasToken = false;
    try { hasToken = Boolean(sessionStorage.getItem(SESSION_KEY)); } catch (_) { /* lock by default */ }
    if (!hasToken) {
      clearAccountSession();
      serverStorageEnabled = false;
      state = createBlankState();
      document.body.classList.add("authPending");
      showLoginPage("Your session is no longer active. Sign in again to access the shared theatre record.");
    }
  });

  window.addEventListener("error", (event) => {
    console.error("Backstage UI error:", event.error || event.message);
    if (serverStorageEnabled && !document.body.classList.contains("authPending")) {
      showToast("That action hit an application error. Check the browser console and try again.");
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Backstage action failed:", event.reason);
    if (serverStorageEnabled && !document.body.classList.contains("authPending")) {
      showToast(`Action failed: ${event.reason?.message || "unexpected error"}`);
    }
  });

  setupLoginPage();
  initializeApp();
})();
