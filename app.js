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

const NWR_STATIONS=[
  {st:"TX",city:"Fort Worth",call:"KEC55",freq:162.55,url:"https://wxradio.org/TX-FortWorth-KEC55",lat:32.7555,lon:-97.3308},
  {st:"TX",city:"Dallas",call:"KEC56",freq:162.4,url:"https://wxradio.org/TX-Dallas-KEC56",lat:32.7767,lon:-96.797},
  {st:"TX",city:"Austin",call:"WXK27",freq:162.4,url:"https://wxradio.org/TX-Austin-WXK27",lat:30.2672,lon:-97.7431},
  {st:"TX",city:"Waco",call:"WXK35",freq:162.475,url:"https://wxradio.org/TX-Waco-WXK35",lat:31.5493,lon:-97.1467},
  {st:"TX",city:"Corsicana",call:"KXI87",freq:162.525,url:"https://wxradio.org/TX-Corsicana-KXI87",lat:32.0954,lon:-96.4689},
  {st:"TX",city:"Palestine",call:"KWN34",freq:162.45,url:"https://wxradio.org/TX-Palestine-KWN34",lat:31.7621,lon:-95.6307},
  {st:"TX",city:"Galveston",call:"KHB40",freq:162.55,url:"https://wxradio.org/TX-Galveston-KHB40",lat:29.3013,lon:-94.7977},
  {st:"TX",city:"Houston",call:"KGG68",freq:162.4,url:"https://wxradio.org/TX-HoustonTomball-KGG68",lat:29.7604,lon:-95.3698},
  {st:"TX",city:"Tyler",call:"WXK36",freq:162.475,url:"https://wxradio.org/TX-Tyler-WXK36",lat:32.3513,lon:-95.3011},
  {st:"TX",city:"College Station",call:"WXK30",freq:162.4,url:"https://wxradio.org/TX-CollegeStation-WXK30",lat:30.628,lon:-96.3344},
  {st:"TX",city:"Corpus Christi",call:"KHB41",freq:162.55,url:"https://wxradio.org/TX-CorpusChristi-KHB41",lat:27.8006,lon:-97.3964},
  {st:"TX",city:"Amarillo",call:"WXK38",freq:162.4,url:"https://wxradio.org/TX-Amarillo-WXK38",lat:35.222,lon:-101.8313},
  {st:"TX",city:"Odessa",call:"WXK32",freq:162.4,url:"https://wxradio.org/TX-Odessa-WXK32",lat:31.8457,lon:-102.3676},
  {st:"OK",city:"Oklahoma City",call:"WXK85",freq:162.4,url:"https://wxradio.org/OK-OklahomaCity-WXK85",lat:35.4676,lon:-97.5164},
  {st:"OK",city:"Tulsa",call:"KIH27",freq:162.55,url:"https://wxradio.org/OK-Tulsa-KIH27",lat:36.154,lon:-95.9928},
  {st:"OK",city:"Lawton",call:"WXK86",freq:162.55,url:"https://wxradio.org/OK-Lawton-WXK86",lat:34.6036,lon:-98.3959},
  {st:"OK",city:"Stillwater",call:"WNG654",freq:162.5,url:"https://wxradio.org/OK-Stillwater-WNG654",lat:36.1156,lon:-97.0584},
  {st:"LA",city:"Shreveport",call:"WXJ97",freq:162.4,url:"https://wxradio.org/LA-Shreveport-WXJ97",lat:32.5252,lon:-93.7502},
  {st:"LA",city:"Baton Rouge",call:"KHB46",freq:162.4,url:"https://radio.weatherusa.net/NWR/KHB46.mp3",lat:30.4515,lon:-91.1871},
  {st:"LA",city:"Monroe",call:"WXJ96",freq:162.55,url:"https://radio.weatherusa.net/NWR/WXJ96_2.mp3",lat:32.5093,lon:-92.1193},
  {st:"LA",city:"Lafayette",call:"WXK80",freq:162.55,url:"https://radio.weatherusa.net/NWR/WXK80.mp3",lat:30.2241,lon:-92.0198},
  {st:"TN",city:"Memphis",call:"WXK49",freq:162.475,url:"https://wxradio.org/TN-Memphis-WXK49",lat:35.1495,lon:-90.049},
  {st:"TN",city:"Nashville",call:"KIG79",freq:162.55,url:"https://wxradio.org/TN-WhiteHouse-KIG79",lat:36.1627,lon:-86.7816},
  {st:"GA",city:"Atlanta",call:"KEC80",freq:162.55,url:"https://wxradio.org/GA-Atlanta-KEC80",lat:33.749,lon:-84.388},
  {st:"GA",city:"Athens",call:"WXK56",freq:162.4,url:"https://wxradio.org/GA-Athens-WXK56",lat:33.9519,lon:-83.3576},
  {st:"FL",city:"Miami",call:"KHB34",freq:162.55,url:"https://wxradio.org/FL-Miami-KHB34",lat:25.7617,lon:-80.1918},
  {st:"FL",city:"Tampa Bay",call:"KHB32",freq:162.55,url:"https://wxradio.org/FL-TampaBay-KHB32",lat:27.9506,lon:-82.4572},
  {st:"FL",city:"Orlando",call:"KIH63",freq:162.475,url:"https://wxradio.org/FL-Orlando-KIH63",lat:28.5384,lon:-81.3789},
  {st:"FL",city:"Tallahassee",call:"KIH24",freq:162.4,url:"https://wxradio.org/FL-Tallahassee-KIH24",lat:30.4383,lon:-84.2807},
  {st:"AL",city:"Mobile",call:"KEC61",freq:162.55,url:"https://radio.weatherusa.net/NWR/KEC61_2.mp3",lat:30.6954,lon:-88.0399},
  {st:"MS",city:"Tupelo",call:"KIH53",freq:162.4,url:"https://radio.weatherusa.net/NWR/KIH53.mp3",lat:34.2576,lon:-88.7034},
  {st:"SC",city:"Greer",call:"WXJ21",freq:162.55,url:"https://radio.weatherusa.net/NWR/WXJ21.mp3",lat:34.9387,lon:-82.2271},
  {st:"NC",city:"Charlotte",call:"WXL70",freq:162.475,url:"https://wxradio.org/NC-Charlotte-WXL70",lat:35.2271,lon:-80.8431},
  {st:"VA",city:"Manassas",call:"KHB36",freq:162.55,url:"https://radio.weatherusa.net/NWR/KHB36.mp3",lat:38.7509,lon:-77.4753},
  {st:"MD",city:"Baltimore",call:"KEC83",freq:162.4,url:"https://radio.weatherusa.net/NWR/KEC83_3.mp3",lat:39.2904,lon:-76.6122},
  {st:"MD",city:"Hagerstown",call:"WXM42",freq:162.475,url:"https://noaa-manassas-radio.from-va.com/Hagerstown.mp3",lat:39.6418,lon:-77.7199},
  {st:"PA",city:"Philadelphia",call:"KIH28",freq:162.475,url:"https://radio.weatherusa.net/NWR/KIH28.mp3",lat:39.9526,lon:-75.1652},
  {st:"PA",city:"Pittsburgh",call:"KIH35",freq:162.55,url:"https://radio.weatherusa.net/NWR/KIH35.mp3",lat:40.4406,lon:-79.9959},
  {st:"PA",city:"Harrisburg",call:"WXL40",freq:162.55,url:"https://wxradio.org/PA-Harrisburg-WXL40",lat:40.2732,lon:-76.8867},
  {st:"NY",city:"New York City",call:"KWO35",freq:162.55,url:"https://www.saucci.net:8443/audio3.ogg",lat:40.7128,lon:-74.006},
  {st:"NY",city:"Albany",call:"WXL34",freq:162.55,url:"https://wxradio.org/NY-Albany-WXL34",lat:42.6526,lon:-73.7562},
  {st:"NY",city:"Rochester",call:"KHA53",freq:162.4,url:"https://wxradio.org/NY-Rochester-KHA53",lat:43.1566,lon:-77.6088},
  {st:"NY",city:"Syracuse",call:"WXL31",freq:162.55,url:"https://wxradio.org/NY-Syracuse-WXL31",lat:43.0481,lon:-76.1474},
  {st:"NY",city:"Buffalo",call:"KEB98",freq:162.55,url:"https://radio.weatherusa.net/NWR/KEB98.mp3",lat:42.8864,lon:-78.8784},
  {st:"MA",city:"Boston",call:"KHB35",freq:162.475,url:"https://radio.weatherusa.net/NWR/KHB35_3.mp3",lat:42.3601,lon:-71.0589},
  {st:"MA",city:"Worcester",call:"WXL93",freq:162.55,url:"https://wxradio.org/MA-Worcester-WXL93",lat:42.2626,lon:-71.8023},
  {st:"CT",city:"Meriden",call:"WXJ42",freq:162.4,url:"https://wxradio.org/CT-Meriden-WXJ42",lat:41.5382,lon:-72.7898},
  {st:"OH",city:"Columbus",call:"KIG86",freq:162.55,url:"https://radio.weatherusa.net/NWR/KIG86.mp3",lat:39.9612,lon:-82.9988},
  {st:"OH",city:"Toledo",call:"WXL51",freq:162.5,url:"https://radio.weatherusa.net/NWR/WXL51.mp3",lat:41.6639,lon:-83.5552},
  {st:"OH",city:"Grafton",call:"WNG698",freq:162.5,url:"https://wxradio.org/OH-Grafton-WNG698",lat:41.2778,lon:-82.0224},
  {st:"MI",city:"Detroit",call:"KEC63",freq:162.55,url:"https://radio.weatherusa.net/NWR/KEC63.mp3",lat:42.3314,lon:-83.0458},
  {st:"MI",city:"Hesperia",call:"WWF36",freq:162.475,url:"https://wxradio.org/MI-Hesperia-WWF36",lat:43.5686,lon:-85.9908},
  {st:"IN",city:"Indianapolis",call:"KEC74",freq:162.55,url:"https://wxradio.org/IN-Indianapolis-KEC74",lat:39.7684,lon:-86.1581},
  {st:"IN",city:"South Bend",call:"WXJ57",freq:162.4,url:"https://wxradio.org/IN-SouthBend-WXJ57",lat:41.6764,lon:-86.252},
  {st:"IL",city:"Chicago",call:"KWO39",freq:162.55,url:"https://radio.weatherusa.net/NWR/KWO39.mp3",lat:41.8781,lon:-87.6298},
  {st:"IL",city:"Champaign",call:"WXJ76",freq:162.55,url:"https://wxradio.org/IL-Champaign-WXJ76",lat:40.1164,lon:-88.2434},
  {st:"IL",city:"Peoria",call:"WXJ71",freq:162.475,url:"https://wxradio.org/IL-Peoria-WXJ71",lat:40.6936,lon:-89.589},
  {st:"WI",city:"Green Bay",call:"KIG65",freq:162.55,url:"https://radio.weatherusa.net/NWR/KIG65.mp3",lat:44.5133,lon:-88.0133},
  {st:"WI",city:"Menomonie",call:"WXJ88",freq:162.4,url:"https://wxradio.org/WI-Menomonie-WXJ88",lat:44.8758,lon:-91.9193},
  {st:"MN",city:"Minneapolis",call:"KEC65",freq:162.55,url:"https://wxradio.org/MN-Minneapolis-KEC65",lat:44.9778,lon:-93.265},
  {st:"MN",city:"La Crescent",call:"WXJ86",freq:162.55,url:"https://wxradio.org/MN-LaCrescent-WXJ86",lat:43.8286,lon:-91.2999},
  {st:"MO",city:"St. Louis",call:"KDO89",freq:162.55,url:"https://wxradio.org/MO-StLouis-KDO89",lat:38.627,lon:-90.1994},
  {st:"MO",city:"Kansas City",call:"KID77",freq:162.55,url:"https://wxradio.org/MO-KansasCity-KID77",lat:39.0997,lon:-94.5786},
  {st:"MO",city:"Springfield",call:"WXL46",freq:162.4,url:"https://wxradio.org/MO-Springfield-WXL46",lat:37.209,lon:-93.2923},
  {st:"KS",city:"Topeka",call:"WXK91",freq:162.475,url:"https://wxradio.org/KS-Topeka-WXK91-alt1",lat:39.0473,lon:-95.6752},
  {st:"NE",city:"Omaha",call:"KIH61",freq:162.4,url:"https://wxradio.org/NE-Omaha-KIH61",lat:41.2565,lon:-95.9345},
  {st:"NE",city:"Lincoln",call:"WXM20",freq:162.475,url:"https://wxradio.org/NE-Lincoln-WXM20-alt1",lat:40.8136,lon:-96.7026},
  {st:"NE",city:"Grand Island",call:"WXL74",freq:162.4,url:"https://wxradio.org/NE-GrandIsland-WXL74",lat:40.925,lon:-98.342},
  {st:"IA",city:"Sioux City",call:"WXL62",freq:162.475,url:"https://wxradio.org/IA-Sioux_City-WXL62",lat:42.4999,lon:-96.4003},
  {st:"IA",city:"Des Moines",call:"WXL57",freq:162.55,url:"https://radio.weatherusa.net/NWR/WXL57.mp3",lat:41.5868,lon:-93.625},
  {st:"ND",city:"Bismarck",call:"WXL78",freq:162.475,url:"https://wxradio.org/ND-Bismarck-WXL78",lat:46.8083,lon:-100.7837},
  {st:"KY",city:"Frankfort",call:"WZ2523",freq:162.5,url:"https://wxradio.org/KY-Frankfort-WZ2523",lat:38.2009,lon:-84.8733},
  {st:"KY",city:"Owenton",call:"KZZ48",freq:162.45,url:"https://wxradio.org/KY-Owenton-KZZ48",lat:38.5373,lon:-84.8388},
  {st:"WV",city:"Parkersburg",call:"WXM70",freq:162.55,url:"https://radio.weatherusa.net/NWR/WXM70.mp3",lat:39.2667,lon:-81.5615},
  {st:"NM",city:"Farmington",call:"WXJ37",freq:162.475,url:"https://radio.weatherusa.net/NWR/WXJ37.mp3",lat:36.7281,lon:-108.2087},
  {st:"NM",city:"Albuquerque",call:"WXJ34",freq:162.4,url:"https://radio.weatherusa.net/NWR/WXJ34.mp3",lat:35.0844,lon:-106.6504},
  {st:"AZ",city:"Phoenix",call:"KEC94",freq:162.55,url:"https://wxradio.org/AZ-Phoenix-KEC94",lat:33.4484,lon:-112.074},
  {st:"AZ",city:"Globe",call:"WWG42",freq:162.5,url:"https://wxradio.org/AZ-Globe-WWG42",lat:33.3942,lon:-110.786},
  {st:"NV",city:"Reno",call:"WXK58",freq:162.55,url:"https://radio.weatherusa.net/NWR/WXK58.mp3",lat:39.5296,lon:-119.8138},
  {st:"CA",city:"San Diego",call:"KEC62",freq:162.4,url:"https://radio.weatherusa.net/NWR/KEC62_2.mp3",lat:32.7157,lon:-117.1611},
  {st:"CA",city:"Fresno",call:"KIH62",freq:162.4,url:"https://radio.weatherusa.net/NWR/KIH62_2.mp3",lat:36.7378,lon:-119.7871},
  {st:"CA",city:"San Francisco",call:"KEC49",freq:162.55,url:"https://wxradio.org/CA-Monterey-KEC49",lat:37.7749,lon:-122.4194},
  {st:"HI",city:"Maui",call:"WWG75",freq:162.4,url:"https://wxradio.org/HI-Maui-WWG75",lat:20.7984,lon:-156.3319},
  {st:"ME",city:"Dresden",call:"WSM60",freq:162.475,url:"https://wxradio.org/ME-Dresden-WSM60",lat:44.0787,lon:-69.7442}
];

