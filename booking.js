// ─── RYDR booking.js ─────────────────────────────────────────────────────────
let mode = 'now', cachedGPS = null, activeField = null;
let map = null, pendingLatLng = null, pendingAddress = null;
const markers   = { from: null, to: null };
const confirmed = { from: null, to: null };
let routeLayer  = null;
let routeShown  = false;

// ── DATE DEFAULTS (set lazily when accordion opens) ──
function setDateDefaults() {
  const dateEl = document.getElementById('dateInput');
  const timeEl = document.getElementById('timeInput');
  if (dateEl && !dateEl.value) {
    const nowD = new Date();
    dateEl.valueAsDate = nowD;
    timeEl.value = `${String(nowD.getHours()).padStart(2,'0')}:${String(nowD.getMinutes()).padStart(2,'0')}`;
  }
}

// ── MODE TOGGLE ──
function setMode(m) {
  const accordion = document.getElementById('bookingAccordion');
  const wasActive = document.getElementById(m === 'now' ? 'btnNow' : 'btnLater').classList.contains('active');

  // If clicking the already-active button, collapse
  if (wasActive && accordion.classList.contains('open')) {
    accordion.classList.remove('open');
    document.getElementById('btnNow').classList.remove('active');
    document.getElementById('btnLater').classList.remove('active');
    return;
  }

  mode = m;
  document.getElementById('btnNow').classList.toggle('active', m === 'now');
  document.getElementById('btnLater').classList.toggle('active', m === 'later');
  document.getElementById('datetimeRow').classList.toggle('hidden', m === 'now');
  document.getElementById('btnLabel').textContent = m === 'now' ? 'Find a Ride Now' : 'Schedule Ride';
  accordion.classList.add('open');
  if (m === 'later') setDateDefaults();
}

// ── MAP INIT ──
function initMap(lat, lng, zoom) {
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    map.on('click', e => placePin(e.latlng));
  } else {
    map.setView([lat, lng], zoom);
  }
}

// ── PIN ICON ──
function pinIcon(field) {
  const color = field === 'from' ? '#2dbe60' : '#f5a623';
  const label = field === 'from' ? 'A' : 'B';
  return L.divIcon({
    html: `<div style="width:32px;height:42px;background:${color};border-radius:50% 50% 50% 0;
             transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.3);"></div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-38%);
             color:white;font-weight:900;font-size:13px;font-family:Inter,sans-serif;">${label}</div>`,
    className: '', iconSize: [32, 42], iconAnchor: [16, 42],
  });
}

// ── PLACE PIN ──
function placePin(latlng) {
  pendingLatLng = latlng;
  if (markers[activeField]) {
    markers[activeField].setLatLng(latlng);
  } else {
    markers[activeField] = L.marker(latlng, { icon: pinIcon(activeField), draggable: true }).addTo(map);
    markers[activeField].on('dragend', e => placePin(e.target.getLatLng()));
  }
  markers[activeField].setIcon(pinIcon(activeField));

  const hint = document.getElementById('mapHint');
  hint.classList.add('show');
  setTimeout(() => hint.classList.remove('show'), 2500);
  reverseGeocode(latlng.lat, latlng.lng);
}

// ── REVERSE GEOCODE ──
async function reverseGeocode(lat, lng) {
  const bar = document.getElementById('confirmBar');
  const txt = document.getElementById('confirmAddressText');
  txt.textContent = 'Fetching address…';
  bar.classList.add('visible');
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address, parts = [];
    if (a.road || a.pedestrian || a.footway)       parts.push(a.road || a.pedestrian || a.footway);
    if (a.suburb || a.neighbourhood || a.quarter)  parts.push(a.suburb || a.neighbourhood || a.quarter);
    if (a.town || a.city || a.village || a.county) parts.push(a.town || a.city || a.village || a.county);
    if (a.state_district)                          parts.push(a.state_district);
    pendingAddress = parts.length ? parts.join(', ') : data.display_name.split(',').slice(0,3).join(',');
  } catch { pendingAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
  document.getElementById('confirmAddressText').textContent = pendingAddress;
}

