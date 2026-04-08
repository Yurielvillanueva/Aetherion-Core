const panelButtons = document.querySelectorAll('.sidebar-nav button');
const panels = document.querySelectorAll('.admin-panel');
const logoutButton = document.getElementById('logout');
const summaryUsers = document.getElementById('summary-users');
const summaryItems = document.getElementById('summary-items');
const summaryStaff = document.getElementById('summary-staff');
const adminServerStatus = document.getElementById('admin-server-status');
const adminPlayerCount = document.getElementById('admin-player-count');
const adminLogSample = document.getElementById('admin-log-sample');
const usersTable = document.getElementById('users-table');
const refreshUsersBtn = document.getElementById('refresh-users');
const newUserBtn = document.getElementById('new-user');
const refreshActivityBtn = document.getElementById('refresh-activity');
const auditLogList = document.getElementById('audit-log-list');
const loginHistoryList = document.getElementById('login-history-list');
const shopTable = document.getElementById('shop-table');
const staffTable = document.getElementById('staff-table');
const kitNameInput = document.getElementById('kit-name');
const createKitBtn = document.getElementById('create-kit');
const deleteKitBtn = document.getElementById('delete-kit');
const refreshKitsHelpBtn = document.getElementById('refresh-kits-help');
const kitActionStatus = document.getElementById('kit-action-status');
const shopForm = document.getElementById('shop-form');
const staffForm = document.getElementById('staff-form');
const newShopItem = document.getElementById('new-shop-item');
const newStaffMember = document.getElementById('new-staff-member');
const shopCancel = document.getElementById('shop-cancel');
const staffCancel = document.getElementById('staff-cancel');
const shopFormTitle = document.getElementById('shop-form-title');
const staffFormTitle = document.getElementById('staff-form-title');
const shopFormFields = shopForm ? shopForm.elements : null;
const staffFormFields = staffForm ? staffForm.elements : null;
const consoleLog = document.getElementById('console-log');
const consoleForm = document.getElementById('console-form');
const consoleCommand = document.getElementById('console-command');
const jarWarning = document.getElementById('jar-warning');
const fileList = document.getElementById('file-list');
const filePathTitle = document.getElementById('file-path-title');
const fileEditor = document.getElementById('file-editor');
const saveFileButton = document.getElementById('save-file');
const deleteFileButton = document.getElementById('delete-file');
const uploadForm = document.getElementById('upload-form');
const fileUploadInput = document.getElementById('file-upload');
const startServerBtn = document.getElementById('start-server');
const stopServerBtn = document.getElementById('stop-server');
const restartServerBtn = document.getElementById('restart-server');

let activePanel = 'dashboard';
let selectedFile = null;
let currentFolder = '.';
let editShopId = null;
let editStaffId = null;
let ws = null;
let lastOfficialErrorSummary = '';
let lastOfficialErrorAt = 0;
let dashboardErrorLines = [];
const DASHBOARD_ERROR_LIMIT = 120;
const SESSION_KEEPALIVE_MS = 5 * 60 * 1000;
let keepaliveTimer = null;

function redirectToLogin(message = 'Session expired. Please log in again.') {
  appendConsoleMessage(message);
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 300);
}

function showPanel(panelName) {
  panels.forEach(panel => panel.classList.remove('active'));
  document.getElementById(panelName).classList.add('active');
  panelButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.panel === panelName));
}

async function checkAuth() {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  const json = await response.json();
  if (!json.success || !json.user || json.user.role !== 'admin') {
    window.location.href = '/login.html';
    return;
  }
}