// 84 stations

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
    const map = {alerts:'tabAlerts', forecast:'tabForecast', nearby:'tabNearby', radar:'tabRadar', tornado:'tabTornado'};
    document.getElementById(map[t]).classList.add('on');
    document.getElementById('filterRow').style.display = t === 'alerts' ? 'flex' : 'none';
    const bodyEl = document.getElementById('body');
    if (bodyEl) bodyEl.classList.toggle('radar-active', t === 'radar');
    // Leaflet needs size invalidation when its container becomes visible
    if (t === 'radar') {
      if (!rvInited && curLat) {
        initRadar(curLat, curLon);
      } else if (rvMap) {
        setTimeout(() => rvMap.invalidateSize(), 60);
      }
    }
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="currentColor" viewBox="-1 -1 18 18" style="overflow:visible">${path}</svg>`;
}
function wxLabel(s) {
  s = (s||'').toLowerCase();
  if (s.includes('tornado'))                                            return 'Tornado';
  // Only "Storm" when thunder is the lead condition, not a rain modifier
  // "Thunderstorms" -> Storm, "Showers And Thunderstorms" -> Showers
  const hasThunder = s.includes('thunder') || s.includes('tstm');
  const hasRain    = s.includes('rain') || s.includes('shower') || s.includes('drizzle');
  if (hasThunder && !hasRain)                                           return 'Storm';
  if (s.includes('blizzard'))                                           return 'Blizzard';
  if (s.includes('snow') || s.includes('sleet'))                        return 'Snow';
  if (s.includes('ice') || s.includes('freezing'))                      return 'Ice';
  if (s.includes('drizzle'))                                            return 'Drizzle';
  if (s.includes('shower') || (hasThunder && hasRain))                  return 'Showers';
  if (s.includes('rain'))                                               return 'Rain';
  if (s.includes('fog') || s.includes('mist'))                          return 'Fog';
  if (s.includes('haz') || s.includes('smoke') || s.includes('dust'))   return 'Hazy';
  if (s.includes('breezy') || s.includes('blustery') || s.includes('windy')) return 'Windy';
  if (s.includes('sunny') || s.includes('clear'))                       return 'Clear';
  if (s.includes('partly cloudy') || s.includes('partly sunny'))        return 'Partly';
  if (s.includes('mostly cloudy') || s.includes('overcast'))            return 'Cloudy';
  if (s.includes('mostly sunny') || s.includes('mostly clear'))         return 'Mostly Clear';
  return 'Cloudy';
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
// ══════════════════════════════════════════════
// WIND MODAL
// ══════════════════════════════════════════════
let _compassActive = false;
let _compassHeading = null;
let _compassHandler = null;

function degToCard(d) {
  if (d == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(d / 22.5) % 16];
}

function beaufortFromMph(mph) {
  const scale = [
    [1,   0,  'Calm',             0  ],
    [3,   1,  'Light Air',        0.05],
    [7,   2,  'Light Breeze',     0.10],
    [12,  3,  'Gentle Breeze',    0.20],
    [18,  4,  'Moderate Breeze',  0.30],
    [24,  5,  'Fresh Breeze',     0.42],
    [31,  6,  'Strong Breeze',    0.54],
    [38,  7,  'Near Gale',        0.62],
    [46,  8,  'Gale',             0.70],
    [54,  9,  'Severe Gale',      0.78],
    [63, 10,  'Storm',            0.86],
    [72, 11,  'Violent Storm',    0.93],
    [999,12,  'Hurricane Force',  1.0 ],
  ];
  for (const [max, num, desc, pct] of scale) {
    if (mph <= max) return { num, desc, pct };
  }
  return { num: 12, desc: 'Hurricane Force', pct: 1.0 };
}

function compassSVG(windDeg, deviceDeg) {
  // windDeg  : degrees wind is FROM (meteorological: 0=N wind blowing south)
  // deviceDeg: current device compass heading (null if no permission)
  const cx = 110, cy = 110, r = 100;
  const ticksHTML = [];

  // Tick marks around the ring
  for (let i = 0; i < 72; i++) {
    const a = (i * 5) * Math.PI / 180;
    const isMajor = i % 9 === 0; // every 45°
    const isMid   = i % 3 === 0; // every 15°
    const rOuter = r;
    const rInner = isMajor ? r - 14 : isMid ? r - 9 : r - 5;
    const x1 = cx + rOuter * Math.sin(a), y1 = cy - rOuter * Math.cos(a);
    const x2 = cx + rInner * Math.sin(a), y2 = cy - rInner * Math.cos(a);
    ticksHTML.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,${isMajor?'.35':isMid?'.18':'.1'})" stroke-width="${isMajor?1.5:1}"/>`);
  }

  // Cardinal labels
  const cardinals = [['N',0],['E',90],['S',180],['W',270]];
  const cardHTML = cardinals.map(([lbl, deg]) => {
    const a = deg * Math.PI / 180;
    const rLbl = r - 22;
    const x = cx + rLbl * Math.sin(a), y = cy - rLbl * Math.cos(a);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="rgba(255,255,255,.5)" font-size="11" font-family="ui-monospace,monospace" font-weight="600">${lbl}</text>`;
  }).join('');

  // Wind arrow:
  // windDeg = direction wind is FROM (meteorological convention).
  // The arrowhead points downwind (where wind is going = windDeg + 180).
  // Line spans full inner diameter — from the upwind side to the downwind tip.
  let windArrowHTML = '';
  if (windDeg != null) {
    // Downwind angle: where the wind is traveling TO
    const waDeg = (windDeg + 180) % 360;
    const wa = waDeg * Math.PI / 180;
    const innerR = 30; // stop just inside the center circle edge

    // Downwind tip (arrowhead end) — stop at inner circle edge
    const tipX = cx + innerR * Math.sin(wa),  tipY = cy - innerR * Math.cos(wa);
    // Extend line all the way to the opposite inner circle edge (upwind end)
    const tailX = cx - innerR * Math.sin(wa), tailY = cy + innerR * Math.cos(wa);

    // Build a long line from upwind inner-circle edge to downwind inner-circle edge
    // but we want it to visually cross the full diameter, so use a larger inner reach
    const lineR = 75; // reach from center toward each side (fits inside r=100 ring comfortably)
    const lx1 = cx + lineR * Math.sin(wa),  ly1 = cy - lineR * Math.cos(wa);  // downwind end
    const lx2 = cx - lineR * Math.sin(wa),  ly2 = cy + lineR * Math.cos(wa);  // upwind end (no head)

    // Arrowhead at downwind tip
    const headSize = 10;
    const perpX = Math.cos(wa), perpY = Math.sin(wa);
    const hx  = lx1, hy  = ly1;
    const hlx = hx - headSize * Math.sin(wa) + (headSize * 0.55) * perpX;
    const hly = hy + headSize * Math.cos(wa) + (headSize * 0.55) * perpY;
    const hrx = hx - headSize * Math.sin(wa) - (headSize * 0.55) * perpX;
    const hry = hy + headSize * Math.cos(wa) - (headSize * 0.55) * perpY;

    // Small circle at upwind tail end
    const tailCircleX = lx2, tailCircleY = ly2;

    windArrowHTML = `
      <line x1="${lx2.toFixed(1)}" y1="${ly2.toFixed(1)}" x2="${lx1.toFixed(1)}" y2="${ly1.toFixed(1)}" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="${hx.toFixed(1)},${hy.toFixed(1)} ${hlx.toFixed(1)},${hly.toFixed(1)} ${hrx.toFixed(1)},${hry.toFixed(1)}" fill="white"/>
      <circle cx="${tailCircleX.toFixed(1)}" cy="${tailCircleY.toFixed(1)}" r="4" fill="none" stroke="white" stroke-width="2"/>
    `;
  }

  // Device heading indicator (blue triangle at rim)
  let deviceHTML = '';
  if (deviceDeg != null) {
    const da = deviceDeg * Math.PI / 180;
    const dr = r - 3;
    const dx = cx + dr * Math.sin(da), dy = cy - dr * Math.cos(da);
    const p1x = cx + (r+4) * Math.sin(da), p1y = cy - (r+4) * Math.cos(da);
    const perp = 5;
    const p2x = dx + perp * Math.cos(da), p2y = dy + perp * Math.sin(da);
    const p3x = dx - perp * Math.cos(da), p3y = dy - perp * Math.sin(da);
    deviceHTML = `<polygon points="${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)} ${p3x.toFixed(1)},${p3y.toFixed(1)}" fill="#93c5fd" opacity=".9"/>`;
  }

  // Center circle + dot
  const centerHTML = `
    <circle cx="${cx}" cy="${cy}" r="32" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="rgba(255,255,255,.3)"/>
  `;

  return `<svg class="wc-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
    <!-- Outer ring -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>
    <!-- Tick marks -->
    ${ticksHTML.join('')}
    <!-- Cardinals -->
    ${cardHTML}
    <!-- Wind arrow -->
    ${windArrowHTML}
    <!-- Device indicator -->
    ${deviceHTML}
    <!-- Center -->
    ${centerHTML}
  </svg>`;
}

function renderWindModal() {
  const body = document.getElementById('windModalBody');
  if (!body) return;
  const wd = window._windData || {};
  const speed = wd.speed ?? null;
  const gust  = wd.gust  ?? null;
  const dir   = wd.direction ?? null;
  const cardDir = degToCard(dir);
  const bf = speed != null ? beaufortFromMph(speed) : null;

  // ── Compass section ──
  const compassHTML = `
    <div class="wind-compass-wrap">
      <div class="wind-compass">${compassSVG(dir, _compassHeading)}</div>
    </div>`;

  // ── Main stats ──
  const statsHTML = `
    <div class="wind-stats">
      <div class="wind-stat-card">
        <span class="wind-stat-lbl">Wind Speed</span>
        <span class="wind-stat-val">${speed ?? '—'}</span>
        <span class="wind-stat-unit">mph</span>
        <span class="wind-stat-sub">${bf ? bf.desc : ''}</span>
      </div>
      <div class="wind-stat-card">
        <span class="wind-stat-lbl">Gusts</span>
        <span class="wind-stat-val" style="color:${gust != null && gust > 30 ? 'var(--orange)' : gust != null && gust > 45 ? 'var(--red)' : 'var(--text)'}">${gust ?? '—'}</span>
        <span class="wind-stat-unit">mph</span>
        <span class="wind-stat-sub">${gust != null && gust > 45 ? 'Dangerous gusts' : gust != null && gust > 30 ? 'Elevated gusts' : 'Light gusts'}</span>
      </div>
      <div class="wind-stat-card">
        <span class="wind-stat-lbl">Direction</span>
        <span class="wind-stat-val" style="font-size:26px;padding-top:4px">${dir != null ? dir + '°' : '—'}</span>
        <span class="wind-stat-unit">${cardDir}</span>
        <span class="wind-stat-sub">wind from ${cardDir}</span>
      </div>
      <div class="wind-stat-card">
        <span class="wind-stat-lbl">Beaufort</span>
        <span class="wind-stat-val">${bf ? bf.num : '—'}</span>
        <span class="wind-stat-unit">/ 12</span>
        <span class="wind-stat-sub">${bf ? bf.desc : ''}</span>
      </div>
    </div>`;

  // ── Beaufort bar ──
  const beaufortHTML = bf ? `
    <div class="wind-beaufort">
      <div class="wind-section-ttl">Beaufort Scale</div>
      <div class="beaufort-bar-wrap">
        <div class="beaufort-bar-track">
          <div class="beaufort-bar-dot" style="left:${(bf.pct*100).toFixed(1)}%"></div>
        </div>
      </div>
      <div class="beaufort-info">
        <div>
          <div class="beaufort-scale">${bf.desc}</div>
          <div class="beaufort-desc">Force ${bf.num} of 12</div>
        </div>
        <div class="beaufort-num" style="color:${gradientColor(bf.pct).hex}">${bf.num}</div>
      </div>
    </div>` : '';

  // ── Device compass ──
  const compassPermHTML = _compassActive
    ? `<div class="wind-compass-status">📡 Live compass active · You are facing ${_compassHeading != null ? _compassHeading.toFixed(0)+'° '+degToCard(_compassHeading) : '…'}</div>`
    : `<button class="wind-compass-btn" onclick="requestCompass()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8"/><path d="m5.904 6.523.94 2.555.938-2.555L10.338 5.5l-2.556.94L6.844 5.5l-.94 2.023zm2.598 3.168-1.11-3.015L4.378 7.566l3.014-1.11 1.11 3.015 3.015-1.11-3.015 1.11z"/></svg>
        Enable Live Compass
      </button>
      <div class="wind-compass-status">Tap to overlay your heading on the compass</div>`;

  // ── Hourly wind sparkline ──
  let hourlyHTML = '';
  const oh = window._omHourly;
  if (oh && oh.time && oh.wind_speed_10m) {
    const now = Date.now();
    const cards = oh.time.map((t, i) => {
      const ms = new Date(t).getTime();
      if (ms < now - 3600000 || i > 23) return null;
      const spd = oh.wind_speed_10m[i] != null ? Math.round(oh.wind_speed_10m[i]) : null;
      const gst = oh.wind_gusts_10m?.[i]  != null ? Math.round(oh.wind_gusts_10m[i])  : null;
      const wdir = oh.wind_direction_10m?.[i] ?? null;
      const hr = new Date(t).toLocaleTimeString([],{hour:'numeric'});
      // Arrow emoji by direction
      const arrowMap = ['↑','↗','→','↘','↓','↙','←','↖'];
      const arrow = wdir != null ? arrowMap[Math.round(wdir/45)%8] : '·';
      const color = spd != null && spd > 30 ? 'var(--orange)' : spd != null && spd > 20 ? 'var(--yellow)' : 'var(--text)';
      return `<div class="wind-hour-card">
        <span class="whc-time">${hr}</span>
        <span class="whc-arrow" title="${wdir != null ? wdir+'° '+degToCard(wdir) : ''}">${arrow}</span>
        <span class="whc-speed" style="color:${color}">${spd ?? '—'}</span>
        <span class="whc-gust">${gst != null ? 'G'+gst : ''}</span>
      </div>`;
    }).filter(Boolean);
    if (cards.length) {
      hourlyHTML = `<div class="wind-hourly">
        <div class="wind-section-ttl">Hourly Forecast</div>
        <div class="wind-hourly-scroll"><div class="wind-hourly-track">${cards.join('')}</div></div>
      </div>`;
    }
  }

  body.innerHTML = compassHTML + statsHTML + beaufortHTML + compassPermHTML + hourlyHTML;
}

function openWindModal() {
  document.getElementById('windModal').classList.add('open');
  renderWindModal();
}

function closeWindModal() {
  document.getElementById('windModal').classList.remove('open');
  stopCompass();
}

function requestCompass() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(state => {
      if (state === 'granted') startCompass();
      else { alert('Compass access denied. You can re-enable it in iOS Settings → Safari → Motion & Orientation Access.'); }
    }).catch(err => { console.warn('Compass permission error:', err); });
  } else {
    // Non-iOS or already granted
    startCompass();
  }
}

function startCompass() {
  if (_compassHandler) window.removeEventListener('deviceorientation', _compassHandler);
  _compassActive = true;
  _compassHandler = (e) => {
    // webkitCompassHeading is iOS-specific true north heading (0–360)
    const heading = e.webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
    if (heading != null) {
      _compassHeading = heading;
      // Live-update just the compass SVG and status without full re-render
      const compassWrap = document.querySelector('.wind-compass');
      if (compassWrap) compassWrap.innerHTML = compassSVG(window._windData?.direction ?? null, heading);
      const statusEl = document.querySelector('.wind-compass-status');
      if (statusEl) statusEl.textContent = `📡 Live compass · ${heading.toFixed(0)}° ${degToCard(heading)}`;
    }
  };
  window.addEventListener('deviceorientation', _compassHandler, true);
  renderWindModal(); // re-render to show active state
}

function stopCompass() {
  if (_compassHandler) {
    window.removeEventListener('deviceorientation', _compassHandler);
    _compassHandler = null;
  }
  _compassActive = false;
  _compassHeading = null;
}


function gotoAlertsFiltered(keyword) {
  // Switch to Alerts tab and filter by keyword ('warning', 'watch', 'advisory')
  const tabBtn = document.querySelector('.tab[data-tab="alerts"]');
  if (tabBtn) tabBtn.click();
  // Map keyword to existing filter buttons
  const filterMap = { warning: 'sev', watch: 'sev', advisory: 'min' };
  const f = filterMap[keyword] || 'all';
  setFilter(f);
  // Further filter displayed alerts by keyword within the chosen severity
  setTimeout(() => {
    const box = document.getElementById('panelAlerts');
    if (!box) return;
    const filtered = allAlerts.filter(a => (a.properties.event || '').toLowerCase().includes(keyword));
    if (filtered.length) renderAlerts(filtered);
  }, 50);
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
  if (hero?.temperature) window._nwsHeroTemp = hero.temperature;
  // Hero always renders with placeholder temp — OM patch fills in real current value
  const heroHTML=hero?`<div class="fc-hero">
    <div class="fch-top"><div class="fch-day">${dn[now.getDay()]}, ${mn[now.getMonth()]} ${now.getDate()}</div><div class="fch-time">${now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div></div>
    <div class="fch-temp">—<sup>°F</sup></div>
    <div class="fch-icon">${wxIcon(hero.shortForecast, 56)}</div>
    <div class="fch-meta"><div>${hero.shortForecast}</div><div>Wind: <b>${hero.windDirection||''} ${hero.windSpeed||''}</b></div></div>
  </div>`:'';
  const rows=days.slice(1,7).map(d=>{const dt=new Date(d.startTime);return`<div class="fc-day-row"><span class="fdr-name">${dn[dt.getDay()]}</span><span class="fdr-icon">${wxIcon(d.shortForecast)}</span><span class="fdr-desc">${d.shortForecast}</span><span class="fdr-temp ${tempClass(d.temperature)}">${d.temperature}°</span></div>`;}).join('');
  box.innerHTML=heroHTML
    +'<div class="hourly-toggle" id="hourlyToggle"><span class="hourly-toggle-lbl"><svg width="12" height="12" fill="currentColor"><use href="#bi-sun"/></svg> Hourly Forecast</span><span class="hourly-toggle-chevron"><svg width="10" height="10" fill="currentColor"><use href="#bi-chevron-right"/></svg></span></div>'
    +'<div class="hourly-scroll" id="hourlyScroll"><div class="hourly-track" id="hourlyTrack"></div></div>'
    +'<div id="aqiSlot"></div>'
    +'<div id="uvSlot"></div>'
    +'<div class="fc-days">'+rows+'</div>';
  // Repaint cached AQI + UV immediately so slots never appear blank on re-render
  if (_aqiCache) { const s=document.getElementById('aqiSlot'); if(s) s.innerHTML=aqiHTML(_aqiCache); }
  if (window._uvData != null) renderUVSlot();
  document.getElementById('hourlyToggle').addEventListener('click', () => {
    document.getElementById('hourlyToggle').classList.toggle('open');
    document.getElementById('hourlyScroll').classList.toggle('open');
  });
}


// ── PATCH HOURLY TEMPS FROM OPEN-METEO ───────────
// NWS hourly periods own everything except temperature — OM provides the accurate temp.
// Called after renderHourly has already built the DOM cards.
function patchHourlyTemps(omHourly) {
  const times = omHourly?.time || [];
  const temps = omHourly?.temperature_2m || [];
  if (!times.length || !temps.length) return;

  // Build a map of ISO hour string -> OM temp
  const omTempByHour = {};
  times.forEach((t, i) => {
    // OM times are like "2026-03-07T14:00" — use as key
    omTempByHour[t] = temps[i];
  });

  const cards = document.querySelectorAll('#hourlyTrack .hour-card');
  cards.forEach(card => {
    // Each card's data-time attribute holds the NWS startTime ISO string
    const iso = card.dataset.time;
    if (!iso) return;
    // Truncate to hour to match OM key: "2026-03-07T14:00"
    const hourKey = iso.slice(0, 16);
    const omTemp = omTempByHour[hourKey];
    if (omTemp == null) return;
    const tempEl = card.querySelector('.hc-temp');
    if (tempEl) tempEl.textContent = Math.round(omTemp) + '°';
  });
}

// ── RENDER AQI INTO FORECAST TAB ─────────────────
let _aqiCache = null; // persist last result so slot can repaint instantly on refresh

// ── RANGE BAR ─────────────────────────────────────
// Renders a full-width gradient track with a white dot indicator.
// value    : current numeric value
// max      : right-edge value (scale max)
// gradient : CSS gradient string for the track
function rangeBar(value, max, gradient) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return `<div class="range-bar-wrap">
    <div class="range-bar-track" style="background:${gradient}">
      <div class="range-bar-dot" style="left:${pct}%"></div>
    </div>
  </div>`;
}

// ── GRADIENT COLOR SAMPLER ────────────────────────
// Returns an interpolated hex color at position pct (0–1) along the
// same color stops used in the range bar gradients.
function gradientColor(pct) {
  pct = Math.min(1, Math.max(0, pct));
  // Stops: green → lime → yellow → orange → red → pink → purple
  const stops = [
    [0,    [74,  222, 128]],   // #4ade80 green
    [0.18, [163, 230,  53]],   // #a3e635 lime
    [0.36, [251, 191,  36]],   // #fbbf24 yellow
    [0.55, [251, 146,  60]],   // #fb923c orange
    [0.73, [248, 113, 113]],   // #f87171 red
    [1.0,  [192, 132, 252]],   // #c084fc purple
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (pct >= stops[i][0] && pct <= stops[i+1][0]) { lo = stops[i]; hi = stops[i+1]; break; }
  }
  const t = lo[0] === hi[0] ? 0 : (pct - lo[0]) / (hi[0] - lo[0]);
  const r = Math.round(lo[1][0] + t * (hi[1][0] - lo[1][0]));
  const g = Math.round(lo[1][1] + t * (hi[1][1] - lo[1][1]));
  const b = Math.round(lo[1][2] + t * (hi[1][2] - lo[1][2]));
  return { hex: `rgb(${r},${g},${b})`, bg: `rgba(${r},${g},${b},0.12)`, border: `rgba(${r},${g},${b},0.35)` };
}

function aqiHTML(aq) {
  const _aqiC  = gradientColor(Math.min(aq.aqi, 300) / 300);
  const aqiColor = _aqiC.hex;
  const aqiBg    = _aqiC.bg;
  const aqiBorder = _aqiC.border;
  const pollCells = aq.pollutants.slice(0, 3).map(p => {
    const pc = gradientColor(Math.min(p.aqi, 300) / 300);
    return `<div class="aqi-cell">
      <span class="aqi-cell-lbl">${p.name}</span>
      <span class="aqi-cell-val" style="color:${pc.hex}">${p.aqi}</span>
      <span class="aqi-cell-sub">${p.category}</span>
    </div>`;
  }).join('');
  const padCells = aq.pollutants.length < 3
    ? Array(3 - aq.pollutants.length).fill('<div class="aqi-cell"></div>').join('') : '';
  return `
    <div class="aqi-section-ttl">Air Quality</div>
    <div class="aqi-card">
      <div class="aqi-header">
        <div class="aqi-icon-wrap" style="background:${aqiBg};border-color:${aqiBorder}">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="${aqiColor}" viewBox="0 0 16 16">
            <path d="M12.5 2A2.5 2.5 0 0 0 10 4.5a.5.5 0 0 1-1 0A3.5 3.5 0 1 1 12.5 8H.5a.5.5 0 0 1 0-1h12a2.5 2.5 0 0 0 0-5m-7 1a1 1 0 0 0-1 1 .5.5 0 0 1-1 0 2 2 0 1 1 2 2h-5a.5.5 0 0 1 0-1h5a1 1 0 0 0 0-2M0 9.5A.5.5 0 0 1 .5 9h10.042a3 3 0 1 1-3 3 .5.5 0 0 1 1 0 2 2 0 1 0 2-2H.5a.5.5 0 0 1-.5-.5"/>
          </svg>
        </div>
        <div class="aqi-info">
          <div class="aqi-area">Open-Meteo · US AQI</div>
        </div>
        <div class="aqi-badge" style="background:${aqiBg};color:${aqiColor};border:1px solid ${aqiBorder}">${aq.category}</div>
        <div class="aqi-score" style="color:${aqiColor}">${aq.aqi}</div>
      </div>
      ${rangeBar(aq.aqi, 300, 'linear-gradient(to right, #4ade80 0%, #a3e635 12%, #fbbf24 25%, #fb923c 40%, #f87171 55%, #c084fc 75%, #7c3aed 100%)')}
      <div class="aqi-cells">${pollCells}${padCells}</div>
    </div>`;
}

async function renderAQISlot(lat, lon) {
  // Paint cache first (already done by renderForecast, but safe to repeat)
  const paintSlot = (aq) => {
    const slot = document.getElementById('aqiSlot');
    if (slot) slot.innerHTML = aqiHTML(aq);
  };
  if (_aqiCache) paintSlot(_aqiCache);
  try {
    const aq = await fetchAQI(lat, lon);
    if (!aq) return;
    _aqiCache = aq;
    paintSlot(aq); // only update when real data arrives — no blank flash
  } catch(e) { console.warn('AQI slot error:', e); }
}

// ── RENDER UV INDEX INTO FORECAST TAB ────────────
// UV data comes from Open-Meteo current block (already fetched in fetchOpenMeteo).
// We cache it in window._uvData when OM runs, then renderUVSlot reads it.
function renderUVSlot() {
  const slot = document.getElementById('uvSlot');
  if (!slot) return;
  const uv = window._uvData;
  if (uv == null) return;

  const uvRounded = Math.round(uv * 10) / 10;
  // UV index categories (WHO scale)
  const uvCat    = uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very High' : 'Extreme';
  const uvCatNum = uv < 3 ? 1     : uv < 6 ? 2           : uv < 8 ? 3      : uv < 11 ? 4            : 5;
  const _uvC    = gradientColor(Math.min(uv, 11) / 11);
  const uvColor  = _uvC.hex;
  const uvBg     = _uvC.bg;
  const uvBorder = _uvC.border;

  // Protection advice by category
  const advice   = uv < 3 ? 'No protection needed' : uv < 6 ? 'Wear sunscreen SPF 30+' : uv < 8 ? 'Seek shade midday' : uv < 11 ? 'Minimize sun 10am–4pm' : 'Avoid sun exposure';
  // Exposure time to burn for fair skin (approximate)
  const burnMins = uv <= 0 ? '∞' : uv < 3 ? '60+ min' : uv < 6 ? '30–45 min' : uv < 8 ? '15–25 min' : uv < 11 ? '10–15 min' : '<10 min';

  slot.innerHTML = `
    <div class="aqi-section-ttl">UV Index</div>
    <div class="uv-card">
      <div class="uv-header">
        <div class="uv-icon-wrap" style="background:${uvBg};border:1.5px solid ${uvBorder}">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="${uvColor}" viewBox="0 0 16 16">
            <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
          </svg>
        </div>
        <div class="uv-info">
          <div class="uv-area">Open-Meteo · WHO Scale</div>
        </div>
        <div class="uv-badge" style="background:${uvBg};color:${uvColor};border:1px solid ${uvBorder}">${uvCat}</div>
        <div class="uv-score" style="color:${uvColor}">${uvRounded}</div>
      </div>
      ${rangeBar(uv, 11, 'linear-gradient(to right, #4ade80 0%, #a3e635 18%, #fbbf24 36%, #fb923c 55%, #f87171 73%, #c084fc 100%)')}
      <div class="uv-cells">
        <div class="uv-cell">
          <span class="uv-cell-lbl">Index</span>
          <span class="uv-cell-val" style="color:${uvColor}">${uvRounded}</span>
          <span class="uv-cell-sub">${uvCat}</span>
        </div>
        <div class="uv-cell">
          <span class="uv-cell-lbl">Burn Time</span>
          <span class="uv-cell-val" style="font-size:14px;padding-top:4px">${burnMins}</span>
          <span class="uv-cell-sub">fair skin</span>
        </div>
        <div class="uv-cell">
          <span class="uv-cell-lbl">Advice</span>
          <span class="uv-cell-val" style="font-size:11px;line-height:1.3;padding-top:2px;color:var(--dim)">${advice}</span>
          <span class="uv-cell-sub">&nbsp;</span>
        </div>
      </div>
    </div>`;
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
    return `<div class="hour-card" data-time="${p.startTime}">
      <span class="hc-time">${hr}</span>
      <span class="hc-icon">${wxIcon(p.shortForecast)}</span>
      <span class="hc-label">${wxLabel(p.shortForecast)}</span>
      <span class="hc-temp ${tempClass(p.temperature)}">${p.temperature}°</span>
      ${precip != null ? `<span class="hc-precip">${precip}%</span>` : ''}
      <span class="hc-wind">${windMax}mph</span>
    </div>`;
  }).join('');
  // If OM hourly data already arrived, patch temps immediately
  if (typeof omData !== 'undefined' && omData?.hourly) patchHourlyTemps(omData.hourly);
  // Repaint UV slot if data already available
  if (typeof renderUVSlot === 'function') renderUVSlot();
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
    // NWS obs provides station-level detail fields only.
    // Open-Meteo owns obsTemp, the hero temp, and feels-like — it is spatially accurate and never stale.
    // NWS obs station can be 20-40 mi away and report an hour behind, so we never use it for temp display.
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
// ── RIVER GAUGES (USGS) ───────────────────────────
async function fetchRiverGauges(lat, lon) {
  const pad = 0.5; // ~35 mile radius
  const bbox = `${(lon-pad).toFixed(4)},${(lat-pad).toFixed(4)},${(lon+pad).toFixed(4)},${(lat+pad).toFixed(4)}`;
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00065&siteType=ST&siteStatus=active`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('USGS ' + r.status);
  const data = await r.json();
  const series = data?.value?.timeSeries || [];
  if (!series.length) return null;

  // Calculate distance for each site, keep nearest 3
  const sites = series.map(ts => {
    const siteInfo = ts.sourceInfo || {};
    const geo = siteInfo.geoLocation?.geogLocation || {};
    const slat = parseFloat(geo.latitude);
    const slon = parseFloat(geo.longitude);
    const dist = (isNaN(slat)||isNaN(slon)) ? 9999 :
      Math.round(Math.sqrt(Math.pow((slat-lat)*69,2) + Math.pow((slon-lon)*54.6,2)));
    const vals = ts.values?.[0]?.value || [];
    const latest = vals[vals.length - 1];
    const prev   = vals.length > 1 ? vals[vals.length - 4] : null; // ~1hr ago
    const gage   = latest ? parseFloat(latest.value) : null;
    const prevGage = prev ? parseFloat(prev.value) : null;
    let trend = 'steady', trendClass = 'gauge-trend-steady', trendArrow = '→';
    if (gage != null && prevGage != null) {
      const delta = gage - prevGage;
      if (delta > 0.1)       { trend = 'Rising';  trendClass = 'gauge-trend-up';    trendArrow = '↑'; }
      else if (delta < -0.1) { trend = 'Falling'; trendClass = 'gauge-trend-down';  trendArrow = '↓'; }
      else                   { trend = 'Steady';  trendClass = 'gauge-trend-steady'; trendArrow = '→'; }
    }
    // Flood stage thresholds from variable description if available
    const varDesc = (ts.variable?.variableDescription || '').toLowerCase();
    const siteName = (siteInfo.siteName || 'Unknown Gauge')
      .replace(/,?\s*(at|near|above|below)\s+/i, ' @ ')
      .replace(/\s+/g, ' ').trim();
    return { siteName, dist, gage, trend, trendClass, trendArrow, slat, slon, siteCode: siteInfo.siteCode?.[0]?.value };
  }).filter(s => s.gage != null && s.dist < 9999)
    .sort((a,b) => a.dist - b.dist)
    .slice(0, 3);

  if (!sites.length) return null;
  return sites;
}

// ── HURRICANE TRACKING (NHC ArcGIS) ──────────────
async function fetchHurricanes() {
  // Query Forecast Points for all Atlantic storm slots (AT1-AT5)
  // Layer 6=AT1, 32=AT2, 58=AT3, 84=AT4, 110=AT5 Forecast Points
  const BASE = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer';
  const forecastPointLayers = [6, 32, 58, 84, 110]; // AT1-AT5 Forecast Points
  const coneLayers          = [8, 34, 60, 86, 112]; // AT1-AT5 Forecast Cone
  const storms = [];

  await Promise.all(forecastPointLayers.map(async (layerId, idx) => {
    try {
      const url = `${BASE}/${layerId}/query?where=1%3D1&outFields=*&f=geojson`;
      const r = await fetch(url);
      if (!r.ok) return;
      const data = await r.json();
      const features = data.features || [];
      if (!features.length) return;

      // Get current position (FORECAST_HOUR = 0 or first point)
      const current = features.find(f => (f.properties.FORECAST_HOUR || f.properties.TAU) === 0)
                   || features[0];
      const props = current.properties;
      const name     = props.STORMNAME || props.STORM_NAME || props.NAME || 'Unknown';
      const type     = props.STORMTYPE || props.STORM_TYPE || props.SSNUM || '';
      const winds    = props.MAXWIND   || props.MAX_WIND   || props.INTENSITY || '—';
      const pressure = props.MSLP      || props.MINP       || props.PRESSURE  || '—';

      // Get 120hr forecast point for movement
      const far = features.find(f => (f.properties.FORECAST_HOUR || f.properties.TAU) === 120)
               || features[features.length - 1];
      const farProps = far?.properties || {};
      const movement = props.MOVEDIR ? `${props.MOVEDIR} @ ${props.MOVESPD || '?'} mph` : '—';

      // Fetch cone polygon to check if user is inside
      let coneGeoJson = null;
      try {
        const coneUrl = `${BASE}/${coneLayers[idx]}/query?where=1%3D1&outFields=*&f=geojson`;
        const cr = await fetch(coneUrl);
        if (cr.ok) coneGeoJson = await cr.json();
      } catch(e) {}

      storms.push({ name, type, winds, pressure, movement, coneGeoJson, layerIdx: idx });
    } catch(e) {}
  }));

  return storms.filter(s => s.name && s.name !== 'Unknown');
}

// Helper: point-in-polygon (ray casting)
function pointInPolygon(lat, lon, geojson) {
  if (!geojson?.features?.length) return false;
  for (const feat of geojson.features) {
    const geom = feat.geometry;
    if (!geom) continue;
    const polys = geom.type === 'Polygon' ? [geom.coordinates]
                : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    for (const poly of polys) {
      const ring = poly[0];
      if (!ring) continue;
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi))
          inside = !inside;
      }
      if (inside) return true;
    }
  }
  return false;
}

