// ─── RYDR supabase.js — shared across all pages ──────────────────────────────
// Import this file in every HTML page that needs DB access:
//   <script src="supabase.js"></script>

const SUPABASE_URL = 'https://xqeyipoenpxmbvvgjwbd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LRS3CS0hgu4siPyeWM5D5A_kkrpnLxj';

// ── Low-level fetch helper ────────────────────────────────────────────────────
async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Supabase error');
  return data;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

/**
 * Sign in a user.
 * Returns the user row on success, throws on failure.
 *
 * @param {string} email
 * @param {string} password   — plain text; compared against DB password column
 * @param {string} role       — 'passenger' | 'driver' | 'admin'
 */
async function rydrSignIn(email, password, role) {
  // Fetch user by email (case-insensitive via ilike)
  const rows = await sbFetch(
    `/USER?email=ilike.${encodeURIComponent(email)}&select=user_id,name,email,role,password,verification_status`
  );

  if (!rows || rows.length === 0) throw new Error('No account found with that email.');

  const user = rows[0];

  // Check password (plain-text comparison — upgrade to hashed when ready)
  if (user.password !== password) throw new Error('Incorrect password.');

  // Check role matches
  if (user.role.toLowerCase() !== role.toLowerCase()) {
    throw new Error(`This account is registered as a ${user.role}. Please use the ${user.role} login.`);
  }

  // Store session in sessionStorage so other pages can read it
  const session = {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    verification_status: user.verification_status,
  };
  sessionStorage.setItem('rydr_user', JSON.stringify(session));
  return session;
}

/**
 * Get the currently signed-in user from sessionStorage.
 * Returns null if not signed in.
 */
function rydrGetCurrentUser() {
  const raw = sessionStorage.getItem('rydr_user');
  return raw ? JSON.parse(raw) : null;
}

/**
 * Sign out and clear session.
 */
function rydrSignOut() {
  sessionStorage.removeItem('rydr_user');
}

/**
 * Guard a page — call at the top of any protected page.
 * Redirects to index.html if not signed in or role doesn't match.
 *
 * @param {string|string[]} allowedRoles  e.g. 'driver' or ['driver','admin']
 */
function rydrRequireAuth(allowedRoles) {
  const user = rydrGetCurrentUser();
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!user || !allowed.includes(user.role.toLowerCase())) {
    window.location.href = 'index.html';
  }
  return user;
}
// ── RIDE ──────────────────────────────────────────────────────────────────────

/**
 * Post a new ride to the RIDE table.
 * ride_status is always set to 'available' on creation.
 *
 * @param {object} ride
 *   { driver_id, source, destination, ride_time, available_seats, total_cost }
 * @returns {object} the created ride row
 */
async function rydrPostRide(ride) {
  const payload = {
    driver_id:       ride.driver_id,
    source:          ride.source,
    destination:     ride.destination,
    ride_time:       ride.ride_time,          // "HH:MM:SS"
    available_seats: ride.available_seats,
    total_cost:      ride.total_cost,
    ride_status:     'available',
  };
  const rows = await sbFetch('/RIDE', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

/**
 * Fetch all available rides (optionally filter by destination).
 */
async function rydrGetAvailableRides(destination = null) {
  let path = '/RIDE?ride_status=eq.available&select=*';
  if (destination) path += `&destination=ilike.${encodeURIComponent('%' + destination + '%')}`;
  return sbFetch(path);
}