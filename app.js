// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e));
  });
}

// Safari install banner — show if not already in standalone mode
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
let allAlerts = [], activeFilter = 'all', refreshTimer = null;
let curLat = null, curLon = null, curMode = null;

// ── TABS ─────────────────────────────────────────
// Tab switching
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('on'));
    btn.classList.add('on');
    const panelId = t === 'alerts' ? 'tabAlerts' : t === 'forecast' ? 'tabForecast' : 'tabTornado';
    document.getElementById(panelId).classList.add('on');
    document.getElementById('filterRow').style.display = t === 'alerts' ? 'flex' : 'none';
  });
});

// ── HELPERS ──────────────────────────────────────
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
  if (sev === 'Extreme' || ev.includes('tornado warning') || ev.includes('flash flood emergency')) return 'sev-extreme';
  if (sev === 'Severe'  || ev.includes('warning'))  return 'sev-severe';
  if (sev === 'Moderate'|| ev.includes('watch'))    return 'sev-moderate';
  if (sev === 'Minor'   || ev.includes('advisory') || ev.includes('statement')) return 'sev-minor';
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
function wxIcon(s) {
  s = (s||'').toLowerCase();
  const ico = s.includes('tornado') ? 'bi-tornado'
    : (s.includes('thunder')||s.includes('tstm')) ? 'bi-cloud-lightning'
    : (s.includes('blizzard')||s.includes('snow')||s.includes('sleet')||s.includes('ice')) ? 'bi-snow'
    : (s.includes('rain')||s.includes('shower')||s.includes('drizzle')) ? 'bi-cloud-rain'
    : (s.includes('fog')||s.includes('mist')) ? 'bi-fog'
    : s.includes('wind') ? 'bi-wind'
    : s.includes('partly') ? 'bi-cloud-sun'
    : (s.includes('cloud')||s.includes('overcast')) ? 'bi-clouds'
    : (s.includes('sunny')||s.includes('clear')) ? 'bi-sun'
    : 'bi-cloud-sun';
  return `<svg width="18" height="18" fill="currentColor"><use href="#${ico}"/></svg>`;
}
function tempClass(t) {
  if(t>=95)return't-hot'; if(t>=80)return't-warm'; if(t>=60)return't-mild'; if(t>=40)return't-cool'; return't-cold';
}

// ── RENDER ALERTS ────────────────────────────────
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