// ── AIR QUALITY INDEX (Open-Meteo Air Quality API) ───
// Free, no key, CORS-enabled. Uses the US AQI standard.
async function fetchAQI(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: 'us_aqi,us_aqi_pm2_5,us_aqi_pm10,us_aqi_ozone,us_aqi_nitrogen_dioxide,us_aqi_carbon_monoxide',
    timezone: 'auto'
  });
  const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
  if (!r.ok) throw new Error('OM AQ ' + r.status);
  const data = await r.json();
  const c = data.current;
  if (!c || c.us_aqi == null) return null;

  const aqi = Math.round(c.us_aqi);

  // Map US AQI value to category name and number (1-6 matching AirNow scale)
  const catNum = aqi <= 50 ? 1 : aqi <= 100 ? 2 : aqi <= 150 ? 3 : aqi <= 200 ? 4 : aqi <= 300 ? 5 : 6;
  const catName = ['Good','Moderate','Unhealthy for Sensitive Groups','Unhealthy','Very Unhealthy','Hazardous'][catNum - 1];

  // Build pollutant breakdown — only include ones with data
  const pollutants = [
    { name: 'PM2.5',  aqi: c.us_aqi_pm2_5 != null ? Math.round(c.us_aqi_pm2_5) : null },
    { name: 'PM10',   aqi: c.us_aqi_pm10 != null ? Math.round(c.us_aqi_pm10) : null },
    { name: 'Ozone',  aqi: c.us_aqi_ozone != null ? Math.round(c.us_aqi_ozone) : null },
    { name: 'NO₂',   aqi: c.us_aqi_nitrogen_dioxide != null ? Math.round(c.us_aqi_nitrogen_dioxide) : null },
    { name: 'CO',     aqi: c.us_aqi_carbon_monoxide != null ? Math.round(c.us_aqi_carbon_monoxide) : null },
  ].filter(p => p.aqi != null)
   .sort((a, b) => b.aqi - a.aqi)
   .map(p => {
     const pCatNum = p.aqi <= 50 ? 1 : p.aqi <= 100 ? 2 : p.aqi <= 150 ? 3 : p.aqi <= 200 ? 4 : p.aqi <= 300 ? 5 : 6;
     return { ...p, category: ['Good','Moderate','Unhealthy for Sensitive Groups','Unhealthy','Very Unhealthy','Hazardous'][pCatNum - 1] };
   });

  const dominant = pollutants[0]?.name || '—';

  return { aqi, category: catName, categoryNum: catNum, dominant, reportingArea: 'Open-Meteo', stateCode: '', pollutants };
}