// ── CONFIRM LOCATION ──
function confirmLocation() {
  if (!activeField || !pendingAddress) return;
  const inp = document.getElementById(activeField === 'from' ? 'fromInput' : 'toInput');
  inp.value = pendingAddress;
  inp.classList.add('confirmed');
  confirmed[activeField] = { lat: pendingLatLng.lat, lng: pendingLatLng.lng, address: pendingAddress };
  document.getElementById('confirmBar').classList.remove('visible');
  if (confirmed.from && confirmed.to) drawRoute();
}

// ── SHOW MAP FOR PLACE ──
function showMapForPlace(place, field) {
  activeField = field;
  const badge = document.getElementById('mapBadge');
  badge.className   = `map-badge ${field}`;
  badge.textContent = field === 'from' ? '📍 Pickup' : '📍 Drop';
  document.getElementById('confirmForLabel').textContent = field === 'from' ? 'Confirming Pickup' : 'Confirming Drop';
  document.getElementById('mapPlaceholder').classList.add('hide');
  initMap(place.lat, place.lng, 14);
  placePin(L.latLng(place.lat, place.lng));
  setTimeout(() => map && map.invalidateSize(), 100);
}

// ── GPS ──
async function useGPSLocation(field) {
  activeField = field;
  const inp = document.getElementById(field === 'from' ? 'fromInput' : 'toInput');
  inp.value = 'Locating…'; inp.disabled = true;
  if (!cachedGPS) {
    cachedGPS = await new Promise(res => {
      if (!navigator.geolocation) { res(null); return; }
      navigator.geolocation.getCurrentPosition(p => res(p.coords), () => res(null), { timeout: 8000 });
    });
  }
  if (cachedGPS) {
    inp.value = 'My Current Location 📍'; inp.disabled = false;
    showMapForPlace({ lat: cachedGPS.latitude, lng: cachedGPS.longitude }, field);
  } else {
    inp.value = ''; inp.placeholder = 'Location access denied'; inp.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════════
// ── ROUTE ──
// ══════════════════════════════════════════════════════════════════

function clearRoute() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  document.getElementById('routeCard').classList.remove('visible');
  document.getElementById('routeLoader').classList.remove('show');
  document.getElementById('routeCost').classList.remove('fare');
  routeShown = false;
}

async function drawRoute() {
  if (!confirmed.from || !confirmed.to) return;
  clearRoute();

  const card   = document.getElementById('routeCard');
  const loader = document.getElementById('routeLoader');
  card.classList.add('visible');
  loader.classList.add('show');
  setRouteStats('—', '—', '—');

  const { lat: lat1, lng: lng1 } = confirmed.from;
  const { lat: lat2, lng: lng2 } = confirmed.to;

  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error('no route');

    const route  = data.routes[0];
    const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    // Layer group for both lines
    routeLayer = L.layerGroup().addTo(map);

    // Glow underlay
    L.polyline(coords, {
      color: 'rgba(45,190,96,0.2)', weight: 14,
      lineCap: 'round', lineJoin: 'round',
    }).addTo(routeLayer);

    // Animated dashed main line
    const line = L.polyline(coords, {
      color: '#2dbe60', weight: 5,
      lineCap: 'round', lineJoin: 'round',
      dashArray: '14 7',
    }).addTo(routeLayer);

    routeShown = true;
    animateDash(line);

    map.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });

    const km   = route.distance / 1000;
    const fare = Math.round(25 + km * 12);
    loader.classList.remove('show');
    setRouteStats(formatDist(route.distance), formatDur(route.duration), `₹${fare} – ₹${Math.round(fare * 1.2)}`);
    document.getElementById('routeCost').classList.add('fare');

  } catch {
    // Straight-line fallback
    const line = L.polyline([[lat1,lng1],[lat2,lng2]], {
      color: '#f5a623', weight: 3, dashArray: '8 6',
    }).addTo(map);
    routeLayer = line;
    routeShown = true;
    map.fitBounds(line.getBounds(), { padding: [60, 60] });

    const km   = haversine(lat1, lng1, lat2, lng2);
    const fare = Math.round(25 + km * 12);
    loader.classList.remove('show');
    setRouteStats(`~${km.toFixed(1)} km`, `~${formatDur((km / 40) * 3600)}`, `₹${fare} – ₹${Math.round(fare * 1.2)}`);
    document.getElementById('routeCost').classList.add('fare');
  }
}

