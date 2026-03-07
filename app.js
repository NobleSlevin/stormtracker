// ── SERVICE WORKER ────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e));
  });
}

// ── INSTALL BANNER ────────────────────────────────
window.addEventListener('load', () => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const dismissed = sessionStorage.getItem('sw-install-dismissed');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !isStandalone && !dismissed) {
    document.getElementById('installBanner').classList.add('show');
  }
  document.getElementById('installClose').addEventListener('click', () => {
    document.getElementById('installBanner').classList.remove('show');
    sessionStorage.setItem('sw-install-dismissed', '1');
  });
});

const NWS = 'https://api.weather.gov';
const OM  = 'https://api.open-meteo.com/v1/forecast';
let allAlerts = [], activeFilter = 'all', refreshTimer = null;
let curLat = null, curLon = null, curMode = null, curState = null;
let omData = null; // Open-Meteo current data

// ── TABS ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('on'));
    btn.classList.add('on');
    const map = {alerts:'tabAlerts', forecast:'tabForecast', nearby:'tabNearby', tornado:'tabTornado'};
    document.getElementById(map[t]).classList.add('on');
    document.getElementById('filterRow').style.display = t === 'alerts' ? 'flex' : 'none';
  });
});

// ── HELPERS ───────────────────────────────────────
async function nwsFetch(url) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/geo+json' }, signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } catch(e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}
function setLive(state, txt) {
  document.getElementById('ldot').className = 'ldot ' + (state === 'ok' ? '' : state);
  document.getElementById('liveText').textContent = txt;
}
function sevClass(sev, ev) {
  ev = (ev||'').toLowerCase(); sev = (sev||'');
  if (sev==='Extreme'||ev.includes('tornado warning')||ev.includes('flash flood emergency')) return 'sev-extreme';
  if (sev==='Severe'||ev.includes('warning')) return 'sev-severe';
  if (sev==='Moderate'||ev.includes('watch')) return 'sev-moderate';
  if (sev==='Minor'||ev.includes('advisory')||ev.includes('statement')) return 'sev-minor';
  return 'sev-unknown';
}
function sevLabel(s) { return {Extreme:'EXTREME',Severe:'SEVERE',Moderate:'MODERATE',Minor:'MINOR'}[s]||'ALERT'; }
function sevColor(sev, ev) {
  return {'sev-extreme':'var(--red)','sev-severe':'var(--orange)','sev-moderate':'var(--yellow)','sev-minor':'var(--blue)'}[sevClass(sev,ev)]||'var(--dim)';
}
function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); } catch { return iso; }
}
function wxIcon(s, size=18) {
  s = (s||'').toLowerCase();
  // All paths inline — no <use> references which clip at small sizes
  let path;
  if (s.includes('tornado')) {
    path = `<path d="M1.125 2.45A.9.9 0 0 1 1 2c0-.26.116-.474.258-.634a1.9 1.9 0 0 1 .513-.389c.387-.21.913-.385 1.52-.525C4.514.17 6.18 0 8 0c1.821 0 3.486.17 4.709.452.607.14 1.133.314 1.52.525.193.106.374.233.513.389.141.16.258.374.258.634 0 1.011-.35 1.612-.634 2.102l-.116.203a2.6 2.6 0 0 0-.313.809 3 3 0 0 0-.011.891.5.5 0 0 1 .428.849q-.091.09-.215.195c.204 1.116.088 1.99-.3 2.711-.453.84-1.231 1.383-2.02 1.856q-.307.183-.62.364c-1.444.832-2.928 1.689-3.735 3.706a.5.5 0 0 1-.748.226l-.001-.001-.002-.001-.004-.003-.01-.008a2 2 0 0 1-.147-.115 4.1 4.1 0 0 1-1.179-1.656 3.8 3.8 0 0 1-.247-1.296A.5.5 0 0 1 5 12.5v-.018l.008-.079a.73.73 0 0 1 .188-.386c.09-.489.272-1.014.573-1.574a.5.5 0 0 1 .073-.918 3.3 3.3 0 0 1 .617-.144l.15-.193c.285-.356.404-.639.437-.861a.95.95 0 0 0-.122-.619c-.249-.455-.815-.903-1.613-1.43q-.291-.19-.609-.394l-.119-.076a12 12 0 0 1-1.241-.334.5.5 0 0 1-.285-.707l-.23-.18C2.117 4.01 1.463 3.32 1.125 2.45"/>`;
  } else if (s.includes('thunder') || s.includes('tstm')) {
    path = `<path d="M13.405 4.027a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10H13a3 3 0 0 0 .405-5.973M8.5 1a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1 0 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 1M7.053 11.276A.5.5 0 0 1 7.5 11h2a.5.5 0 0 1 .473.664l-.334 1H11a.5.5 0 0 1 .39.812l-4 5a.5.5 0 0 1-.871-.464l.853-3.41H5.5a.5.5 0 0 1-.447-.724z"/>`;
  } else if (s.includes('blizzard') || s.includes('snow') || s.includes('sleet') || s.includes('ice')) {
    path = `<path d="M8 16a.5.5 0 0 1-.5-.5v-1.293l-.646.647a.5.5 0 0 1-.707-.708L7.5 12.793V8.866l-3.4 1.963-.496 1.85a.5.5 0 1 1-.966-.26l.237-.882-1.12.646a.5.5 0 0 1-.5-.866l1.12-.646-.884-.237a.5.5 0 1 1 .26-.966l1.848.495L7 8 3.6 6.037l-1.85.495a.5.5 0 0 1-.258-.966l.883-.237-1.12-.646a.5.5 0 1 1 .5-.866l1.12.646-.237-.883a.5.5 0 1 1 .966-.258l.495 1.849L7.5 7.134V3.207L6.147 1.854a.5.5 0 1 1 .707-.708l.646.647V.5a.5.5 0 1 1 1 0v1.293l.647-.647a.5.5 0 1 1 .707.708L8.5 3.207v3.927l3.4-1.963.496-1.85a.5.5 0 1 1 .966.26l-.236.882 1.12-.646a.5.5 0 0 1 .5.866l-1.12.646.883.237a.5.5 0 1 1-.26.966l-1.848-.495L9 8l3.4 1.963 1.849-.495a.5.5 0 0 1 .259.966l-.883.237 1.12.646a.5.5 0 0 1-.5.866l-1.12-.646.236.883a.5.5 0 1 1-.966.258l-.495-1.849-3.4-1.963v3.927l1.353 1.353a.5.5 0 0 1-.707.708l-.647-.647V15.5a.5.5 0 0 1-.5.5"/>`;
  } else if (s.includes('rain') || s.includes('shower') || s.includes('drizzle')) {
    path = `<path d="M4.158 12.025a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 0 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 0 1-.948-.316l1-3a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 0 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 0 1-.948-.316l1-3a.5.5 0 0 1 .633-.317zM4 1a3.5 3.5 0 0 1 3.5 3.5.5.5 0 0 0 .5.5 1.5 1.5 0 0 1 1.5 1.5v.5h.5a2.5 2.5 0 0 1 0 5h-9a2.5 2.5 0 0 1 0-5H2v-.5A3.5 3.5 0 0 1 4 1z"/>`;
  } else if (s.includes('fog') || s.includes('mist') || s.includes('haz')) {
    path = `<path d="M4 12.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m2 2a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5M13.405 4.027a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10H13a3 3 0 0 0 .405-5.973M8.5 1a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1 0 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 1"/>`;
  } else if (s.includes('wind') || s.includes('breezy') || s.includes('blustery')) {
    path = `<path d="M12.5 2A2.5 2.5 0 0 0 10 4.5a.5.5 0 0 1-1 0A3.5 3.5 0 1 1 12.5 8H.5a.5.5 0 0 1 0-1h12a2.5 2.5 0 0 0 0-5m-7 1a1 1 0 0 0-1 1 .5.5 0 0 1-1 0 2 2 0 1 1 2 2H.5a.5.5 0 0 1 0-1H6.5a1 1 0 0 0 0-2M0 9.5A.5.5 0 0 1 .5 9h10.042a3 3 0 1 1-3 3 .5.5 0 0 1 1 0 2 2 0 1 0 2-2H.5a.5.5 0 0 1-.5-.5"/>`;
  } else if (s.includes('sunny') || s.includes('clear')) {
    path = `<path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>`;
  } else if (s.includes('partly') || s.includes('mostly sunny') || s.includes('mostly clear')) {
    path = `<path d="M7 8a3.5 3.5 0 0 1 3.5 3.555.5.5 0 0 0 .624.492A1.503 1.503 0 0 1 13 13.5a1.5 1.5 0 0 1-1.5 1.5H3A2.5 2.5 0 0 1 3 9h.5A3.5 3.5 0 0 1 7 8m2 .276a4.5 4.5 0 0 0-4.5 3.5.5.5 0 0 1-.5.5A1.5 1.5 0 0 0 3 14h8.5a.5.5 0 0 0 0-1 .5.5 0 0 1-.5-.5 4.5 4.5 0 0 0-2-.724M10.5 2.5a.5.5 0 0 0-1 0v1a.5.5 0 0 0 1 0zm3 1.5a.5.5 0 0 0-.707-.707l-.707.707A.5.5 0 0 0 12.793 5zM10 5.5A2.5 2.5 0 1 0 15 5.5a2.5 2.5 0 0 0-5 0m2.5-1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m3.457 2.707a.5.5 0 1 0-.707-.707l-.707.707a.5.5 0 0 0 .707.707zm-5.457 0a.5.5 0 0 0 .707.707l.707-.707A.5.5 0 0 0 10.5 6.5zm5-2.207a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1z"/>`;
  } else {
    // cloudy / overcast / default
    path = `<path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.476A5.5 5.5 0 0 1 4.406 3.342"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="currentColor" viewBox="0 0 16 16">${path}</svg>`;
}
function tempClass(t) {
  if(t>=95)return't-hot'; if(t>=80)return't-warm'; if(t>=60)return't-mild'; if(t>=40)return't-cool'; return't-cold';
}
function cToF(c) { return c != null ? Math.round(c * 9/5 + 32) : null; }
function msToMph(ms) { return ms != null ? Math.round(ms * 2.237) : null; }
function mToMi(m) { return m != null ? Math.round(m / 1609.34 * 10) / 10 : null; }
function paToMb(pa) { return pa != null ? Math.round(pa / 100) : null; }

// ── ALERTS ────────────────────────────────────────
function renderAlerts(alerts) {
  const filtered = activeFilter==='all' ? alerts : alerts.filter(a=>(a.properties.severity||'')===activeFilter);
  document.getElementById('alertBadge').textContent = `${filtered.length} alert${filtered.length!==1?'s':''}`;
  const total=alerts.length, warns=alerts.filter(a=>(a.properties.event||'').toLowerCase().includes('warning')).length;
  const watches=alerts.filter(a=>(a.properties.event||'').toLowerCase().includes('watch')).length;
  document.getElementById('sTotal').textContent=total;
  document.getElementById('sWarnings').textContent=warns;
  document.getElementById('sWatches').textContent=watches;
  document.getElementById('sUpdated').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  updateTicker(alerts);
  const box=document.getElementById('panelAlerts');
  if(!filtered.length){
    box.innerHTML=`<div class="state-center"><div class="state-icon">${total>0?'<svg width="28" height="28" fill="currentColor"><use href="#bi-search"/></svg>':'<svg width="28" height="28" fill="var(--green)"><use href="#bi-check-circle"/></svg>'}</div><div class="state-ttl">${total>0?'No Match':'All Clear'}</div><div class="state-sub">${total>0?'Try a different filter':'No active NWS alerts'}</div></div>`;
    return;
  }
  box.innerHTML=filtered.map(a=>{
    const p=a.properties, sc=sevClass(p.severity,p.event);
    const areas=(p.areaDesc||'').split(';').slice(0,3).join('; ');
    const desc=(p.description||'').trim().substring(0,400);
    return`<div class="alert-card ${sc}">
      <div class="ac-header"><div class="ac-stripe"></div><div class="ac-event">${p.event||'Alert'}</div><div class="ac-badge">${sevLabel(p.severity)}</div><span class="ac-chevron"><svg width="10" height="10" fill="currentColor"><use href="#bi-chevron-right"/></svg></span></div>
      <div class="ac-body">
        <div class="ac-area">${areas||'Area unspecified'}</div>
        <div class="ac-times"><div class="ac-time-item"><span class="ac-time-lbl">Onset</span><span class="ac-time-val">${fmt(p.onset||p.effective)}</span></div><div class="ac-time-item"><span class="ac-time-lbl">Expires</span><span class="ac-time-val">${fmt(p.expires||p.ends)}</span></div></div>
        <div class="ac-desc">${desc}${desc.length>=400?'…':''}</div>
      </div></div>`;
  }).join('');
  box.querySelectorAll('.alert-card').forEach(el=>el.addEventListener('click',()=>el.classList.toggle('open')));
}
function updateTicker(alerts) {
  const inner=document.getElementById('tickerInner');
  if(!alerts.length){inner.innerHTML='<svg width="10" height="10" fill="var(--green)" style="margin-right:4px"><use href="#bi-check-circle"/></svg> ALL CLEAR — No active NWS alerts.';return;}
  inner.innerHTML=alerts.slice(0,12).map(a=>{
    const p=a.properties;
    return`<span style="color:${sevColor(p.severity,p.event)}">⚠ ${p.event}</span> — ${(p.areaDesc||'').split(';')[0].trim()}`;
  }).join('<span class="tsep">///</span>');
}
function setFilter(f){
  activeFilter=f;
  document.querySelectorAll('.fbtn').forEach(b=>{b.classList.remove('on');if(b.dataset.f===f)b.classList.add('on');});
  renderAlerts(allAlerts);
}
async function fetchAlerts(url){
  setLive('loading','LOADING…');
  document.getElementById('panelAlerts').innerHTML=`<div class="state-center"><div class="spinner"></div><div class="state-sub" style="margin-top:10px">Querying NWS…</div></div>`;
  try{
    const d=await nwsFetch(url);
    allAlerts=(d.features||[]).sort((a,b)=>{const o={Extreme:0,Severe:1,Moderate:2,Minor:3};return(o[a.properties.severity]??4)-(o[b.properties.severity]??4);});
    renderAlerts(allAlerts);
    setLive('ok',`LIVE · ${allAlerts.length}`);
    if(refreshTimer)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(refresh,120000);
  }catch(e){
    setLive('err','ERROR');
    document.getElementById('panelAlerts').innerHTML=`<div class="state-center"><div class="state-icon"><svg width="28" height="28" fill="var(--orange)"><use href="#bi-exclamation-triangle"/></svg></div><div class="state-ttl">Failed</div><div class="state-sub" style="margin-bottom:10px">${e.message}</div><button class="cbtn" id="retryBtn"><svg width="12" height="12" fill="currentColor"><use href="#bi-arrow-repeat"/></svg> Retry</button></div>`;
    const rb=document.getElementById('retryBtn'); if(rb) rb.addEventListener('click', refresh);
  }
}

// ── FORECAST + HOURLY ─────────────────────────────
async function fetchForecast(lat, lon) {
  try {
    const pt=await nwsFetch(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    const pp=pt.properties||{};
    const city=pp.relativeLocation?.properties;
    if(city){
      document.getElementById('locName').textContent=city.city;
      document.getElementById('locSub').textContent = city.state;
      // city.state is the abbreviation from NWS — reverse-lookup full name for display
      const stateNames = {'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California','CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming'};
      curState = stateNames[city.state] || city.state;
    }
    const results = { periods: [], hourly: [], stationUrl: pp.observationStations };
    if(pp.forecast){
      const fc=await nwsFetch(pp.forecast);
      results.periods=fc.properties?.periods||[];
      renderForecast(results.periods);
    }
    if(pp.forecastHourly){
      const fh=await nwsFetch(pp.forecastHourly);
      results.hourly=fh.properties?.periods||[];
      renderHourly(results.hourly);
    }
    return results;
  }catch(e){console.warn('Forecast error:',e);return{periods:[],hourly:[],stationUrl:null};}
}

function renderForecast(periods){
  const box=document.getElementById('panelForecast');
  if(!periods.length){box.innerHTML='<div class="state-center"><div class="state-icon">🌤️</div><div class="state-ttl">No data</div></div>';return;}
  const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hero_p = periods[0];
  const dayMap = new Map();
  for (let i = 1; i < periods.length; i++) {
    const p = periods[i];
    const dt = new Date(p.startTime);
    const dateKey = dt.toDateString();
    if (!dayMap.has(dateKey)) { dayMap.set(dateKey, p); }
    else if (p.isDaytime) { dayMap.set(dateKey, p); }
  }
  const days = [hero_p, ...[...dayMap.values()].slice(0, 6)];
  const now=new Date(), hero=days[0];
  const heroHTML=hero?`<div class="fc-hero">
    <div class="fch-top"><div class="fch-day">${dn[now.getDay()]}, ${mn[now.getMonth()]} ${now.getDate()}</div><div class="fch-time">${now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div></div>
    <div class="fch-temp">${hero.temperature}<sup>°${hero.temperatureUnit}</sup></div>
    <div class="fch-icon">${wxIcon(hero.shortForecast, 56)}</div>
    <div class="fch-meta"><div>${hero.shortForecast}</div><div>Wind: <b>${hero.windDirection||''} ${hero.windSpeed||''}</b></div></div>
  </div>`:'';
  const rows=days.slice(1,7).map(d=>{const dt=new Date(d.startTime);return`<div class="fc-day-row"><span class="fdr-name">${dn[dt.getDay()]}</span><span class="fdr-icon">${wxIcon(d.shortForecast)}</span><span class="fdr-desc">${d.shortForecast}</span><span class="fdr-temp ${tempClass(d.temperature)}">${d.temperature}°</span></div>`;}).join('');
  box.innerHTML=heroHTML
    +'<div class="hourly-toggle" id="hourlyToggle"><span class="hourly-toggle-lbl"><svg width="12" height="12" fill="currentColor"><use href="#bi-sun"/></svg> Hourly Forecast</span><span class="hourly-toggle-chevron"><svg width="10" height="10" fill="currentColor"><use href="#bi-chevron-right"/></svg></span></div>'
    +'<div class="hourly-scroll" id="hourlyScroll"><div class="hourly-track" id="hourlyTrack"></div></div>'
    +'<div class="fc-days">'+rows+'</div>';
  document.getElementById('hourlyToggle').addEventListener('click', () => {
    document.getElementById('hourlyToggle').classList.toggle('open');
    document.getElementById('hourlyScroll').classList.toggle('open');
  });
}

function renderHourly(periods) {
  const track = document.getElementById('hourlyTrack');
  if (!track || !periods.length) return;
  track.innerHTML = periods.slice(0, 24).map(p => {
    const dt = new Date(p.startTime);
    const hr = dt.toLocaleTimeString([], {hour:'numeric'});
    const precip = p.probabilityOfPrecipitation?.value;
    const windNums = (p.windSpeed||'0').match(/\d+/g)||['0'];
    const windMax = Math.max(...windNums.map(Number));
    return `<div class="hour-card">
      <span class="hc-time">${hr}</span>
      <span class="hc-icon">${wxIcon(p.shortForecast)}</span>
      <span class="hc-temp ${tempClass(p.temperature)}">${p.temperature}°</span>
      ${precip != null ? `<span class="hc-precip">${precip}%</span>` : ''}
      <span class="hc-wind">${windMax}mph</span>
    </div>`;
  }).join('');
}

// ── OBSERVATIONS ──────────────────────────────────
async function fetchObservations(stationsUrl) {
  if (!stationsUrl) return;
  try {
    // Get list of nearest stations
    const st = await nwsFetch(stationsUrl + '?limit=1');
    const stationId = st.features?.[0]?.properties?.stationIdentifier;
    if (!stationId) return;
    const obs = await nwsFetch(`${NWS}/stations/${stationId}/observations/latest`);
    const p = obs.properties;
    if (!p) return;
    const tempF = cToF(p.temperature?.value);
    const dewF  = cToF(p.dewpoint?.value);
    const humid = p.relativeHumidity?.value != null ? Math.round(p.relativeHumidity.value) : null;
    // NWS observations windSpeed unitCode is wmoUnit:km_h-1 (km/h), not m/s
    const windUnit = p.windSpeed?.unitCode || '';
    let windMph = null;
    if (p.windSpeed?.value != null) {
      if (windUnit.includes('km_h') || windUnit.includes('km/h')) {
        windMph = Math.round(p.windSpeed.value * 0.621);
      } else {
        // fallback: assume m/s
        windMph = msToMph(p.windSpeed.value);
      }
    }
    const pressMb = paToMb(p.barometricPressure?.value);
    const visMi  = mToMi(p.visibility?.value);
    const set = (id, val) => { if (val != null) document.getElementById(id).textContent = val; };
    set('obsTemp',  tempF);
    set('obsHumid', humid);
    set('obsDew',   dewF);
    set('obsWind',  windMph);
    set('obsPress', pressMb);
    set('obsVis',   visMi);
    document.getElementById('obsStrip').classList.add('show');
    // Store station id for Nearby tab
    return { stationId, name: st.features?.[0]?.properties?.name || stationId };
  } catch(e) { console.warn('Obs error:', e); }
}

// ── NEARBY TAB ────────────────────────────────────
async function fetchNearby(lat, lon, stationsUrl) {
  const box = document.getElementById('panelNearby');
  box.innerHTML = `<div class="state-center"><div class="spinner"></div><div class="state-sub" style="margin-top:10px">Loading nearby data…</div></div>`;

  const sections = [];

  // ── 1. Nearest radar station ──
  try {
    const radars = await nwsFetch(`${NWS}/radar/stations`);
    const stations = radars.features || [];
    let nearest = null, nearestDist = Infinity;
    for (const s of stations) {
      const [slon, slat] = s.geometry?.coordinates || [];
      if (slat == null) continue;
      const dist = Math.sqrt(Math.pow(slat - lat, 2) + Math.pow(slon - lon, 2));
      if (dist < nearestDist) { nearestDist = dist; nearest = s; }
    }
    if (nearest) {
      const sp = nearest.properties;
      const sid = sp.stationIdentifier || nearest.id?.split('/').pop() || '—';
      const [rlon, rlat] = nearest.geometry?.coordinates || [];
      const miles = Math.round(Math.sqrt(Math.pow((rlat-lat)*69,2) + Math.pow((rlon-lon)*54,2)));
      const stationType = sp.stationType || 'NEXRAD';
      const elevation = sp.elevation?.value != null ? Math.round(sp.elevation.value * 3.281) + ' ft' : '—';
      const radarUrl = `https://radar.weather.gov/station/${sid}/standard`;
      sections.push(`
        <div class="section-ttl">Nearest Radar Station</div>
        <div class="radar-card">
          <div class="radar-header">
            <div class="radar-pulse">
              <svg width="16" height="16" fill="var(--green)"><use href="#bi-broadcast"/></svg>
            </div>
            <div class="radar-info">
              <div class="radar-name">${sp.name || sid}</div>
              <div class="radar-meta">${sp.timeZone || ''}</div>
            </div>
            <div class="radar-dist">${miles} mi</div>
          </div>
          <div class="radar-details" style="grid-template-columns:repeat(5,1fr)">
            <div class="rdt-item"><span class="rdt-label">ID</span><span class="rdt-val" style="color:var(--green);font-family:var(--mono)">${sid}</span></div>
            <div class="rdt-item"><span class="rdt-label">Type</span><span class="rdt-val">${stationType}</span></div>
            <div class="rdt-item"><span class="rdt-label">Elev</span><span class="rdt-val">${elevation}</span></div>
            <div class="rdt-item"><span class="rdt-label">Lat</span><span class="rdt-val">${rlat != null ? rlat.toFixed(2) : '—'}°</span></div>
            <div class="rdt-item"><span class="rdt-label">Lon</span><span class="rdt-val">${rlon != null ? rlon.toFixed(2) : '—'}°</span></div>
          </div>
          <a class="radar-link" href="${radarUrl}" target="_blank">
            <svg width="12" height="12" fill="currentColor"><use href="#bi-broadcast"/></svg>
            View Live Radar →
          </a>
        </div>`);
    }
  } catch(e) { console.warn('Radar stations error:', e); }

  // ── 2. State alert count ──
  try {
    if (curState) {
      const stateMap = {'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'};
      const abbr = stateMap[curState] || curState;
      const stateAlerts = await nwsFetch(`${NWS}/alerts/active?area=${abbr}`);
      const sa = stateAlerts.features || [];
      const warns = sa.filter(a=>(a.properties.event||'').toLowerCase().includes('warning')).length;
      const watches = sa.filter(a=>(a.properties.event||'').toLowerCase().includes('watch')).length;
      const adv = sa.filter(a=>(a.properties.event||'').toLowerCase().includes('advisory')).length;
      const countColor = sa.length >= 10 ? 'var(--red)' : sa.length >= 5 ? 'var(--orange)' : sa.length > 0 ? 'var(--yellow)' : 'var(--green)';
      const geoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="${countColor}" viewBox="0 0 16 16"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/></svg>`;
      sections.push(`
        <div class="section-ttl" style="margin-top:4px">State Alerts — ${curState}</div>
        <div class="state-alert-card">
          <div class="state-alert-header">
            <div class="state-flag">${geoIcon}</div>
            <div class="state-name-block">
              <div class="state-name">${curState}</div>
              <div style="font-size:10px;color:var(--dim);font-family:var(--mono)">${abbr} · NWS Active Alerts</div>
            </div>
            <div class="state-count-badge" style="background:${sa.length>0?'rgba(248,113,113,.12)':'rgba(74,222,128,.08)'};color:${countColor};border:1px solid ${countColor}33">${sa.length} alert${sa.length!==1?'s':''}</div>
          </div>
          <div class="state-breakdown">
            <div class="sbd-item"><span class="sbd-label">Warnings</span><span class="sbd-val sv-red">${warns}</span></div>
            <div class="sbd-item"><span class="sbd-label">Watches</span><span class="sbd-val sv-orange">${watches}</span></div>
            <div class="sbd-item"><span class="sbd-label">Advisories</span><span class="sbd-val sv-blue">${adv}</span></div>
          </div>
        </div>`);
    }
  } catch(e) { console.warn('State alerts error:', e); }

  if (sections.length) {
    box.innerHTML = sections.join('');
  } else {
    box.innerHTML = `<div class="nearby-placeholder"><div class="state-icon"><svg width="36" height="36" fill="var(--dim)"><use href="#bi-broadcast"/></svg></div><div class="state-ttl">No Data</div><div class="state-sub">Could not load nearby information</div></div>`;
  }
}

// ── TORNADO RISK ──────────────────────────────────
function parseForecastSignals(periods, lat, alerts) {
  const p0 = periods[0] || {};
  const allText = periods.slice(0,4).map(p=>(p.detailedForecast||p.shortForecast||'').toLowerCase()).join(' ');
  const short0  = (p0.shortForecast||'').toLowerCase();
  const windSpeedStr = p0.windSpeed || '';
  const windDir  = (p0.windDirection||'').toLowerCase();
  const tempF    = p0.temperature || 70;
  const precip   = p0.probabilityOfPrecipitation?.value || 0;
  const windNums = windSpeedStr.match(/\d+/g) || ['0'];
  const windMph  = Math.max(...windNums.map(Number));

  let windShearScore = Math.min(windMph / 65, 1.0);
  if (allText.includes('shear'))           windShearScore = Math.min(windShearScore + 0.25, 1.0);
  if (allText.includes('gust'))            windShearScore = Math.min(windShearScore + 0.15, 1.0);
  if (allText.includes('veering'))         windShearScore = Math.min(windShearScore + 0.20, 1.0);
  if (['s','sw','ssw'].includes(windDir))  windShearScore = Math.min(windShearScore + 0.10, 1.0);
  const windShearRaw = `${windMph} mph${allText.includes('gust')?', gusting':''}`;

  let srhScore = 0.10;
  if (allText.includes('tornado'))    srhScore = Math.min(srhScore + 0.60, 1.0);
  if (allText.includes('supercell'))  srhScore = Math.min(srhScore + 0.55, 1.0);
  if (allText.includes('mesocyclon')) srhScore = Math.min(srhScore + 0.65, 1.0);
  if (allText.includes('rotation'))   srhScore = Math.min(srhScore + 0.50, 1.0);
  if (allText.includes('rotating'))   srhScore = Math.min(srhScore + 0.45, 1.0);
  if (allText.includes('severe thunderstorm')) srhScore = Math.min(srhScore + 0.30, 1.0);
  const tornadoAlerts = alerts.filter(a=>(a.properties.event||'').toLowerCase().includes('tornado'));
  if (tornadoAlerts.length > 0) srhScore = Math.min(srhScore + 0.40 + tornadoAlerts.length * 0.08, 1.0);
  const srhRaw = tornadoAlerts.length > 0 ? `${tornadoAlerts.length} tornado alert(s) active` : allText.includes('tornado') ? 'Tornado language in forecast' : 'No rotation indicators';

  // ── CAPE: use real Open-Meteo value if available, else infer from text ──
  let capeScore = 0.05;
  let capeRaw, realCape = null, realLI = null, realCIN = null;
  if (omData?.hourly) {
    // Take max CAPE over next 6 hours
    const capes = omData.hourly.cape || [];
    const lis   = omData.hourly.lifted_index || [];
    const cins  = omData.hourly.convective_inhibition || [];
    realCape = capes.length ? Math.max(...capes.filter(v => v != null)) : null;
    realLI   = lis.length   ? Math.min(...lis.filter(v => v != null))   : null; // most unstable = lowest LI
    realCIN  = cins.length  ? Math.min(...cins.filter(v => v != null))  : null;
    if (realCape != null) {
      // CAPE thresholds: <500 weak, 500–1500 moderate, 1500–2500 strong, >2500 extreme
      if      (realCape >= 2500) capeScore = 0.95;
      else if (realCape >= 1500) capeScore = 0.75;
      else if (realCape >= 1000) capeScore = 0.55;
      else if (realCape >= 500)  capeScore = 0.35;
      else if (realCape >= 200)  capeScore = 0.20;
      else                       capeScore = 0.08;
      // Lifted Index reinforcement: LI < -6 = extreme instability
      if (realLI != null) {
        if      (realLI <= -6) capeScore = Math.min(capeScore + 0.15, 1.0);
        else if (realLI <= -4) capeScore = Math.min(capeScore + 0.10, 1.0);
        else if (realLI <= -2) capeScore = Math.min(capeScore + 0.05, 1.0);
      }
      capeRaw = `CAPE ${Math.round(realCape)} J/kg${realLI != null ? ' · LI ' + realLI.toFixed(1) : ''}${realCIN != null ? ' · CIN ' + Math.round(realCIN) : ''}`;
    }
  }
  if (realCape == null) {
    // Fallback: text inference
    if (tempF >= 85) capeScore += 0.20; else if (tempF >= 75) capeScore += 0.12; else if (tempF >= 65) capeScore += 0.06;
    if (allText.includes('thunder'))   capeScore = Math.min(capeScore + 0.30, 1.0);
    if (allText.includes('severe'))    capeScore = Math.min(capeScore + 0.25, 1.0);
    if (allText.includes('unstable'))  capeScore = Math.min(capeScore + 0.20, 1.0);
    if (allText.includes('explosive')) capeScore = Math.min(capeScore + 0.30, 1.0);
    capeRaw = `${tempF}°F · ${allText.includes('thunder') ? 'Thunderstorms forecast' : 'No thunder forecast'} (estimated)`;
  }

  let llj = 0.10;
  const inAlley = lat >= 25 && lat <= 45 && (allText.includes('south') || allText.includes('southwest'));
  if (inAlley) llj += 0.25;
  if (allText.includes('low-level jet') || allText.includes('llj')) llj = Math.min(llj + 0.55, 1.0);
  if (allText.includes('southerly winds') || allText.includes('south winds')) llj = Math.min(llj + 0.20, 1.0);
  if (windMph >= 30) llj = Math.min(llj + 0.20, 1.0);
  if (windMph >= 50) llj = Math.min(llj + 0.20, 1.0);
  const lljRaw = inAlley ? `Tornado Alley lat (${lat.toFixed(1)}°N), ${windMph} mph winds` : `${lat.toFixed(1)}°N, ${windMph} mph winds`;

  let moisture = Math.min(precip / 100, 0.5);
  if (allText.includes('humid'))     moisture = Math.min(moisture + 0.20, 1.0);
  if (allText.includes('muggy'))     moisture = Math.min(moisture + 0.20, 1.0);
  if (allText.includes('dew point')) moisture = Math.min(moisture + 0.15, 1.0);
  if (allText.includes('dewpoint'))  moisture = Math.min(moisture + 0.15, 1.0);
  if (allText.includes('moist'))     moisture = Math.min(moisture + 0.15, 1.0);
  if (allText.includes('gulf'))      moisture = Math.min(moisture + 0.20, 1.0);
  if (tempF >= 70 && precip > 30)    moisture = Math.min(moisture + 0.15, 1.0);
  const moistureRaw = `${precip}% precip probability · ${allText.includes('humid')||allText.includes('moist')?'Humid conditions':'Moisture not elevated'}`;

  let lifting = 0.05;
  if (allText.includes('front'))       lifting = Math.min(lifting + 0.40, 1.0);
  if (allText.includes('cold front'))  lifting = Math.min(lifting + 0.20, 1.0);
  if (allText.includes('dryline'))     lifting = Math.min(lifting + 0.50, 1.0);
  if (allText.includes('outflow'))     lifting = Math.min(lifting + 0.30, 1.0);
  if (allText.includes('boundary'))    lifting = Math.min(lifting + 0.25, 1.0);
  if (allText.includes('convergence')) lifting = Math.min(lifting + 0.30, 1.0);
  if (allText.includes('forcing'))     lifting = Math.min(lifting + 0.25, 1.0);
  if (allText.includes('trough'))      lifting = Math.min(lifting + 0.20, 1.0);
  if (precip > 40) lifting = Math.min(lifting + 0.15, 1.0);
  const liftRaw = allText.includes('front') ? 'Frontal boundary detected' : allText.includes('dryline') ? 'Dryline forcing detected' : allText.includes('convergence') ? 'Convergence zone' : 'No major boundary detected';

  let pressure = Math.min(windMph / 70, 0.65);
  if (allText.includes('low pressure')) pressure = Math.min(pressure + 0.30, 1.0);
  if (allText.includes('deepening'))    pressure = Math.min(pressure + 0.25, 1.0);
  if (allText.includes('cyclone'))      pressure = Math.min(pressure + 0.25, 1.0);
  if (allText.includes('blustery') || allText.includes('breezy')) pressure = Math.min(pressure + 0.10, 1.0);
  const pressureRaw = `${windMph} mph surface winds · ${allText.includes('low pressure')?'Low pressure system noted':'Surface analysis inferred'}`;

  let capping = 0.10;
  let cappingRaw;
  if (realCIN != null) {
    // CIN: 0 = no cap, -50 = weak, -100 = moderate (ideal for supercells), -200+ = strong/inhibiting
    const absCIN = Math.abs(realCIN);
    if      (absCIN >= 200) capping = 0.85; // Strong cap — very explosive if broken
    else if (absCIN >= 100) capping = 0.65; // Moderate cap — classic supercell setup
    else if (absCIN >= 50)  capping = 0.45; // Weak-moderate cap
    else if (absCIN >= 20)  capping = 0.25; // Weak cap
    else                    capping = 0.10; // No meaningful cap
    cappingRaw = `CIN ${Math.round(realCIN)} J/kg · ${absCIN >= 100 ? 'Strong capping present' : absCIN >= 50 ? 'Moderate cap' : 'Weak/no cap'}`;
  } else {
    if (allText.includes('cap') || allText.includes('capping')) capping = Math.min(capping + 0.45, 1.0);
    if (allText.includes('clearing') && precip > 20) capping = Math.min(capping + 0.20, 1.0);
    if (allText.includes('thunder') && !allText.includes('all day')) capping = Math.min(capping + 0.30, 1.0);
    if (allText.includes('mostly sunny') || allText.includes('partly cloudy')) {
      if (precip > 30) capping = Math.min(capping + 0.25, 1.0);
    }
    cappingRaw = allText.includes('cap') ? 'Capping layer mentioned in forecast (estimated)' : `${precip}% precip prob · ${short0} (estimated)`;
  }

  return [
    { label:'Wind\nShear',       name:'Wind Shear',             live:windShearScore, ideal:0.95, tier:windShearScore>0.7?'tier-crit':windShearScore>0.45?'tier-high':'tier-mod', raw:windShearRaw, unit:'Speed & directional veering', detail:'Speed & directional shear creates the horizontal rotation that updrafts tilt into a mesocyclone.' },
    { label:'Storm-Rel.\nHelicity', name:'Storm-Rel. Helicity',  live:srhScore,       ideal:0.92, tier:srhScore>0.6?'tier-crit':srhScore>0.35?'tier-high':'tier-mod', raw:srhRaw, unit:'SRH > 300 m²/s² (0–3 km)', detail:'SRH > 300 m²/s² strongly favors tornadic supercells. Inferred from storm language and active tornado alerts.' },
    { label:'Atmo.\nInstability', name:'Atmospheric Instability', live:capeScore,     ideal:0.90, tier:capeScore>0.6?'tier-crit':capeScore>0.35?'tier-high':'tier-mod', raw:capeRaw, unit:'CAPE proxy from temp & storms', detail:'CAPE > 2500 J/kg with steep mid-level lapse rates fuels explosive updrafts.' },
    { label:'Low-Level\nJet',    name:'Low-Level Jet Stream',    live:llj,            ideal:0.88, tier:llj>0.6?'tier-crit':llj>0.35?'tier-high':'tier-mod', raw:lljRaw, unit:'≥ 30 kt at 850 mb', detail:'The nocturnal LLJ at 850 mb dramatically increases low-level wind shear and drives warm moist advection.' },
    { label:'Low-Level\nMoisture', name:'Low-Level Moisture',    live:moisture,       ideal:0.85, tier:moisture>0.6?'tier-high':moisture>0.35?'tier-mod':'tier-low', raw:moistureRaw, unit:'Dewpoint ≥ 60°F (15.5°C)', detail:'Surface dewpoints ≥ 60°F with a deep moist layer to 850 mb. Gulf moisture transport is primary source.' },
    { label:'Lifting\nMechanism', name:'Lifting Mechanism',      live:lifting,        ideal:0.80, tier:lifting>0.5?'tier-high':lifting>0.25?'tier-mod':'tier-low', raw:liftRaw, unit:'Frontal / dryline forcing', detail:'A strong cold front, dryline, outflow boundary, or convergence zone forces warm moist air upward.' },
    { label:'Pressure\nGradient', name:'Pressure Gradient',      live:pressure,       ideal:0.75, tier:pressure>0.55?'tier-high':pressure>0.30?'tier-mod':'tier-low', raw:pressureRaw, unit:'Surface low ≤ 990 mb', detail:'A strong surface low drives wind convergence, enhances frontal boundaries, and organizes storm inflow.' },
    { label:'Capping\nInversion', name:'Capping Inversion',      live:capping,        ideal:0.70, tier:capping>0.5?'tier-mod':capping>0.25?'tier-mod':'tier-low', raw:cappingRaw, unit:'CIN 50–150 J/kg', detail:'A moderate cap concentrates stored energy. When the cap breaks it allows explosive development.' }
  ];
}

function computeTornadoRisk(periods, lat, lon, alerts) {
  const factors = parseForecastSignals(periods, lat, alerts);
  const weights = [0.20, 0.18, 0.16, 0.12, 0.12, 0.10, 0.07, 0.05];
  const composite = factors.reduce((sum, f, i) => sum + f.live * weights[i], 0);
  const pct = Math.round(composite * 100);
  let level, riskClass, iconColor;
  if (pct >= 70)      { level='EXTREME';  riskClass='risk-extreme'; iconColor='var(--red)'; }
  else if (pct >= 55) { level='HIGH';     riskClass='risk-high';    iconColor='var(--orange)'; }
  else if (pct >= 40) { level='ELEVATED'; riskClass='risk-elevated';iconColor='var(--yellow)'; }
  else if (pct >= 25) { level='GUARDED';  riskClass='risk-guarded'; iconColor='var(--blue)'; }
  else                { level='LOW';      riskClass='risk-low';     iconColor='var(--green)'; }
  document.getElementById('riskBanner').style.borderColor = pct>=70?'rgba(248,113,113,.3)':pct>=55?'rgba(251,146,60,.25)':pct>=40?'rgba(251,191,36,.2)':'var(--border)';
  document.querySelector('.risk-icon').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" fill="${iconColor}" viewBox="0 0 16 16"><path d="M1.125 2.45A.9.9 0 0 1 1 2c0-.26.116-.474.258-.634a1.9 1.9 0 0 1 .513-.389c.387-.21.913-.385 1.52-.525C4.514.17 6.18 0 8 0c1.821 0 3.486.17 4.709.452.607.14 1.133.314 1.52.525.193.106.374.233.513.389.141.16.258.374.258.634 0 1.011-.35 1.612-.634 2.102l-.116.203a2.6 2.6 0 0 0-.313.809 3 3 0 0 0-.011.891.5.5 0 0 1 .428.849q-.091.09-.215.195c.204 1.116.088 1.99-.3 2.711-.453.84-1.231 1.383-2.02 1.856q-.307.183-.62.364c-1.444.832-2.928 1.689-3.735 3.706a.5.5 0 0 1-.748.226l-.001-.001-.002-.001-.004-.003-.01-.008a2 2 0 0 1-.147-.115 4.1 4.1 0 0 1-1.179-1.656 3.8 3.8 0 0 1-.247-1.296A.5.5 0 0 1 5 12.5v-.018l.008-.079a.73.73 0 0 1 .188-.386c.09-.489.272-1.014.573-1.574a.5.5 0 0 1 .073-.918 3.3 3.3 0 0 1 .617-.144l.15-.193c.285-.356.404-.639.437-.861a.95.95 0 0 0-.122-.619c-.249-.455-.815-.903-1.613-1.43q-.291-.19-.609-.394l-.119-.076a12 12 0 0 1-1.241-.334.5.5 0 0 1-.285-.707l-.23-.18C2.117 4.01 1.463 3.32 1.125 2.45m1.973 1.051q.17.156.358.308c.472.381.99.722 1.515 1.06 1.54.317 3.632.5 5.43.14a.5.5 0 0 1 .197.981c-1.216.244-2.537.26-3.759.157.399.326.744.682.963 1.081.203.373.302.79.233 1.247q-.077.494-.39.985l.22.053.006.002c.481.12.863.213 1.47.01a.5.5 0 1 1 .317.95c-.888.295-1.505.141-2.023.012l-.006-.002a4 4 0 0 0-.644-.123c-.37.55-.598 1.05-.726 1.497q.212.068.465.194a.5.5 0 1 1-.448.894 3 3 0 0 0-.148-.07c.012.345.084.643.18.895.14.369.342.666.528.886.992-1.903 2.583-2.814 3.885-3.56q.305-.173.584-.34c.775-.464 1.34-.89 1.653-1.472.212-.393.33-.9.26-1.617A6.74 6.74 0 0 1 10 8.5a.5.5 0 0 1 0-1 5.76 5.76 0 0 0 3.017-.872l-.007-.03c-.135-.673-.14-1.207-.056-1.665.084-.46.253-.81.421-1.113l.131-.23q.098-.167.182-.327c-.29.107-.62.202-.98.285C11.487 3.83 9.822 4 8 4c-1.821 0-3.486-.17-4.709-.452q-.098-.022-.193-.047M13.964 2a1 1 0 0 0-.214-.145c-.272-.148-.697-.297-1.266-.428C11.354 1.166 9.769 1 8 1s-3.354.166-4.484.427c-.569.13-.994.28-1.266.428A1 1 0 0 0 2.036 2q.058.058.214.145c.272.148.697.297 1.266.428C4.646 2.834 6.231 3 8 3s3.354-.166 4.484-.427c.569-.13.994-.28 1.266-.428A1 1 0 0 0 13.964 2"/></svg>`;
  const rl = document.getElementById('riskLevel');
  rl.textContent = level; rl.className = 'risk-level ' + riskClass;
  const rs = document.getElementById('riskScore');
  rs.textContent = pct + '%'; rs.className = 'risk-score ' + riskClass;
  const critCount = factors.filter(f=>f.tier==='tier-crit').length;
  document.getElementById('riskSub').textContent = `Composite score ${pct}% · ${critCount} critical factor${critCount!==1?'s':''} active`;
  buildSpider(factors);
  buildFactorList(factors);
}

// ── SPIDER CHART ──────────────────────────────────
const ns = 'http://www.w3.org/2000/svg';
let spiderFactors = [], optPath, livPath, dotG, spiderMode = 'both';

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(ns, tag);
  for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function buildSpider(factors) {
  spiderFactors = factors;
  const svg = document.getElementById('radar-chart');
  svg.innerHTML = '';
  const cx=190, cy=185, R=130, N=factors.length;
  function polar(i, r) { const a=(2*Math.PI*i/N)-Math.PI/2; return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}; }
  const defs=svgEl('defs',{},svg);
  const bgG=svgEl('radialGradient',{id:'bgG',cx:'50%',cy:'50%',r:'50%'},defs);
  svgEl('stop',{offset:'0%','stop-color':'#1c2030','stop-opacity':'0.9'},bgG);
  svgEl('stop',{offset:'100%','stop-color':'#0e1013','stop-opacity':'0.5'},bgG);
  const lG=svgEl('linearGradient',{id:'lG',x1:'0%',y1:'0%',x2:'100%',y2:'100%'},defs);
  svgEl('stop',{offset:'0%','stop-color':'#93c5fd','stop-opacity':'0.22'},lG);
  svgEl('stop',{offset:'100%','stop-color':'#3b82f6','stop-opacity':'0.08'},lG);
  const iG=svgEl('linearGradient',{id:'iG',x1:'0%',y1:'0%',x2:'100%',y2:'100%'},defs);
  svgEl('stop',{offset:'0%','stop-color':'#f87171','stop-opacity':'0.18'},iG);
  svgEl('stop',{offset:'100%','stop-color':'#fb923c','stop-opacity':'0.06'},iG);
  const glow=svgEl('filter',{id:'glow',x:'-50%',y:'-50%',width:'200%',height:'200%'},defs);
  svgEl('feGaussianBlur',{stdDeviation:'2.5',result:'blur'},glow);
  const fm=svgEl('feMerge',{},glow);
  svgEl('feMergeNode',{in:'blur'},fm); svgEl('feMergeNode',{in:'SourceGraphic'},fm);
  svgEl('circle',{cx,cy,r:R+8,fill:'url(#bgG)',stroke:'rgba(255,255,255,0.05)','stroke-width':'1'},svg);

  // ── Tornado watermark ──
  const wm = document.createElementNS(ns, 'g');
  wm.setAttribute('transform', `translate(${cx - 70}, ${cy - 75}) scale(8.75)`);
  wm.setAttribute('opacity', '0.045');
  const wmPath = document.createElementNS(ns, 'path');
  wmPath.setAttribute('d', 'M1.125 2.45A.9.9 0 0 1 1 2c0-.26.116-.474.258-.634a1.9 1.9 0 0 1 .513-.389c.387-.21.913-.385 1.52-.525C4.514.17 6.18 0 8 0c1.821 0 3.486.17 4.709.452.607.14 1.133.314 1.52.525.193.106.374.233.513.389.141.16.258.374.258.634 0 1.011-.35 1.612-.634 2.102l-.116.203a2.6 2.6 0 0 0-.313.809 3 3 0 0 0-.011.891.5.5 0 0 1 .428.849q-.091.09-.215.195c.204 1.116.088 1.99-.3 2.711-.453.84-1.231 1.383-2.02 1.856q-.307.183-.62.364c-1.444.832-2.928 1.689-3.735 3.706a.5.5 0 0 1-.748.226l-.001-.001-.002-.001-.004-.003-.01-.008a2 2 0 0 1-.147-.115 4.1 4.1 0 0 1-1.179-1.656 3.8 3.8 0 0 1-.247-1.296A.5.5 0 0 1 5 12.5v-.018l.008-.079a.73.73 0 0 1 .188-.386c.09-.489.272-1.014.573-1.574a.5.5 0 0 1 .073-.918 3.3 3.3 0 0 1 .617-.144l.15-.193c.285-.356.404-.639.437-.861a.95.95 0 0 0-.122-.619c-.249-.455-.815-.903-1.613-1.43q-.291-.19-.609-.394l-.119-.076a12 12 0 0 1-1.241-.334.5.5 0 0 1-.285-.707l-.23-.18C2.117 4.01 1.463 3.32 1.125 2.45m1.973 1.051q.17.156.358.308c.472.381.99.722 1.515 1.06 1.54.317 3.632.5 5.43.14a.5.5 0 0 1 .197.981c-1.216.244-2.537.26-3.759.157.399.326.744.682.963 1.081.203.373.302.79.233 1.247q-.077.494-.39.985l.22.053.006.002c.481.12.863.213 1.47.01a.5.5 0 1 1 .317.95c-.888.295-1.505.141-2.023.012l-.006-.002a4 4 0 0 0-.644-.123c-.37.55-.598 1.05-.726 1.497q.212.068.465.194a.5.5 0 1 1-.448.894 3 3 0 0 0-.148-.07c.012.345.084.643.18.895.14.369.342.666.528.886.992-1.903 2.583-2.814 3.885-3.56q.305-.173.584-.34c.775-.464 1.34-.89 1.653-1.472.212-.393.33-.9.26-1.617A6.74 6.74 0 0 1 10 8.5a.5.5 0 0 1 0-1 5.76 5.76 0 0 0 3.017-.872l-.007-.03c-.135-.673-.14-1.207-.056-1.665.084-.46.253-.81.421-1.113l.131-.23q.098-.167.182-.327c-.29.107-.62.202-.98.285C11.487 3.83 9.822 4 8 4c-1.821 0-3.486-.17-4.709-.452q-.098-.022-.193-.047M13.964 2a1 1 0 0 0-.214-.145c-.272-.148-.697-.297-1.266-.428C11.354 1.166 9.769 1 8 1s-3.354.166-4.484.427c-.569.13-.994.28-1.266.428A1 1 0 0 0 2.036 2q.058.058.214.145c.272.148.697.297 1.266.428C4.646 2.834 6.231 3 8 3s3.354-.166 4.484-.427c.569-.13.994-.28 1.266-.428A1 1 0 0 0 13.964 2');
  wmPath.setAttribute('fill', 'white');
  wm.appendChild(wmPath);
  svg.appendChild(wm);
  [0.2,0.4,0.6,0.8,1.0].forEach((lvl,li)=>{
    const pts=factors.map((_,i)=>polar(i,R*lvl));
    const d=pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')+'Z';
    svgEl('path',{d,fill:'none',stroke:li===4?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.05)','stroke-width':li===4?'1.2':'0.8','stroke-dasharray':li===4?'none':'3 4'},svg);
    if(li<4)svgEl('text',{x:cx+4,y:(cy-R*lvl+3).toFixed(1),fill:'rgba(255,255,255,0.15)','font-family':'ui-monospace,-apple-system-monospace,Menlo,monospace','font-size':'7','letter-spacing':'0.5px'},svg).textContent=(lvl*100)+'%';
  });
  factors.forEach((_,i)=>{const p=polar(i,R);svgEl('line',{x1:cx,y1:cy,x2:p.x.toFixed(1),y2:p.y.toFixed(1),stroke:'rgba(255,255,255,0.06)','stroke-width':'1'},svg);});
  function buildPath(key) { return factors.map((f,i)=>polar(i,R*f[key])).map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+'Z'; }
  livPath=svgEl('path',{d:buildPath('live'),fill:'url(#lG)',stroke:'#93c5fd','stroke-width':'1.8','stroke-linejoin':'round',opacity:'0'},svg);
  optPath=svgEl('path',{d:buildPath('ideal'),fill:'url(#iG)',stroke:'#f87171','stroke-width':'1.8','stroke-linejoin':'round',filter:'url(#glow)',opacity:'0'},svg);
  setTimeout(()=>{livPath.style.transition='opacity 0.5s';livPath.setAttribute('opacity','1');},400);
  setTimeout(()=>{optPath.style.transition='opacity 0.5s';optPath.setAttribute('opacity','1');},650);
  dotG=svgEl('g',{},svg);
  factors.forEach((f,i)=>{
    ['live','ideal'].forEach((key,ki)=>{
      const p=polar(i,R*f[key]), isIdeal=key==='ideal';
      const dot=svgEl('circle',{cx:p.x.toFixed(2),cy:p.y.toFixed(2),r:isIdeal?'4':'3.5',fill:isIdeal?'#f87171':'#93c5fd',stroke:isIdeal?'#fca5a5':'#bfdbfe','stroke-width':'1.2',filter:isIdeal?'url(#glow)':'none',style:'cursor:pointer;transition:r 0.15s;',opacity:'0'},dotG);
      setTimeout(()=>{dot.style.transition='opacity 0.4s';dot.setAttribute('opacity','1');},isIdeal?750:500);
      const tip=document.getElementById('tipbox');
      dot.addEventListener('mouseenter',e=>{const col=isIdeal?'var(--red)':'var(--blue)';tip.innerHTML=`<strong>${f.name}</strong>${f.raw}<div class="tip-val" style="color:${col}">${key.toUpperCase()}: ${Math.round(f[key]*100)}%</div>`;tip.style.opacity='1';posTip(e);dot.setAttribute('r',isIdeal?'6':'5');});
      dot.addEventListener('mousemove',posTip);
      dot.addEventListener('mouseleave',()=>{tip.style.opacity='0';dot.setAttribute('r',isIdeal?'4':'3.5');});
    });
  });
  factors.forEach((f,i)=>{
    const angle=(2*Math.PI*i/N)-Math.PI/2;
    const isTop=angle<-Math.PI/4&&angle>-3*Math.PI/4;
    const lp=polar(i,R+28);
    const lines=f.label.split('\n');
    const anchor=lp.x<cx-8?'end':lp.x>cx+8?'start':'middle';
    const g=svgEl('g',{style:'cursor:pointer',opacity:'0'},svg);
    setTimeout(()=>{g.style.transition='opacity 0.5s';g.setAttribute('opacity','1');},800+i*50);
    const lineH=12;
    if(isTop){
      svgEl('text',{x:lp.x.toFixed(1),y:(lp.y-lines.length*lineH-1).toFixed(1),'text-anchor':anchor,fill:'#93c5fd','font-family':'ui-monospace,-apple-system-monospace,Menlo,monospace','font-size':'8.5'},g).textContent=Math.round(f.live*100)+'%';
      lines.forEach((line,li)=>svgEl('text',{x:lp.x.toFixed(1),y:(lp.y-(lines.length-1-li)*lineH).toFixed(1),'text-anchor':anchor,fill:'#eef0f4','font-family':'-apple-system,BlinkMacSystemFont,system-ui,sans-serif','font-size':'9.5','font-weight':'600'},g).textContent=line);
    }else{
      lines.forEach((line,li)=>svgEl('text',{x:lp.x.toFixed(1),y:(lp.y+li*lineH).toFixed(1),'text-anchor':anchor,fill:'#eef0f4','font-family':'-apple-system,BlinkMacSystemFont,system-ui,sans-serif','font-size':'9.5','font-weight':'600'},g).textContent=line);
      svgEl('text',{x:lp.x.toFixed(1),y:(lp.y+lines.length*lineH-1).toFixed(1),'text-anchor':anchor,fill:'#93c5fd','font-family':'ui-monospace,-apple-system-monospace,Menlo,monospace','font-size':'8.5'},g).textContent=Math.round(f.live*100)+'%';
    }
    const tip2=document.getElementById('tipbox');
    g.addEventListener('mouseenter',e=>{tip2.innerHTML=`<strong>${f.name}</strong>${f.raw}<div class="tip-val" style="color:var(--blue)">LIVE: ${Math.round(f.live*100)}%</div><div class="tip-val" style="color:var(--red)">IDEAL: ${Math.round(f.ideal*100)}%</div>`;tip2.style.opacity='1';posTip(e);});
    g.addEventListener('mousemove',posTip);
    g.addEventListener('mouseleave',()=>{tip2.style.opacity='0';});
  });

  applySpiderMode(spiderMode);
}

function applySpiderMode(m) {
  spiderMode=m;
  document.querySelectorAll('.cmb').forEach(b=>{b.classList.remove('on');if(b.dataset.cm===m)b.classList.add('on');});
  if(!livPath||!optPath)return;
  [livPath,optPath].forEach(p=>p.style.transition='opacity 0.3s');
  livPath.setAttribute('opacity',(m==='both'||m==='live')?'1':'0');
  optPath.setAttribute('opacity',(m==='both'||m==='ideal')?'1':'0');
  let di=0;
  dotG?.querySelectorAll('circle').forEach(d=>{
    const isIdeal=di%2===1;
    d.style.transition='opacity 0.3s';
    d.setAttribute('opacity',isIdeal?(m==='both'||m==='ideal'?'1':'0'):(m==='both'||m==='live'?'1':'0'));
    di++;
  });
}

function posTip(e) {
  const tip=document.getElementById('tipbox');
  const x=e.clientX+14,y=e.clientY-10;
  tip.style.left=Math.min(x,window.innerWidth-210)+'px';
  tip.style.top=Math.min(y,window.innerHeight-120)+'px';
}

function buildFactorList(factors) {
  const fl=document.getElementById('factorList');
  fl.innerHTML=factors.map(f=>`
    <div class="factor-card ${f.tier}">
      <div class="fac-header"><div class="fac-stripe"></div><div class="fac-name">${f.name}</div><div class="fac-val">${f.raw.split('·')[0].trim()}</div><div class="fac-score">${Math.round(f.live*100)}%</div><span class="fac-chevron"><svg width="10" height="10" fill="currentColor"><use href="#bi-chevron-right"/></svg></span></div>
      <div class="fac-body">
        <div class="fac-raw">${f.raw}</div>
        <div class="fac-prog-row"><div class="fac-prog-lbl"><span>Live</span><span style="color:var(--blue)">${Math.round(f.live*100)}%</span></div><div class="fac-prog-track"><div class="fac-prog-fill" style="width:${f.live*100}%;background:var(--blue)"></div></div></div>
        <div class="fac-prog-row"><div class="fac-prog-lbl"><span>Ideal</span><span style="color:var(--red)">${Math.round(f.ideal*100)}%</span></div><div class="fac-prog-track"><div class="fac-prog-fill" style="width:${f.ideal*100}%;background:var(--red)"></div></div></div>
        <div class="fac-detail">${f.detail}</div>
      </div>
    </div>`).join('');
  fl.querySelectorAll('.factor-card').forEach(el=>el.addEventListener('click',()=>el.classList.toggle('open')));
}

// ── LOCATION & ORCHESTRATION ─────────────────────
// ── OPEN-METEO (no key required) ──────────────────
async function fetchOpenMeteo(lat, lon) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: [
        'temperature_2m','apparent_temperature','relative_humidity_2m',
        'dew_point_2m','wind_speed_10m','wind_gusts_10m','wind_direction_10m',
        'uv_index','cloud_cover','precipitation','weather_code','is_day'
      ].join(','),
      hourly: [
        'cape','lifted_index','convective_inhibition',
        'freezing_level_height','precipitation_probability'
      ].join(','),
      wind_speed_unit: 'mph',
      temperature_unit: 'fahrenheit',
      forecast_days: 1,
      forecast_hours: 6,
      timezone: 'auto'
    });
    const res = await fetch(`${OM}?${params}`);
    if (!res.ok) throw new Error(`OM ${res.status}`);
    const data = await res.json();
    omData = data;

    const c = data.current;
    if (!c) return;

    // Enrich obs strip with Open-Meteo data (fills gaps NWS doesn't cover)
    const set = (id, val) => { if (val != null && document.getElementById(id)) document.getElementById(id).textContent = val; };

    // Feels like
    if (c.apparent_temperature != null) set('obsFeels', Math.round(c.apparent_temperature));

    // Wind gust
    if (c.wind_gusts_10m != null) set('obsGust', Math.round(c.wind_gusts_10m));

    // UV index
    if (c.uv_index != null) set('obsUV', c.uv_index.toFixed(1));

    // Cloud cover %
    if (c.cloud_cover != null) set('obsCloud', c.cloud_cover);

    // Fill temp/humid/dew from OM if NWS obs hasn't populated them yet
    if (document.getElementById('obsTemp').textContent === '—' && c.temperature_2m != null)
      set('obsTemp', Math.round(c.temperature_2m));
    if (document.getElementById('obsHumid').textContent === '—' && c.relative_humidity_2m != null)
      set('obsHumid', Math.round(c.relative_humidity_2m));
    if (document.getElementById('obsDew').textContent === '—' && c.dew_point_2m != null)
      set('obsDew', Math.round(c.dew_point_2m));
    if (document.getElementById('obsWind').textContent === '—' && c.wind_speed_10m != null)
      set('obsWind', Math.round(c.wind_speed_10m));

    document.getElementById('obsStrip').classList.add('show');
  } catch(e) { console.warn('Open-Meteo error:', e); }
}

