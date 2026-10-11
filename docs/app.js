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
      title: "Take over the shift",
      description: "Get oriented before picking up active work.",
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
        { id: "update-phase", label: "Update the current event phase", help: "Set the current phase above to reflect what is actually happening now." },
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
  // When served by server.js, records are stored on the host computer and shared
  // by browsers using that server. When opened as a plain HTML file, the app
  // falls back to browser storage for quick/offline use.
  // ===========================================================================
  const STORAGE_KEY = "backstage-tech-handoff-v1";
  const PASSWORD_KEY = "backstage-host-password";
  const SIGNOUT_NOTICE_KEY = "backstage-signout-notice";
  const API_BASE_KEY = "backstage-host-api-base-v1";
  const FIXED_API_BASE_URL = "https://theatre-api.jvideo.dev";
  const $ = (id) => document.getElementById(id);
  let toastTimer;
  let saveTimer;
  let saveQueue = Promise.resolve();
  let serverStorageEnabled = false;
  let hostConnectionProblem = false;
  let activePassword = "";
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

  function createBlankState() {
    return {
      version: 1,
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
      handoffs: [],
      incidents: [],
      created: Date.now(),
      updated: null,
    };
  }

  function normalizeState(saved) {
    const blank = createBlankState();
    return {
      ...blank,
      ...saved,
      eventId: saved.eventId || blank.eventId,
      settings: normalizeSettings(saved.settings),
      event: { ...blank.event, ...(saved.event || {}) },
      shiftDraft: { ...blank.shiftDraft, ...(saved.shiftDraft || {}) },
      checks: saved.checks && typeof saved.checks === "object" ? saved.checks : {},
      handoffs: Array.isArray(saved.handoffs) ? saved.handoffs : [],
      incidents: Array.isArray(saved.incidents) ? saved.incidents : [],
    };
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

  // Shared-host sign-in is a branded full-page form, not a browser prompt.
  // The shared password stays in sessionStorage for this browser tab only.
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
    const hostLabel = $("loginHostName");
    if (hostLabel) hostLabel.textContent = window.BACKSTAGE_STATIC_SITE ? FIXED_API_BASE_URL : (getApiBaseUrl() || window.location.origin);
    setLoginMessage(message);
    screen.hidden = false;
    document.body.classList.add("loginOpen");
    const app = document.querySelector(".app");
    if (app) app.inert = true;
    window.requestAnimationFrame(() => $("loginPassword")?.focus());
  }

  function hideLoginPage() {
    const screen = $("loginScreen");
    if (screen) screen.hidden = true;
    document.body.classList.remove("loginOpen");
    const app = document.querySelector(".app");
    if (app) app.inert = false;
    const passwordInput = $("loginPassword");
    if (passwordInput) passwordInput.value = "";
    setLoginMessage("");
  }

  function requestPasswordLogin(message) {
    if (loginPromise) return loginPromise;
    loginPromise = new Promise((resolve) => { loginResolver = resolve; });
    const defaultPrompt = "Sign in to access the shared theatre record.";
    showLoginPage(message && message !== defaultPrompt ? message : "");
    return loginPromise;
  }

  function finishPasswordLogin(password) {
    const resolve = loginResolver;
    loginPromise = null;
    loginResolver = null;
    hideLoginPage();
    if (typeof resolve === "function") resolve(password);
  }

  async function validateAccessPassword(password) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(apiUrl("/api/state"), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { "X-Theatre-Password": password },
      });
      if (response.status === 401) {
        return { ok: false, message: "Incorrect password. Check it and try again." };
      }
      if (!response.ok) {
        let detail = "";
        try { detail = (await response.json()).error || ""; } catch (_) { /* ignore non-JSON replies */ }
        return { ok: false, message: detail || `The host returned an error (${response.status}).` };
      }
      return { ok: true, message: "" };
    } catch (error) {
      const detail = error?.name === "AbortError"
        ? "The theatre host did not respond within 12 seconds."
        : `Couldn't reach ${getApiBaseUrl() || window.location.origin}. Check that the host and Cloudflare Tunnel are running and that the website origin is allowed.`;
      return { ok: false, message: detail };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function setupLoginPage() {
    // The published GitHub Pages app must use the shared host; don't offer a
    // local-only bypass that would make a visitor think their changes were shared.
    const cancelButton = $("loginCancel");
    if (cancelButton && window.BACKSTAGE_STATIC_SITE) cancelButton.style.display = "none";

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
      const password = $("loginPassword").value;
      if (!password) {
        setLoginMessage("Enter the shared access password to continue.");
        $("loginPassword").focus();
        return;
      }

      const submitButton = $("loginSubmit");
      const originalLabel = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.textContent = "Checking password…";
      setLoginMessage("");
      const result = await validateAccessPassword(password);
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.innerHTML = originalLabel;

      if (!result.ok) {
        setLoginMessage(result.message);
        $("loginPassword").focus();
        return;
      }

      activePassword = password;
      try { sessionStorage.setItem(PASSWORD_KEY, password); } catch (_) { /* keep password in memory for this tab */ }
      if (reloadAfterLogin) {
        // Reload from the host's canonical record after connectivity is restored.
        // Any edits that the host did not accept are deliberately not revived locally.
        window.location.reload();
        return;
      }
      finishPasswordLogin(password);
    });

    if (cancelButton) cancelButton.addEventListener("click", () => {
      try { sessionStorage.removeItem(PASSWORD_KEY); } catch (_) { /* best effort */ }
      finishPasswordLogin(null);
    });
  }

  async function hostRequest(url, options = {}) {
    // On GitHub Pages, no input, localStorage value, or stale setting can change
    // the API hostname. Only API paths are allowed through this helper.
    if (window.BACKSTAGE_STATIC_SITE && !String(url).startsWith("/api/")) {
      throw new Error("The published site may contact only its configured theatre API.");
    }
    const targetUrl = window.BACKSTAGE_STATIC_SITE
      ? `${FIXED_API_BASE_URL}${url}`
      : (url.startsWith("/api/") ? apiUrl(url) : url);
    const headers = new Headers(options.headers || {});
    let password = activePassword;
    try { password = sessionStorage.getItem(PASSWORD_KEY) || activePassword || ""; } catch (_) { /* use the in-memory session */ }
    if (password) headers.set("X-Theatre-Password", password);

    let response = await fetch(targetUrl, { cache: "no-store", ...options, headers });
    while (response.status === 401) {
      const hadPassword = Boolean(headers.get("X-Theatre-Password"));
      try { sessionStorage.removeItem(PASSWORD_KEY); } catch (_) { /* best effort */ }
      activePassword = "";
      headers.delete("X-Theatre-Password");

      password = await requestPasswordLogin(hadPassword
        ? "That password was not accepted. Check it and try again."
        : "Sign in to access the shared theatre record.");
      if (password === null) {
        const error = new Error("Sign-in cancelled. Shared host storage is not connected.");
        error.hostUnavailable = true;
        throw error;
      }

      headers.set("X-Theatre-Password", password);
      response = await fetch(targetUrl, { cache: "no-store", ...options, headers });
    }

    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json()).error || ""; } catch (_) { /* response may not be JSON */ }
      const error = new Error(detail || `Host request failed (${response.status}).`);
      error.status = response.status;
      error.hostUnavailable = true;
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
      try { sessionStorage.removeItem(PASSWORD_KEY); } catch (_) { /* unavailable in private mode */ }
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
      $("saveStatus").textContent = hostConnectionProblem ? "HOST UNAVAILABLE · LOCAL ONLY" : "Saved in this browser";
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
    try { sessionStorage.removeItem(PASSWORD_KEY); } catch (_) { /* best effort */ }
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
    activePassword = "";
    try { sessionStorage.removeItem(PASSWORD_KEY); } catch (_) { /* best effort */ }
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
        $("saveStatus").textContent = "HOST REQUIRED · LOCKED";
        $("saveStatus").className = "pill red";
        lockStaticSiteAfterHostFailure("The shared host is not connected. Backstage is locked; it will not save in this browser. Check the API and sign in again.");
        return Promise.resolve(false);
      }
      $("saveStatus").textContent = hostConnectionProblem ? "HOST UNAVAILABLE · LOCAL ONLY" : "Saved in this browser";
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

    const snapshot = JSON.stringify(state);
    const request = saveQueue.catch(() => undefined).then(() => hostRequest("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: snapshot,
    }));
    saveQueue = request;

    try {
      await request;
      hostConnectionProblem = false;
      $("saveStatus").textContent = "Saved on host";
      $("saveStatus").className = "pill green";
      return true;
    } catch (error) {
      hostConnectionProblem = true;
      $("saveStatus").textContent = "HOST SAVE FAILED";
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
    const phase = settings.eventPhases.includes(state.event.status) ? state.event.status : settings.eventPhases[0];
    state.event.status = phase;
    setSelectOptions($("eventStatus"), settings.eventPhases, phase);

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
  function fillEventFields() {
    renderDynamicOptions();
    Object.entries(eventFieldMap).forEach(([elementId, stateKey]) => {
      $(elementId).value = state.event[stateKey] ?? "";
    });
  }

  function fillHandoffDraft() {
    renderDynamicOptions();
    Object.entries(handoffFieldMap).forEach(([elementId, stateKey]) => {
      $(elementId).value = state.shiftDraft[stateKey] ?? "";
    });
  }

  function bindAutoSaveFields(fieldMap, targetObjectName) {
    Object.entries(fieldMap).forEach(([elementId, stateKey]) => {
      const field = $(elementId);
      const eventName = field.tagName === "SELECT" ? "change" : "input";
      field.addEventListener(eventName, () => {
        state[targetObjectName][stateKey] = field.value;
        saveState();
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
    if (!draft.outgoing.trim() || !draft.summary.trim() || !draft.nextActions.trim()) {
      showToast("Add the outgoing technician, current situation, and next shift priorities first.");
      const requiredField = !draft.outgoing.trim() ? "outgoingTech" : !draft.summary.trim() ? "currentStatus" : "nextActions";
      $(requiredField).focus();
      return;
    }

    const entry = {
      id: createId(),
      savedAt: Date.now(),
      event: { ...state.event },
      ...draft,
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
    const recipient = entry.incoming?.trim() || "Incoming technician not named";
    const acknowledgement = entry.reviewed
      ? `<span class="ackStatus">✓ Read by ${escapeHtml(entry.reviewedBy || "incoming technician")} · ${escapeHtml(formatDateTime(entry.reviewedAt))}</span>`
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
            <div class="historyMeta">Shift time: ${escapeHtml(entry.shiftEnd || "Not given")} · Next shift: ${escapeHtml(entry.nextStart || "Not given")} · Event phase: ${escapeHtml(status)}</div>
          </div>
          <span class="pill ${priorityClass(priority)}">${escapeHtml(priority)}</span>
        </div>
        <div class="historyBody">${body || "<div class=\"multiline\">No extra handoff notes recorded.</div>"}</div>
        <div class="historyActions">
          ${acknowledgement}
          <span style="flex:1"></span>
          <button type="button" class="btn small" data-load-handoff="${escapeHtml(entry.id)}">Load into draft</button>
          <button type="button" class="btn small" data-ack-handoff="${escapeHtml(entry.id)}">${entry.reviewed ? "Undo acknowledgement" : "Acknowledge read"}</button>
          <button type="button" class="btn small danger" data-delete-handoff="${escapeHtml(entry.id)}">Delete</button>
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
  }

  async function loadHandoffIntoDraft(id) {
    const entry = state.handoffs.find((handoff) => handoff.id === id);
    if (!entry) return;
    Object.keys(state.shiftDraft).forEach((key) => {
      if (typeof entry[key] !== "undefined") state.shiftDraft[key] = entry[key];
    });
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
      entry.reviewedAt = null;
    } else {
      const suggestedName = entry.incoming || state.shiftDraft.incoming || "";
      const reviewer = window.prompt("Who has read this handoff? Enter name or initials:", suggestedName);
      if (reviewer === null || !reviewer.trim()) return;
      entry.reviewed = true;
      entry.reviewedBy = reviewer.trim();
      entry.reviewedAt = Date.now();
    }

    renderHandoffs();
    const saved = await saveState({ immediate: true });
    if (saved) showToast(entry.reviewed ? "Handoff acknowledgement saved." : "Handoff acknowledgement updated.");
  }

  // ===========================================================================
  // TECHNICIAN CHECKLIST
  // ===========================================================================
  function getChecklistProgress() {
    let total = 0;
    let completed = 0;
    getChecklistSections().forEach((section) => section.items.forEach((item) => {
      total += 1;
      if (state.checks[item.id]) completed += 1;
    }));
    return { total, completed };
  }

  function renderChecklist() {
    $("checklistGrid").innerHTML = getChecklistSections().map((section) => {
      const completed = section.items.filter((item) => state.checks[item.id]).length;
      const percent = section.items.length ? (completed / section.items.length) * 100 : 0;
      const items = section.items.map((item) => `
        <label class="checkitem ${state.checks[item.id] ? "done" : ""}">
          <input type="checkbox" data-check="${escapeHtml(item.id)}" ${state.checks[item.id] ? "checked" : ""}>
          <span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.help)}</small></span>
        </label>
      `).join("");

      return `
        <article class="card checkCard">
          <div class="checkHeader"><div><h3>${escapeHtml(section.title)}</h3><div class="checkDesc">${escapeHtml(section.description)}</div></div><span class="count">${completed} / ${section.items.length}</span></div>
          <div class="progress"><span style="width:${percent}%"></span></div>
          ${items}
        </article>
      `;
    }).join("");

    const progress = getChecklistProgress();
    const percent = progress.total ? progress.completed / progress.total * 100 : 0;
    $("overallProgress").textContent = `${progress.completed} / ${progress.total}`;
    $("overallProgressBar").style.width = `${percent}%`;
    $("checkNavCount").textContent = `${Math.round(percent)}%`;
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
        <div class="settingsSectionHead"><div><span class="eyebrow">CHECKLIST SECTION</span><p class="settingsHint">Changes save when you leave a field.</p></div><button type="button" class="btn danger small" data-delete-section="${escapeHtml(section.id)}">Delete section</button></div>
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
          <button class="btn primary small" type="submit">＋ Add task</button>
        </form>
      </article>
    `).join("") : `<div class="empty"><strong>No checklist sections</strong>Add a section below to build your technician checklist.</div>`;

    renderEditableOptionList("eventPhasesList", "eventPhases");
    renderEditableOptionList("incidentCategoriesList", "incidentCategories");
    renderEditableOptionList("incidentPrioritiesList", "incidentPriorities");
    renderEditableOptionList("handoffPrioritiesList", "handoffPriorities");
  }

  function renderSettings() {
    renderChecklistSettings();
    renderApiConnectionPanel();
  }

  async function handleSettingsFieldChange(event) {
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
      renderIncidentDetail("Action taken", incident.action),
      renderIncidentDetail("Follow-up owner / notified", incident.owner),
    ].filter(Boolean).join("");
    const resolvedText = incident.resolved
      ? `Resolved by ${escapeHtml(incident.resolvedBy || "staff member")} · ${escapeHtml(formatDateTime(incident.resolvedAt))}`
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
            <button type="button" class="btn small danger" data-delete-incident="${escapeHtml(incident.id)}">Delete</button>
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
  }

  async function toggleIncidentResolved(id) {
    const incident = state.incidents.find((item) => item.id === id);
    if (!incident) return;

    if (!incident.resolved) {
      const name = window.prompt("Who is resolving this incident? Enter name or initials:", state.shiftDraft.outgoing || "");
      if (name === null) return;
      incident.resolvedBy = name.trim() || "Staff member";
      incident.resolvedAt = Date.now();
      incident.resolved = true;
    } else {
      incident.resolved = false;
      incident.resolvedBy = "";
      incident.resolvedAt = null;
    }
    renderIncidents();
    const saved = await saveState({ immediate: true });
    if (saved) showToast(incident.resolved ? "Incident marked resolved and saved." : "Incident reopened and saved.");
  }

  // ===========================================================================
  // NAVIGATION, EXPORT / IMPORT, AND EVENT LISTENERS
  // ===========================================================================
  function switchView(viewName) {
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));

    const pageInfo = {
      handoff: { crumb: "RENTAL OPERATIONS / SHIFT HANDOFF", title: "Shift handoff", sub: "Leave the next technician a clear picture of the event, outstanding work, and anything that needs attention." },
      checklist: { crumb: "RENTAL OPERATIONS / TECH CHECKLIST", title: "Technician checklist", sub: "Take over, support the event, and close out your shift without leaving gaps." },
      incidents: { crumb: "RENTAL OPERATIONS / INCIDENT LOG", title: "Incident log", sub: "Track technical issues, hazards, immediate actions, and open follow-up work." },
      settings: { crumb: "RENTAL OPERATIONS / CUSTOMIZE", title: "Customize Backstage", sub: "Edit checklist tasks and dropdown choices without editing source code." },
    }[viewName] || { crumb: "RENTAL OPERATIONS", title: "Backstage", sub: "Technician tools for event rentals." };
    $("breadcrumb").textContent = pageInfo.crumb;
    $("pageTitle").textContent = pageInfo.title;
    $("pageSub").textContent = pageInfo.sub;
  }

  async function startNewEvent() {
    const message = serverStorageEnabled
      ? "Start a new shared event? A JSON backup will download, and the host will archive the previous event. This replaces the current record for everyone using this host."
      : "Start a new event? A JSON backup of the current event will download first. The current event details, checklist checks, handoffs, and incidents will then be cleared from this browser.";
    const confirmed = window.confirm(message);
    if (!confirmed) return;

    // Preserve a copy of the current event before switching the browser to a blank record.
    exportBackup();
    const savedSettings = state.settings;
    state = createBlankState();
    state.settings = savedSettings; // Configuration belongs to the venue, not one event.
    state.event.status = savedSettings.eventPhases[0];
    state.shiftDraft.priority = savedSettings.handoffPriorities[0];
    const saved = await saveState({ immediate: true }); // Host archives the previous event before replacing it.
    if (!saved) return;
    fillEventFields();
    fillHandoffDraft();
    renderApp();
    $("handoffDraftState").textContent = "Draft";
    showToast("New event started on the shared host. The previous event backup was downloaded.");
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

    const loadButton = event.target.closest("[data-load-handoff]");
    if (loadButton) loadHandoffIntoDraft(loadButton.dataset.loadHandoff);

    const acknowledgeButton = event.target.closest("[data-ack-handoff]");
    if (acknowledgeButton) toggleHandoffAcknowledgement(acknowledgeButton.dataset.ackHandoff);

    const deleteHandoffButton = event.target.closest("[data-delete-handoff]");
    if (deleteHandoffButton) {
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
    renderChecklist();
    renderHandoffs();
    renderIncidents();
    $("lastSaved").textContent = state.updated ? new Date(state.updated).toLocaleString() : "Not saved yet";
    $("recordId").textContent = (state.eventId || "NEW").slice(0, 8).toUpperCase();
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

    let password = activePassword;
    try { password = sessionStorage.getItem(PASSWORD_KEY) || activePassword || ""; } catch (_) { /* use in-memory password */ }
    let warning = "";

    // Flush the latest draft before removing the shared password. Wait briefly
    // for any debounced/in-flight save, then send one final authenticated write.
    clearTimeout(saveTimer);
    saveTimer = null;
    if (serverStorageEnabled && password) {
      try {
        await Promise.race([
          saveQueue.catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        state.updated = Date.now();
        const snapshot = JSON.stringify(state);
        const endpoint = window.BACKSTAGE_STATIC_SITE ? `${FIXED_API_BASE_URL}/api/state` : apiUrl("/api/state");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        let response;
        try {
          response = await fetch(endpoint, {
            method: "PUT",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "X-Theatre-Password": password,
            },
            body: snapshot,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        if (!response.ok) throw new Error(`The host returned ${response.status}.`);
      } catch (error) {
        console.warn("Could not confirm the final save during logout.", error);
        warning = "Signed out, but Backstage could not confirm the latest changes were saved. Sign in again and verify the event record.";
      }
    } else if (window.BACKSTAGE_STATIC_SITE) {
      warning = "Signed out. The host was not connected, so verify that your latest changes were saved before leaving.";
    }

    activePassword = "";
    reloadAfterLogin = false;
    try {
      sessionStorage.removeItem(PASSWORD_KEY);
      sessionStorage.removeItem(SIGNOUT_NOTICE_KEY);
      if (warning) sessionStorage.setItem(SIGNOUT_NOTICE_KEY, warning);
    } catch (_) { /* sign out continues even if session storage is unavailable */ }

    // Clear the rendered page and in-memory record before navigating back to
    // the login gate. The next load starts locked and cannot use a local cache.
    state = createBlankState();
    serverStorageEnabled = false;
    document.body.classList.add("authPending");
    showLoginPage(warning);
    window.location.reload();
  }

  function setupEventListeners() {
    bindAutoSaveFields(eventFieldMap, "event");
    bindAutoSaveFields(handoffFieldMap, "shiftDraft");

    $("saveHandoffBtn").addEventListener("click", saveHandoff);

    $("checklistGrid").addEventListener("change", async (event) => {
      const checkbox = event.target.closest("[data-check]");
      if (!checkbox) return;
      state.checks[checkbox.dataset.check] = checkbox.checked;
      renderChecklist();
      if (await saveState({ immediate: true })) showToast(checkbox.checked ? "Checklist item saved." : "Checklist item unchecked and saved.");
    });

    $("resetChecksBtn").addEventListener("click", async () => {
      if (!window.confirm("Reset all technician checklist checks for this event? Handoff and incident history will remain.")) return;
      state.checks = {};
      renderChecklist();
      if (await saveState({ immediate: true })) showToast("Technician checklist reset on the shared host.");
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
    $("logoutBtn")?.addEventListener("click", logoutFromBackstage);
    $("printBtn").addEventListener("click", () => window.print());
    $("exportBtn").addEventListener("click", exportBackup);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) importBackup(file);
      event.target.value = "";
    });
  }

  // ===========================================================================
  // START APP
  // Load the host's saved event first (when available), then wire up the UI.
  // ===========================================================================
  async function initializeApp() {
    const isPublishedSite = Boolean(window.BACKSTAGE_STATIC_SITE);

    if (isPublishedSite) {
      // Fail closed from first paint. No checklist, incident data, or settings are
      // exposed until the fixed remote API authenticates and supplies the record.
      document.body.classList.add("authPending");
      let password = "";
      let loginHint = "Sign in to access the shared theatre record.";
      try {
        const signoutNotice = sessionStorage.getItem(SIGNOUT_NOTICE_KEY) || "";
        sessionStorage.removeItem(SIGNOUT_NOTICE_KEY);
        if (signoutNotice) loginHint = signoutNotice;
        password = sessionStorage.getItem(PASSWORD_KEY) || "";
      } catch (_) { /* login again if session storage is unavailable */ }

      if (password) {
        const rememberedCheck = await validateAccessPassword(password);
        if (rememberedCheck.ok) {
          activePassword = password;
          hideLoginPage();
        } else {
          password = "";
          activePassword = "";
          try { sessionStorage.removeItem(PASSWORD_KEY); } catch (_) { /* best effort */ }
          loginHint = rememberedCheck.message || "Please sign in to continue.";
        }
      }

      while (true) {
        if (!password) {
          password = await requestPasswordLogin(loginHint);
          activePassword = password || "";
        }
        try {
          state = await loadInitialState();
          if (!serverStorageEnabled) throw new Error("The required shared host did not connect.");
          break;
        } catch (error) {
          password = "";
          activePassword = "";
          try { sessionStorage.removeItem(PASSWORD_KEY); } catch (_) { /* best effort */ }
          hostConnectionProblem = true;
          loginHint = `Cannot access ${FIXED_API_BASE_URL}. Browser-only mode is disabled. Check the API server and Cloudflare Tunnel, then sign in again. ${error.message || ""}`.trim();
        }
      }
    } else {
      state = await loadInitialState();
    }

    fillEventFields();
    fillHandoffDraft();
    setupEventListeners();
    renderApp();

    if (serverStorageEnabled) {
      $("saveStatus").textContent = "Saved on host";
      $("saveStatus").className = "pill green";
      if (!state.updated) saveState(); // Create the first host record.
    } else {
      $("saveStatus").textContent = hostConnectionProblem ? "HOST UNAVAILABLE · LOCAL ONLY" : "Saved in this browser";
      $("saveStatus").className = hostConnectionProblem ? "pill red" : "pill green";
      if (hostConnectionProblem) {
        showToast("Could not connect to host storage. Changes are local-only; reload after checking the host connection.");
      }
    }

    // Remove the first-paint lock only after the remote record has loaded.
    if (isPublishedSite && serverStorageEnabled) document.body.classList.remove("authPending");
    renderApiConnectionPanel();
  }

  window.addEventListener("pageshow", (event) => {
    if (!window.BACKSTAGE_STATIC_SITE || !event.persisted) return;
    let hasPassword = false;
    try { hasPassword = Boolean(sessionStorage.getItem(PASSWORD_KEY)); } catch (_) { /* lock by default */ }
    if (!hasPassword) {
      activePassword = "";
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
