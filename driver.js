// ─── RYDR driver.js ───────────────────────────────────────────────────────────
'use strict';

// ── STATE ──
let driverMode  = 'post';   // 'post' | 'now'
let activeField = null;
let cachedGPS   = null;
let map         = null;
let pendingLatLng = null, pendingAddress = null;
let routeLayer    = null, routeShown = false;
const markers   = { from: null, to: null };
const confirmed = { from: null, to: null };

// Preference chips state
const prefs = { ac: false, music: false, ladies: false, pets: false };

// ── DATE DEFAULTS (lazy — called when accordion opens in post mode) ──
function setDriverDateDefaults() {
  const dateEl = document.getElementById('dateInput');
  const timeEl = document.getElementById('timeInput');
  if (dateEl && !dateEl.value) {
    const nowD = new Date();
    nowD.setMinutes(nowD.getMinutes() + 30);
    dateEl.valueAsDate = nowD;
    timeEl.value = `${String(nowD.getHours()).padStart(2,'0')}:${String(nowD.getMinutes()).padStart(2,'0')}`;
  }
}
// ── MODE SWITCH ──
function setMode(m) {
  const accordion = document.getElementById('driverAccordion');
  const btnClicked = document.getElementById(m === 'post' ? 'btnPost' : 'btnNow');
  const isAlreadyActive = btnClicked.classList.contains('active');

  // Toggle: clicking active button collapses
  if (isAlreadyActive && accordion.classList.contains('open')) {
    accordion.classList.remove('open');
    document.getElementById('btnPost').classList.remove('active');
    document.getElementById('btnNow').classList.remove('active');
    clearRoute();
    closePassengerPanel();
    return;
  }

  driverMode = m;
  document.getElementById('btnPost').classList.toggle('active', m === 'post');
  document.getElementById('btnNow').classList.toggle('active',  m === 'now');

  // Schedule fields only visible in 'post' mode
  document.getElementById('dtRow').classList.toggle('hidden',      m === 'now');
  document.getElementById('tripDetails').classList.toggle('hidden', m === 'now');
  document.getElementById('prefsRow').classList.toggle('hidden',    m === 'now');

  document.getElementById('postBtnLabel').textContent =
    m === 'post' ? 'Post Ride' : 'Find Passengers Now';
  document.getElementById('postBtnIcon').textContent  =
    m === 'post' ? '🚀' : '🔍';

  document.getElementById('sectionHead').textContent =
    m === 'post' ? 'Your Route' : 'Your Current Route';

  accordion.classList.add('open');

  // Set date defaults lazily for post mode
  if (m === 'post') setDriverDateDefaults();

  clearRoute();
  closePassengerPanel();
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
    html: `<div style="width:30px;height:40px;background:${color};border-radius:50% 50% 50% 0;
             transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.28);"></div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-38%);
             color:white;font-weight:900;font-size:12px;font-family:Inter,sans-serif;">${label}</div>`,
    className:'', iconSize:[30,40], iconAnchor:[15,40],
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
  setTimeout(() => hint.classList.remove('show'), 2400);
  reverseGeocode(latlng.lat, latlng.lng);
}

// ── REVERSE GEOCODE ──
async function reverseGeocode(lat, lng) {
  const bar = document.getElementById('confirmBar');
  document.getElementById('confirmAddressText').textContent = 'Fetching address…';
  bar.classList.add('visible');
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await res.json(), a = d.address, p = [];
    if (a.road || a.pedestrian || a.footway)       p.push(a.road || a.pedestrian || a.footway);
    if (a.suburb || a.neighbourhood || a.quarter)  p.push(a.suburb || a.neighbourhood || a.quarter);
    if (a.town || a.city || a.village || a.county) p.push(a.town || a.city || a.village || a.county);
    if (a.state_district) p.push(a.state_district);
    pendingAddress = p.length ? p.join(', ') : d.display_name.split(',').slice(0,3).join(',');
  } catch { pendingAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
  document.getElementById('confirmAddressText').textContent = pendingAddress;
}

// ── CONFIRM LOCATION ──
function confirmLocation() {
  if (!activeField || !pendingAddress) return;
  const inpId = activeField === 'from' ? 'fromInput' : 'toInput';
  const inp   = document.getElementById(inpId);
  inp.value   = pendingAddress; inp.classList.add('confirmed');
  confirmed[activeField] = { lat: pendingLatLng.lat, lng: pendingLatLng.lng, address: pendingAddress };
  document.getElementById('confirmBar').classList.remove('visible');
  if (confirmed.from && confirmed.to) drawRoute();
}

