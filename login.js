// ─── RYDR login.js ───────────────────────────────────────────────────────────
let currentRole = 'passenger';

function openLogin(card, label, role) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  if (card) card.classList.add('selected');
  currentRole = role || 'admin';
  document.getElementById('login-sub').textContent = `Sign in to your ${label}`;

  const portal = document.getElementById('admin-portal-button');
  portal.style.opacity = '0';
  portal.style.pointerEvents = 'none';

  document.getElementById('panel-select').classList.replace('visible','hidden');
  document.getElementById('panel-login').classList.replace('hidden','visible');
}

function goBack() {
  const portal = document.getElementById('admin-portal-button');
  portal.style.opacity = '1';
  portal.style.pointerEvents = 'auto';
  document.getElementById('panel-login').classList.replace('visible','hidden');
  document.getElementById('panel-select').classList.replace('hidden','visible');
}

function handleLogin() {
  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const btn      = document.getElementById('loginBtn');
  if (!email || !password) { btn.style.animation='none'; btn.offsetHeight; btn.style.animation='shake 0.35s ease'; return; }

  btn.textContent = 'Signing in…'; btn.style.opacity = '0.75'; btn.disabled = true;

  const routes = { passenger: 'rydster.html', driver: 'driver.html', admin: 'rydster.html' };
  setTimeout(() => { window.location.href = routes[currentRole] || 'rydster.html'; }, 900);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('panel-login').classList.contains('hidden')) handleLogin();
});

// Init carousel
document.addEventListener('DOMContentLoaded', () => initCarousel('carousel', 'dots'));
