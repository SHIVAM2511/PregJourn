// Persistence: everything lives in this device's localStorage. Export/import for backups and sharing.
const STORE_KEY = 'nest.v1';

function defaultState() {
  return {
    profile: {
      momName: '', dadName: '', dueDate: '', lmp: '', currency: '₹', bloodGroup: '',
      doctorName: '', doctorPhone: '', hospital: '', hospitalPhone: '', emergencyPhone: '112', notes: '',
    },
    meds: [],        // {id,name,dose,times:[HH:MM],perDose,stock,unit,refillDays,notes,active}
    medLog: [],      // {medId,date,slot,at}
    appts: [],       // {id,date,time,title,doctor,place,notes,questions,done}
    tests: {},       // testId -> {done,date,result}
    health: [],      // {id,date,weight,sys,dia,sugar,symptoms[],mood,sleep,notes}
    kicks: [],       // {id,start,end,count}
    contractions: [],// {id,start,end}
    daily: { custom: [], hidden: [], log: {} }, // log[date] = [taskId]
    todos: [],       // {id,text,due,done}
    food: { log: {} },  // log[date] = {water, checks:[], meals:''}
    money: { budget: 0, expenses: [], planned: null },
    library: { status: {}, custom: [] }, // status[id] = {state, progress}
    checklists: { done: {}, custom: {} }, // done[listId] = [itemText], custom[listId] = [itemText]
    baby: { born: false, name: '', dob: '', logs: [], growth: [] },
    notif: { enabled: false, dailyTime: '21:00', sent: {} },
  };
}

function mergeDeep(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(base)) return saved ?? base;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    out[k] = (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
      ? mergeDeep(base[k], saved[k]) : saved[k];
  }
  return out;
}

const Store = {
  state: null,
  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { /* ignore */ }
    this.state = mergeDeep(defaultState(), saved || {});
    if (!this.state.money.planned) {
      this.state.money.planned = PLANNED_DEFAULTS.map(([name, est]) => ({ id: uid(), name, estimate: est, bought: false }));
    }
    return this.state;
  },
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); }
    catch (e) { toast('Could not save — storage may be full or blocked.'); }
  },
  exportJSON() {
    return JSON.stringify({ app: 'nest', version: 1, exportedAt: new Date().toISOString(), data: this.state }, null, 2);
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || !data.profile) throw new Error('Not a valid backup file');
    this.state = mergeDeep(defaultState(), data);
    this.save();
  },
  reset() {
    localStorage.removeItem(STORE_KEY);
    this.load();
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
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!s) return '';
  return parseDate(s).toLocaleDateString(undefined, opts);
}
function fmtMoney(n) {
  const cur = Store.state.profile.currency || '';
  return cur + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${pad(s % 60)}s` : `${s}s`;
}

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