async function loadDashboard() {
  const [statusRes, playersRes, usersRes, shopRes, staffRes, logsRes] = await Promise.all([
    fetch('/api/server/status').then(r => r.json()),
    fetch('/api/server/players').then(r => r.json()),
    fetch('/api/users').then(r => r.json()),
    fetch('/api/shop').then(r => r.json()),
    fetch('/api/staff').then(r => r.json()),
    fetch('/api/server/logs').then(r => r.json())
  ]);
  adminServerStatus.textContent = statusRes.online ? 'Online' : 'Offline';
  adminPlayerCount.textContent = statusRes.online ? playersRes.players.length : '0';
  summaryUsers.textContent = usersRes.users ? usersRes.users.length : 0;
  summaryItems.textContent = shopRes.items ? shopRes.items.length : 0;
  summaryStaff.textContent = staffRes.staff ? staffRes.staff.length : 0;

  if (!statusRes.jarExists) {
    jarWarning.textContent = `Minecraft jar not found in ${statusRes.serverPath}. Place a valid .jar file there (for example purpur-1.21.11-2566.jar or server.jar) to use live console and controls.`;
    jarWarning.style.display = 'block';
    startServerBtn.disabled = true;
    stopServerBtn.disabled = true;
    restartServerBtn.disabled = true;
  } else {
    jarWarning.textContent = '';
    jarWarning.style.display = 'none';
    startServerBtn.disabled = false;
    stopServerBtn.disabled = !statusRes.online;
    restartServerBtn.disabled = !statusRes.online;
  }

  if (logsRes.logs && logsRes.logs.length) {
    dashboardErrorLines = buildDashboardErrorFeed(logsRes.logs.slice(-200));
    renderDashboardErrorFeed();
  } else {
    adminLogSample.textContent = 'No recent logs available.';
  }
}

function renderUsers(users) {
  usersTable.innerHTML = users.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>${user.isBanned ? 'Banned' : user.isRestricted ? 'Restricted' : user.isMuted ? 'Muted' : 'Active'}</td>
      <td>
        <button data-id="${user.id}" data-action="admin" class="button button-secondary small-button">Admin</button>
        <button data-id="${user.id}" data-action="staff" class="button button-secondary small-button">Staff</button>
        <button data-id="${user.id}" data-action="user" class="button button-secondary small-button">User</button>
        <button data-id="${user.id}" data-action="${user.isBanned ? 'unban' : 'ban'}" class="button button-danger small-button">${user.isBanned ? 'Unban' : 'Ban'}</button>
        <button data-id="${user.id}" data-action="${user.isMuted ? 'unmute' : 'mute'}" class="button button-secondary small-button">${user.isMuted ? 'Unmute' : 'Mute'}</button>
        <button data-id="${user.id}" data-action="${user.isRestricted ? 'unrestrict' : 'restrict'}" class="button button-secondary small-button">${user.isRestricted ? 'Unrestrict' : 'Restrict'}</button>
        <button data-id="${user.id}" data-action="edit-user" class="button button-secondary small-button">Edit</button>
        <button data-id="${user.id}" data-action="toggle-console" class="button button-muted small-button">Console ${user.permissions?.can_view_console ? 'On' : 'Off'}</button>
        <button data-id="${user.id}" data-action="toggle-files" class="button button-muted small-button">Files ${user.permissions?.can_edit_files ? 'On' : 'Off'}</button>
        <button data-id="${user.id}" data-action="toggle-users" class="button button-muted small-button">Users ${user.permissions?.can_manage_users ? 'On' : 'Off'}</button>
        <button data-id="${user.id}" data-email="${user.email}" data-action="copy-email" class="button button-muted small-button">Copy Email</button>
        <button data-id="${user.id}" data-action="reset-password" class="button button-secondary small-button">Reset PW</button>
        <button data-id="${user.id}" data-action="delete" class="button button-danger small-button">Delete</button>
      </td>
    </tr>`).join('');
}

function renderShop(items) {
  shopTable.innerHTML = items.map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${item.price}</td>
      <td>${item.description}</td>
      <td>
        <button data-id="${item.id}" data-action="edit" class="button button-secondary small-button">Edit</button>
        <button data-id="${item.id}" data-action="delete" class="button button-danger small-button">Delete</button>
      </td>
    </tr>`).join('');
}

