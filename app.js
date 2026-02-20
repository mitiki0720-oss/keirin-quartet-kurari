/* BUILD: exfix-lock-02 */
/* =========
  Keirin Quartet - Minimal SPA
  - hash routing: #/ , #/venues , #/today , #/predict , #/players
  - localStorage persistence
=========== */

// inject visible build badge so we can confirm the browser is loading THIS file
if(!window.__buildBadgeAdded){
  window.__buildBadgeAdded = true;
  window.__BUILD_ID__ = 'exfix-lock-02';
  (function(){
    const build = 'exfix-lock-02';
    const id = 'buildBadge';
    function make(){
      if(document.getElementById(id)) return;
      const d = document.createElement('div');
      d.id = id;
      d.textContent = `[BUILD] ${build} ${location.href}`;
      d.setAttribute('aria-hidden','true');
      d.style.position = 'fixed';
      d.style.top = '8px';
      d.style.right = '8px';
      d.style.zIndex = '2147483647';
      d.style.background = 'rgba(0,0,0,0.78)';
      d.style.color = '#fff';
      d.style.padding = '6px 10px';
      d.style.borderRadius = '8px';
      d.style.fontSize = '12px';
      d.style.fontWeight = '700';
      d.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';
      d.style.pointerEvents = 'none';
      try{ document.body.appendChild(d); }catch(e){ /* body may not exist yet */ }
    }
    document.addEventListener('DOMContentLoaded', make);
    if(document.readyState === 'interactive' || document.readyState === 'complete'){ make(); }
    try{ console.log('[BUILD] exfix-lock-02'); }catch(e){}
  })();
}

// EOF balance guard
/*
  Legacy/Open-Meteo weather block disabled.
  Use the later WEATHER_PINS_KEY implementation (normalizeWeatherPins/ensureWeatherPinsLoaded).
*/


// Wire EX scrollbar buttons for a given root (idempotent per DOM)
function wireExScrollControls(root){
  if(!root) return;
  const wrap  = root.querySelector('.exTableWrap');
  const shell = root.querySelector('.exTableShell');
  const bar   = root.querySelector('.exScrollBar');
  if(!wrap || !shell || !bar) return;

  if(bar.dataset.wired === '1') return; // already wired
  bar.dataset.wired = '1';

  bar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if(!btn) return;

    // ◀ / ▶
    if(btn.dataset.dir){
      const dir = Number(btn.dataset.dir) || 0;
      const step = Math.max(320, Math.floor(wrap.clientWidth * 0.85));
      wrap.scrollBy({ left: dir * step, behavior: 'smooth' });
      return;
    }

    // toggle
    if(btn.dataset.action === 'toggle'){
      const collapsed = shell.classList.toggle('is-collapsed');
      try{ localStorage.setItem('exStatsCollapsed', collapsed ? '1' : '0'); }catch(e){}
      // sync labels
      try{ root.querySelectorAll('.exToggleBtn').forEach(b => b.textContent = collapsed ? '成績を表示' : '成績を隠す'); }catch(e){}
    }
  });
}
const $view = document.getElementById("view");

console.log('[APP VERSION] exfix-lock-02');
// ensure default: show stats unless user explicitly collapsed
try{
  if(localStorage.getItem('exStatsCollapsed') === null){
    localStorage.setItem('exStatsCollapsed','0');
  }
}catch(e){ /* ignore */ }

// --- storage keys ---
const KEY = {
  venues: "kq_venues_v1",
  todayRaces: "kq_today_races_v1",
  players: "kq_players_v1",
  // rider master storage
  riders: "kq_rider_master_v1",
};

// Asset helper: use relative paths so file:// and Live Server behave consistently
const ASSET_BASE = './assets/';
const asset = (p) => (String(p||'').startsWith('./') ? String(p) : (ASSET_BASE + String(p||'')));

// ----- Rider master helpers -----
const RIDER_MASTER_KEY = 'kq_rider_master_v1';
function loadRiderMaster(){
  let master = {};
  try{ master = JSON.parse(localStorage.getItem(RIDER_MASTER_KEY) || '{}') || {}; }catch(e){ master = {}; }

  // legacy: also merge players list array stored under KEY.players
  try{
    const list = loadJSON(KEY.players, []);
    if(Array.isArray(list)){
      for(const p of list){
        if(!p) continue;
        const key = makeRiderKeyFrom(p) || (`name:${normalizeRiderName(p.name||'')}`);
        if(!key) continue;
        if(!master[key]) master[key] = p; // prefer existing master entries
      }
    }
  }catch(e){ /* ignore */ }
  return master;
}
function saveRiderMaster(obj){
  try{ localStorage.setItem(RIDER_MASTER_KEY, JSON.stringify(obj || {})); }catch(e){}
  // also keep KEY.players as an array for legacy UIs
  try{
    const arr = Object.values(obj || {});
    localStorage.setItem(KEY.players, JSON.stringify(arr));
  }catch(e){ /* ignore */ }
}

function normalizeRiderName(name){
  if(!name) return '';
  try{
    // NFKC, remove spaces and common punctuation
    let s = String(name).normalize('NFKC');
    s = s.replace(/[\s　\-\._!！\?？\(\)\(\)\[\]「」『』,、。\/\\\u3000]/g,'');
    return s.toLowerCase();
  }catch(e){ return String(name).replace(/\s+/g,'').toLowerCase(); }
}

function makeRiderKeyFrom(obj){
  if(!obj) return '';
  if(obj.id) return `id:${String(obj.id)}`;
  const name = normalizeRiderName(obj.name || obj.player || '');
  const pref = String(obj.pref || obj.area || obj.branch || '').trim();
  const period = String(obj.period || '').trim();
  return `${name}|${pref}|${period}`;
}

// safeText: avoid [object Object] in textareas
function safeText(x){
  if(x == null) return "";
  if(typeof x === 'string') return x;
  try{ return JSON.stringify(x, null, 2); }catch(e){ return String(x); }
}

function raceKey(date, venue, raceNo){
  return `${date}|${venue}|${Number(raceNo)}`;
}

// Resolve venue id by name using normalizeVenueName -> returns '' if not found
function kqResolveVenueIdByName(venueName){
  if(!venueName) return '';
  try{
    const vn = normalizeVenueName(venueName);
    const found = (Array.isArray(VENUES) ? VENUES : []).find(v => normalizeVenueName(v.name || '') === vn || normalizeVenueName(v.name || '').includes(vn) || (v.name||'').includes(venueName));
    return found ? (found.id || '') : '';
  }catch(e){ return ''; }
}

// Get venue memo by venue name: prefer localStorage venueText:<id>, fallback to KEY.venues array
function kqGetVenueMemoByName(venueName){
  if(!venueName) return '';
  try{
    const id = kqResolveVenueIdByName(venueName);
    if(id){ const t = localStorage.getItem(`venueText:${id}`); if(t != null) return String(t); }
  }catch(e){}
  // fallback to legacy venues storage
  try{
    const arr = loadJSON(KEY.venues, []);
    if(Array.isArray(arr)){
      const hit = arr.find(x => x && normalizeVenueName(x.name || '') === normalizeVenueName(venueName));
      if(hit && hit.note) return String(hit.note);
    }
  }catch(e){}
  return '';
}

// helper: resolve venue id by name (search VENUES list)
function resolveVenueIdByName(venue){
  if(!venue) return null;
  const full = normalizeVenueName(venue);
  const found = VENUES.find(v => normalizeVenueName(v.name || '') === full || normalizeVenueName(v.name || '').includes(full) || (v.name||'').includes(venue));
  return found ? found.id : null;
}

// localStorage key for venue memo
const venueKeyOf = (id) => `venueText:${id}`;

// sanitize filename for ZIP entries
function safeFileName(name){
  if(!name) return 'unknown';
  return String(name).replace(/[^a-zA-Z0-9\-_\u3000-\u303F\u3040-\u30FF\u4E00-\u9FFF\. ]+/g,'').trim().replace(/\s+/g,'_').slice(0,120);
}

// --- Past Races DB (IndexedDB) ---
const KQ_DB = { name: "KQ_DB", version: 1, store: "raceBundles", indexDate: "by_date" };

function openKqDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KQ_DB.name, KQ_DB.version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(KQ_DB.store)){
        const store = db.createObjectStore(KQ_DB.store, { keyPath: "id" });
        store.createIndex(KQ_DB.indexDate, "date", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutRaceBundle(rec){
  const db = await openKqDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KQ_DB.store, "readwrite");
    tx.objectStore(KQ_DB.store).put(rec);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbListByDateRange(startISO, endISO){
  const db = await openKqDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KQ_DB.store, "readonly");
    const store = tx.objectStore(KQ_DB.store);
    const idx = store.index(KQ_DB.indexDate);
    const range = IDBKeyRange.bound(startISO, endISO);
    const out = [];
    idx.openCursor(range).onsuccess = (e) => {
      const cur = e.target.result;
      if(cur){ out.push(cur.value); cur.continue(); }
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetById(id){
  const db = await openKqDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KQ_DB.store, "readonly");
    const req = tx.objectStore(KQ_DB.store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function persistImportedRaceBundle({ dateISO, venueKey, bundleObj, sourceZipName }){
  if(!dateISO || !venueKey || !bundleObj) return;
  const id = `${dateISO}__${venueKey}`;
  const rec = { id, date: dateISO, venue: venueKey, sourceZipName: sourceZipName || "", importedAt: new Date().toISOString(), bundle: bundleObj };
  try{ await dbPutRaceBundle(rec); }catch(e){ console.warn('persistImportedRaceBundle failed', e); }
}

// buildRaceBundle: integrate saved race, venue memo, weather, players info
async function buildRaceBundle(date, venue, raceNo){
  const bundle = { date: date || todayYMD(), venue: venue||'', raceNo: String(raceNo||''), raceKey: '', race: null, weatherHourlyText: '', venueInfoText: '', playersLinked: [], playersMissing: [], playersRaw: null, statsRaw: null, exRaw: null };
  bundle.raceKey = raceKey(bundle.date, bundle.venue, bundle.raceNo);

  // 1) prefer saved race from TODAY data
  try{
    const TODAY_DATA_KEY = 'todayRace_data_v1';
    const all = loadJSON(TODAY_DATA_KEY, {});
    const day = all[bundle.date] || { date: bundle.date, venues: {} };
    const v = day.venues || {};
    if(v && v[bundle.venue] && v[bundle.venue].races && v[bundle.venue].races[bundle.raceNo]){
      bundle.race = v[bundle.venue].races[bundle.raceNo];
    }
  }catch(e){ /* ignore */ }

  // 2) attempt to find race by loose matching if exact venue key not found
  if(!bundle.race){
    try{
      const TODAY_DATA_KEY = 'todayRace_data_v1';
      const all = loadJSON(TODAY_DATA_KEY, {});
      const day = all[bundle.date] || { date: bundle.date, venues: {} };
      const venuesObj = day.venues || {};
      const key = Object.keys(venuesObj).find(k => normalizeVenueName(k) === normalizeVenueName(bundle.venue) || k.includes(bundle.venue) || normalizeVenueName(k).includes(normalizeVenueName(bundle.venue)));
      if(key && venuesObj[key] && venuesObj[key].races) bundle.race = venuesObj[key].races[String(bundle.raceNo)] || null;
    }catch(e){ }
  }

  // 3) try to attach ZIP-style data if present in localStorage (non-destructive)
  try{
    const zipStore = loadJSON('kq_predict_zip_v1_data', null) || loadJSON('kq_predict_zip_v1', null) || null;
    if(zipStore && typeof zipStore === 'object'){
      // look for a race.json like object under zipStore.race or zipStore.raceJson
      const raceCandidate = zipStore.race || zipStore.raceJson || zipStore.race_data || null;
      if(raceCandidate && raceCandidate.entries){
        // if bundle.race missing, prefer zip
        if(!bundle.race) bundle.race = raceCandidate;
        bundle.statsRaw = zipStore.stats || zipStore.stats_json || zipStore['stats/recent_results.json'] || bundle.statsRaw;
        bundle.exRaw = zipStore.ex || zipStore.ex_json || zipStore['ex/ex.json'] || bundle.exRaw;

        // attach raw ex text if present
        try{ if(!bundle.exRaw && zipStore.raw && zipStore.raw.rawtexts) bundle.exRaw = { rawText: zipStore.raw.rawtexts }; }catch(e){}

        // attempt to build recent map from stats and/or ex raw
        try{
          let recentMap = {};
          // statsRaw may contain recent_results.json or similar
          const statsObj = bundle.statsRaw || {};
          if(statsObj && typeof statsObj === 'object'){
            // try common keys
            recentMap = statsObj.recent_results || statsObj.recent || statsObj || {};
          }

          // ensure keys are strings
          const normalizedRecent = {};
          for(const k of Object.keys(recentMap||{})) normalizedRecent[String(k)] = recentMap[k];

          // find missing cars from entries
          const entries = (bundle.race && (Array.isArray(bundle.race.entries) ? bundle.race.entries : (Array.isArray(bundle.race.lineup) ? bundle.race.lineup : []))) || [];
          const missing = [];
          for(const en of entries){ const car = String(en.car || en.carNo || en.no || ''); if(car && !normalizedRecent[car]) missing.push(car); }

          if(missing.length && bundle.exRaw){
            // try parse recent from ex raw using existing parser
            try{
              const fakeRace = Object.assign({}, bundle.race || {}, { ex: bundle.exRaw });
              const parsed = (typeof parseRecentFromRawText === 'function') ? parseRecentFromRawText(fakeRace) : {};
              for(const m of missing){ if(parsed && parsed[m]) normalizedRecent[m] = parsed[m]; }
            }catch(e){ /* ignore */ }
          }

          bundle.recentMap = normalizedRecent;
          // also expose on race for downstream functions that call parseRecentFromRawText
          try{ if(bundle.race) bundle.race._recentMap = normalizedRecent; }catch(e){}
        }catch(e){ /* ignore */ }
      }
    }
  }catch(e){ }

  // 4) weather: try resolver + fetch hourly and format
  try{
    const loc = (typeof kqResolveLatLonForVenue === 'function') ? await kqResolveLatLonForVenue(bundle.venue) : ((typeof kqGetLatLonForVenue === 'function') ? kqGetLatLonForVenue(bundle.venue) : null);
    if(loc && (loc.lat != null) && (loc.lon != null || loc.lng != null)){
      const wf = await kqFetchTodayForecast(loc.lat, loc.lon ?? loc.lng);
      bundle.weatherHourlyText = wf ? formatHourlyFromWF(wf, bundle.date) : '';
      bundle.weatherRaw = wf || null;
    }
  }catch(e){ /* ignore */ }

  // 5) venue info from venues memo
  try{
    const venuesMemo = loadJSON(KEY.venues, []) || [];
    const vm = (venuesMemo || []).find(x => x && (x.name === bundle.venue || normalizeVenueName(x.name) === normalizeVenueName(bundle.venue) || x.name.includes(bundle.venue))) || null;
    if(vm) bundle.venueInfoText = vm.note || vm.memo || '';
  }catch(e){ }

  // 6) players: link entries to players DB and collect missing
  try{
    const entries = (bundle.race && (Array.isArray(bundle.race.entries) ? bundle.race.entries : (Array.isArray(bundle.race.lineup) ? bundle.race.lineup : []))) || [];
    const playersList = loadJSON(KEY.players, []) || [];
    const playersMap = {};
    for(const p of playersList){ const n = normalizeRiderName(p.name||p.player||''); if(n) playersMap[n] = p; }
    for(const en of entries){
      const name = en.name || en.player || '';
      let norm = normalizeRiderName(name || '');
      let linked = playersMap[norm] || null;
      if(!linked){
        // try relaxed variants
        const alt = String(name || '').replace(/\s+/g,'').replace(/・/g,'').normalize('NFKC');
        norm = normalizeRiderName(alt);
        linked = playersMap[norm] || null;
      }
      if(linked) bundle.playersLinked.push({ entry: en, player: linked });
      else bundle.playersMissing.push(name || '');
    }
    // if ZIP had linked_players.json but with null players, try to resolve from players DB
    try{
      const zipStore = loadJSON('kq_predict_zip_v1_data', null) || loadJSON('kq_predict_zip_v1', null) || null;
      if(zipStore && zipStore.players && Array.isArray(zipStore.players.linked_players)){
        const seen = new Set((bundle.playersLinked||[]).map(x=> normalizeRiderName((x.entry && (x.entry.name||x.entry.player||''))||'')));
        for(const lp of zipStore.players.linked_players){
          try{
            const en = lp.entry || lp;
            const pname = (lp.player && lp.player.name) ? lp.player.name : (en && (en.name||en.player||''));
            const norm = normalizeRiderName(pname||'');
            if(seen.has(norm)) continue;
            if(lp.player && lp.player.name){
              bundle.playersLinked.push({ entry: en, player: lp.player });
              seen.add(norm);
              continue;
            }
            // player null -> try find in playersMap
            const found = playersMap[norm] || null;
            if(found){ bundle.playersLinked.push({ entry: en, player: found }); seen.add(norm); }
          }catch(e){ /* ignore per-item */ }
        }
      }
    }catch(e){ /* ignore */ }
  }catch(e){ }

  // 7) attach raw texts when present
  try{
    if(bundle.race){ bundle.raceRaw = bundle.race; }
  }catch(e){}

  return bundle;
}

// midnight purge timer guard
let midnightTimerSet = false;

// keys/ prefixes related to "today" data that should be purged when date changes
const TODAY_LAST_DATE_KEY = 'today:lastDate';
const TODAY_KEY_PREFIXES = [
  'todayRace_',    // todayRace_data_v1, todayRace_ui_v1
  'kq_today_races_v1',
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(e){
    console.warn('[saveJSON] failed for', key, e);
  }
}

// ===== Weather pins (manual override) =====
const WEATHER_PINS_KEY = 'kq_weather_pins_v1';
function parseLatLonValue(v){
  if (v == null) return null;
  if (typeof v === 'string') {
    const m = v.trim().match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = Number(m[1]), lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  if (Array.isArray(v) && v.length >= 2) {
    const lat = Number(v[0]), lon = Number(v[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  if (typeof v === 'object') {
    const lat = Number(v.lat ?? v.latitude);
    const lon = Number(v.lon ?? v.lng ?? v.longitude ?? v.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  return null;
}

function kqParseLatLon(val){
  if(!val) return null;

  // {lat, lng} / {lat, lon}
  if(typeof val === "object"){
    const lat = Number(val.lat);
    const lon = Number(val.lon ?? val.lng);
    if(Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }

  // "lat,lon" string
  const s = String(val).trim();
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if(!m) return null;

  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function normalizeWeatherPins(obj){
  const out = {};
  const src = (obj && typeof obj === 'object') ? obj : {};

  for (const k of Object.keys(src)) {
    const name = normalizeVenueName(k);
    const v = src[k];
    let p = null;
    // prefer kqParseLatLon if available
    try{ p = (typeof kqParseLatLon === 'function') ? kqParseLatLon(v) : parseLatLonValue(v); }catch(e){ p = parseLatLonValue(v); }
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
      out[name] = { lat: Number(p.lat), lon: Number(p.lon) };
    }
  }

  // fallback from venue_pins sources (support longitude/latitude keys)
  const fallback = loadJSON('venue_pins_v1', null) || window.VENUE_PINS || window.VENUE_PINS_V1 || null;
  if (fallback && typeof fallback === 'object'){
    for (const k of Object.keys(fallback)){
      const key = normalizeVenueName(k);
      if (out[key]) continue;
      const pRaw = fallback[k];
      if (!pRaw || typeof pRaw !== 'object') continue;
      const lat = Number(pRaw.lat ?? pRaw.latitude);
      const lon = Number(pRaw.lon ?? pRaw.lng ?? pRaw.longitude);
      if(Number.isFinite(lat) && Number.isFinite(lon)) out[key] = { lat, lon };
    }
  }

  return out;
}

function ensureWeatherPinsLoaded(){
  if (window.VENUE_WEATHER_PINS) return window.VENUE_WEATHER_PINS;
  const raw = loadJSON(WEATHER_PINS_KEY, {});
  const out = {};
  try{
    if (raw && typeof raw === 'object'){
      for(const k of Object.keys(raw)){
        const nk = normalizeVenueName(k);
        const v = raw[k];
        const p = parseLatLonValue(v) || (typeof kqParseLatLon === 'function' ? kqParseLatLon(v) : null);
        if(p && Number.isFinite(p.lat) && Number.isFinite(p.lon)){
          out[nk] = { lat: Number(p.lat), lon: Number(p.lon) };
        }
      }
    }
  }catch(e){ console.warn('ensureWeatherPinsLoaded: normalize failed', e); }

  // fallback normalization from older sources
  try{
    const fallback = loadJSON('venue_pins_v1', null) || window.VENUE_PINS || window.VENUE_PINS_V1 || null;
    if (fallback && typeof fallback === 'object'){
      for (const k of Object.keys(fallback)){
        const nk = normalizeVenueName(k);
        if (out[nk]) continue;
        const pRaw = fallback[k];
        const lat = Number(pRaw.lat ?? pRaw.latitude);
        const lon = Number(pRaw.lon ?? pRaw.lng ?? pRaw.longitude);
        if(Number.isFinite(lat) && Number.isFinite(lon)) out[nk] = { lat, lon };
      }
    }
  }catch(e){ /* ignore */ }

  try{ saveJSON(WEATHER_PINS_KEY, out); }catch(e){ }
  window.VENUE_WEATHER_PINS = out;
  return window.VENUE_WEATHER_PINS;
}

// Geocoding helper using Open-Meteo's geocoding API
async function geocodeOpenMeteo(query){
  try{
    const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
    u.searchParams.set('name', String(query || ''));
    u.searchParams.set('count', '1');
    u.searchParams.set('language', 'ja');
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if(!res.ok) return null;
    const j = await res.json();
    if(j && Array.isArray(j.results) && j.results.length > 0){
      const r = j.results[0];
      const lat = Number(r.latitude); const lon = Number(r.longitude);
      if(Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
  }catch(e){ console.warn('geocodeOpenMeteo failed', e); }
  return null;
}

// Resolve lat/lon for venue: try stored pin, then geocode and persist
async function kqResolveLatLonForVenue(venue){
  if(!venue) return null;
  // 1) try existing pins
  const p0 = (typeof kqGetLatLonForVenue === 'function') ? kqGetLatLonForVenue(venue) : null;
  if(p0 && Number.isFinite(p0.lat) && Number.isFinite(p0.lon)) return p0;

  // 2) geocode
  const q = `${normalizeVenueName(venue)} 競輪場`;
  const g = await geocodeOpenMeteo(q);
  if(!g) return null;

  // persist under normalized key
  try{
    const raw = loadJSON(WEATHER_PINS_KEY, {}) || {};
    raw[normalizeVenueName(venue)] = { lat: g.lat, lon: g.lon };
    persistWeatherPins(raw);
  }catch(e){ console.warn('persist geocoded pin failed', e); }

  // update in-memory cache
  try{ window.VENUE_WEATHER_PINS = window.VENUE_WEATHER_PINS || {}; window.VENUE_WEATHER_PINS[normalizeVenueName(venue)] = { lat: g.lat, lon: g.lon }; }catch(e){}
  return { lat: g.lat, lon: g.lon };
}

function persistWeatherPins(pins){
  const norm = normalizeWeatherPins(pins);
  try{ saveJSON(WEATHER_PINS_KEY, norm); }catch(e){}
  window.VENUE_WEATHER_PINS = norm;
  return norm;
}

// === bridge: weather pins -> lat/lon resolver ===
function kqGetLatLonForVenue(venue){
  ensureWeatherPinsLoaded();
  const v = resolveVenueForWeather(venue);
  const pins = window.VENUE_WEATHER_PINS || {};
  const hit = pins[v.full] || pins[v.norm] || (v.short && pins[v.short]) || (v.id && pins[v.id]) || pins[venue] || null;
  if(!hit) return null;
  const lat = Number(hit.lat ?? hit.latitude);
  const lon = Number(hit.lon ?? hit.lng ?? hit.longitude);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/* ========= venues import helpers ========= */
const VENUES = [
  { id: "hakodate", name: "函館" },
  { id: "aomori", name: "青森" },
  { id: "iwakitaira", name: "いわき平" },

  { id: "yahiko", name: "弥彦" },
  { id: "maebashi", name: "前橋" },
  { id: "toride", name: "取手" },
  { id: "utsunomiya", name: "宇都宮" },
  { id: "omiya", name: "大宮" },
  { id: "seibuen", name: "西武園" },
  { id: "keiokaku", name: "京王閣" },
  { id: "tachikawa", name: "立川" },

  { id: "matsudo", name: "松戸" },
  { id: "chiba", name: "千葉" },
  { id: "kawasaki", name: "川崎" },
  { id: "hiratsuka", name: "平塚" },
  { id: "odawara", name: "小田原" },
  { id: "ito", name: "伊東" },
  { id: "shizuoka", name: "静岡" },

  { id: "nagoya", name: "名古屋" },
  { id: "gifu", name: "岐阜" },
  { id: "ogaki", name: "大垣" },
  { id: "toyohashi", name: "豊橋" },
  { id: "toyama", name: "富山" },
  { id: "matsusaka", name: "松阪" },
  { id: "yokkaichi", name: "四日市" },

  { id: "fukui", name: "福井" },
  { id: "nara", name: "奈良" },
  { id: "mukomachi", name: "向日町" },
  { id: "wakayama", name: "和歌山" },
  { id: "kishiwada", name: "岸和田" },

  { id: "tamano", name: "玉野" },
  { id: "hiroshima", name: "広島" },
  { id: "hofu", name: "防府" },

  { id: "takamatsu", name: "高松" },
  { id: "komatsushima", name: "小松島" },
  { id: "kochi", name: "高知" },
  { id: "matsuyama", name: "松山" },

  { id: "kokura", name: "小倉" },
  { id: "kurume", name: "久留米" },
  { id: "takeo", name: "武雄" },
  { id: "sasebo", name: "佐世保" },
  { id: "beppu", name: "別府" },
  { id: "kumamoto", name: "熊本" },
];

// short codes for ambiguous venue names (avoid using venue[0] fallback)
const VENUE_SHORT_CODE = {
  "いわき平": "平",
  "平塚": "塚",
};

// reverse map short -> full
const VENUE_SHORT_TO_FULL = Object.fromEntries(Object.entries(VENUE_SHORT_CODE).map(([full, sc]) => [sc, full]));

// map short code -> venue id (normalized)
const VENUE_SHORT_TO_ID = (() => {
  const o = {};
  try{
    for (const [full, sc] of Object.entries(VENUE_SHORT_CODE || {})){
      const nid = VENUES.find(v => v.name === full || normalizeVenueName(v.name || '') === normalizeVenueName(full));
      if(nid) o[String(sc).trim()] = nid.id;
    }
  }catch(_){}
  return o;
})();

function resolveVenueForWeather(input){
  const raw = String(input ?? '').trim();
  const norm = normalizeVenueName(raw);
  let full = norm;

  // short -> full
  if (VENUE_SHORT_TO_FULL[norm]) full = VENUE_SHORT_TO_FULL[norm];

  // id -> full
  const byId = VENUES.find(v => v.id === norm);
  if (byId) full = byId.name;

  // full -> id
  const byName = VENUES.find(v => normalizeVenueName(v.name) === full);
  const id = byId ? byId.id : (byName ? byName.id : '');

  const short = VENUE_SHORT_CODE[full] || '';
  return { raw, norm, full, short, id };
}

function normalizeVenueName(v){
  if(!v) return '';
  try{
    return String(v).replace(/競輪場/g, '').trim();
  }catch(e){ return String(v || '').trim(); }
}

function getVenueCodeFor(raw){
  const vn = normalizeVenueName(raw);
  if(!vn) return '';
  // direct mappings
  if(window.VENUE_CODE && window.VENUE_CODE[vn]) return String(window.VENUE_CODE[vn]).trim();
  if(VENUE_SHORT_CODE[vn]) return String(VENUE_SHORT_CODE[vn]).trim();

  // try matching against VENUES list by normalized name or id
  for(const v of VENUES){
    const nm = normalizeVenueName(v.name || '');
    if(nm === vn){
      if(window.VENUE_CODE && window.VENUE_CODE[v.name]) return String(window.VENUE_CODE[v.name]).trim();
      if(VENUE_SHORT_CODE[v.name]) return String(VENUE_SHORT_CODE[v.name]).trim();
    }
    if(v.id && v.id === vn){
      if(window.VENUE_CODE && window.VENUE_CODE[v.name]) return String(window.VENUE_CODE[v.name]).trim();
      if(VENUE_SHORT_CODE[v.name]) return String(VENUE_SHORT_CODE[v.name]).trim();
    }
  }

  // loose contains matching (one-direction)
  for(const v of VENUES){
    const nm = normalizeVenueName(v.name || '');
    if(!nm) continue;
    if(nm.includes(vn) || vn.includes(nm)){
      if(window.VENUE_CODE && window.VENUE_CODE[v.name]) return String(window.VENUE_CODE[v.name]).trim();
      if(VENUE_SHORT_CODE[v.name]) return String(VENUE_SHORT_CODE[v.name]).trim();
    }
  }

  // not found
  return '';
}

function initVenuesImportUI(){
  const select = document.getElementById("venueSelect");
  const btnAssets = document.getElementById("btnLoadFromAssets");
  const fileInput = document.getElementById("venueFile");
  const btnFile = document.getElementById("btnLoadFromFile");

  const nameEl = document.getElementById("venueName") || document.querySelector('input[placeholder*="会場名"]');
  const tagEl  = document.getElementById("venueTags") || document.querySelector('input[placeholder*="タグ"]');
  const memoEl = document.getElementById("venueNote") || document.querySelector('textarea');

  const previewEl = document.getElementById("venuePreview");

  if(!select) return;

  // 初期はプレースホルダーを先頭に置き、選択されるまで何もしない
  select.innerHTML = [
    `<option value="">会場を選択してください</option>`,
    ...VENUES.map(v => `<option value="${v.id}">${v.name}</option>`)
  ].join("");
  select.value = "";

  const setDisabled = (flag) => {
    if(btnAssets) btnAssets.disabled = flag;
    if(btnFile) btnFile.disabled = flag;
    if(fileInput) fileInput.disabled = flag;
  };

  const clearVenueUI = () => {
    if(nameEl) nameEl.value = "";
    if(tagEl) tagEl.value = "";
    if(memoEl) memoEl.value = "";
    if(previewEl) previewEl.textContent = "";
  };

  // 初期状態は無効化（未選択）
  setDisabled(true);

  select.addEventListener("change", () => {
    const id = select.value;
    if (!id) {
      clearVenueUI();
      setDisabled(true);
      return;
    }
    // 選択された場合はアセット読み込み等を許可
    setDisabled(false);
  });

  if(btnAssets){
    btnAssets.addEventListener("click", async () => {
      const id = select.value;
        if(!id){ alert("会場が選択されていません"); return; }
        const url = asset(`venues/${id}.txt`);
      try{
        const res = await fetch(url);
        if(!res.ok) throw new Error(res.statusText||"fetch failed");
        const text = await res.text();
        applyVenueText(text, { nameEl, tagEl, memoEl, previewEl });
      }catch(err){
        alert(`読み込み失敗: ${url} - ${err.message}`);
      }
    });
  }

  if(btnFile){
    btnFile.addEventListener("click", async () => {
      const f = fileInput.files?.[0];
      if(!f){ alert("ファイルを選択してください"); return; }
      const text = await f.text();
      applyVenueText(text, { nameEl, tagEl, memoEl, previewEl });
    });
  }

  if(memoEl && previewEl){
    memoEl.addEventListener("input", () => { previewEl.textContent = memoEl.value || ""; });
  }
}

function menuButton(title, desc, href, tabImg){
  return `
    <a class="btn" href="${href}">
      <img class="menuTabImg" src="${asset(tabImg)}" alt="${title}">
    </a>
  `;
}

// slice out a single player's block: from nameKey position to the next player name occurrence
function sliceRowBlockByNames(section, entries, nameKey, startIdx){
  // next player name shortest position
  let end = section.length;
  for(const e of entries){
    const nk = (e.name || '').replace(/\s+/g,'');
    if(!nk || nk === nameKey) continue;
    const j = section.indexOf(nk, startIdx + nameKey.length);
    if(j >= 0 && j < end) end = j;
  }
  return section.slice(startIdx, end);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-href]");
  if (!btn) return;
  location.hash = btn.dataset.href;
});

function renderMenu() {
  const app = document.getElementById("app");
  if (app) app.classList.remove("page-today");

  $view.innerHTML = `
    <section class="page menuPage">
      <div class="card card--menu">
        <div class="menuTitle">
          <img class="menuTitle__img" src="${asset('メニュー文字.png')}" alt="くらりの競輪メニュー">
        </div>
        <div class="grid" style="margin-top:16px;">
          ${menuButton("会場メモ", "会場ごとの特徴を保存・閲覧", "#/venues", "会場タブ.png")}
          ${menuButton("本日のレース", "今日のレースを読み込んで確認", "#/today", "本日のレースタブ.png")}
            ${menuButton("過去のレース", "取り込み済みの過去レースを閲覧", "#/history", "kakore-sutabugazou.png")}
          ${menuButton("レース予想", "JSONからAI向けプロンプトを生成", "#/predict", "レース予想.png")}
          ${menuButton("選手一覧", "選手データを検索・管理", "#/players", "選手一覧タブ.png")}
        </div>
      </div>
    </section>
  `;
}

function renderVenues() {
  const app = document.getElementById("app");
  if(app) app.classList.remove("page-today");
  $view.innerHTML = `
    <div class="page venuesPage has-overlay" style="--overlay-alpha:0.45">
      <div class="venuesHeader">
        <div class="venuesTitle">
          <img class="venuesTitle__img" src="${asset('会場一覧文字.png')}" alt="会場一覧">
        </div>
        <a class="backLink" href="#/" aria-label="戻る">
          <img class="backLink__img" src="${asset('戻るボタン.png')}" alt="">
          <span class="sr-only">戻る</span>
        </a>
      </div>
      <img class="venue-divider" src="${asset('ライン⑤.png')}" alt="" aria-hidden="true">

      <div class="card venuesCard">

        <!-- A: 入力＆保存 -->
        <section class="venuesSection">
          <div class="sectionTitleImg">
            <img src="${asset('入力＆保存.png')}" alt="入力＆保存" class="sectionTitleImg__img venue-title-img">
            <span class="sr-only">入力＆保存</span>
          </div>

          <section class="venue-glass venue-glass--memo">
            <div class="row">
              <label class="fieldLabelImg" for="venueSelect">
                <img src="${asset('会場選択.png')}" alt="会場選択" class="fieldLabelImg__img">
                <span class="sr-only">会場選択</span>
              </label>
              <select id="venueSelect" class="select">
                <option value="">会場を選択してください</option>
              </select>
            </div>

            <div class="row venueImportRow">
              <label class="label">テキスト取込</label>
              <input id="venueFilesInput" class="input fileInput" type="file" accept=".txt,.md,text/plain,text/markdown" multiple>
              <button id="btnVenueFilesImport" class="btn">読込→保存</button>
              <span id="venueFilesMsg" class="smallMsg"></span>
            </div>

            <div class="venue-memo-inner" style="margin-top:12px;">
              <textarea id="venueEditor" class="textarea" rows="12" placeholder="ここに会場の特徴を貼り付けて保存します。"></textarea>
            </div>

            <div class="row row--buttons actions-shift-right actions-tight" style="margin-top:12px;">
              <button id="btnSaveVenue" class="btn btn-img btn-save-img" disabled type="button">
                <img class="btn-save-img__img" src="${asset('保存ボタン.png')}" alt="保存">
                <span class="sr-only">保存</span>
              </button>
              <button
                id="btnClearVenue"
                class="btn btn-img btn-clear-img"
                type="button"
                disabled
                aria-label="クリア"
              >
                <img class="btn-clear-img__img" src="${asset('クリアボタン.png')}" alt="クリア" />
                <span class="sr-only">クリア</span>
              </button>
            </div>
          </section>
        </section>

        <!-- B: 閲覧 -->
        <section class="venuesSection">
          <div class="fieldLabel fieldLabel--view">
            <img class="labelImg labelImg--view venue-title-img" src="${asset('閲覧.png')}" alt="閲覧">
            <span class="sr-only">閲覧（選択した会場の特徴）</span>
          </div>
          <section class="venue-glass venue-glass--view">
            <div id="venueViewer" class="viewer is-empty venue-viewer">会場を選択してください</div>
          </section>
        </section>

      </div>
    </div>
  `;

  // 会場一覧を追加
  const select = document.getElementById("venueSelect");
  select.insertAdjacentHTML(
    "beforeend",
    VENUES.map(v => `<option value="${v.id}">${v.name}</option>`).join("")
  );

  const editor = document.getElementById("venueEditor");
  const viewer = document.getElementById("venueViewer");
  const btnSave = document.getElementById("btnSaveVenue");
  const btnClear = document.getElementById("btnClearVenue");
  const btnImportVenueFiles = document.getElementById("btnImportVenueFiles");
  const btnImportVenueFolder = document.getElementById("btnImportVenueFolder");
  const venueFilesInput = document.getElementById("venueFilesInput");
  const venueFolderInput = document.getElementById("venueFolderInput");
  const venueImportStatus = document.getElementById("venueImportStatus");

  const keyOf = (id) => `venueText:${id}`;

  function renderMarkdown(targetEl, mdText){
    const safeText = mdText ?? "";
    if (window.marked) {
      try{
        targetEl.innerHTML = marked.parse(String(safeText), { gfm: true, breaks: true });
      }catch(e){
        targetEl.textContent = safeText;
      }
    } else {
      targetEl.textContent = safeText;
    }
  }

  const setViewer = (text) => {
    if (!text) {
      viewer.textContent = "（保存データなし）";
      viewer.classList.add("is-empty");
    } else {
      renderMarkdown(viewer, text);
      viewer.classList.remove("is-empty");
    }
  };

  const loadVenue = (id) => {
    const saved = localStorage.getItem(keyOf(id)) || "";
    editor.value = saved;
    setViewer(saved);
  };

  const setEnabled = (enabled) => {
    btnSave.disabled = !enabled;
    btnClear.disabled = !enabled;
    editor.disabled = !enabled;
  };

  // 初期は未選択
  setEnabled(false);

  select.addEventListener("change", () => {
    const id = select.value;
    if (!id) {
      editor.value = "";
      viewer.textContent = "会場を選択してください";
      viewer.classList.add("is-empty");
      setEnabled(false);
      return;
    }
    setEnabled(true);
    loadVenue(id);
  });

  btnSave.addEventListener("click", () => {
    const id = select.value;
    if (!id) return;
    const raw = editor.value;
    localStorage.setItem(keyOf(id), raw);
    setViewer(raw);
  });

  // --- 会場メモ：ファイル一括インポート（ファイル選択→会場判定→localStorage保存） ---
  function kqExtractVenueNameFromFilename(filename){
    let base = String(filename || "");
    base = base.split(/[\\\/]/).pop();
    base = base.replace(/\.[^.]+$/, "");
    base = base.replace(/^\s*\d+\s*[)）\.\-＿_ ]*/u, "");
    base = base.split(/[｜|]/u)[0];
    base = base.split(/[_\-]/u)[0];
    base = base.replace(/[【】]/gu, "");
    base = base.replace(/（[^）]*）|\([^)]*\)/gu, "");
    return base.trim();
  }

  function kqExtractVenueNameFromText(text){
    const t = String(text || "");
    const h = t.match(/^\s*#\s*(.+)\s*$/m);
    if(h && h[1]) return h[1].trim();
    const b = t.match(/【([^】]{2,24}競輪場)】/u);
    if(b && b[1]) return b[1].trim();
    return "";
  }

  // flexible resolver: accepts filename or file object, optional text and fallback id
  function kqResolveVenueIdFromFile(fileOrName, text, fallbackVenueId){
    let rawName = "";
    if(typeof fileOrName === 'string') rawName = fileOrName;
    else if(fileOrName && (fileOrName.webkitRelativePath || fileOrName.name)) rawName = (fileOrName.webkitRelativePath || fileOrName.name);
    const nameFromFile = kqExtractVenueNameFromFilename(rawName);
    let venueId = kqResolveVenueIdByName(nameFromFile);
    if(venueId) return venueId;

    const nameFromText = kqExtractVenueNameFromText(text || "");
    venueId = kqResolveVenueIdByName(nameFromText);
    if(venueId) return venueId;

    if(fallbackVenueId) return fallbackVenueId;
    return "";
  }

  const filesInput = document.getElementById("venueFilesInput");
  const importBtn = document.getElementById("btnVenueFilesImport");
  const importMsg = document.getElementById("venueFilesMsg");

  function setImportMsg(text, isErr = false){
    if(!importMsg) return;
    importMsg.textContent = text || "";
    importMsg.classList.toggle("isError", !!isErr);
  }

  if(filesInput && importBtn){
    importBtn.disabled = true;
    filesInput.addEventListener("change", () => {
      const n = filesInput.files ? filesInput.files.length : 0;
      importBtn.disabled = n === 0;
      setImportMsg(n ? `${n}件選択中` : "");
    });

    importBtn.addEventListener("click", async () => {
      const files = filesInput.files ? Array.from(filesInput.files) : [];
      if(!files.length) return;
      importBtn.disabled = true;
      setImportMsg("読み込み中…");

      let ok = 0;
      const ng = [];
      const fallbackId = (files.length === 1 && select.value) ? select.value : "";

      for(const f of files){
        try{
          const text = await f.text();
          const venueId = kqResolveVenueIdFromFile(f.name, text, fallbackId);
          if(!venueId){
            ng.push({ file: f.name, guess: kqExtractVenueNameFromFilename(f.name) });
            continue;
          }

          localStorage.setItem(`kq_venue_memo_${venueId}`, text);
          if(!localStorage.getItem(`kq_venue_name_${venueId}`)){
            const v = VENUES.find(x => x.id === venueId);
            if(v) localStorage.setItem(`kq_venue_name_${venueId}`, v.name);
          }
          if(localStorage.getItem(`kq_venue_tag_${venueId}`) == null){
            localStorage.setItem(`kq_venue_tag_${venueId}`, "");
          }
          ok++;
        }catch(e){
          ng.push({ file: f.name, error: String(e) });
          console.warn("[VENUE IMPORT] failed:", f.name, e);
        }
      }

      select.dispatchEvent(new Event("change"));
      filesInput.value = "";
      const msg = `インポート完了: ${ok}件 / 失敗: ${ng.length}件`;
      setImportMsg(msg, ng.length > 0);
      if(ng.length) console.warn("[VENUE IMPORT] unresolved:", ng);
      importBtn.disabled = false;
    });
  }

  btnClear.addEventListener("click", () => {
    const id = select.value;
    if (!id) return;
    localStorage.removeItem(keyOf(id));
    editor.value = "";
    setViewer("");
  });
}

function renderToday() {
  // purge stale today's data if date changed since last visit
  try{ const cleared = purgeIfDateChanged(); if (cleared) { /* allow re-render to show cleared state */ } }catch(e){console.warn('purgeIfDateChanged failed', e);} 
  const app = document.getElementById("app");
  if (app) app.classList.add("page-today");

  const TODAY_DATA_KEY = "todayRace_data_v1";
  const TODAY_UI_KEY = "todayRace_ui_v1";
  const dateKey = todayYMD();
  window.__kqTodayDateKey = dateKey;

  const allData = loadJSON(TODAY_DATA_KEY, {});
  if (!allData[dateKey]) allData[dateKey] = { venues: {} };
  const todayData = allData[dateKey];

  const uiState = loadJSON(TODAY_UI_KEY, { date: dateKey, selectedVenue: null, selectedRaceNo: null });

  // expose for debugging in console
  try{ window.todayData = todayData; window.uiState = uiState; }catch(e){}

  $view.innerHTML = `
    <section class="todayRaceFrame">
      <div class="todayRaceInner">
        <div class="todayRaceHeader">
          <div class="todayRaceTitleWrap">
            <img class="todayRaceTitleImg" src="${asset('本日のレースタイトル.png')}" alt="本日のレース">
          </div>
          <button id="todayBackBtn" class="todayBackBtn" type="button" aria-label="戻る">
            <img src="${asset('戻るボタン.png')}" alt="戻る">
          </button>
          </div>

          <div class="todayRaceDateRow">
              <div class="todayRaceDate">${escapeHTML(formatJPDate(new Date()))}</div>
            </div>

            <div id="todayWeatherBox" class="todayWeatherBox is-hidden"></div>

          <div class="raceListBlock">
          <div class="raceListLabel">レース一覧</div>
          <div class="venueChips" id="venueChips" role="list"></div>
          <div class="raceNoRow" id="raceNoRow"></div>
        </div>

        <div class="raceDetailBlock">
          <div class="raceDetailCard" id="raceDetailCard">
            <div id="todayRaceDetail"></div>
          </div>
        </div>

        <div class="raceInputBlock">
          <div class="raceInputCard">
            <div class="inputTitle">貼り付け＆保存</div>
            <div class="inputRow">
              <input class="venueInput" id="venueInput" placeholder="会場（例：松戸）" />
              <input class="raceNoInput" id="raceNoInput" type="number" min="1" max="12" placeholder="R" />
            </div>
            <div class="json-import">
              <label class="json-import__label">
                JSONファイル読み込み：
                <input id="raceJsonFile" type="file" accept=".json,.txt,application/json,text/plain" />
                <input id="raceJsonFolder" type="file" webkitdirectory directory multiple accept=".json,application/json" hidden />
              </label>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button id="raceJsonImportBtn" type="button">ファイルから読み込む</button>
                <button id="raceJsonFolderBtn" type="button">フォルダ読み込み</button>
                <input id="raceZipFile" type="file" accept=".zip" hidden />
                <button id="raceZipBtn" type="button">ZIP読み込み</button>
              </div>
              <div id="raceJsonImportMsg" class="json-import__msg"></div>
            </div>
            <div class="btnRow">
              <button class="btnClear" id="btnClearJson">クリア</button>
            </div>
            <div class="saveHint" id="saveHint"></div>

            <div class="weatherPinsBlock">
              <div class="inputTitle inputTitle--sub">天気座標（会場別・任意）</div>
              <div class="weatherPinsRow">
                  <select id="wxVenueSelect" class="venueInput"><option value="">会場を選択</option></select>
                  <input id="wxLatLon" class="raceInput wxCoordInput" placeholder="緯度, 経度 例:34.24,135.17" />
                  <button id="wxSaveBtn" class="btnSave" type="button">保存</button>
                  <button id="wxDelBtn" class="btnClear" type="button">削除</button>
                </div>
              <div id="wxHint" class="saveHint"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  // back button
  const backBtn = document.getElementById("todayBackBtn");
  if (backBtn) backBtn.onclick = () => (location.hash = "#/");

  // elements
  const venueChips = document.getElementById("venueChips");
  const raceNoRow = document.getElementById("raceNoRow");
  const detailCard = document.getElementById("raceDetailCard");
  const venueInput = document.getElementById("venueInput");
  const raceNoInput = document.getElementById("raceNoInput");
  const btnClear = document.getElementById("btnClearJson");
  const saveHint = document.getElementById("saveHint");
  const fileInput = document.getElementById("raceJsonFile");
  const importBtn = document.getElementById("raceJsonImportBtn");
  const importMsg = document.getElementById("raceJsonImportMsg");

  // today weather & pins UI
  const todayWeatherBox = document.getElementById('todayWeatherBox');

  const wxVenueSelect = document.getElementById('wxVenueSelect');
  const wxLatLon = document.getElementById('wxLatLon');
  const wxSaveBtn    = document.getElementById('wxSaveBtn');
  const wxDelBtn     = document.getElementById('wxDelBtn');
  const wxHint       = document.getElementById('wxHint');

  let weatherPins = ensureWeatherPinsLoaded();

  function setWeatherText(text, kind){
    if (!todayWeatherBox) return;
    todayWeatherBox.classList.remove('is-loading','is-error');
    if (kind) todayWeatherBox.classList.add(kind);
    todayWeatherBox.textContent = text;
  }

  async function refreshTodayWeather(venueOverride){
    const rawVenue = String((venueOverride ?? uiState.selectedVenue ?? '').trim());
    const box = todayWeatherBox;
    if (!box) return { ok:false, message:'no-box' };

    if (!rawVenue){
      box.innerHTML = '';
      box.classList.add('is-hidden');
      return { ok:false, message:'会場未選択' };
    }

    box.classList.remove('is-hidden','is-error');
    box.classList.add('is-loading');
    box.textContent = `天気（${rawVenue}）：取得中...`;

    try{
      // resolve lat/lon (try stored pin, then geocode & persist)
      const loc = (typeof kqResolveLatLonForVenue === 'function') ? await kqResolveLatLonForVenue(rawVenue) : ((typeof kqGetLatLonForVenue === 'function') ? kqGetLatLonForVenue(rawVenue) : null);

      if(loc && loc.lat != null && (loc.lon != null || loc.lng != null)){
        const wf = await kqFetchTodayForecast(loc.lat, loc.lon ?? loc.lng);
        try{ kqRenderTodayWeatherBox(rawVenue, wf, dateKey); }catch(e){ console.warn('render today box failed', e); }
        box.classList.remove('is-loading');
        return { ok:true };
      }

      // fallback（座標が無いなら hourly は出せない）
      const w = await getWeatherForVenue(rawVenue, dateKey);
      box.classList.remove('is-loading');
      box.classList.add('is-error');
      box.textContent = `天気（${rawVenue}）：${(w && w.ok) ? w.summary : ((w && w.message) ? w.message : '取得できません')} / ※座標未登録のため1時間予報は表示できません`;
      return w;
    }catch(e){
      console.warn(e);
      box.classList.remove('is-loading');
      box.classList.add('is-error');
      box.textContent = `天気（${rawVenue}）：取得失敗`;
      return { ok:false, message:'取得失敗' };
    }
  }

  // expose V2 today refresh to window so external callers use V2
  try{ window.refreshTodayWeather = refreshTodayWeather; }catch(e){}

  function fillWxVenueSelect(sel, selected){
    if (!sel) return;
    const names = Array.from(new Set(VENUES.map(v => v.name))).sort((a,b)=>a.localeCompare(b,'ja'));
    const options = ['<option value="">会場を選択</option>'].concat(names.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`));
    sel.innerHTML = options.join('');
    if (selected) sel.value = selected;
  }

  function syncWxVenue(){
    const selectedFromUI = (uiState.selectedVenue || '').trim();
    const selectedFromSelect = (wxVenueSelect && (wxVenueSelect.value || '').trim()) || '';
    const venue = selectedFromUI || selectedFromSelect;

    if (wxVenueSelect) {
      if (!wxVenueSelect.options || wxVenueSelect.options.length <= 1) fillWxVenueSelect(wxVenueSelect, selectedFromUI || selectedFromSelect);
      if (venue) {
        let opt = Array.from(wxVenueSelect.options).find(o => o.value === venue);
        if (!opt){ opt = document.createElement('option'); opt.value = venue; opt.textContent = venue; wxVenueSelect.appendChild(opt); }
        wxVenueSelect.value = venue;
      } else {
        wxVenueSelect.value = '';
      }
    }

    if (!wxHint) return;
    if (!venue){
      wxHint.textContent = '会場を選ぶと、ここで座標を保存できます。';
      return;
    }
    const pin = (weatherPins && weatherPins[venue]) ? weatherPins[venue] : null;
    wxHint.textContent = pin
      ? `登録済み：${venue} ${pin.lat}, ${pin.lon}（この座標が最優先で使われます）`
      : `未登録：${venue}（window.VENUE_PINS があればそれが使われます）`;
    if (wxLatLon){
      wxLatLon.value = pin ? `${pin.lat}, ${pin.lon}` : '';
    }
  }

  function persistData() {
    allData[dateKey] = todayData;
    saveJSON(TODAY_DATA_KEY, allData);
  }

  function persistUI() {
    saveJSON(TODAY_UI_KEY, { date: dateKey, selectedVenue: uiState.selectedVenue, selectedRaceNo: uiState.selectedRaceNo });
  }

  function safeRefreshTodayWeather(){
    try{
      // call local refresh (V2) to avoid mixing with legacy global
      refreshTodayWeather();
    }catch(e){ console.warn('weather refresh failed', e); }
  }

  function renderVenueChips(){
    const names = Object.keys(todayData.venues || {});
    if (!names.length) {
      venueChips.innerHTML = `<div class="chipEmpty">保存された会場がありません</div>`;
      return;
    }
    venueChips.innerHTML = names.map(n => `
      <button class="venueChip" data-venue="${escapeHTML(n)}">${escapeHTML(n)}</button>
    `).join("");

    // attach
    Array.from(venueChips.querySelectorAll('.venueChip')).forEach(btn => {
      btn.onclick = () => {
        uiState.selectedVenue = btn.dataset.venue;
        uiState.selectedRaceNo = null;
        persistUI();
        renderRaceNos();
        renderDetail();
        // sync weather UI
        try{ syncWxVenue(); }catch(e){}
        try{ safeRefreshTodayWeather(); }catch(e){}
        try{ refreshTodayWeather(); }catch(e){}
      };
      if (btn.dataset.venue === uiState.selectedVenue) btn.classList.add('isActive');
    });
  }

  function renderRaceNos(){
    raceNoRow.innerHTML = Array.from({length:12}, (_,i)=>i+1).map(n => {
      const has = todayData.venues?.[uiState.selectedVenue]?.races?.[String(n)];
      const cls = `raceNoBtn ${uiState.selectedRaceNo===n? 'isActive':''} ${has? 'hasData':''}`;
      return `<button class="${cls}" data-no="${n}">${n}R</button>`;
    }).join('');

    Array.from(raceNoRow.querySelectorAll('.raceNoBtn')).forEach(b=>{
      b.onclick = () => {
        uiState.selectedRaceNo = Number(b.dataset.no);
        persistUI();
        renderRaceNos();
        renderDetail();
        try{ safeRefreshTodayWeather(); }catch(e){}
        try{ refreshTodayWeather(); }catch(e){}
      };
    });
  }

  function renderDetail(){
    const v = uiState.selectedVenue;
    const rno = uiState.selectedRaceNo;
    const target = document.getElementById('todayRaceDetail');
    if(!target) return;
    if (!v) {
      target.innerHTML = `<div class="placeholder">会場を選択してください</div>`;
      return;
    }
    if (!rno) {
      target.innerHTML = `<div class="placeholder">${escapeHTML(v)} の保存データを選んでください</div>`;
      return;
    }
    const race = todayData.venues?.[v]?.races?.[String(rno)];
    if (!race) {
      target.innerHTML = `<div class="placeholder">${escapeHTML(v)} ${rno}R の保存データがありません</div>`;
      return;
    }
    renderRaceDetail(race);
  }

  function trySaveFromParsed(parsed){
    // parsed can be: single race obj, array of races, or structure with venues
    // Normalize incoming data when possible so older logic can consume it
    try{
      if (Array.isArray(parsed)){
        parsed.forEach(item => {
          const normalized = normalizeJohnson(item, dateKey) || item;
          if (normalized && normalized.venue && normalized.raceNo!=null){
            const vn = String(normalized.venue);
            const rn = String(normalized.raceNo);
            todayData.venues[vn] = todayData.venues[vn] || { races: {}, updatedAt: null };
            todayData.venues[vn].races[rn] = normalized;
            todayData.venues[vn].updatedAt = new Date().toISOString();
          }
        });
        return;
      }

      // try normalize single object
      const normalized = normalizeJohnson(parsed, dateKey) || parsed;

      if (normalized && normalized.venue && normalized.raceNo != null){
        const vn = String(normalized.venue);
        const rn = String(normalized.raceNo);
        todayData.venues[vn] = todayData.venues[vn] || { races: {}, updatedAt: null };
        todayData.venues[vn].races[rn] = normalized;
        todayData.venues[vn].updatedAt = new Date().toISOString();
        return;
      }

      if (parsed && parsed.venues){
        Object.keys(parsed.venues).forEach(vn => {
          const vobj = parsed.venues[vn];
          todayData.venues[vn] = todayData.venues[vn] || { races: {}, updatedAt: null };
          if (vobj.races){
            Object.keys(vobj.races).forEach(rn => {
              todayData.venues[vn].races[rn] = vobj.races[rn];
            });
          }
          todayData.venues[vn].updatedAt = new Date().toISOString();
        });
        return;
      }

      throw new Error('受け付けられるJSONフォーマットではありません');
    }catch(e){
      throw e;
    }
  }

  // (removed legacy '保存' button behavior; use ファイルから読み込む / フォルダ読み込み / ZIP読み込み)

  // Clear: remove today's saved data and reset UI
  btnClear.onclick = () => {
    if (!confirm('本日のレースの保存データを削除しますか？')) return;
    // remove today's date entry
    if (allData && allData[dateKey]) delete allData[dateKey];
    saveJSON(TODAY_DATA_KEY, allData);
    // reset UI state
    uiState.selectedVenue = null;
    uiState.selectedRaceNo = null;
    persistUI();
    renderVenueChips();
    renderRaceNos();
    renderDetail();
    if (fileInput) try{ fileInput.value = ''; }catch(e){}
    if (importMsg) importMsg.textContent = '削除しました';
  };

  // File import handling: read file -> parse JSON -> save -> refresh UI
  function setImportMsg(text, ok){
    if(!importMsg) return;
    importMsg.textContent = text;
    importMsg.classList.toggle('is-ok', !!ok);
    importMsg.classList.toggle('is-ng', !ok);
  }

  function saveParsedAndRefresh(parsed){
    try{
      trySaveFromParsed(parsed);
      persistData();
      saveHint.textContent = '保存しました';
      setImportMsg('保存しました', true);
      renderVenueChips();
      renderRaceNos();
      renderDetail();
    }catch(err){
      setImportMsg('保存に失敗しました: ' + err.message, false);
    }
  }

  function readSelectedFile(){
    if(!fileInput) return setImportMsg('ファイル入力が見つかりません', false);
    const file = fileInput.files?.[0];
    if(!file) return setImportMsg('ファイルが選択されていません', false);
    if(file.size > 2 * 1024 * 1024) return setImportMsg('ファイルが大きすぎます（2MB以内推奨）', false);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      try{
        const parsed = JSON.parse(text);
        setImportMsg(`読み込みOK：${file.name}`, true);
        saveParsedAndRefresh(parsed);
      }catch(e){
        setImportMsg(`JSONとして読めません：${e.message}`, false);
      }
    };
    reader.onerror = () => setImportMsg('ファイル読み込みに失敗しました', false);
    reader.readAsText(file, 'utf-8');
  }

  if(importBtn) importBtn.addEventListener('click', readSelectedFile);
  if(fileInput) fileInput.addEventListener('change', readSelectedFile);

  // weather pins save / delete
  if (wxSaveBtn){
    wxSaveBtn.addEventListener('click', () => {
      const venue = normalizeVenueName((wxVenueSelect?.value || '').trim());
      if (!venue) return alert('会場名を入れてね');
      const raw = (wxLatLon?.value || '').trim();
      if(!raw) return alert('座標を入力してください（例:34.24,135.17）');
      // allow comma, fullwidth comma, space-separated; extract two numbers
      const parts = raw.split(/[､,\s]+/).filter(Boolean);
      if(parts.length < 2) return alert('緯度,経度 の形式で入力してください（例:34.24,135.17）');
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if(!Number.isFinite(lat) || !Number.isFinite(lng)) return alert('緯度(lat) / 経度(lng) は数字で入れてね');
      weatherPins[venue] = { lat, lng };
      weatherPins = persistWeatherPins(weatherPins);
      syncWxVenue();
      try{ refreshTodayWeather(); }catch(e){}
    });
  }

  if (wxDelBtn){
    wxDelBtn.addEventListener('click', () => {
      const venue = (wxVenueSelect?.value || '').trim();
      if (!venue) return;
      if (weatherPins && weatherPins[venue]) delete weatherPins[venue];
      weatherPins = persistWeatherPins(weatherPins || {});
      syncWxVenue();
      try{ refreshTodayWeather(); }catch(e){}
    });
  }

  // populate select and react to selection changes
  if (wxVenueSelect){
    try{ fillWxVenueSelect(wxVenueSelect, uiState.selectedVenue || ''); }catch(e){}
    wxVenueSelect.addEventListener('change', () => {
      const sel = wxVenueSelect.value || null;
      uiState.selectedVenue = sel;
      persistUI();
      renderRaceNos();
      renderDetail();
      try{ syncWxVenue(); }catch(e){}
      try{ refreshTodayWeather(); }catch(e){}
    });
  }

  // folder import handlers (Chrome/Edge via webkitdirectory)
  const folderInput = document.getElementById('raceJsonFolder');
  const folderBtn = document.getElementById('raceJsonFolderBtn');
  const folderSupported = 'webkitdirectory' in document.createElement('input');
  if(folderBtn && !folderSupported) folderBtn.style.display = 'none';
  if(folderBtn && folderSupported){
    folderBtn.addEventListener('click', () => { if(folderInput) folderInput.click(); });
  }
  if(folderInput) folderInput.addEventListener('change', (e) => { importFromFolder(e.target.files); });
  // zip handlers
  const zipInput = document.getElementById('raceZipFile');
  const zipBtn = document.getElementById('raceZipBtn');
  if(zipBtn && zipInput){
    zipBtn.addEventListener('click', () => zipInput.click());
    zipInput.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if(f) await handleZipImport(f);
    });
  }

  async function readJsonFromFile(file){
    const text = await file.text();
    return JSON.parse(text);
  }

  async function importFromFolder(fileList){
    if(!fileList || !fileList.length) return setImportMsg('フォルダが選択されていません', false);
    const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.json'));
    if(files.length === 0) return setImportMsg('フォルダ内に .json が見つかりませんでした', false);
    // stable sort by relative path or name
    files.sort((a,b) => ((a.webkitRelativePath||a.name).localeCompare(b.webkitRelativePath||b.name, 'ja')));

    const loaded = [];
    const errors = [];
    for(const f of files){
      try{
        const data = await readJsonFromFile(f);
        if(Array.isArray(data)) loaded.push(...data);
        else loaded.push(data);
      }catch(err){
        errors.push({ file: f.webkitRelativePath || f.name, message: err.message });
      }
    }

    if(errors.length){
      console.warn('フォルダ読み込みエラー', errors);
      setImportMsg(`読み込み失敗: ${errors.length}件（consoleを確認）`, false);
    } else {
      setImportMsg(`読み込みOK：${files.length}ファイル`, true);
    }

    if(loaded.length) {
      try{
        // save each loaded race object using saveRaceData
        for(const item of loaded){ try{ saveRaceData(item); }catch(e){ console.warn('saveRaceData failed', e); } }
        persistData();
        renderVenueChips(); renderRaceNos(); renderDetail();
        try{ if (window.refreshTodayWeather) window.refreshTodayWeather(uiState.selectedVenue); }catch(e){}
        setImportMsg('フォルダの取り込みを完了しました', true);
      }catch(e){
        console.error('folder import failed', e);
        setImportMsg('フォルダ取り込みに失敗しました（console参照）', false);
      }
    }
  }

  // merge incoming loaded array of race objects into todayData (deep-ish merge)
  function importRaces(loaded){
    // loaded: array of objects (race objects or venue-structured)
    loaded.forEach(item => {
      if(!item) return;
      // if container with .venues
      if(item.venues){
        Object.keys(item.venues).forEach(vn => {
          const vobj = item.venues[vn];
          todayData.venues[vn] = todayData.venues[vn] || { races: {}, updatedAt: null };
          if(vobj.races){
            Object.keys(vobj.races).forEach(rn => {
              mergeRaceInto(todayData.venues[vn].races, rn, vobj.races[rn]);
            });
          }
          todayData.venues[vn].updatedAt = new Date().toISOString();
        });
        return;
      }

      // single race object with venue + raceNo
      if(item.venue && item.raceNo != null){
        const vn = String(item.venue);
        const rn = String(item.raceNo);
        todayData.venues[vn] = todayData.venues[vn] || { races: {}, updatedAt: null };
        mergeRaceInto(todayData.venues[vn].races, rn, item);
        todayData.venues[vn].updatedAt = new Date().toISOString();
        return;
      }

      // array-like individual race objects should have been expanded earlier
    });
  }

  // save single race object to localStorage with key race:venue:date:raceNo
  // normalize JohnsonJSON-like objects into flat race object expected by UI
  function normalizeJohnson(obj, fallbackDateKey){
    if(!obj || typeof obj !== 'object') return null;

    // already flat-ish
    const hasRaceNo = (obj.raceNo !== undefined && obj.raceNo !== null) || (obj.race_no !== undefined && obj.race_no !== null) || (obj.raceNumber !== undefined && obj.raceNumber !== null) || (obj.no !== undefined && obj.no !== null);
    if(obj.venue && obj.date && hasRaceNo) return obj;

    if(obj.race && typeof obj.race === 'object'){
      const r = obj.race;
      const venue = r.venue || r.venueName || obj.venue || obj.venueName;
      const date = r.date || obj.date || fallbackDateKey;
      const raceNo = (r.raceNo ?? r.no ?? obj.raceNo ?? obj.race_no ?? obj.raceNumber ?? obj.no);
      if(!venue || !date || raceNo == null) return null;

      return {
        schema: obj.schema || 'JohnsonJSONv1',
        venue,
        dayLabel: r.dayLabel || obj.dayLabel,
        date,
        raceNo,
        raceName: r.raceName || obj.raceName || r.name || obj.name,
        class: r.class || obj.class,
        distanceM: r.distanceM ?? obj.distanceM,
        laps: r.laps ?? obj.laps,
        startTime: r.startTime || obj.startTime,
        closeTime: r.closeTime || obj.closeTime,
        entries: obj.entries || r.entries || [],
        lineup: obj.lineup || r.lineup,
        ex: obj.ex || r.ex,
        _raw: obj,
      };
    }

    return null;
  }

  function saveRaceData(obj){
    if(!obj) return false;
    if(Array.isArray(obj)){
      let any = false;
      for(const o of obj){ if(saveRaceData(o)) any = true; }
      return any;
    }

    obj = normalizeJohnson(obj, dateKey) || obj;

    const vn = obj.venue || obj.venueName || '';
    const d = obj.date || obj.raceDate || dateKey;

    // determine race number robustly
    let rnVal = '';
    if(obj.raceNo !== undefined && obj.raceNo !== null) rnVal = obj.raceNo;
    else if(obj.race && obj.race.no !== undefined && obj.race.no !== null) rnVal = obj.race.no;
    else if(obj.race && obj.race.raceNo !== undefined && obj.race.raceNo !== null) rnVal = obj.race.raceNo;
    else if(obj.race_number !== undefined && obj.race_number !== null) rnVal = obj.race_number;

    const rn = Number(rnVal);
    if(!vn || !d || !Number.isFinite(rn)){
      console.warn('[saveRaceData] missing keys', { vn, d, rnVal, obj });
      return false;
    }

    const key = `race:${vn}:${d}:${rn}`;
    try{
      localStorage.setItem(key, JSON.stringify(obj));
    }catch(e){ console.warn('localStorage set failed', e); return false; }

    // also merge into todayData for UI
    try{ trySaveFromParsed(obj); }catch(e){ /* ignore */ }
    return true;
  }

  async function handleZipImport(file){
    if(!file) return setImportMsg('ZIPファイルが選択されていません', false);
    if(!window.JSZip) return setImportMsg('JSZipが読みめません', false);
    setImportMsg('ZIPを展開中…', true);
    try{
      const zip = await window.JSZip.loadAsync(file);
      // try restore manifest, venue memo, and players (cards/all) before JSON race import
      try{
        const manifestEntry = zip.file('manifest.json');
        if(manifestEntry){
          try{
            const mf = JSON.parse(await manifestEntry.async('string'));
            // restore venue memo if present
            try{
              const vmEntry = zip.file('venue/venue_memo.md') || zip.file('venue/venue_memo.txt');
              if(vmEntry && mf.venue){
                const txt = await vmEntry.async('string');
                const vid = resolveVenueIdByName(mf.venue) || null;
                if(vid){ try{ localStorage.setItem(venueKeyOf(vid), String(txt||'')); }catch(e){} }
              }
            }catch(e){ }

            // restore rider master / players
            try{
              // players_all.json -> merge into rider master
              const allPlayersEntry = zip.file('players/players_all.json');
              if(allPlayersEntry){
                try{
                  const txt = await allPlayersEntry.async('string');
                  const parsed = JSON.parse(txt);
                  if(parsed && typeof parsed === 'object'){
                    const cur = loadRiderMaster() || {};
                    const merged = Object.assign({}, cur, parsed);
                    saveRiderMaster(merged);
                  }
                }catch(e){ console.warn('players_all restore failed', e); }
              }

              // restore linked_players.json and cards
              const linkedEntry = zip.file('players/linked_players.json');
              if(linkedEntry){
                try{
                  const txt = await linkedEntry.async('string');
                  const arr = JSON.parse(txt) || [];
                  const cur = loadRiderMaster() || {};
                  const playersList = loadJSON(KEY.players, []) || [];
                  for(const it of arr){
                    const p = it && it.player;
                    if(p && typeof p === 'object' && p.name){
                      const key = p.id ? `id:${p.id}` : makeRiderKeyFrom(p) || (`name:${normalizeRiderName(p.name)}`);
                      cur[key] = Object.assign({}, cur[key] || {}, p);
                      // also merge into KEY.players list (array)
                      try{
                        const norm = normalizeRiderName(p.name || '');
                        const exist = playersList.find(x => normalizeRiderName(x.name||'') === norm);
                        if(exist) Object.assign(exist, p);
                        else playersList.push(p);
                      }catch(e){}
                    }
                  }
                  saveRiderMaster(cur);
                  try{ localStorage.setItem(KEY.players, JSON.stringify(playersList || [])); }catch(e){}
                }catch(e){ console.warn('linked players restore failed', e); }
              }

              // restore cards under players/cards/*.md
              try{
                const files = Object.keys(zip.files || {}).filter(k => k.startsWith('players/cards/') && !zip.files[k].dir && /\.md$/i.test(k));
                if(files.length){
                  const cur = loadRiderMaster() || {};
                  const playersList = loadJSON(KEY.players, []) || [];
                  for(const f of files){
                    try{
                      const t = await zip.file(f).async('string');
                      // derive name from filename
                      const base = f.split('/').pop();
                      const name = decodeURIComponent(base.replace(/\.md$/i,''));
                      const norm = normalizeRiderName(name||'');
                      // try to find in master
                      let foundKey = Object.keys(cur).find(k => normalizeRiderName((cur[k] && cur[k].name) || '') === norm) || null;
                      if(foundKey){ cur[foundKey].cardMd = String(t||''); }
                      else {
                        // try playersList
                        let pl = playersList.find(p => normalizeRiderName(p.name||'') === norm);
                        if(pl){ pl.cardMd = String(t||''); }
                        else {
                          // create new master entry
                          const newKey = makeRiderKeyFrom({ name }) || (`name:${norm}`);
                          cur[newKey] = Object.assign({}, cur[newKey]||{}, { name: name, cardMd: String(t||'') });
                        }
                      }
                    }catch(e){ console.warn('card restore failed', f, e); }
                  }
                  saveRiderMaster(cur);
                  try{ localStorage.setItem(KEY.players, JSON.stringify(playersList || [])); }catch(e){}
                }
              }catch(e){ console.warn('cards iteration failed', e); }
            }catch(e){ console.warn('players restore block failed', e); }
          }catch(e){ /* ignore manifest parse */ }
        }
      }catch(e){ console.warn('pre-zip restore failed', e); }
      const jsonPattern = /\.(json|md|txt)$/i;
      const jsonFiles = [];
      zip.forEach((relativePath, zipEntry) => {
        if(!zipEntry.dir && jsonPattern.test(relativePath)) jsonFiles.push(relativePath);
      });

      function extractJsonBlocks(text){
        const results = [];
        if(!text) return results;
        const trimmed = text.trim();
        if(trimmed){
          try{
            const parsed = JSON.parse(trimmed);
            if(Array.isArray(parsed)) results.push(...parsed);
            else results.push(parsed);
            return results;
          }catch{}
        }
        let stackDepth = 0;
        let startIdx = -1;
        let inString = false;
        let quoteChar = "";
        let escape = false;
        for(let i = 0; i < text.length; i++){
          const ch = text[i];
          if(inString){
            if(escape){
              escape = false;
              continue;
            }
            if(ch === "\\"){
              escape = true;
              continue;
            }
            if(ch === quoteChar){
              inString = false;
              quoteChar = "";
            }
            continue;
          }
          if(ch === "\"" || ch === "'"){
            inString = true;
            quoteChar = ch;
            continue;
          }
          if(ch === "{"){
            if(stackDepth === 0) startIdx = i;
            stackDepth++;
          } else if(ch === "}"){
            if(stackDepth > 0){
              stackDepth--;
              if(stackDepth === 0 && startIdx >= 0){
                try{
                  const snippet = text.slice(startIdx, i + 1);
                  const parsed = JSON.parse(snippet);
                  if(Array.isArray(parsed)) results.push(...parsed);
                  else results.push(parsed);
                }catch(err){
                  // ignore parse errors, continue scanning
                }
                startIdx = -1;
              }
            }
          }
        }
        return results;
      }

      async function importGenericJsonFiles(filePaths){
        if(!filePaths.length) return;
        let total = 0;
        const failed = [];
        for(const relPath of filePaths){
          const entry = zip.file(relPath);
          if(!entry) {
            failed.push(relPath);
            continue;
          }
          try{
            const text = await entry.async('string');
            const parsedItems = extractJsonBlocks(text);
            if(!parsedItems.length){
              failed.push(relPath);
              continue;
            }
            for(const item of parsedItems){
              if(item && typeof item === 'object'){
                if(saveRaceData(item)) total++;
                else failed.push(relPath);
              } else {
                failed.push(relPath);
              }
            }
          }catch(err){
            console.warn('generic zip parse failed', relPath, err);
            failed.push(relPath);
          }
        }
        persistData(); renderVenueChips(); renderRaceNos(); renderDetail();
        const msg = failed.length
          ? `読み込み完了：${total} 件（未保存 ${failed.length}件、console参照）`
          : `読み込み完了：${total} 件`;
        setImportMsg(msg, failed.length === 0);
      }

      // only consider app/allin johnsonjson files; ignore integrity and other metadata
      const appRe = /_johnsonjson_v1_app\.json$/i;
      const allinRe = /_johnsonjson_v1_allin\.json$/i;
      const targets = jsonFiles.filter(n => appRe.test(n) || allinRe.test(n));
      if(targets.length === 0){
        if(!jsonFiles.length) return setImportMsg('ZIP内に対象JSON（*_johnsonjson_v1_app/allin.json）が見つかりません', false);
        await importGenericJsonFiles(jsonFiles);
        return;
      }

      const baseMap = {};
      for(const n of targets){
        if(appRe.test(n)){
          const base = n.replace(appRe, '');
          baseMap[base] = baseMap[base] || {};
          baseMap[base].app = n;
        }
        if(allinRe.test(n)){
          const base = n.replace(allinRe, '');
          baseMap[base] = baseMap[base] || {};
          baseMap[base].allin = n;
        }
      }

      let total = 0; let failed = [];
      const b64ToUtf8 = (s) => { try{ return decodeBase64Utf8(s); }catch(e){ return ''; } };

      for(const base of Object.keys(baseMap)){
        const pair = baseMap[base];
        try{
          let appParsed = null; let allinParsed = null;
          if(pair.app){
            const ent = zip.file(pair.app);
            if(ent){ const txt = await ent.async('string'); try{ appParsed = JSON.parse(txt); }catch(e){ console.warn('app json parse failed', pair.app, e); } }
          }
          if(pair.allin){
            const ent = zip.file(pair.allin);
            if(ent){ const txt = await ent.async('string'); try{ allinParsed = JSON.parse(txt); }catch(e){ console.warn('allin json parse failed', pair.allin, e); } }
          }

          // decode rawTextB64 and try to inject referenced text files for both
          const tryInjectRawTextFromFiles = async (obj) => {
            if(!obj || typeof obj !== 'object') return obj;
            const ex = obj.ex || (obj.race && obj.race.ex) || null;
            if(!ex) return obj;
            if(typeof ex.rawText === 'boolean') ex.rawText = undefined;
            if(!ex.rawText && ex.rawTextB64){
              try{ ex.rawText = b64ToUtf8(ex.rawTextB64); }catch(e){}
            }
            if(!ex.rawText && Array.isArray(ex.files) && ex.files.length){
              for(const fdesc of ex.files){
                const fname = (fdesc && (fdesc.name||fdesc)) || fdesc;
                if(!fname) continue;
                let txtEntry = zip.file(fname);
                if(!txtEntry){ const keys = Object.keys(zip.files||{}); const found = keys.find(k => k.endsWith(fname)); if(found) txtEntry = zip.file(found); }
                if(txtEntry){ try{ const t = await txtEntry.async('string'); ex.rawText = String(t||''); break; }catch(e){} }
              }
            }
            if(ex) obj.ex = ex;
            return obj;
          };

          if(allinParsed) allinParsed = await tryInjectRawTextFromFiles(allinParsed);
          if(appParsed) appParsed = await tryInjectRawTextFromFiles(appParsed);

          // Normalize to extract venue/date/raceNo for dedup/merge decision
          const normAll = normalizeJohnson(allinParsed, dateKey) || (allinParsed && allinParsed.race ? normalizeJohnson(allinParsed.race, dateKey) : null);
          const normApp = normalizeJohnson(appParsed, dateKey) || (appParsed && appParsed.race ? normalizeJohnson(appParsed.race, dateKey) : null);

          // Merge logic: prefer allin fields for ex (strings), prefer value-present fields otherwise
          let merged = null;
          if(normAll && normApp){
            // deep-ish merge: start with allin then supplement from app for missing values
            merged = JSON.parse(JSON.stringify(allinParsed || {}));
            const appSrc = appParsed || {};
            // merge top-level simple fields if missing in merged
            Object.keys(appSrc).forEach(k => {
              try{
                if(k === 'ex') return; // handle below
                const val = appSrc[k];
                if((merged[k] === undefined || merged[k] === null || merged[k] === '') && (val !== undefined && val !== null && val !== '')) merged[k] = val;
              }catch(e){}
            });
            // merge ex: prefer allin.ex contents (text/blocks) but supplement missing keys from app.ex
            merged.ex = Object.assign({}, (appParsed && appParsed.ex) || {}, (allinParsed && allinParsed.ex) || {});
            // ensure rawText decoded
            if(merged.ex && !merged.ex.rawText && merged.ex.rawTextB64){ try{ merged.ex.rawText = b64ToUtf8(merged.ex.rawTextB64); }catch(e){} }
          } else if(normAll){
            merged = allinParsed;
          } else if(normApp){
            merged = appParsed;
          } else {
            // fallback: if only raw parsed exists, prefer allinParsed then appParsed
            merged = allinParsed || appParsed;
          }

          if(merged && merged.ex && !merged.ex.rawText && merged.ex.rawTextB64){ try{ merged.ex.rawText = b64ToUtf8(merged.ex.rawTextB64); }catch(e){} }

          // Save merged object once for this race
          if(merged){
            const ok = saveRaceData(merged);
            if(ok){
              total++;
              try{
                const dateISO = String(merged.date || merged.raceDate || merged.race_date || dateKey || '');
                const venueKey = String(merged.venue || merged.venueName || merged.venue_name || '');
                if(dateISO && venueKey){
                  // persist into IndexedDB for history browsing
                  persistImportedRaceBundle({ dateISO, venueKey, bundleObj: merged, sourceZipName: (file && file.name) || '' });
                }
              }catch(e){ /* ignore persist errors */ }
            } else failed.push(base);
          }
        }catch(e){ console.error('zip pair processing failed', base, e); failed.push(base); }
      }

      if(failed.length){
        console.warn('ZIP import partial failures', failed);
        setImportMsg(`読み込み完了：${total} 件（未保存：${failed.length}件）`, false);
      } else {
        setImportMsg(`読み込み完了：${total} 件`, true);
      }

      // refresh UI
      persistData(); renderVenueChips(); renderRaceNos(); renderDetail();
    }catch(err){
      console.error('ZIP処理失敗', err);
      setImportMsg('ZIP処理に失敗しました（console参照）', false);
    }
  }

  // expose import handler for other UI (predict tab) to call
  try{ window.kqHandleZipImport = handleZipImport; }catch(e){}

  function mergeRaceInto(racesObj, rn, incoming){
    // normalize incoming to ensure consistent keys
    const normalized = normalizeJohnson(incoming, dateKey) || incoming;
    const rnKey = String(normalized?.raceNo ?? normalized?.race_number ?? normalized?.no ?? rn);
    const exists = racesObj[rnKey];
    // if incoming's normalized race number differs from provided rn, ensure correct slot
    if(!exists && rnKey !== rn){
      // create entry at rnKey
      racesObj[rnKey] = normalized;
      return;
    }
    if(!exists){
      racesObj[rnKey] = normalized;
      return;
    }
    // merge scalar/object fields: prefer incoming/normalized when non-empty
    const source = normalized;
    Object.keys(source).forEach(k => {
      try{
        if(k === 'entries' && Array.isArray(source.entries)){
          const map = {};
          (exists.entries || []).forEach(en => { map[String(en.car)] = en; });
          source.entries.forEach(en => { map[String(en.car)] = en; });
          exists.entries = Object.values(map).sort((a,b) => Number(a.car) - Number(b.car));
          return;
        }

        if(k === 'ex' && typeof source.ex === 'object'){
          exists.ex = Object.assign({}, exists.ex || {}, source.ex || {});
          try{
            const a = (exists.ex && exists.ex.rawText) || '';
            const b = (source.ex && source.ex.rawText) || '';
            exists.ex.rawText = a.length >= b.length ? a : b;
          }catch(e){ /* ignore */ }
          return;
        }

        if(source[k] !== undefined && source[k] !== null && source[k] !== ''){
          exists[k] = source[k];
        }
      }catch(err){ console.warn('mergeRaceInto error', err); }
    });
  }

  // initial selection from UI state if possible
  if (uiState.selectedVenue && todayData.venues?.[uiState.selectedVenue]){
    // ok
  } else {
    uiState.selectedVenue = Object.keys(todayData.venues || {})[0] || null;
    uiState.selectedRaceNo = null;
    persistUI();
  }

  renderVenueChips();
  renderRaceNos();
  renderDetail();

  // sync weather UI after initial render
  try{ syncWxVenue(); }catch(e){}
  try{ safeRefreshTodayWeather(); }catch(e){}

  // 時間帯に応じた枠背景を適用（CSS変数 --today-bg に url() をセット）
  if (typeof applyTodayRaceBg === "function") applyTodayRaceBg();
  // schedule midnight purge once per page lifetime
  if (!midnightTimerSet) {
    try{ scheduleMidnightPurge(); midnightTimerSet = true; }catch(e){ console.warn('scheduleMidnightPurge call failed', e); }
  }
}

// pick background path by hour (Japanese filenames kept as requested)
function pickTodayBgByHour(hour){
  if (hour >= 5 && hour < 11) return asset('くらり背景（朝）.png');
  if (hour >= 11 && hour < 16) return asset('くらり背景（昼）.png');
  if (hour >= 16 && hour < 19) return asset('くらり背景（夕方）.png');
  return asset('くらり背景（夜）.png');
}

// Apply CSS variable --today-bg to .todayRaceFrame using encoded URI
function applyTodayRaceBg(){
  const frame = document.querySelector('.todayRaceFrame');
  if (!frame) return;
  const now = new Date();
  const hour = now.getHours();
  const path = pickTodayBgByHour(hour);
  const url = `url("${encodeURI(path)}")`;
  try{
    frame.style.setProperty('--today-bg', url);
    frame.dataset.bg = path; // debug
  }catch(e){
    console.warn('applyTodayRaceBg failed', e);
  }
}

// keep background updated across minute boundaries
setInterval(() => {
  try{ applyTodayRaceBg(); }catch(e){ /* ignore */ }
}, 60 * 1000);

function renderPredict(){
  const app = document.getElementById("app");
  if(app) app.classList.remove("page-today");

  // ✅ 本日のレースが使っている保存キーに合わせる
  const TODAY_DATA_KEY = 'todayRace_data_v1';
  const TODAY_UI_KEY   = 'todayRace_ui_v1';

  const dateKey = todayYMD();
  const all = loadJSON(TODAY_DATA_KEY, {});
  const day = all[dateKey] || { date: dateKey, venues: {} };
  const ui  = loadJSON(TODAY_UI_KEY, {});
  const venuesMemo = loadJSON(KEY.venues, []);

  // 保存済みレースをフラット化
  const saved = [];
  const venuesObj = day.venues || {};
  Object.keys(venuesObj).forEach((venue)=>{
    const races = (venuesObj[venue] && venuesObj[venue].races) ? venuesObj[venue].races : {};
    Object.keys(races).forEach((rn)=>{
      const race = races[rn];
      if(!race) return;
      saved.push({ venue, raceNo: String(rn), race });
    });
  });
  saved.sort((a,b)=> a.venue.localeCompare(b.venue,'ja') || (Number(a.raceNo)-Number(b.raceNo)));

  const $view = document.getElementById("view");
  $view.innerHTML = `
    <section class="page predictPage">
      <div class="card card--predict">
        <div class="predictHeaderBar">
          <div class="predictHeaderLeft">
            <img class="predictTitleImg" src="${asset('レース予想.png')}" alt="レース予想" onerror="this.style.display='none'">
            <div class="predictHeaderText">
              <div class="predictTitleText">レース予想｜プロンプト作成</div>
              <div class="predictSteps">①レース選択 → ②パート生成 → ③コピー → ④ChatGPTへ貼り付け</div>
            </div>
          </div>

          <div class="predictHeaderRight">
            <a class="predictChatBtn" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPTを開く</a>

            <button id="predictBackBtn" class="predictBackBtn" type="button" aria-label="戻る">
              <img src="${asset('戻るボタン.png')}" alt="戻る">
            </button>
          </div>
        </div>
        <h2 style="margin:0 0 8px;">プロンプト作成（分割）</h2>

        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px;">
          <button id="genParts" class="btn">パート生成</button>
          <button id="copyAllBtn" class="btn">全部コピー</button>
          <button id="exportPredictZipBtn" class="btn">ZIP書き出し</button>
          <input id="predictZipInput" type="file" accept=".zip" style="display:none">
          <button id="predictZipBtn" class="btn">ZIP読み込み</button>
          <span id="predictZipMsg" class="muted" style="margin-left:6px;font-size:12px"></span>
          <div style="flex:1"></div>
          <select id="savedRaceSelect" class="select" style="width:min(320px, 100%);">
            <option value="">保存済みレースから選択（本日のレースで取り込み済み）</option>
          </select>
          <button id="btnUseSaved" class="btn" type="button">取り込む</button>
        </div>

        <div id="weatherBox" class="weatherBox" style="margin-top:6px; display:none;"></div>

        <label class="predictAttach" style="display:flex;gap:8px;align-items:center;margin:6px 0;">
          <input type="checkbox" id="attachRiderMasterChk" />
          <span>選手マスターを添付（未登録選手はリストに表示されます）</span>
        </label>

        <div id="promptBuilder">

          <details class="part" data-part="1" open>
            <summary>Part1 / レース概要</summary>
            <div class="partBody">
              <textarea id="part1" class="partTextarea" placeholder="Part1 を生成/編集できます"></textarea>
              <div class="partMeta"><span id="count1">0 chars / limit 6000</span></div>
            </div>
          </details>

          <details class="part" data-part="2" open>
            <summary>Part2 / 出走表(数値中心)</summary>
            <div class="partBody">
              <textarea id="part2" class="partTextarea" placeholder="Part2 を生成/編集できます"></textarea>
              <div class="partMeta"><span id="count2">0 chars / limit 6000</span></div>
            </div>
          </details>

          <details class="part" data-part="3">
            <summary>Part3 / 並び（ライン）</summary>
            <div class="partBody">
              <textarea id="part3" class="partTextarea" placeholder="Part3 を生成/編集できます"></textarea>
              <div class="partMeta"><span id="count3">0 chars / limit 6000</span></div>
            </div>
          </details>

          <details class="part" data-part="4">
            <summary>Part4 / 直近成績（全員）</summary>
            <div class="partBody">
              <textarea id="part4" class="partTextarea" placeholder="Part4 を生成/編集できます"></textarea>
              <div class="partMeta"><span id="count4">0 chars / limit 6000</span></div>
            </div>
          </details>

          <details class="part" data-part="5">
            <summary>Part5 / 選手マスター（紐づき）</summary>
            <div class="partBody">
              <textarea id="part5" class="partTextarea" placeholder="Part5 を生成/編集できます"></textarea>
              <div class="partMeta"><span id="count5">0 chars / limit 6000</span></div>
            </div>
          </details>

          <details class="part" data-part="6">
            <summary>Part6 / 当場成績（全員）</summary>
            <div class="partBody">
              <textarea id="part6" class="partTextarea" placeholder="Part6 を生成/編集できます"></textarea>
              <div class="partMeta"><span id="count6">0 chars / limit 6000</span></div>
            </div>
          </details>

          <details class="part" data-part="7">
            <summary>Part7 / 未使用（EX省略）</summary>
            <div class="partBody">
              <textarea id="part7" class="partTextarea" placeholder="Part7 を生成/編集できます"></textarea>
              <div class="partMeta"><span id="count7">0 chars / limit 6000</span></div>
            </div>
          </details>

          <!-- Part8 removed -->

          <div style="margin-top:10px;">
            <label style="font-weight:600;">最終プロンプト（送信用）</label>
            <textarea id="promptAll" class="partTextarea" readonly placeholder="ここに結合済みプロンプトが表示されます"></textarea>
          </div>

          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;">
            <button id="buildAllBtn" class="btn">結合更新</button>
            <button id="copyFinalBtn" class="btn">最終をコピー</button>
            <div style="flex:1"></div>
          </div>

        </div>

      </div>
    </section>
  `;

  // select に option を流し込む
  const sel = document.getElementById("savedRaceSelect");
  const btnUseSaved = document.getElementById("btnUseSaved");
  const zipInput = document.getElementById('predictZipInput');
  const zipBtn = document.getElementById('predictZipBtn');
  const zipMsg = document.getElementById('predictZipMsg');
  const inp = document.getElementById("raceKey");
  const out = document.getElementById("out");
  const gen = document.getElementById("gen");
  const attachChk = document.getElementById('attachRiderMasterChk');

  // restore checkbox state (guarded)
  if(attachChk){
    try{ attachChk.checked = (localStorage.getItem('kq_predict_attach_rider_v1') === '1'); }catch(e){}
    attachChk.addEventListener('change', ()=>{
      try{ localStorage.setItem('kq_predict_attach_rider_v1', attachChk.checked ? '1' : '0'); }catch(e){}
    });
  }

  if(saved.length === 0){
    sel.disabled = true;
    btnUseSaved.disabled = true;
    sel.options[0].textContent = "保存済みレースがありません（本日のレースでZIPを読み込んでください）";
  }else{
    saved.forEach(({venue, raceNo})=>{
      const opt = document.createElement("option");
      opt.value = `${venue}__${raceNo}`;
      opt.textContent = `${venue} ${raceNo}R`;
      sel.appendChild(opt);
    });
    // If only one saved race exists, pre-select it so generate is ready
    try{
      if(sel && sel.options && sel.options.length === 2){
        sel.selectedIndex = 1;
        if(btnUseSaved) btnUseSaved.disabled = false;
      }
    }catch(e){}
  }

  // ZIP読み込みボタンのワイヤリング
  if(zipBtn && zipInput){
    zipBtn.addEventListener('click', ()=> { try{ zipInput.click(); }catch(e){} });
    zipInput.addEventListener('change', async (ev)=>{
      const f = (ev.target && ev.target.files && ev.target.files[0]) ? ev.target.files[0] : null;
      if(!f) return;
      if(zipMsg) zipMsg.textContent = 'ZIPを読み込み中…';
      try{
        if(typeof window.kqHandleZipImport === 'function'){
          await window.kqHandleZipImport(f);
          if(zipMsg) zipMsg.textContent = '読み込み完了';
          setTimeout(()=>{ try{ renderPredict(); }catch(e){} }, 300);
        } else {
          if(zipMsg) zipMsg.textContent = 'ZIPハンドラ未定義';
        }
      }catch(err){ console.error('predict zip import failed', err); if(zipMsg) zipMsg.textContent = '読み込み失敗'; }
    });
  }

  // 今日タブで最後に見てたレースがあればデフォ選択
  const defaultKey = (ui && ui.venue && ui.raceNo) ? `${ui.venue}__${ui.raceNo}` : "";
  if(defaultKey){
    const exists = Array.from(sel.options).some(o => o.value === defaultKey);
    if(exists) sel.value = defaultKey;
  }

  function findRace(venue, raceNo){
    const v = venuesObj[venue];
    if(!v || !v.races) return null;
    return v.races[String(raceNo)] || null;
  }

  // helpers for prompt builder within predict page
  const partEls = [1,2,3,4,5,6,7].reduce((m,i)=>{ m[i] = document.getElementById('part'+i); return m; },{});
  const countEls = [1,2,3,4,5,6,7].reduce((m,i)=>{ m[i] = document.getElementById('count'+i); return m; },{});
  const promptAllEl = document.getElementById('promptAll');
  const genPartsBtn = document.getElementById('genParts');
  const buildAllBtn = document.getElementById('buildAllBtn');
  const copyFinalBtn = document.getElementById('copyFinalBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');

  function wireCount(id, limit = 6000){
    const ta = document.getElementById(id);
    const cnt = document.getElementById('count'+id.replace('part',''));
    if(!ta || !cnt) return;
    const update = ()=>{
      const l = (ta.value || '').length;
      const pct = Math.round(l / limit * 100);
      cnt.textContent = `${l} chars / limit ${limit}`;
      cnt.style.fontWeight = (pct >= 90) ? '700' : '400';
      cnt.style.color = (pct >= 100) ? '#b00' : (pct >= 90 ? '#b85' : '#666');
    };
    ta.addEventListener('input', update);
    update();
  }

  // master helpers (use existing loadRiderMaster / normalizeRiderName / makeRiderKeyFrom)
  function buildMasterMap(){
    const raw = loadRiderMaster() || {};
    const byKey = Object.assign({}, raw);

    // index: name-only, name+pref
    const byName = {};
    const byNamePref = {};

    for(const v of Object.values(byKey)){
      const n = normalizeRiderName(v?.name || v?.player || '');
      if(!n) continue;

      if(!byName[n]) byName[n] = [];
      byName[n].push(v);

      const pref = String(v?.pref || v?.area || '').trim();
      if(pref){
        const np = `${n}|${pref}`;
        if(!byNamePref[np]) byNamePref[np] = [];
        byNamePref[np].push(v);
      }
    }
    return { byKey, byName, byNamePref };
  }

  function pickMasterForEntry(entry, masterMap){
    if(!entry) return null;

    // 1) id
    if(entry.id){ const idk = `id:${entry.id}`; if(masterMap.byKey[idk]) return masterMap.byKey[idk]; }

    // 2) composite (name|pref|period)
    const ck = makeRiderKeyFrom(entry);
    if(ck && masterMap.byKey[ck]) return masterMap.byKey[ck];

    const n = normalizeRiderName(entry.name || entry.player || '');
    const pref = String(entry.pref || entry.area || '').trim();
    const period = String(entry.period || '').trim();

    // 3) name+pref fallback（period違いでも拾う）
    if(n && pref){
      const np = `${n}|${pref}`;
      const arr = masterMap.byNamePref[np];
      if(arr && arr.length){
        if(period){
          const hit = arr.find(v => String(v.period || '').trim() === period);
          if(hit) return hit;
        }
        return arr[0];
      }
    }

    // 4) name-only fallback（複数あってもとりあえず先頭を返す）
    if(n){
      const arr = masterMap.byName[n];
      if(arr && arr.length){
        if(period){
          const hit = arr.find(v => String(v.period || '').trim() === period);
          if(hit) return hit;
        }
        return arr[0];
      }
    }

    return null;
  }

  function extractRunners(r){
    return Array.isArray(r.entries) ? r.entries : (r.lineup || []);
  }

  function buildPartText_basicInfo(race, venue, memo, weather){
    const lines = [];
    lines.push(`【日付】 ${day.date || dateKey}`);
    lines.push(`【会場】 ${venue}`);
    if(race && race.raceNo) lines.push(`【レース】 ${race.raceNo}R ${race.raceName || ''}`);
    if(weather && weather.label) lines.push(`【天候】 ${weather.label}`);
    return lines.join('\n');
  }

  function buildPart2_table(race){
    const rows = [];
    const entries = extractRunners(race) || [];
    rows.push('番号 | 選手 | 年齢 | 級班 | 得点 | 脚質');
    rows.push('---|---|---:|---|---:|---');
    entries.forEach(en=>{
      const num = en.car || en.no || '';
      const name = en.name || en.player || '';
      const age = en.age || '';
      const grade = en.grade || en.class || '';
      const score = en.score || en.points || '';
      const style = en.style || en.ridingStyle || '';
      rows.push(`${num} | ${name} | ${age} | ${grade} | ${score} | ${style}`);
    });
    return rows.join('\n');
  }

  function buildPart4_recent(race){
    const entries = extractRunners(race) || [];
    const lines = [];
    entries.forEach(en=>{
      const name = en.name || en.player || '';
      const last = en.lastResults || en.last || en.recent || [];
      const short = Array.isArray(last) ? last.slice(0,5).join(', ') : String(last).split('\n').slice(0,5).join(', ');
      lines.push(`${en.car || ''} ${name}: ${short}`);
    });
    return lines.join('\n');
  }

  function buildPart5_comments(race){
    const entries = extractRunners(race) || [];
    const lines = [];
    entries.forEach(en=>{
      const name = en.name || en.player || '';
      const cm = en.comment || en.note || '';
      const short = String(cm).split('\n').map(s=>s.trim()).filter(Boolean).slice(0,3).join(' / ');
      lines.push(`${en.car || ''} ${name}: ${short}`);
    });
    return lines.join('\n');
  }

  function buildPart6_master(race){
    const masterMap = buildMasterMap();
    const entries = extractRunners(race) || [];
    const lines = [];
    const unmatched = [];
    // players from KEY.players
    const playersList = loadJSON(KEY.players, []) || [];
    const playersMap = {};
    for(const p of playersList){
      const n = normalizeRiderName(p.name || p.player || ''); if(!n) continue; playersMap[n] = p;
    }

    entries.forEach(en=>{
      const picked = pickMasterForEntry(en, masterMap);
      const name = en.name || en.player || '';
      const norm = normalizeRiderName(name || '');
      if(picked){
        const meta = [picked.pref || picked.area || picked.branch, picked.grade || '', picked.period || ''].filter(Boolean).join(' ');
        lines.push(`${en.car || ''} ${picked.name || name} ${meta ? `(${meta})` : ''}`);
        if(picked.comment) lines.push(`  - 特徴: ${String(picked.comment).split('\n').slice(0,3).join(' / ')}`);
        if(picked.links) lines.push(`  - links: ${Array.isArray(picked.links)? picked.links.join(', '): picked.links}`);
      } else if(playersMap[norm]){
        const pinfo = playersMap[norm];
        const meta = [pinfo.area || pinfo.pref || '', pinfo.grade || pinfo.class || '', pinfo.style || ''].filter(Boolean).join(' ');
        lines.push(`${en.car || ''} ${pinfo.name || name} ${meta ? `(${meta})` : ''}`);
        if(pinfo.note) lines.push(`  - note: ${String(pinfo.note).split('\n').slice(0,3).join(' / ')}`);
      } else {
        lines.push(`${en.car || ''} ${name}: ※未登録`);
        unmatched.push(`${en.car || ''} ${name}`);
      }
    });
    if(unmatched.length){
      lines.push('');
      lines.push('未登録：' + unmatched.join(' / '));
    }
    return lines.join('\n');
  }

  function buildPart6_trackResults(race, opt){
    // wrapper to provide track results per entry (keeps parity with previous naming)
    try{
      return buildPart7_trackResults(race, opt);
    }catch(e){ console.warn('buildPart6_trackResults failed', e); return ''; }
  }

  function formatLineupText(lineup){
    if(!lineup) return '';
    try{
      if(typeof lineup === 'string') return lineup.trim();
      if(Array.isArray(lineup)) return lineup.map(l=> typeof l === 'string' ? l : (typeof l === 'object' ? (l.name||JSON.stringify(l)) : String(l))).join('\n');
      if(typeof lineup === 'object'){
        // attempt friendly rendering if entries-like
        if(lineup.entries || lineup.lineup) return formatLineupText(lineup.entries || lineup.lineup);
        if(lineup.raw) return String(lineup.raw);
        // map object keys
        try{ return JSON.stringify(lineup, null, 2); }catch(e){ return String(lineup); }
      }
      return String(lineup);
    }catch(e){ return String(lineup); }
  }

  function formatHourlyFromWF(wf, dateKey){
    if(!wf || !wf.hourly) return '';
    const h = wf.hourly;
    const times = h.time || [];
    const temps = h.temperature_2m || [];
    const codes = h.weathercode || [];
    const winds = h.windspeed_10m || [];
    const dirs = h.winddirection_10m || [];
    const prcps = h.precipitation || [];
    const lines = [];
    for(let i=0;i<times.length;i++){
      const t = String(times[i]||'');
      if(!t.startsWith(String(dateKey))) continue;
      const hh = t.split('T')[1] || '';
      const temp = temps[i] != null ? temps[i] : '';
      const code = codes[i] != null ? codes[i] : '';
      const wind = winds[i] != null ? winds[i] : '';
      const dir = dirs[i] != null ? dirs[i] : '';
      const prcp = prcps[i] != null ? prcps[i] : '';
      lines.push(`${hh} | ${temp}°C | code:${code} | wind:${wind}m/s@${dir}° | prcp:${prcp}mm`);
    }
    // ensure 24 lines: if less, fill with '-'
    if(lines.length === 0) return '';
    return lines.join('\n');
  }

  function buildPart4_fromRecent(race, opt){
    opt = opt || {};
    const limit = (typeof opt.limit === 'number') ? opt.limit : 5;
    const entries = extractRunners(race) || [];
    const recentMap = (typeof parseRecentFromRawText === 'function') ? parseRecentFromRawText(race) : {};
    const lines = [];
    for(const e of entries){
      const car = String(e.car || '');
      const name = e.name || e.player || '';
      const recent = recentMap[car] || { ima: null, last10: [] };
      const ima = recent.ima ? (recent.ima.result || '-') : '-';
      const last = (recent.last10 || []).slice(0,limit).map(it => {
        const d = (it && it.date) ? it.date : '';
        const m = (it && it.meet) ? it.meet : '';
        const r = (it && it.chips) ? (it.chips.map(c=> (c.pos || '-') + (c.sb ? c.sb : '')).join(',')) : (it && it.result ? it.result : '-');
        return `${d}${m? ' '+m : ''} ${r}`.trim();
      }).join(' | ');
      lines.push(`${car} ${name}: 今場所=${ima} / 直近=${last || '-'}`);
    }
    return lines.join('\n');
  }

  function buildPart7_trackResults(race, opt){
    opt = opt || {};
    const limit = (typeof opt.limit === 'number') ? opt.limit : 10;
    const entries = race?.entries || [];
    const track = (typeof getTrackResults === 'function') ? getTrackResults(race) : [];
    const byCar = {};
    if(Array.isArray(track)) track.forEach(t=> byCar[String(t.car||'')] = t);
    const lines = [];
    for(const e of entries){
      const car = String(e.car || '');
      const name = e.name || '';
      const tr = byCar[car] || { items: [] };
      const parts = (tr.items || []).slice(0,limit).map(it => `${it.date || ''}${it.meet? ' '+it.meet : ''} ${ (it.chips || []).map(c=> (c.pos||'-') + (c.sb||'')).join(',') }`.trim());
      lines.push(`${car} ${name}: ${parts.join(' / ')}`);
    }
    return lines.join('\n');
  }

  function buildPart8_ex(race){
    try{
      const ex = race?.ex;
      const section = resolveExSection(ex) || '';
      let rows = [];
      if(section) rows = parseExRows(section, race?.entries || []);
      if(!rows || !rows.length) rows = buildEmptyExRows(race?.entries || []);
      const lines = rows.map(r => {
        const car = String(r.car || '');
        const name = r.name || '';
        const rates = r.rates || {};
        const rateParts = Object.keys(rates).filter(k => rates[k] && (rates[k].pct || rates[k].pct === 0)).map(k => `${k}:${rates[k].pct || rates[k].pct === 0 ? rates[k].pct : ''}`);
        const summary = rateParts.length ? rateParts.join(', ') : (r.meta || '');
        return `${car} ${name}: ${summary}`;
      });
      const truncated = section.length > 4000 ? section.slice(0,4000) + '\n...(truncated)' : section;
      return lines.join('\n') + '\n\n--- EX RAW ---\n' + truncated;
    }catch(e){ console.warn('buildPart8_ex failed', e); return ''; }
  }

  function buildAll(){
    const parts = [];
    for(let i=1;i<=7;i++){
      const v = (partEls[i] && partEls[i].value) ? partEls[i].value.trim() : '';
      if(v) parts.push(v);
    }
    const final = parts.join('\n---\n') + '\n\n以上で全部。これを前提に予想して';
    if(promptAllEl) promptAllEl.value = final;
    return final;
  }

  // helper: dynamic load script
  function loadScript(url){
    return new Promise((resolve, reject)=>{
      if(document.querySelector(`script[src="${url}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = url;
      s.onload = ()=> resolve();
      s.onerror = (e)=> reject(e);
      document.head.appendChild(s);
    });
  }

  function downloadBlob(filename, blob){
    try{
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 5000);
    }catch(e){ console.warn('download failed', e); }
  }

  async function exportPredictZip(){
    try{
      const exportBtn = document.getElementById('exportPredictZipBtn');
      if(exportBtn) exportBtn.disabled = true;

      // options
      const opts = {
        venueMemo: (document.getElementById('optVenueMemo') ? document.getElementById('optVenueMemo').checked : false),
        players: (document.getElementById('optPlayers') ? document.getElementById('optPlayers').checked : true),
        recent: (document.getElementById('optRecent') ? document.getElementById('optRecent').checked : true),
        track: (document.getElementById('optTrack') ? document.getElementById('optTrack').checked : true),
        ex: (document.getElementById('optEX') ? document.getElementById('optEX').checked : false),
        raw: (document.getElementById('optRaw') ? document.getElementById('optRaw').checked : true),
        allVenueMemo: (document.getElementById('optAllVenueMemo') ? document.getElementById('optAllVenueMemo').checked : false),
        allPlayers: (document.getElementById('optAllPlayers') ? document.getElementById('optAllPlayers').checked : false),
      };

      // choose race
      let race = null; let venue = ''; let raceNo = '';
      const selv = document.getElementById('savedRaceSelect');
      if(selv && selv.value){ const [v,rn] = selv.value.split('__'); venue = v; raceNo = rn; race = findRace(v,rn); }
      if(!race){ const key = (inp && inp.value) ? inp.value.trim() : ''; const m = key.match(/^(.+?)\s+(\d{1,2})$/); if(m){ venue = m[1].trim(); raceNo = m[2]; race = findRace(venue, raceNo); } }
      if(!race){ alert('レースが指定されていないか保存データが見つかりません'); if(exportBtn) exportBtn.disabled = false; return; }

      // ensure JSZip
      if(typeof JSZip === 'undefined'){
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      }
      if(typeof JSZip === 'undefined'){ alert('JSZip の読み込みに失敗しました'); if(exportBtn) exportBtn.disabled = false; return; }

      const zip = new JSZip();
      const manifestOptions = {
        includeVenueMemo: false,
        includePlayers: true,
        includeEx: false,
        includeRaw: false
      };
      const manifest = { version: 'kq_predict_zip_v1', createdAt: (new Date()).toISOString(), venue, raceNo, options: manifestOptions };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // race (lightweighted)
      try{
        function makeRaceLite(r){
          if(!r) return null;
          const out = {
            date: r.date,
            venue: r.venue || r.venueName || '',
            venueCode: r.venueCode || '',
            raceNo: r.raceNo,
            startTime: r.startTime || r.startAt || '',
            distance: r.distance || null,
            laps: r.laps || null,
            entries: (r.entries || []).map(e=>({
              car: e.car, name: e.name || e.player || '', area: e.area || e.pref || '', grade: e.grade || '', age: e.age || null, class: e.class || '', leg: e.leg || null, score: e.score || null, sb: e.sb || null, comment: e.comment || ''
            }))
          };
          return out;
        }
        const raceLite = makeRaceLite(race);
        zip.folder('race')?.file('race.json', JSON.stringify(raceLite || {}, null, 2));
      }catch(e){ zip.folder('race')?.file('race.json', JSON.stringify(race || {}, null, 2)); }
      zip.folder('race')?.file('entries.json', JSON.stringify(race?.entries || [], null, 2));

      // venue memo
      try{
        if(opts.venueMemo){
          const memoText = kqGetVenueMemoByName(venue) || '';
          zip.folder('venue')?.file('venue_memo.md', memoText);
          const vid = kqResolveVenueIdByName(venue) || '';
          zip.folder('venue')?.file('venue_id.txt', vid);
        }
        if(opts.allVenueMemo){
          const allm = (venuesMemo || []).map(v=> `# ${v.name}\n\n${v.note||''}`).join('\n\n');
          zip.folder('venue')?.file('venue_all_memo.md', allm);
        }
      }catch(e){ console.warn('venue memo add failed', e); }

      // players linked
      try{
        const entries = extractRunners(race) || [];
        const masterMap = buildMasterMap();
        const linked = [];
        const unmatched = [];
        for(const en of entries){
          const p = pickMasterForEntry(en, masterMap);
          linked.push({ entry: en, player: p || null });
          if(!p) unmatched.push(en.name || en.player || '');
        }
        if(opts.players) zip.folder('players')?.file('linked_players.json', JSON.stringify(linked, null, 2));
        zip.folder('players')?.file('unmatched.txt', (unmatched.length ? unmatched.join('\n') : ''));
        if(opts.allPlayers){ zip.folder('players')?.file('players_all.json', JSON.stringify(loadRiderMaster()||{}, null, 2)); }

        // include player card MD files for linked players and local players DB
        try{
          const playersList = loadJSON(KEY.players, []) || [];
          // write cards from linked players only
          for(const item of linked){
            const p = item && item.player;
            if(p && p.name && p.cardMd){
              zip.folder('players')?.file(`cards/${safeFileName(p.name)}.md`, String(p.cardMd));
            }
          }
          // include full players DB cards only when requested (opts.allPlayers)
          if(opts.allPlayers){
            for(const p of playersList){
              if(p && p.name && p.cardMd){
                zip.folder('players')?.file(`cards/${safeFileName(p.name)}.md`, String(p.cardMd));
              }
            }
          }
        }catch(e){ console.warn('players cards pack failed', e); }
      }catch(e){ console.warn('players pack failed', e); }

      // stats: recent & track
      try{
        if(opts.recent){ const recent = parseRecentFromRawText(race) || {}; zip.folder('stats')?.file('recent_results.json', JSON.stringify(recent, null, 2)); }
        if(opts.track){ const track = (typeof getTrackResults === 'function') ? getTrackResults(race) : []; zip.folder('stats')?.file('track_results.json', JSON.stringify(track, null, 2)); }
      }catch(e){ console.warn('stats pack failed', e); }

      // ex
      try{
        if(opts.ex){ zip.folder('ex')?.file('ex.json', JSON.stringify(race?.ex || {}, null, 2)); }
      }catch(e){ console.warn('ex pack failed', e); }

      // raw
      try{
        if(opts.raw){
          const parts = [];
          if(opts.ex && race?.ex) parts.push(JSON.stringify(race.ex));
          if(opts.ex && typeof getExRawText === 'function') parts.push(String(getExRawText(race?.ex) || ''));
          zip.folder('raw')?.file('rawtexts.txt', parts.join('\n\n'));
        }
      }catch(e){ console.warn('raw pack failed', e); }

      const filename = `KQ_predict_${(new Date()).toISOString().slice(0,10)}_${venue || 'unknown'}_${raceNo || 'R'}_v1.zip`;
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      downloadBlob(filename, blob);
      const msgEl = document.getElementById('weatherBox');
      if(msgEl) msgEl.textContent = `ZIP作成OK (${filename})`;
      if(exportBtn) exportBtn.disabled = false;
    }catch(err){ console.error('export failed', err); alert('ZIP作成に失敗しました（console参照）'); const exportBtn = document.getElementById('exportPredictZipBtn'); if(exportBtn) exportBtn.disabled = false; }
  }

  async function generateFromSaved(){
    try{
      if(!sel) { alert('保存済みセレクトが見つかりません'); return; }
      const v = sel.value;
      if(!v){ alert('保存済みレースを選択してください'); return; }
      const [venueRaw, raceNo] = v.split('__');
      const venue = venueRaw || '';

      // try findRace, with some tolerant fallbacks
      let race = findRace(venue, raceNo);
      if(!race){
        // try normalized key match
        const key = Object.keys(venuesObj).find(k => normalizeVenueName(k) === normalizeVenueName(venue) || k.includes(venue) || normalizeVenueName(k).includes(normalizeVenueName(venue)));
        if(key && venuesObj[key] && venuesObj[key].races) race = venuesObj[key].races[String(raceNo)] || null;
      }

      if(!race){ alert('保存済みレースが見つかりません'); return; }

      const memo = kqGetVenueMemoByName(venue);
      if(inp) inp.value = `${venue} ${raceNo}`;

      // fetch weather optionally (use resolve to geocode if needed)
      const wb = document.getElementById('weatherBox');
      if(wb){ wb.style.display = 'block'; wb.textContent = '天気を取得中…'; }
      let weather = null;
      let wf = null;
      try{
        const loc = (typeof kqResolveLatLonForVenue === 'function') ? await kqResolveLatLonForVenue(venue) : ((typeof kqGetLatLonForVenue === 'function') ? kqGetLatLonForVenue(venue) : null);
        if(loc && loc.lat != null && (loc.lon != null || loc.lng != null)){
          const startHHMM = String(race?.startTime || (race?.startAt ? race.startAt.slice(11,16) : '12:00')).slice(0,5);
          const wfTmp = await kqFetchTodayForecast(loc.lat, loc.lon ?? loc.lng, race?.date);
          if(wfTmp){
            wf = wfTmp;
            const idx = (typeof kqPickHourlyIndexAtStart === 'function') ? kqPickHourlyIndexAtStart(wf, startHHMM) : null;
            if(idx != null && typeof kqFormatHourlyLine === 'function'){
              const line = kqFormatHourlyLine(wf, idx);
              weather = line ? { label: line } : null;
            } else {
              weather = null;
            }
            if(wb) wb.textContent = '天気取得OK';
          } else {
            if(wb) wb.textContent = '天気取得失敗';
          }
        } else { if(wb) wb.textContent = '座標未登録'; }
      }catch(e){ console.warn(e); if(wb) wb.textContent = '天気取得失敗'; }

      // build integrated bundle (race + weather + venue + players)
      const bundle = await buildRaceBundle(dateKey, venue, raceNo);
      const r = bundle.race || race || {};

      // Part1: レース概要 + 発走時刻の予報（1行）
      if(partEls[1]){
        const wLabel = (typeof kqBuildRaceStartWeatherLabel === 'function') ? kqBuildRaceStartWeatherLabel(wf, r) : null;
        const weatherObj = wLabel ? { label: wLabel } : null;
        const base = buildPartText_basicInfo(r, venue, bundle.venueInfoText || memo, weatherObj);
        partEls[1].value = safeText(base);
      }

      // Part2: 出走表
      if(partEls[2]) partEls[2].value = safeText(buildPart2_table(r));

      // Part3: 並び（lineup）※race.json に lineup が入ってる前提
      if(partEls[3]){
        partEls[3].value = safeText(r.lineup ? `【並び】\n${r.lineup}` : '【並び】\n（並び情報なし）');
      }

      // Part4: 直近成績 + 前検コメント（結合）
      if(partEls[4]){
        const p4a = buildPart4_fromRecent(r, { limit: 999 });
        const p4b = buildPart5_comments(r);
        partEls[4].value = safeText([p4a, p4b].filter(Boolean).join('\n\n'));
      }

      // Part5: 選手マスター（紐づき）
      if(partEls[5]) partEls[5].value = safeText(buildPart6_master(r));

      // Part6: 当場成績（全員）
      if(partEls[6]) partEls[6].value = safeText(buildPart6_trackResults(r, { limit: 999 }));

      // Part7: 未使用（EX省略）
      if(partEls[7]) partEls[7].value = '';

      // update counters and final
      for(let i=1;i<=7;i++) wireCount('part'+i);
      buildAll();
    }catch(err){ console.error('generateFromSaved failed', err); alert('パート生成に失敗しました（console参照）'); }
  }

  if(btnUseSaved) btnUseSaved.onclick = generateFromSaved;

  if(gen) gen.onclick = async ()=>{
    if(sel.value){ await generateFromSaved(); return; }
    const key = (inp.value || "").trim();
    if(!key){ alert("保存済みを選ぶか、会場名とR番号を入力してください（例：松戸 6）"); return; }
    const m = key.match(/^(.+?)\s+(\d{1,2})$/);
    if(!m){ alert("形式が違います。例：松戸 6"); return; }
    const venue = m[1].trim();
    const raceNo = m[2];
    const race = findRace(venue, raceNo);
    if(!race){ alert("そのレースは保存済みにありません（本日のレースでZIPを読み込んでください）"); return; }
    // generate from manual
    await generateFromSaved();
  };

  // wire remaining buttons (guarded)
  const openTodayEl = document.getElementById("openToday");
  if(openTodayEl) openTodayEl.onclick = ()=> location.hash = "#/today";
  const openVenuesEl = document.getElementById("openVenues");
  if(openVenuesEl) openVenuesEl.onclick = ()=> location.hash = "#/venues";

  // wire top-level controls
  if(genPartsBtn) genPartsBtn.addEventListener('click', async ()=>{ await generateFromSaved(); });
  if(buildAllBtn) buildAllBtn.addEventListener('click', ()=> buildAll());
  if(copyFinalBtn) copyFinalBtn.addEventListener('click', ()=> navigator.clipboard.writeText((promptAllEl && promptAllEl.value) || ''));
  if(copyAllBtn) copyAllBtn.addEventListener('click', ()=>{ buildAll(); navigator.clipboard.writeText((promptAllEl && promptAllEl.value) || ''); });
  const exportZipBtn = document.getElementById('exportPredictZipBtn');
  if(exportZipBtn) exportZipBtn.addEventListener('click', ()=> exportPredictZip());
  // wire counters initially
  for(let i=1;i<=7;i++) wireCount('part'+i);
  for(let i=7;i<=7;i++) wireCount('part'+i);

  const predictBackBtn = document.getElementById('predictBackBtn');
  if(predictBackBtn) predictBackBtn.onclick = ()=> location.hash = "#/";
}

// ===== Weather: Open-Meteo (today / hourly) =====
function kqBuildOpenMeteoTodayUrl(lat, lon, dateStr){
  const base = "https://api.open-meteo.com/v1/forecast";
  const hourly = [
    "temperature_2m",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_gusts_10m",
    "weathercode",
    "windspeed_10m",
    "winddirection_10m"
  ].join(',');

  const p = new URLSearchParams();
  p.set('latitude', String(lat));
  p.set('longitude', String(lon));
  p.set('hourly', hourly);
  p.set('timezone', 'Asia/Tokyo');
  p.set('wind_speed_unit', 'ms');

  if(dateStr){
    p.set('start_date', dateStr);
    p.set('end_date', dateStr);
  } else {
    p.set('forecast_days', '1');
  }
  return `${base}?${p.toString()}`;
}

async function kqFetchTodayForecast(lat, lon, dateStr){
  const url = kqBuildOpenMeteoTodayUrl(lat, lon, dateStr);
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`open-meteo: ${res.status} ${res.statusText}`);
  return await res.json();
}

// pick nearest hourly entry to race start time
function kqPickHourlyAtRaceStart(wf, dateStr, startHHMM){
  if(!wf || !wf.hourly || !Array.isArray(wf.hourly.time)) return null;
  if(!dateStr || !startHHMM) return null;
  const [sh, sm] = (startHHMM||'').split(':').map(n=>parseInt(n,10));
  if(Number.isNaN(sh) || Number.isNaN(sm)) return null;
  const targetMin = sh*60 + sm;
  let bestI = -1, bestDiff = Infinity;
  for(let i=0;i<wf.hourly.time.length;i++){
    const t = String(wf.hourly.time[i]||'');
    if(!t.startsWith(dateStr+'T')) continue;
    const hhmm = (t.slice(11,16))||'';
    const [h,m] = hhmm.split(':').map(n=>parseInt(n,10));
    if(Number.isNaN(h) || Number.isNaN(m)) continue;
    const min = h*60 + m;
    const diff = Math.abs(min - targetMin);
    if(diff < bestDiff){ bestDiff = diff; bestI = i; }
  }
  if(bestI < 0) return null;
  const t = String(wf.hourly.time[bestI]||'').slice(11,16);
  const temp = wf.hourly.temperature_2m?.[bestI] ?? null;
  const code = wf.hourly.weathercode?.[bestI] ?? wf.hourly.weather_code?.[bestI] ?? null;
  const wind = wf.hourly.windspeed_10m?.[bestI] ?? wf.hourly.wind_speed_10m?.[bestI] ?? null;
  const prcp = wf.hourly.precipitation?.[bestI] ?? null;
  const gust = wf.hourly.windgusts_10m?.[bestI] ?? wf.hourly.wind_gusts_10m?.[bestI] ?? null;
  return { t, temp, code, wind, prcp, gust };
}

function kqBuildRaceStartWeatherLabel(wf, race){
  const hhmm = race?.startTime || (race?.startAt ? (race.startAt.slice(11,16)) : null);
  const picked = kqPickHourlyAtRaceStart(wf, race?.date, hhmm);
  if(!picked) return null;
  const jp = (typeof kqWeatherCodeToJp === 'function') ? kqWeatherCodeToJp(picked.code) : null;
  const parts = [
    `発走${hhmm}（${picked.t}予報）`,
    (picked.temp != null ? `${Number(picked.temp).toFixed(1)}℃` : null),
    (jp ? jp : null),
    (picked.wind != null ? `風${Number(picked.wind).toFixed(1)}m/s` : null),
    (picked.gust != null ? `G${Number(picked.gust).toFixed(1)}m/s` : null),
    (picked.prcp != null ? `降水${Number(picked.prcp).toFixed(1)}mm` : null)
  ].filter(Boolean);
  return parts.join(' ');
}

function kqRenderTodayWeatherBox(venue, data, dateKey) {
  const box = document.getElementById("todayWeatherBox");
  if (!box) return;

  const h = data?.hourly || {};
  const times = h.time || [];
  const temps = h.temperature_2m || [];
  const codes = h.weathercode || [];
  const wind  = h.windspeed_10m || [];
  const gust  = h.windgusts_10m || [];
  const dir   = h.winddirection_10m || [];
  const prcp  = h.precipitation || [];

  const idxs = [];
  for (let i = 0; i < times.length; i++){
    const t = String(times[i] || '');
    if(!t) continue;
    if (dateKey && !t.startsWith(dateKey)) continue;
    idxs.push(i);
    if(idxs.length >= 24) break;
  }

  if(!idxs.length){
    box.classList.remove("is-loading");
    box.classList.add("is-error");
    box.innerHTML = `<div class="wxError">天気（${escapeHTML(venue)}）：1時間予報が取得できません</div>`;
    return;
  }

  const rows = idxs.map(i => {
    const t = String(times[i] || "");
    const hhmm = (t.split("T")[1] || "").slice(0,5) || t;
    const tempTxt = Number.isFinite(temps[i]) ? `${Math.round(temps[i])}°` : "-";
    const windTxt = Number.isFinite(wind[i]) ? `${Math.round(wind[i])}m/s` : "-";
    const gustTxt = Number.isFinite(gust[i]) ? `${Math.round(gust[i])}m/s` : "-";
    const dirDeg = Number.isFinite(dir[i]) ? Math.round(dir[i]) : null;
    const dirTxt = (dirDeg == null) ? "-" : `${degToCompass(dirDeg)}(${dirDeg}°)`;
    const prcpTxt = Number.isFinite(prcp[i]) ? `${prcp[i].toFixed(1)}mm` : "-";
    const condTxt = weatherCodeToLabel(codes[i]);

    return `
      <tr>
        <td class="wxTime">${escapeHTML(hhmm)}</td>
        <td class="wxCond">${escapeHTML(condTxt)}</td>
        <td class="wxTemp">${escapeHTML(tempTxt)}</td>
        <td class="wxWind">${escapeHTML(windTxt)}</td>
        <td class="wxGust">${escapeHTML(gustTxt)}</td>
        <td class="wxDir">${escapeHTML(dirTxt)}</td>
        <td class="wxPrcp">${escapeHTML(prcpTxt)}</td>
      </tr>
    `;
  }).join('');

  box.classList.remove("is-hidden","is-error","is-loading");
  box.innerHTML = `
    <div class="wxHead">
      <div class="wxTitle">天気（${escapeHTML(venue)}）</div>
      <div class="wxSub">今日の1時間予報（24時間） / Open-Meteo</div>
    </div>
    <div class="wxScroll">
      <table class="wxTable">
        <thead>
          <tr>
            <th>時刻</th><th>天気</th><th>気温</th><th>風</th><th>ガスト</th><th>風向</th><th>降水</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

try{ window.kqFetchTodayForecast = kqFetchTodayForecast; }catch(e){}
try{ window.kqRenderTodayWeatherBox = kqRenderTodayWeatherBox; }catch(e){}


// ----- helpers for extracting sections from raw EX text -----
function findSection(raw, startLabels, endLabels){
  if(!raw) return '';
  let start = -1;
  for(const lbl of startLabels){
    const i = raw.indexOf(lbl);
    if(i >= 0){ start = i; break; }
  }
  if(start < 0) return '';
  let end = raw.length;
  for(const lbl of endLabels){
    const j = raw.indexOf(lbl, start + 1);
    if(j >= 0 && j < end) end = j;
  }
  return raw.slice(start, end).trim();
}

function renderZenkenHtml(race){
  const ex = race?.ex;
  const block = getExBlock(ex, 'preInspectionComments');
  let sectionText = (block && block.trim()) ? block : '';
  if(!sectionText){
    const raw = getExRawText(ex);
    sectionText = findSection(raw, ['前検コメント','前検 コメント','前検コメント：'], ['対戦成績','EXデータ','ＥＸデータ','直近成績','基本情報','出走表']) || '';
  }
  if(!sectionText.trim()){
    if(ex && (typeof ex.rawText === 'boolean' || ex.blocks === true || ex.mode === 'files_only')){
      return `<div class="empty">このJSONは軽量(app)形式で本文未収録です（allin を読み込んでください）</div>`;
    }
    return `<div class="empty">前検コメントデータがありません</div>`;
  }

  const groups = splitZenkenByCar(sectionText);
  return renderZenkenCards(groups, race?.entries || [], sectionText);
}

function normalizeZenkenText(text){
  return String(text ?? "").replace(/\r/g,"").normalize("NFKC");
}

function splitZenkenByCar(sectionText){
  if(!sectionText) return [];
  const src0 = normalizeZenkenText(sectionText);
  const repaired = src0.replace(/([^\n])([1-9])(?=[ \t　]+[^\d\n]{2,20})/g, "$1\n$2");
  const lines = repaired.split("\n").map(l=>l.trim()).filter(Boolean);
  const numOnlyRe = /^([1-9])$/;
  const headRe = /^([1-9])(?:[\s:：\)\]）】\-\.\、,]+)?(.*)$/;
  const groups = [];
  let current = null;

  for(const ln of lines){
    const numOnly = ln.match(numOnlyRe);
    if(numOnly){
      if(current) groups.push(current);
      current = { car: numOnly[1], text: "" };
      continue;
    }

    const head = ln.match(headRe);
    if(head){
      if(current) groups.push(current);
      current = { car: head[1], text: (head[2] || "").trim() };
      continue;
    }

    if(current){
      current.text += (current.text ? "\n" : "") + ln;
    }
  }

  if(current) groups.push(current);
  return groups;
}

function carColorStyle(car){
  const map = {
    1:{bg:"#fff", fg:"#111"},
    2:{bg:"#111", fg:"#fff"},
    3:{bg:"#e53935", fg:"#fff"},
    4:{bg:"#1e5bff", fg:"#fff"},
    5:{bg:"#ffd400", fg:"#111"},
    6:{bg:"#1fb35b", fg:"#fff"},
    7:{bg:"#ff7a00", fg:"#fff"},
    8:{bg:"#ff6fb3", fg:"#111"},
    9:{bg:"#7a3cff", fg:"#fff"},
  };
  const n = Number(car);
  const c = map[n] || {bg:"#111", fg:"#fff"};
  return `background:${c.bg};color:${c.fg};border:1px solid rgba(0,0,0,.18)`;
}

function renderZenkenCards(groups, entries, sectionText){
  if(!groups.length){
    return `<pre class="exPre">${escapeHTML(sectionText)}</pre>`;
  }

  const groupMap = {};
  groups.forEach(g => {
    const car = String(g.car || "").trim();
    if(!car) return;
    groupMap[car] = groupMap[car]
      ? `${groupMap[car]}\n${g.text}`
      : g.text;
  });

  const cards = [];
  const used = new Set();

  const renderComment = (text)=> text ? escapeHTML(text).replace(/\n+/g,"<br>") : "コメントなし";

  const renderCard = (car, entry, comment)=>{
    const style = carColorStyle(car.substr(0,1));
    const name = entry?.name || "選手";
    const meta = entry ? [entry.area, entry.grade].filter(Boolean).join(" / ") : "前検コメント";
    return `
      <article class="zenkenCard">
        <div class="zenkenCard__top">
          <span class="zenkenCard__number" style="${style}">${escapeHTML(car)}</span>
          <div class="zenkenCard__title">
            <div class="zenkenCard__name">${escapeHTML(name)}</div>
            <div class="zenkenCard__meta">${escapeHTML(meta)}</div>
          </div>
        </div>
        <p class="zenkenCard__comment">${renderComment(comment)}</p>
      </article>
    `;
  };

  entries.forEach(entry => {
    const car = String(entry.car || "");
    const comment = groupMap[car] || "";
    cards.push(renderCard(car || "-", entry, comment));
    used.add(car);
  });

  Object.keys(groupMap).sort((a,b)=>Number(a)-Number(b)).forEach(car => {
    if(used.has(car)) return;
    cards.push(renderCard(car, null, groupMap[car]));
  });

  return `<section class="preInspectionCards">${cards.join("")}</section>`;
}

function renderExHtml(race){
  const ex = race?.ex;
  const sectionText = resolveExSection(ex);
  if(!sectionText.trim()){
    if(ex && (typeof ex.rawText === 'boolean' || ex.blocks === true || ex.mode === 'files_only')){
      return `<div class="empty">EXデータが軽量形式です。allin ファイルをご用意ください。</div>`;
    }
    return `<div class="empty">EXデータがありません</div>`;
  }

  let rows = parseExRows(sectionText, race?.entries || []);
  window.__exDebug = {
    sectionHead: sectionText.slice(0, 300),
    rows,
    car1: rows.find(r => r.car === "1"),
    car7: rows.find(r => r.car === "7"),
  };
  console.log("[EX DEBUG]", {
    len: rows.length,
    car1: window.__exDebug.car1?.rates,
    car7: window.__exDebug.car7?.rates,
  });

  if(!rows.length){
    rows = buildEmptyExRows(race?.entries || []);
  }

  return renderExWinticketTable(rows, race?.entries || []);
}

function buildEmptyExRows(entries){
  const list = entries || [];
  if(!list.length){
    return [{
      car: "-",
      name: "選手",
      meta: "",
      rates: {},
      stats: {},
    }];
  }
  return list.map(e => ({
    car: String(e.car ?? ""),
    name: e.name || "選手",
    meta: [e.area, e.grade, e.age ? `${e.age}歳` : null].filter(Boolean).join(' / '),
    rates: {},
    stats: {},
  }));
}

function resolveExSection(ex){
  if(!ex) return '';
  const block = getExBlock(ex, 'advancedStats') || getExBlock(ex, 'exData');
  const rawSection = ['EXデータ','ＥＸデータ','EX データ'];
  const rawEnd = ['前検コメント','直近成績','対戦成績','基本情報','出走表'];
  let text = '';
  let route = 'raw';
  if(block && block.trim()){
    text = normalizeText(block);
    route = 'block';
  } else {
    const raw = getExRawText(ex);
    text = normalizeText(findSection(raw, rawSection, rawEnd) || '');
  }
  console.log('[resolveExSection]', route, text.slice(0, 200));
  return text;
}

function normalizeText(text){
  return String(text ?? "").replace(/\r/g, "").normalize("NFKC");
}

function extractImaFromRowSlice(rowSlice){
  // rowSlice は「選手名行」から始まる想定
  // 1行目=名前 / 2行目=府県S級年齢期（数字が多いのでスキップ）
  const p1 = rowSlice.indexOf('\n');
  const p2 = rowSlice.indexOf('\n', p1 + 1);
  if(p1 < 0 || p2 < 0) return null;

  const afterInfo = rowSlice.slice(p2 + 1);

  // 最初の「日付」を境界にする（今場所は日付より前にある）
  const mDate = afterInfo.match(/\b\d{1,2}\/\d{1,2}\b/);
  const head = mDate ? afterInfo.slice(0, mDate.index) : afterInfo;

  // 「行単体の数字」+ 次トークンがS/B ならそれも付ける
  const m = head.match(/(?:^|\n)\s*(\d{1,2}|-)\s*(?:\s+([BS]))?/);
  if(!m) return null;

  return (m[1] + (m[2] ? ` ${m[2]}` : '')).trim();
}

const SUCCESS_RATE_KEYS = [
  { key: 'kamashi', label: 'かまし成功率' },
  { key: 'tsuppari', label: 'つっぱり成功率' },
  { key: 'chigiri', label: 'ちぎり率' },
  { key: 'chigirare', label: 'ちぎられ率' },
  { key: 'tobitsuki', label: '飛びつき成功率' },
  { key: 'seriWin', label: '競りの勝率' },
];

const EX_RATE_KEYS = ["kamashi","tsuppari","chigiri","chigirare","tobitsuki","seriWin"];

const STATS_LABELS = [
  { key: 'lineHead', label: 'ラインの先頭の成績' },
  { key: 'banTe', label: '番手の成績' },
  { key: 'thirdPlus', label: '3番手以降の成績' },
  { key: 'tanki', label: '単騎の成績' },
  { key: 'seri', label: '競りの成績' },
  { key: 'yosen', label: '予選の成績' },
  { key: 'junKetsu', label: '準決勝の成績' },
  { key: 'kessho', label: '決勝の成績' },
  { key: 'haisha', label: '敗者戦の成績' },
  { key: 'seed', label: 'シード戦の成績' },
  { key: 'bank400', label: '400mバンクの成績' },
  { key: 'bank333', label: '333mバンクの成績' },
  { key: 'bank500', label: '500mバンクの成績' },
  { key: 'sunny', label: '晴れの成績' },
  { key: 'cloudy', label: '曇りの成績' },
  { key: 'rainy', label: '雨の成績' },
  { key: 'snowy', label: '雪の成績' },
  { key: 'morning', label: 'モーニングの成績' },
  { key: 'day', label: 'デイの成績' },
  { key: 'night', label: 'ナイターの成績' },
  { key: 'midnight', label: 'ミッドナイトの成績' },
];

const EX_STAT_GROUPS = [
  "lineHead","banTe","thirdPlus","tanki","seri",
  "yosen","junKetsu","kessho","haisha","seed",
  "bank400","bank333","bank500",
  "sunny","cloudy","rainy","snowy",
  "morning","day","night","midnight",
];

const EX_COLUMNS = [
  { type: "rate", key: "kamashi",   label: "かまし<br>成功率" },
  { type: "rate", key: "tsuppari",  label: "つっぱり<br>成功率" },
  { type: "rate", key: "chigiri",   label: "ちぎり率" },
  { type: "rate", key: "chigirare", label: "ちぎられ率" },
  { type: "rate", key: "tobitsuki", label: "飛びつき<br>成功率" },
  { type: "rate", key: "seriWin",   label: "競りの<br>勝率" },
  { type: "stat", key: "lineHead",  label: "ラインの先頭の<br>成績" },
  { type: "stat", key: "banTe",     label: "番手の<br>成績" },
  { type: "stat", key: "thirdPlus", label: "3番手以降の<br>成績" },
  { type: "stat", key: "tanki",     label: "単騎の<br>成績" },
  { type: "stat", key: "seri",      label: "競りの<br>成績" },
  { type: "stat", key: "yosen",     label: "予選の<br>成績" },
  { type: "stat", key: "junKetsu",  label: "準決勝の<br>成績" },
  { type: "stat", key: "kessho",    label: "決勝の<br>成績" },
  { type: "stat", key: "haisha",    label: "敗者戦の<br>成績" },
  { type: "stat", key: "seed",      label: "シード戦の<br>成績" },
  { type: "stat", key: "bank400",   label: "400mバンクの<br>成績" },
  { type: "stat", key: "bank333",   label: "333mバンクの<br>成績" },
  { type: "stat", key: "bank500",   label: "500mバンクの<br>成績" },
  { type: "stat", key: "sunny",     label: "晴れの<br>成績" },
  { type: "stat", key: "cloudy",    label: "曇りの<br>成績" },
  { type: "stat", key: "rainy",     label: "雨の<br>成績" },
  { type: "stat", key: "snowy",     label: "雪の<br>成績" },
  { type: "stat", key: "morning",   label: "モーニングの<br>成績" },
  { type: "stat", key: "day",       label: "デイの<br>成績" },
  { type: "stat", key: "night",     label: "ナイターの<br>成績" },
  { type: "stat", key: "midnight",  label: "ミッドナイトの<br>成績" },
];






function parseExRows(sectionText, entries){
  if(!sectionText) return [];
  const norm = normalizeText(sectionText);
  let rows = [];
  const isVertical = norm.includes("かまし") && norm.includes("成功率") && norm.includes("ミッドナイトの成績");
  if(isVertical){
    rows = parseExRowsCarBlock(norm, entries);
  }
  if(!rows.length){
    rows = parseExRowsMetricFirst(norm);
  }
  if(rows.length && rows.every(r => r.rates && Object.values(r.rates).every(v => !v?.pct))){
    fillRowsByMetricSections(norm, rows);
  }
  return rows;
}

function parseExRowsCarBlock(sectionText, entries = []){
  const { body } = sliceAdvancedStatsBody(sectionText);
  const lines = body.split('\n');
  const trimmed = lines.map(l => l.trim());
  const starts = findRiderBlockStarts(trimmed);
  const totalPairsNeeded = EX_RATE_KEYS.length + EX_STAT_GROUPS.length * 4;
  const rows = [];

  for(let idx = 0; idx < starts.length; idx++){
    const current = starts[idx];
    const next = starts[idx + 1];
    const endIdx = next ? next.index : trimmed.length;
    const blockLines = trimmed.slice(current.dataStart, endIdx);
    const valueLines = blockLines.filter(Boolean).filter(isExValueLine);
    const pairs = [];
    for(let i = 0; i < valueLines.length; i += 2){
      const pctLine = valueLines[i] ?? "-";
      const detLine = valueLines[i + 1] ?? "";
      pairs.push(toPctDetail(pctLine, detLine));
    }
    while(pairs.length < totalPairsNeeded){
      pairs.push(emptyPctDetail());
    }

    const entry = entries.find(en => String(en.car) === String(current.car));
    const row = {
      car: String(current.car),
      name: entry?.name || current.name || "選手",
      meta: entry
        ? [entry.area, entry.grade, entry.age ? `${entry.age}歳` : null].filter(Boolean).join(" / ")
        : current.meta || "",
      rates: {},
      stats: {},
    };

    let p = 0;
    EX_RATE_KEYS.forEach(key => {
      row.rates[key] = pairs[p++] || emptyPctDetail();
    });
    EX_STAT_GROUPS.forEach(group => {
      row.stats[group] = {
        first: pairs[p++] || emptyPctDetail(),
        second: pairs[p++] || emptyPctDetail(),
        third: pairs[p++] || emptyPctDetail(),
        out: pairs[p++] || emptyPctDetail(),
      };
    });

    rows.push(row);
  }

  return rows;
}

function sliceAdvancedStatsBody(text){
  const startCandidates = ["かまし\n成功率","かまし成功率","かまし 成功率"];
  const endCandidates = [
    "\n\n当場成績","\n当場成績","\n当場 成績",
    "\n今場所\n直近1",
    "\n枠\n車\n選手名\n今場所",
    "\n直近1"
  ];
  let startIdx = -1;
  for(const candidate of startCandidates){
    const idx = text.indexOf(candidate);
    if(idx !== -1 && (startIdx === -1 || idx < startIdx)){
      startIdx = idx;
    }
  }
  if(startIdx === -1) startIdx = 0;
  let endIdx = text.length;
  for(const candidate of endCandidates){
    const idx = text.indexOf(candidate, startIdx);
    if(idx !== -1 && idx < endIdx){
      endIdx = idx;
    }
  }
  const body = text.slice(startIdx, endIdx);
  console.log("[EX SLICE]", { startIdx, endIdx, head: body.slice(0,120), tail: body.slice(-120) });
  return { body, startIdx, endIdx };
}

function findRiderBlockStarts(lines){
  const starts = [];
  const metaRe = /(?:歳|才).*期|(?:A|S)\d/;
  for(let i = 0; i < lines.length; i++){
    const a = lines[i];
    if(!/^[1-9]$/.test(a)) continue;
    const b = lines[i + 1] ?? "";
    const c = lines[i + 2] ?? "";
    const d = lines[i + 3] ?? "";
    if(/^[1-9]$/.test(b) && c && metaRe.test(d)){
      starts.push({ index: i, car: b, name: c, meta: d, dataStart: i + 4 });
      i += 3;
      continue;
    }
    if(b && metaRe.test(c)){
      starts.push({ index: i, car: a, name: b, meta: c, dataStart: i + 3 });
      i += 2;
      continue;
    }
  }
  console.log("[EX STARTS]", starts.map(s => s.car || "?"));
  return starts;
}

function isExValueLine(line){
  if(/^\d{1,3}%$/.test(line)) return true;
  if(/^[（(]\s*\d+\s*\/\s*\d+\s*[）)]$/.test(line)) return true;
  if(/^-+$/.test(line)) return true;
  return false;
}

function toPctDetail(pctLine, detLine){
  const dash = /^-+$/.test(pctLine);
  const pct = dash ? "" : pctLine.replace("%","").trim();
  const detailMatch = String(detLine).match(/(\d+\s*\/\s*\d+)/);
  const detail = detailMatch ? detailMatch[1].replace(/\s/g,"") : "";
  return dash ? { pct: "", detail: detail || "0/0" } : { pct, detail };
}

function emptyPctDetail(){
  return { pct: "", detail: "" };
}

function parseExRowsMetricFirst(sectionText){
  const lines = sectionText.split('\n').map(l=>l.trim()).filter(Boolean);
  const carBlocks = {};
  let currentCar = null;
  for(const line of lines){
    const matchCar = line.match(/^([1-9])(?:[\s:：)\]】\-\.,、・]*)?(.*)$/u);
    if(matchCar){
      currentCar = matchCar[1];
      carBlocks[currentCar] = carBlocks[currentCar] || [];
      if(matchCar[2]) carBlocks[currentCar].push(matchCar[2].trim());
      continue;
    }
    const numOnly = line.match(/^([1-9])$/);
    if(numOnly){
      currentCar = numOnly[1];
      carBlocks[currentCar] = carBlocks[currentCar] || [];
      continue;
    }
    if(currentCar){
      carBlocks[currentCar].push(line);
    }
  }
  const rows = [];
  Object.keys(carBlocks).sort((a,b)=>Number(a)-Number(b)).forEach(car => {
    const blockText = carBlocks[car].join(' ');
    const row = {
      car,
      rateText: blockText,
      name: '',
      meta: '',
      rates: {},
      stats: {},
    };
    SUCCESS_RATE_KEYS.forEach(({key,label}) => {
      row.rates[key] = extractRate(blockText, label);
    });
    STATS_LABELS.forEach(({key,label}) => {
      row.stats[key] = extractStat(blockText, label);
    });
    rows.push(row);
  });
  return rows;
}

const METRIC_LABELS = {
  kamashi: ["かまし成功率","かまし 成功率","かまし成功率の成績"],
  tsuppari: ["つっぱり成功率","つっぱり 成功率"],
  chigiri: ["ちぎり率","ちぎり 率"],
  chigirare: ["ちぎられ率","ちぎられ 率"],
  tobitsuki: ["飛びつき成功率","飛びつき 成功率"],
  seriWin: ["競りの勝率","競り勝率"],
};

const ALL_METRIC_LABELS = Object.values(METRIC_LABELS).flat();

function fillRowsByMetricSections(sectionText, rows){
  if(!sectionText) return;
  const norm = normalizeText(sectionText);
  Object.entries(METRIC_LABELS).forEach(([key, labels]) => {
    let bestLabel = '';
    let bestPos = Infinity;
    labels.forEach(label => {
      const pos = norm.indexOf(label);
      if(pos !== -1 && pos < bestPos){
        bestPos = pos;
        bestLabel = label;
      }
    });
    if(!bestLabel) return;
    const section = extractSectionByLabel(norm, bestLabel);
    if(!section) return;
    const lines = section.split('\n').map(l=>l.trim()).filter(Boolean);
    const bodyLines = lines.filter(l => !labels.includes(l));
    bodyLines.forEach(line => {
      const m = line.match(/^([1-9])[\s　]+.*?(\d{1,3})%/);
      if(!m) return;
      const car = m[1];
      const pct = m[2];
      const detailMatch = line.match(/[（(]\s*(\d{1,4}\s*\/\s*\d{1,5})\s*[）)]/);
      const detail = detailMatch ? detailMatch[1].replace(/\s/g,'') : '';
      let row = rows.find(r => r.car === car);
      if(!row){
        row = { car, rates: {}, stats: {}, name:'', meta:'' };
        rows.push(row);
      }
      row.rates[key] = { pct, detail };
    });
  });
}

function extractSectionByLabel(norm, label){
  const start = norm.indexOf(label);
  if(start < 0) return '';
  let end = norm.length;
  ALL_METRIC_LABELS.forEach(lbl => {
    if(lbl === label) return;
    const idx = norm.indexOf(lbl, start + label.length);
    if(idx !== -1 && idx < end){
      end = idx;
    }
  });
  return norm.slice(start, end);
}

function extractRate(text, label){
  const re = new RegExp(`${label}[\\s\\S]*?(\\d{1,3})%`, 'u');
  const match = text.match(re);
  if(!match) return null;
  const pct = match[1];
  const detailMatch = text.match(new RegExp(`${label}[\\s\\S]*?\\((\\d{1,3}\\/\\d{1,5})\\)`, 'u'));
  return { pct, detail: detailMatch ? detailMatch[1] : '' };
}

function extractStat(text, label){
  const baseRe = new RegExp(`${label}[\\s\\S]*?1着\\s*(\\S+)`, 'u');
  const first = text.match(baseRe)?.[1] || '—';
  const second = text.match(new RegExp(`${label}[\\s\\S]*?2着\\s*(\\S+)`, 'u'))?.[1] || '—';
  const third = text.match(new RegExp(`${label}[\\s\\S]*?3着\\s*(\\S+)`, 'u'))?.[1] || '—';
  const out = text.match(new RegExp(`${label}[\\s\\S]*?着外\\s*(\\S+)`, 'u'))?.[1] || '—';
  return { first, second, third, out };
}

function renderExWinticketTable(rows, entries){
  const entryMap = {};
  (entries || []).forEach(e => { entryMap[String(e.car)] = e; });

  // force initial expanded state; remove any persisted collapsed flag
  try{ localStorage.removeItem('exStatsCollapsed'); }catch(e){ /* ignore */ }
  const isCollapsed = false;
  const toggleLabel = isCollapsed ? "成績を表示" : "成績を隠す";

  const headerCells = [
    '<th class="sticky-col">車番 / 選手</th>',
    ...EX_COLUMNS.map(c => `<th class="${c.type === 'stat' ? 'colStat' : 'colRate'}">${c.label}</th>`),
  ].join('');

  const bodyHtml = (rows || []).map(r => renderExTableRow(entryMap[String(r.car)], r)).join('');

  return `
    <div class="exTableShell ${isCollapsed ? "is-collapsed" : ""}">

      <div class="exScrollBar" role="toolbar" aria-label="EX横スクロール">
        <button class="exScrollBtn" type="button" data-dir="-1">◀</button>
        <button class="exToggleBtn" type="button" data-action="toggle">${toggleLabel}</button>
        <button class="exScrollBtn" type="button" data-dir="1">▶</button>
      </div>

      <div class="exTableWrap" tabindex="0">
        <div class="exTableInner">
          <table class="exTable" aria-label="EX">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>
              ${bodyHtml || `<tr><td colspan="${1 + EX_COLUMNS.length}">情報がありません</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

function renderExTableRow(entry, row){
  if(!row) return `<tr><td colspan="${1 + EX_COLUMNS.length}">情報がありません</td></tr>`;
  const name = entry?.name || row.name || '選手';
  const meta = entry ? [entry.area, entry.grade, entry.age ? `${entry.age}歳` : null].filter(Boolean).join(' / ') : (row.meta || '');
  const columnCells = EX_COLUMNS.map(col => {
    if(col.type === 'rate') return renderRateCell(row.rates?.[col.key], 'colRate');
    return renderStatCell(row.stats?.[col.key], 'colStat');
  });
  return `
    <tr>
      <td class="sticky-col">
        <div class="exLeftCell">
          <span class="carBadge car-${escapeHTML(row.car)}">${escapeHTML(row.car)}</span>
          <div class="rtNameBlock">
            <div class="rtName" title="${escapeHTML(name)}">${escapeHTML(name)}</div>
            <div class="rtMeta">${escapeHTML(meta)}</div>
          </div>
        </div>
      </td>
      ${columnCells.join('')}
    </tr>
  `;
}

function fmtPct(cell){
  const pct = cell?.pct;
  return pct ? `${escapeHTML(pct)}%` : '—';
}
function fmtDetail(cell){
  const detail = cell?.detail;
  return detail ? `(${escapeHTML(detail)})` : '';
}
function renderRateCell(cell, extraClass=""){
  const className = ['rate-cell', extraClass].filter(Boolean).join(' ');
  return `
    <td class="${className}">
      <div class="rateCell">
        <div class="rate-pct">${fmtPct(cell)}</div>
        <div class="rate-detail">${fmtDetail(cell)}</div>
      </div>
    </td>
  `;
}
function renderStatCell(stat, extraClass=""){
  const parts = [
    ['1着', stat?.first],
    ['2着', stat?.second],
    ['3着', stat?.third],
    ['着外', stat?.out],
  ];
  const className = ['stat-cell', extraClass].filter(Boolean).join(' ');
  return `
    <td class="${className}">
      <div class="stat-grid">
        ${parts.map(([label, cell]) => `
          <div class="stat-row">
            <span class="stat-label">${escapeHTML(label)}</span>
            <span class="stat-value">${fmtPct(cell)}</span>
            <span class="stat-detail">${fmtDetail(cell)}</span>
          </div>
        `).join('')}
      </div>
    </td>
  `;
}

window.__exScroll = function(btn, dir){
  const shell = btn?.closest?.('.exTableShell');
  const wrap = shell?.querySelector?.('.exTableWrap');
  if(!wrap) return;
  let d = 0;
  if(typeof dir === 'string'){
    if(dir === 'left') d = -1;
    else if(dir === 'right') d = 1;
    else d = Number(dir) || 0;
  }else{
    d = Number(dir) || 0;
  }
  const amount = Math.max(260, Math.floor(wrap.clientWidth * 0.9));
  wrap.scrollBy({ left: d * amount, behavior: 'smooth' });
};
window.__toggleExStats = function(btn){
  const shell = btn?.closest?.('.exTableShell');
  if(!shell) return;
  const collapsed = shell.classList.toggle('is-collapsed');
  try{
    localStorage.setItem('exStatsCollapsed', collapsed ? '1' : '0');
  }catch(e){}
  window.__exStatsCollapsed = collapsed;
  btn.textContent = collapsed ? '成績を表示' : '成績を隠す';
};

if(!window.__exBound){
  window.__exBound = true;
  document.addEventListener('click', (event) => {
    const scrollBtn = event.target.closest('.exScrollBtn');
    if(scrollBtn){
      const shell = scrollBtn.closest('.exTableShell');
      const wrap = shell?.querySelector('.exTableWrap');
      if(!wrap) return;
      const dirAttr = scrollBtn.dataset.dir;
      let dir = 0;
      if(dirAttr === 'left') dir = -1;
      else if(dirAttr === 'right') dir = 1;
      else dir = Number(dirAttr) || 0;
      const amount = Math.max(260, Math.floor(wrap.clientWidth * 0.9));
      wrap.scrollBy({ left: dir * amount, behavior: 'smooth' });
      return;
    }
    const toggleBtn = event.target.closest('.exToggleBtn');
    if(toggleBtn){
      window.__toggleExStats(toggleBtn);
      // 追加：トグル文言を全ボタンで同期
      try{
        const root = toggleBtn.closest('.raceTabBody[data-tab-body="ex"]') || document;
        const collapsed = window.__exStatsCollapsed;
        root.querySelectorAll('.exToggleBtn').forEach(b=>{
          b.textContent = collapsed ? '成績を表示' : '成績を隠す';
        });
      }catch(e){ /* ignore */ }
    }
  });
}

// --- EX auto-diagnostics and fixes ---
function cleanupExFixes(){
  // revert tables where we forced minWidth
  document.querySelectorAll('table.exTable').forEach(t => {
    if(t.dataset._ex_min_width_applied){
      t.style.minWidth = '';
      delete t.dataset._ex_min_width_applied;
    }
  });
  // restore any parent overflow we changed
  document.querySelectorAll('[data-ex-overflow-fixed="1"]').forEach(el => {
    try{
      const prev = el.dataset.exPrevOverflow;
      if(prev !== undefined){ el.style.overflowX = prev; }
      el.removeAttribute('data-ex-overflow-fixed');
      el.removeAttribute('data-ex-prev-overflow');
    }catch(e){ /* ignore */ }
  });
}

function ensureExState(containerEl, tab){
  // always cleanup first
  cleanupExFixes();
  if(tab !== 'ex') return;

  const root = containerEl.querySelector('.raceTabBody[data-tab-body="ex"]');
  if(!root){ console.log('[EX ensure]', { hasRoot: false }); return; }

  // make sure controls wired (idempotent)
  try{ wireExScrollControls(root); }catch(e){ /* ignore */ }

  const shell = root.querySelector('.exTableShell');
  const wrap  = root.querySelector('.exTableWrap');
  const inner = root.querySelector('.exTableInner');
  const table = root.querySelector('.exTable');
  const bar   = root.querySelector('.exScrollBar');

  // purge persisted collapsed flag and ensure expanded state
  try{ localStorage.removeItem('exStatsCollapsed'); }catch(e){}
  try{ shell?.classList?.remove('is-collapsed'); }catch(e){}

  // If wrap/table exist, enforce overflow and min-width to guarantee horizontal overflow
  if(wrap && table){
    const before = { client: wrap.clientWidth, scroll: wrap.scrollWidth };

    // force visible scrollbar (some environments hide auto scrollbars)
    try{ wrap.style.overflowX = 'scroll'; wrap.style.overflowY = 'hidden'; }catch(e){}

    // ensure inner/table have a wide min-width inline (override any interfering CSS)
    try{
      if(inner){
        inner.style.display = 'inline-block';
        inner.style.minWidth = '7200px';
        inner.style.width = 'max(7200px, 100%)';
      }
      table.style.minWidth = '7200px';
      table.style.width = 'max(7200px, 100%)';
    }catch(e){}

    // ensure toolbar is visible
    try{ if(bar) bar.style.display = 'flex'; }catch(e){}

    // log before/after for diagnostics
    requestAnimationFrame(() => {
      const after = { client: wrap.clientWidth, scroll: wrap.scrollWidth };
      try{ console.log('[EX ensure]', { before, after, overflowX: getComputedStyle(wrap).overflowX }); }catch(e){}
    });
  }
}

function wireRecentScrollControls(containerEl){
  const root = containerEl.querySelector('.raceTabBody[data-tab-body="recent"]');
  if(!root) return;
  const wrap = root.querySelector('.recentTableWrap');
  const btns = root.querySelectorAll('.recentScrollBtn');
  if(!wrap || !btns.length) return;

  if(root.dataset.recentWired === "1") return;
  root.dataset.recentWired = "1";

  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.recentScrollBtn');
    if(!btn) return;
    const dir = Number(btn.dataset.dir || 0);
    const step = Math.max(320, Math.floor(wrap.clientWidth * 0.85));
    wrap.scrollBy({ left: dir * step, behavior: 'smooth' });
  });
}

function wirePastScrollControls(containerEl) {
  const wrap = containerEl.querySelector('.raceTabBody[data-tab-body="past"] .pastTableWrap');
  if (!wrap) return;

  const btns = containerEl.querySelectorAll('.raceTabBody[data-tab-body="past"] .pastScrollBtn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.dataset.dir || '0');
      wrap.scrollLeft += dir * 360;
    });
  });
}

function wireTableScrollControls(containerEl, bodyKey){
  const root = containerEl.querySelector(`.raceTabBody[data-tab-body="${bodyKey}"]`);
  if(!root) return;

  const wrap = root.querySelector('.recentTableWrap');
  const btns = root.querySelectorAll('.recentScrollBtn');
  if(!wrap || !btns.length) return;

  const flag = `wired_${bodyKey}`;
  if(root.dataset[flag] === "1") return;
  root.dataset[flag] = "1";

  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.recentScrollBtn');
    if(!btn) return;
    const dir = Number(btn.dataset.dir || 0);
    const step = Math.max(320, Math.floor(wrap.clientWidth * 0.85));
    wrap.scrollBy({ left: dir * step, behavior: 'smooth' });
  });
}

// Minimal safe getTrackResults shim used by renderPastHtml
function getTrackResults(race) {
  const entries = (race && race.entries) ? race.entries : [];
  const ex = race ? race.ex : null;

  const block = getExBlock(ex, 'trackResults') || getExBlock(ex, 'venueResults');
  const raw = (block && String(block).trim()) ? String(block) : String(getExRawText(ex) || '');
  if (!raw) return [];

  return parseTrackResultsFromRawText(raw, entries, race ? race.venue : '');
}

function renderPastHtml(race) {
  const entries = (race && race.entries) ? race.entries : [];
  if (!entries.length) return `<div class="empty">出走データがありません</div>`;

  const trackResults = getTrackResults(race);
  if (!trackResults.length) {
    return `<div class="empty">当場成績データがありません（このJSONに当場成績が未収録）</div>`;
  }

  const byCar = {};
  for (const tr of trackResults) byCar[String(tr.car)] = tr;

  const colCount = 10;
  const header = `
    <tr>
      <th class="sticky-col">選手</th>
      ${Array.from({ length: colCount }, (_, i) => `<th>当場${i + 1}</th>`).join('')}
    </tr>
  `;

  const rows = entries.map(e => {
    const car = String(e.car || '');
    const tr = byCar[car] || { items: [] };
    const items = tr.items || [];

    const cells = [];
    for (let i = 0; i < colCount; i++) {
      const it = items[i];
      const top = it ? renderPillsFromChips(it.chips) : '-';
      const bottom = it ? escapeHTML(((it.date || '') + ' ' + (it.meet || '')).trim()) : '';
      cells.push(`<td><div class="rrTop">${top}</div><div class="rrBottom">${bottom}</div></td>`);
    }

    return `
      <tr>
        <td class="sticky-col">
          <div class="recentRowName">
            <span class="carBadge car-${escapeHTML(car)}">${escapeHTML(car)}</span>
            <div>
              <div class="rname">${escapeHTML(e.name || '')}</div>
              <div class="rsub">${escapeHTML(e.pref || '')} / ${escapeHTML(e.grade || '')} / ${escapeHTML(e.age || '')}歳</div>
            </div>
          </div>
        </td>
        ${cells.join('')}
      </tr>
    `;
  }).join('');

  return `
    <div class="recentTableShell pastTableShell">
      <div class="recentTableHeader">
        <div class="recentHint">当場成績（当場1〜当場${colCount}）</div>
        <div class="recentScrollBtns">
          <button type="button" class="pastScrollBtn recentScrollBtn" data-dir="-1">◀</button>
          <button type="button" class="pastScrollBtn recentScrollBtn" data-dir="1">▶</button>
        </div>
      </div>

      <div class="pastTableWrap recentTableWrap" tabindex="0">
        <table class="recentTable pastTable" aria-label="当場成績">
          <thead>${header}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function parseTrackResultsFromRawText(raw, entries, venue) {
  const venueNorm = normalizeVenueName(venue);
  const venueCodeTrim = (VENUE_SHORT_CODE[venueNorm] || venueNorm[0] || '').trim();
  if (!raw || !entries || !entries.length || !venueCodeTrim) return [];

  const section =
    findBestTrackSection(raw, venueCodeTrim) ||
    findSection(raw, ['当場成績'], ['直近成績', '前検コメント', 'EXデータ', '出走表', '基本情報']);

  if (!section) return [];

  const nameKeys = entries
    .map(e => String(e.name || '').replace(/\s+/g, ''))
    .filter(Boolean);

  // posList: 行の先頭（枠+車+選手名）位置で切る
  const posList = [];
  for (const e of entries) {
    const frame = String(e.frame ?? '').trim();
    const car = String(e.car ?? '').trim();
    const nameKey = String(e.name ?? '').replace(/\s+/g, '');
    if (!frame || !car || !nameKey) continue;

    const re = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(frame)}\\s*\\n\\s*${escapeRegExp(car)}\\s*\\n\\s*${escapeRegExp(nameKey)}(?=\\s|\\n)`,
      'u'
    );
    const m = re.exec(section);
    if (m) {
      posList.push({ p: m.index, car: Number(car), nameKey });
    } else {
      // 最低限のフォールバック（最後の手段）
      const pName = section.indexOf(nameKey);
      if (pName >= 0) posList.push({ p: pName, car: Number(car), nameKey });
    }
  }
  posList.sort((a, b) => a.p - b.p);

  // 各行（枠先頭）→次行先頭で切って解析する
  const itemsByName = {};
  for (let i = 0; i < posList.length; i++) {
    const cur = posList[i];
    const next = posList[i + 1];
    const chunk = section.slice(cur.p, next ? next.p : section.length);

    const items0 = extractDateMeetChips(chunk)
      .filter(it => String(it.meet || '').startsWith(venueCodeTrim));

    itemsByName[cur.nameKey] = groupTrackItems(items0);
  }

  return entries.map(e => {
    const car = String(e.car || '');
    const name = e.name || '';
    const nameKey = String(name).replace(/\s+/g, '');
    const items = itemsByName[nameKey] || [];
    return { car, name, items };
  });
}

function renderTrackResultsWinticketLike(trackResults, race){
  // renderPlacePills: array of {pos, sb}
  function renderPlacePills(res) {
    if (!res || !res.length) return "-";
    return `<div class="rcPills">${
      res.map(r => {
        const sb = (r.sb || "").toUpperCase();
        return `<span class="rcPill"><span class="rcPillNum">${escapeHTML(String(r.pos))}</span>${sb ? `<span class="rcPillSb">${escapeHTML(sb)}</span>` : ""}</span>`;
      }).join("")
    }</div>`;
  }

  const entries = race?.entries || [];
  const cols = 10; // 当場1〜当場10

  // accept either array or { car: { items } } map from parser
  const byCar = {};
  if (Array.isArray(trackResults)) {
    trackResults.forEach(tr => { byCar[String(tr.car||'')] = tr; });
  } else if (trackResults && typeof trackResults === 'object') {
    Object.keys(trackResults).forEach(k => { byCar[String(k)] = trackResults[k]; });
  }

  const headCols = Array.from({length: cols}, (_,i)=>`当場${i+1}`);
  const thead = `
    <tr>
      <th class="rrColName">選手</th>
      ${headCols.map(h=>`<th class="rrCol">${h}</th>`).join('')}
    </tr>
  `;

  const rows = entries.map(ent => {
    const car = String(ent.car||'');
    const tr = byCar[car] || { items: [] };

    // preserve per-item uniqueness by key (date+meet), do NOT group only by meet
    const uniq = [];
    const seen = new Set();
    for (const it of (tr.items || [])){
      const key = it.key || `${it.date||''} ${it.meet||''}`.trim();
      if(seen.has(key)) continue;
      seen.add(key);
      uniq.push(it);
      if(uniq.length >= cols) break;
    }

    const tds = Array.from({length: cols}, (_,i)=>{
      const g = uniq[i];
      if(!g){
        return `<td><div class="rrCell"><div class="rrTop"><span class="rrDash">-</span></div><div class="rrBottom">&nbsp;</div></div></td>`;
      }
      const top = renderPlacePills(g.res || []);
      const bottom = `${escapeHTML(g.date||'')}${g.meet ? ' ' + escapeHTML(g.meet) : ''}`;
      return `<td><div class="rrCell"><div class="rrTop">${top}</div><div class="rrBottom">${bottom || '&nbsp;'}</div></div></td>`;
    }).join('');

    return `
      <tr>
        <td class="rrNameCell">
          <div class="rrNameWrap">
            <span class="carBadge car-${car}">${escapeHTML(car)}</span>
            <div class="rrNameMain">
              <div class="rrName">${escapeHTML(ent.name||'')}</div>
              <div class="rrSub">${escapeHTML(ent.pref||'')} / ${escapeHTML(ent.class||'')} / ${escapeHTML(ent.age||'')}</div>
            </div>
          </div>
        </td>
        ${tds}
      </tr>
    `;
  }).join('');

  return `
    <div class="recentTableShell">
      <div class="recentTableHeader">
        <div class="recentTableTitle">当場成績（当場1〜当場${cols}）</div>
        <div class="recentTableCtrl">
          <button class="recentScrollBtn" data-dir="-1" type="button">◀</button>
          <button class="recentScrollBtn" data-dir="1" type="button">▶</button>
        </div>
      </div>
      <div class="recentTableWrap">
        <table class="recentTable trackTable">
          <thead>${thead}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function escapeRegExp(s){
  return String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqSB(sb){
  if(!sb) return '';
  const hasS = sb.includes('S');
  const hasB = sb.includes('B');
  return (hasS ? 'S' : '') + (hasB ? 'B' : '');
}

function chipsFromValue(v){
  if(v == null) return [];
  const s = String(v).trim();
  if(!s || s === '-') return [];
  const parts = s.split(/[\s\/]+/).filter(Boolean);
  const chips = [];
  for(const p0 of parts){
    const p = p0.trim();
    if(!p) continue;
    if(p === 'S' || p === 'B'){
      if(chips.length){
        chips[chips.length-1].sb = uniqSB((chips[chips.length-1].sb || '') + p);
      }
      continue;
    }
    const m = p.match(/^(\d{1,2}|-)([BS]{1,2})?$/);
    if(m){
      chips.push({ pos: m[1], sb: uniqSB(m[2] || '') });
      continue;
    }
    const m2 = p.replace(/\s+/g,'').match(/^(\d{1,2}|-)([BS]{1,2})?$/);
    if(m2){
      chips.push({ pos: m2[1], sb: uniqSB(m2[2] || '') });
      continue;
    }
  }
  return chips;
}

function renderPillsFromChips(chips){
  if(!chips || !chips.length) return `<span class="rrDash">-</span>`;
  return `<div class="rrPills">` + chips.map(c => {
    const pos = escapeHTML(c.pos ?? c.r ?? '-'); // accept r for backward-compat
    const sb  = escapeHTML(c.sb ?? '');
    return `<span class="rrPill"><span class="rrPillPos">${pos}</span>${sb ? `<span class="rrPillSb">${sb}</span>` : ''}</span>`;
  }).join('') + `</div>`;
}

function renderPillsFromValue(v){
  return renderPillsFromChips(chipsFromValue(v));
}

function groupByMeet(items){
  const groups = [];
  let cur = null;
  function mdKey(dateStr){
    const m = String(dateStr||'').match(/^(\d{1,2})\/(\d{1,2})$/);
    if(!m) return 9999;
    return (Number(m[1]) * 100) + Number(m[2]);
  }
  for(const it of (items || [])){
    const meet = String(it.meet || '').trim();
    const date = String(it.date || '').trim();
    if(!meet || !date) continue;
    if(!cur || cur.meet !== meet){
      cur = { meet, dateMin: date, chips: [] };
      groups.push(cur);
    }
    // ✅ it.chips が既にある（=会場/直近の新形式）ならそれを優先して積む
    if (Array.isArray(it.chips) && it.chips.length) {
      for (const c0 of it.chips) {
        const pos = (c0.pos ?? c0.r ?? '-');
        const sb  = uniqSB(c0.sb || '');
        cur.chips.push({ pos: String(pos), sb });
        if (cur.chips.length >= 14) break;
      }
      continue;
    }else{
      if(mdKey(date) < mdKey(cur.dateMin)) cur.dateMin = date;
    }
    let raw = '';
    if(it.pos != null) raw = String(it.pos) + (it.sb ? String(it.sb) : '');
    else if(it.r != null) raw = String(it.r).replace(/\s+/g,'');
    else raw = '';
    const parsed = chipsFromValue(raw);
    if(parsed.length){
      for(const c of parsed) cur.chips.push(c);
    }
  }
  for(const g of groups){ g.date = g.dateMin; delete g.dateMin; }
  return groups;
}

// parse recent results from rawText heuristically
function parseRecentFromRawText(race){
  const entries = race?.entries || [];
  // if merged recentMap already provided (e.g., from ZIP), use it
  if(race && race._recentMap && typeof race._recentMap === 'object'){
    return race._recentMap;
  }
  if(!entries.length) return {};

  const blockRaw = (typeof getExBlock === 'function') ? getExBlock(race?.ex, 'recentResults') : '';
  const rawRaw   = (typeof getExRawText === 'function') ? getExRawText(race?.ex) : '';

  const block = normalizeText(blockRaw || '');
  const raw   = normalizeText(rawRaw || '');

  // blockが JSON map の場合はそのまま返す（将来ZIP運用の強化用）
  const bt = block.trim();
  if(bt && bt[0] === '{'){
    try{
      const obj = JSON.parse(bt);
      if(obj && typeof obj === 'object') return obj;
    }catch(e){}
  }

  let section = '';
  const blockLooksRecent =
    block.includes('今場所') || block.includes('直近1') || block.includes('直近２') || block.includes('直近3') || block.includes('直近４');

  if(block.trim() && blockLooksRecent){
    section = block;
  }else{
    section = normalizeText(
      findSection(raw, ['直近成績'], ['当場成績','前検コメント','EXデータ','出走表','基本情報']) || ''
    );
  }

  if(!section.trim()) return {};

  const dateLineRe = /^(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{1,2}[\/\-.]\d{1,2}|\d{1,2}月\d{1,2}日)$/;
  const meetLineRe = /^[\p{Script=Han}A-Za-z0-9]{1,10}(?:F\d|G\d|GP)$/u;
  const resLineRe  = /^(?:-|\d{1,2}|欠|失|落|棄|故)$/;

  const recentMap = {};

  for(const e of entries){
    const car  = String(e.car || e.carNo || e.no || '').trim();
    const name = normalizeText(String(e.name || '')).replace(/\s+/g,'');
    if(!car || !name) continue;

    // 行の開始アンカー：車行がある場合と無い場合の2種に対応
    const anchorRe1 = new RegExp(`\\n\\s*[1-9]\\s*\\n\\s*${escapeRegExp(car)}\\s*\\n\\s*${escapeRegExp(name)}\\s*\\n`, 'u');
    const anchorRe2 = new RegExp(`\\n\\s*[1-9]\\s*\\n\\s*${escapeRegExp(name)}\\s*\\n`, 'u');
    const am = anchorRe1.exec(section) || anchorRe2.exec(section);
    if(!am) continue;

    // 次の選手ブロック開始までを行として切る（車行がある/ない両方に対応）
    const rowStartRe = /\\n[1-9]\\n(?:[1-9]\\n)?[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]/gu;
    const rowStarts = [];
    let rm;
    while((rm = rowStartRe.exec(section)) !== null){
      rowStarts.push(rm.index);
    }

    let end = section.length;
    for(const s of rowStarts){
      if(s > am.index){ end = s; break; }
    }

    const row = section.slice(am.index, end);
    const lines = row.split('\n').map(l => l.trim());

    // 1) 今場所：プロフィール行(〜○期)の“次”に出てくる単独数字を拾う（最初の date より前）
    let profIdx = -1;
    for(let i=0;i<lines.length;i++){
      if(/\d{2,3}期/.test(lines[i])){ profIdx = i; break; }
    }
    let firstDateIdx = -1;
    for(let i=0;i<lines.length;i++){
      if(dateLineRe.test(lines[i])){ firstDateIdx = i; break; }
    }

    let imaRes = '';
    if(profIdx >= 0){
      const limit = (firstDateIdx >= 0) ? firstDateIdx : lines.length;
      for(let i=profIdx+1;i<limit;i++){
        if(resLineRe.test(lines[i])){ imaRes = lines[i]; break; }
      }
    }

    // 2) 直近1〜：日付行→(次の非空行=meet)→(その後の複数のresultトークン) を全部拾う
    const last10 = [];
    for(let i=0;i<lines.length && last10.length<10;i++){
      if(!dateLineRe.test(lines[i])) continue;

      const date = lines[i];

      let j = i + 1;
      while(j < lines.length && !lines[j]) j++;

      let meet = '';
      if(j < lines.length && meetLineRe.test(lines[j])){
        meet = lines[j];
        j++;
      }

      // collect multiple numeric result tokens and attach any following S/B to each
      const chips = [];
      for(let k = j; k < lines.length && chips.length < 8; k++){
        const t = lines[k];
        if(!t){ continue; }
        // if this token looks like a result (数字 or 欠等)
        if(resLineRe.test(t)){
          let sb = '';
          let m = k + 1;
          // gather following S/B tokens and attach to this result
          while(m < lines.length && (lines[m] === 'S' || lines[m] === 'B')){
            if(!sb.includes(lines[m])) sb += lines[m];
            m++;
          }
          chips.push({ pos: t, sb });
          k = m - 1; // advance outer index
          continue;
        }
        break;
      }
      if(!chips.length) chips.push({ pos: '-', sb: '' });

      last10.push({ date, meet, chips, result: chips[0].pos, results: chips.map(c=>c.pos) });
    }

    // 今場所は「数字だけ」が正。ZIPにも日付/会場が無いので空でOK（WINTICKET挙動に合わせる）
    recentMap[car] = {
      ima: { result: imaRes || '-', date:'', meet:'' },
      last10
    };
  }

  return recentMap;
}

function renderRecentHtml(race){
  const entries = race?.entries || [];
  const recentMap = parseRecentFromRawText(race);
  if(!entries.length) return `<div class="empty">出走データがありません</div>`;

  const header = `
    <tr>
      <th class="rrSticky sticky-col">選手</th>
      <th class="rrCol rrIma">今場所</th>
      ${Array.from({length:10}, (_,i)=>`<th class="rrCol">直近${i+1}</th>`).join('')}
    </tr>
  `;

  const rows = entries.map(e => {
    const car = String(e.car || '');
    const recent = recentMap[car] || { ima: null, last10: [] };

    const cells = [];
    // 今場所
    const ima = recent.ima;
    cells.push(`
      <td class="rrCell rrIma">
        <div class="rrTop">${ima ? renderPillsFromValue(ima.result) : '<span class="rrDash">-</span>'}</div>
        <div class="rrBottom">${ima ? escapeHTML(((ima.date||'')+' '+(ima.meet||'')).trim()) : ''}</div>
      </td>
    `);
    // 直近10
    for(let i=0;i<10;i++){
      const it = recent.last10 && recent.last10[i];
      const topHtml = it ? (it.chips ? renderPillsFromChips(it.chips) : (it.results ? renderPillsFromChips((it.results||[]).map(r=>({pos:r,sb:''}))) : renderPillsFromValue(it.result))) : '<span class="rrDash">-</span>';
      cells.push(`
        <td class="rrCell">
          <div class="rrTop">${topHtml}</div>
          <div class="rrBottom">${it ? escapeHTML(((it.date||'')+' '+(it.meet||'')).trim()) : ''}</div>
        </td>
      `);
    }

    return `
      <tr>
        <td class="rrSticky sticky-col">
          <div class="rrNameWrap">
            <span class="carBadge car-${escapeHTML(car)}">${escapeHTML(car)}</span>
            <div class="rrNameText">
              <div class="rrName">${escapeHTML(e.name || '')}</div>
              <div class="rrSub">${escapeHTML(e.pref||'')} / ${escapeHTML(e.grade||'')} / ${escapeHTML(e.age||'')}歳</div>
            </div>
          </div>
        </td>
        ${cells.join('')}
      </tr>
    `;
  }).join('');

  return `
    <div class="recentTableShell">
      <div class="recentTableHeader">
        <div class="recentHint">直近成績（今場所 + 直近10）</div>
        <div class="recentScrollBtns">
          <button type="button" class="recentScrollBtn" data-dir="-1">◀</button>
          <button type="button" class="recentScrollBtn" data-dir="1">▶</button>
        </div>
      </div>

      <div class="recentTableWrap" tabindex="0">
        <table class="recentTable" aria-label="直近成績">
          <thead>${header}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderRecentTop(it){
  if(!it) return `<div class="rrTop"><div class="rrChips"><span class="rrChip">-</span></div></div>`;

  const chips = Array.isArray(it.chips)
    ? it.chips
    : (Array.isArray(it.results) ? it.results.map(r => ({ r, sb: '' })) : [{ r: it.result || '-', sb: '' }]);

  const html = chips.slice(0,4).map(c => `
    <span class="rrChip">
      ${c.sb ? `<span class="rrSB">${escapeHTML(c.sb)}</span>` : ''}
      ${escapeHTML(c.r)}
    </span>
  `).join('');

  return `<div class="rrTop"><div class="rrChips">${html}</div></div>`;
}


// render a user-friendly race detail card (scoped to todayRaceDetail)
function renderRaceDetail(race){
  const el = document.getElementById('todayRaceDetail');
  if(!el) return;
  try{
    if(typeof parseRecentFromRawText === 'function'){
      const r = parseRecentFromRawText(window.RACE_DEBUG || race);
      console.log('[RECENT CHECK newyama]', { ima: r?.['1']?.ima, recent1: r?.['1']?.last10?.[0], len: r?.['1']?.last10?.length });
    }
  }catch(e){ /* ignore */ }
  const escape = escapeHTML;

  const lines = (race?.lineup?.inferredLines || [])
    .map(arr => arr.join('-'))
    .join(' / ');

  const entriesHtml = (race?.entries || []).map(e => {
    const car = Number(e.car || 0);
    return `
      <div class="rtRow">
        <div class="rtLeft">
          <span class="carBadge car-${car}">${escape(e.car)}</span>
          <div class="rtNameBlock">
            <div class="rtName">${escape(e.name)}</div>
            <div class="rtSub">${escape(e.pref || '')} / ${escape(e.grade || '')} / ${escape(e.age || '')}歳 / ${escape(e.term || '')}期 / 得点 ${escape(e.score || '')}</div>
          </div>
        </div>

        <div class="rtMid">
          <span class="chip">S ${escape(e.S ?? '')}</span>
          <span class="chip">B ${escape(e.B ?? '')}</span>
          <span class="chip">脚 ${escape(e.style || '')}</span>
        </div>

        <div class="rtRight">
          <div class="odds">
            <span class="chip">勝 ${escape(e.rates && e.rates.win !== undefined && e.rates.win !== null ? e.rates.win : '')}</span>
            <span class="chip">2連 ${escape(e.rates && e.rates.quinella !== undefined && e.rates.quinella !== null ? e.rates.quinella : '')}</span>
            <span class="chip">3連 ${escape(e.rates && e.rates.trio !== undefined && e.rates.trio !== null ? e.rates.trio : '')}</span>
          </div>
          <div class="rtComment">${escape(e.comment || '')}</div>
        </div>
      </div>
    `;
  }).join('') || `<div class="empty">出走データがありません</div>`;

  el.innerHTML = `
    <section class="raceCard">
      <div class="raceHeader">
        <div class="raceTitle">
          <span class="raceNo">${escape(race.raceNo || '')}R</span>
          <span class="raceName">${escape(race.raceName || '')}</span>
          <span class="raceClass">${escape(race.class || '')}</span>
        </div>
        <div class="raceMeta">
          <span>${escape(race.venue || '')} ${escape(race.dayLabel || '')} / ${escape(race.date || '')}</span>
          <span>発走 ${escape(race.startTime || '')} / 締切 ${escape(race.closeTime || '')}</span>
          <span>${escape(String(race.distanceM || ''))}m (${escape(String(race.laps || ''))}周)</span>
        </div>
        ${lines ? `<div class="raceLine">推定ライン：${escape(lines)}</div>` : ''}
      </div>

      <div class="raceTabs">
        <button class="tabBtn is-active" data-tab="shussou">出走表</button>
        <button class="tabBtn" data-tab="zenken">前検コメント</button>
        <button class="tabBtn" data-tab="ex">EXデータ</button>
        <button class="tabBtn" data-tab="recent">直近成績</button>
        <button class="tabBtn" data-tab="past">当場成績</button>
      </div>

      <div class="raceTabBody" data-tab-body="shussou">
        <div class="rtTable">
          ${entriesHtml}
        </div>
      </div>

      <div class="raceTabBody is-hidden" data-tab-body="zenken">
        ${renderZenkenHtml(race)}
      </div>

      <div class="raceTabBody is-hidden" data-tab-body="ex">
        ${renderExHtml(race)}
      </div>

      <div class="raceTabBody is-hidden" data-tab-body="recent">
        ${renderRecentHtml(race)}
      </div>

      <div class="raceTabBody is-hidden" data-tab-body="past">
        ${renderPastHtml(race)}
      </div>

      <!-- debug JSON removed from UI to avoid exposing raw data in tabs -->
    </section>
  `;

  // attach tab handlers scoped to this container
  el.querySelectorAll('.tabBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const tab = btn.dataset.tab;
      el.querySelectorAll('.raceTabBody').forEach(body => body.classList.add('is-hidden'));
      el.querySelector(`.raceTabBody[data-tab-body="${tab}"]`)?.classList.remove('is-hidden');
      // ensure EX-specific diagnostics/fixes when showing/hiding tabs
      try{ ensureExState(el, tab); }catch(e){ console.warn('ensureExState failed', e); }
      try{
        if(tab === 'recent' || tab === 'track') wireTableScrollControls(el, tab);
        if(tab === 'past') wirePastScrollControls(el);
      }catch(e){ console.warn('wireTableScrollControls failed', e); }
    });
  });
  // run once for initial active tab
  try{
    const active = el.querySelector('.tabBtn.is-active');
    if(active){
      ensureExState(el, active.dataset.tab);
      if(active.dataset.tab === 'recent' || active.dataset.tab === 'track') wireTableScrollControls(el, active.dataset.tab);
      if(active.dataset.tab === 'past') wirePastScrollControls(el);
    }
  }catch(e){ /* ignore */ }
}

function _extractHourMinute(s){
  const m = String(s || '').match(/(\d{2}):(\d{2})/);
  if(!m) return null;
  return { hh: parseInt(m[1],10), mm: parseInt(m[2],10) };
}

function pickWeatherAtStart(weather, startTime){
  if(!weather || !weather.hourly || !startTime) return null;
  // support both { time:[], temperature_2m:[] } and [{time,temperature_2m}] shapes
  const hr = weather.hourly;
  const target = _extractHourMinute(startTime);
  if(!target) return null;
  const targetH = target.hh;

  const items = [];
  if(Array.isArray(hr.time)){
    for(let i=0;i<hr.time.length;i++){
      items.push({ time: hr.time[i], temp: hr.temperature_2m?.[i], code: hr.weathercode?.[i], wind: hr.windspeed_10m?.[i], gust: hr.windgusts_10m?.[i], prcp: hr.precipitation?.[i] });
    }
  } else if(Array.isArray(hr)){
    for(const h of hr) items.push(h);
  }
  if(!items.length) return null;

  let best = null; let bestDiff = Infinity;
  for(const it of items){
    const t = _extractHourMinute(it?.time);
    if(!t) continue;
    const diff = Math.abs(t.hh - targetH);
    if(diff < bestDiff){ bestDiff = diff; best = it; }
  }
  return best;
}

function buildPrompt({ date, venue, venueMemo, race, weather }) {
  const parts = [
    "あなたは競輪予想のプロアナリストです。",
    "",
    `【日付】${date}`,
    `【会場】${venue}`,
  ];

  if(weather){
    const wlines = [];
    wlines.push("");
    wlines.push('【天気（会場付近）】');
    // daily summary fields if present
    if(weather.label) wlines.push(`天候: ${weather.label}`);
    if(typeof weather.tempMax !== 'undefined' && weather.tempMax !== null) wlines.push(`最高気温: ${weather.tempMax}°C`);
    if(typeof weather.tempMin !== 'undefined' && weather.tempMin !== null) wlines.push(`最低気温: ${weather.tempMin}°C`);
    if(typeof weather.precip !== 'undefined' && weather.precip !== null) wlines.push(`降水量(合計): ${weather.precip} mm`);
    if(typeof weather.windMax !== 'undefined' && weather.windMax !== null) wlines.push(`最大風速: ${weather.windMax} m/s`);
    parts.push(...wlines);
    // hourly: include only nearest to race start (軽量化)
    if(weather && weather.hourly){
      try{
        const w = (typeof pickWeatherAtStart === 'function') ? pickWeatherAtStart(weather, race?.startTime) : null;
        if(w){
          parts.push("");
          parts.push(`【天気（発走 ${race?.startTime || ''} 付近）】`);
          parts.push(`${w.time || ''} ${w.temp != null ? w.temp : '—'}℃ code:${w.code ?? ''} wind:${w.wind ?? ''}m/s gust:${w.gust ?? ''} pcp:${w.prcp ?? ''}mm`);
        }
      }catch(e){ /* ignore */ }
    }
  }

  // attach rider master info if enabled
  try{
    const attach = (localStorage.getItem('kq_predict_attach_rider_v1') === '1');
    if(attach && race && Array.isArray(race.entries) && race.entries.length){
      const master = loadRiderMaster();
      const matched = [];
      const unmatched = [];
      for(const en of race.entries){
        const key = makeRiderKeyFrom(en);
        if(key && master[key]){
          matched.push({ entry: en, master: master[key] });
        } else {
          // try id-based fallback
          const idKey = en.id ? `id:${en.id}` : null;
          if(idKey && master[idKey]) matched.push({ entry: en, master: master[idKey] });
          else unmatched.push(en.name || en.player || (en?.person?.name) || '不明');
        }
      }
      if(matched.length){
        parts.push('');
        parts.push('## 選手カルテ');
        matched.forEach(m => {
          const r = m.master || {};
          const en = m.entry || {};
          const lines = [];
          lines.push(`- 名前: ${r.name || en.name || '不明'}`);
          if(r.age) lines.push(`  - 年齢: ${r.age}`);
          const loc = r.pref || r.branch || en.area || '';
          if(loc) lines.push(`  - 出身/地区: ${loc}`);
          if(r.period) lines.push(`  - 在所/期: ${r.period}`);
          if(r.grade) lines.push(`  - 級班: ${r.grade}`);
          if(r.score) lines.push(`  - 得点: ${r.score}`);
          if(r.style) lines.push(`  - 脚質: ${r.style}`);
          if(r.comment) lines.push(`  - コメント: ${r.comment}`);
          if(Array.isArray(r.lastResults) && r.lastResults.length){
            const short = r.lastResults.slice(0,3).join(', ');
            lines.push(`  - 直近成績: ${short}`);
          }
          parts.push(lines.join('\n'));
        });
      }
      if(unmatched.length){
        parts.push('');
        parts.push(`未登録選手: ${unmatched.length}名 — ${unmatched.join(', ')}`);
      }
    }
  }catch(e){ console.warn('rider attach failed', e); }

  parts.push("");
  parts.push("【出力ルール】");
  parts.push("1) 展開予測（ライン/先行/捲り/差し想定）");
  parts.push("2) 本線（3連単）: 8点以内");
  parts.push("3) 押さえ（3連複 or 2車単）: 4点以内");
  parts.push("4) 穴（高配当狙い）: 4点以内");
  parts.push("5) リスク要因（風/バンク/脚質偏り）");
  parts.push("");
  parts.push("日本語で、箇条書き中心で簡潔に。");

  return parts.join("\n");
}

function renderPlayers() {
  const app = document.getElementById("app");
  if(app) app.classList.remove("page-today");
  const players = loadJSON(KEY.players, [
    { name: "例) 河合佑弥", area: "東京", class: "S2", style: "逃", note: "自力" }
  ]);

  $view.innerHTML = `
    <div class="card playersCard has-overlay" style="--overlay-alpha:0.58">
      <div class="row playersHead">
        <img class="playersLogo" src="${asset('sennsyuitirannrogo.png')}" alt="選手一覧">
        <button id="playersBackBtn" class="playersBackBtn btn--img" type="button" aria-label="戻る"><img src="${asset('戻るボタン.png')}" alt="戻る"></button>
      </div>
      <p>選手データをJSON/TSV/CSV/Markdownで取り込み、検索・参照できます。</p>

      <div class="row" style="margin-top:10px;align-items:center;">
        <input class="input" id="q" placeholder="検索（名前/地区/級班/脚質/タグ/本文）" />
        <button class="ghost" id="export">JSON書き出し</button>
        <button class="ghost" id="import">JSON取り込み</button>
        <button class="ghost" id="importFileBtn" type="button">ファイル取り込み</button>
        <input id="importFile" type="file" accept=".txt,.tsv,.csv,.json,.md" multiple hidden />
        <span id="importStatus" class="muted" style="margin-left:8px"></span>
      </div>

      <div id="playerDetail" class="playerDetail" hidden></div>

      <div class="list" id="playerList"></div>
    </div>
  `;

  const playersBackBtn = document.getElementById("playersBackBtn");
  if (playersBackBtn) playersBackBtn.onclick = () => (location.hash = "#/");
  const $list = document.getElementById("playerList");
  const importFile = document.getElementById('importFile');
  const importFileBtn = document.getElementById('importFileBtn');
  const importStatus = document.getElementById('importStatus');
  const playerDetail = document.getElementById('playerDetail');

  function draw(filter="") {
    const data = loadJSON(KEY.players, []);
    const f = filter.trim().toLowerCase();
    const filtered = !f ? data : data.filter(p =>
      [p.name,p.area,p.class,p.style,p.note,p.tagsText,p.cardMd,p.snum,p.kana,p.region,p.period].join(" ").toLowerCase().includes(f)
    );
    $list.innerHTML = filtered.map(p => `
      <div class="item item--click" data-key="${escapeHTML(normalizeRiderName(p.name||''))}">
        <p class="item__title">${escapeHTML(p.name || "")}</p>
        <p class="item__sub">${escapeHTML(p.area||"")}/${escapeHTML(p.class||"")} / ${escapeHTML(p.style||"")}</p>
        <p style="margin:8px 0 0;white-space:pre-wrap;">${escapeHTML(p.note||"")}</p>
      </div>
    `).join("") || `<div class="item"><p class="item__sub">該当なし</p></div>`;
  }
  // event delegation: open detail by data-key
  const $detail = playerDetail;
  function openDetailByKey(key){
    const data = loadJSON(KEY.players, []);
    const p = data.find(x => normalizeRiderName(x.name||'') === String(key || ''));
    if(!$detail) return;
    if(!p){
      $detail.hidden = false;
      $detail.innerHTML = `<div class="item"><p class="item__sub">選手が見つかりません</p></div>`;
      return;
    }
    const pretty = JSON.stringify(p, null, 2);
    $detail.hidden = false;
    $detail.innerHTML = `
      <div class="playerDetail__head">
        <div>
          <div class="playerDetail__name">${escapeHTML(p.name||'')}</div>
          <div class="playerDetail__meta">${escapeHTML(p.area||'')}/${escapeHTML(p.class||'')} / ${escapeHTML(p.style||'')}</div>
        </div>
        <div>
          <button class="ghost" id="copyJsonBtn">JSONコピー</button>
          <button class="ghost" id="closeDetailBtn">閉じる</button>
        </div>
      </div>
      ${p.note ? `<div class="playerDetail__note">${escapeHTML(p.note)}</div>` : ''}
      ${p.cardMd ? `<details class="playerDetail__md"><summary>カルテ原文（md）を表示</summary><pre>${escapeHTML(String(p.cardMd).slice(0,30000))}</pre></details>` : ''}
      <details class="playerDetail__json"><summary>JSON（全情報）を表示</summary><pre>${escapeHTML(pretty)}</pre></details>
    `;
    const copyBtn = document.getElementById('copyJsonBtn');
    if(copyBtn) copyBtn.onclick = ()=>{ try{ navigator.clipboard.writeText(JSON.stringify(p,null,2)); alert('コピーOK'); }catch(e){ alert('コピー失敗'); } };
    const closeBtn = document.getElementById('closeDetailBtn');
    if(closeBtn) closeBtn.onclick = ()=>{ $detail.hidden = true; $detail.innerHTML = ''; };
  }

  $list.addEventListener('click', (e)=>{
    const card = e.target.closest('.item--click');
    if(!card) return;
    const key = card.dataset.key || card.dataset.name || '';
    if(!key) return;
    openDetailByKey(key);
  });

  draw();

  document.getElementById("q").addEventListener("input", (e)=> draw(e.target.value));

  document.getElementById("export").onclick = () => {
    const data = loadJSON(KEY.players, []);
    downloadText("players.json", JSON.stringify(data, null, 2));
  };

  document.getElementById("import").onclick = () => {
    const text = prompt("players配列JSONを貼り付けてください");
    if (!text) return;
    try{
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("配列ではありません");
      saveJSON(KEY.players, parsed);
      draw(document.getElementById("q").value);
      alert("取り込みOK");
    }catch(err){
      alert("JSONが不正です: " + err.message);
    }
  };

  // File import handlers
  function readFileAsText(file){
    return new Promise((res, rej)=>{
      const r = new FileReader();
      r.onload = ()=> res(String(r.result || ''));
      r.onerror = ()=> rej(new Error('read failed'));
      r.readAsText(file, 'utf-8');
    });
  }

  function parseCarteMarkdown(md){
    const lines = String(md||"").replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    let idx = lines.findIndex(l => /\|\s*キー\s*\|\s*入力値\s*\|/.test(l));
    if(idx < 0) return null;
    const kv = {};
    for(let i=idx+1;i<lines.length;i++){
      const l = lines[i].trim();
      if(!l.startsWith('|')) break;
      if(/\|\s*---/.test(l)) continue;
      const cells = l.split('|').map(s=>s.trim()).filter(Boolean);
      if(cells.length >= 2) kv[cells[0]] = cells[1];
    }
    const p = {};
    const map = {
      '選手名':'name','カナ':'kana','登録番号（snum）':'snum','府県':'area','地域ブロック':'region','年齢':'age','期別':'period','現級班':'class','脚質（表記）':'style','競走得点（参照日）':'score','ギヤ倍率（参照日）':'gear','最終更新（参照日）':'updatedAt'
    };
    Object.entries(map).forEach(([k,field])=>{ if(kv[k]) p[field] = kv[k].trim(); });
    const t = String(md).match(/##\s*25）タグ\s*\n([^\n]+)/);
    if(t) p.tagsText = t[1].trim();
    p.cardType = 'kq-carte-md-v1.1';
    p.cardMd = String(md).slice(0, 30000);
    if(!p.name) return null;
    return p;
  }

  function parseDelimitedText(txt){
    const s = String(txt||'').trim();
    if(!s) return [];
    const lines = s.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(!lines.length) return [];
    const delim = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') ? ',' : '\\s+');
    const out = [];
    for(const l of lines){
      const cells = l.split(new RegExp(delim)).map(c=>c.trim()).filter(Boolean);
      if(!cells.length) continue;
      const obj = { name: cells[0] || '' };
      if(cells[1]) obj.area = cells[1];
      if(cells[2]) obj.class = cells[2];
      if(cells[3]) obj.style = cells[3];
      if(cells[4]) obj.note = cells.slice(4).join(' ');
      out.push(obj);
    }
    return out;
  }

  async function handleFiles(files){
    if(!files || !files.length) return;
    importStatus.textContent = '読み込み中…';
    let parsed = [];
    try{
      for(const f of Array.from(files)){
        const name = (f.name || '').toLowerCase();
        const txt = await readFileAsText(f);
        if(name.endsWith('.json')){
          try{
            const j = JSON.parse(txt);
            if(Array.isArray(j)) parsed = parsed.concat(j);
            else if(j && Array.isArray(j.players)) parsed = parsed.concat(j.players);
          }catch(e){}
        } else if(name.endsWith('.md')){
          const p = parseCarteMarkdown(txt);
          if(p) parsed.push(p);
        } else {
          const rows = parseDelimitedText(txt);
          parsed = parsed.concat(rows);
        }
      }
    }catch(e){ console.error(e); importStatus.textContent = '読み込み失敗'; return; }

    try{
      const exist = loadJSON(KEY.players, []);
      const map = {};
      for(const p of exist){ const k = normalizeRiderName(p.name||''); if(k) map[k] = p; }
      for(const q of parsed){ if(!q || !q.name) continue; const k = normalizeRiderName(q.name||''); if(!k) continue; map[k] = Object.assign({}, map[k] || {}, q); }
      const merged = Object.keys(map).map(k=> map[k]);
      saveJSON(KEY.players, merged);
      importStatus.textContent = `取り込みOK (${parsed.length}件)`;
      draw(document.getElementById('q').value);
    }catch(e){ console.error(e); importStatus.textContent = '保存に失敗'; }
    setTimeout(()=> importStatus.textContent = '', 3000);
  }

  if(importFileBtn && importFile){ importFileBtn.onclick = ()=> importFile.click(); }
  if(importFile){ importFile.addEventListener('change', (ev)=>{ handleFiles(ev.target.files); importFile.value = ''; }); }
}

function renderNotFound() {
  const app = document.getElementById("app");
  if(app) app.classList.remove("page-today");
  $view.innerHTML = `
    <div class="card">
      <h2>ページが見つかりません</h2>
      <p><a href="#/">トップへ戻る</a></p>
    </div>
  `;
}

/* ========= utils ========= */

function todayYMD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

/* ========== Weather helpers (Open-Meteo) ========== */
async function geocodeOpenMeteo(q){
  try{
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=ja`;
    const res = await fetch(url);
    if(!res.ok) return null;
    const j = await res.json();
    if(!j || !j.results || j.results.length === 0) return null;
    return j.results[0];
  }catch(e){ console.warn('geocodeOpenMeteo failed', e); return null; }
}

function weatherCodeToLabel(code){
  // simplified mapping for common codes
  const m = {
    0: '晴天',
    1: '主に晴れ',
    2: '部分的に曇り',
    3: '曇り',
    45: '霧',
    48: '霧（凍結）',
    51: '小雨',
    53: 'やや強い霧雨',
    55: '強い霧雨',
    61: '雨',
    63: 'やや強い雨',
    65: '強い雨',
    80: 'にわか雨',
    81: '強いにわか雨',
    95: '雷雨'
  };
  return m[code] || `code:${code}`;
}

function buildWeatherSummary(w){
  if(!w) return '';
  const parts = [];
  if(w.label) parts.push(w.label);
  if(Number.isFinite(w.tempMax)) parts.push(`最高${Math.round(w.tempMax)}℃`);
  if(Number.isFinite(w.tempMin)) parts.push(`最低${Math.round(w.tempMin)}℃`);
  if(Number.isFinite(w.precip)) parts.push(`降水${Math.round(w.precip*10)/10}mm`);
  if(Number.isFinite(w.windMax)) parts.push(`風${Math.round(w.windMax)}m/s`);
  return parts.join(' / ');
}

function degToCompass(deg){
  if(typeof deg !== 'number') return '';
  const dirs = ['北','北東','東','南東','南','南西','西','北西'];
  const idx = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
  return dirs[idx] || '';
}

async function fetchWeatherLatLon(lat, lon, date){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&timezone=auto&start_date=${date}&end_date=${date}`;
    const res = await fetch(url);
    if(!res.ok) return null;
    const j = await res.json();
    if(!j || !j.daily) return null;
    const d0 = 0;
    return {
      date,
      latitude: lat,
      longitude: lon,
      tempMax: j.daily.temperature_2m_max ? j.daily.temperature_2m_max[d0] : null,
      tempMin: j.daily.temperature_2m_min ? j.daily.temperature_2m_min[d0] : null,
      precip: j.daily.precipitation_sum ? j.daily.precipitation_sum[d0] : null,
      windMax: j.daily.windspeed_10m_max ? j.daily.windspeed_10m_max[d0] : null,
      weatherCode: j.daily.weathercode ? j.daily.weathercode[d0] : null,
    };
  }catch(e){ console.warn('fetchWeatherLatLon failed', e); return null; }
}

async function fetchWeatherLatLonHourly(lat, lon, dateStr){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&hourly=temperature_2m,precipitation,weathercode,windspeed_10m,winddirection_10m,windgusts_10m&timezone=Asia%2FTokyo&start_date=${encodeURIComponent(dateStr)}&end_date=${encodeURIComponent(dateStr)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) return null;
    return await res.json();
  }catch(e){ console.warn('fetchWeatherLatLonHourly failed', e); return null; }
}

function pickNearestHourlyPoint(hourly, dateStr, timeHHMM){
  if(!hourly || !Array.isArray(hourly.time) || !hourly.time.length) return null;
  if(!dateStr || !timeHHMM) return null;
  const target = `${dateStr}T${timeHHMM}`;
  let bestI = -1, bestD = Infinity;
  // exact match first
  for(let i=0;i<hourly.time.length;i++){ if(hourly.time[i] === target){ bestI = i; bestD = 0; break; } }
  if(bestI === -1){
    const t0 = Date.parse(target);
    if(Number.isNaN(t0)) return null;
    for(let i=0;i<hourly.time.length;i++){
      const ti = Date.parse(hourly.time[i]);
      if(Number.isNaN(ti)) continue;
      const d = Math.abs(ti - t0);
      if(d < bestD){ bestD = d; bestI = i; }
    }
  }
  if(bestI < 0) return null;
  return {
    time: hourly.time[bestI],
    temp: hourly.temperature_2m?.[bestI] ?? null,
    prcp: hourly.precipitation?.[bestI] ?? null,
    code: hourly.weathercode?.[bestI] ?? null,
    wind: hourly.windspeed_10m?.[bestI] ?? null,
    wdir: hourly.winddirection_10m?.[bestI] ?? null,
    gust: hourly.windgusts_10m?.[bestI] ?? null,
  };
}

async function getWeatherForVenueAtTime(venueName, dateStr, timeHHMM){
  try{
    const resolver = (typeof kqResolveLatLonForVenue === 'function') ? kqResolveLatLonForVenue : ((typeof kqGetLatLonForVenue === 'function') ? kqGetLatLonForVenue : null);
    const latlon = resolver ? await resolver(venueName) : null;
    if(!latlon || latlon.lat == null || (latlon.lon == null && latlon.lng == null)) return { label: '天気: 取得不可（ピン未登録）' };
    const wx = await fetchWeatherLatLonHourly(latlon.lat, latlon.lon ?? latlon.lng, dateStr);
    if(!wx || !wx.hourly) return { label: '天気: 取得不可（hourly空）', latlon };
    const p = pickNearestHourlyPoint(wx.hourly, dateStr, timeHHMM);
    if(!p) return { label: '天気: 取得不可（候補なし）', latlon, wf: wx };
    const hhmm = (p.time||'').slice(11,16);
    const jp = (typeof kqWeatherCodeToJp === 'function') ? kqWeatherCodeToJp(p.code) : null;
    const label = [`天気(${hhmm})`, (p.temp!=null? `${Number(p.temp).toFixed(1)}℃` : null), (jp? jp : null), (p.wind!=null? `風${Number(p.wind).toFixed(1)}m/s` : null), (p.gust!=null? `G${Number(p.gust).toFixed(1)}m/s` : null), (p.prcp!=null? `降水${Number(p.prcp).toFixed(1)}mm` : null)].filter(Boolean).join(' ');
    return { label, latlon, wf: wx };
  }catch(e){ console.warn(e); return { label: '天気: 取得失敗', error: String(e) }; }
}

function kqPickHourlyIndexAtStart(wdata, startHHMM){
  try{
    const times = wdata?.hourly?.time || [];
    if(!times.length || !startHHMM) return null;
    const [hh, mm] = String(startHHMM).split(':').map(n=>Number(n));
    const targetH = (mm >= 30) ? (hh + 1) % 24 : hh;
    const dateStr = String(times[0]||'').slice(0,10);
    const target = `${dateStr}T${String(targetH).padStart(2,'0')}:00`;
    let idx = times.indexOf(target);
    if(idx >= 0) return idx;
    const t0 = new Date(`${dateStr}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
    let best = 0, bestDiff = Infinity;
    for(let i=0;i<times.length;i++){
      const d = Math.abs(new Date(times[i]).getTime() - t0.getTime());
      if(d < bestDiff){ bestDiff = d; best = i; }
    }
    return best;
  }catch(e){ return null; }
}

function kqFormatHourlyLine(wdata, idx){
  try{
    const h = wdata.hourly;
    const t = String(h.time[idx]||'').slice(11,16);
    const tmp = h.temperature_2m?.[idx];
    const wind = h.wind_speed_10m?.[idx] ?? h.windspeed_10m?.[idx];
    const gust = h.wind_gusts_10m?.[idx] ?? h.windgusts_10m?.[idx];
    const pr = h.precipitation?.[idx];
    const code = h.weathercode?.[idx];
    return `${t} ${tmp != null ? tmp : '—'}℃ 風:${wind != null ? wind : '—'}m/s ガスト:${gust != null ? gust : '—'}m/s 降水:${pr != null ? pr : '—'}mm code:${code != null ? code : ''}`;
  }catch(e){ return null; }
}

function isForecastableDate(dateStr){
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(); t.setHours(0,0,0,0);
  const diffDays = Math.round((d - t) / 86400000);
  return diffDays >= 0 && diffDays <= 15;
}

async function fetchWeatherToday(lat, lon){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&timezone=auto&forecast_days=1`;
    const res = await fetch(url);
    if(!res.ok) return null;
    return await res.json();
  }catch(e){ console.warn('fetchWeatherToday failed', e); return null; }
}

async function getWeatherForVenue(venue, date){
  try{
    const cacheKey = 'kq_weather_cache_v1';
    let cache = {};
    try{ cache = JSON.parse(localStorage.getItem(cacheKey) || '{}'); }catch(e){ cache = {}; }
    const k = `${date}__${venue}`;
    if(cache[k] && cache[k].fetchedAt && (Date.now() - cache[k].fetchedAt) < (1000*60*60*6)){
      return cache[k].data;
    }

    // prefer saved override pins (user-supplied) then window.VENUE_PINS
    let lat = null, lon = null;
    try{
      const v = resolveVenueForWeather(venue);
      const overridePins = ensureWeatherPinsLoaded() || {};
      const pickPin = (pins) => (pins && (pins[v.full] || pins[v.norm] || (v.short && pins[v.short]) || (v.id && pins[v.id]) || pins[venue])) || null;

      let pin = pickPin(overridePins);
      if(!pin && window.VENUE_PINS) pin = pickPin(window.VENUE_PINS);

      if(pin){
        lat = Number(pin.lat ?? pin.latitude);
        lon = Number(pin.lon ?? pin.lng ?? pin.longitude);
      }
    }catch(e){ /* ignore */ }

    if(lat == null || lon == null){
      // try geocoding with "会場名 競輪場" then fallback to venue alone
      const q1 = `${venue} 競輪場`;
      let geo = await geocodeOpenMeteo(q1);
      if(!geo) geo = await geocodeOpenMeteo(venue);
      if(geo){ lat = geo.latitude; lon = geo.longitude; }
    }

    if(lat == null || lon == null) return { ok:false, message:'座標未登録（天気ピン未保存）' };

    let w = null;
    if (!isForecastableDate(date)){
      const j = await fetchWeatherToday(lat, lon);
      if(!j || !j.daily) return { ok:false, message:'天気API取得失敗（today）' };
      const d0 = 0;
      w = {
        date: (j.daily.time && j.daily.time[d0]) || date,
        latitude: lat,
        longitude: lon,
        tempMax: j.daily.temperature_2m_max ? j.daily.temperature_2m_max[d0] : null,
        tempMin: j.daily.temperature_2m_min ? j.daily.temperature_2m_min[d0] : null,
        precip: j.daily.precipitation_sum ? j.daily.precipitation_sum[d0] : null,
        windMax: j.daily.windspeed_10m_max ? j.daily.windspeed_10m_max[d0] : null,
        weatherCode: j.daily.weathercode ? j.daily.weathercode[d0] : null,
        mode: 'today',
        raw: j
      };
      w.label = weatherCodeToLabel(w.weatherCode);
    } else {
      w = await fetchWeatherLatLon(lat, lon, date);
      if(!w) return { ok:false, message:'天気API取得失敗（date）' };
      w.label = weatherCodeToLabel(w.weatherCode);
    }

    const out = { ok:true, summary: buildWeatherSummary(w), ...w };

    // cache only successful results
    cache[k] = { fetchedAt: Date.now(), data: out };
    try{ localStorage.setItem(cacheKey, JSON.stringify(cache)); }catch(e){ /* ignore */ }
    return out;
  }catch(e){ console.warn('getWeatherForVenue failed', e); return null; }
}

// --- EX rawText helpers ---
function decodeBase64Utf8(b64){
  try{
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }catch(e){ console.warn('decodeBase64Utf8 failed', e); return ''; }
}

function getExRawText(ex){
  if(!ex) return '';
  if(typeof ex.rawText === 'boolean') return '';
  if(ex.rawText && String(ex.rawText).trim()) return String(ex.rawText);
  if(ex._rawTextCache) return ex._rawTextCache;
  if(ex.rawTextB64){
    try{
      ex._rawTextCache = decodeBase64Utf8(ex.rawTextB64 || '');
      return ex._rawTextCache;
    }catch(e){ console.warn('getExRawText decode err', e); }
  }
  return '';
}

function getExBlock(ex, key){
  if(!ex || !ex.blocks) return '';
  // key may be nested or direct
  const v = ex.blocks[key];
  if(typeof v === 'boolean') return '';
  if(v && String(v).trim()) return String(v);
  return '';
}

function findBestTrackSection(raw, venueCode){
  if(!raw) return '';
  const key = '当場成績';

  // ここは「当場成績ブロックの終端になり得る見出し」を広めに取る
  const ends = [
    '並び予想','前検コメント','対戦成績','基本情報','EXデータ','直近成績',
    '戦法別成績','位置別成績','レース種別別成績','周長別成績','天候別成績','時間帯別成績',
    '結果','照会'
  ];

  const esc = (s)=> String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scoreRe = venueCode ? new RegExp(esc(venueCode) + '(?:F|G)\\d', 'g') : null;

  const cands = [];
  let idx = 0;

  while((idx = raw.indexOf(key, idx)) !== -1){
    let endPos = raw.length;
    for(const e of ends){
      const p = raw.indexOf(e, idx + key.length);
      if(p !== -1 && p < endPos) endPos = p;
    }

    const chunk = raw.slice(idx, endPos).trim();
    const score = scoreRe ? (chunk.match(scoreRe) || []).length : 0;
    const hasRecent = chunk.includes('今場所') && chunk.includes('直近1');

    // “戦法別成績〜”みたいな巨大セクション混入は避けたいので軽くペナルティ
    const penalty = (chunk.includes('戦法別成績') || chunk.includes('位置別成績') || chunk.includes('レース種別別成績')) ? 1 : 0;

    cands.push({ score, hasRecent, penalty, len: chunk.length, idx, chunk });
    idx += key.length;
  }

  if(!cands.length) return '';

  // 優先度：会場一致スコア高い > 今場所/直近1ある > ペナルティ少 > 短い > 後ろにある
  cands.sort((a,b) =>
    (b.score - a.score) ||
    (Number(b.hasRecent) - Number(a.hasRecent)) ||
    (a.penalty - b.penalty) ||
    (a.len - b.len) ||
    (b.idx - a.idx)
  );

  return cands[0].chunk;
}

// --- date-change purge helpers ---
function getLocalISODate(){
  try{
    const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
    return dtf.format(new Date());
  }catch(e){
    // fallback to simple local YMD
    return todayYMD();
  }
}

function purgeTodayStorage(oldDate){
  const today = getLocalISODate();
  for(let i = localStorage.length - 1; i >= 0; i--){
    const k = localStorage.key(i);
    if(!k) continue;
    if(k === TODAY_LAST_DATE_KEY) continue;
    // explicit prefixes
    if(TODAY_KEY_PREFIXES.some(p => k.startsWith(p))){
      try{ localStorage.removeItem(k); }catch(e){ console.warn('purge remove failed', k, e); }
      continue;
    }
    // keys like race:venue:YYYY-MM-DD:raceNo -> remove only if date part matches oldDate
    if(k.startsWith('race:')){
      const parts = k.split(':');
      if(parts.length >= 4){
        const datePart = parts[2];
        if(datePart && datePart === oldDate){
          try{ localStorage.removeItem(k); }catch(e){ console.warn('purge remove failed', k, e); }
        }
      }
    }
  }
}

function purgeIfDateChanged(){
  // Disabled automatic purge on date change to preserve past imports in storage.
  try{ const today = getLocalISODate(); localStorage.setItem(TODAY_LAST_DATE_KEY, today); }catch(e){}
  return false;
}

function scheduleMidnightPurge(){
  try{
    const now = new Date();
    const next = new Date(now);
    next.setHours(24,0,0,0);
    const ms = next.getTime() - now.getTime();
    setTimeout(()=>{
      try{
        // trigger purge and reload so UI reflects cleared state
        purgeIfDateChanged();
      }catch(e){ console.warn('scheduled purge failed', e); }
      try{ location.reload(); }catch(e){}
    }, ms);
  }catch(e){ console.warn('scheduleMidnightPurge failed', e); }
}

function formatJPDate(d){
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}

function escapeHTML(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// === Result pills (着順 + S/B) utilities ===
function addSb(prev, add) {
  const s = (String(prev || '') + String(add || '')).replace(/[^BS]/g, '');
  const hasS = s.includes('S');
  const hasB = s.includes('B');
  if (hasS && hasB) return 'SB';
  if (hasS) return 'S';
  if (hasB) return 'B';
  return '';
}

function chipsFromValue(value) {
  const toks = String(value || '').trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of toks) {
    // "1", "1B", "1SB", "-", "欠" など
    let m = t.match(/^(\d{1,2}|-|欠|失|落|棄|故|休)([BS]{1,2})?$/);
    if (m) {
      out.push({ pos: m[1], sb: addSb('', m[2] || '') });
      continue;
    }
    // "B" / "SB" が数字の次トークンとして来るケース
    if (/^[BS]{1,2}$/.test(t) && out.length) {
      out[out.length - 1].sb = addSb(out[out.length - 1].sb, t);
      continue;
    }
  }
  return out;
}

function renderPillsFromChips(chips) {
  if (!chips || !chips.length) return '-';
  return `<div class="rrPills">${
    chips.map(c => {
      const pos = escapeHTML(c.pos ?? '');
      const sb  = escapeHTML(c.sb ?? '');
      return `<span class="rrPill"><span class="rrPillPos">${pos}</span>${
        sb ? `<span class="rrPillSb">${sb}</span>` : ''
      }</span>`;
    }).join('')
  }</div>`;
}

function mdToOrdinal(md) {
  const m = String(md || '').match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const mo = Number(m[1]), da = Number(m[2]);
  if (!mo || !da) return null;
  const days = [0,31,28,31,30,31,30,31,31,30,31,30,31];
  let o = 0;
  for (let i = 1; i < mo; i++) o += days[i] || 30;
  o += da;
  return o;
}

function sliceRowBlock(section, nameKey, nameKeys) {
  const idx = section.indexOf(nameKey);
  if (idx < 0) return '';
  let end = section.length;
  for (const nk of nameKeys) {
    if (!nk || nk === nameKey) continue;
    const j = section.indexOf(nk, idx + nameKey.length);
    if (j !== -1 && j < end) end = j;
  }
  return section.slice(idx, Math.min(end, idx + 5000));
}

function extractDateMeetChips(rowText) {
  const dateRe = /\b(\d{1,2}\/\d{1,2})\b/g;
  const meetRe = /([\p{Script=Han}A-Za-z0-9]{1,6}(?:F\d|G\d|GP))/u;

  const hits = [];
  let m;
  while ((m = dateRe.exec(rowText)) && hits.length < 50) {
    hits.push({ date: m[1], idx: m.index });
  }

  const items = [];
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].idx;
    const end = (i + 1 < hits.length) ? hits[i + 1].idx : Math.min(rowText.length, start + 600);
    const seg = rowText.slice(start, end);

    const mm = seg.match(meetRe);
    if (!mm) continue;

    const meet = mm[1];
    const after = seg.slice(seg.indexOf(meet) + meet.length);
    const chips = chipsFromValue(after);
    if (!chips.length) continue;

    items.push({ date: hits[i].date, meet, chips });
  }
  return items;
}

// 同じ「塚G1」でも日付が離れていれば別大会として列を分ける
function groupTrackItems(items) {
  const out = [];
  let cur = null;

  for (const it of items) {
    const ord = mdToOrdinal(it.date);
    if (ord == null || !it.meet) continue;
    const different = cur ? cur.meet !== it.meet : true;
    // ★日付が違うなら別開催（近くても結合しない）
    const dateChanged = cur ? (cur.date !== it.date) : true;

    // merge only in special case: both days produce exactly one chip (1日1件形式)
    const canMerge = cur && cur.meet === it.meet && cur.date !== it.date && (cur.chips.length === 1) && ((it.chips || []).length === 1);

    if (!cur || different || (dateChanged && !canMerge)) {
      cur = { meet: it.meet, date: it.date, ord, lastOrd: ord, chips: [] };
      out.push(cur);
    } else {
      cur.lastOrd = ord;
    }
    cur.chips.push(...(it.chips || []));
  }
  return out.map(g => ({ date: g.date, meet: g.meet, chips: g.chips }));
}

function downloadText(filename, text){
  const blob = new Blob([text], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const ROUTE_HANDLERS = {
  "#/": renderMenu,
  "#": renderMenu,
  "": renderMenu,
  "#/venues": renderVenues,
  "#/history": renderHistory,
  "#/today": renderToday,
  "#/predict": renderPredict,
  "#/players": renderPlayers,
};

function normalizeHash(hash) {
  if (!hash) return "#/";
  if (hash === "#") return "#/";
  const trimmed = hash.replace(/\/+$/, "");
  if (!trimmed || trimmed === "#") return "#/";
  return trimmed;
}

function renderCurrentRoute() {
  const handler = ROUTE_HANDLERS[normalizeHash(location.hash)];
  (handler || renderNotFound)();
}

// --- History (past imported races) UI ---
const historyState = { year: new Date().getFullYear(), month: new Date().getMonth(), selectedDateISO: null };

// --- 日本の祝日判定（簡易） ---
const _jpHolidayCache = new Map();

function isJPHoliday(date){
  const y = date.getFullYear();
  if(!_jpHolidayCache.has(y)) _jpHolidayCache.set(y, buildJPHolidays(y));
  const iso = toISODate(y, date.getMonth(), date.getDate());
  return _jpHolidayCache.get(y).has(iso);
}

function buildJPHolidays(y){
  const set = new Set();
  const add = (m0, d) => set.add(toISODate(y, m0, d));

  // --- 固定祝日（主に現行ルール） ---
  add(0, 1);    // 元日
  add(1, 11);   // 建国記念の日
  if(y >= 2020) add(1, 23); // 天皇誕生日（2020〜）
  add(3, 29);   // 昭和の日
  add(4, 3);    // 憲法記念日
  add(4, 4);    // みどりの日
  add(4, 5);    // こどもの日
  if(y >= 2016) add(7, 11); // 山の日（2016〜）
  add(10, 3);   // 文化の日
  add(10, 23);  // 勤労感謝の日

  // --- ハッピーマンデー系 ---
  add(0, nthWeekdayOfMonth(y, 0, 1, 2));  // 成人の日：1月第2月曜
  add(6, nthWeekdayOfMonth(y, 6, 1, 3));  // 海の日：7月第3月曜
  add(8, nthWeekdayOfMonth(y, 8, 1, 3));  // 敬老の日：9月第3月曜
  add(9, nthWeekdayOfMonth(y, 9, 1, 2));  // スポーツの日：10月第2月曜

  // --- 春分・秋分 ---
  add(2, vernalEquinoxDay(y));  // 3月
  add(8, autumnEquinoxDay(y));  // 9月

  // --- 振替休日（祝日が日曜なら次の平日へ） ---
  const base = Array.from(set).sort();
  for(const iso of base){
    const dt = new Date(iso + "T00:00:00");
    if(dt.getDay() === 0){
      const sub = new Date(dt);
      while(true){
        sub.setDate(sub.getDate() + 1);
        const subIso = toISODate(sub.getFullYear(), sub.getMonth(), sub.getDate());
        if(!set.has(subIso)){
          set.add(subIso);
          break;
        }
      }
    }
  }

  // --- 国民の休日（祝日に挟まれた平日） ---
  const start = new Date(y, 0, 2);
  const end   = new Date(y, 11, 30);
  for(let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)){
    const iso = toISODate(y, cur.getMonth(), cur.getDate());
    if(set.has(iso)) continue;
    const prev = new Date(cur); prev.setDate(prev.getDate() - 1);
    const next = new Date(cur); next.setDate(next.getDate() + 1);
    const prevIso = toISODate(y, prev.getMonth(), prev.getDate());
    const nextIso = toISODate(y, next.getMonth(), next.getDate());
    if(set.has(prevIso) && set.has(nextIso)) set.add(iso);
  }

  return set;
}

function nthWeekdayOfMonth(y, m0, weekday, nth){
  const first = new Date(y, m0, 1);
  const firstDow = first.getDay();
  const offset = (weekday - firstDow + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

// 近似式（1980基準）※実運用で十分当たるやつ
function vernalEquinoxDay(y){
  return Math.floor(20.8431 + 0.242194*(y-1980) - Math.floor((y-1980)/4));
}
function autumnEquinoxDay(y){
  return Math.floor(23.2488 + 0.242194*(y-1980) - Math.floor((y-1980)/4));
}

function toISODate(y, m0, d){
  const mm = String(m0+1).padStart(2,"0");
  const dd = String(d).padStart(2,"0");
  return `${y}-${mm}-${dd}`;
}

function getMonthMeta(y, m0){
  const first = new Date(y, m0, 1);
  const last  = new Date(y, m0 + 1, 0);
  const startDow = first.getDay();
  const daysInMonth = last.getDate();
  const startISO = toISODate(y, m0, 1);
  const endISO   = toISODate(y, m0, daysInMonth);
  return { y, m0, startDow, daysInMonth, startISO, endISO };
}

function renderMonthGrid(meta, countByDate, labelId, gridId){
  const label = document.getElementById(labelId);
  const grid  = document.getElementById(gridId);
  if(!label || !grid) return;

  label.textContent = `${meta.y}年 ${meta.m0 + 1}月`;
  grid.innerHTML = "";

  // 空白マス
  for(let i=0;i<meta.startDow;i++){
    const div = document.createElement("div");
    div.className = "dayCell isEmpty";
    grid.appendChild(div);
  }

  // 日付マス
  for(let d=1; d<=meta.daysInMonth; d++){
    const iso = toISODate(meta.y, meta.m0, d);
    const dateObj = new Date(meta.y, meta.m0, d);
    const dow = dateObj.getDay(); // 0=日, 6=土
    const has = !!countByDate[iso];

    const div = document.createElement("div");
    div.className = "dayCell" + (has ? " hasData" : "");

    // 土日祝クラス
    if(dow === 0) div.classList.add("isSun");
    if(dow === 6) div.classList.add("isSat");
    if(isJPHoliday(dateObj)) div.classList.add("isHoliday");

    div.innerHTML =
      `<div class="dayNum">${d}</div>` +
      (has ? `<div class="badge">${countByDate[iso]}件</div>` : "");

    div.addEventListener("click", () => {
      if(!has) return;
      historyState.selectedDateISO = iso;
      renderHistoryList(iso);
    });

    grid.appendChild(div);
  }
}

async function renderHistoryCalendar(){
  const y  = historyState.year;
  const m0 = historyState.month;

  // 今月 + 先月
  const main = getMonthMeta(y, m0);
  let py = y, pm0 = m0 - 1;
  if(pm0 < 0){ pm0 = 11; py -= 1; }
  const prev = getMonthMeta(py, pm0);

  // 2か月分まとめて取得（先月初日〜今月末日）
  const recs = await dbListByDateRange(prev.startISO, main.endISO);
  const countByDate = {};
  for(const r of recs) countByDate[r.date] = (countByDate[r.date] || 0) + 1;

  // 2段描画
  renderMonthGrid(main, countByDate, "historyCalLabel", "historyCalendar");
  renderMonthGrid(prev, countByDate, "historyCalLabelPrev", "historyCalendarPrev");

  // 取り込み一覧の自動表示（優先：今月→先月、各月の「最新日」）
  const allDates = Object.keys(countByDate).sort();
  const mainDates = allDates.filter(d => d >= main.startISO && d <= main.endISO);
  const prevDates = allDates.filter(d => d >= prev.startISO && d <= prev.endISO);

  let pick = null;
  if(historyState.selectedDateISO && countByDate[historyState.selectedDateISO]){
    pick = historyState.selectedDateISO;
  }else if(mainDates.length){
    pick = mainDates[mainDates.length - 1];
  }else if(prevDates.length){
    pick = prevDates[prevDates.length - 1];
  }

  if(pick){
    historyState.selectedDateISO = pick;
    await renderHistoryList(pick);
  }else{
    document.getElementById("historyList").innerHTML = "この月は取り込み済みレースがありません";
  }
}

async function renderHistoryList(dateISO){
  const recs = await dbListByDateRange(dateISO, dateISO);
  const list = document.getElementById("historyList"); list.innerHTML = "";
  for(const r of recs){
    const row = document.createElement("div"); row.className = "historyItem";
    row.innerHTML = `
      <div>
        <div><b>${escapeHTML(r.venue)}</b></div>
        <div style="font-size:12px;opacity:.75;">${escapeHTML(r.sourceZipName || "")}</div>
      </div>
      <button class="openBtn">開く</button>
    `;
    row.querySelector(".openBtn").addEventListener("click", async () => { await openRaceViewerFromHistory(r.id); });
    list.appendChild(row);
  }
}

async function openRaceViewerFromHistory(bundleId){
  const rec = await dbGetById(bundleId);
  if(!rec) return;
  try{
    // merge into TODAY_DATA_KEY so renderToday can reuse existing UI logic
    const TODAY_DATA_KEY = 'todayRace_data_v1';
    const all = loadJSON(TODAY_DATA_KEY, {});
    const date = String(rec.date || '');
    const venue = String(rec.venue || '');
    const bundle = rec.bundle || {};
    if(date){
      all[date] = all[date] || { venues: {} };
      all[date].venues = all[date].venues || {};
      all[date].venues[venue] = all[date].venues[venue] || { races: {}, updatedAt: new Date().toISOString() };
      const rn = String(bundle.raceNo || bundle.race_number || (bundle.race && bundle.race.no) || (bundle.race && bundle.race.raceNo) || '1');
      all[date].venues[venue].races[rn] = bundle;
      saveJSON(TODAY_DATA_KEY, all);
    }
  }catch(e){ console.warn('openRaceViewerFromHistory failed', e); }
  try{ location.hash = '#/today'; }catch(e){}
}

// --- History page renderer (parent container for calendar/list) ---
function renderHistory(){
  const app = document.getElementById("app");
  if (app) app.classList.remove("page-today");

  $view.innerHTML = `
    <section class="page historyPage has-overlay" style="--overlay-alpha:0.45">
      <div class="card" style="position:relative;">
        <!-- 戻る -->
        <button id="historyBackBtn" class="todayBackBtn" type="button" aria-label="戻る">
          <img src="${asset('戻るボタン.png')}" alt="">
        </button>

        <!-- タイトル（画像が無ければ自動で非表示） -->
        <div style="display:flex;justify-content:center;margin:6px 0 2px;">
          <img
            src="${asset('過去のレースタブ.png')}"
            alt="過去のレース"
            style="height:110px;width:auto;object-fit:contain;"
            onerror="this.style.display='none'"
          >
        </div>

        <!-- 月移動（今月） -->
        <div class="historyCalBar">
          <button id="historyPrevBtn" class="calNav" type="button">◀</button>
          <div id="historyCalLabel" class="calLabel"></div>
          <button id="historyNextBtn" class="calNav" type="button">▶</button>
        </div>

        <!-- 今月カレンダー -->
        <div id="historyCalendar" class="calendarGrid"></div>

        <!-- 先月ラベル（移動ボタンなし） -->
        <div class="historyCalBar sub">
          <div id="historyCalLabelPrev" class="calLabel"></div>
        </div>

        <!-- 先月カレンダー -->
        <div id="historyCalendarPrev" class="calendarGrid"></div>

        <!-- その日の取り込み一覧 -->
        <div class="historyListWrap">
          <div class="historyListTitle">取り込み一覧</div>
          <div id="historyList" class="historyList"></div>
        </div>
      </div>
    </section>
  `;

  document.getElementById("historyBackBtn")?.addEventListener("click", () => { location.hash = "#/"; });

  const moveMonth = async (delta) => {
    historyState.month += delta;
    if (historyState.month < 0) { historyState.month = 11; historyState.year -= 1; }
    if (historyState.month > 11) { historyState.month = 0;  historyState.year += 1; }
    historyState.selectedDateISO = null;
    await renderHistoryCalendar();
  };

  document.getElementById("historyPrevBtn")?.addEventListener("click", () => moveMonth(-1));
  document.getElementById("historyNextBtn")?.addEventListener("click", () => moveMonth(1));

  renderHistoryCalendar().catch((e) => {
    console.error("renderHistoryCalendar failed", e);
    const list = document.getElementById("historyList");
    if (list) list.textContent = "履歴の描画に失敗しました（console参照）";
  });
}

try {
  window.addEventListener("hashchange", renderCurrentRoute);
  renderCurrentRoute();
} catch (e) {
  console.error("[BOOT ERROR]", e);
  const escapeForHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  document.body?.insertAdjacentHTML(
    "afterbegin",
    `<div style="position:fixed;inset:0;background:#fff;color:#111;padding:16px;z-index:99999;overflow:auto;">
       <h2>BOOT ERROR</h2><pre>${escapeForHtml(e.stack || e)}</pre>
     </div>`
  );
}
