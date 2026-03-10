// ── SERVICE WORKER + PUSH NOTIFICATIONS ──────────────────────────────────────
let _swReg = null;
let _seenAlertIds = new Set();
let _notifPromptShown = false;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      _swReg = await navigator.serviceWorker.register('sw.js');

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', e => {
        const msg = e.data || {};
        if (msg.type === 'SEEN_IDS_SYNC') {
          _seenAlertIds = new Set(msg.ids);
        }
        if (msg.type === 'OPEN_TAB') {
          switchTab(msg.tab || 'alerts');
        }
      });

    } catch(e) { console.warn('SW:', e); }
  });
}

// Called once we have a location — starts SW polling
function startAlertPolling(lat, lon) {
  if (!_swReg?.active) return;
  const prefs = loadSettings().alertPrefs || {};
  _swReg.active.postMessage({ type: 'START_ALERT_POLL', lat, lon, prefs });
  if (_seenAlertIds.size > 0) {
    _swReg.active.postMessage({ type: 'SEEN_IDS', ids: [..._seenAlertIds] });
  }
}

// Called when location changes
function updatePollingLocation(lat, lon) {
  const sw = _swReg?.active || _swReg?.waiting || _swReg?.installing;
  if (sw) sw.postMessage({ type: 'UPDATE_LOCATION', lat, lon });
}