function renderStaff(members) {
  staffTable.innerHTML = members.map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${item.username}</td>
      <td>${item.role}</td>
      <td><img src="${item.avatar}" alt="avatar" class="avatar-small" /></td>
      <td>
        <button data-id="${item.id}" data-action="edit" class="button button-secondary small-button">Edit</button>
        <button data-id="${item.id}" data-action="delete" class="button button-danger small-button">Delete</button>
      </td>
    </tr>`).join('');
}

async function loadUsers() {
  const response = await fetch('/api/users');
  const json = await response.json();
  renderUsers(json.users || []);
}

async function loadActivityLogs() {
  const [auditRes, loginRes] = await Promise.all([
    fetch('/api/users/activity/audit').then(r => r.json()),
    fetch('/api/users/activity/login-history').then(r => r.json())
  ]);

  const auditRows = (auditRes.logs || []).slice(0, 120).map(row => {
    const actor = row.actorUsername || 'system';
    const target = row.targetType && row.targetId ? ` ${row.targetType}:${row.targetId}` : '';
    return `[${row.createdAt}] ${actor} -> ${row.action}${target}`;
  });
  auditLogList.textContent = auditRows.length ? auditRows.join('\n') : 'No audit logs yet.';

  const loginRows = (loginRes.entries || []).slice(0, 120).map(row => {
    const state = row.success ? 'SUCCESS' : 'FAILED';
    return `[${row.createdAt}] ${state} ${row.email || 'unknown'} (${row.reason || 'n/a'}) ${row.ip || ''}`.trim();
  });
  loginHistoryList.textContent = loginRows.length ? loginRows.join('\n') : 'No login history yet.';
}

async function loadShopItems() {
  const response = await fetch('/api/shop');
  const json = await response.json();
  renderShop(json.items || []);
}

async function loadStaffMembers() {
  const response = await fetch('/api/staff');
  const json = await response.json();
  renderStaff(json.staff || []);
}

async function loadFileList(folder = '.') {
  currentFolder = folder;
  const response = await fetch(`/api/files/list?path=${encodeURIComponent(folder)}`);
  const json = await response.json();
  if (!json.success) return;
  fileList.innerHTML = json.files.map(file => `
    <li data-name="${file.name}" data-dir="${file.isDirectory}" data-path="${folder}">${file.isDirectory ? '📁' : '📄'} ${file.name}</li>
  `).join('');
  filePathTitle.textContent = `Folder: ${folder}`;
}

async function readFile(filePath) {
  const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
  const json = await response.json();
  if (!json.success) return;
  selectedFile = filePath;
  fileEditor.value = json.content;
  filePathTitle.textContent = `Editing: ${filePath}`;
}

async function sendCommand(command) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'command', command }));
  }
}

async function startServer() {
  try {
    const response = await fetch('/api/server/start', { method: 'POST', credentials: 'same-origin' });
    if (response.status === 401) {
      redirectToLogin('Session expired while starting server.');
      return;
    }
    if (!response.ok) {
      const text = await response.text();
      appendConsoleMessage(`Error: HTTP ${response.status} - ${text.substring(0, 100)}`);
      return;
    }
    const json = await response.json();
    if (json.success) appendConsoleMessage('Server start command sent.');
    else appendConsoleMessage('Error: ' + (json.error || 'Unknown error'));
  } catch (err) {
    appendConsoleMessage('Failed to send start command: ' + err.message);
  }
}

async function stopServer() {
  try {
    const response = await fetch('/api/server/stop', { method: 'POST', credentials: 'same-origin' });
    if (response.status === 401) {
      redirectToLogin('Session expired while stopping server.');
      return;
    }
    if (!response.ok) {
      const text = await response.text();
      appendConsoleMessage(`Error: HTTP ${response.status} - ${text.substring(0, 100)}`);
      return;
    }
    const json = await response.json();
    if (json.success) appendConsoleMessage('Server stop command sent.');
    else appendConsoleMessage('Error: ' + (json.error || 'Unknown error'));
  } catch (err) {
    appendConsoleMessage('Failed to send stop command: ' + err.message);
  }
}

async function restartServer() {
  try {
    const response = await fetch('/api/server/restart', { method: 'POST', credentials: 'same-origin' });
    if (response.status === 401) {
      redirectToLogin('Session expired while restarting server.');
      return;
    }
    if (!response.ok) {
      const text = await response.text();
      appendConsoleMessage(`Error: HTTP ${response.status} - ${text.substring(0, 100)}`);
      return;
    }
    const json = await response.json();
    if (json.success) appendConsoleMessage('Server restart command sent.');
    else appendConsoleMessage('Error: ' + (json.error || 'Unknown error'));
  } catch (err) {
    appendConsoleMessage('Failed to send restart command: ' + err.message);
  }
}

function stripAnsiCodes(text) {
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

async function sendServerCommandViaApi(command) {
  const response = await fetch('/api/server/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ command })
  });
  const json = await parseApiJson(response);
  if (!response.ok || !json.success) throw new Error(json.error || 'Command failed');
  return json;
}

async function parseApiJson(response) {
  if (response.status === 401) {
    redirectToLogin();
    throw new Error('Authentication required');
  }
  const rawText = await response.text();
  let json;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
      throw new Error('Session expired or API route returned HTML. Please log in again and refresh.');
    }
    throw new Error(`Unexpected server response (HTTP ${response.status}).`);
  }
  return json;
}

function getKitNameInput() {
  return String(kitNameInput?.value || '').trim();
}

async function createKitFromPanel() {
  const name = getKitNameInput();
  if (!name) {
    kitActionStatus.textContent = 'Enter a kit name first.';
    return;
  }
  try {
    const response = await fetch('/api/server/kits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name })
    });
    const json = await parseApiJson(response);
    if (!response.ok || !json.success) throw new Error(json.error || 'Unable to create kit');
    kitActionStatus.textContent = json.message || `Kit created: ${name}`;
    appendConsoleMessage(`[KIT] ${kitActionStatus.textContent}`);
  } catch (error) {
    kitActionStatus.textContent = error.message;
    appendConsoleMessage(`[KIT] Create failed: ${error.message}`);
  }
}

async function deleteKitFromPanel() {
  const name = getKitNameInput();
  if (!name) {
    kitActionStatus.textContent = 'Enter a kit name first.';
    return;
  }
  const confirmDelete = confirm(`Delete kit "${name}"?`);
  if (!confirmDelete) return;
  try {
    const response = await fetch(`/api/server/kits/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const json = await parseApiJson(response);
    if (!response.ok || !json.success) throw new Error(json.error || 'Unable to delete kit');
    kitActionStatus.textContent = json.message || `Kit deleted: ${name}`;
    appendConsoleMessage(`[KIT] ${kitActionStatus.textContent}`);
  } catch (error) {
    kitActionStatus.textContent = error.message;
    appendConsoleMessage(`[KIT] Delete failed: ${error.message}`);
  }
}

