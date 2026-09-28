// Persistence. Shared family data lives in `Store.state` (synced when cloud sharing is on);
// per-phone settings (reminders, which notifications were sent) live in `Device.state`.
const STORE_KEY = 'nest.v1';
const DEVICE_KEY = 'nest.device';

function defaultState() {
  return {
    profile: {
      momName: '', dadName: '', dueDate: '', lmp: '', currency: '₹', bloodGroup: '',
      doctorName: '', doctorPhone: '', hospital: '', hospitalPhone: '', emergencyPhone: '112', notes: '',
    },
    meds: [],        // {id,name,dose,times:[HH:MM],perDose,stock,unit,refillDays,notes,active}
    medLog: [],      // {medId,date,slot,at}
    appts: [],       // {id,date,time,title,doctor,place,notes,questions,testId,done}
    tests: {},       // testId -> {done,date,result}
    health: [],      // {id,date,weight,sys,dia,sugar,symptoms[],mood,sleep,notes} — one per date
    kicks: [],       // {id,start,end,count}
    contractions: [],// {id,start,end}
    daily: { custom: [], hidden: [], log: {} }, // log[date] = [taskId]
    todos: [],       // {id,text,due,done}
    food: { log: {} },  // log[date] = {water, checks:[], meals:''}
    money: { budget: 0, expenses: [], planned: PLANNED_DEFAULTS.map(([name, estimate], i) => ({ id: 'pl_' + i, name, estimate, bought: false })) },
    library: { status: {}, custom: [] }, // status[id] = {state, progress}
    checklists: { done: {}, custom: {} }, // done[listId] = [itemText], custom[listId] = [itemText]
    baby: { born: false, name: '', dob: '', logs: [], growth: [] },
    setupDone: false,
  };
}

function defaultDevice() {
  return { notif: { enabled: false, dailyTime: '21:00', sent: {}, asked: false }, cloud: { url: '', key: '' }, householdId: '' };
}

function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

function mergeDefaults(base, saved) {
  if (!isObj(base) || !isObj(saved)) return saved === undefined ? base : saved;
  const out = { ...base };
  for (const k of Object.keys(saved)) out[k] = isObj(base[k]) ? mergeDefaults(base[k], saved[k]) : saved[k];
  return out;
}

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { toast('Could not save on this phone — storage may be full or blocked.'); return false; }
}

const Device = {
  state: null,
  load() { this.state = mergeDefaults(defaultDevice(), readJSON(DEVICE_KEY) || {}); return this.state; },
  save() { writeJSON(DEVICE_KEY, this.state); },
};

const Store = {
  state: null,
  listeners: [],
  load() {
    const saved = readJSON(STORE_KEY) || {};
    // v1 kept notification settings in the shared state; they're per-phone now.
    if (saved.notif) {
      Device.state.notif = mergeDefaults(Device.state.notif, saved.notif);
      Device.save();
      delete saved.notif;
    }
    if (saved.profile && (saved.profile.dueDate || saved.profile.lmp) && saved.setupDone === undefined) saved.setupDone = true;
    this.state = mergeDefaults(defaultState(), saved);
    return this.state;
  },
  save() {
    writeJSON(STORE_KEY, this.state);
    this.listeners.forEach(fn => fn());
  },
  onSave(fn) { this.listeners.push(fn); },
  exportJSON() {
    return JSON.stringify({ app: 'nest', version: 2, exportedAt: new Date().toISOString(), data: this.state }, null, 2);
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!isObj(data) || !data.profile) throw new Error('Not a valid backup file');
    delete data.notif;
    this.state = mergeDefaults(defaultState(), data);
    this.save();
  },
  reset() {
    localStorage.removeItem(STORE_KEY);
    this.state = defaultState();
  },
};

// ---------- small utilities ----------
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function pad(n) { return String(n).padStart(2, '0'); }
function isoDate(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function nowTime(d = new Date()) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); }
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!s) return '';
  return parseDate(s).toLocaleDateString(undefined, opts);
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function relDay(s) {
  const n = daysBetween(isoDate(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return parseDate(s).toLocaleDateString(undefined, { weekday: 'long' });
  return fmtDate(s, { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtMoney(n) {
  const cur = Store.state.profile.currency || '';
  return cur + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`;
  return s >= 60 ? `${Math.floor(s / 60)}m ${pad(s % 60)}s` : `${s}s`;
}
function momName() { return Store.state.profile.momName || 'Mom'; }
function dadName() { return Store.state.profile.dadName || 'Dad'; }

// ---------- pregnancy math ----------
function pregnancyInfo(on = isoDate()) {
  const p = Store.state.profile;
  const due = p.dueDate || (p.lmp ? addDays(p.lmp, 280) : '');
  if (!due) return null;
  const daysPregnant = 280 - daysBetween(on, due);
  const week = Math.floor(daysPregnant / 7);
  const day = daysPregnant % 7;
  const trimester = week < 14 ? 1 : week < 28 ? 2 : 3;
  return {
    due, daysPregnant, week: Math.max(0, week), day: Math.max(0, day), trimester,
    daysLeft: daysBetween(on, due), percent: Math.min(100, Math.max(0, Math.round(daysPregnant / 280 * 100))),
  };
}
function dateForWeek(week) {
  const info = pregnancyInfo();
  if (!info) return '';
  return addDays(info.due, (week * 7) - 280);
}

// ---------- structural equality & three-way merge (used by sync) ----------
// Key order is ignored (Postgres jsonb reorders keys) and undefined-valued keys count as absent.
function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}
function stableKey(x) {
  if (Array.isArray(x)) return '[' + x.map(stableKey).join(',') + ']';
  if (isObj(x)) return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableKey(x[k])).join(',') + '}';
  return JSON.stringify(x);
}
const itemKey = x => (isObj(x) && x.id != null ? 'id:' + x.id : 'v:' + stableKey(x));

// Combine changes made on this phone (local) and the other phone (remote) since the
// last version both saw (base). Lists merge item by item, so two people adding
// entries at the same time both keep theirs; if both edit the same field, this phone wins.
function merge3(base, local, remote) {
  if (deepEqual(local, remote) || deepEqual(local, base)) return remote;
  if (deepEqual(remote, base)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) return mergeArrays(Array.isArray(base) ? base : [], local, remote);
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const inL = local[k] !== undefined, inR = remote[k] !== undefined, inB = b[k] !== undefined;
      if (inL && inR) out[k] = merge3(b[k], local[k], remote[k]);
      else if (inL) { if (!inB || !deepEqual(local[k], b[k])) out[k] = local[k]; }
      else if (inR) { if (!inB || !deepEqual(remote[k], b[k])) out[k] = remote[k]; }
    }
    return out;
  }
  return local;
}
function mergeArrays(base, local, remote) {
  const B = new Map(base.map(x => [itemKey(x), x]));
  const L = new Map(local.map(x => [itemKey(x), x]));
  const out = [], seen = new Set();
  for (const r of remote) {
    const k = itemKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    if (L.has(k)) out.push(merge3(B.get(k), L.get(k), r));
    else if (!(B.has(k) && deepEqual(B.get(k), r))) out.push(r); // keep unless deleted here and untouched there
  }
  for (const l of local) {
    const k = itemKey(l);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!(B.has(k) && deepEqual(B.get(k), l))) out.push(l); // keep unless deleted there and untouched here
  }
  return out;
}
