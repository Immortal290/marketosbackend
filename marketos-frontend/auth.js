// ─── Auth JS — wires Sign In / Sign Up to the Railway backend ────────────────

// Redirect if already logged in
if (localStorage.getItem(CONFIG.TOKEN_KEY)) {
  window.location.href = CONFIG.DASHBOARD_PATH;
}

// ── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  const isSignin = name === 'signin';
  document.getElementById('form-signin').classList.toggle('hidden', !isSignin);
  document.getElementById('form-signup').classList.toggle('hidden', isSignin);
  document.getElementById('tab-signin').classList.toggle('active', isSignin);
  document.getElementById('tab-signup').classList.toggle('active', !isSignin);
  document.getElementById('tab-signin').setAttribute('aria-selected', isSignin);
  document.getElementById('tab-signup').setAttribute('aria-selected', !isSignin);
  positionIndicator(isSignin ? 'tab-signin' : 'tab-signup');
}

function positionIndicator(tabId) {
  const tab = document.getElementById(tabId);
  const ind = document.getElementById('tab-indicator');
  ind.style.left  = tab.offsetLeft + 'px';
  ind.style.width = tab.offsetWidth + 'px';
}

window.addEventListener('DOMContentLoaded', () => positionIndicator('tab-signin'));
window.addEventListener('resize', () => {
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) positionIndicator(activeTab.id);
});

// ── Utilities ────────────────────────────────────────────────────────────────
function setLoading(formId, loading) {
  const btn  = document.getElementById(formId + '-btn');
  const text = btn.querySelector('.btn-text');
  const spin = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  text.textContent = loading
    ? (formId === 'signin' ? 'Signing in…' : 'Creating account…')
    : (formId === 'signin' ? 'Sign In' : 'Create Account');
  spin.classList.toggle('hidden', !loading);
}

function showAlert(formId, msg, type = 'error') {
  const el = document.getElementById(formId + '-alert');
  el.textContent = msg;
  el.className = 'alert ' + type;
}

function clearAlert(formId) {
  const el = document.getElementById(formId + '-alert');
  el.className = 'alert hidden';
}

function setFieldError(fieldId, msg) {
  const el = document.getElementById('err-' + fieldId);
  if (el) el.textContent = msg;
}
function clearFieldErrors(...ids) {
  ids.forEach(id => { const el = document.getElementById('err-' + id); if (el) el.textContent = ''; });
}

// ── Toggle password visibility ────────────────────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.style.opacity = isText ? '1' : '.5';
}

// ── Password strength ─────────────────────────────────────────────────────────
document.getElementById('signup-password').addEventListener('input', function () {
  const v = this.value;
  let score = 0;
  if (v.length >= 8)               score++;
  if (/[A-Z]/.test(v))             score++;
  if (/[0-9]/.test(v))             score++;
  if (/[^A-Za-z0-9]/.test(v))      score++;

  const bar = document.getElementById('pw-bar');
  const colors = ['#f87171', '#fb923c', '#facc15', '#34d399'];
  const widths  = ['25%', '50%', '75%', '100%'];
  bar.style.width      = score ? widths[score - 1] : '0';
  bar.style.background = score ? colors[score - 1] : 'transparent';
});

// ── API helper ────────────────────────────────────────────────────────────────
async function apiPost(path, body) {
  const res = await fetch(CONFIG._api + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'Request failed');
  return json;
}

// ── Sign In ───────────────────────────────────────────────────────────────────
async function handleSignIn(e) {
  e.preventDefault();
  clearAlert('signin');
  clearFieldErrors('signin-email', 'signin-password');

  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;

  if (!email)    { setFieldError('signin-email',    'Email is required');    return; }
  if (!password) { setFieldError('signin-password', 'Password is required'); return; }

  setLoading('signin', true);
  try {
    const data = await apiPost('/auth/login', { email, password });
    localStorage.setItem(CONFIG.TOKEN_KEY,   data.data.accessToken);
    localStorage.setItem(CONFIG.REFRESH_KEY, data.data.refreshToken);
    showAlert('signin', 'Signed in! Redirecting…', 'success');
    setTimeout(() => { window.location.href = CONFIG.DASHBOARD_PATH; }, 600);
  } catch (err) {
    showAlert('signin', err.message);
  } finally {
    setLoading('signin', false);
  }
}

// ── Sign Up ───────────────────────────────────────────────────────────────────
async function handleSignUp(e) {
  e.preventDefault();
  clearAlert('signup');
  clearFieldErrors('signup-email', 'signup-password');

  const firstName     = document.getElementById('signup-fname').value.trim();
  const lastName      = document.getElementById('signup-lname').value.trim();
  const workspaceName = document.getElementById('signup-workspace').value.trim();
  const email         = document.getElementById('signup-email').value.trim();
  const password      = document.getElementById('signup-password').value;

  if (!email)           { setFieldError('signup-email',    'Email is required');                  return; }
  if (password.length < 8) { setFieldError('signup-password', 'Password must be at least 8 chars'); return; }

  setLoading('signup', true);
  try {
    const data = await apiPost('/auth/register', { email, password, firstName, lastName, workspaceName });
    localStorage.setItem(CONFIG.TOKEN_KEY,   data.data.accessToken);
    localStorage.setItem(CONFIG.REFRESH_KEY, data.data.refreshToken);
    showAlert('signup', 'Account created! Redirecting…', 'success');
    setTimeout(() => { window.location.href = CONFIG.DASHBOARD_PATH; }, 600);
  } catch (err) {
    showAlert('signup', err.message);
  } finally {
    setLoading('signup', false);
  }
}
