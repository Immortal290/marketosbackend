// ─── MarketOS Dashboard JS ────────────────────────────────────────────────────

// ── Auth guard ────────────────────────────────────────────────────────────────
const token = localStorage.getItem(CONFIG.TOKEN_KEY);
if (!token) {
  window.location.href = CONFIG.AUTH_PATH;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(CONFIG._api + path, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.REFRESH_KEY);
    window.location.href = CONFIG.AUTH_PATH;
    return null;
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'Request failed');
  return json.data;
}

// ── Logout ────────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.REFRESH_KEY);
  window.location.href = CONFIG.AUTH_PATH;
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}
function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}
function fmtPct(n)  { return n.toFixed(1) + '%'; }
function fmtX(n)    { return n.toFixed(1) + 'x'; }
function fmtTs(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Flash animation on value change ──────────────────────────────────────────
function flashEl(el) {
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 600);
}

function setVal(id, val, prevVal) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== val) {
    el.textContent = val;
    if (prevVal !== undefined) flashEl(el);
  }
}

// ── Sidebar navigation ────────────────────────────────────────────────────────
const PAGE_TITLES = {
  overview:    'Overview',
  analytics:   'Analytics',
  funnel:      'Funnel',
  attribution: 'Attribution',
  agents:      'AI Agents',
  campaigns:   'Campaigns',
};

function activateView(name) {
  document.querySelectorAll('.sb-link').forEach(a => {
    a.classList.toggle('active', a.dataset.view === name);
  });
  document.querySelectorAll('.view').forEach(s => {
    s.classList.toggle('active', s.id === 'view-' + name);
  });
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[name] || name;
}

document.querySelectorAll('.sb-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    activateView(link.dataset.view);
    history.pushState(null, '', '#' + link.dataset.view);
  });
});

// ── Sparkline chart (Canvas 2D) ───────────────────────────────────────────────
const revenueHistory = [];
const MAX_POINTS = 30;