async function fetchNearby(lat, lon, stationsUrl) {
  const box = document.getElementById('panelNearby');
  box.innerHTML = `<div class="state-center"><div class="spinner"></div><div class="state-sub" style="margin-top:10px">Loading nearby data…</div></div>`;

  const sections = [];

  // ── 0. Nearest NOAA Weather Radio station ──
  try {
    if (lat && lon) {
      let nearest = null, nearestDist = Infinity;
      for (const s of NWR_STATIONS) {
        const dist = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lon - lon, 2));
        if (dist < nearestDist) { nearestDist = dist; nearest = s; }
      }
      if (nearest) {
        const miles = Math.round(Math.sqrt(Math.pow((nearest.lat-lat)*69,2) + Math.pow((nearest.lon-lon)*54,2)));
        const sid = `nwr-${nearest.call}`;
        sections.push(`
          <div class="section-ttl">NOAA Weather Radio</div>
          <div class="nwr-card" id="nwrCard-${nearest.call}">
            <audio id="nwr-audio-${nearest.call}" preload="none" style="display:none"></audio>
            <div class="nwr-top">
              <div class="nwr-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="2" fill="var(--blue)" stroke="none"/>
                  <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 7.76a6 6 0 0 0 0 8.49"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
              </div>
              <div class="nwr-info">
                <div class="nwr-name">${nearest.city}, ${nearest.st}</div>
                <div class="nwr-meta">${nearest.call} &nbsp;·&nbsp; ${nearest.freq.toFixed(3)} MHz &nbsp;·&nbsp; ${miles} mi away</div>
              </div>
              <button class="nwr-play-btn" id="${sid}" onclick="nwrToggle('${nearest.call}','${nearest.url.replace(/'/g,"\\'")}',this)" aria-label="Play weather radio">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" class="nwr-play-icon"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/></svg>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" class="nwr-stop-icon" style="display:none"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/></svg>
              </button>
            </div>
            <div class="nwr-status" id="nwr-status-${nearest.call}">Tap to listen live</div>
            <div class="nwr-disclaimer">⚠ Do not rely on internet streams for life-safety alerts. Use a dedicated NOAA weather radio receiver.</div>
          </div>`);
      }
    }
  } catch(e) { console.warn('NWR error:', e); }

  // ── 1. River Gauges (USGS) ──
  try {
    if (lat && lon) {
      const gauges = await fetchRiverGauges(lat, lon);
      if (gauges && gauges.length) {
        const cards = gauges.map(g => {
          const floodColor = g.gage > 20 ? 'var(--red)' : g.gage > 12 ? 'var(--orange)' : g.gage > 8 ? 'var(--yellow)' : 'var(--blue)';
          const floodLabel = g.gage > 20 ? 'FLOOD' : g.gage > 12 ? 'WATCH' : g.gage > 8 ? 'ELEVATED' : 'NORMAL';
          const badgeBg = g.gage > 20 ? 'rgba(248,113,113,.15)' : g.gage > 12 ? 'rgba(251,146,60,.15)' : g.gage > 8 ? 'rgba(251,191,36,.12)' : 'rgba(147,197,253,.1)';
          return `
          <div class="gauge-card">
            <div class="gauge-header">
              <div class="gauge-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="var(--blue)" viewBox="0 0 16 16">
                  <path d="M.036 3.314a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0L.314 3.964a.5.5 0 0 1-.278-.65m0 3a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0L.314 6.964a.5.5 0 0 1-.278-.65m0 3a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0L.314 9.964a.5.5 0 0 1-.278-.65m0 3a.5.5 0 0 1 .65-.278l1.757.703a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.014-.406a2.5 2.5 0 0 1 1.857 0l1.015.406a1.5 1.5 0 0 0 1.114 0l1.757-.703a.5.5 0 1 1 .372.928l-1.758.703a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.014-.406a1.5 1.5 0 0 0-1.114 0l-1.015.406a2.5 2.5 0 0 1-1.857 0l-1.757-.703a.5.5 0 0 1-.278-.65"/>
                </svg>
              </div>
              <div class="gauge-info">
                <div class="gauge-name">${g.siteName}</div>
                <div class="gauge-meta">USGS · ${g.dist} mi away · Stream Gauge</div>
              </div>
              <div class="gauge-badge" style="background:${badgeBg};color:${floodColor};border:1px solid ${floodColor}33">${floodLabel}</div>
            </div>
            <div class="gauge-readings">
              <div class="gauge-cell">
                <span class="gauge-cell-lbl">Gage Ht</span>
                <span class="gauge-cell-val" style="color:${floodColor}">${g.gage.toFixed(2)}<span style="font-size:10px;color:var(--dim)"> ft</span></span>
                <span class="gauge-cell-sub">above datum</span>
              </div>
              <div class="gauge-cell">
                <span class="gauge-cell-lbl">Trend</span>
                <span class="gauge-cell-val ${g.trendClass}" style="font-size:22px">${g.trendArrow}</span>
                <span class="gauge-cell-sub">${g.trend}</span>
              </div>
              <div class="gauge-cell">
                <span class="gauge-cell-lbl">Distance</span>
                <span class="gauge-cell-val">${g.dist}<span style="font-size:10px;color:var(--dim)"> mi</span></span>
                <span class="gauge-cell-sub">from you</span>
              </div>
            </div>
          </div>`;
        }).join('');
        sections.push(`<div class="section-ttl">River Gauges</div>${cards}`);
      }
    }
  } catch(e) { console.warn('River gauges error:', e); }

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

  // ── 2b. Hurricane Tracking (NHC) ──
  try {
    if (lat && lon) {
      const storms = await fetchHurricanes();
      if (storms && storms.length) {
        const cards = storms.map(s => {
          const inCone = pointInPolygon(lat, lon, s.coneGeoJson);
          const typeLabel = (s.type || '').toString();
          const cat = parseInt(typeLabel);
          const stormLabel = !isNaN(cat) && cat >= 1 ? `Category ${cat} Hurricane`
            : typeLabel.toLowerCase().includes('ts') ? 'Tropical Storm'
            : typeLabel.toLowerCase().includes('td') ? 'Tropical Depression'
            : 'Tropical Cyclone';
          return `
          <div class="hurr-card">
            <div class="hurr-header">
              <div class="hurr-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8a4 4 0 1 0 4 4"/><path d="M12 2v2M2 12h2"/>
                </svg>
              </div>
              <div class="hurr-info">
                <div class="hurr-name">${s.name}</div>
                <div class="hurr-type">${stormLabel} · NHC Active Advisory</div>
              </div>
              ${inCone ? '<div class="hurr-badge">IN CONE</div>' : ''}
            </div>
            <div class="hurr-details">
              <div class="hurr-cell">
                <span class="hurr-cell-lbl">Max Winds</span>
                <span class="hurr-cell-val" style="color:var(--orange)">${s.winds}<span style="font-size:10px;color:var(--dim)"> kt</span></span>
              </div>
              <div class="hurr-cell">
                <span class="hurr-cell-lbl">Pressure</span>
                <span class="hurr-cell-val">${s.pressure}<span style="font-size:10px;color:var(--dim)"> mb</span></span>
              </div>
              <div class="hurr-cell">
                <span class="hurr-cell-lbl">Movement</span>
                <span class="hurr-cell-val" style="font-size:11px">${s.movement}</span>
              </div>
            </div>
            ${inCone ? '<div class="hurr-threat"><svg width="12" height="12" viewBox="0 0 16 16" fill="var(--orange)"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-3.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5m0 6a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5"/></svg> Your location is within the forecast cone</div>' : ''}
          </div>`;
        }).join('');
        sections.push(`<div class="section-ttl">Active Tropical Storms</div>${cards}`);
      }
    }
  } catch(e) { console.warn('Hurricane fetch error:', e); }

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
      const geoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="${countColor}" viewBox="0 0 16 16"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/></svg>`;
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
// ── RADAR (RainViewer) ────────────────────────────
let rvMap = null, rvFrames = [], rvLayers = [], rvPos = 0, rvTimer = null, rvPlaying = false, rvInited = false;

function initRadar(lat, lon) {
  const panel = document.getElementById('panelRadar');

  // Build map container if not yet created
  if (!rvInited) {
    panel.innerHTML = `
      <div id="radarMap"></div>
      <div class="radar-bar">
        <button class="radar-play-btn" id="rvPlayBtn">
          <svg id="rvPlayIcon" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M10.804 8 5 4.633v6.734zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696z"/>
          </svg>
        </button>
        <div class="radar-timeline" id="rvTimeline">
          <div class="radar-timeline-fill" id="rvFill" style="width:0%"></div>
        </div>
        <span class="radar-timestamp" id="rvTimestamp">Loading…</span>
      </div>`;

    window.addEventListener('resize', () => { if (rvMap) rvMap.invalidateSize(); });

    // Init Leaflet map
    rvMap = L.map('radarMap', {
      center: [lat, lon],
      zoom: 8,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    // Dark base map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxNativeZoom: 19,
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(rvMap);

    // Location marker
    L.circleMarker([lat, lon], {
      radius: 6, color: '#fbbf24', fillColor: '#fbbf24',
      fillOpacity: 1, weight: 2
    }).addTo(rvMap);

    // Play/pause button
    document.getElementById('rvPlayBtn').addEventListener('click', rvTogglePlay);

    // Timeline scrub
    document.getElementById('rvTimeline').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      rvStop();
      rvShowFrame(Math.round(pct * (rvFrames.length - 1)));
    });

    rvInited = true;
  } else {
    // Already inited — just re-center
    rvMap.setView([lat, lon], 8);
    document.querySelector('.leaflet-marker-pane')?.querySelectorAll('*').forEach(e => e.remove());
    L.circleMarker([lat, lon], {
      radius: 6, color: '#fbbf24', fillColor: '#fbbf24',
      fillOpacity: 1, weight: 2
    }).addTo(rvMap);
  }

  rvLoadFrames();
}

async function rvLoadFrames() {
  try {
    document.getElementById('rvTimestamp').textContent = 'Loading…';

    // IEM provides 11 frames: t-50min to now, in 5-min steps
    const offsets = ['m50m','m45m','m40m','m35m','m30m','m25m','m20m','m15m','m10m','m05m','0'];
    const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913';

    // Build frame objects with approximate wall-clock labels
    const now = new Date();
    rvFrames = offsets.map((token, i) => {
      const minsAgo = (offsets.length - 1 - i) * 5;
      const t = new Date(now.getTime() - minsAgo * 60000);
      const h = t.getHours(), m = t.getMinutes();
      const label = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
      return { token, label };
    });

    // Clear old layers
    rvLayers.forEach(l => { if (rvMap.hasLayer(l)) rvMap.removeLayer(l); });
    rvLayers = [];

    // Pre-create tile layers (hidden) — IEM has no zoom cap
    rvFrames.forEach((frame, i) => {
      // Latest frame uses no offset suffix
      const suffix = frame.token === '0' ? '' : `-${frame.token}`;
      const url = `${IEM}${suffix}/{z}/{x}/{y}.png`;
      const layer = L.tileLayer(url, { opacity: 0, tileSize: 256 });
      rvLayers.push(layer);
      layer.addTo(rvMap);
    });

    rvPos = rvFrames.length - 1;
    rvShowFrame(rvPos);


    rvPlay();

    // Refresh every 5 min to pull newest frame
    setTimeout(rvLoadFrames, 5 * 60 * 1000);
  } catch(e) {
    console.warn('IEM radar error:', e);
    if (document.getElementById('rvTimestamp')) document.getElementById('rvTimestamp').textContent = 'Error';
  }
}

function rvShowFrame(idx) {
  if (!rvFrames.length) return;
  idx = Math.max(0, Math.min(rvFrames.length - 1, idx));
  // Hide all, show current
  rvLayers.forEach((l, i) => l.setOpacity(i === idx ? 0.65 : 0));
  rvPos = idx;
  // Timestamp — IEM frames carry a pre-computed label
  if (document.getElementById('rvTimestamp')) document.getElementById('rvTimestamp').textContent = rvFrames[idx].label;
  // Timeline fill
  const pct = rvFrames.length > 1 ? (idx / (rvFrames.length - 1)) * 100 : 100;
  if (document.getElementById('rvFill')) document.getElementById('rvFill').style.width = pct + '%';
}

function rvPlay() {
  rvPlaying = true;
  rvUpdatePlayIcon();
  rvTimer = setInterval(() => {
    const next = (rvPos + 1) % rvFrames.length;
    rvShowFrame(next);
  }, 600);
}

function rvStop() {
  rvPlaying = false;
  rvUpdatePlayIcon();
  clearInterval(rvTimer);
  rvTimer = null;
}

function rvTogglePlay() {
  if (rvPlaying) rvStop(); else rvPlay();
}

function rvUpdatePlayIcon() {
  const btn = document.getElementById('rvPlayIcon');
  if (!btn) return;
  if (rvPlaying) {
    // Pause icon
    btn.innerHTML = '<path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/>';
  } else {
    // Play icon
    btn.innerHTML = '<path d="M10.804 8 5 4.633v6.734zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696z"/>';
  }
}

function isRadarTabActive() {
  return document.getElementById('tabRadar')?.classList.contains('on');
}

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
        'temperature_2m','cape','lifted_index','convective_inhibition',
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

    // Patch hourly card temps now if cards already exist; otherwise they'll be patched when rendered
    if (data.hourly) {
      patchHourlyTemps(data.hourly);
      window._omHourly = data.hourly; // cache for wind modal sparkline
    }

    // Enrich obs strip with Open-Meteo data (fills gaps NWS doesn't cover)
    const set = (id, val) => { if (val != null && document.getElementById(id)) document.getElementById(id).textContent = val; };

    // Feels like
    if (c.apparent_temperature != null) set('obsFeels', Math.round(c.apparent_temperature));

    // Wind gust
    if (c.wind_gusts_10m != null) set('obsGust', Math.round(c.wind_gusts_10m));

    // Store wind data for Wind modal
    window._windData = {
      speed:     c.wind_speed_10m   != null ? Math.round(c.wind_speed_10m)   : null,
      gust:      c.wind_gusts_10m   != null ? Math.round(c.wind_gusts_10m)   : null,
      direction: c.wind_direction_10m != null ? Math.round(c.wind_direction_10m) : null,
    };

    // UV index
    if (c.uv_index != null) {
      set('obsUV', c.uv_index.toFixed(1));
      window._uvData = c.uv_index;
      renderUVSlot();
    }

    // Cloud cover %
    if (c.cloud_cover != null) set('obsCloud', c.cloud_cover);

    // Fill humid/dew from OM if NWS obs hasn't populated them yet
    if (document.getElementById('obsHumid').textContent === '—' && c.relative_humidity_2m != null)
      set('obsHumid', Math.round(c.relative_humidity_2m));
    if (document.getElementById('obsDew').textContent === '—' && c.dew_point_2m != null)
      set('obsDew', Math.round(c.dew_point_2m));
    if (document.getElementById('obsWind').textContent === '—' && c.wind_speed_10m != null)
      set('obsWind', Math.round(c.wind_speed_10m));

    document.getElementById('obsStrip').classList.add('show');

    // Open-Meteo owns the hero temp — it is spatially accurate and up-to-the-hour.
    // NWS obs stations can be miles away and report stale readings; they do not set the hero.
    const tempEl = document.querySelector('.fch-temp');
    if (tempEl) {
      if (c?.temperature_2m != null) {
        tempEl.innerHTML = `${Math.round(c.temperature_2m)}<sup>°F</sup>`;
        set('obsTemp', Math.round(c.temperature_2m));
      } else if (window._nwsHeroTemp) {
        tempEl.innerHTML = `${window._nwsHeroTemp}<sup>°F</sup>`;
      }
    }
    // Insert feels-like line if not already present
    if (c?.apparent_temperature != null) {
      let feelsEl = document.querySelector('.fch-feels');
      if (!feelsEl) {
        feelsEl = document.createElement('div');
        feelsEl.className = 'fch-feels';
        tempEl?.insertAdjacentElement('afterend', feelsEl);
      }
      feelsEl.textContent = `Feels like ${Math.round(c.apparent_temperature)}°`;
    }
  } catch(e) {
    console.warn('Open-Meteo error:', e);
    // Fallback: fill hero with NWS forecast temp if OM failed
    const tempEl = document.querySelector('.fch-temp');
    if (tempEl && tempEl.textContent.includes('—') && window._nwsHeroTemp) {
      tempEl.innerHTML = `${window._nwsHeroTemp}<sup>°F</sup>`;
    }
  }
}

async function fetchForPoint(lat, lon) {
  const [fc] = await Promise.all([
    fetchForecast(lat, lon),
    fetchAlerts(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`),
    fetchOpenMeteo(lat, lon)
  ]);
  const { periods, stationUrl } = fc;
  await Promise.all([
    fetchObservations(stationUrl),
    fetchNearby(lat, lon, stationUrl),
    renderAQISlot(lat, lon)
  ]);
  if (periods && periods.length) computeTornadoRisk(periods, lat, lon, allAlerts);

  // If radar tab is already visible when location updates, init or re-center
  if (isRadarTabActive()) {
    if (!rvInited) {
      initRadar(lat, lon);
    } else if (rvMap) {
      rvMap.setView([lat, lon], 8);
      setTimeout(() => rvMap.invalidateSize(), 60);
    }
  }
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

