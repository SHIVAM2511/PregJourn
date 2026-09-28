// Cloud sharing via Supabase. The app always works offline on this phone; when both
// partners join the same "family space", each section (meds, health, money, …) is kept
// in sync in real time. Edits made on both phones at once are merged, not overwritten.

const SYNC_KEYS = ['profile', 'meds', 'medLog', 'appts', 'tests', 'health', 'kicks', 'contractions', 'daily',
  'todos', 'food', 'money', 'library', 'checklists', 'baby', 'setupDone'];
const BASE_KEY = 'nest.syncbase';

const Sync = {
  client: null,
  userId: null,
  user: null,
  household: null,
  members: [],
  status: 'off',        // off | signedout | nohousehold | syncing | synced | offline | error
  error: '',
  lastSyncAt: 0,
  base: {},             // key -> {version, data}: the last version both sides agreed on
  channel: null,
  timer: null,
  pushing: false,
  pushAgain: false,
  applying: false,
  listeners: [],

  config() {
    const c = window.NEST_CONFIG || {};
    const d = Device.state.cloud || {};
    return { url: (d.url || c.supabaseUrl || '').trim().replace(/\/+$/, ''), key: (d.key || c.supabaseAnonKey || '').trim() };
  },
  configured() { const c = this.config(); return !!(c.url && c.key); },
  connected() { return !!this.household; },
  onChange(fn) { this.listeners.push(fn); },
  setStatus(s, error = '') { this.status = s; this.error = error; this.listeners.forEach(fn => fn()); },

  loadLib() {
    if (window.NEST_SUPABASE_FACTORY) return Promise.resolve(window.NEST_SUPABASE_FACTORY);
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase.createClient);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/supabase.js';
      s.onload = () => resolve(window.supabase.createClient);
      s.onerror = () => reject(new Error('Could not load the sync library'));
      document.head.appendChild(s);
    });
  },

  async init() {
    if (!this.configured()) { this.setStatus('off'); return; }
    this.disconnect();
    this.sessionKnown = false;
    this.userId = null;
    this.base = readJSON(BASE_KEY) || {};
    this.setStatus('syncing');
    try {
      const createClient = await this.loadLib();
      const { url, key } = this.config();
      this.client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'nest.auth' } });
    } catch (e) { this.fail(e); return; }
    // Supabase warns against awaiting its own calls inside this callback, so defer.
    this.client.auth.onAuthStateChange((event, session) => { setTimeout(() => this.onSession(session), 0); });
    if (!this.wired) {
      this.wired = true;
      Store.onSave(() => { if (!this.applying) this.schedule(); });
      window.addEventListener('online', () => this.refresh());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
      setInterval(() => { if (this.connected()) this.push(); }, 60000);
    }
  },

  async onSession(session) {
    const id = session && session.user ? session.user.id : null;
    this.user = session ? session.user : null;
    if (this.sessionKnown && id === this.userId) return; // token refreshes etc.
    this.sessionKnown = true;
    this.userId = id;
    this.disconnect();
    if (!id) { this.setStatus('signedout'); return; }
    await this.loadHousehold();
  },

  async loadHousehold() {
    this.setStatus('syncing');
    const { data, error } = await this.client.from('household_members').select('household_id').eq('user_id', this.userId);
    if (error) return this.fail(error);
    if (!data.length) { this.setStatus('nohousehold'); return; }
    const preferred = data.find(r => r.household_id === Device.state.householdId) || data[0];
    const res = await this.client.from('households').select('id, name, invite_code').eq('id', preferred.household_id);
    if (res.error) return this.fail(res.error);
    if (!res.data.length) { this.setStatus('nohousehold'); return; }
    await this.connect(res.data[0]);
  },

  async connect(h) {
    if (Device.state.householdId !== h.id) {
      this.base = {};
      this.saveBase();
      Device.state.householdId = h.id;
      Device.save();
    }
    this.household = h;
    await this.loadMembers();
    await this.pull();
    this.subscribe();
    await this.push();
  },

  disconnect() {
    if (this.channel && this.client) this.client.removeChannel(this.channel);
    this.channel = null;
    this.household = null;
    this.members = [];
  },

  async loadMembers() {
    const { data } = await this.client.from('household_members').select('user_id, display_name').eq('household_id', this.household.id);
    this.members = data || [];
  },

  subscribe() {
    const hid = this.household.id;
    this.channel = this.client.channel('nest-' + hid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nest_docs', filter: 'household_id=eq.' + hid }, payload => {
        const row = payload.new;
        if (row && row.key && row.data !== undefined) this.afterApply(this.applyRemote(row));
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') this.pull(); });
  },

  async refresh() {
    if (!this.connected()) return;
    await this.pull();
    await this.push();
  },

  async pull() {
    if (!this.connected()) return;
    const { data, error } = await this.client.from('nest_docs').select('key, data, version').eq('household_id', this.household.id);
    if (error) return this.fail(error);
    let changed = false;
    for (const row of data) changed = this.applyRemote(row) || changed;
    this.afterApply(changed);
  },

  // Bring one remote section into local state, merging with any unsent local edits.
  applyRemote(row) {
    if (!SYNC_KEYS.includes(row.key)) return false;
    const b = this.base[row.key];
    if (b && b.version >= row.version) return false;
    const baseData = b ? b.data : defaultState()[row.key];
    const local = Store.state[row.key];
    const next = deepEqual(local, baseData) ? row.data : merge3(baseData, local, row.data);
    // The base must be its own copy: if it shared objects with the live state, later
    // local edits would silently change the base too and never look "unsent".
    this.base[row.key] = { version: row.version, data: clone(row.data) };
    if (deepEqual(next, local)) return false;
    Store.state[row.key] = next;
    return true;
  },

  afterApply(changed) {
    this.saveBase();
    if (changed) {
      this.applying = true;
      Store.save();
      this.applying = false;
      if (typeof safeRender === 'function') safeRender();
    }
    if (this.dirtyKeys().length) this.schedule(); else this.markSynced();
  },

  dirtyKeys() {
    const d = defaultState();
    return SYNC_KEYS.filter(k => {
      const b = this.base[k];
      return !deepEqual(Store.state[k], b ? b.data : d[k]);
    });
  },

  schedule(delay = 700) {
    if (!this.connected()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), delay);
  },

  async push() {
    if (!this.connected()) return;
    if (this.pushing) { this.pushAgain = true; return; }
    const keys = this.dirtyKeys();
    if (!keys.length) { this.markSynced(); return; }
    this.pushing = true;
    this.setStatus('syncing');
    let ok = true;
    try {
      for (const k of keys) await this.pushKey(k);
    } catch (e) { ok = false; this.fail(e); }
    this.saveBase();
    this.pushing = false;
    if (ok && (this.pushAgain || this.dirtyKeys().length)) { this.pushAgain = false; this.schedule(200); }
    else if (ok) this.markSynced();
  },

  async pushKey(k, attempt = 0) {
    const hid = this.household.id;
    const data = clone(Store.state[k]);
    const b = this.base[k];
    const q = this.client.from('nest_docs');
    const res = b
      ? await q.update({ data, version: b.version + 1 }).eq('household_id', hid).eq('key', k).eq('version', b.version).select('key, data, version')
      : await q.insert({ household_id: hid, key: k, data, version: 1 }).select('key, data, version');
    if (res.error && res.error.code !== '23505') throw res.error;
    const row = res.data && res.data[0];
    if (row) { this.base[k] = { version: row.version, data: clone(row.data) }; return; }
    if (attempt >= 4) throw new Error('Too many edits at once — will retry shortly');
    // The other phone saved first: take theirs, merge ours on top, try again.
    const latest = await this.client.from('nest_docs').select('key, data, version').eq('household_id', hid).eq('key', k);
    if (latest.error) throw latest.error;
    if (latest.data.length) {
      if (this.applyRemote(latest.data[0])) {
        this.applying = true; Store.save(); this.applying = false;
        if (typeof safeRender === 'function') safeRender();
      }
    } else {
      delete this.base[k];
    }
    return this.pushKey(k, attempt + 1);
  },

  markSynced() {
    if (!this.connected()) return;
    this.lastSyncAt = Date.now();
    if (this.status !== 'synced') this.setStatus('synced');
  },

  fail(e) {
    const msg = (e && (e.message || e.error_description || e.msg)) || String(e);
    const offline = !navigator.onLine || /fetch|network|load failed/i.test(msg);
    this.setStatus(offline ? 'offline' : 'error', msg);
  },

  saveBase() { writeJSON(BASE_KEY, this.base); },

  // ---------- account ----------
  redirectUrl() { return location.origin + location.pathname; },
  async signUp(email, password, name) {
    const { data, error } = await this.client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: this.redirectUrl() } });
    if (error) throw error;
    return data.session ? 'signedin' : 'confirm';
  },
  async signIn(email, password) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async resetPassword(email) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: this.redirectUrl() });
    if (error) throw error;
  },
  async signOut() {
    clearTimeout(this.timer);
    this.disconnect(); // stop syncing right away, before any further local change
    await this.client.auth.signOut();
    this.base = {};
    this.saveBase();
    Device.state.householdId = '';
    Device.save();
  },
  myName() { return (this.user && this.user.user_metadata && this.user.user_metadata.name) || ''; },
  async createHousehold(name) {
    const { data, error } = await this.client.rpc('create_household', { p_name: name || 'Our family', p_display_name: this.myName() });
    if (error) throw error;
    await this.connect(Array.isArray(data) ? data[0] : data);
  },
  async joinHousehold(code) {
    const { data, error } = await this.client.rpc('join_household', { p_code: code, p_display_name: this.myName() });
    if (error) throw error;
    await this.connect(Array.isArray(data) ? data[0] : data);
  },
  async leaveHousehold() {
    const hid = this.household.id;
    const { error } = await this.client.from('household_members').delete().eq('household_id', hid).eq('user_id', this.userId);
    if (error) throw error;
    this.disconnect();
    this.base = {};
    this.saveBase();
    Device.state.householdId = '';
    Device.save();
    this.setStatus('nohousehold');
  },
};