// ── SHOW MAP FOR PLACE ──
function showMapForPlace(place, field) {
  activeField = field;
  const badge = document.getElementById('mapBadge');
  badge.className   = `map-badge ${field}`;
  badge.textContent = field === 'from' ? '🚗 Start' : '🏁 End';
  document.getElementById('confirmForLabel').textContent =
    field === 'from' ? 'Confirming Start Point' : 'Confirming Destination';
  document.getElementById('mapPlaceholder').classList.add('hide');
  initMap(place.lat, place.lng, 13);
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
    inp.value = 'My Location 📍'; inp.disabled = false;
    showMapForPlace({ lat: cachedGPS.latitude, lng: cachedGPS.longitude }, field);
  } else {
    inp.value = ''; inp.placeholder = 'Access denied'; inp.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
// ── ROUTE ──
// ══════════════════════════════════════════════════════

function clearRoute() {
  if (routeLayer) { map && map.removeLayer(routeLayer); routeLayer = null; }
  document.getElementById('routeCard').classList.remove('visible');
  document.getElementById('routeLoader').classList.remove('show');
  document.getElementById('routeEarn').classList.remove('show');
  routeShown = false;
}

async function drawRoute() {
  if (!confirmed.from || !confirmed.to) return;
  clearRoute();
  const card   = document.getElementById('routeCard');
  const loader = document.getElementById('routeLoader');
  card.classList.add('visible'); loader.classList.add('show');
  setStats('—','—','—');

  const { lat: la, lng: lo } = confirmed.from;
  const { lat: lb, lng: lb2 } = confirmed.to;

  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/${lo},${la};${lb2},${lb}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.routes || !data.routes.length) throw new Error('no route');

    const route  = data.routes[0];
    const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    routeLayer = L.layerGroup().addTo(map);

    // Glow underlay
    L.polyline(coords, {
      color:'rgba(45,190,96,0.18)', weight:14,
      lineCap:'round', lineJoin:'round',
    }).addTo(routeLayer);

    // Animated line
    const line = L.polyline(coords, {
      color:'#2dbe60', weight:5,
      lineCap:'round', lineJoin:'round',
      dashArray:'14 7',
    }).addTo(routeLayer);

    routeShown = true;
    animateDash(line);
    map.fitBounds(L.latLngBounds(coords), { padding:[60,60] });

    const km      = route.distance / 1000;
    const priceEl = document.getElementById('priceInput');
    const seats   = parseInt(document.getElementById('seatsInput').value) || 2;
    const price   = priceEl && priceEl.value ? parseFloat(priceEl.value) : Math.round(25 + km * 10);
    const earning = Math.round(price * seats * 0.85); // 85% after platform cut

    loader.classList.remove('show');
    setStats(formatDist(route.distance), formatDur(route.duration), `₹${Math.round(price)}/seat`);
    document.getElementById('routeEarnAmt').textContent =
      `Est. earnings: ₹${earning} for ${seats} seat${seats>1?'s':''}`;
    document.getElementById('routeEarn').classList.add('show');

  } catch {
    const line = L.polyline([[la,lo],[lb,lb2]], {
      color:'#f5a623', weight:3, dashArray:'8 6',
    }).addTo(map);
    routeLayer = line; routeShown = true;
    map.fitBounds(line.getBounds(), { padding:[60,60] });

    const km   = haversine(la, lo, lb, lb2);
    const price = Math.round(25 + km * 10);
    loader.classList.remove('show');
    setStats(`~${km.toFixed(1)} km`, `~${formatDur((km/40)*3600)}`, `₹${price}/seat`);
    document.getElementById('routeEarnAmt').textContent = `Est. earnings: ₹${Math.round(price * 1.7)}`;
    document.getElementById('routeEarn').classList.add('show');
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

function setStats(dist, time, price) {
  document.getElementById('routeDist').textContent  = dist;
  document.getElementById('routeTime').textContent  = time;
  document.getElementById('routePrice').textContent = price;
}

function formatDist(m) { return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m)} m`; }
function formatDur(s) { const h=Math.floor(s/3600), m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m} min`; }
function haversine(la,lo,lb,lb2) {
  const R=6371, dLat=(lb-la)*Math.PI/180, dLng=(lb2-lo)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(la*Math.PI/180)*Math.cos(lb*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ══════════════════════════════════════════════════════
// ── DROPDOWN ──
// ══════════════════════════════════════════════════════

function hl(text, q) {
  if (!q) return text;
  return text.replace(new RegExp(`(${q})`, 'gi'), `<strong style="color:var(--green-deep)">$1</strong>`);
}
function closeAll() { document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open')); }

function buildDropdown(dd, query, inputId) {
  dd.innerHTML = '';
  const field = inputId === 'fromInput' ? 'from' : 'to';
  const locEl = Object.assign(document.createElement('div'), {
    className:'dd-item use-location',
    innerHTML:'<span>📍</span><span>Use my current location</span>',
  });
  locEl.onmousedown = (e) => { e.preventDefault(); useGPSLocation(field); closeAll(); };
  dd.appendChild(locEl);

  const q    = query.toLowerCase().trim();
  const list = q ? PLACES.filter(p => p.name.toLowerCase().includes(q) || p.district.toLowerCase().includes(q)) : PLACES;

  if (!list.length) { dd.insertAdjacentHTML('beforeend','<div class="dd-no-result">No places found</div>'); return; }

  list.forEach(p => {
    const el = Object.assign(document.createElement('div'), {
      className:'dd-item',
      innerHTML:`<span>🏙️</span><span>${hl(p.name,q)}</span><span class="dd-district">${p.district}</span>`,
    });
    el.onmousedown = (e) => {
      e.preventDefault();
      const inp = document.getElementById(inputId);
      inp.value = p.name; inp.classList.remove('confirmed');
      confirmed[field] = null; closeAll(); clearRoute();
      showMapForPlace(p, field);
    };
    dd.appendChild(el);
  });
}

function positionDropdown(inp, dd) {
  const rect = inp.getBoundingClientRect();
  dd.style.top    = (rect.bottom + 4) + 'px';
  dd.style.left   = rect.left + 'px';
  dd.style.width  = rect.width + 'px';
}

function openDropdown(inp, dd, inputId) {
  // Move dropdown to body so it's never clipped by any ancestor
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
  inp.addEventListener('keydown', e => { if (e.key==='Escape') closeAll(); });
  const left = document.querySelector('.left');
  if (left) left.addEventListener('scroll', () => { if (dd.classList.contains('open')) positionDropdown(inp, dd); });
  window.addEventListener('resize', () => { if (dd.classList.contains('open')) positionDropdown(inp, dd); });
}

document.addEventListener('mousedown', e => {
  if (!e.target.closest('.location-group') && !e.target.closest('.dropdown')) closeAll();
});
setupInput('fromInput','fromDd');
setupInput('toInput','toDd');

// ── PREF CHIPS ──
function togglePref(key, el) {
  prefs[key] = !prefs[key];
  el.classList.toggle('active', prefs[key]);
}

// ══════════════════════════════════════════════════════
// ── PASSENGER RESULTS (mock) ──
// ══════════════════════════════════════════════════════

const MOCK_PASSENGERS = [
  { name:'Priya Nair',     route:'Kollam → Kochi',        badge:'2 seats', photo:'https://randomuser.me/api/portraits/women/44.jpg'  },
  { name:'Arjun Menon',    route:'Kollam → Ernakulam',    badge:'1 seat',  photo:'https://randomuser.me/api/portraits/men/31.jpg'   },
  { name:'Divya Krishnan', route:'Punalur → Kochi',       badge:'3 seats', photo:'https://randomuser.me/api/portraits/women/62.jpg' },
  { name:'Rahul Das',      route:'Karunagappally → Kochi',badge:'1 seat',  photo:'https://randomuser.me/api/portraits/men/47.jpg'   },
  { name:'Sneha Thomas',   route:'Chavara → Ernakulam',   badge:'2 seats', photo:'https://randomuser.me/api/portraits/women/28.jpg' },
  { name:'Amal Vijay',     route:'Paravur → Kochi',       badge:'1 seat',  photo:'https://randomuser.me/api/portraits/men/18.jpg'   },
];

function showPassengerPanel() {
  const panel = document.getElementById('passengerPanel');
  const list  = document.getElementById('passengerList');
  list.innerHTML = '';
  // Show matching or all
  const from  = document.getElementById('fromInput').value.trim();
  const shown = from ? MOCK_PASSENGERS : MOCK_PASSENGERS.slice(0, 4);
  if (!shown.length) { list.innerHTML = '<div class="po-empty">No passengers nearby right now.</div>'; }
  else shown.forEach(p => {
    list.insertAdjacentHTML('beforeend', `
      <div class="pax-card">
        <img class="pax-avatar" src="${p.photo}" alt="${p.name}">
        <div>
          <div class="pax-name">${p.name}</div>
          <div class="pax-route">${p.route}</div>
        </div>
        <span class="pax-badge">${p.badge}</span>
      </div>`);
  });
  panel.classList.add('visible');
}

function closePassengerPanel() {
  document.getElementById('passengerPanel').classList.remove('visible');
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('postToast');
  t.querySelector('.toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

// ── MAIN ACTION ──
async function handleAction() {
  const from = document.getElementById('fromInput').value.trim();
  const to   = document.getElementById('toInput').value.trim();

  if (!from) { alert('Please enter your starting location.'); return; }
  if (!to)   { alert('Please enter your destination.'); return; }
  if (from === to) { alert('Start and destination cannot be the same.'); return; }

  // Auto-confirm from PLACES if not already pin-confirmed
  const fp = PLACES.find(p => p.name.toLowerCase() === from.toLowerCase());
  const tp = PLACES.find(p => p.name.toLowerCase() === to.toLowerCase());
  if (fp && !confirmed.from) confirmed.from = { lat: fp.lat, lng: fp.lng, address: fp.name };
  if (tp && !confirmed.to)   confirmed.to   = { lat: tp.lat, lng: tp.lng, address: tp.name };

  if (confirmed.from && confirmed.to) {
    if (!map) {
      document.getElementById('mapPlaceholder').classList.add('hide');
      initMap(confirmed.from.lat, confirmed.from.lng, 10);
    }
    ['from','to'].forEach(f => {
      if (!markers[f]) {
        const c = confirmed[f];
        markers[f] = L.marker([c.lat, c.lng], { icon: pinIcon(f) }).addTo(map);
      }
    });
    setTimeout(() => map && map.invalidateSize(), 100);
    await new Promise(r => setTimeout(r, 150));
    await drawRoute();
  }

  if (driverMode === 'now') {
    setTimeout(() => showPassengerPanel(), 600);
  } else {
    // ── Validate schedule fields ──
    const date = document.getElementById('dateInput').value;
    const time = document.getElementById('timeInput').value;
    if (!date || !time) { alert('Please set a date and time for your ride.'); return; }
    const seats = parseInt(document.getElementById('seatsInput').value);
    if (!seats || seats < 1) { alert('Please enter the number of available seats.'); return; }

    // ── Get price (auto-calculate if blank) ──
    const priceEl = document.getElementById('priceInput');
    const km = (confirmed.from && confirmed.to)
      ? haversine(confirmed.from.lat, confirmed.from.lng, confirmed.to.lat, confirmed.to.lng)
      : 0;
    const price = priceEl && priceEl.value ? parseFloat(priceEl.value) : Math.round(25 + km * 10);
    const totalCost = Math.round(price * seats);

    // ── Get driver from session ──
    const user = rydrGetCurrentUser();
    if (!user) { alert('Session expired. Please log in again.'); window.location.href = 'index.html'; return; }

    // ── Disable button while saving ──
    const btn = document.querySelector('.btn-post');
    const origLabel = document.getElementById('postBtnLabel').textContent;
    btn.disabled = true;
    document.getElementById('postBtnIcon').textContent  = '⏳';
    document.getElementById('postBtnLabel').textContent = 'Posting…';

    try {
      await rydrPostRide({
        driver_id:       user.user_id,
        source:          confirmed.from ? confirmed.from.address : from,
        destination:     confirmed.to   ? confirmed.to.address   : to,
        ride_time:       time + ':00',   // "HH:MM:SS"
        available_seats: seats,
        total_cost:      totalCost,
      });

      document.getElementById('postBtnIcon').textContent  = '✅';
      document.getElementById('postBtnLabel').textContent = 'Posted!';
      showToast(`🎉 Ride posted! ₹${price}/seat · ${seats} seat${seats>1?'s':''} available.`);
      loadMyRides(); // refresh the rides list

      // Reset button after 2s
      setTimeout(() => {
        btn.disabled = false;
        document.getElementById('postBtnIcon').textContent  = '🚀';
        document.getElementById('postBtnLabel').textContent = origLabel;
      }, 2000);

    } catch (err) {
      btn.disabled = false;
      document.getElementById('postBtnIcon').textContent  = '🚀';
      document.getElementById('postBtnLabel').textContent = origLabel;
      alert('Failed to post ride: ' + (err.message || 'Unknown error'));
    }
  }
}

// ── PREVIEW ROUTE ONLY ──
async function previewRoute() {
  const from = document.getElementById('fromInput').value.trim();
  const to   = document.getElementById('toInput').value.trim();
  if (!from || !to) { alert('Enter both locations to preview route.'); return; }

  const fp = PLACES.find(p => p.name.toLowerCase() === from.toLowerCase());
  const tp = PLACES.find(p => p.name.toLowerCase() === to.toLowerCase());
  if (fp && !confirmed.from) confirmed.from = { lat: fp.lat, lng: fp.lng, address: fp.name };
  if (tp && !confirmed.to)   confirmed.to   = { lat: tp.lat, lng: tp.lng, address: tp.name };

  if (confirmed.from && confirmed.to) {
    if (!map) {
      document.getElementById('mapPlaceholder').classList.add('hide');
      initMap(confirmed.from.lat, confirmed.from.lng, 9);
    }
    ['from','to'].forEach(f => {
      if (!markers[f]) {
        const c = confirmed[f];
        markers[f] = L.marker([c.lat, c.lng], { icon: pinIcon(f) }).addTo(map);
      }
    });
    setTimeout(() => { map && map.invalidateSize(); drawRoute(); }, 150);
  } else {
    alert('Select both locations from the list or pin them on the map first.');
  }
}

// ── MY POSTED RIDES ──────────────────────────────────────────────────────────

async function loadMyRides() {
  const list = document.getElementById('myRidesList');
  const user = rydrGetCurrentUser();
  if (!user) return;

  // Show loading state
  list.innerHTML = `<div class="my-rides-loading">
    <div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div>
  </div>`;

  try {
    const rides = await sbFetch(
      `/RIDE?driver_id=eq.${user.user_id}&order=ride_id.desc&select=*`
    );

    if (!rides || rides.length === 0) {
      list.innerHTML = '<div class="my-rides-empty">No rides posted yet. Post your first ride above! 🚗</div>';
      return;
    }

    list.innerHTML = '';
    rides.forEach(ride => {
      const statusClass = ride.ride_status === 'available' ? 'status-available'
                        : ride.ride_status === 'completed'  ? 'status-completed'
                        : 'status-other';
      const statusLabel = ride.ride_status === 'available' ? '🟢 Available'
                        : ride.ride_status === 'completed'  ? '✅ Completed'
                        : `⚪ ${ride.ride_status}`;
      const time = ride.ride_time ? ride.ride_time.slice(0,5) : '—';
      const price = ride.total_cost
        ? `₹${ride.total_cost}`
        : '—';

      list.insertAdjacentHTML('beforeend', `
        <div class="ride-card" data-id="${ride.ride_id}">
          <div class="ride-card-route">
            <div class="ride-card-from">
              <span class="rc-dot rc-dot-a">A</span>
              <span class="rc-place">${ride.source || '—'}</span>
            </div>
            <div class="rc-arrow">↓</div>
            <div class="ride-card-to">
              <span class="rc-dot rc-dot-b">B</span>
              <span class="rc-place">${ride.destination || '—'}</span>
            </div>
          </div>
          <div class="ride-card-meta">
            <span class="rc-meta-item">🕐 ${time}</span>
            <span class="rc-meta-item">💺 ${ride.available_seats} seat${ride.available_seats !== 1 ? 's' : ''}</span>
            <span class="rc-meta-item">💰 ${price}</span>
          </div>
          <div class="ride-card-footer">
            <span class="ride-status-badge ${statusClass}">${statusLabel}</span>
            ${ride.ride_status === 'available'
              ? `<button class="rc-cancel-btn" onclick="cancelRide(${ride.ride_id}, this)">Cancel</button>`
              : ''}
          </div>
        </div>
      `);
    });

  } catch (err) {
    list.innerHTML = `<div class="my-rides-empty" style="color:#e05252;">Failed to load rides: ${err.message}</div>`;
  }
}

async function cancelRide(rideId, btn) {
  if (!confirm('Cancel this ride?')) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    await sbFetch(`/RIDE?ride_id=eq.${rideId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ride_status: 'cancelled' }),
    });
    loadMyRides(); // refresh list
  } catch (err) {
    alert('Failed to cancel: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Cancel';
  }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Show driver name
  const user = rydrGetCurrentUser();
  if (user && user.name) {
    const stats = document.querySelector('.driver-stats');
    if (stats) {
      const greeting = document.createElement('div');
      greeting.className = 'driver-greeting';
      greeting.innerHTML = `👋 Hello, <strong>${user.name.split(' ')[0]}</strong>`;
      stats.insertAdjacentElement('beforebegin', greeting);
    }
  }
  // Load their posted rides
  loadMyRides();
});