function drawSparkline() {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas || revenueHistory.length < 2) return;
  const ctx  = canvas.getContext('2d');
  const W    = canvas.offsetWidth;
  const H    = canvas.offsetHeight || 120;
  canvas.width  = W;
  canvas.height = H;

  const min  = Math.min(...revenueHistory) * 0.998;
  const max  = Math.max(...revenueHistory) * 1.002;
  const range = max - min || 1;

  const pts = revenueHistory.map((v, i) => ({
    x: (i / (revenueHistory.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 24) - 12,
  }));

  ctx.clearRect(0, 0, W, H);

  // Fill gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   'rgba(99,102,241,.25)');
  grad.addColorStop(1,   'rgba(99,102,241,.00)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, H);
  ctx.lineTo(pts[0].x, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, '#6366f1');
  lineGrad.addColorStop(1, '#06b6d4');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Latest dot
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#818cf8';
  ctx.fill();
}

window.addEventListener('resize', drawSparkline);

// ── Render: Overview KPIs ─────────────────────────────────────────────────────
let prevOverviewKpis = {};
function renderOverviewKpis(exec) {
  setVal('kv-revenue',  fmtMoney(exec.revenue),           prevOverviewKpis.revenue);
  setVal('kv-pipeline', fmtMoney(exec.pipeline),          prevOverviewKpis.pipeline);
  setVal('kv-roas',     fmtX(exec.roas),                  prevOverviewKpis.roas);
  setVal('kv-cac',      fmtMoney(exec.cac),               prevOverviewKpis.cac);
  setVal('kv-ltv',      fmtMoney(exec.ltv),               prevOverviewKpis.ltv);
  setVal('kv-conv',     fmtPct(exec.conversionRate),      prevOverviewKpis.conversionRate);
  prevOverviewKpis = { ...exec };
}

// ── Render: Analytics KPIs ────────────────────────────────────────────────────
function renderAnalyticsKpis(exec) {
  setVal('av-revenue',  fmtMoney(exec.revenue));
  setVal('av-pipeline', fmtMoney(exec.pipeline));
  setVal('av-roas',     fmtX(exec.roas));
  setVal('av-cac',      fmtMoney(exec.cac));
}

// ── Render: Campaign Health ───────────────────────────────────────────────────
function renderCampaignHealth(list) {
  const el = document.getElementById('campaign-health-list');
  if (!el || !list) return;
  el.innerHTML = list.map(c => {
    const score = Math.round(c.healthScore);
    const cls   = score >= 85 ? 'health-good' : score >= 65 ? 'health-warn' : 'health-bad';
    return `
      <div class="campaign-row">
        <div>
          <div class="campaign-name">${escHtml(c.campaignName)}</div>
          <div class="campaign-meta">ROAS ${c.roas.toFixed(1)}x · CTR ${c.ctr.toFixed(1)}% · Conv ${c.conversionRate.toFixed(1)}%</div>
        </div>
        <span class="health-score ${cls}">${score}</span>
      </div>`;
  }).join('');
}

// ── Render: Alerts ────────────────────────────────────────────────────────────
function renderAlerts(alerts) {
  const el = document.getElementById('alerts-list');
  if (!el || !alerts) return;
  if (!alerts.length) {
    el.innerHTML = '<div style="padding:16px 18px;color:var(--muted);font-size:.85rem;">No active alerts</div>';
    return;
  }
  el.innerHTML = alerts.map(a => `
    <div class="alert-item">
      <span class="alert-dot ${a.type}"></span>
      <div>
        <div class="alert-title">${escHtml(a.title)}</div>
        <div class="alert-msg">${escHtml(a.message)}</div>
      </div>
    </div>`).join('');
}

// ── Render: Funnel ────────────────────────────────────────────────────────────
function renderFunnel(stages) {
  const el = document.getElementById('funnel-bars');
  if (!el || !stages) return;
  const max = stages[0]?.count || 1;
  el.innerHTML = stages.map(s => `
    <div class="funnel-stage">
      <span class="funnel-label">${escHtml(s.stage)}</span>
      <div class="funnel-bar-wrap">
        <div class="funnel-bar-fill" style="width:${((s.count / max) * 100).toFixed(1)}%"></div>
      </div>
      <span class="funnel-count">${fmtNum(s.count)}</span>
      <span class="funnel-conv">${s.convRate.toFixed(1)}%</span>
    </div>`).join('');
}

// ── Render: Attribution ───────────────────────────────────────────────────────
function renderAttribution(channels) {
  const el = document.getElementById('attribution-bars');
  if (!el || !channels) return;
  el.innerHTML = channels.map(c => `
    <div class="attr-row">
      <span class="attr-channel">${escHtml(c.channel.replace('_', ' '))}</span>
      <div class="attr-bar-wrap">
        <div class="attr-bar-fill ${escHtml(c.channel)}" style="width:${c.contribution.toFixed(1)}%"></div>
      </div>
      <span class="attr-pct">${c.contribution.toFixed(1)}%</span>
      <span class="attr-rev">${fmtMoney(c.revenue)}</span>
    </div>`).join('');
}

// ── Render: Agents ────────────────────────────────────────────────────────────
function renderAgents(agents) {
  const el = document.getElementById('agents-grid');
  if (!el || !agents) return;
  el.innerHTML = agents.map(a => `
    <div class="agent-row">
      <span class="agent-status-dot ${a.status}" title="${a.status}"></span>
      <div class="agent-info">
        <div class="agent-name">${escHtml(a.name)}</div>
        <div class="agent-task">${a.currentTask ? escHtml(a.currentTask) : '<em>Idle</em>'}</div>
      </div>
      <div class="agent-stats">
        <div class="agent-stat">
          <div class="stat-val">${a.successRate.toFixed(1)}%</div>
          <div class="stat-lbl">Success</div>
        </div>
        <div class="agent-stat">
          <div class="stat-val">${fmtNum(a.tokenUsage)}</div>
          <div class="stat-lbl">Tokens</div>
        </div>
        <div class="agent-stat">
          <div class="stat-val">$${a.costUsd.toFixed(2)}</div>
          <div class="stat-lbl">Cost</div>
        </div>
      </div>
    </div>`).join('');
}

// ── Render: Campaigns table ───────────────────────────────────────────────────
function renderCampaignsTable(list) {
  const tbody = document.getElementById('campaigns-tbody');
  if (!tbody || !list) return;
  tbody.innerHTML = list.map(c => {
    const score = Math.round(c.healthScore);
    const hCls  = score >= 85 ? 'badge-green' : score >= 65 ? 'badge-yellow' : 'badge-red';
    const bCls  = c.budgetStatus === 'ON_TRACK' ? 'badge-green' : c.budgetStatus === 'AT_RISK' ? 'badge-yellow' : 'badge-red';
    return `
      <tr>
        <td>${escHtml(c.campaignName)}</td>
        <td><span class="badge ${hCls}">${score}</span></td>
        <td>${c.roas.toFixed(1)}x</td>
        <td>${c.ctr.toFixed(1)}%</td>
        <td>${c.conversionRate.toFixed(1)}%</td>
        <td><span class="badge ${bCls}">${escHtml(c.budgetStatus.replace('_', ' '))}</span></td>
      </tr>`;
  }).join('');
}

// ── HTML escape util ──────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Socket.io connection ──────────────────────────────────────────────────────
const connDot  = document.querySelector('.conn-dot');
const connText = document.querySelector('.conn-text');
const lastUpEl = document.getElementById('last-updated');

function setConnStatus(state) {
  connDot.className  = 'conn-dot ' + state;
  connText.textContent = state === 'connected' ? 'Live' : state === 'connecting' ? 'Connecting…' : 'Disconnected';
}

function setLastUpdated() {
  if (lastUpEl) lastUpEl.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const socket = io(CONFIG._socket, {
  auth: { token },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

socket.on('connect', () => {
  setConnStatus('connected');
});
socket.on('disconnect', () => {
  setConnStatus('disconnected');
});
socket.on('connect_error', () => {
  setConnStatus('disconnected');
});
socket.on('reconnecting', () => {
  setConnStatus('connecting');
});

// ── analytics:update ─────────────────────────────────────────────────────────
socket.on('analytics:update', (data) => {
  if (!data) return;
  setLastUpdated();

  // Revenue sparkline
  if (data.executive?.revenue) {
    revenueHistory.push(data.executive.revenue);
    if (revenueHistory.length > MAX_POINTS) revenueHistory.shift();
    drawSparkline();
  }

  renderOverviewKpis(data.executive);
  renderAnalyticsKpis(data.executive);
  renderFunnel(data.funnel);
  renderAttribution(data.attribution);
});

// ── dashboard:update ─────────────────────────────────────────────────────────
socket.on('dashboard:update', (data) => {
  if (!data) return;
  renderAgents(data.agents);
  renderCampaignHealth(data.campaignHealth);
});

// ── Load user profile ─────────────────────────────────────────────────────────
async function loadUserProfile() {
  try {
    const user = await apiGet('/auth/me');
    if (!user) return;

    const name  = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const nameEl   = document.getElementById('user-name');
    const emailEl  = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl)   nameEl.textContent   = name;
    if (emailEl)  emailEl.textContent  = user.email;
    if (avatarEl) avatarEl.textContent = initials;
  } catch (err) {
    console.warn('Could not load user profile:', err.message);
  }
}

// ── Load static data via REST (fallback for non-socket views) ─────────────────
async function loadStaticData() {
  try {
    const [campaigns, alerts] = await Promise.allSettled([
      apiGet('/dashboard/campaign-health'),
      apiGet('/dashboard/alerts'),
    ]);

    if (campaigns.status === 'fulfilled' && campaigns.value) {
      renderCampaignHealth(campaigns.value);
      renderCampaignsTable(campaigns.value);
    }

    if (alerts.status === 'fulfilled' && alerts.value) {
      renderAlerts(alerts.value);
    }
  } catch (err) {
    console.warn('Static data load error:', err.message);
  }
}

// ── Initial active view from URL hash ────────────────────────────────────────
function initView() {
  const hash = window.location.hash.replace('#', '') || 'overview';
  const valid = Object.keys(PAGE_TITLES);
  activateView(valid.includes(hash) ? hash : 'overview');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initView();
  loadUserProfile();
  loadStaticData();
});

window.addEventListener('popstate', initView);