// ── FORECAST ─────────────────────────────────────
async function fetchForecast(lat, lon) {
  try {
    const pt=await nwsFetch(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    const pp=pt.properties||{};
    const city=pp.relativeLocation?.properties;
    if(city){document.getElementById('locName').textContent=city.city;document.getElementById('locSub').textContent=city.state;}
    if(pp.forecast){
      const fc=await nwsFetch(pp.forecast);
      const periods=fc.properties?.periods||[];
      renderForecast(periods);
      return periods;
    }
    return [];
  }catch(e){console.warn('Forecast error:',e);return[];}
}
function renderForecast(periods){
  const box=document.getElementById('panelForecast');
  if(!periods.length){box.innerHTML='<div class="state-center"><div class="state-icon">🌤️</div><div class="state-ttl">No data</div></div>';return;}
  const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Collect one representative period per calendar day (prefer daytime)
  const dayMap = new Map();
  for (const p of periods) {
    const dt = new Date(p.startTime);
    const key = dt.toDateString();
    if (!dayMap.has(key)) {
      dayMap.set(key, p); // first occurrence (could be night if evening)
    } else if (p.isDaytime) {
      dayMap.set(key, p); // prefer daytime if we see it later
    }
  }
  const days = [...dayMap.values()].slice(0, 7);
  const now=new Date(),hero=days[0];
  const heroHTML=hero?`<div class="fc-hero">
    <div class="fch-top"><div class="fch-day">${dn[now.getDay()]}, ${mn[now.getMonth()]} ${now.getDate()}</div><div class="fch-time">${now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div></div>
    <div class="fch-temp">${hero.temperature}<sup>°${hero.temperatureUnit}</sup></div>
    <div class="fch-icon"><svg width="56" height="56" fill="rgba(147,197,253,0.35)"><use href="#${hero.shortForecast.toLowerCase().includes('tornado')?'bi-tornado':hero.shortForecast.toLowerCase().includes('thunder')?'bi-cloud-lightning':hero.shortForecast.toLowerCase().includes('snow')?'bi-snow':hero.shortForecast.toLowerCase().includes('rain')?'bi-cloud-rain':hero.shortForecast.toLowerCase().includes('clear')||hero.shortForecast.toLowerCase().includes('sunny')?'bi-sun':'bi-cloud-sun'}"/></svg></div>
    <div class="fch-meta"><div>${hero.shortForecast}</div><div>Wind: <b>${hero.windDirection||''} ${hero.windSpeed||''}</b></div></div>
  </div>`:'';
  const rows=days.slice(1,7).map(d=>{const dt=new Date(d.startTime);return`<div class="fc-day-row"><span class="fdr-name">${dn[dt.getDay()]}</span><span class="fdr-icon">${wxIcon(d.shortForecast)}</span><span class="fdr-desc">${d.shortForecast}</span><span class="fdr-temp ${tempClass(d.temperature)}">${d.temperature}°</span></div>`;}).join('');
  box.innerHTML=heroHTML+'<div class="fc-days">'+rows+'</div>';
}

// ══════════════════════════════════════════════════
// ── TORNADO RISK ENGINE ───────────────────────────
// Derives 8 factor scores from NWS forecast periods
// ══════════════════════════════════════════════════

function parseForecastSignals(periods, lat, alerts) {
  // NWS forecast text parsing — extract signals from available data
  const p0 = periods[0] || {};
  const allText = periods.slice(0,4).map(p=>(p.detailedForecast||p.shortForecast||'').toLowerCase()).join(' ');
  const short0  = (p0.shortForecast||'').toLowerCase();
  const detail0 = (p0.detailedForecast||'').toLowerCase();
  const windSpeedStr = p0.windSpeed || '';
  const windDir  = (p0.windDirection||'').toLowerCase();
  const tempF    = p0.temperature || 70;
  const precip   = p0.probabilityOfPrecipitation?.value || 0;

  // Parse wind speed (e.g. "10 to 20 mph" → take max)
  const windNums = windSpeedStr.match(/\d+/g) || ['0'];
  const windMph  = Math.max(...windNums.map(Number));

  // ── 1. WIND SHEAR (from wind speed + directional veering language) ──
  // Ideal: > 50 mph or "gusty", veering pattern, "shear" mentioned
  let windShearScore = Math.min(windMph / 65, 1.0);
  if (allText.includes('shear'))           windShearScore = Math.min(windShearScore + 0.25, 1.0);
  if (allText.includes('gust'))            windShearScore = Math.min(windShearScore + 0.15, 1.0);
  if (allText.includes('veering'))         windShearScore = Math.min(windShearScore + 0.20, 1.0);
  if (['s','sw','ssw'].includes(windDir))  windShearScore = Math.min(windShearScore + 0.10, 1.0);
  const windShearRaw = `${windMph} mph${allText.includes('gust')?', gusting':''}`;

  // ── 2. STORM-RELATIVE HELICITY (from storm/tornado language + wind profile) ──
  // NWS doesn't expose SRH directly; infer from storm descriptions + alerts
  let srhScore = 0.10;
  if (allText.includes('tornado'))    srhScore = Math.min(srhScore + 0.60, 1.0);
  if (allText.includes('supercell'))  srhScore = Math.min(srhScore + 0.55, 1.0);
  if (allText.includes('mesocyclon')) srhScore = Math.min(srhScore + 0.65, 1.0);
  if (allText.includes('rotation'))   srhScore = Math.min(srhScore + 0.50, 1.0);
  if (allText.includes('rotating'))   srhScore = Math.min(srhScore + 0.45, 1.0);
  if (allText.includes('severe thunderstorm')) srhScore = Math.min(srhScore + 0.30, 1.0);
  // Active tornado alerts nearby boost SRH significantly
  const tornadoAlerts = alerts.filter(a=>(a.properties.event||'').toLowerCase().includes('tornado'));
  if (tornadoAlerts.length > 0) srhScore = Math.min(srhScore + 0.40 + tornadoAlerts.length * 0.08, 1.0);
  const srhRaw = tornadoAlerts.length > 0 ? `${tornadoAlerts.length} tornado alert(s) active` : allText.includes('tornado') ? 'Tornado language in forecast' : 'No rotation indicators';

  // ── 3. ATMOSPHERIC INSTABILITY (CAPE proxy from temp, dewpoint language, thunder) ──
  // Warm + humid + thunderstorm = high CAPE conditions
  let capeScore = 0.05;
  if (tempF >= 85) capeScore += 0.20;
  else if (tempF >= 75) capeScore += 0.12;
  else if (tempF >= 65) capeScore += 0.06;
  if (allText.includes('thunder'))     capeScore = Math.min(capeScore + 0.30, 1.0);
  if (allText.includes('severe'))      capeScore = Math.min(capeScore + 0.25, 1.0);
  if (allText.includes('storm'))       capeScore = Math.min(capeScore + 0.15, 1.0);
  if (allText.includes('humid'))       capeScore = Math.min(capeScore + 0.10, 1.0);
  if (allText.includes('unstable'))    capeScore = Math.min(capeScore + 0.20, 1.0);
  if (allText.includes('explosive'))   capeScore = Math.min(capeScore + 0.30, 1.0);
  if (allText.includes('cape'))        capeScore = Math.min(capeScore + 0.25, 1.0);
  const capeRaw = `${tempF}°F · ${allText.includes('thunder')?'Thunderstorms forecast':'No thunder forecast'}`;

  // ── 4. LOW-LEVEL JET (from southern latitudes + nighttime wind increase) ──
  // LLJ common in tornado alley (roughly lat 25–45N, lon -90 to -105)
  let llj = 0.10;
  const inAlley = lat >= 25 && lat <= 45 && (allText.includes('south') || allText.includes('southwest'));
  if (inAlley) llj += 0.25;
  if (allText.includes('low-level jet') || allText.includes('llj')) llj = Math.min(llj + 0.55, 1.0);
  if (allText.includes('southerly winds') || allText.includes('south winds')) llj = Math.min(llj + 0.20, 1.0);
  if (windMph >= 30) llj = Math.min(llj + 0.20, 1.0);
  if (windMph >= 50) llj = Math.min(llj + 0.20, 1.0);
  const lljRaw = inAlley ? `Tornado Alley lat (${lat.toFixed(1)}°N), ${windMph} mph winds` : `${lat.toFixed(1)}°N, ${windMph} mph winds`;

  // ── 5. LOW-LEVEL MOISTURE (from dewpoint language + precip probability) ──
  let moisture = Math.min(precip / 100, 0.5); // Precip probability as base
  if (allText.includes('humid'))       moisture = Math.min(moisture + 0.20, 1.0);
  if (allText.includes('muggy'))       moisture = Math.min(moisture + 0.20, 1.0);
  if (allText.includes('dew point'))   moisture = Math.min(moisture + 0.15, 1.0);
  if (allText.includes('dewpoint'))    moisture = Math.min(moisture + 0.15, 1.0);
  if (allText.includes('moist'))       moisture = Math.min(moisture + 0.15, 1.0);
  if (allText.includes('gulf'))        moisture = Math.min(moisture + 0.20, 1.0); // Gulf moisture transport
  if (tempF >= 70 && precip > 30)      moisture = Math.min(moisture + 0.15, 1.0);
  const moistureRaw = `${precip}% precip probability · ${allText.includes('humid')||allText.includes('moist')?'Humid conditions':'Moisture not elevated'}`;

  // ── 6. LIFTING MECHANISM (from front/dryline/boundary language) ──
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

  // ── 7. PRESSURE GRADIENT (from wind speed + synoptic language) ──
  let pressure = Math.min(windMph / 70, 0.65);
  if (allText.includes('low pressure')) pressure = Math.min(pressure + 0.30, 1.0);
  if (allText.includes('deepening'))    pressure = Math.min(pressure + 0.25, 1.0);
  if (allText.includes('strong gradient')) pressure = Math.min(pressure + 0.30, 1.0);
  if (allText.includes('cyclone'))      pressure = Math.min(pressure + 0.25, 1.0);
  if (allText.includes('blustery') || allText.includes('breezy')) pressure = Math.min(pressure + 0.10, 1.0);
  const pressureRaw = `${windMph} mph surface winds · ${allText.includes('low pressure')?'Low pressure system noted':'Surface analysis inferred'}`;

  // ── 8. CAPPING INVERSION (moderate cap is actually GOOD for tornadoes) ──
  // Stable = high cap (bad for storms), Unstable morning = breaking cap (good)
  let capping = 0.10;
  if (allText.includes('cap') || allText.includes('capping')) capping = Math.min(capping + 0.45, 1.0);
  if (allText.includes('clearing') && precip > 20) capping = Math.min(capping + 0.20, 1.0);
  // If we have thunder but started clear, that suggests cap broke — ideal scenario
  if (allText.includes('thunder') && !allText.includes('all day')) capping = Math.min(capping + 0.30, 1.0);
  if (allText.includes('mostly sunny') || allText.includes('partly cloudy')) {
    if (precip > 30) capping = Math.min(capping + 0.25, 1.0); // Clear morning → afternoon thunder
  }
  const cappingRaw = allText.includes('cap') ? 'Capping layer mentioned in forecast' : `${precip}% precip prob · ${short0}`;

  return [
    { label:'Wind\nShear',      name:'Wind Shear',             live: windShearScore, ideal:0.95, tier: windShearScore>0.7?'tier-crit':windShearScore>0.45?'tier-high':'tier-mod',
      raw: windShearRaw, unit:'Speed & directional veering',
      detail:'Speed & directional shear creates the horizontal rotation that updrafts tilt into a mesocyclone. The single most critical tornado ingredient.' },
    { label:'Storm-Rel.\nHelicity', name:'Storm-Rel. Helicity',   live: srhScore,      ideal:0.92, tier: srhScore>0.6?'tier-crit':srhScore>0.35?'tier-high':'tier-mod',
      raw: srhRaw, unit:'SRH > 300 m²/s² (0–3 km)',
      detail:'SRH > 300 m²/s² in the 0–3 km layer strongly favors tornadic supercells. Inferred from storm language and active tornado alerts nearby.' },
    { label:'Atmo.\nInstability', name:'Atmospheric Instability', live: capeScore,     ideal:0.90, tier: capeScore>0.6?'tier-crit':capeScore>0.35?'tier-high':'tier-mod',
      raw: capeRaw, unit:'CAPE proxy from temp & storms',
      detail:'CAPE > 2500 J/kg with steep mid-level lapse rates fuels explosive updrafts. Estimated from temperature and thunderstorm forecast language.' },
    { label:'Low-Level\nJet',    name:'Low-Level Jet Stream',    live: llj,           ideal:0.88, tier: llj>0.6?'tier-crit':llj>0.35?'tier-high':'tier-mod',
      raw: lljRaw, unit:'≥ 30 kt at 850 mb',
      detail:'The nocturnal LLJ at 850 mb dramatically increases low-level wind shear and drives warm moist advection. Estimated from latitude and wind profile.' },
    { label:'Low-Level\nMoisture', name:'Low-Level Moisture',    live: moisture,      ideal:0.85, tier: moisture>0.6?'tier-high':moisture>0.35?'tier-mod':'tier-low',
      raw: moistureRaw, unit:'Dewpoint ≥ 60°F (15.5°C)',
      detail:'Surface dewpoints ≥ 60°F with a deep moist layer to 850 mb. Gulf of Mexico moisture transport is the primary source in US Tornado Alley.' },
    { label:'Lifting\nMechanism', name:'Lifting Mechanism',      live: lifting,       ideal:0.80, tier: lifting>0.5?'tier-high':lifting>0.25?'tier-mod':'tier-low',
      raw: liftRaw, unit:'Frontal / dryline forcing',
      detail:'A strong cold front, dryline, outflow boundary, or convergence zone forces warm moist air upward to trigger supercell initiation.' },
    { label:'Pressure\nGradient', name:'Pressure Gradient',      live: pressure,      ideal:0.75, tier: pressure>0.55?'tier-high':pressure>0.30?'tier-mod':'tier-low',
      raw: pressureRaw, unit:'Surface low ≤ 990 mb',
      detail:'A strong surface low drives wind convergence, enhances frontal boundaries, and organizes storm inflow into developing supercells.' },
    { label:'Capping\nInversion', name:'Capping Inversion',      live: capping,       ideal:0.70, tier: capping>0.5?'tier-mod':capping>0.25?'tier-mod':'tier-low',
      raw: cappingRaw, unit:'CIN 50–150 J/kg',
      detail:'A moderate cap concentrates stored energy. When the cap breaks it allows explosive development. Estimated from morning stability vs afternoon storm potential.' }
  ];
}

function computeTornadoRisk(periods, lat, lon, alerts) {
  const factors = parseForecastSignals(periods, lat, alerts);

  // Composite score: weighted average (wind shear + helicity + instability weighted higher)
  const weights = [0.20, 0.18, 0.16, 0.12, 0.12, 0.10, 0.07, 0.05];
  const composite = factors.reduce((sum, f, i) => sum + f.live * weights[i], 0);
  const pct = Math.round(composite * 100);

  // Risk level
  let level, riskClass, icon;
  if (pct >= 70)      { level='EXTREME';  riskClass='risk-extreme'; icon='🌪️'; }
  else if (pct >= 55) { level='HIGH';     riskClass='risk-high';    icon='⛈️'; }
  else if (pct >= 40) { level='ELEVATED'; riskClass='risk-elevated';icon='🌩️'; }
  else if (pct >= 25) { level='GUARDED';  riskClass='risk-guarded'; icon='🌦️'; }
  else                { level='LOW';      riskClass='risk-low';     icon='🌤️'; }

  // Update banner
  document.getElementById('riskBanner').style.borderColor = pct>=70?'rgba(248,113,113,.3)':pct>=55?'rgba(251,146,60,.25)':pct>=40?'rgba(251,191,36,.2)':'var(--border)';
  document.querySelector('.risk-icon').textContent = icon;
  const rl = document.getElementById('riskLevel');
  rl.textContent = level;
  rl.className = 'risk-level ' + riskClass;
  document.getElementById('riskScore').textContent = pct + '%';
  document.getElementById('riskScore').className   = 'risk-score ' + riskClass;
  const critCount = factors.filter(f=>f.tier==='tier-crit').length;
  document.getElementById('riskSub').textContent = `Composite score ${pct}% · ${critCount} critical factor${critCount!==1?'s':''} active`;

  // Build spider chart
  buildSpider(factors);

  // Build factor list
  buildFactorList(factors);
}

// ── SPIDER CHART ─────────────────────────────────
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
  const svg = document.getElementById('radar');
  svg.innerHTML = '';
  const cx=190, cy=185, R=130, N=factors.length;

  function polar(i, r) {
    const a = (2*Math.PI*i/N) - Math.PI/2;
    return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
  }

  const defs = svgEl('defs',{},svg);

  // BG gradient
  const bgG = svgEl('radialGradient',{id:'bgG',cx:'50%',cy:'50%',r:'50%'},defs);
  svgEl('stop',{offset:'0%','stop-color':'#1c2030','stop-opacity':'0.9'},bgG);
  svgEl('stop',{offset:'100%','stop-color':'#0e1013','stop-opacity':'0.5'},bgG);

  // Fill gradients
  const lG = svgEl('linearGradient',{id:'lG',x1:'0%',y1:'0%',x2:'100%',y2:'100%'},defs);
  svgEl('stop',{offset:'0%','stop-color':'#93c5fd','stop-opacity':'0.22'},lG);
  svgEl('stop',{offset:'100%','stop-color':'#3b82f6','stop-opacity':'0.08'},lG);

  const iG = svgEl('linearGradient',{id:'iG',x1:'0%',y1:'0%',x2:'100%',y2:'100%'},defs);
  svgEl('stop',{offset:'0%','stop-color':'#f87171','stop-opacity':'0.18'},iG);
  svgEl('stop',{offset:'100%','stop-color':'#fb923c','stop-opacity':'0.06'},iG);

  const glow = svgEl('filter',{id:'glow',x:'-50%',y:'-50%',width:'200%',height:'200%'},defs);
  svgEl('feGaussianBlur',{stdDeviation:'2.5',result:'blur'},glow);
  const fm = svgEl('feMerge',{},glow);
  svgEl('feMergeNode',{in:'blur'},fm); svgEl('feMergeNode',{in:'SourceGraphic'},fm);

  // BG circle
  svgEl('circle',{cx,cy,r:R+8,fill:'url(#bgG)',stroke:'rgba(255,255,255,0.05)','stroke-width':'1'},svg);

  // Grid rings
  [0.2,0.4,0.6,0.8,1.0].forEach((lvl,li)=>{
    const pts = factors.map((_,i)=>polar(i,R*lvl));
    const d = pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')+'Z';
    svgEl('path',{d,fill:'none',stroke:li===4?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.05)','stroke-width':li===4?'1.2':'0.8','stroke-dasharray':li===4?'none':'3 4'},svg);
    if (li<4) svgEl('text',{x:cx+4,y:(cy-R*lvl+3).toFixed(1),fill:'rgba(255,255,255,0.15)','font-family':'ui-monospace,-apple-system-monospace,Menlo,monospace','font-size':'7','letter-spacing':'0.5px'},svg).textContent=(lvl*100)+'%';
  });

  // Spokes
  factors.forEach((_,i)=>{
    const p=polar(i,R);
    svgEl('line',{x1:cx,y1:cy,x2:p.x.toFixed(1),y2:p.y.toFixed(1),stroke:'rgba(255,255,255,0.06)','stroke-width':'1'},svg);
  });

  function buildPath(key) {
    return factors.map((f,i)=>polar(i,R*f[key])).map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+'Z';
  }

  livPath = svgEl('path',{d:buildPath('live'),fill:'url(#lG)',stroke:'#93c5fd','stroke-width':'1.8','stroke-linejoin':'round',opacity:'0'},svg);
  optPath = svgEl('path',{d:buildPath('ideal'),fill:'url(#iG)',stroke:'#f87171','stroke-width':'1.8','stroke-linejoin':'round',filter:'url(#glow)',opacity:'0'},svg);

  setTimeout(()=>{livPath.style.transition='opacity 0.5s';livPath.setAttribute('opacity','1');},400);
  setTimeout(()=>{optPath.style.transition='opacity 0.5s';optPath.setAttribute('opacity','1');},650);

  // Dots
  dotG = svgEl('g',{},svg);
  factors.forEach((f,i)=>{
    ['live','ideal'].forEach((key,ki)=>{
      const p = polar(i,R*f[key]);
      const isIdeal = key==='ideal';
      const dot = svgEl('circle',{cx:p.x.toFixed(2),cy:p.y.toFixed(2),r:isIdeal?'4':'3.5',fill:isIdeal?'#f87171':'#93c5fd',stroke:isIdeal?'#fca5a5':'#bfdbfe','stroke-width':'1.2',filter:isIdeal?'url(#glow)':'none',style:'cursor:pointer;transition:r 0.15s;',opacity:'0'},dotG);
      setTimeout(()=>{dot.style.transition='opacity 0.4s';dot.setAttribute('opacity','1');},isIdeal?750:500);
      const tip = document.getElementById('tipbox');
      dot.addEventListener('mouseenter',e=>{
        const col=isIdeal?'var(--red)':'var(--blue)';
        tip.innerHTML=`<strong>${f.name}</strong>${f.raw}<div class="tip-val" style="color:${col}">${key.toUpperCase()}: ${Math.round(f[key]*100)}%</div>`;
        tip.style.opacity='1'; posTip(e);
        dot.setAttribute('r',isIdeal?'6':'5');
      });
      dot.addEventListener('mousemove',posTip);
      dot.addEventListener('mouseleave',()=>{tip.style.opacity='0';dot.setAttribute('r',isIdeal?'4':'3.5');});
    });
  });

  // Axis labels
  factors.forEach((f,i)=>{
    const angle = (2*Math.PI*i/N) - Math.PI/2;
    const isTop    = angle < -Math.PI/4 && angle > -3*Math.PI/4;  // pointing upward
    const isBottom = angle > Math.PI/4  && angle <  3*Math.PI/4;  // pointing downward
    const isTopBot = isTop || isBottom;
    const lp = polar(i, R + 28);
    const lines = f.label.split('\n');
    const anchor = lp.x < cx-8 ? 'end' : lp.x > cx+8 ? 'start' : 'middle';
    const g = svgEl('g',{style:'cursor:pointer',opacity:'0'},svg);
    setTimeout(()=>{g.style.transition='opacity 0.5s';g.setAttribute('opacity','1');},800+i*50);

    // All label lines share same x; y starts at lp.y and goes downward
    const lineH = 12;
    // For top-pointing labels: percent goes ABOVE first line; for all others: BELOW last line
    if (isTop) {
      // % above label block
      svgEl('text',{x:lp.x.toFixed(1),y:(lp.y - lines.length*lineH - 1).toFixed(1),'text-anchor':anchor,fill:'#93c5fd','font-family':'ui-monospace,-apple-system-monospace,Menlo,monospace','font-size':'8.5'},g).textContent=Math.round(f.live*100)+'%';
      lines.forEach((line,li)=>{
        svgEl('text',{x:lp.x.toFixed(1),y:(lp.y - (lines.length-1-li)*lineH).toFixed(1),'text-anchor':anchor,fill:'#eef0f4','font-family':'-apple-system,BlinkMacSystemFont,system-ui,sans-serif','font-size':'9.5','font-weight':'600'},g).textContent=line;
      });
    } else {
      // label block then % below
      lines.forEach((line,li)=>{
        svgEl('text',{x:lp.x.toFixed(1),y:(lp.y + li*lineH).toFixed(1),'text-anchor':anchor,fill:'#eef0f4','font-family':'-apple-system,BlinkMacSystemFont,system-ui,sans-serif','font-size':'9.5','font-weight':'600'},g).textContent=line;
      });
      svgEl('text',{x:lp.x.toFixed(1),y:(lp.y + lines.length*lineH - 1).toFixed(1),'text-anchor':anchor,fill:'#93c5fd','font-family':'ui-monospace,-apple-system-monospace,Menlo,monospace','font-size':'8.5'},g).textContent=Math.round(f.live*100)+'%';
    }
    const tip2 = document.getElementById('tipbox');
    g.addEventListener('mouseenter',e=>{
      tip2.innerHTML=`<strong>${f.name}</strong>${f.raw}<div class="tip-val" style="color:var(--blue)">LIVE: ${Math.round(f.live*100)}%</div><div class="tip-val" style="color:var(--red)">IDEAL: ${Math.round(f.ideal*100)}%</div>`;
      tip2.style.opacity='1'; posTip(e);
    });
    g.addEventListener('mousemove',posTip);
    g.addEventListener('mouseleave',()=>{tip2.style.opacity='0';});
  });

  // Center watermark
  svgEl('text',{x:cx,y:cy-4,'text-anchor':'middle',fill:'rgba(255,255,255,0.04)','font-family':'-apple-system,BlinkMacSystemFont,system-ui,sans-serif','font-size':'14','font-weight':'700','letter-spacing':'-0.5px'},svg).textContent='TORNADO';
  svgEl('text',{x:cx,y:cy+9,'text-anchor':'middle',fill:'rgba(255,255,255,0.03)','font-family':'ui-monospace,-apple-system-monospace,Menlo,monospace','font-size':'6','letter-spacing':'2px'},svg).textContent='RISK INDEX';

  applySpiderMode(spiderMode);
}

function applySpiderMode(m) {
  spiderMode = m;
  document.querySelectorAll('.cmb').forEach(b=>{b.classList.remove('on');if(b.dataset.cm===m)b.classList.add('on');});
  if(!livPath||!optPath)return;
  [livPath,optPath].forEach(p=>p.style.transition='opacity 0.3s');
  livPath.setAttribute('opacity', (m==='both'||m==='live')?'1':'0');
  optPath.setAttribute('opacity', (m==='both'||m==='ideal')?'1':'0');
  let di=0;
  dotG?.querySelectorAll('circle').forEach(d=>{
    const isIdeal=di%2===1;
    d.style.transition='opacity 0.3s';
    d.setAttribute('opacity', isIdeal?(m==='both'||m==='ideal'?'1':'0'):(m==='both'||m==='live'?'1':'0'));
    di++;
  });
}

function posTip(e) {
  const tip=document.getElementById('tipbox');
  const x=e.clientX+14,y=e.clientY-10;
  tip.style.left=Math.min(x,window.innerWidth-210)+'px';
  tip.style.top=Math.min(y,window.innerHeight-120)+'px';
}

// ── FACTOR LIST ───────────────────────────────────
function buildFactorList(factors) {
  const fl = document.getElementById('factorList');
  fl.innerHTML = factors.map(f=>`
    <div class="factor-card ${f.tier}">
      <div class="fac-header">
        <div class="fac-stripe"></div>
        <div class="fac-name">${f.name}</div>
        <div class="fac-val">${f.raw.split('·')[0].trim()}</div>
        <div class="fac-score">${Math.round(f.live*100)}%</div>
        <span class="fac-chevron"><svg width="10" height="10" fill="currentColor"><use href="#bi-chevron-right"/></svg></span>
      </div>
      <div class="fac-body">
        <div class="fac-raw">${f.raw}</div>
        <div class="fac-prog-row">
          <div class="fac-prog-lbl"><span>Live</span><span style="color:var(--blue)">${Math.round(f.live*100)}%</span></div>
          <div class="fac-prog-track"><div class="fac-prog-fill" style="width:${f.live*100}%;background:var(--blue)"></div></div>
        </div>
        <div class="fac-prog-row">
          <div class="fac-prog-lbl"><span>Ideal</span><span style="color:var(--red)">${Math.round(f.ideal*100)}%</span></div>
          <div class="fac-prog-track"><div class="fac-prog-fill" style="width:${f.ideal*100}%;background:var(--red)"></div></div>
        </div>
        <div class="fac-detail">${f.detail}</div>
      </div>
    </div>`).join('');
  fl.querySelectorAll('.factor-card').forEach(el=>el.addEventListener('click',()=>el.classList.toggle('open')));
}

// ── LOCATION ─────────────────────────────────────
async function fetchForPoint(lat, lon) {
  // Run in parallel but compute tornado risk only after both are done
  const [periods] = await Promise.all([
    fetchForecast(lat, lon),
    fetchAlerts(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`)
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
    }else{
      const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=us&format=json&limit=1`,{headers:{'Accept-Language':'en','User-Agent':'StormWatch-Extension/2.0'}});
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
  curMode='national';
  document.getElementById('locName').textContent='United States';
  document.getElementById('locSub').textContent='National View';
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