async function showKitsHelp() {
  try {
    const response = await fetch('/api/server/kits/help', {
      method: 'POST',
      credentials: 'same-origin'
    });
    const json = await parseApiJson(response);
    if (!response.ok || !json.success) throw new Error(json.error || 'Unable to show kits help');
    kitActionStatus.textContent = json.message || 'Sent /kits command.';
  } catch (error) {
    kitActionStatus.textContent = error.message;
  }
}

function extractPluginName(logLine) {
  const candidates = [
    /Error occurred while enabling ([A-Za-z0-9_.-]+)\s+v/i,
    /at ([A-Za-z0-9_.-]+)-\d[\w.-]*\.jar/i,
    /\[([A-Za-z0-9_.-]+)\]\s/i
  ];

  for (const regex of candidates) {
    const match = logLine.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

function buildOfficialErrorSummary(rawLine) {
  const line = stripAnsiCodes(rawLine || '').replace(/\s+/g, ' ').trim();
  if (!line) return null;

  const enableOutdated = line.match(/Error occurred while enabling ([A-Za-z0-9_.-]+)\s+v([^\s]+).*Is it up to date\?/i);
  if (enableOutdated) {
    return `[Error] ${enableOutdated[1]} Out of date.`;
  }

  if (/IllegalPluginAccessException/i.test(line) && /register task while disabled/i.test(line)) {
    const plugin = extractPluginName(line);
    return plugin
      ? `[Error] ${plugin} attempted to register a task while disabled.`
      : '[Error] A plugin attempted to register a task while disabled.';
  }

  if (/NoClassDefFoundError|ClassNotFoundException/i.test(line)) {
    const plugin = extractPluginName(line);
    return plugin
      ? `[Error] ${plugin} is missing a required dependency.`
      : '[Error] A plugin is missing a required dependency.';
  }

  if (/NoSuchMethodError|UnsupportedClassVersionError/i.test(line)) {
    const plugin = extractPluginName(line);
    return plugin
      ? `[Error] ${plugin} is built for a different server or Java version.`
      : '[Error] A plugin is built for a different server or Java version.';
  }

  return null;
}

function shouldAppendOfficialSummary(summary) {
  const now = Date.now();
  const isDuplicate = summary === lastOfficialErrorSummary && (now - lastOfficialErrorAt) < 8000;
  if (isDuplicate) return false;
  lastOfficialErrorSummary = summary;
  lastOfficialErrorAt = now;
  return true;
}

function enrichLogLinesWithOfficialErrors(lines) {
  const output = [];
  const seen = new Set();
  lines.forEach(line => {
    const clean = stripAnsiCodes(line);
    output.push(clean);
    const summary = buildOfficialErrorSummary(clean);
    if (summary && !seen.has(summary)) {
      output.push(summary);
      seen.add(summary);
    }
  });
  return output;
}

function isErrorLogLine(rawLine) {
  const line = stripAnsiCodes(rawLine || '');
  return /\bERROR\b|Exception|NoClassDefFoundError|ClassNotFoundException|IllegalPluginAccessException|Failed to|Could not|\[Error\]/i.test(line);
}

function renderDashboardErrorFeed() {
  if (!adminLogSample) return;
  adminLogSample.textContent = dashboardErrorLines.length
    ? dashboardErrorLines.join('\n')
    : 'No recent errors or warnings.';
}

function pushDashboardErrorLine(rawLine) {
  const clean = stripAnsiCodes(rawLine || '').trim();
  if (!clean) return;
  const lastLine = dashboardErrorLines[dashboardErrorLines.length - 1];
  if (lastLine === clean) return;
  dashboardErrorLines.push(clean);
  if (dashboardErrorLines.length > DASHBOARD_ERROR_LIMIT) {
    dashboardErrorLines = dashboardErrorLines.slice(-DASHBOARD_ERROR_LIMIT);
  }
  renderDashboardErrorFeed();
}

function buildDashboardErrorFeed(lines) {
  const feed = [];
  const seenSummaries = new Set();

  lines.forEach(rawLine => {
    const clean = stripAnsiCodes(rawLine || '').trim();
    if (!clean) return;

    if (isErrorLogLine(clean)) {
      feed.push(clean);
    }

    const summary = buildOfficialErrorSummary(clean);
    if (summary && !seenSummaries.has(summary)) {
      feed.push(summary);
      seenSummaries.add(summary);
    }
  });

  return feed.slice(-DASHBOARD_ERROR_LIMIT);
}

function appendConsoleMessage(text) {
  if (!consoleLog) return;
  const cleanText = stripAnsiCodes(text);
  const line = document.createElement('div');
  line.textContent = cleanText;
  if (/\bERROR\b|\bException\b/i.test(cleanText)) line.classList.add('console-error-line');
  if (/\bWARN\b/i.test(cleanText)) line.classList.add('console-warn-line');
  consoleLog.appendChild(line);

  const officialSummary = buildOfficialErrorSummary(cleanText);
  const shouldAppendSummary = officialSummary && shouldAppendOfficialSummary(officialSummary);
  if (shouldAppendSummary) {
    const summaryLine = document.createElement('div');
    summaryLine.textContent = officialSummary;
    summaryLine.classList.add('console-official-error');
    consoleLog.appendChild(summaryLine);
  }

  if (isErrorLogLine(cleanText)) {
    pushDashboardErrorLine(cleanText);
  }
  if (shouldAppendSummary) {
    pushDashboardErrorLine(officialSummary);
  }

  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function initializeWebSocket() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/console');
  ws.addEventListener('message', event => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'console') appendConsoleMessage(data.message);
    } catch (error) {
      console.error(error);
    }
  });
  ws.addEventListener('open', () => appendConsoleMessage('Connected to live console.'));
  ws.addEventListener('close', event => {
    if (event.code === 1008) {
      redirectToLogin('Console access expired. Please log in again.');
      return;
    }
    appendConsoleMessage('Console connection closed.');
  });
}

