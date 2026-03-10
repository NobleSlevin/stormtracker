const CACHE = 'stormwatch-v2.1.0';
const ASSETS = ['/', '/index.html', '/app.js?v=2.1.0', '/icon.png', '/manifest.json'];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// ── Fetch (network-first for API, cache-first for assets) ────────────────────
self.addEventListener('fetch', e => {
  if (e.request.url.includes('api.weather.gov') ||
      e.request.url.includes('zippopotam') ||
      e.request.url.includes('nominatim') ||
      e.request.url.includes('ip-api')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"features":[]}', {headers:{'Content-Type':'application/json'}})));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});

// ── Push notification state ──────────────────────────────────────────────────
let _alertPollTimer = null;
let _alertPollLat   = null;
let _alertPollLon   = null;
let _seenAlertIds   = new Set();
let _seenLoaded     = false;
let _alertPrefs     = {}; // keyed: tornado, thunder, flood, wind, winter, other

const NWS = 'https://api.weather.gov';

// ── Message from app: start/stop polling, update location ───────────────────
self.addEventListener('message', e => {
  const msg = e.data || {};

  if (msg.type === 'START_ALERT_POLL') {
    _alertPollLat = msg.lat;
    _alertPollLon = msg.lon;
    if (msg.prefs) _alertPrefs = msg.prefs;
    if (!_alertPollTimer) scheduleAlertPoll(0); // fire immediately
  }

  if (msg.type === 'UPDATE_LOCATION') {
    _alertPollLat = msg.lat;
    _alertPollLon = msg.lon;
  }

  if (msg.type === 'UPDATE_PREFS') {
    _alertPrefs = msg.prefs || {};
  }

  if (msg.type === 'STOP_ALERT_POLL') {
    if (_alertPollTimer) { clearTimeout(_alertPollTimer); _alertPollTimer = null; }
  }

  // App tells SW which alert IDs it already showed — avoids re-notifying on SW restart
  if (msg.type === 'SEEN_IDS') {
    msg.ids.forEach(id => _seenAlertIds.add(id));
    _seenLoaded = true;
  }
});

// ── Notification click: focus app and open Alerts tab ───────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const action = e.action;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'OPEN_TAB', tab: 'alerts' });
          return;
        }
      }
      // Otherwise open new window
      return self.clients.openWindow('/?tab=alerts');
    })
  );
});

// ── Poll loop ────────────────────────────────────────────────────────────────
function scheduleAlertPoll(delayMs) {
  if (_alertPollTimer) clearTimeout(_alertPollTimer);
  _alertPollTimer = setTimeout(async () => {
    await runAlertPoll();
    // Dynamic interval: 3 min if any severe alert active, else 15 min
    const hasSevere = _lastPollHadSevere;
    scheduleAlertPoll(hasSevere ? 3 * 60 * 1000 : 15 * 60 * 1000);
  }, delayMs);
}

let _lastPollHadSevere = false;

async function runAlertPoll() {
  if (_alertPollLat == null || _alertPollLon == null) return;
  try {
    const res = await fetch(
      `${NWS}/alerts/active?point=${_alertPollLat.toFixed(4)},${_alertPollLon.toFixed(4)}`,
      { headers: { 'User-Agent': 'StormWatch PWA' } }
    );
    if (!res.ok) return;
    const data = await res.json();
    const features = data.features || [];

    _lastPollHadSevere = features.some(f => {
      const sev = f.properties?.severity || '';
      return sev === 'Extreme' || sev === 'Severe';
    });

    // Find alerts we haven't notified about yet
    const newAlerts = features.filter(f => {
      const id = f.properties?.id || f.id;
      return id && !_seenAlertIds.has(id);
    });

    // Also detect expired alerts we previously saw (for all-clear)
    const currentIds = new Set(features.map(f => f.properties?.id || f.id).filter(Boolean));
    const expiredSevere = [..._seenAlertIds].filter(id => {
      return !currentIds.has(id) && _seenSevereIds.has(id);
    });

    // Fire notifications for new alerts (most severe first, max 3)
    const sorted = newAlerts.sort((a, b) => {
      const o = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 };
      return (o[a.properties?.severity] ?? 4) - (o[b.properties?.severity] ?? 4);
    }).slice(0, 3);

    for (const alert of sorted) {
      const id = alert.properties?.id || alert.id;
      _seenAlertIds.add(id);
      const p = alert.properties || {};
      if (p.severity === 'Extreme' || p.severity === 'Severe') _seenSevereIds.add(id);
      if (alertPassesFilter(p)) await fireAlertNotification(p);
    }

    // All-clear notification if a previous severe alert just expired
    if (expiredSevere.length > 0 && features.length === 0) {
      expiredSevere.forEach(id => { _seenAlertIds.delete(id); _seenSevereIds.delete(id); });
      await self.registration.showNotification('✅ All Clear', {
        body: 'Previous weather alerts have expired. Conditions improving.',
        icon: '/icon.png',
        badge: '/icon.png',
        tag: 'stormwatch-allclear',
        data: { tab: 'alerts' }
      });
    }

    // Sync seen IDs back to all app clients
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({
      type: 'SEEN_IDS_SYNC',
      ids: [..._seenAlertIds]
    }));

  } catch(e) {
    console.warn('[SW] Alert poll error:', e);
  }
}

