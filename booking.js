// ─── RYDR booking.js ─────────────────────────────────────────────────────────
let mode = 'now', cachedGPS = null, activeField = null;
let map = null, marker = null, pendingLatLng = null, pendingAddress = null;
const confirmed = { from: null, to: null };

// Date defaults
const nowD = new Date();
document.getElementById('dateInput').valueAsDate = nowD;
document.getElementById('timeInput').value =
  `${String(nowD.getHours()).padStart(2,'0')}:${String(nowD.getMinutes()).padStart(2,'0')}`;

// ── TOGGLE MODE ──
function setMode(m) {
  mode = m;
  document.getElementById('btnNow').classList.toggle('active', m === 'now');
  document.getElementById('btnLater').classList.toggle('active', m === 'later');
  document.getElementById('datetimeRow').classList.toggle('hidden', m === 'now');
  document.getElementById('btnLabel').textContent = m === 'now' ? 'Find a Ride Now' : 'Schedule Ride';
}

// ── MAP ──
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

function pinIcon(field) {
  const color = field === 'from' ? '#2dbe60' : '#f5a623';
  const label = field === 'from' ? 'A' : 'B';
  return L.divIcon({
    html: `<div style="width:32px;height:42px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.3);"></div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-38%);color:white;font-weight:900;font-size:13px;font-family:Inter,sans-serif;">${label}</div>`,
    className: '', iconSize: [32, 42], iconAnchor: [16, 42],
  });
}

function placePin(latlng) {
  pendingLatLng = latlng;
  if (marker) { marker.setLatLng(latlng); }
  else {
    marker = L.marker(latlng, { icon: pinIcon(activeField), draggable: true }).addTo(map);
    marker.on('dragend', e => placePin(e.target.getLatLng()));
  }
  marker.setIcon(pinIcon(activeField));

  const hint = document.getElementById('mapHint');
  hint.classList.add('show');
  setTimeout(() => hint.classList.remove('show'), 2500);

  reverseGeocode(latlng.lat, latlng.lng);
}

async function reverseGeocode(lat, lng) {
  const bar = document.getElementById('confirmBar');
  const txt = document.getElementById('confirmAddressText');
  txt.textContent = 'Fetching address…';
  bar.classList.add('visible');
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: {'Accept-Language':'en'} });
    const data = await res.json();
    const a = data.address;
    const parts = [];
    if (a.road || a.pedestrian || a.footway) parts.push(a.road || a.pedestrian || a.footway);
    if (a.suburb || a.neighbourhood || a.quarter) parts.push(a.suburb || a.neighbourhood || a.quarter);
    if (a.town || a.city || a.village || a.county) parts.push(a.town || a.city || a.village || a.county);
    if (a.state_district) parts.push(a.state_district);
    pendingAddress = parts.length ? parts.join(', ') : data.display_name.split(',').slice(0,3).join(',');
  } catch { pendingAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
  document.getElementById('confirmAddressText').textContent = pendingAddress;
}

function confirmLocation() {
  if (!activeField || !pendingAddress) return;
  const inp = document.getElementById(activeField === 'from' ? 'fromInput' : 'toInput');
  inp.value = pendingAddress;
  inp.classList.add('confirmed');
  confirmed[activeField] = { lat: pendingLatLng.lat, lng: pendingLatLng.lng, address: pendingAddress };
  document.getElementById('confirmBar').classList.remove('visible');
}

function showMapForPlace(place, field) {
  activeField = field;
  const badge = document.getElementById('mapBadge');
  badge.className = `map-badge ${field}`;
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

// ── DROPDOWN ──
function highlight(text, q) {
  if (!q) return text;
  return text.replace(new RegExp(`(${q})`, 'gi'), '<strong style="color:var(--green-deep)">$1</strong>');
}

function closeAll() { document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open')); }

function buildDropdown(dd, query, inputId) {
  dd.innerHTML = '';
  const field = inputId === 'fromInput' ? 'from' : 'to';
  const locEl = Object.assign(document.createElement('div'), { className: 'dd-item use-location', innerHTML: '<span>📍</span><span>Use my current location</span>' });
  locEl.onclick = () => { useGPSLocation(field); closeAll(); };
  dd.appendChild(locEl);

  const q    = query.toLowerCase().trim();
  const list = q ? PLACES.filter(p => p.name.toLowerCase().includes(q) || p.district.toLowerCase().includes(q)) : PLACES;

  if (!list.length) { dd.insertAdjacentHTML('beforeend', '<div class="dd-no-result">No places found</div>'); return; }

  list.forEach(p => {
    const el = Object.assign(document.createElement('div'), { className: 'dd-item', innerHTML: `<span>🏙️</span><span>${highlight(p.name, q)}</span><span class="dd-district">${p.district}</span>` });
    el.onclick = () => {
      document.getElementById(inputId).value = p.name;
      document.getElementById(inputId).classList.remove('confirmed');
      confirmed[field] = null;
      closeAll();
      showMapForPlace(p, field);
    };
    dd.appendChild(el);
  });
}

function setupInput(inputId, ddId) {
  const inp = document.getElementById(inputId), dd = document.getElementById(ddId);
  inp.addEventListener('focus', () => { buildDropdown(dd, inp.value, inputId); dd.classList.add('open'); });
  inp.addEventListener('input', () => { buildDropdown(dd, inp.value, inputId); dd.classList.add('open'); });
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
}

document.addEventListener('click', e => { if (!e.target.closest('.location-group') && !e.target.closest('.confirm-bar')) closeAll(); });
setupInput('fromInput', 'fromDropdown');
setupInput('toInput',   'toDropdown');

// ── GO RIDE ──
function goRide() {
  const from = document.getElementById('fromInput').value.trim();
  const to   = document.getElementById('toInput').value.trim();
  if (!from || !to) { alert('Please select both pickup and drop locations.'); return; }
  if (from === to)  { alert('Pickup and drop cannot be the same!'); return; }
  const btn = document.querySelector('.go-btn'), lbl = document.getElementById('btnLabel');
  btn.style.opacity = '0.8'; lbl.textContent = 'Searching…';
  setTimeout(() => {
    lbl.textContent = '✓ Rides found!';
    setTimeout(() => { lbl.textContent = mode === 'now' ? 'Find a Ride Now' : 'Schedule Ride'; btn.style.opacity = '1'; }, 2000);
  }, 1100);
}

// Init carousel
document.addEventListener('DOMContentLoaded', () => initCarousel('carousel', 'dots'));