function startSessionKeepalive() {
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = setInterval(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      const json = await response.json();
      if (!json?.user) redirectToLogin();
    } catch (error) {
      // Ignore transient errors to avoid noisy UI during brief network hiccups.
    }
  }, SESSION_KEEPALIVE_MS);
}

async function submitShopForm(event) {
  event.preventDefault();
  const payload = {
    name: shopFormFields.name.value,
    category: shopFormFields.category.value,
    price: shopFormFields.price.value,
    description: shopFormFields.description.value
  };
  const method = editShopId ? 'PUT' : 'POST';
  const endpoint = editShopId ? `/api/shop/${editShopId}` : '/api/shop';
  await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  shopForm.classList.add('hidden');
  editShopId = null;
  loadShopItems();
}

async function submitStaffForm(event) {
  event.preventDefault();
  const payload = {
    username: staffFormFields.username.value,
    role: staffFormFields.role.value,
    avatar: staffFormFields.avatar.value
  };
  const method = editStaffId ? 'PUT' : 'POST';
  const endpoint = editStaffId ? `/api/staff/${editStaffId}` : '/api/staff';
  await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  staffForm.classList.add('hidden');
  editStaffId = null;
  loadStaffMembers();
}

async function deleteUser(id) {
  await fetch(`/api/users/${id}/ban`, { method: 'POST' });
  loadUsers();
}