// Ask for notification permission — shown when user first opens Alerts tab
async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (Notification.permission === 'denied') return;
  if (_notifPromptShown) return;
  _notifPromptShown = true;

  const banner = document.createElement('div');
  banner.id = 'notifBanner';
  banner.innerHTML = `
    <div class="notif-banner-inner">
      <div class="notif-banner-text">
        <strong>GET WARNED INSTANTLY</strong>
        <span>Enable notifications to receive alerts for tornados, severe storms, and floods.</span>
      </div>
      <div class="notif-banner-btns">
        <button class="notif-btn-yes" id="notifYes">ENABLE</button>
        <button class="notif-btn-no" id="notifNo">NOT NOW</button>
      </div>
    </div>`;
  document.getElementById('panelAlerts').prepend(banner);

  document.getElementById('notifYes').addEventListener('click', async () => {
    banner.remove();
    const result = await Notification.requestPermission();
    if (result === 'granted' && curLat) startAlertPolling(curLat, curLon);
  });
  document.getElementById('notifNo').addEventListener('click', () => {
    banner.remove();
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
// Forecast is now the default tab — hide filter row on init
document.getElementById('filterRow').style.display = 'none';
const TAB_ORDER = ['alerts','forecast','nearby','radar','tornado'];
const TAB_MAP   = {alerts:'tabAlerts', forecast:'tabForecast', nearby:'tabNearby', radar:'tabRadar', tornado:'tabTornado'};

// ── SECTION TITLE HELPER ──────────────────────────────────────────────────
// Inline SVG paths — avoids <use href> clipping/rendering issues at small sizes
const _SECTION_ICON_SVG = {
  'bi-clouds':               `<path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.476A5.5 5.5 0 0 1 4.406 3.342"/>`,
  'bi-wind':                 `<path d="M12.5 2A2.5 2.5 0 0 0 10 4.5a.5.5 0 0 1-1 0A3.5 3.5 0 1 1 12.5 8H.5a.5.5 0 0 1 0-1h12a2.5 2.5 0 0 0 0-5m-7 1a1 1 0 0 0-1 1 .5.5 0 0 1-1 0 2 2 0 1 1 2 2H.5a.5.5 0 0 1 0-1H6.5a1 1 0 0 0 0-2M0 9.5A.5.5 0 0 1 .5 9h10.042a3 3 0 1 1-3 3 .5.5 0 0 1 1 0 2 2 0 1 0 2-2H.5a.5.5 0 0 1-.5-.5"/>`,
  'bi-sun':                  `<path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>`,
  'bi-fog':                  `<path d="M4 12.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m2 2a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5M13.405 4.027a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10H13a3 3 0 0 0 .405-5.973M8.5 1a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1 0 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 1"/>`,
  'bi-broadcast':            `<path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0"/>`,
  'bi-droplet-fill':         `<path d="M8 16a6 6 0 0 0 6-6c0-1.655-1.122-2.904-2.432-4.362C10.254 4.176 8.75 2.503 8 0c0 0-6 5.686-6 10a6 6 0 0 0 6 6"/>`,
  'bi-globe':                `<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 1 .64-1.539 7 7 0 0 1 .597-.933A7.03 7.03 0 0 0 2.255 4zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.96 6.96 0 0 0-.656 2.5zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5zM8.5 5v2.5h2.99a12.5 12.5 0 0 0-.337-2.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5zM5.145 12q.208.58.468 1.068c.552 1.035 1.218 1.65 1.887 1.855V12zm.182 2.472a7 7 0 0 1-.597-.933A9.3 9.3 0 0 1 4.09 12H2.255a7.03 7.03 0 0 0 3.072 2.472M3.82 11a13.7 13.7 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5zm6.853 3.472A7.03 7.03 0 0 0 13.745 12H11.91a9.3 9.3 0 0 1-.64 1.539 7 7 0 0 1-.597.933M8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855q.26-.487.468-1.068zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.7 13.7 0 0 1-.312 2.5m2.802-3.5a6.96 6.96 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.03 7.03 0 0 0-3.072-2.472c.218.284.418.598.597.933M10.855 4a8 8 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4z"/>`,
  'bi-cloud-lightning':      `<path d="M13.405 4.027a5.001 5.001 0 0 0-9.499-1.004A3.5 3.5 0 1 0 3.5 10H13a3 3 0 0 0 .405-5.973M8.5 1a4 4 0 0 1 3.976 3.555.5.5 0 0 0 .5.445H13a2 2 0 0 1 0 4H3.5a2.5 2.5 0 1 1 .605-4.926.5.5 0 0 0 .596-.329A4 4 0 0 1 8.5 1M7.053 11.276A.5.5 0 0 1 7.5 11h2a.5.5 0 0 1 .473.664l-.334 1H11a.5.5 0 0 1 .39.812l-4 5a.5.5 0 0 1-.871-.464l.853-3.41H5.5a.5.5 0 0 1-.447-.724z"/>`,
  'bi-exclamation-triangle': `<path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/><path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>`,
  'bi-thermometer-half':     `<path d="M9.5 12.5a1.5 1.5 0 1 1-2-1.415V6.5a.5.5 0 0 1 1 0v4.585a1.5 1.5 0 0 1 1 1.415z"/><path d="M5.5 2.5a2.5 2.5 0 0 1 5 0v7.55a3.5 3.5 0 1 1-5 0zM8 1a1.5 1.5 0 0 0-1.5 1.5v7.987l-.167.15a2.5 2.5 0 1 0 3.333 0l-.166-.15V2.5A1.5 1.5 0 0 0 8 1"/>`,
  'bi-cloud-rain':           `<path d="M4.158 12.025a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 0 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 0 1-.948-.316l1-3a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-.5 1.5a.5.5 0 0 1-.948-.316l.5-1.5a.5.5 0 0 1 .632-.317m3 0a.5.5 0 0 1 .316.633l-1 3a.5.5 0 0 1-.948-.316l1-3a.5.5 0 0 1 .633-.317zM4 1a3.5 3.5 0 0 1 3.5 3.5.5.5 0 0 0 .5.5 1.5 1.5 0 0 1 1.5 1.5v.5h.5a2.5 2.5 0 0 1 0 5h-9a2.5 2.5 0 0 1 0-5H2v-.5A3.5 3.5 0 0 1 4 1z"/>`,
};
const _SECTION_ICONS = {
  'Weekly Forecast':         'bi-clouds',
  'Air Quality':             'bi-wind',
  'UV Index':                'bi-sun',
  'Wind':                    'bi-wind',
  'Conditions':              'bi-fog',
  'NOAA Weather Radio':      'bi-broadcast',
  'River Gauges':            'bi-droplet-fill',
  'Nearest Radar Station':   'bi-globe',
  'Active Tropical Storms':  'bi-cloud-lightning',
  'State Alerts':            'bi-exclamation-triangle',
  'Hourly Forecast':         'bi-thermometer-half',
  'Precipitation':             'bi-cloud-rain',
  'Beaufort Scale':          'bi-broadcast',
};
function sectionTtl(label, extraStyle = '') {
  const iconKey = _SECTION_ICONS[label] ?? 'bi-sun';
  const iconPath = _SECTION_ICON_SVG[iconKey] ?? _SECTION_ICON_SVG['bi-sun'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="opacity:.7;margin-right:5px;flex-shrink:0;text-transform:none;letter-spacing:0;overflow:visible">${iconPath}</svg>`;
  return `<div class="section-ttl" style="padding-left:2px${extraStyle ? ';' + extraStyle : ''}">${svg}${label}</div>`;
}

function switchTab(t) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('on'));
  const btn = document.querySelector(`.tab[data-tab="${t}"]`);
  if (btn) btn.classList.add('on');
  document.getElementById(TAB_MAP[t]).classList.add('on');
  document.getElementById('filterRow').style.display = t === 'alerts' ? 'flex' : 'none';
  if (t === 'alerts') requestNotifPermission();
  const bodyEl = document.getElementById('app');
  if (bodyEl) bodyEl.classList.toggle('radar-active', t === 'radar');
  if (t === 'forecast') {
    const gradTemp = window._lastGradTemp ?? window._omCurrentTemp ?? window._forecastPeriods?.[0]?.temperature;
    const gradFc   = window._lastGradFc   ?? window._forecastPeriods?.[0]?.shortForecast;
    if (gradTemp != null && gradFc && bodyEl) {
      const _acc = weatherGradient(gradTemp, gradFc, bodyEl);
      if (_acc) {
        document.documentElement.style.setProperty('--hero-accent',       `rgb(${_acc})`);
        document.documentElement.style.setProperty('--hero-accent-faint', `rgba(${_acc},0.75)`);
        document.documentElement.style.setProperty('--hero-accent-dim',   `rgba(${_acc},0.55)`);
      }
    }
    updateWxOverlay(window._lastGradFc ?? window._forecastPeriods?.[0]?.shortForecast);
  }
  if (t === 'radar') {
    if (!rvInited && curLat) {
      initRadar(curLat, curLon);
    } else if (rvMap) {
        setTimeout(() => rvMap.invalidateSize(), 60);
      }
    }
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});


// ── BODY BACKGROUND GRADIENT ─────────────────────
// Paints a 3-stop gradient on document.body based on temperature + conditions.
// Fades from accent color at top → mid tone at 55% → var(--bg) at bottom.
function weatherGradient(tempF, shortForecast, targetEl) {
  const fc = (shortForecast || '').toLowerCase();
  const isWet    = /rain|shower|storm|thunder|drizzle|sleet|snow|flurr|blizzard|precip/.test(fc);
  const isSnowy  = /snow|flurr|blizzard|sleet|ice|freezing/.test(fc);
  const isFoggy  = /fog|mist|haze/.test(fc);
  const isStormy = /thunder|storm/.test(fc);
  const isCloudy = /cloud|overcast|partly/.test(fc);

  // ── GRADIENT LOGIC ────────────────────────────────────────────────────────
  // Uses the reference mesh pattern: dark HSL base color + 3 dark anchor blobs
  // (suppress the base in spots) + 3 vivid color blobs at different positions.
  // All values are HSL. Two accent hues chosen per condition for visual drama.
  //
  //  base  = dark version of primary hue (sets overall tint of black)
  //  dark1-3 = near-black anchors at fixed positions (39%/37%, 16%/87%, 73%/24%)
  //  v1    = primary vivid blob  (position: upper-left  -40%/-20%)
  //  v2    = secondary vivid blob (position: center-low  60%/72%)
  //  v3    = accent vivid blob   (position: lower-right  93%/90%)
  //
  //  ≤25°F  ARCTIC    clear → violet / icy cyan / indigo
  //                   snowy → pale lavender / deep navy / ice blue
  //  ≤40°F  COLD      clear → electric blue / teal / cobalt
  //                   wet   → deep royal blue / dark navy / bright steel blue
  //  ≤55°F  COOL      clear → cyan / cobalt blue / teal-green
  //                   wet   → strong blue / dark indigo-blue / sky blue
  //  ≤68°F  MILD      clear → lime-green / sky blue / emerald
  //                   wet   → medium blue / very dark navy / light blue
  //  ≤80°F  WARM      clear → golden yellow / magenta / amber
  //                   wet   → deep blue / near-black navy / bright blue
  //  ≤92°F  HOT       clear → vivid orange / purple-violet / yellow
  //                   wet   → deep royal blue / dark navy / bright blue
  //                   stormy→ very dark blue / near-black navy / electric blue
  //  >92°F  SCORCHING → deep red / burnt orange / crimson
  //  FOG               → grey-green / dusty mauve / slate
  //  CLOUDY modifier   → all saturations reduced by ~40%

  // [base-hue, base-sat, base-lit, dark-sat, dark-lit, v1-hsl, v2-hsl, v3-hsl]
  let base, d, v1, v2, v3;

  if (tempF <= 25) {
    if (isSnowy) {
      base = 'hsla(230,60%,4%,1)';
      d    = 'hsla(230,60%,5%,1)';
      v1   = 'hsla(260,80%,75%,1)';   // pale lavender
      v2   = 'hsla(220,90%,35%,1)';   // deep navy
      v3   = 'hsla(200,85%,65%,1)';   // ice blue
    } else {
      base = 'hsla(270,60%,4%,1)';
      d    = 'hsla(270,60%,5%,1)';
      v1   = 'hsla(273,100%,65%,1)';  // violet
      v2   = 'hsla(190,100%,55%,1)';  // icy cyan
      v3   = 'hsla(250,85%,50%,1)';   // indigo
    }
  } else if (tempF <= 40) {
    if (isWet) {
      base = 'hsla(220,60%,4%,1)';
      d    = 'hsla(220,60%,5%,1)';
      v1   = 'hsla(215,100%,45%,1)';  // deep royal blue
      v2   = 'hsla(235,90%,25%,1)';   // dark navy
      v3   = 'hsla(205,95%,55%,1)';   // bright steel blue
    } else {
      base = 'hsla(210,60%,4%,1)';
      d    = 'hsla(210,60%,5%,1)';
      v1   = 'hsla(207,100%,58%,1)';  // electric blue
      v2   = 'hsla(165,75%,45%,1)';   // teal-green
      v3   = 'hsla(227,87%,55%,1)';   // cobalt
    }
  } else if (tempF <= 55) {
    if (isWet) {
      base = 'hsla(218,60%,4%,1)';
      d    = 'hsla(218,60%,5%,1)';
      v1   = 'hsla(212,100%,42%,1)';  // strong blue
      v2   = 'hsla(238,85%,28%,1)';   // dark indigo-blue
      v3   = 'hsla(200,90%,50%,1)';   // sky blue
    } else {
      base = 'hsla(165,55%,4%,1)';
      d    = 'hsla(165,55%,5%,1)';
      v1   = 'hsla(158,100%,50%,1)';  // cyan-green
      v2   = 'hsla(227,87%,55%,1)';   // cobalt blue
      v3   = 'hsla(175,85%,42%,1)';   // teal
    }
  } else if (tempF <= 68) {
    if (isWet) {
      base = 'hsla(215,60%,4%,1)';
      d    = 'hsla(215,60%,5%,1)';
      v1   = 'hsla(210,95%,40%,1)';   // medium blue
      v2   = 'hsla(233,88%,25%,1)';   // very dark navy
      v3   = 'hsla(198,85%,50%,1)';   // light blue
    } else {
      base = 'hsla(130,55%,4%,1)';
      d    = 'hsla(130,55%,5%,1)';
      v1   = 'hsla(104,80%,57%,1)';   // lime-green
      v2   = 'hsla(199,90%,52%,1)';   // sky blue
      v3   = 'hsla(151,100%,45%,1)';  // emerald
    }
  } else if (tempF <= 80) {
    if (isWet) {
      base = 'hsla(218,60%,4%,1)';
      d    = 'hsla(218,60%,5%,1)';
      v1   = 'hsla(214,100%,38%,1)';  // deep blue
      v2   = 'hsla(235,85%,22%,1)';   // near-black navy
      v3   = 'hsla(202,90%,52%,1)';   // bright blue
    } else {
      base = 'hsla(45,60%,4%,1)';
      d    = 'hsla(45,60%,5%,1)';
      v1   = 'hsla(48,100%,52%,1)';   // golden yellow
      v2   = 'hsla(330,85%,52%,1)';   // warm magenta
      v3   = 'hsla(38,95%,52%,1)';    // amber
    }
  } else if (tempF <= 92) {
    if (isStormy) {
      base = 'hsla(225,60%,4%,1)';
      d    = 'hsla(225,60%,5%,1)';
      v1   = 'hsla(220,100%,30%,1)';  // very dark blue
      v2   = 'hsla(240,90%,18%,1)';   // near-black navy
      v3   = 'hsla(205,95%,42%,1)';   // electric blue
    } else if (isWet) {
      base = 'hsla(218,60%,4%,1)';
      d    = 'hsla(218,60%,5%,1)';
      v1   = 'hsla(216,100%,35%,1)';  // deep royal blue
      v2   = 'hsla(237,88%,22%,1)';   // dark navy
      v3   = 'hsla(200,95%,48%,1)';   // bright blue
    } else {
      base = 'hsla(28,60%,4%,1)';
      d    = 'hsla(28,60%,5%,1)';
      v1   = 'hsla(32,100%,52%,1)';   // vivid orange
      v2   = 'hsla(280,90%,48%,1)';   // purple-violet
      v3   = 'hsla(50,100%,54%,1)';   // yellow
    }
  } else {
    base = 'hsla(8,60%,4%,1)';
    d    = 'hsla(8,60%,5%,1)';
    v1   = 'hsla(5,100%,50%,1)';      // deep red
    v2   = 'hsla(22,95%,45%,1)';      // burnt orange
    v3   = 'hsla(0,95%,42%,1)';       // crimson
  }

  if (isFoggy) {
    base = 'hsla(150,20%,4%,1)';
    d    = 'hsla(150,20%,5%,1)';
    v1   = 'hsla(148,30%,42%,1)';     // grey-green
    v2   = 'hsla(290,25%,38%,1)';     // dusty mauve
    v3   = 'hsla(210,20%,40%,1)';     // slate
  } else if (isCloudy && !isWet) {
    // Reduce saturation of vivid blobs for overcast look
    v1 = v1.replace(/hsla\((\d+),(\d+)%/, (_, h, s) => `hsla(${h},${Math.round(s*0.55)}%`);
    v2 = v2.replace(/hsla\((\d+),(\d+)%/, (_, h, s) => `hsla(${h},${Math.round(s*0.55)}%`);
    v3 = v3.replace(/hsla\((\d+),(\d+)%/, (_, h, s) => `hsla(${h},${Math.round(s*0.55)}%`);
  }

  // Mesh pattern: dark base + 3 dark anchor blobs + 3 vivid color blobs
  // Anchors suppress the base at fixed positions; vivid blobs provide the color light sources
  const bgColor = "#000000";
  const bgImage = [
    `radial-gradient(at 61% 63%, ${d} 0px, transparent 50%)`,
    `radial-gradient(at 84% 13%, ${d} 0px, transparent 50%)`,
    `radial-gradient(at 27% 76%, ${d} 0px, transparent 50%)`,
    `radial-gradient(at 140% 120%, ${v1} 0px, transparent 40%)`,
    `radial-gradient(at 10% 72%, ${v2} 0px, transparent 50%)`,
    `radial-gradient(at -10% 5%, ${v3} 0px, transparent 50%)`,
  ].join(', ');

  const el = targetEl || document.body;
  if (el.classList && el.classList.contains('day-modal')) {
    el.style.backgroundColor = bgColor;
    el.style.backgroundImage = bgImage;
  } else {
    el.style.backgroundColor = bgColor;
    el.style.backgroundImage = bgImage;
    window._lastGradTemp = tempF;
    window._lastGradFc   = shortForecast;
    updateWxOverlay(shortForecast);
  }
  window._weatherAccent = null;
  return null;
}

const _OVERLAY_BASE = 'https://raw.githubusercontent.com/NobleSlevin/stormtracker/main/overlays/';

// Maps current conditions → overlay filename (null = no overlay)
function wxOverlayFile(shortForecast) {
  const fc = (shortForecast || '').toLowerCase();
  if (/snow|blizzard|flurr/.test(fc))                             return 'snow.png';          // future
  if (/fog|mist/.test(fc))                                        return 'fog.png';            // future
  if (/thunder|tstm/.test(fc))                                    return 'tstorm.png';         // ✓ live
  if (/rain|shower|drizzle|sleet/.test(fc))                       return 'rain.png';           // ✓ live
  if (/partly|mostly sunny|mostly clear/.test(fc))                return 'partly-cloudy.png';  // ✓ live
  if (/cloud|overcast|mostly cloudy|hazy/.test(fc))               return 'clouds.png';         // ✓ live
  if (/clear|sunny|fair/.test(fc))                                return 'sunny.png';          // ✓ live
  return null;
}

// Live overlay files — update as images are added to /overlays/
const _OVERLAY_LIVE = new Set(['clouds.png', 'rain.png', 'tstorm.png', 'partly-cloudy.png', 'sunny.png']);

function updateWxOverlay(shortForecast, elId = 'wxOverlay') {
  const el = document.getElementById(elId);
  if (!el) return;
  // Don't touch wxOverlay while day modal is open
  if (elId === 'wxOverlay' && window._dayModalOpen) return;
  const file = wxOverlayFile(shortForecast);
  if (!file || !_OVERLAY_LIVE.has(file)) {
    el.style.opacity = '0';
    setTimeout(() => { if (el.style.opacity === '0') el.style.backgroundImage = ''; }, 1300);
    return;
  }
  const url = `url('${_OVERLAY_BASE}${file}')`;
  // Only cross-fade if the file actually changed — prevents spurious switches on data refreshes
  if (el.dataset.overlayFile === file) { el.style.opacity = '0.55'; return; }
  el.dataset.overlayFile = file;
  el.style.opacity = '0';
  setTimeout(() => {
    el.style.backgroundImage = url;
    el.style.opacity = '0.55';
  }, el.style.backgroundImage ? 400 : 0);
}

function clearWeatherGradient() {
  const bodyEl = document.getElementById('app');
  if (bodyEl) bodyEl.style.background = '';
}


// ── HELPERS ───────────────────────────────────────
async function nwsFetch(url) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15000);
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
// Convert Open-Meteo WMO weather code to a short forecast string for wxIcon/wxLabel
function wcodeToShort(code) {
  if (code == null) return '';
  if (code === 0)           return 'Sunny';
  if (code <= 2)            return 'Partly Cloudy';
  if (code === 3)           return 'Cloudy';
  if (code <= 49)           return 'Fog';
  if (code <= 57)           return 'Drizzle';
  if (code <= 67)           return 'Rain';
  if (code <= 77)           return 'Snow';
  if (code <= 82)           return 'Rain Showers';
  if (code <= 86)           return 'Snow Showers';
  if (code <= 99)           return 'Thunderstorms';
  return 'Cloudy';
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
  } else if (s.includes('partly') || s.includes('mostly sunny') || s.includes('mostly clear')) {
    path = `<path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.476A5.5 5.5 0 0 1 4.406 3.342"/>`;
  } else if (s.includes('sunny') || s.includes('clear')) {
    path = `<path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>`;
  } else {
    // cloudy / overcast / default
    path = `<path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.476A5.5 5.5 0 0 1 4.406 3.342"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="currentColor" viewBox="-1 -1 18 18" style="overflow:visible">${path}</svg>`;
}
// ── HERO PNG WEATHER ICON (Tomorrow.io icon set) ──────────────
const _ICON_BASE = 'https://raw.githubusercontent.com/NobleSlevin/stormtracker/main/png/';
const _TOMORROW_KEY = 'OYdoRFMcUUb6PIwfWWTjLwCxH9gNLDGG';
let _tomorrowCode = null; // cached weatherCode for current location

// Tomorrow.io weatherCode → icon filename (day=0, night=1 suffix)
const _WX_CODE_MAP = {
  1000: n => `1000${n}_clear_large@2x.png`,
  1100: n => `1100${n}_mostly_clear_large@2x.png`,
  1101: n => `1101${n}_partly_cloudy_large@2x.png`,
  1102: _  => `11020_mostly_cloudy_large@2x.png`,
  1001: _  => `11020_mostly_cloudy_large@2x.png`,
  2000: _  => `20000_fog_large@2x.png`,
  2100: _  => `21000_fog_light_large@2x.png`,
  4000: _  => `40000_drizzle_large@2x.png`,
  4001: _  => `40010_rain_large@2x.png`,
  4200: _  => `42000_rain_light_large@2x.png`,
  4201: _  => `42010_rain_heavy_large@2x.png`,
  5000: _  => `50000_snow_large@2x.png`,
  5001: _  => `50010_flurries_large@2x.png`,
  5100: _  => `51000_snow_light_large@2x.png`,
  5101: _  => `51010_snow_heavy_large@2x.png`,
  6000: _  => `60010_freezing_rain_large@2x.png`,
  6001: _  => `62010_freezing_rain_heavy_large@2x.png`,
  6200: _  => `62000_freezing_rain_light_large@2x.png`,
  6201: _  => `62010_freezing_rain_heavy_large@2x.png`,
  7000: _  => `70000_ice_pellets_large@2x.png`,
  7101: _  => `70000_ice_pellets_large@2x.png`,
  7102: _  => `70000_ice_pellets_large@2x.png`,
  8000: _  => `80000_tstorm_large@2x.png`,
};

async function fetchTomorrowRealtime(lat, lon) {
  try {
    const url = `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&fields=weatherCode&apikey=${_TOMORROW_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const code = data?.data?.values?.weatherCode;
    if (code != null) {
      _tomorrowCode = code;
      // Re-render hero icon with accurate code if hero is already showing
      const iconEl = document.querySelector('.fch-icon');
      if (iconEl) {
        const isDay = window._forecastPeriods?.[0]?.isDaytime !== false;
        iconEl.innerHTML = heroWxIcon(null, isDay, code);
      }
    }
  } catch(e) { /* non-fatal */ }
}
function heroWxIcon(forecast, isDay = true, code = null) {
  const n = isDay ? '0' : '1';
  let file;
  // Use Tomorrow.io weatherCode if available — more reliable than text parsing
  const resolvedCode = code ?? _tomorrowCode;
  if (resolvedCode != null && _WX_CODE_MAP[resolvedCode]) {
    file = _WX_CODE_MAP[resolvedCode](n);
  } else {
  const s = (forecast || '').toLowerCase();
  // Thunder / tstorm
  if (s.includes('thunder') || s.includes('tstm')) {
    if (s.includes('partly'))        file = `80030_tstorm_partly_cloudy_large@2x.png`;
    else if (s.includes('mostly cloudy') || s.includes('overcast')) file = `80020_tstorm_mostly_cloudy_large@2x.png`;
    else if (s.includes('mostly clear') || s.includes('mostly sunny')) file = `80010_tstorm_mostly_clear_large@2x.png`;
    else                             file = `80000_tstorm_large@2x.png`;
  }
  // Snow / blizzard / flurries / sleet / wintry mix
  else if (s.includes('blizzard') || s.includes('heavy snow')) {
    file = `51010_snow_heavy_large@2x.png`;
  }
  else if (s.includes('flurr')) {
    if (s.includes('partly'))        file = `51160_flurries_partly_cloudy_large@2x.png`;
    else if (s.includes('mostly cloudy')) file = `51170_flurries_mostly_cloudy_large@2x.png`;
    else if (s.includes('mostly clear')) file = `51150_flurries_mostly_clear_large@2x.png`;
    else                             file = `50010_flurries_large@2x.png`;
  }
  else if (s.includes('wintry mix') || s.includes('sleet')) {
    file = `51080_wintry_mix_large@2x.png`;
  }
  else if (s.includes('ice pellet')) {
    file = `70000_ice_pellets_large@2x.png`;
  }
  else if (s.includes('freezing')) {
    if (s.includes('heavy'))         file = `62010_freezing_rain_heavy_large@2x.png`;
    else if (s.includes('light'))    file = `62000_freezing_rain_light_large@2x.png`;
    else                             file = `60010_freezing_rain_large@2x.png`;
  }
  else if (s.includes('snow')) {
    if (s.includes('partly'))        file = `51060_snow_partly_cloudy_large@2x.png`;
    else if (s.includes('mostly cloudy')) file = `51070_snow_mostly_cloudy_large@2x.png`;
    else if (s.includes('mostly clear')) file = `51050_snow_mostly_clear_large@2x.png`;
    else if (s.includes('light'))    file = `51000_snow_light_large@2x.png`;
    else                             file = `50000_snow_large@2x.png`;
  }
  // Rain / showers / drizzle
  else if (s.includes('drizzle')) {
    if (s.includes('partly'))        file = `42040_drizzle_partly_cloudy_large@2x.png`;
    else if (s.includes('mostly cloudy')) file = `42050_drizzle_mostly_cloudy_large@2x.png`;
    else if (s.includes('mostly clear')) file = `42030_drizzle_mostly_clear_large@2x.png`;
    else                             file = `40000_drizzle_large@2x.png`;
  }
  else if (s.includes('rain') || s.includes('shower')) {
    if (s.includes('heavy') && s.includes('partly')) file = `42020_rain_heavy_partly_cloudy_large@2x.png`;
    else if (s.includes('heavy'))    file = `42010_rain_heavy_large@2x.png`;
    else if (s.includes('light') && s.includes('partly')) file = `42140_rain_light_partly_cloudy_large@2x.png`;
    else if (s.includes('light'))    file = `42000_rain_light_large@2x.png`;
    else if (s.includes('partly'))   file = `42080_rain_partly_cloudy_large@2x.png`;
    else if (s.includes('mostly cloudy')) file = `42100_rain_mostly_cloudy_large@2x.png`;
    else if (s.includes('mostly clear')) file = `42090_rain_mostly_clear_large@2x.png`;
    else                             file = `40010_rain_large@2x.png`;
  }
  // Fog / mist / haze
  else if (s.includes('fog') || s.includes('mist') || s.includes('haz')) {
    if (s.includes('partly'))        file = `21070_fog_partly_cloudy_large@2x.png`;
    else if (s.includes('mostly cloudy')) file = `21080_fog_mostly_cloudy_large@2x.png`;
    else if (s.includes('mostly clear')) file = `21060_fog_mostly_clear_large@2x.png`;
    else if (s.includes('light'))    file = `21000_fog_light_large@2x.png`;
    else                             file = `20000_fog_large@2x.png`;
  }
  // Cloud conditions
  else if (s.includes('mostly cloudy') || s.includes('overcast') || s.includes('cloudy')) {
    file = `11020_mostly_cloudy_large@2x.png`;
  }
  else if (s.includes('partly cloudy') || s.includes('partly sunny')) {
    file = `1101${n}_partly_cloudy_large@2x.png`;
  }
  else if (s.includes('mostly sunny') || s.includes('mostly clear')) {
    file = `1100${n}_mostly_clear_large@2x.png`;
  }
  // Sunny / clear
  else if (s.includes('sunny') || s.includes('clear')) {
    file = `1000${n}_clear_large@2x.png`;
  }
  // Default: cloudy
  else {
    file = `11020_mostly_cloudy_large@2x.png`;
  }
  } // end else (text-parsing fallback)
  return `<img src="${_ICON_BASE}${file}" style="width:87px;height:87px;object-fit:contain;display:block" alt="${forecast}" onerror="this.style.display='none'">`;
}

function rowWxIcon(forecast, isDay = true, size = 36, code = null) {
  const full = heroWxIcon(forecast, isDay, code);
  return full.replace(/width:\d+px;height:\d+px/, `width:${size}px;height:${size}px`);
}

function wxLabel(s) {
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
  withNotifBanner(() => {
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
  }); // withNotifBanner
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
let _compassActive = sessionStorage.getItem('sw-compass-active') === '1';
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

function compassSVG(windDeg, deviceDeg, arrowColor) {
  // windDeg  : degrees wind is FROM (meteorological: 0=N wind blowing south)
  // deviceDeg: current device compass heading (null if no permission)
  // Viewbox 260×260, compass ring at cx=130,cy=130,r=118
  const cx = 150, cy = 150, r = 118;
  const ticksHTML = [];

  // Tick marks — every 5°, with major at 22.5° (16-point) and mid at 10°
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    const a = deg * Math.PI / 180;
    const is16pt = deg % 22.5 === 0;   // 16 compass points
    const isMid  = deg % 10 === 0;
    const rOuter = r;
    const rInner = is16pt ? r - 16 : isMid ? r - 10 : r - 6;
    const x1 = cx + rOuter * Math.sin(a), y1 = cy - rOuter * Math.cos(a);
    const x2 = cx + rInner * Math.sin(a), y2 = cy - rInner * Math.cos(a);
    ticksHTML.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,${is16pt?'.4':isMid?'.2':'.1'})" stroke-width="${is16pt?1.5:1}"/>`);
  }

  // 16-point compass labels + degree values
  const pts16 = [
    ['N',0],['NNE',22.5],['NE',45],['ENE',67.5],
    ['E',90],['ESE',112.5],['SE',135],['SSE',157.5],
    ['S',180],['SSW',202.5],['SW',225],['WSW',247.5],
    ['W',270],['WNW',292.5],['NW',315],['NNW',337.5]
  ];
  const isCardinal = new Set([0,90,180,270]);
  const cardHTML = pts16.map(([lbl, deg]) => {
    const a = deg * Math.PI / 180;
    const isCard = isCardinal.has(deg);
    const rLbl = r - (isCard ? 26 : 24);
    const x = cx + rLbl * Math.sin(a), y = cy - rLbl * Math.cos(a);
    // Degree label just outside the ring for every 30°
    // Degree label placed above/beside the direction label — generated in pts16 loop below
    const rDeg = r + 18;
    const dx = cx + rDeg * Math.sin(a), dy = cy - rDeg * Math.cos(a);
    const degLabel = `<text x="${dx.toFixed(1)}" y="${(dy - (isCard?8:6)).toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="8" font-family="ui-monospace,monospace">${deg}°</text>`;
    return degLabel + `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="${isCard?'#ffffff':'rgba(255,255,255,.6)'}" font-size="${isCard?13:9}" font-family="ui-monospace,monospace" font-weight="${isCard?700:500}">${lbl}</text>`;
  }).join('');

  // Wind arrow — arrowhead points DOWNWIND (where wind is going), tail circle at source.
  // windDeg is FROM direction: rotate so tail is at windDeg, head points to windDeg+180.
  // Draw at 0°: tail circle at top (cy-lineR = upwind/source), arrowhead at bottom (cy+lineR = downwind).
  // Then rotate by windDeg so the tail circle sits at the FROM direction on the compass.
  let windArrowHTML = '';
  if (windDeg != null) {
    const lineR = 88;
    const ac = arrowColor || 'white';
    const hw = 7, hh = 14;
    windArrowHTML = `<g transform="rotate(${windDeg}, ${cx}, ${cy})">
      <line x1="${cx}" y1="${cy - lineR}" x2="${cx}" y2="${cy + lineR}" stroke="${ac}" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="${cx},${cy + lineR} ${cx - hw},${cy + lineR - hh} ${cx + hw},${cy + lineR - hh}" fill="${ac}"/>
      <circle cx="${cx}" cy="${cy - lineR}" r="4.5" fill="none" stroke="${ac}" stroke-width="2.2"/>
    </g>`;
  }

  // Device heading — blue tick at rim, inside the ring (no outside protrusion)
  let deviceHTML = '';
  if (deviceDeg != null) {
    const da = deviceDeg * Math.PI / 180;
    const rOut = r - 2,  rIn = r - 14;
    const x1 = cx + rOut * Math.sin(da), y1 = cy - rOut * Math.cos(da);
    const x2 = cx + rIn  * Math.sin(da), y2 = cy - rIn  * Math.cos(da);
    deviceHTML = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#93c5fd" stroke-width="3" stroke-linecap="round"/>`;
  }

  return `<svg class="wc-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <!-- Ring stroke only, no fill -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="1.5"/>
    <!-- Tick marks -->
    ${ticksHTML.join('')}
    <!-- Labels -->
    ${cardHTML}
    <!-- Wind arrow -->
    ${windArrowHTML}
    <!-- Device heading tick -->
    ${deviceHTML}
    <!-- Center speed circle -->
    <circle cx="${cx}" cy="${cy}" r="30" fill="#111111" stroke="rgba(255,255,255,.12)" stroke-width="1.5"/>
    ${window._windData?.speed != null ? `<text x="${cx}" y="${cy - 7}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="16" font-weight="600" font-family="ui-monospace,monospace">${window._windData.speed}</text><text x="${cx}" y="${cy + 11}" text-anchor="middle" dominant-baseline="central" fill="rgba(255,255,255,.5)" font-size="9" font-family="ui-monospace,monospace">mph</text>` : `<circle cx="${cx}" cy="${cy}" r="3" fill="rgba(255,255,255,.35)"/>`}
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
      <div class="wind-compass">${compassSVG(dir, _compassHeading, bf ? gradientColor(bf.pct).hex : null)}</div>
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
        <span class="wind-stat-val">${dir != null ? dir + '°' : '—'}</span>
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
      <div class="wind-section-ttl"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="opacity:.7;margin-right:5px;flex-shrink:0"><path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0"/></svg>Beaufort Scale</div>
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

  // ── Device compass — always render both, toggle visibility by state ──
  const compassSVGIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#93c5fd" viewBox="0 0 16 16"><path d="M8 16.016a7.5 7.5 0 0 0 1.962-14.74A1 1 0 0 0 9 0H7a1 1 0 0 0-.962 1.276A7.5 7.5 0 0 0 8 16.016m6.5-7.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0"/><path d="m6.94 7.44 4.95-2.83-2.83 4.95-4.949 2.83 2.828-4.95z"/></svg>`;
  const headingTxt = _compassHeading != null ? `${_compassHeading.toFixed(0)}° ${degToCard(_compassHeading)}` : '…';
  const compassPermHTML = `
    <button class="wind-compass-btn" id="windCompassBtn" onclick="requestCompass()" style="display:${_compassActive ? 'none' : 'flex'}">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
      Enable Live Compass
    </button>
    <div class="wind-compass-status" id="windCompassStatus" style="display:${_compassActive ? 'flex' : 'flex'}">
      ${_compassActive ? compassSVGIcon + ' Live compass · ' + headingTxt : 'Tap to overlay your heading on the compass'}
    </div>`;

  // ── Hourly wind sparkline ──
  let hourlyHTML = '';
  const oh = window._omHourly;
  if (oh && oh.time && oh.wind_speed_10m) {
    const now = Date.now();
    const dn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let lastDate = null;
    const cards = oh.time.map((t, i) => {
      const ms = new Date(t).getTime();
      if (ms < now - 1800000) return null;  // skip more than 30min in the past
      if (ms > now + 48 * 3600000) return null; // cap at 48h ahead
      const spd = oh.wind_speed_10m[i] != null ? Math.round(oh.wind_speed_10m[i]) : null;
      const gst = oh.wind_gusts_10m?.[i]  != null ? Math.round(oh.wind_gusts_10m[i])  : null;
      const wdir = oh.wind_direction_10m?.[i] ?? null;
      const dt = new Date(t);
      const hr = dt.toLocaleTimeString([],{hour:'numeric'});
      const dateKey = dt.toDateString();
      // Day divider card when date changes
      let divider = '';
      if (lastDate && lastDate !== dateKey) {
        divider = `<div class="whc-day-divider">${dn[dt.getDay()]}</div>`;
      }
      lastDate = dateKey;
      const arrowMap = ['↑','↗','→','↘','↓','↙','←','↖'];
      const arrow = wdir != null ? arrowMap[(Math.round(wdir/45) + 4) % 8] : '·';
      const color = spd != null && spd > 30 ? 'var(--orange)' : spd != null && spd > 20 ? 'var(--yellow)' : 'var(--text)';
      return divider + `<div class="wind-hour-card">
        <span class="whc-time">${hr}</span>
        <span class="whc-arrow" title="${wdir != null ? wdir+'° '+degToCard(wdir) : ''}">${arrow}</span>
        <span class="whc-speed" style="color:${color}">${spd ?? '—'}</span>
        <span class="whc-gust">${gst != null ? 'G'+gst : ''}</span>
      </div>`;
    }).filter(Boolean);
    if (cards.length) {
      hourlyHTML = `<div class="wind-hourly">
        <div class="wind-section-ttl"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="opacity:.7;margin-right:5px;flex-shrink:0"><path d="M9.5 12.5a1.5 1.5 0 1 1-2-1.415V6.5a.5.5 0 0 1 1 0v4.585a1.5 1.5 0 0 1 1 1.415z"/><path d="M5.5 2.5a2.5 2.5 0 0 1 5 0v7.55a3.5 3.5 0 1 1-5 0zM8 1a1.5 1.5 0 0 0-1.5 1.5v7.987l-.167.15a2.5 2.5 0 1 0 3.333 0l-.166-.15V2.5A1.5 1.5 0 0 0 8 1"/></svg>Hourly Forecast</div>
        <div class="wind-hourly-scroll"><div class="wind-hourly-track">${cards.join('')}</div></div>
      </div>`;
    }
  }

  body.innerHTML = compassHTML + statsHTML + beaufortHTML + hourlyHTML + compassPermHTML;
}

function openWindModal() {
  const modal = document.getElementById('windModal');
  modal.classList.add('open');
  // Apply weather gradient matching current conditions
  const temp = window._omCurrentTemp ?? window._lastGradTemp ?? null;
  const fc   = window._lastGradFc ?? '';
  if (temp != null) weatherGradient(temp, fc, modal);
  renderWindModal();
}

function closeWindModal() {
  const modal = document.getElementById('windModal');
  modal.classList.remove('open');
  modal.style.backgroundImage = '';
  // Do NOT stop compass — keep it running so button stays hidden on re-open
}

function requestCompass() {
  // If already active, nothing to do
  if (_compassActive) return;
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    // Check if permission was already granted this session
    DeviceOrientationEvent.requestPermission().then(state => {
      if (state === 'granted') startCompass();
      else { alert('Compass access denied. You can re-enable it in iOS Settings → Safari → Motion & Orientation Access.'); }
    }).catch(err => { console.warn('Compass permission error:', err); });
  } else {
    startCompass();
  }
}

function startCompass() {
  if (_compassHandler) window.removeEventListener('deviceorientation', _compassHandler);
  _compassActive = true;
  sessionStorage.setItem('sw-compass-active', '1');
  // Hide enable button, show status line immediately without full re-render
  const btn = document.getElementById('windCompassBtn');
  if (btn) btn.style.display = 'none';
  const statusEl = document.getElementById('windCompassStatus');
  if (statusEl) statusEl.style.display = 'flex';
  _compassHandler = (e) => {
    const heading = e.webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
    if (heading != null) {
      _compassHeading = heading;
      const compassWrap = document.querySelector('.wind-compass');
      if (compassWrap) {
        const _bfLive = window._windData?.speed != null ? beaufortFromMph(window._windData.speed) : null;
        compassWrap.innerHTML = compassSVG(window._windData?.direction ?? null, heading, _bfLive ? gradientColor(_bfLive.pct).hex : null);
      }
      const sEl = document.getElementById('windCompassStatus');
      if (sEl) sEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#93c5fd" viewBox="0 0 16 16"><path d="M8 16.016a7.5 7.5 0 0 0 1.962-14.74A1 1 0 0 0 9 0H7a1 1 0 0 0-.962 1.276A7.5 7.5 0 0 0 8 16.016m6.5-7.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0"/><path d="m6.94 7.44 4.95-2.83-2.83 4.95-4.949 2.83 2.828-4.95z"/></svg> Live compass · ${heading.toFixed(0)}° ${degToCard(heading)}`;
    }
  };
  window.addEventListener('deviceorientation', _compassHandler, true);
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
  const tabBtn = document.querySelector('.tab[data-tab="alerts"]');
  if (tabBtn) tabBtn.click();
  if (keyword === 'all')          setFilter('all');
  else if (keyword === 'warning') setFilter('Extreme');
  else if (keyword === 'watch')   setFilter('Severe');
  else                            setFilter('all');
}

function setFilter(f){
  activeFilter=f;
  document.querySelectorAll('.fbtn').forEach(b=>{b.classList.remove('on');if(b.dataset.f===f)b.classList.add('on');});
  renderAlerts(allAlerts);
}
async function fetchAlerts(url){
  setLive('loading','LOADING…');
  withNotifBanner(() => { document.getElementById('panelAlerts').innerHTML=`<div class="state-center"><div class="spinner"></div><div class="state-sub" style="margin-top:10px">Querying NWS…</div></div>`; });
  try{
    const d=await nwsFetch(url);
    allAlerts=(d.features||[]).sort((a,b)=>{const o={Extreme:0,Severe:1,Moderate:2,Minor:3};return(o[a.properties.severity]??4)-(o[b.properties.severity]??4);});
    renderAlerts(allAlerts);
    setLive('ok',`LIVE · ${allAlerts.length}`);
    if(refreshTimer)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(refresh, smartRefreshInterval());
  }catch(e){
    setLive('err','ERROR');
    withNotifBanner(() => { document.getElementById('panelAlerts').innerHTML=`<div class="state-center"><div class="state-icon"><svg width="28" height="28" fill="var(--orange)"><use href="#bi-exclamation-triangle"/></svg></div><div class="state-ttl">Failed</div><div class="state-sub" style="margin-bottom:10px">${e.message}</div><button class="cbtn" id="retryBtn"><svg width="12" height="12" fill="currentColor"><use href="#bi-arrow-repeat"/></svg> Retry</button></div>`; });
    const rb=document.getElementById('retryBtn'); if(rb) rb.addEventListener('click', refresh);
  }
}

// ── FORECAST + HOURLY ─────────────────────────────
async function fetchForecast(lat, lon, attempt = 1) {
  const box = document.getElementById('panelForecast');
  try {
    // Only show spinner on first attempt to avoid flash during retries
    if (attempt === 1 && box) box.innerHTML = '<div class="state-center"><div class="spinner"></div><div class="state-sub" style="margin-top:10px">Loading forecast…</div></div>';
    const pt = await nwsFetch(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    const pp = pt?.properties || {};
    const city = pp.relativeLocation?.properties;
    if (city) {
      document.getElementById('locName').textContent = city.city;
      document.getElementById('locSub').textContent = city.state;
      const stateNames = {'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California','CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming'};
      curState = stateNames[city.state] || city.state;
    }
    // NWS sometimes returns a valid /points/ response but with missing forecast URLs — retry if so
    if (!pp.forecast) {
      throw new Error('NWS points response missing forecast URL');
    }
    const results = { periods: [], hourly: [], stationUrl: pp.observationStations };
    const fc = await nwsFetch(pp.forecast);
    results.periods = fc.properties?.periods || [];
    if (!results.periods.length) throw new Error('NWS returned empty forecast periods');
    renderForecast(results.periods);
    if (pp.forecastHourly) {
      const fh = await nwsFetch(pp.forecastHourly);
      results.hourly = fh.properties?.periods || [];
      renderHourly(results.hourly);
    }
    return results;
  } catch(e) {
    console.warn('Forecast error (attempt ' + attempt + '):', e);
    if (attempt < 4) {
      // NWS is flaky — retry up to 4x with exponential backoff
      const delay = 1000 * attempt;
      if (box) box.innerHTML = `<div class="state-center"><div class="spinner"></div><div class="state-sub" style="margin-top:10px">Retrying… (${attempt}/4)</div></div>`;
      await new Promise(r => setTimeout(r, delay));
      return fetchForecast(lat, lon, attempt + 1);
    }
    if (box) box.innerHTML = `<div class="state-center">
      <div class="state-ttl" style="margin-bottom:8px">NWS Unavailable</div>
      <div class="state-sub" style="margin-bottom:16px">The National Weather Service API is not responding. This is usually temporary.</div>
      <button onclick="fetchForPoint(${lat},${lon})" style="padding:10px 24px;border-radius:999px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:var(--text);font-size:14px;cursor:pointer;">Try Again</button>
    </div>`;
    return {periods:[],hourly:[],stationUrl:null};
  }
}

function buildOutlookBlurb(dayPairs) {
  const dn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const severeDays = [], hotDays = [], coldDays = [];

  dayPairs.forEach(pair => {
    const p = pair.day || pair.night;
    if (!p) return;
    const dt = new Date(p.startTime);
    const dayName = dn[dt.getDay()];
    const fc = (p.shortForecast || '').toLowerCase();
    const detail = (p.detailedForecast || '').toLowerCase();
    const combined = fc + ' ' + detail;
    const hi = Math.max(p.temperature ?? 0, pair.night?.temperature ?? 0);
    const lo = Math.min(p.temperature ?? 999, pair.night?.temperature ?? 999);

    if (combined.includes('tornado') || combined.includes('severe') ||
        combined.includes('thunder') || combined.includes('hail') ||
        combined.includes('damaging') || combined.includes('hurricane')) {
      severeDays.push(dayName);
    } else if (hi >= 100) {
      hotDays.push({ day: dayName, hi });
    } else if (lo <= 25) {
      coldDays.push({ day: dayName, lo });
    }
  });

  let blurb = '';
  if (severeDays.length) {
    blurb = `<b>Outlook:</b> Potential for severe weather ${severeDays.join(' and ')}.`;
  } else if (hotDays.length) {
    const peak = hotDays.reduce((a, b) => a.hi > b.hi ? a : b);
    blurb = `<b>Outlook:</b> Dangerously hot conditions possible ${hotDays.map(d=>d.day).join(' and ')}. High near ${peak.hi}°F.`;
  } else if (coldDays.length) {
    const peak = coldDays.reduce((a, b) => a.lo < b.lo ? a : b);
    blurb = `<b>Outlook:</b> Very cold temperatures expected ${coldDays.map(d=>d.day).join(' and ')}. Low near ${peak.lo}°F.`;
  }

  if (!blurb) return '';
  return `<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:var(--rsm);padding:12px 14px;margin-bottom:8px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.55">${blurb}</div>`;
}

function renderForecast(periods){
  const box=document.getElementById('panelForecast');
  if(!periods.length){box.innerHTML='<div class="state-center"><div class="state-icon">🌤️</div><div class="state-ttl">No data</div></div>';return;}
  const dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hero_p = periods[0];
  // Build day pairs: {day: period, night: period} for each date
  const dayPairMap = new Map();
  for (let i = 1; i < periods.length; i++) {
    const p = periods[i];
    const dt = new Date(p.startTime);
    const dateKey = dt.toDateString();
    if (!dayPairMap.has(dateKey)) dayPairMap.set(dateKey, {});
    if (p.isDaytime) dayPairMap.get(dateKey).day = p;
    else dayPairMap.get(dateKey).night = p;
  }
  const dayPairs = [...dayPairMap.values()].slice(0, 6);
  window._dayPairsCache = dayPairs;
  window._forecastPeriods = periods; // cache for gradient restore
  const days = [hero_p, ...dayPairs.map(pair => pair.day || pair.night)];
  const now=new Date(), hero=days[0];
  if (hero?.temperature) {
    window._nwsHeroTemp = hero.temperature;
    // Set temp immediately from NWS — OM will overwrite with more accurate value when it arrives
    const _tEl = document.querySelector('.fch-temp');
    if (_tEl) _tEl.innerHTML = `${hero.temperature}<sup>°F</sup>`;
  }
  // Paint body gradient based on today's conditions
  if (hero) {
    // Use live observed temp if available, fall back to NWS period temp
    const _gradTemp = window._omCurrentTemp ?? hero.temperature;
    const _accent = weatherGradient(_gradTemp, hero.shortForecast, document.getElementById('app'));
    // accent stored in window._weatherAccent for future use
  }
  // Hero always renders with placeholder temp — OM patch fills in real current value
  const heroHTML=hero?`<div class="fc-hero">
    <div class="fch-top"><div class="fch-day">${dn[now.getDay()]}, ${mn[now.getMonth()]} ${now.getDate()}</div></div>
    <div class="fch-temp">—<sup>°F</sup></div>
    <div class="fch-icon">${heroWxIcon(hero.shortForecast, hero.isDaytime !== false)}</div>
    <div class="fch-meta"><div>${hero.shortForecast}</div><div>Wind: <b>${hero.windDirection||''} ${hero.windSpeed||''}</b></div></div>
    <div class="fch-extras" id="fchExtras"></div>
  </div>`:'';
  const rows = dayPairs.map(pair => {
    const d = pair.day || pair.night;
    const dt = new Date(d.startTime);
    const hi = d.temperature;
    const lo = pair.night?.temperature ?? pair.day?.temperature ?? hi;
    const lowTemp = Math.min(hi, lo), highTemp = Math.max(hi, lo);
    // Temp range bar: map across a reasonable daily scale (20–110°F)
    const scaleMin = 20, scaleMax = 110;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const loP = ((clamp(lowTemp, scaleMin, scaleMax) - scaleMin) / (scaleMax - scaleMin) * 100).toFixed(1);
    const hiP = ((clamp(highTemp, scaleMin, scaleMax) - scaleMin) / (scaleMax - scaleMin) * 100).toFixed(1);
    const hiColor = tempClass(highTemp);
    const loColor = tempClass(lowTemp);
    // The fill gradient needs to show the correct color slice for this temp range.
    // We use a wide gradient and shift it so the color at loP% of the full scale
    // starts at the left edge of the fill, using background-size + background-position trick.
    // Simpler: inline a gradient from loTemp color to hiTemp color.
    const tempGradientStop = (t) => {
      if (t <= 32) return '#67e8f9';
      if (t <= 50) return '#4ade80';
      if (t <= 65) return '#a3e635';
      if (t <= 75) return '#fbbf24';
      if (t <= 85) return '#fb923c';
      return '#f87171';
    };
    const fillGrad = `linear-gradient(to right, ${tempGradientStop(lowTemp)}, ${tempGradientStop(highTemp)})`;
    const rightP = (100 - parseFloat(hiP)).toFixed(1);
    const dayIdx = dayPairs.indexOf(pair);
    return `<div class="fc-day-row" onclick="openDayModal(${dayIdx})">
      <span class="fdr-name">${dn[dt.getDay()]}</span>
      <span class="fdr-icon">${wxIcon(d.shortForecast)}</span>
      <span class="fdr-lo ${loColor}">${lowTemp}°</span>
      <span class="fdr-range-wrap">
        <span class="fdr-range-track">
          <span class="fdr-range-fill" style="left:${loP}%;right:${rightP}%;background:${fillGrad}"></span>
        </span>
      </span>
      <span class="fdr-hi ${hiColor}">${highTemp}°</span>
    </div>`;
  }).join('');
  box.innerHTML=heroHTML
    +'<div class="hourly-toggle" id="hourlyToggle"><span class="hourly-toggle-lbl"><svg width="12" height="12" fill="currentColor"><use href="#bi-sun"/></svg> Hourly Forecast</span><span class="hourly-toggle-chevron"><svg class="caret-right" width="10" height="10" fill="currentColor"><use href="#bi-caret-right-fill"/></svg><svg class="caret-down" width="10" height="10" fill="currentColor"><use href="#bi-caret-down-fill"/></svg></span></div>'
    +'<div class="hourly-scroll" id="hourlyScroll"><div class="hourly-track" id="hourlyTrack"></div></div>'
    +'<div id="aqiSlot"></div>'
    +'<div id="uvSlot"></div>'
    +sectionTtl('Weekly Forecast', 'margin-top:18px')
    +buildOutlookBlurb(dayPairs)
    +'<div class="fc-days">'+rows+'</div>';
  // Repaint cached AQI + UV immediately so slots never appear blank on re-render
  if (_aqiCache) { const s=document.getElementById('aqiSlot'); if(s) s.innerHTML=aqiHTML(_aqiCache); }
  if (window._uvData != null) renderUVSlot();
  renderHeroExtras();
  // Auto-expand hourly on load
  document.getElementById('hourlyToggle').classList.add('open');
  document.getElementById('hourlyScroll').classList.add('open');
  document.getElementById('hourlyToggle').addEventListener('click', () => {
    document.getElementById('hourlyToggle').classList.toggle('open');
    document.getElementById('hourlyScroll').classList.toggle('open');
  });
}


// ── HERO EXTRA STATS (visibility, precip 24h) ────────────────────────────────
function renderHeroExtras() {
  const el = document.getElementById('fchExtras');
  if (!el) return;
  const parts = [];
  if (window._visibilityMi != null) parts.push(`Visibility: ${window._visibilityMi} mi`);
  if (window._precip24h != null) parts.push(`Precip 24h: ${window._precip24h}"`);
  el.textContent = parts.join('  ·  ');
}


// ── DAY DETAIL MODAL ──────────────────────────────
function openDayModal(dayIdx) {
  window._dayModalOpen = true;
  const oh = window._omHourly;
  const pairs = window._dayPairsCache;
  if (!pairs || !pairs[dayIdx]) return;

  const pair = pairs[dayIdx];
  const d = pair.day || pair.night;
  const dt = new Date(d.startTime);
  const dn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  document.getElementById('dayModalTitle').textContent = `${dn[dt.getDay()]}, ${mn[dt.getMonth()]} ${dt.getDate()}`;

  const hi = d.temperature;
  const lo = pair.night?.temperature ?? pair.day?.temperature ?? hi;
  const lowTemp = Math.min(hi, lo), highTemp = Math.max(hi, lo);

  // Fire gradient early so accent color is available for hero HTML
  const _gradTemp = (dayIdx === 0 && window._omCurrentTemp != null) ? window._omCurrentTemp : highTemp;
  const _dmAccent = weatherGradient(_gradTemp, d.shortForecast, document.querySelector('.day-modal'));
  // Cancel any pending overlay timer from a previous open or close
  if (window._dmOverlayTimer) { clearTimeout(window._dmOverlayTimer); window._dmOverlayTimer = null; }
  if (window._dmClearTimer)   { clearTimeout(window._dmClearTimer);   window._dmClearTimer = null; }
  // Reset cache so the overlay always fades in fresh
  const _dmEl = document.getElementById('dmWxOverlay');
  if (_dmEl) { _dmEl.style.opacity = '0'; _dmEl.style.backgroundImage = ''; delete _dmEl.dataset.overlayFile; }
  window._dmOverlayTimer = setTimeout(() => { updateWxOverlay(d.shortForecast, 'dmWxOverlay'); window._dmOverlayTimer = null; }, 300);
  // Hero text is always white — gradient provides the color
  const _ac      = 'rgba(255,255,255,1.0)';
  const _acFaint = 'rgba(255,255,255,0.90)';
  const _acDim   = 'rgba(255,255,255,0.75)';
  const _acBorder= 'rgba(255,255,255,0.20)';

  // ── Hero card — fully inline styles to avoid fc-hero CSS conflicts ──
  const heroHTML = `<div style="backdrop-filter:blur(18px) saturate(1.6) brightness(1.05);-webkit-backdrop-filter:blur(18px) saturate(1.6) brightness(1.05);border-radius:14px;padding:20px 22px 24px;border:1px solid rgba(255,255,255,0.18);box-shadow:0 4px 32px rgba(0,0,0,0.30),inset 0 0 0 200px rgba(255,255,255,0.04);display:flex;flex-direction:column;gap:8px;flex-shrink:0;overflow:hidden;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;font-weight:600;color:${_acFaint}">${dn[dt.getDay()]}, ${mn[dt.getMonth()]} ${dt.getDate()}</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <div style="font-size:60px;font-weight:300;line-height:1;color:#eef0f4">${highTemp}<sup style="font-size:22px;vertical-align:super">°F</sup><span style="font-size:26px;font-weight:300;opacity:.5"> / ${lowTemp}°</span></div>
      </div>
      <div style="flex-shrink:0">${rowWxIcon(d.shortForecast, d.isDaytime !== false, 70)}</div>
    </div>
    <div style="font-size:14px;color:${_acFaint};line-height:1.4">${d.shortForecast}</div>
    <div style="font-size:13px;color:${_acDim}">Wind: <b style="color:${_ac};font-weight:600">${d.windDirection||''} ${d.windSpeed||''}</b></div>
    ${d.detailedForecast && d.detailedForecast !== d.shortForecast ? `<div style="font-size:12px;color:${_acDim};line-height:1.6;border-top:1px solid ${_acBorder};padding-top:10px;margin-top:2px">${d.detailedForecast}</div>` : ''}
  </div>`;

  // ── Hourly data for this day ──
  const dateStr = dt.toISOString().slice(0, 10);
  let hours = [];
  if (oh && oh.time) {
    oh.time.forEach((t, i) => {
      if (t.startsWith(dateStr)) {
        hours.push({
          time: t,
          temp: oh.temperature_2m?.[i] != null ? Math.round(oh.temperature_2m[i]) : null,
          feelsLike: oh.apparent_temperature?.[i] != null ? Math.round(oh.apparent_temperature[i]) : null,
          precip: oh.precipitation_probability?.[i] ?? null,
          precipMm: oh.precipitation?.[i] ?? null,
          wind: oh.wind_speed_10m?.[i] != null ? Math.round(oh.wind_speed_10m[i]) : null,
          gust: oh.wind_gusts_10m?.[i] != null ? Math.round(oh.wind_gusts_10m[i]) : null,
          windDeg: oh.wind_direction_10m?.[i] != null ? Math.round(oh.wind_direction_10m[i]) : null,
          windDir: oh.wind_direction_10m?.[i] != null ? degToCard(Math.round(oh.wind_direction_10m[i])) : null,
          humid: oh.relative_humidity_2m?.[i] != null ? Math.round(oh.relative_humidity_2m[i]) : null,
          pressure: oh.surface_pressure?.[i] != null ? Math.round(oh.surface_pressure[i]) : null,
          vis: oh.visibility?.[i] != null ? (oh.visibility[i] / 1609.34).toFixed(1) : null,
          uv: oh.uv_index?.[i] != null ? oh.uv_index[i] : null,
          wcode: oh.weather_code?.[i] ?? null,
        });
      }
    });
  }

  const hoursWithData = hours.filter(h => h.temp != null);
  // ── Horizontal hourly scroll (same hour-card style as forecast tab) ──
  const hourlyHTML = hoursWithData.length >= 2 ? `
    <div class="dd-hourly-scroll">
      <div class="dd-hourly-track">
        ${hoursWithData.map((h, idx) => {
          const hr = new Date(h.time).toLocaleTimeString([], {hour:'numeric'});
          const label = idx === 0 ? 'Now' : hr;
          const shortFx = h.wcode != null ? wcodeToShort(h.wcode) : '';
          return `<div class="dd-hour-col">
            <span class="dd-hour-time">${label}</span>
            <span style="font-size:18px;line-height:1">${wxIcon(shortFx, 18)}</span>
            <span class="dd-hour-temp ${h.temp != null ? tempClass(h.temp) : ''}">${h.temp != null ? h.temp+'°' : '—'}</span>
            ${h.precip != null ? `<span class="dd-hour-precip">${h.precip}%</span>` : ''}
            <span class="dd-hour-wind">${h.wind != null ? h.wind+'mph' : '—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  // ── Aggregates ──
  const avgHumid = hours.filter(h=>h.humid!=null).length ? Math.round(hours.filter(h=>h.humid!=null).reduce((a,h)=>a+h.humid,0)/hours.filter(h=>h.humid!=null).length) : null;
  const minHumid = hours.filter(h=>h.humid!=null).length ? Math.min(...hours.filter(h=>h.humid!=null).map(h=>h.humid)) : null;
  const maxHumid = hours.filter(h=>h.humid!=null).length ? Math.max(...hours.filter(h=>h.humid!=null).map(h=>h.humid)) : null;
  const maxWind = hours.filter(h=>h.wind!=null).length ? Math.max(...hours.filter(h=>h.wind!=null).map(h=>h.wind)) : null;
  const avgWind = hours.filter(h=>h.wind!=null).length ? Math.round(hours.filter(h=>h.wind!=null).reduce((a,h)=>a+h.wind,0)/hours.filter(h=>h.wind!=null).length) : null;
  const maxGust = hours.filter(h=>h.gust!=null).length ? Math.max(...hours.filter(h=>h.gust!=null).map(h=>h.gust)) : null;
  const dominantWindDeg = (() => {
    const dirs = hours.filter(h=>h.windDeg!=null);
    if (!dirs.length) return null;
    const sinSum = dirs.reduce((a,h)=>a+Math.sin(h.windDeg*Math.PI/180),0);
    const cosSum = dirs.reduce((a,h)=>a+Math.cos(h.windDeg*Math.PI/180),0);
    return Math.round(Math.atan2(sinSum/dirs.length, cosSum/dirs.length)*180/Math.PI + 360) % 360;
  })();
  const dominantDir = dominantWindDeg != null ? degToCard(dominantWindDeg) : '';
  const pressures = hours.filter(h=>h.pressure!=null).map(h=>h.pressure);
  const avgPressure = pressures.length ? Math.round(pressures.reduce((a,v)=>a+v,0)/pressures.length) : null;
  const minPress = pressures.length ? Math.min(...pressures) : null;
  const maxPress = pressures.length ? Math.max(...pressures) : null;
  const visibs = hours.filter(h=>h.vis!=null).map(h=>parseFloat(h.vis));
  const minVis = visibs.length ? Math.min(...visibs).toFixed(1) : null;
  const maxVis = visibs.length ? Math.max(...visibs).toFixed(1) : null;
  const maxUV = (() => {
    const from = hours.filter(h=>h.uv!=null && h.uv > 0);
    if (from.length) return Math.max(...from.map(h=>h.uv));
    if (window._uvData != null && dayIdx === 0) return window._uvData;
    return null;
  })();

  // ── AQI card (full-width, existing style) ──
  const aqiCardHTML = _aqiCache ? aqiHTML(_aqiCache) : '';

  // ── UV card (full-width, existing style) ──
  const uvCardHTML = maxUV != null ? (() => {
    const uv = maxUV;
    const uvRounded = Math.round(uv * 10) / 10;
    const uvCat  = uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very High' : 'Extreme';
    const _uvC   = gradientColor(Math.min(uv, 11) / 11);
    const uvColor = _uvC.hex, uvBg = _uvC.bg, uvBorder = _uvC.border;
    const advice  = uv < 3 ? 'No protection needed' : uv < 6 ? 'Wear sunscreen SPF 30+' : uv < 8 ? 'Seek shade midday' : uv < 11 ? 'Minimize sun 10am–4pm' : 'Avoid sun exposure';
    const burnMins = uv <= 0 ? '∞' : uv < 3 ? '60+ min' : uv < 6 ? '30–45 min' : uv < 8 ? '15–25 min' : uv < 11 ? '10–15 min' : '<10 min';
    return `<div>
    ${sectionTtl('UV Index')}
    <div class="uv-card">
      <div class="uv-header">
        <div class="uv-icon-wrap" style="background:${uvBg};border:1.5px solid ${uvBorder}">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="${uvColor}" viewBox="0 0 16 16">
            <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
          </svg>
        </div>
        <div class="uv-info"><div class="uv-area">Peak for the day</div></div>
        <div class="uv-badge" style="background:${uvBg};color:${uvColor};border:1px solid ${uvBorder}">${uvCat}</div>
        <div class="uv-score" style="color:${uvColor}">${uvRounded}</div>
      </div>
      ${rangeBar(uv, 11, 'linear-gradient(to right, #4ade80 0%, #a3e635 18%, #fbbf24 36%, #fb923c 55%, #f87171 73%, #c084fc 100%)')}
      <div class="uv-cells">
        <div class="uv-cell"><span class="uv-cell-lbl">Index</span><span class="uv-cell-val" style="color:${uvColor}">${uvRounded}</span><span class="uv-cell-sub">${uvCat}</span></div>
        <div class="uv-cell"><span class="uv-cell-lbl">Burn Time</span><span class="uv-cell-val" style="font-size:14px;padding-top:4px">${burnMins}</span><span class="uv-cell-sub">fair skin</span></div>
        <div class="uv-cell"><span class="uv-cell-lbl">Advice</span><span class="uv-cell-val" style="font-size:11px;line-height:1.3;padding-top:2px;color:var(--dim)">${advice}</span><span class="uv-cell-sub">&nbsp;</span></div>
      </div>
    </div>
    </div>`;
  })() : '';

  // ── Mini compass SVG (120×120) ──
  function miniCompass(deg) {
    if (deg == null) return '';
    const cx = 150, cy = 150, r = 118;
    // 72 ticks every 5° — major at 22.5° (16-point), mid at 10°
    const ticksHTML = [];
    for (let i = 0; i < 72; i++) {
      const d = i * 5;
      const a = d * Math.PI / 180;
      const is16 = d % 22.5 === 0, isMid = d % 10 === 0;
      const ro = r, ri = r - (is16 ? 16 : isMid ? 10 : 6);
      const x1 = cx + ro*Math.sin(a), y1 = cy - ro*Math.cos(a);
      const x2 = cx + ri*Math.sin(a), y2 = cy - ri*Math.cos(a);
      ticksHTML.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,${is16?'.4':isMid?'.2':'.1'})" stroke-width="${is16?1.5:1}"/>`);
    }
    // 16-point labels
    const pts16 = [
      ['N',0],['NNE',22.5],['NE',45],['ENE',67.5],
      ['E',90],['ESE',112.5],['SE',135],['SSE',157.5],
      ['S',180],['SSW',202.5],['SW',225],['WSW',247.5],
      ['W',270],['WNW',292.5],['NW',315],['NNW',337.5]
    ];
    const cardinals = new Set([0,90,180,270]);
    const labelsHTML = pts16.map(([lbl, d]) => {
      const a = d * Math.PI / 180;
      const isCard = cardinals.has(d);
      const rl = r - (isCard ? 26 : 24);
      const x = cx + rl*Math.sin(a), y = cy - rl*Math.cos(a);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="${d===0?'#f87171':isCard?'rgba(255,255,255,.75)':'rgba(255,255,255,.38)'}" font-size="${isCard?13:9}" font-family="ui-monospace,monospace" font-weight="${isCard?700:500}">${lbl}</text>`;
    }).join('');
    const lineR = 88, hw = 7, hh = 14;
    const arrow = `<g transform="rotate(${deg},${cx},${cy})">
      <line x1="${cx}" y1="${cy-lineR}" x2="${cx}" y2="${cy+lineR}" stroke="#93c5fd" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="${cx},${cy+lineR} ${cx-hw},${cy+lineR-hh} ${cx+hw},${cy+lineR-hh}" fill="#93c5fd"/>
      <circle cx="${cx}" cy="${cy-lineR}" r="4.5" fill="none" stroke="#93c5fd" stroke-width="2.2"/>
    </g>`;
    return `<svg viewBox="0 0 300 300" width="100%" height="100%" style="display:block;max-width:240px;max-height:240px" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="1.5"/>
      ${ticksHTML.join('')}${labelsHTML}${arrow}
    </svg>`;
  }

  // ── Compact square metric tiles (2×2 grid) ──
  // Build a version of compassSVG sized for the day modal wind card
  const windCardHTML = maxWind != null ? `
    <div>
      ${sectionTtl('Wind')}
      <div class="aqi-card" style="overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr;min-height:180px">
          <div style="display:flex;flex-direction:column;justify-content:space-between;padding:18px 16px;border-right:1px solid var(--border)">
            <div>
              <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">AVG SPEED</div>
              <div style="font-size:44px;font-weight:300;line-height:1;color:var(--blue)">${avgWind}<span style="font-size:13px;color:var(--dim);margin-left:4px">mph</span></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
              <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--border);padding-bottom:8px">
                <span style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Peak</span>
                <span style="font-size:15px;font-weight:500;color:var(--text)">${maxWind}<span style="font-size:10px;color:var(--dim);margin-left:3px">mph</span></span>
              </div>
              ${maxGust ? `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--border);padding-bottom:8px">
                <span style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Gusts</span>
                <span style="font-size:15px;font-weight:500;color:var(--orange)">${maxGust}<span style="font-size:10px;color:var(--dim);margin-left:3px">mph</span></span>
              </div>` : ''}
              ${dominantDir ? `<div style="display:flex;justify-content:space-between;align-items:baseline">
                <span style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Dir</span>
                <span style="font-size:15px;font-weight:500;color:var(--text)">${dominantDir}</span>
              </div>` : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;padding:8px;min-height:240px">${miniCompass(dominantWindDeg)}</div>
        </div>
      </div>
    </div>` : '';

  const humidTileHTML = avgHumid != null ? (() => {
    const hLabel = avgHumid < 30 ? 'Dry' : avgHumid < 60 ? 'Comfortable' : avgHumid < 80 ? 'Humid' : 'Very Humid';
    const hC = gradientColor(avgHumid / 100);
    return `<div class="dm-tile">
      <div class="dm-tile-ttl">Humidity</div>
      <div class="dm-tile-big" style="color:${hC.hex}">${avgHumid}<span class="dm-tile-unit">%</span></div>
      <div class="dm-tile-badge" style="color:${hC.hex};border-color:${hC.border};background:${hC.bg}">${hLabel}</div>
      <div class="dm-tile-sub">Low ${minHumid}% · High ${maxHumid}%</div>
    </div>`;
  })() : '';

  const visTileHTML = minVis != null ? (() => {
    const vF = parseFloat(minVis);
    const vColor = vF < 1 ? '#f87171' : vF < 3 ? '#fb923c' : vF < 5 ? '#fbbf24' : '#4ade80';
    const vLabel = vF < 0.25 ? 'Dense Fog' : vF < 1 ? 'Fog' : vF < 3 ? 'Mist' : vF < 5 ? 'Haze' : 'Clear';
    return `<div class="dm-tile">
      <div class="dm-tile-ttl">Visibility</div>
      <div class="dm-tile-big" style="color:${vColor}">${minVis}<span class="dm-tile-unit">mi min</span></div>
      <div class="dm-tile-badge" style="color:${vColor};border-color:${vColor}44;background:${vColor}18">${vLabel}</div>
      <div class="dm-tile-sub">Max ${maxVis} mi</div>
    </div>`;
  })() : '';

  const pressTileHTML = avgPressure != null ? (() => {
    const trend = pressures.length > 1 ? (pressures[pressures.length-1] > pressures[0] ? '↑ Rising' : pressures[pressures.length-1] < pressures[0] ? '↓ Falling' : '→ Steady') : '→ Steady';
    const tColor = trend.startsWith('↑') ? '#4ade80' : trend.startsWith('↓') ? '#f87171' : '#93c5fd';
    return `<div class="dm-tile">
      <div class="dm-tile-ttl">Pressure</div>
      <div class="dm-tile-big" style="color:${tColor}">${avgPressure}<span class="dm-tile-unit">mb</span></div>
      <div class="dm-tile-badge" style="color:${tColor};border-color:${tColor}44;background:${tColor}18">${trend}</div>
      <div class="dm-tile-sub">Low ${minPress} · High ${maxPress}</div>
    </div>`;
  })() : '';

  const gridTiles = [humidTileHTML, visTileHTML, pressTileHTML].filter(Boolean).join('');
  const tilesHTML = gridTiles ? `<div>${sectionTtl('Conditions')}<div class="dm-grid">${gridTiles}</div></div>` : '';

  // ── Sunrise / Sunset arc card ──
  const od = window._omDaily;
  const dayDateStr = dt.toISOString().slice(0, 10);
  const dayIdx2 = od?.time?.findIndex(t => t === dayDateStr) ?? -1;
  const sunriseRaw = dayIdx2 >= 0 ? od?.sunrise?.[dayIdx2] : null;
  const sunsetRaw  = dayIdx2 >= 0 ? od?.sunset?.[dayIdx2]  : null;
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}).toLowerCase() : null;
  const sunriseStr = fmtTime(sunriseRaw);
  const sunsetStr  = fmtTime(sunsetRaw);
  const sunHTML = (sunriseStr || sunsetStr) ? (() => {
    const now = new Date();
    const srMs = sunriseRaw ? new Date(sunriseRaw).getTime() : null;
    const ssMs = sunsetRaw  ? new Date(sunsetRaw).getTime()  : null;
    const isDaytime = srMs && ssMs && now.getTime() >= srMs && now.getTime() <= ssMs;

    // progress along the arc: 0=sunrise, 1=sunset
    // only meaningful for today; future days show sun at end of arc
    let progress = 0.5;
    if (dayIdx === 0 && srMs && ssMs) {
      progress = Math.max(0, Math.min(1, (now.getTime() - srMs) / (ssMs - srMs)));
    } else if (dayIdx > 0) {
      progress = 0; // future day — sun at left (sunrise) position
    }

    // Daylight duration
    const totalMins = srMs && ssMs ? Math.round((ssMs - srMs) / 60000) : null;
    const daylightStr = totalMins ? `${Math.floor(totalMins/60)}h ${totalMins%60}m daylight` : '';

    // SVG: viewBox 320 wide. Circle center=(160, 116), r=148 → spans 12 to 308 (full width minus small pad)
    // Horizon at y=116. Top half = daytime arc. Bottom half = nighttime arc (clipped shorter for aesthetics).
    const vW = 320, cx = 160, cy = 116, r = 148;
    const leftX = cx - r, rightX = cx + r, horizY = cy;
    // Show only top arc + a shallow dip of bottom arc (clip bottom at cy+32)
    const botClipH = 32;

    // Sun position on top arc: angle goes from π (left) → 0 (right)
    const sunAngle = Math.PI - progress * Math.PI;
    const sunX = cx + r * Math.cos(sunAngle);
    const sunY = cy - r * Math.sin(sunAngle); // sin is positive for top arc

    const uid = `sun_${dayIdx}`;

    return `<div class="dm-tile" style="grid-column:1/-1;padding:16px 16px 14px">
      <div class="dm-tile-ttl" style="margin-bottom:2px">Sun</div>
      <svg viewBox="0 0 ${vW} ${horizY + botClipH + 22}" width="100%" height="auto" style="display:block">
        <defs>
          <filter id="glow_${uid}" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <clipPath id="topClip_${uid}">
            <rect x="0" y="0" width="${vW}" height="${horizY + 1}"/>
          </clipPath>
          <clipPath id="botClip_${uid}">
            <rect x="0" y="${horizY}" width="${vW}" height="${botClipH}"/>
          </clipPath>
        </defs>

        <!-- bottom arc shallow dip (nighttime hint) -->
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="rgba(128,151,167,0.18)" stroke-width="2"
          clip-path="url(#botClip_${uid})"/>

        <!-- top arc background (full dim arc) -->
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="rgba(255,255,255,0.1)" stroke-width="2.5"
          clip-path="url(#topClip_${uid})"/>

        <!-- elapsed golden arc from left to sun -->
        ${progress > 0.01 ? (() => {
          const ex = cx + r * Math.cos(sunAngle);
          const ey = cy - r * Math.sin(sunAngle);
          const largeArc = progress > 0.5 ? 1 : 0;
          return `<path d="M ${leftX} ${horizY} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}"
            fill="none" stroke="rgba(250,182,12,0.8)" stroke-width="2.5" stroke-linecap="round"
            clip-path="url(#topClip_${uid})"/>`;
        })() : ''}

        <!-- horizon line -->
        <line x1="${leftX}" y1="${horizY}" x2="${rightX}" y2="${horizY}"
          stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>

        <!-- sun glow -->
        <circle cx="${sunX.toFixed(2)}" cy="${sunY.toFixed(2)}" r="16"
          fill="${isDaytime ? 'rgba(250,182,12,0.18)' : 'rgba(255,255,255,0.06)'}"
          filter="url(#glow_${uid})"/>
        <!-- sun dot -->
        <circle cx="${sunX.toFixed(2)}" cy="${sunY.toFixed(2)}" r="6"
          fill="${isDaytime ? '#FAB60C' : 'rgba(255,255,255,0.45)'}"/>

        <!-- sunrise label -->
        <text x="${leftX + 2}" y="${horizY + 18}" text-anchor="start"
          fill="rgba(255,255,255,0.38)" font-size="11" font-family="system-ui,sans-serif">${sunriseStr||''}</text>
        <!-- sunset label -->
        <text x="${rightX - 2}" y="${horizY + 18}" text-anchor="end"
          fill="rgba(255,255,255,0.38)" font-size="11" font-family="system-ui,sans-serif">${sunsetStr||''}</text>
        <!-- daylight duration centered -->
        ${daylightStr ? `<text x="${cx}" y="${horizY + botClipH + 18}" text-anchor="middle"
          fill="rgba(255,255,255,0.28)" font-size="11" font-family="system-ui,sans-serif">${daylightStr}</text>` : ''}
      </svg>
    </div>`;
  })() : '';

  // ── Rain amount tile ──
  const rainSum = dayIdx2 >= 0 ? od?.precipitation_sum?.[dayIdx2] : null;
  const rainInches = rainSum != null ? (rainSum / 25.4).toFixed(2) : null;
  const rainLabel = !rainInches || rainInches === '0.00' ? 'None' : parseFloat(rainInches) < 0.1 ? 'Trace' : parseFloat(rainInches) < 0.5 ? 'Light' : parseFloat(rainInches) < 1.5 ? 'Moderate' : 'Heavy';
  const rainTileHTML = rainInches != null ? `<div class="dm-tile">
    <div class="dm-tile-ttl">Est. Rain</div>
    <div class="dm-tile-big" style="color:var(--blue)">${rainInches}<span class="dm-tile-unit">in</span></div>
    <div class="dm-tile-badge" style="color:var(--blue);border-color:rgba(96,165,250,0.3);background:rgba(96,165,250,0.1)">${rainLabel}</div>
    <div class="dm-tile-sub">${rainLabel === 'None' ? 'No precipitation expected' : `${rainInches} in total`}</div>
  </div>` : '';

  const allGridTiles = [humidTileHTML, visTileHTML, pressTileHTML, rainTileHTML].filter(Boolean).join('');
  const allTilesHTML = allGridTiles ? `<div>${sectionTtl('Conditions')}<div class="dm-grid">${allGridTiles}</div></div>` : '';

  const metricCards = [aqiCardHTML, uvCardHTML].filter(Boolean).join('');

  // ── Precip bar chart ──────────────────────────────────────────────────────
  const precipChartHTML = (() => {
    const allHrs = hoursWithData.filter(h => h.precip != null || h.precipMm != null);
    if (allHrs.length < 2) return '';

    // Show 12 hours at a time — two pages, AM and PM
    const pages = [allHrs.slice(0, 12), allHrs.slice(12, 24)].filter(p => p.length > 0);
    const totalMm = allHrs.reduce((a, h) => a + (h.precipMm || 0), 0);
    const totalInches = (totalMm / 25.4);
    const totalLabel = totalMm < 0.01 ? 'No precip expected' : totalInches < 0.01 ? 'Trace' : `${totalInches.toFixed(2)} in total`;

    const renderPage = (hrs) => {
      const maxMm = Math.max(...hrs.map(h => h.precipMm || 0), 0.2);
      return hrs.map(h => {
        const mm = h.precipMm || 0;
        const prob = h.precip ?? 0;
        const pct = Math.min((mm / maxMm) * 100, 100);
        const hr = new Date(h.time);
        const label = hr.toLocaleTimeString([], {hour: 'numeric'});
        const opacity = 0.25 + (prob / 100) * 0.75;
        const hasRain = mm > 0.01 || prob > 10;
        const barH = hasRain ? Math.max(pct, prob > 5 ? 6 : 2) : 2;
        return `<div class="pchart-col">
          <div class="pchart-bar-wrap">
            <div class="pchart-bar" style="height:${barH}%;background:rgba(96,165,250,${hasRain ? opacity : 0.12});" title="${(mm/25.4).toFixed(3)}\" · ${prob}%"></div>
          </div>
          <div class="pchart-label">${label}</div>
        </div>`;
      }).join('');
    };

    const _maxMm = Math.max(...allHrs.map(h => h.precipMm || 0), 0.2);
    const yLabel = (_maxMm / 25.4) < 0.1 ? (_maxMm / 25.4).toFixed(3)+'"' : (_maxMm / 25.4).toFixed(2)+'"';

    const pageTabsHTML = pages.length > 1 ? `
      <div class="pchart-tabs">
        <button class="pchart-tab active" onclick="pchartPage(this,0)">12 AM–12 PM</button>
        <button class="pchart-tab" onclick="pchartPage(this,1)">12 PM–12 AM</button>
      </div>` : '';

    const pagesHTML = pages.map((hrs, pi) =>
      `<div class="pchart-page" data-page="${pi}" style="display:${pi===0?'flex':'none'}">
        <div class="pchart-yaxis"><span>${yLabel}</span></div>
        <div class="pchart-bars">${renderPage(hrs)}</div>
      </div>`
    ).join('');

    // Pill color matches rain tile blue
    const pillColor = totalMm < 0.01
      ? 'color:var(--dim);border-color:var(--border2);background:var(--card2)'
      : 'color:var(--blue);border-color:rgba(96,165,250,0.3);background:rgba(96,165,250,0.1)';
    const pillLabel = totalMm < 0.01 ? 'None'
      : (totalInches < 0.01 ? 'Trace'
      : totalInches < 0.5 ? 'Light'
      : totalInches < 1.5 ? 'Moderate' : 'Heavy');

    return `<div>
      ${sectionTtl('Precipitation')}
      <div class="pchart-wrap">
        <div class="pchart-header">
          <div class="pchart-icon-wrap" style="background:rgba(96,165,250,0.12);border-color:rgba(96,165,250,0.35)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="rgba(96,165,250,0.9)"><use href="#bi-droplet-fill"/></svg>
          </div>
          <div class="pchart-info">
            <div class="pchart-area">Open-Meteo · Daily</div>
          </div>
          <div class="pchart-badge" style="${pillColor}">${pillLabel}</div>
          <div class="pchart-score" style="color:var(--blue)">${totalMm < 0.01 ? '0' : totalInches.toFixed(2)}<span style="font-size:13px;font-weight:400;color:var(--dim);margin-left:3px">in</span></div>
        </div>
        ${pageTabsHTML}
        <div class="pchart-pages">${pagesHTML}</div>
      </div>
    </div>`;
  })();

  document.getElementById('dayModalBody').innerHTML =
    heroHTML +
    hourlyHTML +
    precipChartHTML +
    metricCards +
    (windCardHTML || '') +
    allTilesHTML;

  // Paint gradient for this specific day
  const _gp = d;
  // gradient already applied above
  document.getElementById('dayModalOverlay').classList.add('open');
  document.getElementById('dayModal').classList.add('open');
}


function pchartPage(btn, pageIdx) {
  const wrap = btn.closest('.pchart-wrap');
  wrap.querySelectorAll('.pchart-tab').forEach((t,i) => t.classList.toggle('active', i === pageIdx));
  wrap.querySelectorAll('.pchart-page').forEach((p,i) => p.style.display = i === pageIdx ? 'flex' : 'none');
}

function closeDayModal() {
  window._dayModalOpen = false;
  if (window._dmOverlayTimer) { clearTimeout(window._dmOverlayTimer); window._dmOverlayTimer = null; }
  if (window._dmClearTimer)   { clearTimeout(window._dmClearTimer);   window._dmClearTimer = null; }
  document.getElementById('dayModalOverlay').classList.remove('open');
  document.getElementById('dayModal').classList.remove('open');
  const _dmOv = document.getElementById('dmWxOverlay');
  if (_dmOv) {
    _dmOv.style.opacity = '0';
    delete _dmOv.dataset.overlayFile;
    window._dmClearTimer = setTimeout(() => { _dmOv.style.backgroundImage = ''; window._dmClearTimer = null; }, 1300);
  }
  // Restore today's gradient when returning to forecast tab
  const hp = window._forecastPeriods?.[0];
  if (hp) weatherGradient(hp.temperature, hp.shortForecast, document.getElementById('app'));
}

// ── PATCH HOURLY TEMPS FROM OPEN-METEO ───────────
// NWS hourly periods own everything except temperature — OM provides the accurate temp.
// Called after renderHourly has already built the DOM cards.
function patchHourlyTemps(omHourly) {
  const times = omHourly?.time || [];
  const temps = omHourly?.temperature_2m || [];
  const wdirs = omHourly?.wind_direction_10m || [];
  if (!times.length || !temps.length) return;

  const omByHour = {};
  times.forEach((t, i) => {
    omByHour[t] = { temp: temps[i], wdir: wdirs[i] };
  });

  const cards = document.querySelectorAll('#hourlyTrack .hour-card');
  cards.forEach(card => {
    const iso = card.dataset.time;
    if (!iso) return;
    const hourKey = iso.slice(0, 16);
    const om = omByHour[hourKey];
    if (!om) return;
    if (om.temp != null) {
      const tempEl = card.querySelector('.hc-temp');
      if (tempEl) tempEl.textContent = Math.round(om.temp) + '°';
    }
    if (om.wdir != null) {
      const arrowEl = card.querySelector('.hc-wind-arrow');
      if (arrowEl) {
        // Arrow SVG points down (↓) at 0°. Wind direction is FROM bearing.
        // Rotating by wdir makes the arrow point in the downwind (travel) direction.
        const rotate = Math.round(om.wdir) % 360;
        arrowEl.style.transform = `rotate(${rotate}deg)`;
      }
    }
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
    <div>
    ${sectionTtl('Air Quality')}
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
    </div>
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
    ${sectionTtl('UV Index', 'margin-top:18px')}
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
  const now = new Date();
  track.innerHTML = periods.slice(0, 24).map((p, idx) => {
    const dt = new Date(p.startTime);
    // Label first period "Now", then every subsequent hour
    const hr = idx === 0 ? 'Now' : dt.toLocaleTimeString([], {hour:'numeric'});
    const precip = p.probabilityOfPrecipitation?.value;
    const windNums = (p.windSpeed||'0').match(/\d+/g)||['0'];
    const windMax = Math.max(...windNums.map(Number));
    return `<div class="hour-card" data-time="${p.startTime}">
      <span class="hc-time">${hr}</span>
      <span class="hc-icon">${rowWxIcon(p.shortForecast, p.isDaytime !== false, 32)}</span>
      <span class="hc-label">${wxLabel(p.shortForecast)}</span>
      <span class="hc-temp ${tempClass(p.temperature)}">${p.temperature}°</span>
      ${precip != null ? `<span class="hc-precip">${precip}%</span>` : ''}
      <span class="hc-wind">${windMax}mph</span>
      <span class="hc-wind-arrow" style="display:flex;align-items:center;justify-content:center;opacity:.5"><svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1"/></svg></span>
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
    const _os=document.getElementById('obsStrip');_os.dataset.active='1';document.getElementById('obsStripWrap')?.classList.remove('collapsed');
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
        sections.push(`<div>
          ${sectionTtl('NOAA Weather Radio')}
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
          </div></div>`);
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
        sections.push(`<div>${sectionTtl('River Gauges')}${cards}</div>`);
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
      sections.push(`<div>
        ${sectionTtl('Nearest Radar Station')}
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
        </div></div>`);
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
        sections.push(`<div>${sectionTtl('Active Tropical Storms')}${cards}</div>`);
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
      sections.push(`<div>
        ${sectionTtl('State Alerts', 'margin-top:4px')}
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
        </div></div>`);
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
  const placeholder = document.getElementById('factorPlaceholder');
  if (placeholder) placeholder.style.display = 'none';
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
  document.querySelector('.risk-icon').innerHTML = `<div class="gauge-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="${iconColor}" viewBox="0 0 16 16"><path d="M6.999 2.6A5.5 5.5 0 0 1 15 7.5a.5.5 0 0 0 1 0 6.5 6.5 0 1 0-13 0 5 5 0 0 0 6.001 4.9A5.5 5.5 0 0 1 1 7.5a.5.5 0 0 0-1 0 6.5 6.5 0 1 0 13 0 5 5 0 0 0-6.001-4.9M10 7.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0"/></svg></div>`;
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
  optPath=svgEl('path',{d:buildPath('ideal'),fill:'url(#iG)',stroke:'#f87171','stroke-width':'1.8','stroke-linejoin':'round',opacity:'0'},svg);
  setTimeout(()=>{livPath.style.transition='opacity 0.5s';livPath.setAttribute('opacity','1');},400);
  setTimeout(()=>{optPath.style.transition='opacity 0.5s';optPath.setAttribute('opacity','1');},650);
  dotG=svgEl('g',{},svg);
  factors.forEach((f,i)=>{
    ['live','ideal'].forEach((key,ki)=>{
      const p=polar(i,R*f[key]), isIdeal=key==='ideal';
      const dot=svgEl('circle',{cx:p.x.toFixed(2),cy:p.y.toFixed(2),r:isIdeal?'4':'3.5',fill:isIdeal?'#f87171':'#93c5fd',stroke:isIdeal?'#fca5a5':'#bfdbfe','stroke-width':'1.2',style:'cursor:pointer;transition:r 0.15s;',opacity:'0'},dotG);
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
let rvActiveLayer = 'precipitation_new'; // OWM layer key

const OWM_KEY = 'ed93a21d0dde1dc2d65d27099d174fd8';
const OWM_LAYERS = [
  { key: 'precipitation_new', label: 'Rain',  color: '#60a5fa' },
  { key: 'wind_new',          label: 'Wind',  color: '#34d399' },
  { key: 'clouds_new',        label: 'Cloud', color: '#94a3b8' },
  { key: 'temp_new',          label: 'Temp',  color: '#fb923c' },
];

function initRadar(lat, lon) {
  const panel = document.getElementById('panelRadar');

  if (!rvInited) {
    panel.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
    document.getElementById('tabRadar').classList.add('map-ready');
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
      </div>
      <div class="radar-layer-bar" id="rvLayerBar"></div>`;

    // Build layer switcher buttons
    const bar = document.getElementById('rvLayerBar');
    OWM_LAYERS.forEach(lyr => {
      const btn = document.createElement('button');
      btn.className = 'rvlyr-btn' + (lyr.key === rvActiveLayer ? ' active' : '');
      btn.dataset.key = lyr.key;
      btn.dataset.color = lyr.color;
      btn.textContent = lyr.label;
      btn.style.setProperty('--lyr-color', lyr.color);
      btn.addEventListener('click', () => {
        rvStop();
        rvActiveLayer = lyr.key;
        bar.querySelectorAll('.rvlyr-btn').forEach(b => b.classList.toggle('active', b.dataset.key === lyr.key));
        rvLoadFrames();
      });
      bar.appendChild(btn);
    });

    window.addEventListener('resize', () => { if (rvMap) rvMap.invalidateSize(); });

    rvMap = L.map('radarMap', {
      center: [lat, lon],
      zoom: 8,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxNativeZoom: 19, maxZoom: 19, subdomains: 'abcd'
    }).addTo(rvMap);

    L.circleMarker([lat, lon], {
      radius: 6, color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 1, weight: 2
    }).addTo(rvMap);

    document.getElementById('rvPlayBtn').addEventListener('click', rvTogglePlay);
    document.getElementById('rvTimeline').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      rvStop();
      rvShowFrame(Math.round(pct * (rvFrames.length - 1)));
    });

    rvInited = true;
  } else {
    rvMap.setView([lat, lon], 8);
    rvMap.eachLayer(l => { if (l._url && l._url.includes('openweathermap')) rvMap.removeLayer(l); });
    L.circleMarker([lat, lon], {
      radius: 6, color: '#fbbf24', fillColor: '#fbbf24', fillOpacity: 1, weight: 2
    }).addTo(rvMap);
  }

  rvLoadFrames();
}

async function rvLoadFrames() {
  try {
    document.getElementById('rvTimestamp').textContent = 'Loading…';
    rvStop();

    // OWM Weather Maps 2.0 uses Unix timestamps in the tile URL
    // 5 frames at 1-hour steps covering the past ~4 hours + now
    const now = Math.floor(Date.now() / 1000);
    const step = 3600; // 1 hour steps
    const frameCount = 5;
    const timestamps = Array.from({length: frameCount}, (_, i) =>
      now - (frameCount - 1 - i) * step
    );

    // Clear old OWM layers
    rvLayers.forEach(l => { if (rvMap.hasLayer(l)) rvMap.removeLayer(l); });
    rvLayers = [];

    rvFrames = timestamps.map(ts => {
      const d = new Date(ts * 1000);
      const h = d.getHours(), m = d.getMinutes();
      const label = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
      return { ts, label };
    });

    // Pre-create OWM tile layers
    rvFrames.forEach((frame) => {
      const url = `https://tile.openweathermap.org/map/${rvActiveLayer}/{z}/{x}/{y}.png?appid=${OWM_KEY}&date=${frame.ts}`;
      const layer = L.tileLayer(url, { opacity: 0, tileSize: 256, zIndex: 2 });
      rvLayers.push(layer);
      layer.addTo(rvMap);
    });

    rvPos = rvFrames.length - 1;
    rvShowFrame(rvPos);
    rvPlay();

    // Refresh every 10 min
    setTimeout(rvLoadFrames, 10 * 60 * 1000);
  } catch(e) {
    console.warn('OWM radar error:', e);
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
        'uv_index','cloud_cover','precipitation','weather_code','is_day',
        'visibility'
      ].join(','),
      hourly: [
        'temperature_2m','apparent_temperature','cape','lifted_index','convective_inhibition',
        'freezing_level_height','precipitation_probability','precipitation',
        'wind_speed_10m','wind_gusts_10m','wind_direction_10m',
        'relative_humidity_2m','surface_pressure','visibility','uv_index',
        'weather_code'
      ].join(','),
      daily: ['sunrise','sunset','precipitation_sum'].join(','),
      wind_speed_unit: 'mph',
      temperature_unit: 'fahrenheit',
      forecast_days: 7,

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
      window._omDaily  = data.daily;  // sunrise, sunset, precipitation_sum
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
    if (c.temperature_2m != null) {
      window._omCurrentTemp = Math.round(c.temperature_2m);
      // Re-paint gradient now that we have the real observed temp
      const _fp = window._forecastPeriods?.[0];
      const _bodyEl = document.getElementById('app');
      if (_fp && _bodyEl) {
        const _acc = weatherGradient(window._omCurrentTemp, _fp.shortForecast, _bodyEl);
        if (_acc) {
          document.documentElement.style.setProperty('--hero-accent', `rgb(${_acc})`);
          document.documentElement.style.setProperty('--hero-accent-faint', `rgba(${_acc},0.75)`);
          document.documentElement.style.setProperty('--hero-accent-dim', `rgba(${_acc},0.55)`);
        }
      }
    }

    // Patch hero icon from OM current weather_code — same source as hourly cards
    if (c.weather_code != null) {
      const isDay = c.is_day === 1;
      const iconEl = document.querySelector('.fch-icon');
      if (iconEl) iconEl.innerHTML = heroWxIcon(null, isDay, c.weather_code);
      // Also patch the "Now" hourly card icon (first card)
      const firstCard = document.querySelector('#hourlyTrack .hour-card');
      if (firstCard) {
        const iconSpan = firstCard.querySelector('.hc-icon');
        if (iconSpan) iconSpan.innerHTML = rowWxIcon(null, isDay, 32, c.weather_code);
      }
    }

    renderUVSlot();

    // Visibility (OM returns meters, convert to miles)
    if (c.visibility != null) {
      window._visibilityMi = (c.visibility / 1609.34).toFixed(1);
    }

    // Precip last 24h from hourly sum
    if (data.hourly?.precipitation) {
      const sum = data.hourly.precipitation.slice(0, 24).reduce((a, v) => a + (v || 0), 0);
      window._precip24h = sum.toFixed(2);
    }

    // Update hero extra stats if rendered
    renderHeroExtras();

    // Cloud cover %
    if (c.cloud_cover != null) set('obsCloud', c.cloud_cover);

    // Fill humid/dew from OM if NWS obs hasn't populated them yet
    if (document.getElementById('obsHumid').textContent === '—' && c.relative_humidity_2m != null)
      set('obsHumid', Math.round(c.relative_humidity_2m));
    if (document.getElementById('obsDew').textContent === '—' && c.dew_point_2m != null)
      set('obsDew', Math.round(c.dew_point_2m));
    if (document.getElementById('obsWind').textContent === '—' && c.wind_speed_10m != null)
      set('obsWind', Math.round(c.wind_speed_10m));

    const _os=document.getElementById('obsStrip');_os.dataset.active='1';document.getElementById('obsStripWrap')?.classList.remove('collapsed');

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
  // Fire Tomorrow.io non-blocking — it only updates the hero icon, not critical data
  fetchTomorrowRealtime(lat, lon);
  // Start or update SW background alert polling
  if (Notification.permission === 'granted') {
    if (_swReg?.active) startAlertPolling(lat, lon);
    else updatePollingLocation(lat, lon);
  }

  const [fc] = await Promise.all([
    fetchForecast(lat, lon),
    fetchAlerts(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`),
    fetchOpenMeteo(lat, lon),
  ]);
  const { periods, stationUrl } = fc;
  await Promise.all([
    fetchObservations(stationUrl),
    fetchNearby(lat, lon, stationUrl),
    renderAQISlot(lat, lon),
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

function setRiskLoading(on) {
  const el = document.getElementById('factorPlaceholder');
  if (!el) return;
  el.innerHTML = on
    ? `<div class="spinner"></div><div class="state-sub" style="margin-top:10px">Computing risk…</div>`
    : `<div class="state-icon"><svg width="34" height="34" fill="var(--dim)" viewBox="0 0 16 16"><path d="M6 0a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1zm2.5 3a.5.5 0 0 0-1 0v.5H5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1H7.5zM3 5.5A.5.5 0 0 1 3.5 5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 5.5M4.5 8a.5.5 0 0 0 0 1H7v.5a.5.5 0 0 0 1 0V9h.5a.5.5 0 0 0 0-1zM6 11a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1zm1 3a.5.5 0 0 0 0 1h.01a.5.5 0 0 0 0-1z"/></svg><div class="state-sub">Awaiting location data…</div>`;
}

function setActiveLocBtn(id) {
  document.getElementById('btnGeo').classList.toggle('primary', id === 'btnGeo');
  document.getElementById('btnNational').classList.toggle('primary', id === 'btnNational');
}

async function geoMe() {
  setActiveLocBtn('btnGeo');
  setRiskLoading(true);
  setLive('loading','LOCATING…');
  try {
    const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:6000}));
    curLat=pos.coords.latitude; curLon=pos.coords.longitude; curMode='geo';
    const locName = document.getElementById('locName').textContent;
    const locSub = document.getElementById('locSub').textContent;
    saveLocation(curLat, curLon, locName, locSub, curState, 'geo');
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
      saveLocation(curLat, curLon, d.city||'My Location', d.regionName||'', curState, 'geo');
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
    saveLocation(curLat, curLon, name, '', curState, 'search');
    saveRecent(curLat, curLon, name, curState||'');
    closeSearchOverlay();
    await fetchForPoint(curLat,curLon);
  }catch(e){
    setLive('err','NOT FOUND');
    document.getElementById('locSub').textContent=e.message;
  }
}

async function doNational(){
  setActiveLocBtn('btnNational');
  curMode='national'; curState=null;
  document.getElementById('locName').textContent='United States';
  document.getElementById('locSub').textContent='National View';
  const _os2=document.getElementById('obsStrip');delete _os2.dataset.active;document.getElementById('obsStripWrap')?.classList.add('collapsed');
  await fetchAlerts(`${NWS}/alerts/active`);
}


// Preserve the notification permission banner across panel re-renders
function withNotifBanner(fn) {
  const existing = document.getElementById('notifBanner');
  const clone = existing ? existing.cloneNode(true) : null;
  fn();
  if (clone && !document.getElementById('notifBanner')) {
    const box = document.getElementById('panelAlerts');
    if (box) {
      box.prepend(clone);
      // Re-attach button listeners since cloneNode strips them
      clone.querySelector('#notifYes')?.addEventListener('click', async () => {
        clone.remove();
        const result = await Notification.requestPermission();
        if (result === 'granted' && curLat) startAlertPolling(curLat, curLon);
      });
      clone.querySelector('#notifNo')?.addEventListener('click', () => clone.remove());
    }
  }
}

// ── Settings modal ───────────────────────────────────────────────────────────
const SETTINGS_KEY = 'sw_settings';

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}

function saveSettings(obj) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...obj })); } catch {}
}

function openSettings() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  modal.classList.add('open');
  updateSettingsUI();
}

function updateSettingsUI() {
  const s = loadSettings();

  // Default location label
  const locEl = document.getElementById('settingsDefaultLocName');
  if (locEl) {
    const defLoc = s.defaultLocation;
    locEl.textContent = defLoc ? defLoc.name || `${defLoc.lat.toFixed(2)}, ${defLoc.lon.toFixed(2)}` : 'Not set';
    locEl.style.color = defLoc ? 'var(--text)' : 'var(--dim)';
  }

  // Alert toggles — default all ON if no setting saved
  const toggles = {
    stNotifTornado: 'tornado',
    stNotifThunder: 'thunder',
    stNotifFlood:   'flood',
    stNotifWind:    'wind',
    stNotifWinter:  'winter',
    stNotifOther:   'other',
  };
  const prefs = s.alertPrefs || {};
  Object.entries(toggles).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.checked = prefs[key] !== false; // default true
  });

  // Notification status + test button
  updateNotifStatus();
}

function saveNotifSettings() {
  const toggles = {
    stNotifTornado: 'tornado',
    stNotifThunder: 'thunder',
    stNotifFlood:   'flood',
    stNotifWind:    'wind',
    stNotifWinter:  'winter',
    stNotifOther:   'other',
  };
  const prefs = {};
  Object.entries(toggles).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) prefs[key] = el.checked;
  });
  saveSettings({ alertPrefs: prefs });
  // Push updated prefs to SW
  const sw = _swReg?.active;
  if (sw) sw.postMessage({ type: 'UPDATE_PREFS', prefs });
}

function setDefaultLocation() {
  if (!curLat) return;
  const name = document.getElementById('locName')?.textContent || 'My Location';
  saveSettings({ defaultLocation: { lat: curLat, lon: curLon, name } });
  updateSettingsUI();
}

function clearDefaultLocation() {
  saveSettings({ defaultLocation: null });
  updateSettingsUI();
}

// On startup, load default location from settings if no cached location exists
function applyDefaultLocationIfNeeded() {
  const cached = localStorage.getItem('sw_loc');
  if (cached) return; // already has a last-used location
  const s = loadSettings();
  if (s.defaultLocation) {
    const { lat, lon, name } = s.defaultLocation;
    curLat = lat; curLon = lon; curMode = 'search';
    const locEl = document.getElementById('locName');
    if (locEl) locEl.textContent = name;
    fetchForPoint(lat, lon);
  }
}

// ── Notification test + status ───────────────────────────────────────────────
async function sendTestNotification() {
  if (!('Notification' in window)) {
    alert('Notifications are not supported on this device.');
    return;
  }
  if (Notification.permission !== 'granted') {
    alert('Notifications are not enabled. Open the Alerts tab to turn them on.');
    return;
  }
  try {
    new Notification('⛈️ Severe Thunderstorm Warning', {
      body: 'Johnson County · 70 mph winds and golf ball hail · until 6:15 PM',
      icon: '/icon.png',
    });
  } catch(e) {
    alert('Could not send test notification: ' + e.message);
  }
}

// Update the notification status text in the info modal whenever it opens
function updateNotifStatus() {
  const el = document.getElementById('notifStatusText');
  if (!el) return;
  // Wire test button here so it's always attached fresh when modal opens
  const btn = document.getElementById('testNotifBtn');
  if (btn) {
    btn.replaceWith(btn.cloneNode(true)); // strip any old listeners
    document.getElementById('testNotifBtn').addEventListener('click', sendTestNotification);
  }
  if (!('Notification' in window)) {
    el.textContent = 'Not supported on this device.';
  } else if (Notification.permission === 'granted') {
    el.textContent = '✓ Enabled — background alerts are active.';
    el.style.color = 'var(--green)';
  } else if (Notification.permission === 'denied') {
    el.textContent = 'Blocked — enable in iOS Settings › StormWatch.';
    el.style.color = 'var(--orange)';
  } else {
    el.textContent = 'Not yet enabled. Open the Alerts tab to turn on.';
  }
}

// ── Smart refresh interval ───────────────────────────────────────────────────
// 3 min when rain conditions are elevated, 15 min otherwise.
function smartRefreshInterval() {
  const FAST = 3 * 60 * 1000;   // 3 min
  const SLOW = 15 * 60 * 1000;  // 15 min

  // 1. Active NWS alert for rain/storm/flood/tornado
  const stormAlertTypes = /tornado|thunderstorm|flash.?flood|flood|severe.?storm|tropical/i;
  const hasStormAlert = (allAlerts || []).some(a => {
    const ev = a.properties?.event || '';
    const sev = a.properties?.severity || '';
    return stormAlertTypes.test(ev) || sev === 'Extreme' || sev === 'Severe';
  });
  if (hasStormAlert) return FAST;

  // 2. Storm/thunder in current NWS forecast periods (today + tonight)
  const periods = window._forecastPeriods || [];
  const stormFcText = /thunder|tstm|storm|tornado/i;
  const nearTermStorm = periods.slice(0, 2).some(p =>
    stormFcText.test(p.shortForecast || '') || stormFcText.test(p.detailedForecast || '')
  );
  if (nearTermStorm) return FAST;

  // 3. Precipitation probability >50% in next 2 NWS periods
  const highPrecip = periods.slice(0, 2).some(p =>
    (p.probabilityOfPrecipitation?.value ?? 0) > 50
  );
  if (highPrecip) return FAST;

  return SLOW;
}

async function refresh(){
  if(curMode==='national')await doNational();
  else if(curLat)await fetchForPoint(curLat,curLon);
}


// ── Search autocomplete ──────────────────────────────────────────────────────
let _acTimer = null;
let _acAbort = null;

function closeDropdown() {
  const dd = document.getElementById('searchDropdown');
  if (dd) { dd.classList.remove('open'); dd.innerHTML = ''; }
}

async function fetchSuggestions(q) {
  if (_acAbort) _acAbort.abort();
  _acAbort = new AbortController();
  const dd = document.getElementById('searchDropdown');
  if (!dd) return;

  // ZIP: show single suggestion immediately
  if (/^\d{5}$/.test(q)) {
    dd.innerHTML = `<div class="sdrop-item" onclick="selectSuggestion(null,null,'${q}','')"><span>${q}</span><span class="sdrop-item-sub">ZIP Code</span></div>`;
    dd.classList.add('open');
    return;
  }

  if (q.length < 2) { closeDropdown(); return; }

  dd.innerHTML = '<div class="sdrop-loading">Searching…</div>';
  dd.classList.add('open');

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=us&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'StormWatch-PWA/2.0' }, signal: _acAbort.signal }
    );
    const results = await r.json();
    if (!results.length) { dd.innerHTML = '<div class="sdrop-loading">No results</div>'; return; }

    dd.innerHTML = results.map(p => {
      const name = p.address?.city || p.address?.town || p.address?.village || p.address?.county || p.name || '';
      const state = p.address?.state || '';
      const label = name + (state ? ', ' + state : '');
      const sub = p.address?.county || '';
      const lat = parseFloat(p.lat).toFixed(4);
      const lon = parseFloat(p.lon).toFixed(4);
      return `<div class="sdrop-item" onmousedown="selectSuggestion(${lat},${lon},${JSON.stringify(label)},${JSON.stringify(state)})" ontouchstart="selectSuggestion(${lat},${lon},${JSON.stringify(label)},${JSON.stringify(state)})">
        <span>${label}</span>
        ${sub ? `<span class="sdrop-item-sub">${sub}</span>` : ''}
      </div>`;
    }).join('');
    dd.classList.add('open');
  } catch(e) {
    if (e.name !== 'AbortError') { dd.innerHTML = '<div class="sdrop-loading">Search error</div>'; }
  }
}

let _selecting = false;
async function selectSuggestion(lat, lon, label, state) {
  if (_selecting) return;
  _selecting = true;
  closeDropdown();
  const inp = document.getElementById('searchInput');
  inp.removeEventListener('input', _inputHandler); // stop input event from re-triggering
  inp.value = '';
  inp.blur();
  if (lat === null) {
    inp.value = label;
    inp.addEventListener('input', _inputHandler);
    _selecting = false;
    await doSearch();
    return;
  }
  curLat = lat; curLon = lon; curMode = 'search';
  curState = state || null;
  document.getElementById('locName').textContent = label;
  document.getElementById('locSub').textContent = '';
  setActiveLocBtn(null);
  saveLocation(curLat, curLon, label, '', curState, 'search');
  saveRecent(curLat, curLon, label, state);
  closeSearchOverlay();
  inp.addEventListener('input', _inputHandler);
  _selecting = false;
  await fetchForPoint(curLat, curLon);
}

// ── SEARCH RECENTS ───────────────────────────────────────────────────────────
function getRecents() {
  try { return JSON.parse(localStorage.getItem('sw_recents') || '[]'); } catch { return []; }
}
function saveRecent(lat, lon, name, state) {
  try {
    let recents = getRecents().filter(r => r.name !== name);
    recents.unshift({ lat, lon, name, state });
    recents = recents.slice(0, 8);
    localStorage.setItem('sw_recents', JSON.stringify(recents));
  } catch {}
}
function renderRecents() {
  const el = document.getElementById('searchRecents');
  if (!el) return;
  const recents = getRecents();
  if (!recents.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="search-recents">
    <div class="search-recents-hdr">
      <span class="search-recents-ttl">Recents</span>
      <button class="search-recents-clear" onclick="clearRecents()">Clear</button>
    </div>
    ${recents.map(r => `
      <div class="search-recent-item" onclick="selectRecent(${r.lat},${r.lon},${JSON.stringify(r.name)},${JSON.stringify(r.state||'')})">
        <svg class="search-recent-icon" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/></svg>
        <div>
          <div class="search-recent-name">${r.name}</div>
          ${r.state ? `<div class="search-recent-sub">${r.state}</div>` : ''}
        </div>
      </div>`).join('')}
  </div>`;
}
function clearRecents() {
  localStorage.removeItem('sw_recents');
  renderRecents();
}
function openSearchOverlay() {
  const ov = document.getElementById('searchOverlay');
  ov.style.display = 'flex';
  renderRecents();
  setTimeout(() => document.getElementById('searchInput')?.focus(), 50);
}
function closeSearchOverlay() {
  document.getElementById('searchOverlay').style.display = 'none';
  closeDropdown();
}
async function selectRecent(lat, lon, name, state) {
  closeSearchOverlay();
  curLat = lat; curLon = lon; curMode = 'search'; curState = state || null;
  document.getElementById('locName').textContent = name;
  document.getElementById('locSub').textContent = state || '';
  setActiveLocBtn(null);
  saveLocation(curLat, curLon, name, state, curState, 'search');
  await fetchForPoint(curLat, curLon);
}

// ── LOCATION CACHE ───────────────────────────────────────────────────────────
function saveLocation(lat, lon, name, sub, state, mode) {
  try {
    localStorage.setItem('sw_loc', JSON.stringify({ lat, lon, name, sub, state, mode, ts: Date.now() }));
  } catch(e) {}
}

function loadCachedLocation() {
  try {
    const raw = localStorage.getItem('sw_loc');
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.lat && d.lon) return d;
  } catch(e) {}
  return null;
}

// ── INIT ─────────────────────────────────────────
function _inputHandler(e) {
  clearTimeout(_acTimer);
  const q = e.target.value.trim();
  if (!q) { closeDropdown(); return; }
  _acTimer = setTimeout(() => fetchSuggestions(q), 300);
}

window.addEventListener('load', async () => {
  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { closeDropdown(); doSearch(); }
    if (e.key === 'Escape') closeDropdown();
  });
  document.getElementById('searchInput').addEventListener('input', _inputHandler);
  document.getElementById('searchInput').addEventListener('blur', () => {
    if (_selecting) return; // don't close while selection is in progress
    setTimeout(closeDropdown, 350);
  });
  document.getElementById('btnSearch').addEventListener('click',doSearch);
  document.getElementById('btnGeo').addEventListener('click',geoMe);
  document.getElementById('btnNational').addEventListener('click',doNational);
  document.querySelectorAll('.fbtn').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.f)));
  document.querySelectorAll('.cmb').forEach(b=>b.addEventListener('click',()=>applySpiderMode(b.dataset.cm)));
  // Apply default location if no cached location exists
  applyDefaultLocationIfNeeded();
  // Auto-load last location on startup
  const cached = loadCachedLocation();
  if (cached) {
    curLat = cached.lat; curLon = cached.lon; curMode = cached.mode || 'search';
    curState = cached.state || null;
    document.getElementById('locName').textContent = cached.name || 'My Location';
    document.getElementById('locSub').textContent = cached.sub || '';
    if (cached.mode === 'geo') setActiveLocBtn('btnGeo');
    else setActiveLocBtn(null);
    setRiskLoading(true);
    await fetchForPoint(curLat, curLon);
    // Silently refresh GPS in background if last session used GPS
    if (cached.mode === 'geo' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        if (Math.abs(lat - curLat) > 0.01 || Math.abs(lon - curLon) > 0.01) {
          curLat = lat; curLon = lon;
          saveLocation(lat, lon, cached.name, cached.sub, cached.state, 'geo');
          fetchForPoint(lat, lon);
        }
      }, () => {}, { timeout: 8000 });
    }
  } else {
    // First launch — try GPS, fall back to IP, then national
    await geoMe();
  }
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

// ── SCROLL: hide obs-strip on scroll down, show on scroll up/top ──
(function() {
  const body = document.getElementById('body');
  if (!body) return;
  let hidden = false;
  body.addEventListener('scroll', () => {
    const y = body.scrollTop;
    const strip = document.getElementById('obsStrip');
    const wrap  = document.getElementById('obsStripWrap');
    if (!strip || !wrap || !strip.dataset.active) return;
    if (y > 10 && !hidden) {
      wrap.classList.add('collapsed');
      hidden = true;
    } else if (y <= 10 && hidden) {
      wrap.classList.remove('collapsed');
      hidden = false;
    }
  }, { passive: true });

  // ── Parallax on wx overlay PNG ──
  body.addEventListener('scroll', () => {
    const ov = document.getElementById('wxOverlay');
    if (!ov || !ov.style.backgroundImage) return;
    const offset = Math.round(body.scrollTop * 0.3);
    ov.style.backgroundPositionY = `calc(0px + ${offset}px)`;
  }, { passive: true });
})();