// ── NOAA Weather Radio player ──────────────────────────────────────────────
let nwrActiveCall = null;

function nwrToggle(callsign, url, btn) {
  const statusEl = document.getElementById(`nwr-status-${callsign}`);
  const audioEl  = document.getElementById(`nwr-audio-${callsign}`);
  const playIcon = btn.querySelector('.nwr-play-icon');
  const stopIcon = btn.querySelector('.nwr-stop-icon');

  if (!audioEl) return;

  // If already playing this station — stop
  if (nwrActiveCall === callsign && !audioEl.paused) {
    audioEl.pause();
    audioEl.src = '';
    nwrActiveCall = null;
    playIcon.style.display = '';
    stopIcon.style.display = 'none';
    btn.classList.remove('playing', 'loading');
    if (statusEl) statusEl.textContent = 'Tap to listen live';
    return;
  }

  // Stop any previously active station
  if (nwrActiveCall && nwrActiveCall !== callsign) {
    const prevAudio = document.getElementById(`nwr-audio-${nwrActiveCall}`);
    if (prevAudio) { prevAudio.pause(); prevAudio.src = ''; }
    const prevBtn = document.getElementById(`nwr-${nwrActiveCall}`);
    if (prevBtn) {
      prevBtn.querySelector('.nwr-play-icon').style.display = '';
      prevBtn.querySelector('.nwr-stop-icon').style.display = 'none';
      prevBtn.classList.remove('playing', 'loading');
    }
    const prevStatus = document.getElementById(`nwr-status-${nwrActiveCall}`);
    if (prevStatus) prevStatus.textContent = 'Tap to listen live';
  }

  // Set up and play
  btn.classList.add('loading');
  if (statusEl) statusEl.textContent = 'Connecting…';
  nwrActiveCall = callsign;

  // Remove old listeners by replacing with clone
  const fresh = audioEl.cloneNode(false);
  audioEl.parentNode.replaceChild(fresh, audioEl);
  const a = document.getElementById(`nwr-audio-${callsign}`);

  a.addEventListener('playing', () => {
    btn.classList.remove('loading');
    btn.classList.add('playing');
    playIcon.style.display = 'none';
    stopIcon.style.display = '';
    if (statusEl) statusEl.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8" style="margin-right:5px;vertical-align:middle;flex-shrink:0"><circle cx="4" cy="4" r="4" fill="#ef4444"/></svg>LIVE — Broadcasting';
  }, {once: true});

  a.addEventListener('error', () => {
    btn.classList.remove('loading', 'playing');
    playIcon.style.display = '';
    stopIcon.style.display = 'none';
    nwrActiveCall = null;
    if (statusEl) statusEl.textContent = '⚠ Stream unavailable — try again later';
  }, {once: true});

  a.addEventListener('stalled', () => {
    if (statusEl && nwrActiveCall === callsign) statusEl.textContent = 'Buffering…';
  });

  a.src = url;
  a.load();
  const playPromise = a.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn('NWR play error:', err);
      btn.classList.remove('loading');
      if (statusEl) statusEl.textContent = '⚠ Could not start stream';
      nwrActiveCall = null;
    });
  }
}
