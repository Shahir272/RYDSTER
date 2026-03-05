// ─── RYDR signup.js ──────────────────────────────────────────────────────────

let selectedRole = 'passenger';

// ── ROLE PICKER ──
function pickRole(el) {
  document.querySelectorAll('.role-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedRole = el.dataset.role;
}

// ── PASSWORD VISIBILITY ──
function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

// ── PASSWORD STRENGTH ──
function checkStrength(val) {
  const fill  = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  if (!val) { fill.style.width = '0%'; label.textContent = ''; return; }

  let score = 0;
  if (val.length >= 8)              score++;
  if (/[A-Z]/.test(val))            score++;
  if (/[0-9]/.test(val))            score++;
  if (/[^A-Za-z0-9]/.test(val))     score++;

  const levels = [
    { w: '25%', color: '#ef4444', text: 'Weak',      labelColor: '#ef4444' },
    { w: '50%', color: '#f97316', text: 'Fair',      labelColor: '#f97316' },
    { w: '75%', color: '#eab308', text: 'Good',      labelColor: '#ca8a04' },
    { w: '100%',color: '#22c55e', text: 'Strong 💪', labelColor: '#16a34a' },
  ];
  const lv = levels[score - 1] || levels[0];
  fill.style.width      = lv.w;
  fill.style.background = lv.color;
  label.textContent     = lv.text;
  label.style.color     = lv.labelColor;

  checkMatch();
}

// ── PASSWORD MATCH ──
function checkMatch() {
  const pw   = document.getElementById('passwordInput').value;
  const conf = document.getElementById('confirmInput').value;
  const lbl  = document.getElementById('matchLabel');
  if (!conf) { lbl.textContent = ''; return; }
  if (pw === conf) {
    lbl.textContent = '✓ Passwords match';
    lbl.style.color = '#16a34a';
  } else {
    lbl.textContent = '✗ Passwords do not match';
    lbl.style.color = '#ef4444';
  }
}

// ── VALIDATION ──
function validate() {
  const name     = document.getElementById('nameInput').value.trim();
  const phone    = document.getElementById('phoneInput').value.trim();
  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const confirm  = document.getElementById('confirmInput').value;
  const terms    = document.getElementById('termsCheck').checked;

  if (!name)                        return 'Please enter your full name.';
  if (!phone)                       return 'Please enter your phone number.';
  if (!/^\+?[\d\s\-]{8,15}$/.test(phone)) return 'Please enter a valid phone number.';
  if (!email)                       return 'Please enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
  if (!password)                    return 'Please set a password.';
  if (password.length < 8)          return 'Password must be at least 8 characters.';
  if (password !== confirm)         return 'Passwords do not match.';
  if (!terms)                       return 'Please accept the Terms of Service to continue.';
  return null;
}

// ── SHOW / HIDE ERROR ──
function setError(msg) {
  const el = document.getElementById('signupError');
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// ── SUBMIT ──
async function handleSignup() {
  setError('');
  const err = validate();
  if (err) {
    setError(err);
    // Shake the button
    const btn = document.getElementById('signupBtn');
    btn.style.animation = 'none'; btn.offsetHeight;
    btn.style.animation = 'shake 0.35s ease';
    return;
  }

  const name           = document.getElementById('nameInput').value.trim();
  const phone          = document.getElementById('phoneInput').value.trim();
  const email          = document.getElementById('emailInput').value.trim();
  const password       = document.getElementById('passwordInput').value;
  const verificationId = document.getElementById('verificationInput').value.trim() || null;

  const btn = document.getElementById('signupBtn');
  btn.textContent = 'Creating account…';
  btn.style.opacity = '0.75';
  btn.disabled = true;

  try {
    // Check if email already registered
    const existing = await sbFetch(
      `/USER?email=ilike.${encodeURIComponent(email)}&select=user_id`
    );
    if (existing && existing.length > 0) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    // Insert new user
    await sbFetch('/USER', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        name:                name,
        phone:               phone,
        email:               email,
        password:            password,
        role:                selectedRole,
        verification_id:     verificationId,
        verification_status: 'pending',
      }),
    });

    showSuccess(name);

  } catch (err) {
    setError(err.message || 'Sign up failed. Please try again.');
    btn.textContent = 'Create My Account';
    btn.style.opacity = '1';
    btn.disabled = false;
  }
}

// ── SUCCESS OVERLAY ──
function showSuccess(name) {
  const firstName = name.split(' ')[0];
  const overlay = document.createElement('div');
  overlay.className = 'success-overlay';
  overlay.innerHTML = `
    <div class="success-card">
      <div class="success-icon">🎉</div>
      <div class="success-title">Welcome, ${firstName}!</div>
      <div class="success-desc">
        Your account has been created successfully.<br>
        Our team will verify your identity shortly.
      </div>
      <div class="success-badge">⏳ Verification Pending</div>
      <button class="success-btn" onclick="window.location.href='index.html'">
        Go to Sign In →
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

// ── ENTER KEY ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSignup();
});