function animateDash(polyline) {
  let offset = 0;
  const step = () => {
    offset = (offset + 0.8) % 21;
    try { polyline.setStyle({ dashOffset: String(-offset) }); } catch {}
    if (routeShown) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setRouteStats(dist, time, cost) {
  document.getElementById('routeDist').textContent = dist;
  document.getElementById('routeTime').textContent = time;
  document.getElementById('routeCost').textContent = cost;
}

function formatDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatDur(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ══════════════════════════════════════════════════════════════════
// ── DROPDOWN ──
// ══════════════════════════════════════════════════════════════════

function highlight(text, q) {
  if (!q) return text;
  return text.replace(new RegExp(`(${q})`, 'gi'), '<strong style="color:var(--green-deep)">$1</strong>');
}
function closeAll() { document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open')); }

function buildDropdown(dd, query, inputId) {
  dd.innerHTML = '';
  const field = inputId === 'fromInput' ? 'from' : 'to';

  const locEl = Object.assign(document.createElement('div'), {
    className: 'dd-item use-location',
    innerHTML: '<span>📍</span><span>Use my current location</span>',
  });
  // Use mousedown so it fires before the input loses focus and dropdown closes
  locEl.addEventListener('mousedown', e => {
    e.preventDefault();   // prevent input blur
    closeAll();
    useGPSLocation(field);
  });
  dd.appendChild(locEl);

  const q    = query.toLowerCase().trim();
  const list = q ? PLACES.filter(p => p.name.toLowerCase().includes(q) || p.district.toLowerCase().includes(q)) : PLACES;

  if (!list.length) { dd.insertAdjacentHTML('beforeend','<div class="dd-no-result">No places found</div>'); return; }

  list.forEach(p => {
    const el = Object.assign(document.createElement('div'), {
      className: 'dd-item',
      innerHTML: `<span>🏙️</span><span>${highlight(p.name, q)}</span><span class="dd-district">${p.district}</span>`,
    });
    el.addEventListener('mousedown', e => {
      e.preventDefault();   // prevent input blur before we read the value
      const inp = document.getElementById(inputId);
      inp.value = p.name; inp.classList.remove('confirmed');
      confirmed[field] = null;
      closeAll(); clearRoute();
      showMapForPlace(p, field);
    });
    dd.appendChild(el);
  });
}

function positionDropdown(inp, dd) {
  const rect = inp.getBoundingClientRect();
  dd.style.top   = (rect.bottom + 4) + 'px';
  dd.style.left  = rect.left + 'px';
  dd.style.width = rect.width + 'px';
}

function openDropdown(inp, dd, inputId) {
  // Move dropdown to body so it is never clipped by any ancestor overflow
  if (dd.parentElement !== document.body) {
    document.body.appendChild(dd);
  }
  buildDropdown(dd, inp.value, inputId);
  positionDropdown(inp, dd);
  dd.classList.add('open');
}

function setupInput(inputId, ddId) {
  const inp = document.getElementById(inputId), dd = document.getElementById(ddId);
  inp.addEventListener('focus',  () => openDropdown(inp, dd, inputId));
  inp.addEventListener('input',  () => openDropdown(inp, dd, inputId));
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  // Reposition on scroll and resize
  const left = document.querySelector('.left');
  if (left) left.addEventListener('scroll', () => { if (dd.classList.contains('open')) positionDropdown(inp, dd); });
  window.addEventListener('resize', () => { if (dd.classList.contains('open')) positionDropdown(inp, dd); });
}

document.addEventListener('mousedown', e => {
  if (!e.target.closest('.location-group') && !e.target.closest('.dropdown')) closeAll();
});
setupInput('fromInput', 'fromDropdown');
setupInput('toInput',   'toDropdown');

// ── GO RIDE — see DB-search version below ──

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Show logged-in user's name from sessionStorage
  const user = rydrGetCurrentUser();
  const welcomeEl = document.getElementById('welcomeMsg');
  if (welcomeEl) {
    if (user && user.name) {
      const firstName = user.name.split(' ')[0];
      welcomeEl.innerHTML = `👋 Welcome back, <strong>${firstName}</strong>`;
      welcomeEl.style.display = 'block';
    } else {
      welcomeEl.style.display = 'none'; // hide the empty box if no session
    }
  }
});
// ══════════════════════════════════════════════════════════════════
// ── RIDE SEARCH & RESULTS ──
// ══════════════════════════════════════════════════════════════════

// ── Fuzzy place match: checks if two place name strings share a meaningful token ──
function placesMatch(dbPlace, searchVal) {
  if (!dbPlace || !searchVal) return false;
  const norm  = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const dbTok = norm(dbPlace).split(/\s+/).filter(t => t.length > 2);
  const srTok = norm(searchVal).split(/\s+/).filter(t => t.length > 2);
  // Direct substring fallback
  if (norm(dbPlace).includes(norm(searchVal)) || norm(searchVal).includes(norm(dbPlace))) return true;
  return dbTok.some(t => srTok.includes(t));
}

// ── Format "HH:MM:SS" → "9:30 AM" ──
function formatRideTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ── Is ride more than 4 hours from now? ──
function isAfter4Hours(timeStr) {
  if (!timeStr) return false;
  const now  = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const ride = new Date();
  ride.setHours(h, m, 0, 0);
  // If ride time has already passed today, treat it as tomorrow
  if (ride <= now) ride.setDate(ride.getDate() + 1);
  return (ride - now) >= 4 * 3600 * 1000;
}

// ── Render the results panel ──
function showRideResults(rides, fromVal, toVal) {
  // Remove any existing panel
  const existing = document.getElementById('rideResultsPanel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id        = 'rideResultsPanel';
  panel.className = 'rr-panel';

  const modeLabel = mode === 'later'
    ? '<span class="rr-mode-badge rr-mode-later">🕐 Scheduled (4h+)</span>'
    : '<span class="rr-mode-badge rr-mode-now">⚡ Book Now</span>';

  const header = `
    <div class="rr-header">
      <div class="rr-header-top">
        <div class="rr-title">
          ${rides.length ? `${rides.length} Ride${rides.length > 1 ? 's' : ''} Found` : 'No Rides Found'}
        </div>
        <button class="rr-close" onclick="closeRideResults()">✕</button>
      </div>
      <div class="rr-route-pill">
        <span class="rr-pill-from">${fromVal}</span>
        <span class="rr-pill-arrow">→</span>
        <span class="rr-pill-to">${toVal}</span>
        ${modeLabel}
      </div>
    </div>`;

  let body;
  if (!rides.length) {
    body = `
      <div class="rr-empty">
        <div class="rr-empty-icon">🔍</div>
        <div class="rr-empty-title">No rides available</div>
        <div class="rr-empty-sub">
          ${mode === 'later'
            ? 'No drivers have scheduled rides on this route more than 4 hours from now.'
            : 'No drivers are currently offering rides on this route or nearby routes.'}
        </div>
      </div>`;
  } else {
    const cards = rides.map(r => {
      const nearbyTag = (r._sourceMatch && r._destMatch) ? '' :
        '<span class="rr-nearby-badge">📍 Nearby route</span>';
      return `
        <div class="rr-card">
          <div class="rr-card-route">
            <div class="rr-card-stop">
              <span class="rr-dot rr-dot-a">A</span>
              <span class="rr-stop-name">${r.source}</span>
            </div>
            <div class="rr-route-arrow">↓</div>
            <div class="rr-card-stop">
              <span class="rr-dot rr-dot-b">B</span>
              <span class="rr-stop-name">${r.destination}</span>
            </div>
            ${nearbyTag}
          </div>
          <div class="rr-card-meta">
            <span class="rr-meta">🕐 ${formatRideTime(r.ride_time)}</span>
            <span class="rr-meta">💺 ${r.available_seats} seat${r.available_seats !== 1 ? 's' : ''}</span>
            <span class="rr-meta rr-fare">₹${r.total_cost}</span>
          </div>
          <button class="rr-book-btn" onclick="bookRide(${r.ride_id}, '${r.source}', '${r.destination}')">
            Book This Ride →
          </button>
        </div>`;
    }).join('');
    body = `<div class="rr-list">${cards}</div>`;
  }

  panel.innerHTML = header + body;
  document.querySelector('.right').appendChild(panel);
  // Animate in after paint
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('rr-visible')));
}

function closeRideResults() {
  const p = document.getElementById('rideResultsPanel');
  if (!p) return;
  p.classList.remove('rr-visible');
  setTimeout(() => p.remove(), 280);
}

async function bookRide(rideId, source, dest) {
  const user = rydrGetCurrentUser();
  if (!user) { alert('Please log in to book a ride.'); return; }
  // TODO: insert into BOOKING table when schema is ready
  const btn = event.target;
  btn.textContent = '✓ Booked!';
  btn.style.background = '#157a3c';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = 'Book This Ride →'; btn.style.background = ''; btn.disabled = false; }, 2500);
}

