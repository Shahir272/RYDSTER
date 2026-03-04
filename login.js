// ─── RYDR login.js ───────────────────────────────────────────────────────────
// Requires supabase.js to be loaded first (see index.html)

let currentRole = 'passenger';

function openLogin(card, label, role) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  if (card) card.classList.add('selected');
  currentRole = role || 'admin';
  document.getElementById('login-sub').textContent = `Sign in to your ${label}`;

  const portal = document.getElementById('admin-portal-button');
  portal.style.opacity = '0';
  portal.style.pointerEvents = 'none';

  // Clear any previous error
  setError('');

  document.getElementById('panel-select').classList.replace('visible', 'hidden');
  document.getElementById('panel-login').classList.replace('hidden', 'visible');
}

function goBack() {
  const portal = document.getElementById('admin-portal-button');
  portal.style.opacity = '1';
  portal.style.pointerEvents = 'auto';
  setError('');
  document.getElementById('panel-login').classList.replace('visible', 'hidden');
  document.getElementById('panel-select').classList.replace('hidden', 'visible');
}

function setError(msg) {
  let el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

async function handleLogin() {
  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const btn      = document.getElementById('loginBtn');

  setError('');

  if (!email || !password) {
    btn.style.animation = 'none';
    btn.offsetHeight;
    btn.style.animation = 'shake 0.35s ease';
    setError('Please enter your email and password.');
    return;
  }

  btn.textContent = 'Signing in…';
  btn.style.opacity = '0.75';
  btn.disabled = true;

  try {
    await rydrSignIn(email, password, currentRole);

    // Route based on role
    const routes = { passenger: 'rydster.html', driver: 'driver.html', admin: 'admin.html' };
    window.location.href = routes[currentRole] || 'rydster.html';

  } catch (err) {
    setError(err.message || 'Login failed. Please try again.');
    btn.textContent = 'Log In';
    btn.style.opacity = '1';
    btn.disabled = false;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('panel-login').classList.contains('hidden')) {
    handleLogin();
  }
});

document.addEventListener('DOMContentLoaded', () => initCarousel('carousel', 'dots'));