async function deleteUserPermanent(id) {
  const confirmDelete = confirm('Delete this user permanently? This action cannot be undone.');
  if (!confirmDelete) return;
  const response = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'same-origin' });
  const json = await response.json();
  if (!response.ok || !json.success) {
    alert(json.error || 'Unable to delete user.');
    return;
  }
  loadUsers();
  loadDashboard();
}

async function updateUserRole(id, role) {
  await fetch(`/api/users/${id}/role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
  loadUsers();
  loadDashboard();
}

async function createUserPrompt() {
  const username = prompt('Username');
  if (!username) return;
  const email = prompt('Email');
  if (!email) return;
  const password = prompt('Password (min 8 chars)');
  if (!password) return;
  const role = (prompt('Role: admin / staff / user', 'user') || 'user').toLowerCase();
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, role })
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    alert(json.error || 'Unable to create user');
    return;
  }
  loadUsers();
  loadDashboard();
}

async function editUserPrompt(id) {
  const currentUsersResponse = await fetch('/api/users');
  const currentUsersJson = await currentUsersResponse.json();
  const user = (currentUsersJson.users || []).find(item => Number(item.id) === Number(id));
  if (!user) return;
  const username = prompt('Username', user.username);
  if (!username) return;
  const email = prompt('Email', user.email);
  if (!email) return;
  const response = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email })
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    alert(json.error || 'Unable to update user');
    return;
  }
  loadUsers();
}

async function setUserFlag(id, action) {
  const response = await fetch(`/api/users/${id}/${action}`, { method: 'POST' });
  const json = await response.json();
  if (!response.ok || !json.success) {
    alert(json.error || `Unable to ${action} user`);
    return;
  }
  loadUsers();
  loadDashboard();
}

async function toggleUserPermission(id, permissionKey) {
  const response = await fetch('/api/users');
  const json = await response.json();
  const user = (json.users || []).find(item => Number(item.id) === Number(id));
  if (!user) return;
  const permissions = { ...(user.permissions || {}) };
  permissions[permissionKey] = !permissions[permissionKey];
  const saveResponse = await fetch(`/api/users/${id}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions })
  });
  const saveJson = await saveResponse.json();
  if (!saveResponse.ok || !saveJson.success) {
    alert(saveJson.error || 'Unable to update permissions');
    return;
  }
  loadUsers();
}