async function fetchForPoint(lat, lon) {
  const [fc] = await Promise.all([
    fetchForecast(lat, lon),
    fetchAlerts(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`),
    fetchOpenMeteo(lat, lon)
  ]);
  const { periods, stationUrl } = fc;
  // Run obs + nearby in parallel after forecast resolves
  await Promise.all([
    fetchObservations(stationUrl),
    fetchNearby(lat, lon, stationUrl)
  ]);
  if (periods && periods.length) computeTornadoRisk(periods, lat, lon, allAlerts);
}

async function geoMe() {
  setLive('loading','LOCATING…');
  try {
    const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:6000}));
    curLat=pos.coords.latitude; curLon=pos.coords.longitude; curMode='geo';
    await fetchForPoint(curLat,curLon);
  } catch {
    try {
      const r=await fetch('https://ip-api.com/json/?fields=lat,lon,city,regionName');
      const d=await r.json();
      if(!d.lat)throw new Error('No IP location');
      curLat=d.lat; curLon=d.lon; curMode='geo';
      document.getElementById('locName').textContent=d.city||'My Location';
      document.getElementById('locSub').textContent=d.regionName||'';
      curState=d.regionName||null;
      await fetchForPoint(curLat,curLon);
    } catch(e){ setLive('err','GPS ERROR'); }
  }
}

async function doSearch() {
  const q=document.getElementById('searchInput').value.trim();
  if(!q)return;
  setLive('loading','SEARCHING…');
  try{
    let lat,lon,name;
    if(/^\d{5}$/.test(q)){
      const r=await fetch(`https://api.zippopotam.us/us/${q}`);
      if(!r.ok)throw new Error('ZIP not found');
      const d=await r.json();
      lat=parseFloat(d.places[0]['latitude']); lon=parseFloat(d.places[0]['longitude']);
      name=`${d.places[0]['place name']}, ${d.places[0]['state abbreviation']}`;
      curState=d.places[0]['state'];
    }else{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=us&format=json&limit=1`,{headers:{'Accept-Language':'en','User-Agent':'StormWatch-PWA/2.0'}});
      const d=await r.json();
      if(!d.length)throw new Error('City not found');
      lat=parseFloat(d[0].lat); lon=parseFloat(d[0].lon); name=d[0].display_name.split(',')[0];
    }
    curLat=lat; curLon=lon; curMode='search';
    document.getElementById('locName').textContent=name;
    document.getElementById('locSub').textContent='';
    document.getElementById('searchInput').value='';
    await fetchForPoint(curLat,curLon);
  }catch(e){
    setLive('err','NOT FOUND');
    document.getElementById('locSub').textContent=e.message;
  }
}

async function doNational(){
  curMode='national'; curState=null;
  document.getElementById('locName').textContent='United States';
  document.getElementById('locSub').textContent='National View';
  document.getElementById('obsStrip').classList.remove('show');
  await fetchAlerts(`${NWS}/alerts/active`);
}

async function refresh(){
  if(curMode==='national')await doNational();
  else if(curLat)await fetchForPoint(curLat,curLon);
}

// ── INIT ─────────────────────────────────────────
window.addEventListener('load',()=>{
  document.getElementById('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
  document.getElementById('btnSearch').addEventListener('click',doSearch);
  document.getElementById('btnGeo').addEventListener('click',geoMe);
  document.getElementById('btnNational').addEventListener('click',doNational);
  document.querySelectorAll('.fbtn').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.f)));
  document.querySelectorAll('.cmb').forEach(b=>b.addEventListener('click',()=>applySpiderMode(b.dataset.cm)));
  doNational();
});