// ── OVERWRITE goRide with DB-search version ──
async function goRide() {
  const fromVal = document.getElementById('fromInput').value.trim();
  const toVal   = document.getElementById('toInput').value.trim();

  if (!fromVal || !toVal) {
    alert('Please select both pickup and drop locations.');
    return;
  }
  if (fromVal === toVal) {
    alert('Pickup and drop cannot be the same!');
    return;
  }

  // Auto-confirm coords from PLACES if pin not yet placed
  const fromPlace = PLACES.find(p => p.name.toLowerCase() === fromVal.toLowerCase());
  const toPlace   = PLACES.find(p => p.name.toLowerCase() === toVal.toLowerCase());
  if (fromPlace && !confirmed.from) confirmed.from = { lat: fromPlace.lat, lng: fromPlace.lng, address: fromPlace.name };
  if (toPlace   && !confirmed.to)   confirmed.to   = { lat: toPlace.lat,   lng: toPlace.lng,   address: toPlace.name };

  if (!confirmed.from || !confirmed.to) {
    alert('Please confirm both locations on the map before searching.');
    return;
  }

  // Draw route on map
  if (!map) {
    document.getElementById('mapPlaceholder').classList.add('hide');
    initMap(confirmed.from.lat, confirmed.from.lng, 10);
    setTimeout(() => map && map.invalidateSize(), 100);
  }
  ['from','to'].forEach(f => {
    if (!markers[f]) {
      const c = confirmed[f];
      markers[f] = L.marker([c.lat, c.lng], { icon: pinIcon(f) }).addTo(map);
    }
  });
  setTimeout(() => drawRoute(), 200);

  // ── Search DB ──
  const goBtn = document.querySelector('.go-btn');
  const lbl   = document.getElementById('btnLabel');
  const origText = lbl.textContent;
  lbl.textContent = 'Searching…';
  goBtn.disabled  = true;

  try {
    const allRides = await sbFetch('/RIDE?ride_status=eq.available&select=*');
    let matched = (allRides || []).filter(r => {
      const srcMatch  = placesMatch(r.source, fromVal);
      const destMatch = placesMatch(r.destination, toVal);
      if (srcMatch && destMatch) { r._sourceMatch = true; r._destMatch = true; return true; }
      // Include nearby: one end matches and the other is in same district
      const fromDistrict = fromPlace ? fromPlace.district : null;
      const toDistrict   = toPlace   ? toPlace.district   : null;
      const nearSrc  = fromDistrict && r.source.toLowerCase().includes(fromDistrict.toLowerCase());
      const nearDest = toDistrict   && r.destination.toLowerCase().includes(toDistrict.toLowerCase());
      if ((srcMatch || nearSrc) && (destMatch || nearDest)) {
        r._sourceMatch = srcMatch; r._destMatch = destMatch; return true;
      }
      return false;
    });

    // "Schedule for Later" — only rides starting 4+ hours from now
    if (mode === 'later') {
      matched = matched.filter(r => isAfter4Hours(r.ride_time));
    }

    // Sort by time
    matched.sort((a, b) => (a.ride_time || '').localeCompare(b.ride_time || ''));

    showRideResults(matched, fromVal, toVal);

  } catch (err) {
    console.error('Ride search error:', err);
    showRideResults([], fromVal, toVal);
  } finally {
    lbl.textContent = origText;
    goBtn.disabled  = false;
  }
}