async function resetUserPassword(id) {
  const confirmReset = confirm('Reset this user password and generate a temporary password?');
  if (!confirmReset) return;
  const response = await fetch(`/api/users/${id}/reset-password`, { method: 'POST' });
  const json = await response.json();
  if (!response.ok || !json.success) {
    alert(json.error || 'Unable to reset password.');
    return;
  }
  alert(`Temporary password for this user:\n${json.tempPassword}\n\nShare it securely and ask them to change it immediately.`);
}

async function copyUserEmail(email) {
  if (!email) return;
  try {
    await navigator.clipboard.writeText(email);
    appendConsoleMessage(`Copied email: ${email}`);
  } catch (error) {
    alert('Unable to copy email.');
  }
}

async function deleteShopItem(id) {
  await fetch(`/api/shop/${id}`, { method: 'DELETE' });
  loadShopItems();
}

async function deleteStaffMember(id) {
  await fetch(`/api/staff/${id}`, { method: 'DELETE' });
  loadStaffMembers();
}

async function saveFile() {
  if (!selectedFile) return;
  await fetch('/api/files/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: selectedFile, content: fileEditor.value }) });
  loadFileList(currentFolder);
}

async function removeFile() {
  if (!selectedFile) return;
  const confirmDelete = confirm(`Delete ${selectedFile}?`);
  if (!confirmDelete) return;
  await fetch('/api/files/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: selectedFile }) });
  selectedFile = null;
  fileEditor.value = '';
  filePathTitle.textContent = 'Select a file';
  loadFileList(currentFolder);
}

async function uploadFile(event) {
  event.preventDefault();
  if (!fileUploadInput.files.length) return;
  const data = new FormData();
  data.append('upload', fileUploadInput.files[0]);
  data.append('path', currentFolder);
  await fetch('/api/files/upload', { method: 'POST', body: data });
  fileUploadInput.value = '';
  loadFileList(currentFolder);
}

async function uploadDroppedFiles(files) {
  if (!files.length) return;
  const data = new FormData();
  Array.from(files).forEach(file => data.append('upload', file));
  data.append('path', currentFolder);
  await fetch('/api/files/upload', { method: 'POST', body: data });
  loadFileList(currentFolder);
}

function setupDragDrop() {
  const dropZone = document.getElementById('upload-drop-zone');
  if (!dropZone) return;

  const prevent = event => {
    event.preventDefault();
    event.stopPropagation();
  };

  dropZone.addEventListener('dragenter', prevent);
  dropZone.addEventListener('dragover', event => {
    prevent(event);
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', event => {
    prevent(event);
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', async event => {
    prevent(event);
    dropZone.classList.remove('dragover');
    await uploadDroppedFiles(event.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => fileUploadInput?.click());
}

window.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  loadDashboard();
  loadUsers();
  loadActivityLogs();
  loadShopItems();
  loadStaffMembers();
  loadFileList();
  initializeWebSocket();
  startSessionKeepalive();
  setupDragDrop();
});

panelButtons.forEach(button => button.addEventListener('click', () => {
  showPanel(button.dataset.panel);
  activePanel = button.dataset.panel;
  if (activePanel === 'dashboard') loadDashboard();
  if (activePanel === 'activity') loadActivityLogs();
}));

logoutButton?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

usersTable?.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (['admin', 'staff', 'user'].includes(action)) updateUserRole(id, action);
  if (action === 'ban') deleteUser(id);
  if (action === 'unban') fetch(`/api/users/${id}/unban`, { method: 'POST' }).then(loadUsers);
  if (action === 'mute') setUserFlag(id, 'mute');
  if (action === 'unmute') setUserFlag(id, 'unmute');
  if (action === 'restrict') setUserFlag(id, 'restrict');
  if (action === 'unrestrict') setUserFlag(id, 'unrestrict');
  if (action === 'edit-user') editUserPrompt(id);
  if (action === 'toggle-console') toggleUserPermission(id, 'can_view_console');
  if (action === 'toggle-files') toggleUserPermission(id, 'can_edit_files');
  if (action === 'toggle-users') toggleUserPermission(id, 'can_manage_users');
  if (action === 'copy-email') copyUserEmail(button.dataset.email);
  if (action === 'reset-password') resetUserPassword(id);
  if (action === 'delete') deleteUserPermanent(id);
});