// Track which seen IDs were severe (for all-clear logic)
const _seenSevereIds = new Set();

function alertPassesFilter(p) {
  // If no prefs set, allow all
  if (!_alertPrefs || Object.keys(_alertPrefs).length === 0) return true;
  const ev = (p.event || '').toLowerCase();
  if (/tornado/.test(ev))                            return _alertPrefs.tornado !== false;
  if (/thunderstorm|tstm/.test(ev))                  return _alertPrefs.thunder !== false;
  if (/flood/.test(ev))                              return _alertPrefs.flood   !== false;
  if (/wind/.test(ev))                               return _alertPrefs.wind    !== false;
  if (/winter|snow|blizzard|ice|sleet|freeze|frost/.test(ev)) return _alertPrefs.winter !== false;
  return _alertPrefs.other !== false;
}

async function fireAlertNotification(p) {
  const sev   = p.severity || 'Unknown';
  const event = p.event || 'Weather Alert';
  const area  = (p.areaDesc || '').split(';')[0].trim();
  const expires = p.expires || p.ends;
  const headline = p.headline || '';

  // Severity emoji
  const emoji = sevEmoji(sev, event);

  // Title
  const title = `${emoji} ${event}`;

  // Body — pull NWS headline if available, otherwise build from parts
  let body = '';
  if (headline) {
    // NWS headlines are already well-written — trim to 120 chars
    body = headline.replace(/^.*issued.*?for\s+/i, '').substring(0, 120);
  } else {
    body = area ? `${area}` : '';
  }

  // Append expiry time if present and body has room
  if (expires) {
    const expDate = new Date(expires);
    const h = expDate.getHours(), m = expDate.getMinutes();
    const timeStr = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
    if (body.length < 80) body += ` · Until ${timeStr}`;
  }

  // Urgency-based vibration pattern
  const vibrate = (sev === 'Extreme') ? [200, 100, 200, 100, 400]
                : (sev === 'Severe')  ? [200, 100, 200]
                : [150];

  await self.registration.showNotification(title, {
    body: body || 'Tap to view details.',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: `stormwatch-${p.id || event}`,     // deduplicates same alert
    renotify: false,
    vibrate,
    requireInteraction: sev === 'Extreme',  // stays on screen for tornado/extreme
    data: { tab: 'alerts', alertId: p.id }
  });
}

function sevEmoji(severity, event) {
  const ev = (event || '').toLowerCase();
  if (ev.includes('tornado'))                          return '🌪️';
  if (ev.includes('hurricane') || ev.includes('typhoon')) return '🌀';
  if (ev.includes('thunderstorm') || ev.includes('tstm')) return '⛈️';
  if (ev.includes('flash flood') || ev.includes('flood')) return '🌊';
  if (ev.includes('snow') || ev.includes('blizzard') || ev.includes('ice')) return '❄️';
  if (ev.includes('wind'))                             return '💨';
  if (ev.includes('fire'))                             return '🔥';
  if (ev.includes('heat'))                             return '🌡️';
  if (severity === 'Extreme' || severity === 'Severe') return '⚠️';
  return '🔔';
}