shopTable?.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'delete') deleteShopItem(id);
  if (action === 'edit') {
    fetch('/api/shop').then(r => r.json()).then(json => {
      const item = json.items.find(i => i.id === parseInt(id, 10));
      if (item) {
        editShopId = id;
        shopForm.classList.remove('hidden');
        shopFormTitle.textContent = 'Edit Item';
        shopFormFields.name.value = item.name;
        shopFormFields.category.value = item.category;
        shopFormFields.price.value = item.price;
        shopFormFields.description.value = item.description;
      }
    });
  }
});

staffTable?.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'delete') deleteStaffMember(id);
  if (action === 'edit') {
    fetch('/api/staff').then(r => r.json()).then(json => {
      const member = json.staff.find(item => item.id === parseInt(id, 10));
      if (member) {
        editStaffId = id;
        staffForm.classList.remove('hidden');
        staffFormTitle.textContent = 'Edit Staff Member';
        staffFormFields.username.value = member.username;
        staffFormFields.role.value = member.role;
        staffFormFields.avatar.value = member.avatar;
      }
    });
  }
});

newShopItem?.addEventListener('click', () => {
  editShopId = null;
  shopForm.classList.remove('hidden');
  shopFormTitle.textContent = 'New Item';
  shopForm.reset();
});

newStaffMember?.addEventListener('click', () => {
  editStaffId = null;
  staffForm.classList.remove('hidden');
  staffFormTitle.textContent = 'New Staff Member';
  staffForm.reset();
});

shopCancel?.addEventListener('click', () => {
  shopForm.classList.add('hidden');
  editShopId = null;
});

staffCancel?.addEventListener('click', () => {
  staffForm.classList.add('hidden');
  editStaffId = null;
});

shopForm?.addEventListener('submit', submitShopForm);
staffForm?.addEventListener('submit', submitStaffForm);
startServerBtn?.addEventListener('click', startServer);
stopServerBtn?.addEventListener('click', stopServer);
restartServerBtn?.addEventListener('click', restartServer);
consoleForm?.addEventListener('submit', event => {
  event.preventDefault();
  if (!consoleCommand.value.trim()) return;
  sendCommand(consoleCommand.value.trim());
  consoleCommand.value = '';
});
fileList?.addEventListener('click', event => {
  const item = event.target.closest('li');
  if (!item) return;
  const name = item.dataset.name;
  const isDir = item.dataset.dir === 'true';
  const parentPath = item.dataset.path;
  const targetPath = parentPath === '.' ? name : `${parentPath}/${name}`;
  if (isDir) {
    loadFileList(targetPath);
  } else {
    readFile(targetPath);
  }
});
saveFileButton?.addEventListener('click', saveFile);
deleteFileButton?.addEventListener('click', removeFile);
uploadForm?.addEventListener('submit', uploadFile);
refreshUsersBtn?.addEventListener('click', loadUsers);
newUserBtn?.addEventListener('click', createUserPrompt);
refreshActivityBtn?.addEventListener('click', loadActivityLogs);
createKitBtn?.addEventListener('click', createKitFromPanel);
deleteKitBtn?.addEventListener('click', deleteKitFromPanel);
refreshKitsHelpBtn?.addEventListener('click', showKitsHelp);
