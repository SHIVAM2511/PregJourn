// Nestling — pregnancy companion. Plain JS, hash-routed views, event delegation.
// Design rule: the app asks, you tap. Typing is the fallback, never the default.

const UI = {
  healthTab: 'today', who: 'all', libFilter: 'all', authMode: 'signin', step: 0,
  kick: null,          // {start, count}
  contraction: null,   // {start}
  openLists: {},       // checklist id -> open/closed as the user left it
  pendingRender: false,
  busy: false,
};

// ---------- feedback ----------
function toast(msg, opts = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? '<button type="button" class="toast-btn">Undo</button>' : ''}`;
  el.classList.toggle('has-btn', !!opts.undo);
  el.classList.add('show');
  if (opts.undo) el.querySelector('button').onclick = () => { opts.undo(); el.classList.remove('show'); };
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), opts.undo ? 6000 : 3500);
}

// Run a change, save, re-render, and offer Undo (restores only the sections it touched).
function undoable(msg, fn) {
  const before = clone(Store.state);
  fn();
  const touched = Object.keys(Store.state).filter(k => !deepEqual(before[k], Store.state[k]));
  commit();
  toast(msg, { undo: () => { touched.forEach(k => { Store.state[k] = before[k]; }); commit(); } });
}

function commit(msg) { Store.save(); render(); if (msg) toast(msg); }

// Don't yank the page out from under someone who is typing (e.g. when the partner's edit arrives).
function isTyping() {
  const a = document.activeElement;
  return !!(a && a.matches && a.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select'));
}
function sheetOpen() { return document.getElementById('sheet').open; }
function safeRender() {
  if (isTyping() || sheetOpen()) { UI.pendingRender = true; return; }
  render();
}
function flushRender() {
  if (UI.pendingRender && !isTyping() && !sheetOpen()) { UI.pendingRender = false; render(); }
}

// ---------- bottom sheet ----------
function openSheet(title, body) {
  const d = document.getElementById('sheet');
  d.innerHTML = `<div class="sheet-h"><h2>${title}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">✕</button></div><div class="sheet-b">${body}</div>`;
  if (!d.open) d.showModal();
  const first = d.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeSheet() { const d = document.getElementById('sheet'); if (d.open) d.close(); }

// ---------- domain helpers (also used by reminders & quick add) ----------
function medTaken(medId, date, slot) { return Store.state.medLog.some(l => l.medId === medId && l.date === date && l.slot === slot); }
function medDaysLeft(m) {
  const perDay = (Number(m.perDose) || 1) * (m.times.length || 1);
  if (m.stock === '' || m.stock == null) return null;
  return Math.floor(Number(m.stock) / perDay);
}
function markTaken(m, date, slot, taken) {
  const s = Store.state;
  const idx = s.medLog.findIndex(l => l.medId === m.id && l.date === date && l.slot === slot);
  const per = Number(m.perDose) || 1;
  if (!taken && idx >= 0) { s.medLog.splice(idx, 1); if (m.stock !== '') m.stock = Number(m.stock) + per; }
  if (taken && idx < 0) { s.medLog.push({ medId: m.id, date, slot, at: Date.now() }); if (m.stock !== '') m.stock = Math.max(0, Number(m.stock) - per); }
}
function dailyTasksFor(date) {
  const s = Store.state;
  const info = pregnancyInfo(date);
  const wk = info ? info.week : 0;
  return [...DAILY_TASKS, ...s.daily.custom]
    .filter(t => !s.daily.hidden.includes(t.id))
    .filter(t => (!t.minWeek || wk >= t.minWeek) && (!t.maxWeek || wk <= t.maxWeek));
}
function foodDay(date = isoDate()) {
  const log = Store.state.food.log;
  if (!log[date]) log[date] = { water: 0, checks: [], meals: '' };
  return log[date];
}
function foodPeek(date = isoDate()) { return Store.state.food.log[date] || { water: 0, checks: [], meals: '' }; }
// One health entry per day (stable id, so both phones edit the same entry).
function healthDay(date = isoDate()) {
  const s = Store.state;
  let e = s.health.find(x => x.id === 'h_' + date) || s.health.find(x => x.date === date);
  if (!e) { e = { id: 'h_' + date, date, symptoms: [] }; s.health.push(e); }
  return e;
}
function healthPeek(date = isoDate()) {
  return Store.state.health.find(x => x.id === 'h_' + date) || Store.state.health.find(x => x.date === date) || null;
}
function lastWeight() {
  const w = Store.state.health.filter(e => e.weight).sort((a, b) => a.date.localeCompare(b.date));
  return w.length ? w[w.length - 1] : null;
}
function testStatus(t, info) {
  const st = Store.state.tests[t.id];
  if (st?.done) return ['done', '✓ Done'];
  if (!info) return ['', `Weeks ${t.from}–${t.to}`];
  if (info.week > t.to) return ['late', 'Window passed'];
  if (info.week >= t.from) return ['due', 'Due now'];
  return ['', `From ${fmtDate(dateForWeek(t.from), { day: 'numeric', month: 'short' })}`];
}
function whoLabel(w) { return { mom: '🤰 ' + momName(), dad: '🧔 ' + dadName(), both: '👫 Both' }[w] || ''; }
function sizeLine(week) {
  const w = WEEKS[Math.min(42, Math.max(1, week))];
  if (!w || w[0] === '—') return 'Getting started';
  return `About the size of a <b>${esc(w[0])}</b>${w[1] ? ` · ${esc(w[1])}` : ''}${w[2] ? ` · ${esc(w[2])}` : ''}`;
}
function bpHigh(e) { return Number(e.sys) >= 140 || Number(e.dia) >= 90; }

// ---------- small render helpers ----------
function tel(num) { return num ? `<a class="btn small" href="tel:${esc(num.replace(/[^\d+]/g, ''))}">📞 Call</a>` : ''; }
function pill(text, kind = '') { return `<span class="pill ${kind}">${esc(text)}</span>`; }
function empty(text) { return `<p class="muted empty">${text}</p>`; }
function progressBar(pct, label = '') { return `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label)}"><span style="width:${pct}%"></span></div>`; }
function card(title, body, extra = '') { return `<section class="card">${title ? `<div class="card-h"><h2>${title}</h2>${extra}</div>` : ''}${body}</section>`; }
function segmented(name, current, options) {
  return `<div class="seg" role="tablist">${options.map(([v, l]) => `<button role="tab" aria-selected="${v === current}" class="${v === current ? 'on' : ''}" data-act="seg" data-name="${name}" data-val="${v}">${l}</button>`).join('')}</div>`;
}
function checkin(icon, title, body, kind = '') {
  return `<article class="ci ${kind}"><div class="ci-icon" aria-hidden="true">${icon}</div><div class="ci-body"><p class="ci-title">${title}</p>${body}</div></article>`;
}
function chipBtns(target, options, current = '') {
  return `<div class="chips">${options.map(([val, label]) => `<button type="button" class="chip-btn ${String(val) === String(current) ? 'on' : ''}" data-act="setVal" data-target="${target}" data-val="${esc(val)}">${label}</button>`).join('')}</div>`;
}

// ---------- views ----------
const VIEWS = {};

// ---------- Today: tells you things, asks one thing at a time ----------
const SIZE_EMOJI = [
  [/poppy|sesame/, '🌱'], [/lentil/, '🫘'], [/blueberry/, '🫐'], [/raspberry|strawberry/, '🍓'], [/cherry/, '🍒'], [/fig|plum/, '🫐'],
  [/lime|lemon/, '🍋'], [/peach/, '🍑'], [/apple|pomegranate/, '🍎'], [/avocado/, '🥑'], [/bell pepper/, '🫑'], [/mango|papaya/, '🥭'],
  [/banana/, '🍌'], [/carrot/, '🥕'], [/grapefruit/, '🍊'], [/corn/, '🌽'], [/cauliflower/, '🥦'], [/lettuce|cabbage/, '🥬'],
  [/eggplant/, '🍆'], [/cucumber/, '🥒'], [/coconut/, '🥥'], [/pineapple/, '🍍'], [/cantaloupe|honeydew|winter melon/, '🍈'],
  [/watermelon/, '🍉'], [/squash|pumpkin/, '🎃'],
];
function sizeEmoji(week) {
  const w = WEEKS[Math.min(42, Math.max(1, week))];
  if (!w || w[0] === '—') return '✨';
  return (SIZE_EMOJI.find(([re]) => re.test(w[0])) || [, '👶'])[1];
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function ring(pct, label, sub) {
  const r = 46, c = 2 * Math.PI * r;
  return `<div class="ring" role="img" aria-label="${esc(label)} ${esc(sub)}, ${pct}% of the way">
    <svg viewBox="0 0 108 108"><circle class="ring-track" cx="54" cy="54" r="${r}"/><circle class="ring-fill" cx="54" cy="54" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg>
    <div class="ring-label"><b>${label}</b><span>${sub}</span></div></div>`;
}
function inDays(date) {
  const n = daysBetween(isoDate(), date);
  return n <= 0 ? 'now' : n === 1 ? 'tomorrow' : n < 14 ? `in ${n} days` : n < 60 ? `in ${Math.round(n / 7)} weeks` : `in ${Math.round(n / 30)} months`;
}
function snoozed(key) {
  const z = Device.state.snooze || {};
  return z.date === isoDate() && (z.keys || []).includes(key);
}

VIEWS.home = () => {
  const s = Store.state;
  if (!s.setupDone && !s.baby.born) return wizard();
  const info = pregnancyInfo();
  const today = isoDate();
  const h = healthPeek(today) || {};
  const fd = foodPeek(today);
  let out = `<p class="greet">${greeting()}${s.profile.dadName ? ', ' + esc(s.profile.dadName) : ''}</p>`;

  // Hero
  if (s.baby.born) {
    out += `<section class="hero"><p class="eyebrow">Welcome to the world</p><h1 class="display">${esc(s.baby.name || 'Baby')} 👶</h1>
      <p>${s.baby.dob ? `${daysBetween(s.baby.dob, today)} days old` : ''}</p><a class="btn" href="#baby">Open baby tracker</a></section>`;
  } else if (info) {
    const w = WEEKS[Math.min(42, Math.max(1, info.week))];
    out += `<section class="hero">
      <div class="hero-top">
        ${ring(info.percent, `Week ${info.week}`, `+${info.day} day${info.day === 1 ? '' : 's'}`)}
        <a class="baby-size" href="#week/${info.week}"><span class="fruit" aria-hidden="true">${sizeEmoji(info.week)}</span>
          <span class="size-text">${w && w[0] !== '—' ? `Size of a <b>${esc(w[0])}</b>` : 'Tiny and growing'}<small>${[w && w[1], w && w[2]].filter(Boolean).map(esc).join(' · ')}</small></span></a>
      </div>
      <div class="hero-stats"><span><b>${Math.max(0, info.daysLeft)}</b> days to go</span><span>Trimester <b>${info.trimester}</b></span><span>Due <b>${fmtDate(info.due, { day: 'numeric', month: 'short' })}</b></span></div>
      <div class="hero-row">
        <div class="mood-mini">${h.mood
          ? `<button class="mood-set" data-act="moodReset">${esc(momName())} feels <span>${h.mood}</span></button>`
          : `<span class="mini-label">How's ${esc(momName())}?</span><div class="mood-dots">${MOODS.slice(0, 5).map(x => `<button data-act="mood" data-val="${x}" aria-label="Mood ${x}">${x}</button>`).join('')}</div>`}</div>
        <div class="water"><span class="mini-label">Water</span><div class="drops" role="group" aria-label="Water: ${fd.water} of 8 glasses">${[...Array(8)].map((_, i) => `<button class="drop ${i < fd.water ? 'on' : ''}" data-act="waterSet" data-n="${i + 1}" aria-label="${i + 1} glasses"></button>`).join('')}</div></div>
      </div>
    </section>`;
  }

  // Up next: one card at a time
  const queue = checkins().filter(c => !snoozed(c.key));
  if (queue.length) {
    const c = queue[0];
    out += `<section class="upnext"><div class="sec-h"><h2>Up next</h2>${queue.length > 1 ? `<span class="dots-count">${queue.slice(0, 6).map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}${queue.length > 6 ? '…' : ''}</span>` : ''}</div>
      <article class="ci ${c.kind || ''}" data-key="${c.key}"><div class="ci-icon" aria-hidden="true">${c.icon}</div><div class="ci-body"><p class="ci-title">${c.title}</p>${c.body}
      ${c.noLater ? '' : `<button class="later" data-act="later" data-key="${c.key}">Later</button>`}</div></article></section>`;
  } else {
    out += `<section class="upnext"><div class="calm"><span aria-hidden="true">🌿</span><div><b>All caught up</b><p>Nothing needs you right now. Enjoy the day.</p></div></div></section>`;
  }

  // This week carousel
  if (info) {
    const w = WEEKS[Math.min(42, Math.max(1, info.week))];
    out += `<section><div class="sec-h"><h2>This week</h2><a class="link" href="#week/${info.week}">Week ${info.week} →</a></div>
      <div class="carousel">
        <article class="slide s-baby"><span>👶 Baby</span><p>${esc(w[3])}</p></article>
        <article class="slide s-mom"><span>🤰 ${esc(momName())}</span><p>${esc(w[4])}</p></article>
        <article class="slide s-dad"><span>💡 For ${esc(dadName())}</span><p>${esc(w[5])}</p></article>
      </div></section>`;
  }

  // Coming up (built automatically)
  const upcoming = comingUp();
  if (upcoming.length) {
    out += `<section><div class="sec-h"><h2>Coming up</h2><a class="link" href="#visits">Visits →</a></div>
      <ol class="timeline">${upcoming.map(u => `<li class="${u.kind || ''}"><span class="t-dot" aria-hidden="true">${u.icon}</span><div><b>${u.title}</b><small>${u.sub}</small></div><span class="t-when">${u.when}</span></li>`).join('')}</ol></section>`;
  }

  // One small thing
  const tasks = dailyTasksFor(today);
  const doneIds = s.daily.log[today] || [];
  const open = tasks.filter(t => !doneIds.includes(t.id));
  if (open.length) {
    const t = open[new Date().getDate() % open.length];
    out += `<section class="small-thing"><div><span class="mini-label">One small thing today · ${whoLabel(t.who)}</span><p>${esc(t.text)}</p></div>
      <button class="round-check" data-act="dailyTap" data-id="${t.id}" aria-label="Mark done">✓</button></section>
      <p class="center"><a class="link" href="#tasks">${tasks.length - open.length}/${tasks.length} daily habits done · see all</a></p>`;
  }
  return out;
};

// Things coming up, derived from what's already known — no typing needed.
function comingUp() {
  const s = Store.state;
  const today = isoDate();
  const info = s.baby.born ? null : pregnancyInfo();
  const items = [];
  for (const a of s.appts.filter(a => !a.done && a.date >= today)) {
    items.push({ date: a.date, icon: '🩺', title: esc(a.title), sub: [a.time && fmtTime(a.time), a.place && esc(a.place)].filter(Boolean).join(' · ') || 'Appointment', when: relDay(a.date), kind: 'appt' });
  }
  if (info) {
    for (const t of TESTS.filter(t => !t.optional && !s.tests[t.id]?.done && !s.appts.some(a => a.testId === t.id))) {
      const start = dateForWeek(t.from), end = addDays(dateForWeek(t.to), 6);
      if (end < today) continue;
      items.push({ date: start < today ? today : start, icon: '🧪', title: esc(t.name), sub: `Book for weeks ${t.from}–${t.to}`, when: start <= today ? 'due now' : inDays(start), kind: start <= today ? 'due' : '' });
    }
    for (const [wk, icon, title] of [[14, '🌤', 'Second trimester begins'], [20, '🎉', 'Halfway there!'], [24, '💪', 'Viability milestone'], [28, '🌙', 'Third trimester begins'], [32, '🧳', 'Time to pack the hospital bags'], [37, '🌸', 'Full term'], [40, '👶', 'Due date']]) {
      const d = dateForWeek(wk);
      if (d > today) items.push({ date: d, icon, title, sub: `Week ${wk}`, when: inDays(d), kind: 'milestone' });
    }
  }
  for (const m of s.meds.filter(m => m.active)) {
    const left = medDaysLeft(m);
    if (left !== null && left < 21) items.push({ date: addDays(today, left), icon: '📦', title: `${esc(m.name)} runs out`, sub: `${m.stock} left`, when: left <= 0 ? 'now' : inDays(addDays(today, left)), kind: left <= (m.refillDays ?? 5) ? 'due' : '' });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
}

// Things that need a tap, most urgent first. Each has a stable key so "Later" can hide it for today.
function checkins() {
  const s = Store.state;
  const today = isoDate();
  const now = nowTime();
  const info = s.baby.born ? null : pregnancyInfo();
  const h = healthPeek(today) || {};
  const out = [];
  const add = (key, icon, title, body, extra = {}) => out.push({ key, icon, title, body, ...extra });

  const due = [];
  for (const m of s.meds.filter(m => m.active)) for (const slot of m.times) if (slot <= addMinutes(now, 45) && !medTaken(m.id, today, slot)) due.push({ m, slot });
  due.sort((a, b) => a.slot.localeCompare(b.slot));
  if (due.length === 1) {
    add('meds', '💊', `Did ${esc(momName())} take ${esc(due[0].m.name)}?`, `<p class="ci-sub">${fmtTime(due[0].slot)}${due[0].m.notes ? ' · ' + esc(due[0].m.notes) : ''}</p>
      <div class="ci-actions"><button class="btn" data-act="takeMed" data-id="${due[0].m.id}" data-slot="${due[0].slot}">Yes, taken</button></div>`, { kind: 'accent' });
  } else if (due.length > 1) {
    add('meds', '💊', `Did ${esc(momName())} take today's medicines?`, `<div class="pill-row">${due.map(({ m, slot }) => `<button class="pill-tog" data-act="takeMed" data-id="${m.id}" data-slot="${slot}">${esc(m.name)} <small>${fmtTime(slot)}</small></button>`).join('')}</div>
      <div class="ci-actions"><button class="btn" data-act="takeAll">Yes, all ${due.length}</button></div>`, { kind: 'accent' });
  }
  if (h.mood && !h.symptomsAsked) {
    add('symptoms', h.mood, 'Anything bothering her today?', `<div class="chips">${SYMPTOMS.slice(0, 10).map(x => `<button class="chip-btn ${h.symptoms?.includes(x) ? 'on' : ''}" data-act="symptom" data-val="${x}">${x}</button>`).join('')}</div>
      <div class="ci-actions"><button class="btn" data-act="symptomsDone">${h.symptoms?.length ? 'Done' : 'Nothing today 👍'}</button></div>`);
  }
  if (h.symptoms?.includes('Spotting')) add('bleed', '⚠️', 'Bleeding logged — call the doctor', `<div class="ci-actions">${tel(s.profile.doctorPhone) || '<a class="btn" href="#emergency">Emergency info</a>'}</div>`, { kind: 'danger', noLater: true });
  for (const a of s.appts.filter(a => !a.done && (a.date < today || (a.date === today && a.time && a.time < now))).slice(0, 2)) {
    add('went:' + a.id, '🩺', `How did “${esc(a.title)}” go?`, `<div class="ci-actions"><button class="btn" data-act="doneAppt" data-id="${a.id}">✓ Went fine</button><button class="btn ghost" data-act="openAppt" data-id="${a.id}">Add notes</button><button class="btn ghost" data-act="openExpense" data-note="${esc(a.title)}">Add cost</button></div>`);
  }
  for (const a of s.appts.filter(a => !a.done && a.date === addDays(today, 1))) {
    add('tmrw:' + a.id, '📅', `Tomorrow: ${esc(a.title)}`, `<p class="ci-sub">${a.time ? fmtTime(a.time) : ''}${a.place ? ' · ' + esc(a.place) : ''}${a.questions ? ` · ${a.questions.split('\n').length} question(s) ready` : ''}</p>
      <div class="ci-actions"><button class="btn ghost" data-act="addQuestion" data-id="${a.id}">+ Question for the doctor</button></div>`);
  }
  for (const m of s.meds.filter(m => m.active)) {
    const left = medDaysLeft(m);
    if (left !== null && left <= (m.refillDays ?? 5)) {
      add('refill:' + m.id, '📦', `${esc(m.name)} ${left <= 0 ? 'has run out' : `runs out in ~${left} day${left === 1 ? '' : 's'}`}`, `<p class="ci-sub">Bought more?</p>
        <div class="ci-actions">${[15, 30, 60].map(n => `<button class="btn ghost" data-act="refill" data-id="${m.id}" data-n="${n}">+${n}</button>`).join('')}</div>`);
    }
  }
  if (info) {
    for (const t of TESTS) {
      if (!t.optional && testStatus(t, info)[0] === 'due' && !s.appts.some(a => a.testId === t.id)) {
        add('test:' + t.id, '🧪', `Time to book the ${esc(t.name.replace(/\s*\(.*\)/, ''))}`, `<p class="ci-sub">Weeks ${t.from}–${t.to} · ${esc(t.detail)}</p>
          <div class="ci-actions"><button class="btn" data-act="bookTest" data-id="${t.id}">Book it</button><button class="btn ghost" data-act="testDone" data-id="${t.id}">Already done</button></div>`);
      }
    }
    const lw = lastWeight();
    if (!lw || daysBetween(lw.date, today) >= 7) {
      const v = lw ? Number(lw.weight) : 60;
      add('weigh', '⚖️', 'Weekly weigh-in', `<p class="ci-sub">${lw ? `Last: ${lw.weight} kg, ${relDay(lw.date).toLowerCase()}` : 'Optional — helps the doctor track growth'}</p>
        <div class="stepper"><button class="btn ghost" data-act="wstep" data-d="-0.1" aria-label="Decrease">−</button><input id="wval" type="number" step="0.1" inputmode="decimal" value="${v.toFixed(1)}" aria-label="Weight in kg"><button class="btn ghost" data-act="wstep" data-d="0.1" aria-label="Increase">+</button><button class="btn" data-act="saveWeight">Save</button></div>`);
    }
    if (info.week >= 28 && now >= '11:00' && !s.kicks.some(k => isoDate(new Date(k.start)) === today)) {
      add('kicks', '👣', 'Daily kick count', `<p class="ci-sub">Lie on her side and tap for each movement until 10.</p><div class="ci-actions"><button class="btn" data-act="goKicks">Start</button></div>`);
    }
  }
  const n = Device.state.notif;
  if (!n.asked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    add('notif', '🔔', 'Want gentle reminders?', `<p class="ci-sub">For medicines, visits and refills.</p><div class="ci-actions"><button class="btn" data-act="enableNotif">Turn on</button><button class="btn ghost" data-act="notifLater">No thanks</button></div>`, { noLater: true });
  }
  if (Sync.configured() && ['signedout', 'nohousehold'].includes(Sync.status) && !Device.state.shareAsked) {
    add('share', '👫', `Share with ${esc(momName())}`, `<p class="ci-sub">Both phones see the same things, live.</p><div class="ci-actions"><a class="btn" href="#account">Set up</a><button class="btn ghost" data-act="shareLater">Not now</button></div>`, { noLater: true });
  }
  return out;
}

// The ＋ button: everything you might add, as big tiles, plus "say it".
function sheetAdd() {
  const born = Store.state.baby.born;
  const tiles = [
    ['addFeeling', '💗', 'How she feels'], ['openExpense', '💰', 'Expense'], ['openAppt', '📅', 'Visit'], ['openMed', '💊', 'Medicine'],
    ['addWeight', '⚖️', 'Weight'], ['openBP', '🩺', 'BP & sugar'], ['goKicks', '👣', 'Kick count'], ['goContractions', '⏱', 'Contractions'],
    ['addTodo', '📝', 'To-do'], ...(born ? [['goBaby', '👶', 'Baby log']] : []),
  ];
  openSheet('Add', `<form data-form="quick" class="say" autocomplete="off">
      <input name="q" placeholder="Or just say it… “paid 800 for scan”" aria-label="Say it">
      ${Voice.supported() ? '<button type="button" class="mic" data-act="voice" aria-label="Speak">🎤</button>' : ''}<button type="submit" class="go" aria-label="Add">↵</button></form>
    <div class="add-grid">${tiles.map(([act, i, l]) => `<button data-act="${act}"><span>${i}</span>${l}</button>`).join('')}</div>`);
}

function sheetFeeling() {
  const h = healthPeek() || {};
  openSheet(`How is ${esc(momName())} today?`, `<div class="feel">
    <div class="mood-row">${MOODS.map(x => `<button class="mood-btn ${h.mood === x ? 'on' : ''}" data-act="mood" data-val="${x}" aria-label="Mood ${x}">${x}</button>`).join('')}</div>
    <p class="label">Anything bothering her?</p><div class="chips">${SYMPTOMS.map(x => `<button class="chip-btn ${h.symptoms?.includes(x) ? 'on' : ''}" data-act="symptom" data-val="${x}">${x}</button>`).join('')}</div>
    <p class="label">Sleep last night</p><div class="chips">${SLEEP_OPTIONS.map(([v, l]) => `<button class="chip-btn ${String(h.sleep) === v ? 'on' : ''}" data-act="sleep" data-val="${v}">${l}</button>`).join('')}</div>
    <button class="btn wide" data-act="closeSheet">Done</button></div>`);
}
function refreshFeeling() { if (sheetOpen() && document.querySelector('#sheet .feel')) sheetFeeling(); }

// ---------- setup wizard ----------
function wizard() {
  const p = Store.state.profile;
  const steps = [
    () => `<p class="big-emoji">🎉</p><h1>Congratulations!</h1><p>Nestling keeps track of meds, doctor visits, tests, food, money and the baby — and reminds you both. Setup takes under a minute.</p>
      <div class="stack"><button class="btn" data-act="wizNext">Get started</button>
      ${Sync.configured() ? '<a class="btn ghost" href="#account">My partner already set it up</a>' : ''}</div>`,
    () => `<h1>When is the baby due?</h1><form data-form="wizDue" class="form">
      <label>Due date<input type="date" name="dueDate" value="${esc(p.dueDate)}"></label>
      <details ${p.lmp && !p.dueDate ? 'open' : ''}><summary>Don't know it? Use the first day of her last period</summary><label>First day of last period<input type="date" name="lmp" value="${esc(p.lmp)}"></label></details>
      <button class="btn" type="submit">Next</button></form>`,
    () => `<h1>Your names</h1><p class="muted">So Nestling can talk to you properly. Optional.</p><form data-form="wizNames" class="form">
      <label>Mom-to-be<input name="momName" value="${esc(p.momName)}" autocomplete="off"></label>
      <label>Dad-to-be<input name="dadName" value="${esc(p.dadName)}" autocomplete="off"></label>
      <button class="btn" type="submit">Next</button><button class="btn ghost" type="button" data-act="wizNext">Skip</button></form>`,
    () => `<h1>What is ${esc(momName())} taking?</h1><p class="muted">Tap all that the doctor prescribed. You can fine-tune times later.</p>
      <form data-form="wizMeds" class="form"><div class="chips big">${MED_PRESETS.map((m, i) => `<label class="chip"><input type="checkbox" name="preset" value="${i}" ${Store.state.meds.some(x => x.name === m.name) ? 'checked disabled' : ''}><span>${esc(m.name)}</span></label>`).join('')}</div>
      <button class="btn" type="submit">Next</button><button class="btn ghost" type="button" data-act="wizNext">Skip</button></form>`,
    () => `<h1>Doctor & hospital</h1><p class="muted">For one-tap calls in an emergency. Optional.</p><form data-form="wizDoctor" class="form">
      <div class="grid2"><label>Doctor<input name="doctorName" value="${esc(p.doctorName)}"></label><label>Phone<input name="doctorPhone" type="tel" value="${esc(p.doctorPhone)}"></label></div>
      <div class="grid2"><label>Hospital<input name="hospital" value="${esc(p.hospital)}"></label><label>Phone<input name="hospitalPhone" type="tel" value="${esc(p.hospitalPhone)}"></label></div>
      <button class="btn" type="submit">Finish</button><button class="btn ghost" type="button" data-act="wizFinish">Skip</button></form>`,
  ];
  const i = Math.min(UI.step, steps.length - 1);
  return `<section class="wizard">${i > 0 ? `<div class="dots">${steps.map((_, j) => `<span class="${j <= i ? 'on' : ''}"></span>`).join('')}</div>` : ''}${steps[i]()}</section>`;
}

VIEWS.week = (arg) => {
  const info = pregnancyInfo();
  const wk = Math.min(42, Math.max(1, Number(arg) || (info ? info.week : 1) || 1));
  const w = WEEKS[wk];
  const tests = TESTS.filter(t => wk >= t.from && wk <= t.to && t.id !== 't_flu');
  return `<div class="week-nav">
      <a class="btn ghost small" href="#week/${Math.max(1, wk - 1)}" aria-label="Previous week">←</a>
      <h1>Week ${wk}</h1>
      <a class="btn ghost small" href="#week/${Math.min(42, wk + 1)}" aria-label="Next week">→</a>
    </div>
    ${info ? `<p class="center muted">${fmtDate(dateForWeek(wk))} – ${fmtDate(addDays(dateForWeek(wk), 6))}${info.week === wk ? ' · <b>this week</b>' : ''}</p>` : ''}
    <section class="hero small-hero"><p>${sizeLine(wk)}</p>${wk === 20 ? '<p class="small muted">From week 20, length is measured head to heel instead of head to bottom.</p>' : ''}</section>
    ${card('👶 Baby', `<p>${esc(w[3])}</p>`)}
    ${card('🤰 Her body', `<p>${esc(w[4])}</p>`)}
    ${card('🧔 For you', `<p>${esc(w[5])}</p>`)}
    ${tests.length ? card('🧪 Tests around now', `<ul class="list">${tests.map(t => `<li><b>${esc(t.name)}</b><br><span class="muted small">${esc(t.detail)}</span></li>`).join('')}</ul>`) : ''}
    <p class="disclaimer">Sizes are approximate averages. Every baby grows at their own pace — her doctor's scans are what count.</p>`;
};

// ---------- health ----------
VIEWS.health = () => {
  const tab = UI.healthTab;
  const body = { today: healthToday, history: healthHistory, kicks: kicksView, contractions: contractionsView }[tab] || healthToday;
  return `<h1>Health</h1>${segmented('healthTab', tab, [['today', 'Today'], ['history', 'Trends'], ['kicks', 'Kicks'], ['contractions', 'Contractions']])}${body()}`;
};

function healthToday() {
  const h = healthPeek() || {};
  const lw = lastWeight();
  const today = isoDate();
  return card(`${esc(momName())} today`, `
    <p class="label">Mood</p><div class="mood-row">${MOODS.map(x => `<button class="mood-btn ${h.mood === x ? 'on' : ''}" data-act="mood" data-val="${x}" aria-label="Mood ${x}">${x}</button>`).join('')}</div>
    <p class="label">Symptoms</p><div class="chips">${SYMPTOMS.map(x => `<button class="chip-btn ${h.symptoms?.includes(x) ? 'on' : ''}" data-act="symptom" data-val="${x}">${x}</button>`).join('')}</div>
    <p class="label">Sleep last night</p><div class="chips">${SLEEP_OPTIONS.map(([v, l]) => `<button class="chip-btn ${String(h.sleep) === v ? 'on' : ''}" data-act="sleep" data-val="${v}">${l}</button>`).join('')}</div>
    <p class="label">Weight (kg)</p>
    <div class="stepper"><button class="btn ghost" data-act="wstep" data-d="-0.1" aria-label="Decrease">−</button><input id="wval" type="number" step="0.1" inputmode="decimal" value="${h.weight || (lw ? lw.weight : '60.0')}" aria-label="Weight in kg"><button class="btn ghost" data-act="wstep" data-d="0.1" aria-label="Increase">+</button><button class="btn ${h.weight ? 'ghost' : ''}" data-act="saveWeight">${h.weight ? 'Update' : 'Save'}</button></div>
    <p class="label">Blood pressure & sugar</p>
    <div class="row"><span>${h.sys ? `BP <b>${h.sys}/${h.dia}</b>${bpHigh(h) ? ' ⚠️' : ''}` : '<span class="muted">No BP today</span>'}${h.sugar ? ` · Sugar <b>${h.sugar}</b>` : ''}</span><button class="btn small ghost" data-act="openBP">${h.sys ? 'Edit' : '+ Add'}</button></div>
    ${bpHigh(h) ? '<p class="warn">⚠️ BP of 140/90 or higher in pregnancy should be reported to the doctor promptly.</p>' : ''}
    <p class="label">Notes for the doctor</p>
    <textarea rows="2" data-change="healthNote" data-date="${today}" placeholder="Anything unusual? Saved automatically." aria-label="Notes for the doctor">${esc(h.notes || '')}</textarea>`);
}

function lineChart(points, { unit = '', label = '' } = {}) {
  if (points.length < 2) return empty('A chart appears after two entries.');
  const W = 320, H = 150, P = { l: 36, r: 12, t: 12, b: 24 };
  const xs = points.map(p => parseDate(p.x).getTime());
  const ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
  const sx = x => P.l + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = y => P.t + (1 - (y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const ticks = [y0, (y0 + y1) / 2, y1];
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${ticks.map(t => `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${sy(t)}" y2="${sy(t)}"/><text class="axis" x="${P.l - 6}" y="${sy(t) + 4}" text-anchor="end">${t.toFixed(0)}</text>`).join('')}
    <text class="axis" x="${P.l}" y="${H - 6}">${fmtDate(points[0].x, { day: 'numeric', month: 'short' })}</text>
    <text class="axis" x="${W - P.r}" y="${H - 6}" text-anchor="end">${fmtDate(points[points.length - 1].x, { day: 'numeric', month: 'short' })}</text>
    <path class="line" d="${path}"/>
    ${points.map((p, i) => `<g class="pt" tabindex="0" data-tip="${esc(fmtDate(p.x))}: ${p.y}${unit}"><circle class="hit" cx="${sx(xs[i])}" cy="${sy(p.y)}" r="14"/><circle class="dot" cx="${sx(xs[i])}" cy="${sy(p.y)}" r="4"/></g>`).join('')}
  </svg><div class="tip-box" hidden></div></figure>`;
}

function healthHistory() {
  const s = Store.state;
  const byDate = [...s.health].sort((a, b) => a.date.localeCompare(b.date));
  const wts = byDate.filter(e => e.weight).map(e => ({ x: e.date, y: Number(e.weight) }));
  const gain = wts.length > 1 ? (wts[wts.length - 1].y - wts[0].y).toFixed(1) : null;
  const recent = [...byDate].reverse().filter(e => e.mood || e.weight || e.sys || e.symptoms?.length || e.notes || e.sleep).slice(0, 30);
  return card('Weight', `${gain !== null ? `<p>Change since first entry: <b>${gain > 0 ? '+' : ''}${gain} kg</b></p>` : ''}${lineChart(wts, { unit: ' kg', label: 'Weight over time' })}
      <p class="small muted">Typical total gain for a normal starting BMI is about 11–16 kg, mostly in trimesters 2–3. Her doctor will set the right target.</p>`)
    + card('Daily log', recent.length ? `<ul class="list">${recent.map(e => `<li><div class="row"><b>${relDay(e.date)}</b><span>${e.mood || ''}<button class="icon-btn" data-act="delHealth" data-id="${e.id}" aria-label="Delete entry">✕</button></span></div>
        <div class="small">${[e.weight && `${e.weight} kg`, e.sys && `BP ${e.sys}/${e.dia}${bpHigh(e) ? ' ⚠️' : ''}`, e.sugar && `Sugar ${e.sugar}`, e.sleep && `Sleep ~${e.sleep}h`].filter(Boolean).join(' · ')}</div>
        ${e.symptoms?.length ? `<div class="chips">${e.symptoms.map(x => pill(x)).join('')}</div>` : ''}
        ${e.notes ? `<p class="small muted">${esc(e.notes)}</p>` : ''}</li>`).join('')}</ul>` : empty('Check-ins from the home screen show up here.'));
}

function kicksView() {
  const s = Store.state;
  const k = UI.kick;
  const live = k ? `<div class="counter"><p class="muted">Session running · <span data-timer="${k.start}"></span></p>
      <button class="kick-btn" data-act="kick">👣<span>${k.count}</span><small>Tap for each movement</small></button>
      <button class="btn ghost" data-act="kickStop">Finish session</button>${k.count >= 10 ? '<p class="ok">✓ 10 movements reached — great!</p>' : ''}</div>`
    : `<div class="counter"><button class="btn" data-act="kickStart">Start kick count</button></div>`;
  const hist = [...s.kicks].reverse().slice(0, 15);
  return card('Kick counter', `<p class="small">From week 28, pick a time baby is usually active, lie on her side and count movements (kicks, rolls, flutters). Most babies reach <b>10 movements within 2 hours</b>, often much sooner.</p>${live}
    <p class="warn">If movements are clearly fewer or weaker than usual, call the doctor or hospital the same day — don't wait.</p>`)
    + card('Past sessions', hist.length ? `<ul class="list">${hist.map(x => `<li class="row"><span>${new Date(x.start).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span><b>${x.count}</b> in ${fmtDuration(x.end - x.start)}</span></li>`).join('')}</ul>` : empty('No sessions yet.'));
}

function contractionsView() {
  const s = Store.state;
  const c = UI.contraction;
  const recent = [...s.contractions].reverse().slice(0, 12);
  const rows = recent.map((x, i) => {
    const prev = recent[i + 1];
    return `<tr><td>${new Date(x.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</td><td>${fmtDuration(x.end - x.start)}</td><td>${prev ? fmtDuration(x.start - prev.start) : '—'}</td></tr>`;
  }).join('');
  const lastHour = s.contractions.filter(x => Date.now() - x.start < 3600000);
  let summary = '';
  if (lastHour.length >= 3) {
    const avgDur = lastHour.reduce((a, x) => a + (x.end - x.start), 0) / lastHour.length;
    const gaps = lastHour.slice(1).map((x, i) => x.start - lastHour[i].start);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    summary = `<p>Last hour: <b>${lastHour.length}</b> contractions, lasting ~<b>${fmtDuration(avgDur)}</b>, every ~<b>${fmtDuration(avgGap)}</b>.</p>`;
    if (avgGap <= 5.5 * 60000 && avgDur >= 45000) summary += `<p class="warn">These look regular and close together. Call the hospital / doctor now.</p>`;
  }
  return card('Contraction timer', `
    <div class="counter">${c
      ? `<p class="muted">Contraction in progress · <span data-timer="${c.start}"></span></p><button class="kick-btn stop" data-act="contrStop">⏹<small>Tap when it ends</small></button>`
      : `<button class="kick-btn" data-act="contrStart">▶<small>Tap when a contraction starts</small></button>`}</div>
    ${summary}
    <p class="small">A common rule of thumb is <b>5-1-1</b>: contractions every 5 minutes, lasting 1 minute, for 1 hour. Follow what her doctor told you — and go in immediately if her water breaks, there is bleeding, or baby moves less.</p>
    ${rows ? `<table class="table"><thead><tr><th>Start</th><th>Length</th><th>Since last</th></tr></thead><tbody>${rows}</tbody></table>
      <button class="btn ghost small" data-act="contrClear">Clear history</button>` : ''}`);
}

function sheetBP() {
  const h = healthPeek() || {};
  openSheet('Blood pressure & sugar', `<form data-form="bp" class="form">
    <div class="grid2"><label>Top number<input type="number" name="sys" inputmode="numeric" value="${esc(h.sys || '')}" placeholder="120" autofocus></label>
    <label>Bottom number<input type="number" name="dia" inputmode="numeric" value="${esc(h.dia || '')}" placeholder="80"></label></div>
    <label>Blood sugar (mg/dL, optional)<input type="number" name="sugar" inputmode="numeric" value="${esc(h.sugar || '')}"></label>
    <button class="btn" type="submit">Save</button></form>`);
}

// ---------- medicines ----------
VIEWS.meds = () => {
  const s = Store.state;
  const today = isoDate();
  const list = s.meds.length ? s.meds.map(m => {
    const left = medDaysLeft(m);
    const low = left !== null && left <= (m.refillDays ?? 5);
    const last7 = [...Array(7)].map((_, i) => addDays(today, -i));
    const due = m.times.length * 7, taken = s.medLog.filter(l => l.medId === m.id && last7.includes(l.date)).length;
    return `<article class="med ${m.active ? '' : 'inactive'}">
      <div class="row"><div><b>${esc(m.name)}</b> <span class="muted">${esc(m.dose || '')}</span></div>${low ? pill(left <= 0 ? 'Out of stock' : `${left} days left`, 'danger') : m.active ? '' : pill('Paused')}</div>
      ${m.notes ? `<p class="small muted">${esc(m.notes)}</p>` : ''}
      <div class="med-slots">${m.times.map(slot => { const t = medTaken(m.id, today, slot); return `<button class="slot ${t ? 'on' : ''}" data-act="takeMed" data-id="${m.id}" data-slot="${slot}" aria-pressed="${t}">${t ? '✓' : '○'} ${fmtTime(slot)}</button>`; }).join('')}</div>
      <div class="row small"><span>${m.stock === '' ? '<span class="muted">Stock not tracked</span>' : `<b>${m.stock}</b> ${esc(m.unit)}(s) left${left !== null ? ` · ~${left} days` : ''}`}</span><span>This week: ${taken}/${due}</span></div>
      <div class="btn-row">
        <button class="btn small ghost" data-act="refill" data-id="${m.id}" data-n="30">+30 stock</button>
        <button class="btn small ghost" data-act="openMed" data-id="${m.id}">Edit</button>
        <button class="btn small ghost" data-act="toggleMed" data-id="${m.id}">${m.active ? 'Pause' : 'Resume'}</button>
        <button class="btn small ghost danger" data-act="delMed" data-id="${m.id}">Delete</button>
      </div></article>`;
  }).join('') : empty('Nothing yet. Tap “Add medicine” and pick from the common ones.');
  return `<div class="page-h"><h1>Medicines</h1><button class="btn" data-act="openMed">+ Add medicine</button></div>
    ${card('', list)}
    <p class="disclaimer">Tapping a time marks it taken and reduces the stock. Never start or stop medicines without asking the doctor.</p>`;
};

function sheetMed(id) {
  const s = Store.state;
  const m = id ? s.meds.find(x => x.id === id) : { name: '', dose: '', times: ['09:00'], perDose: 1, stock: '', unit: 'tablet', refillDays: 5, notes: '' };
  const presetTimes = TIME_SLOTS.map(([t]) => t);
  const other = m.times.find(t => !presetTimes.includes(t)) || '';
  openSheet(id ? 'Edit medicine' : 'Add medicine', `<form data-form="med" class="form" data-id="${id || ''}">
    ${id ? '' : `<p class="label">Common ones — tap to fill</p><div class="chips">${MED_PRESETS.map((p, i) => `<button type="button" class="chip-btn" data-act="medPreset" data-i="${i}">${esc(p.name)}</button>`).join('')}</div>`}
    <label>Name<input name="name" required value="${esc(m.name)}" placeholder="e.g. Folic acid"></label>
    <p class="label">When?</p>
    <div class="chips">${TIME_SLOTS.map(([t, l]) => `<label class="chip"><input type="checkbox" name="slot" value="${t}" ${m.times.includes(t) ? 'checked' : ''}><span>${l} <small>${fmtTime(t)}</small></span></label>`).join('')}</div>
    <label>Other time (optional)<input type="time" name="time" value="${esc(other)}"></label>
    <p class="label">How many in the strip/bottle? <span class="muted">(for refill alerts)</span></p>
    ${chipBtns('stock', [['', 'Skip'], [10, '10'], [15, '15'], [30, '30'], [60, '60']], m.stock)}
    <input type="number" name="stock" min="0" step="0.5" value="${esc(m.stock)}" placeholder="or type a number" aria-label="Stock count" inputmode="numeric">
    <details><summary>More options</summary>
      <div class="form">
        <div class="grid2"><label>Dose / strength<input name="dose" value="${esc(m.dose)}" placeholder="e.g. 5 mg"></label><label>Per dose<input type="number" name="perDose" min="0.5" step="0.5" value="${esc(m.perDose)}"></label></div>
        <div class="grid2"><label>Unit<input name="unit" value="${esc(m.unit)}"></label><label>Warn when ≤ days left<input type="number" name="refillDays" min="0" value="${esc(m.refillDays)}"></label></div>
        <label>Notes<input name="notes" value="${esc(m.notes)}" placeholder="e.g. after food, not with tea"></label>
      </div>
    </details>
    <button class="btn" type="submit">${id ? 'Save' : 'Add'}</button></form>`);
}

// ---------- visits & tests ----------
VIEWS.visits = () => {
  const s = Store.state;
  const info = pregnancyInfo();
  const today = isoDate();
  const upcoming = s.appts.filter(x => !x.done).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const past = s.appts.filter(x => x.done).sort((x, y) => y.date.localeCompare(x.date));
  const apptItem = x => `<li><div class="row"><div><b>${esc(x.title)}</b><br><span class="small muted">${relDay(x.date)}${x.time ? ' · ' + fmtTime(x.time) : ''}${x.place ? ' · ' + esc(x.place) : ''}</span></div>
      ${!x.done && x.date < today ? pill('Past date', 'danger') : ''}</div>
      ${x.questions ? `<p class="small">❓ ${esc(x.questions).replace(/\n/g, '<br>❓ ')}</p>` : ''}${x.notes ? `<p class="small muted">📝 ${esc(x.notes)}</p>` : ''}
      <div class="btn-row">${x.done ? '' : `<button class="btn small" data-act="doneAppt" data-id="${x.id}">✓ Done</button><button class="btn small ghost" data-act="addQuestion" data-id="${x.id}">+ Question</button>`}
      <button class="btn small ghost" data-act="openAppt" data-id="${x.id}">Edit</button><button class="btn small ghost danger" data-act="delAppt" data-id="${x.id}">Delete</button></div></li>`;

  const tests = TESTS.map(t => {
    const [kind, label] = testStatus(t, info);
    const st = s.tests[t.id] || {};
    const booked = s.appts.find(a => a.testId === t.id && !a.done);
    return `<li class="test ${kind}"><div class="row"><div><b>${esc(t.name)}</b><br><span class="small muted">Weeks ${t.from}${t.to !== t.from ? '–' + t.to : ''}${booked ? ` · booked ${relDay(booked.date).toLowerCase()}` : ''}</span></div>${pill(label, kind)}</div>
      <details><summary class="small">Details${st.result ? ' & result' : ''}</summary><p class="small">${esc(t.detail)}</p>
        ${st.done ? `<textarea rows="2" data-change="testResult" data-id="${t.id}" placeholder="Result / what the doctor said — saved automatically" aria-label="Result">${esc(st.result || '')}</textarea>` : ''}
        <div class="btn-row">${st.done ? `<button class="btn small ghost" data-act="testUndo" data-id="${t.id}">Mark not done</button>`
          : `${booked ? '' : `<button class="btn small" data-act="bookTest" data-id="${t.id}">Book</button>`}<button class="btn small ghost" data-act="testDone" data-id="${t.id}">Mark done</button>`}</div></details></li>`;
  }).join('');

  return `<div class="page-h"><h1>Doctor & tests</h1><button class="btn" data-act="openAppt">+ Add visit</button></div>
    ${card('Upcoming', upcoming.length ? `<ul class="list">${upcoming.map(apptItem).join('')}</ul>` : empty('No upcoming visits.'))}
    ${card('Recommended tests & scans', `<p class="small muted">${esc(VISIT_CADENCE)}</p><ul class="list">${tests}</ul>`)}
    ${past.length ? card('Past visits', `<ul class="list">${past.map(apptItem).join('')}</ul>`) : ''}
    <p class="disclaimer">Test schedules vary by country, hospital and her health. Treat this as a checklist to discuss with the doctor.</p>`;
};

function sheetAppt(id, prefill = {}) {
  const s = Store.state;
  const today = isoDate();
  const a = id ? s.appts.find(x => x.id === id) : { date: '', time: '', title: '', doctor: s.profile.doctorName, place: s.profile.hospital, notes: '', questions: '', testId: '', ...prefill };
  openSheet(id ? 'Edit visit' : 'New visit', `<form data-form="appt" class="form" data-id="${id || ''}">
    <input type="hidden" name="testId" value="${esc(a.testId || '')}">
    ${id || a.title ? '' : chipBtns('title', APPT_KINDS.map(([k, i]) => [k, `${i} ${k}`]))}
    <label>What<input name="title" required value="${esc(a.title)}" placeholder="e.g. Monthly check-up"></label>
    <p class="label">When?</p>
    ${chipBtns('date', [[today, 'Today'], [addDays(today, 1), 'Tomorrow'], [addDays(today, 7), 'In 1 week'], [addDays(today, 14), 'In 2 weeks'], [addDays(today, 28), 'In 4 weeks']], a.date)}
    <input type="date" name="date" required value="${esc(a.date)}" aria-label="Date">
    ${chipBtns('time', [['09:00', fmtTime('09:00')], ['11:00', fmtTime('11:00')], ['16:00', fmtTime('16:00')], ['18:00', fmtTime('18:00')]], a.time)}
    <input type="time" name="time" value="${esc(a.time)}" aria-label="Time">
    <label>Questions to ask the doctor<textarea name="questions" rows="2" placeholder="One per line">${esc(a.questions)}</textarea></label>
    <details ${id ? 'open' : ''}><summary>Place, doctor & notes</summary><div class="form">
      <div class="grid2"><label>Doctor<input name="doctor" value="${esc(a.doctor)}"></label><label>Place<input name="place" value="${esc(a.place)}"></label></div>
      <label>What the doctor said<textarea name="notes" rows="2">${esc(a.notes)}</textarea></label></div></details>
    <button class="btn" type="submit">Save</button></form>`);
}

// ---------- food ----------
VIEWS.food = () => {
  const fd = foodPeek();
  const info = pregnancyInfo();
  const extra = !info ? '' : info.trimester === 1 ? 'no extra calories needed yet' : info.trimester === 2 ? 'about 340 extra calories a day' : 'about 450 extra calories a day';
  return `<h1>Food & nutrition</h1>
    ${card('Today', `
      <div class="row"><span>💧 Water: <b>${fd.water}</b> / 8 glasses</span><span class="btn-row"><button class="btn small ghost" data-act="water" data-d="-1" aria-label="Remove a glass">−</button><button class="btn small" data-act="water" data-d="1">+ Glass</button></span></div>
      ${progressBar(Math.min(100, Math.round(fd.water * 12.5)), 'Water')}
      <p class="label">Tap what she's had today</p>
      <div class="chips">${FOOD_CHECKS.map(([id, label]) => `<button class="chip-btn ${fd.checks.includes(id) ? 'on' : ''}" data-act="foodCheck" data-id="${id}">${esc(label)}</button>`).join('')}</div>
      <p class="label">Meals (optional)</p>
      <textarea rows="2" data-change="meals" placeholder="Saved automatically" aria-label="Meals">${esc(fd.meals)}</textarea>
      ${extra ? `<p class="small muted">Trimester ${info.trimester}: ${extra}.</p>` : ''}`)}
    ${card('✅ Good to eat', `<ul class="list">${FOOD_EAT.map(([f, w]) => `<li><b>${esc(f)}</b><br><span class="small muted">${esc(w)}</span></li>`).join('')}</ul>`)}
    ${card('⛔ Avoid or limit', `<ul class="list">${FOOD_AVOID.map(([f, w]) => `<li><b>${esc(f)}</b><br><span class="small muted">${esc(w)}</span></li>`).join('')}</ul>`)}
    ${card('Key nutrients', `<table class="table"><thead><tr><th>Nutrient</th><th>Daily target</th></tr></thead><tbody>${NUTRIENTS.map(([n, a, w]) => `<tr><td><b>${esc(n)}</b><br><span class="small muted">${esc(w)}</span></td><td>${esc(a)}</td></tr>`).join('')}</tbody></table>`)}
    ${card('Morning sickness tips', `<ul class="bullets"><li>Small meals every 2–3 hours; don't let the stomach go empty.</li><li>Dry crackers or toast before getting out of bed.</li><li>Ginger (tea, candies) and cold foods can help.</li><li>Sip fluids between meals rather than with them.</li><li>Call the doctor if she can't keep any fluids down for a day.</li></ul>`)}
    <p class="disclaimer">General guidance for healthy pregnancies. Conditions like gestational diabetes or anaemia need a plan from her doctor or a dietitian.</p>`;
};

// ---------- daily tasks & to-dos ----------
VIEWS.tasks = () => {
  const s = Store.state;
  const today = isoDate();
  const done = s.daily.log[today] || [];
  const tasks = dailyTasksFor(today).filter(t => UI.who === 'all' || t.who === UI.who || t.who === 'both');
  let streak = 0;
  for (let i = 1; i < 365; i++) {
    const d = addDays(today, -i);
    const list = dailyTasksFor(d);
    const got = (s.daily.log[d] || []).filter(id => list.some(t => t.id === id)).length;
    if (list.length && got >= Math.ceil(list.length / 2)) streak++; else break;
  }
  const todos = [...s.todos].sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return `<h1>Tasks</h1>
    ${segmented('who', UI.who, [['all', 'Everyone'], ['mom', esc(momName())], ['dad', esc(dadName())]])}
    ${card('Every day', `<ul class="checks">${tasks.map(t => `<li class="row ${done.includes(t.id) ? 'is-done' : ''}"><label class="check"><input type="checkbox" data-act="daily" data-id="${t.id}" ${done.includes(t.id) ? 'checked' : ''}> ${esc(t.text)}</label>
      <span>${pill(whoLabel(t.who))}<button class="icon-btn" data-act="hideTask" data-id="${t.id}" aria-label="Remove task">✕</button></span></li>`).join('')}</ul>
      ${streak ? `<p class="ok">🔥 ${streak}-day streak (at least half done)</p>` : ''}
      <details><summary>+ Add your own habit</summary><form data-form="dailyTask" class="form inline"><input name="text" required placeholder="e.g. Evening walk together" aria-label="New daily task">
        <select name="who" aria-label="For whom"><option value="both">Both</option><option value="mom">${esc(momName())}</option><option value="dad">${esc(dadName())}</option></select><button class="btn small" type="submit">Add</button></form></details>
      ${s.daily.hidden.length ? `<button class="btn small ghost" data-act="restoreTasks">Restore ${s.daily.hidden.length} removed</button>` : ''}`)}
    ${card('To-dos', `<form data-form="todo" class="form inline"><input name="text" required placeholder="e.g. Buy car seat by next week" aria-label="New to-do"><button class="btn small" type="submit">Add</button></form>
      ${todos.length ? `<ul class="checks">${todos.map(t => `<li class="row ${t.done ? 'is-done' : ''}"><label class="check"><input type="checkbox" data-act="todo" data-id="${t.id}" ${t.done ? 'checked' : ''}> ${esc(t.text)}</label>
        <span>${t.due ? pill(relDay(t.due), !t.done && t.due < today ? 'danger' : '') : ''}<button class="icon-btn" data-act="delTodo" data-id="${t.id}" aria-label="Delete">✕</button></span></li>`).join('')}</ul>` : empty('Nothing here yet. Tip: dates like “tomorrow” or “next week” are understood.')}`)}`;
};

// ---------- money ----------
VIEWS.money = () => {
  const s = Store.state;
  const mo = s.money;
  const spent = mo.expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const plannedLeft = mo.planned.filter(p => !p.bought).reduce((a, p) => a + Number(p.estimate || 0), 0);
  const claimable = mo.expenses.filter(e => e.claimable && !e.claimed).reduce((a, e) => a + Number(e.amount || 0), 0);
  const byCat = EXPENSE_CATEGORIES.map(c => [c, mo.expenses.filter(e => e.category === c).reduce((a, e) => a + Number(e.amount || 0), 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...byCat.map(([, v]) => v));
  const exps = [...mo.expenses].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="page-h"><h1>Money</h1><button class="btn" data-act="openExpense">+ Expense</button></div>
    <div class="stats">
      <div class="stat"><span>Spent</span><b>${fmtMoney(spent)}</b></div>
      <div class="stat"><span>Budget left</span><b class="${mo.budget && spent > mo.budget ? 'neg' : ''}">${mo.budget ? fmtMoney(mo.budget - spent) : '—'}</b></div>
      <div class="stat"><span>Still to buy</span><b>${fmtMoney(plannedLeft)}</b></div>
      <div class="stat"><span>To claim</span><b>${fmtMoney(claimable)}</b></div>
    </div>
    ${card('Budget', `<form data-form="budget" class="form inline"><input type="number" name="budget" min="0" value="${esc(mo.budget || '')}" placeholder="Total pregnancy budget" aria-label="Total budget" inputmode="numeric"><button class="btn small" type="submit">Set</button></form>
      ${mo.budget ? progressBar(Math.min(100, Math.round(spent / mo.budget * 100)), 'Budget used') + `<p class="small muted">${Math.round(spent / mo.budget * 100)}% used</p>` : ''}`)}
    ${byCat.length ? card('Where it went', `<ul class="hbars">${byCat.map(([c, v]) => `<li title="${esc(c)}: ${fmtMoney(v)}"><span class="lbl">${CATEGORY_ICONS[c] || ''} ${esc(c)}</span><span class="track"><span style="width:${(v / max * 100).toFixed(1)}%"></span></span><span class="val">${fmtMoney(v)}</span></li>`).join('')}</ul>`) : ''}
    ${card('Planned purchases', `<ul class="checks">${mo.planned.map(p => `<li class="row ${p.bought ? 'is-done' : ''}"><label class="check"><input type="checkbox" data-act="bought" data-id="${p.id}" ${p.bought ? 'checked' : ''}> ${esc(p.name)}</label>
        <span><input class="mini" type="number" min="0" inputmode="numeric" value="${esc(p.estimate || '')}" placeholder="Est." data-change="estimate" data-id="${p.id}" aria-label="Estimate for ${esc(p.name)}"><button class="icon-btn" data-act="delPlanned" data-id="${p.id}" aria-label="Delete">✕</button></span></li>`).join('')}</ul>
      <form data-form="planned" class="form inline"><input name="name" required placeholder="Add item" aria-label="Item"><input type="number" name="estimate" min="0" placeholder="Estimate" aria-label="Estimate" inputmode="numeric"><button class="btn small" type="submit">Add</button></form>`)}
    ${card('Expenses', exps.length ? `<ul class="list">${exps.map(e => `<li><div class="row"><div>${CATEGORY_ICONS[e.category] || ''} <b>${fmtMoney(e.amount)}</b> · ${esc(e.category)}<br><span class="small muted">${relDay(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</span></div>
        <span>${e.claimable ? `<button class="btn small ${e.claimed ? 'ghost' : ''}" data-act="claimed" data-id="${e.id}">${e.claimed ? '✓ Claimed' : 'Claim'}</button>` : ''}<button class="icon-btn" data-act="delExpense" data-id="${e.id}" aria-label="Delete">✕</button></span></div></li>`).join('')}</ul>` : empty('No expenses yet. Keep every bill — you\'ll need them for insurance and taxes.'))}`;
};

function sheetExpense(prefill = {}) {
  const guess = prefill.note ? (CATEGORY_WORDS.find(([, re]) => re.test(prefill.note.toLowerCase())) || ['Doctor visits'])[0] : '';
  const cat = prefill.category || guess || 'Doctor visits';
  openSheet('Add expense', `<form data-form="expense" class="form">
    <label>Amount (${esc(Store.state.profile.currency)})<input class="big-input" type="number" name="amount" min="0" step="any" required inputmode="decimal" autofocus></label>
    <div class="cat-grid">${EXPENSE_CATEGORIES.map(c => `<label class="cat"><input type="radio" name="category" value="${esc(c)}" ${c === cat ? 'checked' : ''} data-change="expCat"><span><i>${CATEGORY_ICONS[c]}</i>${esc(c)}</span></label>`).join('')}</div>
    <label>Note (optional)<input name="note" value="${esc(prefill.note || '')}" placeholder="e.g. NT scan"></label>
    <label class="check"><input type="checkbox" name="claimable" ${CLAIMABLE_CATEGORIES.includes(cat) ? 'checked' : ''}> Claimable from insurance</label>
    <details><summary>Different date?</summary><input type="date" name="date" value="${isoDate()}" aria-label="Date"></details>
    <button class="btn" type="submit">Add</button></form>`);
}

// ---------- library ----------
VIEWS.library = () => {
  const s = Store.state;
  const items = [...LIBRARY, ...s.library.custom].filter(b => UI.libFilter === 'all' || b.for === UI.libFilter || b.for === 'both');
  const states = { '': '+ My list', want: '📌 Want to', reading: '📖 In progress', done: '✓ Finished' };
  const counts = { reading: 0, done: 0 };
  Object.values(s.library.status).forEach(v => { if (counts[v.state] !== undefined) counts[v.state]++; });
  return `<h1>Read & listen</h1>
    <p class="muted">${counts.reading} in progress · ${counts.done} finished. Most of these have audiobook versions — great for commutes.</p>
    ${segmented('libFilter', UI.libFilter, [['all', 'All'], ['mom', 'For ' + esc(momName())], ['dad', 'For ' + esc(dadName())]])}
    ${card('', `<ul class="list">${items.map(b => {
      const st = s.library.status[b.id] || { state: '', progress: 0 };
      return `<li><div class="row"><div><b>${esc(b.title)}</b> <span class="muted small">${b.type === 'podcast' ? '🎧' : '📘'} ${esc(b.by || '')}</span></div>${pill(whoLabel(b.for))}</div>
        ${b.why ? `<p class="small">${esc(b.why)} <span class="muted">· ${esc(b.when || '')}</span></p>` : ''}
        <div class="row"><button class="btn small ${st.state ? '' : 'ghost'}" data-act="libState" data-id="${b.id}">${states[st.state]}</button>
        ${st.state === 'reading' ? `<label class="small range">Progress <input type="range" min="0" max="100" step="5" value="${st.progress || 0}" data-change="libProgress" data-id="${b.id}"> ${st.progress || 0}%</label>` : ''}
        ${b.custom ? `<button class="icon-btn" data-act="delBook" data-id="${b.id}" aria-label="Delete">✕</button>` : ''}</div></li>`;
    }).join('')}</ul>`)}
    ${card('', `<details><summary>+ Add a book or podcast</summary><form data-form="book" class="form"><div class="grid2"><label>Title<input name="title" required></label><label>Author / host<input name="by"></label></div>
      <div class="grid2"><label>Type<select name="type"><option value="book">Book</option><option value="podcast">Podcast / audio</option></select></label>
      <label>For<select name="for"><option value="both">Both</option><option value="mom">${esc(momName())}</option><option value="dad">${esc(dadName())}</option></select></label></div>
      <button class="btn" type="submit">Add</button></form></details>`)}`;
};

// ---------- checklists ----------
VIEWS.lists = () => {
  const s = Store.state;
  const info = pregnancyInfo();
  const wk = info ? info.week : 40;
  return `<h1>Checklists</h1>${CHECKLISTS.map(l => {
    const items = [...l.items, ...(s.checklists.custom[l.id] || [])];
    const done = s.checklists.done[l.id] || [];
    const n = items.filter(i => done.includes(i)).length;
    const soon = wk < l.minWeek;
    const open = UI.openLists[l.id] ?? (!soon && n < items.length);
    return `<details class="card list-card" data-list="${l.id}" ${open ? 'open' : ''}><summary><div class="row"><h2>${esc(l.title)}</h2><span class="small muted">${n}/${items.length}</span></div>
      ${progressBar(Math.round(n / items.length * 100), l.title)}${soon ? `<p class="small muted">Best started around week ${l.minWeek}</p>` : ''}</summary>
      <ul class="checks">${items.map(i => `<li class="${done.includes(i) ? 'is-done' : ''}"><label class="check"><input type="checkbox" data-act="listItem" data-list="${l.id}" data-item="${esc(i)}" ${done.includes(i) ? 'checked' : ''}> ${esc(i)}</label></li>`).join('')}</ul>
      <form data-form="listItem" data-list="${l.id}" class="form inline"><input name="text" required placeholder="Add item" aria-label="Add item to ${esc(l.title)}"><button class="btn small" type="submit">Add</button></form></details>`;
  }).join('')}`;
};

// ---------- baby ----------
VIEWS.baby = () => {
  const b = Store.state.baby;
  if (!b.born) {
    return `<h1>Baby</h1>${card('When baby arrives', `<p>Switch on the baby tracker to log feeds, diapers, sleep and growth with one tap.</p>
      <form data-form="born" class="form"><div class="grid2"><label>Baby's name<input name="name" value="${esc(b.name)}"></label><label>Date of birth<input type="date" name="dob" required value="${isoDate()}"></label></div>
      <button class="btn" type="submit">Baby is here! 🎉</button></form>`)}
      ${card('Name ideas', `<form data-form="babyName" class="form inline"><input name="name" value="${esc(b.name)}" placeholder="Shortlisted name" aria-label="Name"><button class="btn small" type="submit">Save</button></form>`)}`;
  }
  const today = isoDate();
  const todays = b.logs.filter(l => isoDate(new Date(l.at)) === today);
  const count = t => todays.filter(l => l.type === t).length;
  const lastFeed = [...b.logs].reverse().find(l => l.type.startsWith('feed'));
  const sleeping = b.logs.find(l => l.type === 'sleep' && !l.end);
  const ageDays = daysBetween(b.dob, today);
  return `<h1>${esc(b.name || 'Baby')}</h1><p class="muted">${ageDays} days old · born ${fmtDate(b.dob)}</p>
    <div class="stats">
      <div class="stat"><span>Feeds today</span><b>${todays.filter(l => l.type.startsWith('feed')).length}</b></div>
      <div class="stat"><span>Wet</span><b>${count('wet')}</b></div>
      <div class="stat"><span>Dirty</span><b>${count('dirty')}</b></div>
      <div class="stat"><span>Last feed</span><b>${lastFeed ? fmtDuration(Date.now() - lastFeed.at).replace(/\s\d+s$/, '') + ' ago' : '—'}</b></div>
    </div>
    ${card('Quick log', `<div class="quick">
      <button data-act="babyLog" data-type="feedL">🤱 Left</button><button data-act="babyLog" data-type="feedR">🤱 Right</button><button data-act="babyLog" data-type="feedB">🍼 Bottle</button>
      <button data-act="babyLog" data-type="wet">💧 Wet</button><button data-act="babyLog" data-type="dirty">💩 Dirty</button>
      <button data-act="babySleep" class="${sleeping ? 'on' : ''}">${sleeping ? '☀️ Woke up' : '😴 Sleep'}</button></div>
      <p class="small muted">Newborns usually feed 8–12 times a day and have 6+ wet diapers a day after day 5. Call the paediatrician for fever ≥ 38°C, poor feeding, fewer wet diapers or yellowing skin.</p>`)}
    ${card('Today', todays.length ? `<ul class="list">${[...todays].reverse().map(l => `<li class="row"><span>${new Date(l.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ${{ feedL: 'Breast (left)', feedR: 'Breast (right)', feedB: 'Bottle', wet: 'Wet diaper', dirty: 'Dirty diaper', sleep: 'Sleep' }[l.type]}${l.type === 'sleep' && l.end ? ' · ' + fmtDuration(l.end - l.at) : ''}</span><button class="icon-btn" data-act="delBabyLog" data-id="${l.id}" aria-label="Delete">✕</button></li>`).join('')}</ul>` : empty('Nothing logged today.'))}
    ${card('Growth', `<form data-form="growth" class="form"><div class="grid3"><label>Date<input type="date" name="date" value="${today}"></label><label>Weight (kg)<input type="number" step="0.01" name="weight" inputmode="decimal"></label><label>Length (cm)<input type="number" step="0.1" name="length" inputmode="decimal"></label></div>
      <label>Head (cm)<input type="number" step="0.1" name="head" inputmode="decimal"></label><button class="btn" type="submit">Add measurement</button></form>
      ${lineChart([...b.growth].filter(g => g.weight).sort((x, y) => x.date.localeCompare(y.date)).map(g => ({ x: g.date, y: Number(g.weight) })), { unit: ' kg', label: 'Baby weight' })}
      <p class="small muted">Ask the paediatrician to plot these on WHO growth charts at each visit. Add vaccination dates as visits so you both get reminders.</p>`)}`;
};

// ---------- emergency ----------
VIEWS.emergency = () => {
  const p = Store.state.profile;
  const info = pregnancyInfo();
  return `<h1>🚨 Emergency</h1>
    ${card('Call now', `<ul class="list">
      <li class="row"><span>Doctor ${esc(p.doctorName)}</span>${tel(p.doctorPhone) || '<a href="#settings" class="small">Add number</a>'}</li>
      <li class="row"><span>Hospital ${esc(p.hospital)}</span>${tel(p.hospitalPhone) || '<a href="#settings" class="small">Add number</a>'}</li>
      <li class="row"><span>Emergency / ambulance</span>${tel(p.emergencyPhone)}</li></ul>`)}
    ${card('Go to hospital / call the doctor if', `<ul class="bullets warn-list">${WARNING_SIGNS.map(w => `<li>${esc(w)}</li>`).join('')}</ul><p class="small">When in doubt, call. Doctors would much rather check than miss something.</p>`)}
    ${card('Her details for the hospital', `<dl class="dl"><dt>Name</dt><dd>${esc(p.momName) || '—'}</dd><dt>Blood group</dt><dd>${esc(p.bloodGroup) || '—'}</dd>
      <dt>Due date</dt><dd>${info ? fmtDate(info.due) + ` (week ${info.week}+${info.day})` : '—'}</dd><dt>Allergies / notes</dt><dd>${esc(p.notes) || '—'}</dd>
      <dt>Current medicines</dt><dd>${Store.state.meds.filter(m => m.active).map(m => esc(m.name + (m.dose ? ' ' + m.dose : ''))).join(', ') || '—'}</dd></dl>`)}`;
};

// ---------- sharing / account ----------
VIEWS.account = () => {
  if (!Sync.configured()) {
    return `<h1>Share with your partner</h1>${card('Not set up yet', `<p>Sharing needs a free Supabase project (see the README). Once it's configured in <code>js/config.js</code>, both of you sign in here and see the same data, live.</p>
      <details><summary>Enter connection details manually</summary><form data-form="cloudConfig" class="form">
        <label>Project URL<input name="url" placeholder="https://xxxx.supabase.co" value="${esc(Device.state.cloud.url)}"></label>
        <label>Anon / publishable key<input name="key" value="${esc(Device.state.cloud.key)}"></label>
        <button class="btn" type="submit">Connect</button></form></details>`)}`;
  }
  const st = Sync.status;
  if (!Sync.client || (st === 'syncing' && !Sync.userId)) return `<h1>Share with your partner</h1>${card('', '<p class="muted">Connecting…</p>')}`;
  if (st === 'error' && !Sync.userId) return `<h1>Share with your partner</h1>${card('Couldn’t connect', `<p class="warn">${esc(Sync.error)}</p><button class="btn" data-act="syncRetry">Try again</button>`)}`;
  if (!Sync.userId) {
    const signup = UI.authMode === 'signup';
    return `<h1>Share with your partner</h1>
      <p class="muted">One account each. Then one of you creates a family space and the other joins with its code.</p>
      ${segmented('authMode', UI.authMode, [['signin', 'Sign in'], ['signup', 'Create account']])}
      ${card('', `<form data-form="${signup ? 'signup' : 'signin'}" class="form">
        ${signup ? `<label>Your name<input name="name" required autocomplete="name"></label>` : ''}
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
        <button class="btn" type="submit" ${UI.busy ? 'disabled' : ''}>${signup ? 'Create account' : 'Sign in'}</button>
        ${signup ? '' : '<button class="btn ghost small" type="button" data-act="forgotPw">Forgot password?</button>'}</form>`)}`;
  }
  if (st === 'nohousehold') {
    return `<h1>Share with your partner</h1><p class="muted">Signed in as ${esc(Sync.user?.email || '')}</p>
      ${card('Start a family space', `<p>Your current data moves in. You'll get a code to give your partner.</p><button class="btn" data-act="createHousehold" ${UI.busy ? 'disabled' : ''}>Create our family space</button>`)}
      ${card('…or join your partner', `<form data-form="join" class="form inline"><input name="code" required placeholder="Code, e.g. ABCD-EF23" autocapitalize="characters" aria-label="Invite code"><button class="btn small" type="submit" ${UI.busy ? 'disabled' : ''}>Join</button></form>
        <p class="small muted">Anything already on this phone is merged with what your partner has.</p>`)}
      <button class="btn ghost small" data-act="signOut">Sign out</button>`;
  }
  const h = Sync.household;
  const code = h ? h.invite_code.replace(/^(.{4})(.+)$/, '$1-$2') : '';
  const statusText = { synced: `✓ Up to date${Sync.lastSyncAt ? ' · ' + new Date(Sync.lastSyncAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''}`, syncing: 'Syncing…', offline: 'Offline — changes will sync when you\'re back online', error: 'Problem: ' + Sync.error }[st] || st;
  return `<h1>Share with your partner</h1>
    ${card(esc(h ? h.name : ''), `<p class="${st === 'error' ? 'warn' : st === 'synced' ? 'ok' : 'muted'}">${esc(statusText)}</p>
      <p class="label">Invite code</p><div class="code-row"><span class="code">${esc(code)}</span>${navigator.share ? '<button class="btn small" data-act="shareCode">Share</button>' : '<button class="btn small ghost" data-act="copyCode">Copy</button>'}</div>
      <p class="small muted">Your partner installs Nestling, creates an account, and enters this code.</p>
      <p class="label">Members</p><ul class="list">${Sync.members.map(m => `<li>${esc(m.display_name || 'Member')}${m.user_id === Sync.userId ? ' <span class="muted">(you)</span>' : ''}</li>`).join('')}</ul>
      <div class="btn-row"><button class="btn small ghost" data-act="syncNow">Sync now</button><button class="btn small ghost" data-act="signOut">Sign out</button><button class="btn small ghost danger" data-act="leaveHousehold">Leave</button></div>`)}`;
};

// ---------- settings ----------
VIEWS.settings = () => {
  const n = Device.state.notif;
  const perm = Notify.supported() ? Notification.permission : 'unsupported';
  const p = Store.state.profile;
  const f = (name, label, type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(p[name])}" ${extra}></label>`;
  return `<h1>Settings</h1>
    ${card('Profile', `<form data-form="profile" class="form">
      <div class="grid2">${f('momName', 'Mom-to-be')}${f('dadName', 'Dad-to-be')}</div>
      <div class="grid2">${f('dueDate', 'Due date', 'date')}${f('lmp', 'or last period start', 'date')}</div>
      <div class="grid2">${f('bloodGroup', 'Her blood group', 'text', 'placeholder="e.g. B+"')}${f('currency', 'Currency symbol')}</div>
      <div class="grid2">${f('doctorName', 'Doctor')}${f('doctorPhone', 'Doctor phone', 'tel')}</div>
      <div class="grid2">${f('hospital', 'Hospital')}${f('hospitalPhone', 'Hospital phone', 'tel')}</div>
      ${f('emergencyPhone', 'Emergency / ambulance number', 'tel')}
      <label>Allergies & medical notes<textarea name="notes" rows="2">${esc(p.notes)}</textarea></label>
      <button class="btn" type="submit">Save</button></form>`)}
    ${card('Sharing', `<p>${Sync.connected() ? `Shared with ${Sync.members.length} ${Sync.members.length === 1 ? 'person' : 'people'}` : 'Only on this phone'}</p><a class="btn ghost" href="#account">Manage sharing</a>`)}
    ${card('Reminders', `<p>Notifications on this phone: <b>${n.enabled && perm === 'granted' ? 'On' : 'Off'}</b></p>
      ${n.enabled && perm === 'granted' ? '' : '<button class="btn" data-act="enableNotif">Turn on notifications</button>'}
      <p class="small muted">Reminders fire while Nestling is open or recently used. For alarms that always ring, even when the app is closed, add everything to your phone's calendar:</p>
      <button class="btn ghost" data-act="exportICS">📅 Add to calendar (.ics)</button>`)}
    ${card('Backup', `<p class="small">${Sync.connected() ? 'Your data is also saved in your family space.' : 'Data lives only on this phone — export a backup now and then.'}</p>
      <div class="btn-row"><button class="btn ghost" data-act="exportJSON">⬇️ Export backup</button><label class="btn ghost file">⬆️ Import backup<input type="file" accept="application/json,.json" data-change="importJSON" hidden></label></div>`)}
    ${card('Danger zone', '<button class="btn ghost danger" data-act="reset">Erase all data on this phone</button>')}
    <p class="disclaimer">Nestling is an organiser, not medical advice. Always follow her doctor's guidance.</p>`;
};

VIEWS.more = () => `<h1>More</h1><nav class="tiles big-tiles" aria-label="All sections">
  ${[['#health', '❤️', 'Health & kicks'], ['#food', '🥗', 'Food & nutrition'], ['#tasks', '✅', 'Daily tasks & to-dos'], ['#money', '💰', 'Money'], ['#library', '📚', 'Read & listen'],
    ['#lists', '🧳', 'Checklists'], ['#baby', '👶', 'Baby tracker'], ['#week', '📖', 'Week by week'], ['#account', '👫', 'Share with partner'],
    ['#emergency', '🚨', 'Emergency'], ['#settings', '⚙️', 'Settings & backup']]
    .map(([h, i, l]) => `<a href="${h}"><span>${i}</span>${l}</a>`).join('')}</nav>`;

// ---------- actions (clicks) ----------
const find = (list, id) => list.find(x => x.id === id);

async function busy(fn) {
  UI.busy = true; render();
  try { await fn(); } catch (e) { toast(friendlyError(e)); }
  UI.busy = false; render();
}
function friendlyError(e) {
  const msg = (e && e.message) || String(e);
  if (/invalid login/i.test(msg)) return 'Email or password is wrong.';
  if (/not confirmed/i.test(msg)) return 'Please confirm your email first (check your inbox), then sign in.';
  if (/already registered/i.test(msg)) return 'That email already has an account — sign in instead.';
  if (/did not match/i.test(msg)) return 'That code didn’t match. Check it with your partner.';
  if (/fetch|network/i.test(msg)) return 'No connection. Try again when online.';
  return msg;
}

const ACTIONS = {
  seg(el) { UI[el.dataset.name] = el.dataset.val; render(); },
  closeSheet() { closeSheet(); },
  setVal(el) {
    const form = el.closest('form');
    const input = form.elements[el.dataset.target];
    if (input) input.value = el.dataset.val;
    el.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('on', b === el));
  },
  // wizard
  wizNext() { UI.step++; render(); },
  wizFinish() { Store.state.setupDone = true; UI.step = 0; commit(`You're all set${Store.state.profile.dadName ? ', ' + Store.state.profile.dadName : ''} 🎉`); },
  // quick add
  voice(el) {
    const form = el.closest('form');
    const input = form.elements.q;
    el.classList.add('on');
    try {
      Voice.listen(text => { input.value = text; }, text => {
        el.classList.remove('on');
        if (text.trim()) FORMS.quick(form, new FormData(form));
      });
    } catch (e) { el.classList.remove('on'); toast('Voice input is not available here.'); }
  },
  quickApply() {
    const d = document.getElementById('sheet');
    const picked = [...d.querySelectorAll('input[name=qa]:checked')].map(i => Number(i.value));
    const before = clone(Store.state);
    picked.forEach(i => UI.quickActions[i].apply());
    closeSheet();
    if (!picked.length) return;
    const touched = Object.keys(Store.state).filter(k => !deepEqual(before[k], Store.state[k]));
    commit();
    toast(`Added ${picked.length} item${picked.length > 1 ? 's' : ''}`, { undo: () => { touched.forEach(k => { Store.state[k] = before[k]; }); commit(); } });
  },
  // medicines
  takeMed(el) {
    const m = find(Store.state.meds, el.dataset.id);
    const taken = medTaken(m.id, isoDate(), el.dataset.slot);
    markTaken(m, isoDate(), el.dataset.slot, !taken);
    commit(taken ? '' : `✓ ${m.name}`);
  },
  takeAll() {
    const today = isoDate(), limit = addMinutes(nowTime(), 45);
    for (const m of Store.state.meds.filter(m => m.active)) for (const slot of m.times) if (slot <= limit) markTaken(m, today, slot, true);
    commit('✓ All taken');
  },
  refill(el) {
    const m = find(Store.state.meds, el.dataset.id);
    const n = Number(el.dataset.n);
    undoable(`${m.name}: +${n} → ${(Number(m.stock) || 0) + n} in stock`, () => { m.stock = (Number(m.stock) || 0) + n; });
  },
  openMed(el) { sheetMed(el.dataset.id); },
  medPreset(el) {
    const p = MED_PRESETS[Number(el.dataset.i)];
    const f = el.closest('form');
    f.elements.name.value = p.name;
    f.elements.notes.value = p.notes;
    const slots = TIME_SLOTS.map(([t]) => t);
    f.querySelectorAll('input[name=slot]').forEach(c => { c.checked = p.times.includes(c.value); });
    f.elements.time.value = p.times.find(t => !slots.includes(t)) || '';
    el.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('on', b === el));
  },
  toggleMed(el) { const m = find(Store.state.meds, el.dataset.id); m.active = !m.active; commit(); },
  delMed(el) {
    const s = Store.state, m = find(s.meds, el.dataset.id);
    undoable(`Deleted ${m.name}`, () => { s.meds = s.meds.filter(x => x.id !== m.id); s.medLog = s.medLog.filter(l => l.medId !== m.id); });
  },
  // health
  mood(el) { const h = healthDay(); h.mood = h.mood === el.dataset.val ? '' : el.dataset.val; commit(); refreshFeeling(); },
  moodReset() { healthDay().mood = ''; commit(); },
  symptom(el) {
    const h = healthDay(), v = el.dataset.val;
    h.symptoms = (h.symptoms || []).includes(v) ? h.symptoms.filter(x => x !== v) : [...(h.symptoms || []), v];
    commit(); refreshFeeling();
  },
  symptomsDone() { healthDay().symptomsAsked = true; commit('Noted 👍'); },
  sleep(el) { const h = healthDay(); h.sleep = String(h.sleep) === el.dataset.val ? '' : el.dataset.val; commit(); refreshFeeling(); },
  // ＋ sheet and friends
  openAdd() { sheetAdd(); },
  addFeeling() { sheetFeeling(); },
  addWeight() {
    const lw = lastWeight(), h = healthPeek() || {};
    openSheet('Weight', `<p class="muted small">${lw ? `Last: ${lw.weight} kg, ${relDay(lw.date).toLowerCase()}` : 'Her weight today'}</p>
      <div class="stepper big"><button class="btn ghost" data-act="wstep" data-d="-0.1" aria-label="Decrease">−</button><input type="number" step="0.1" inputmode="decimal" value="${h.weight || (lw ? lw.weight : '60.0')}" aria-label="Weight in kg"><button class="btn ghost" data-act="wstep" data-d="0.1" aria-label="Increase">+</button></div>
      <div class="stepper"><button class="btn wide" data-act="saveWeight">Save</button></div>`);
  },
  addTodo() {
    openSheet('To-do', `<form data-form="todo" class="form"><input name="text" required autofocus placeholder="e.g. Buy car seat by next week" aria-label="To-do"><button class="btn" type="submit">Add</button></form>`);
  },
  goContractions() { UI.healthTab = 'contractions'; location.hash = '#health'; },
  goBaby() { location.hash = '#baby'; },
  later(el) {
    const z = Device.state.snooze && Device.state.snooze.date === isoDate() ? Device.state.snooze : { date: isoDate(), keys: [] };
    z.keys.push(el.dataset.key);
    Device.state.snooze = z; Device.save();
    const card = el.closest('.ci');
    card.classList.add('leaving');
    setTimeout(render, 220);
  },
  waterSet(el) {
    const fd = foodDay(), n = Number(el.dataset.n);
    fd.water = fd.water === n ? n - 1 : n;
    if (navigator.vibrate) navigator.vibrate(15);
    commit();
  },
  wstep(el) {
    const i = el.closest('.stepper').querySelector('input');
    i.value = Math.max(20, (Number(i.value) || 60) + Number(el.dataset.d)).toFixed(1);
  },
  saveWeight(el) {
    const v = Number((el.closest('.stepper').querySelector('input') || el.closest('.sheet-b').querySelector('input')).value);
    if (!(v >= 25 && v <= 250)) { toast('That weight looks off — check the number.'); return; }
    healthDay().weight = v.toFixed(1);
    closeSheet();
    commit(`Saved ${v.toFixed(1)} kg`);
  },
  openBP() { sheetBP(); },
  delHealth(el) { undoable('Entry deleted', () => { Store.state.health = Store.state.health.filter(x => x.id !== el.dataset.id); }); },
  goKicks() { UI.healthTab = 'kicks'; UI.kick = { start: Date.now(), count: 0 }; location.hash = '#health'; },
  kickStart() { UI.kick = { start: Date.now(), count: 0 }; render(); },
  kick() { UI.kick.count++; if (navigator.vibrate) navigator.vibrate(30); render(); },
  kickStop() {
    if (UI.kick.count > 0) Store.state.kicks.push({ id: uid(), start: UI.kick.start, end: Date.now(), count: UI.kick.count });
    UI.kick = null; commit('Session saved');
  },
  contrStart() { UI.contraction = { start: Date.now() }; render(); },
  contrStop() { Store.state.contractions.push({ id: uid(), start: UI.contraction.start, end: Date.now() }); UI.contraction = null; commit(); },
  contrClear() { undoable('History cleared', () => { Store.state.contractions = []; }); },
  // food & water
  water(el) { const fd = foodDay(); fd.water = Math.max(0, fd.water + Number(el.dataset.d)); commit(); },
  foodCheck(el) { const fd = foodDay(); const id = el.dataset.id; fd.checks = fd.checks.includes(id) ? fd.checks.filter(x => x !== id) : [...fd.checks, id]; commit(); },
  // tasks
  daily(el) {
    const log = Store.state.daily.log, today = isoDate();
    const cur = log[today] || [];
    log[today] = el.checked ? [...new Set([...cur, el.dataset.id])] : cur.filter(x => x !== el.dataset.id);
    commit();
  },
  dailyTap(el) {
    const log = Store.state.daily.log, today = isoDate();
    log[today] = [...new Set([...(log[today] || []), el.dataset.id])];
    const left = dailyTasksFor(today).filter(t => !log[today].includes(t.id)).length;
    commit(left ? '' : 'All done today 🎉');
  },
  hideTask(el) {
    const d = Store.state.daily, id = el.dataset.id;
    undoable('Task removed', () => { if (d.custom.some(t => t.id === id)) d.custom = d.custom.filter(t => t.id !== id); else d.hidden.push(id); });
  },
  restoreTasks() { Store.state.daily.hidden = []; commit(); },
  todo(el) { const t = find(Store.state.todos, el.dataset.id); t.done = el.checked; commit(); },
  delTodo(el) { undoable('To-do deleted', () => { Store.state.todos = Store.state.todos.filter(x => x.id !== el.dataset.id); }); },
  // visits
  openAppt(el) { sheetAppt(el.dataset.id); },
  addQuestion(el) {
    const a = find(Store.state.appts, el.dataset.id);
    openSheet('Question for the doctor', `<form data-form="question" data-id="${a.id}" class="form"><p class="muted small">${esc(a.title)} · ${relDay(a.date)}</p>
      <input name="q" required placeholder="e.g. Is it OK to travel in March?" autofocus aria-label="Question"><button class="btn" type="submit">Add</button></form>`);
  },
  doneAppt(el) {
    const s = Store.state, a = find(s.appts, el.dataset.id);
    const before = clone({ appts: s.appts, tests: s.tests });
    a.done = true;
    if (a.testId) s.tests[a.testId] = { ...(s.tests[a.testId] || {}), done: true, date: a.date };
    commit();
    toast(`✓ ${a.title}`, { undo: () => { s.appts = before.appts; s.tests = before.tests; commit(); } });
  },
  delAppt(el) { undoable('Visit deleted', () => { Store.state.appts = Store.state.appts.filter(x => x.id !== el.dataset.id); }); },
  bookTest(el) {
    const t = TESTS.find(x => x.id === el.dataset.id);
    const start = dateForWeek(t.from);
    sheetAppt(null, { title: t.name, testId: t.id, date: start && start > isoDate() ? start : '' });
  },
  testDone(el) { const s = Store.state; s.tests[el.dataset.id] = { ...(s.tests[el.dataset.id] || {}), done: true, date: isoDate() }; commit('Marked done'); },
  testUndo(el) { const s = Store.state; s.tests[el.dataset.id] = { ...(s.tests[el.dataset.id] || {}), done: false }; commit(); },
  // money
  openExpense(el) { sheetExpense({ note: el.dataset.note || '' }); },
  bought(el) { const p = find(Store.state.money.planned, el.dataset.id); p.bought = el.checked; commit(); },
  delPlanned(el) { undoable('Item removed', () => { Store.state.money.planned = Store.state.money.planned.filter(x => x.id !== el.dataset.id); }); },
  claimed(el) { const e = find(Store.state.money.expenses, el.dataset.id); e.claimed = !e.claimed; commit(); },
  delExpense(el) { undoable('Expense deleted', () => { Store.state.money.expenses = Store.state.money.expenses.filter(x => x.id !== el.dataset.id); }); },
  // library & lists
  libState(el) {
    const st = Store.state.library.status;
    const order = ['', 'want', 'reading', 'done'];
    const cur = st[el.dataset.id] || { state: '', progress: 0 };
    cur.state = order[(order.indexOf(cur.state) + 1) % order.length];
    if (cur.state === 'done') cur.progress = 100;
    st[el.dataset.id] = cur;
    commit();
  },
  delBook(el) { undoable('Removed', () => { Store.state.library.custom = Store.state.library.custom.filter(b => b.id !== el.dataset.id); }); },
  listItem(el) {
    const d = Store.state.checklists.done, { list, item } = el.dataset;
    const cur = d[list] || [];
    d[list] = el.checked ? [...new Set([...cur, item])] : cur.filter(x => x !== item);
    commit();
  },
  // baby
  babyLog(el) { Store.state.baby.logs.push({ id: uid(), type: el.dataset.type, at: Date.now() }); commit('Logged'); },
  babySleep() {
    const b = Store.state.baby, open = b.logs.find(l => l.type === 'sleep' && !l.end);
    if (open) open.end = Date.now(); else b.logs.push({ id: uid(), type: 'sleep', at: Date.now() });
    commit();
  },
  delBabyLog(el) { undoable('Deleted', () => { Store.state.baby.logs = Store.state.baby.logs.filter(l => l.id !== el.dataset.id); }); },
  // reminders
  async enableNotif() { if (await Notify.enable()) { toast('Reminders on ✓'); Notify.check(); } render(); },
  notifLater() { Device.state.notif.asked = true; Device.save(); render(); },
  shareLater() { Device.state.shareAsked = true; Device.save(); render(); },
  exportICS() { download('nestling-reminders.ics', buildICS(), 'text/calendar'); toast('Open the downloaded file to add it to your calendar.'); },
  exportJSON() { download(`nestling-backup-${isoDate()}.json`, Store.exportJSON(), 'application/json'); },
  reset() {
    const shared = Sync.connected();
    if (!confirm(shared ? 'Erase everything on this phone and sign out? Your shared family space is not touched.' : 'Erase ALL data on this phone? This cannot be undone.')) return;
    if (!shared && !confirm('Really erase everything?')) return;
    busy(async () => {
      if (shared) await Sync.signOut(); // never sync an empty phone over the family's data
      Store.reset(); Store.save(); UI.step = 0; location.hash = '#home';
    });
  },
  // sharing
  syncRetry() { Sync.init().then(render); },
  syncNow() { Sync.refresh().then(() => toast(Sync.status === 'synced' ? 'Up to date ✓' : 'Couldn’t sync right now')); },
  createHousehold() {
    const p = Store.state.profile;
    busy(async () => { await Sync.createHousehold(p.momName && p.dadName ? `${p.momName} & ${p.dadName}` : 'Our family'); toast('Family space created 🎉'); });
  },
  async shareCode() {
    const code = Sync.household.invite_code.replace(/^(.{4})(.+)$/, '$1-$2');
    try { await navigator.share({ title: 'Join me on Nestling', text: `Join our family space on Nestling with code ${code}`, url: location.origin + location.pathname }); } catch (e) { /* cancelled */ }
  },
  copyCode() { if (navigator.clipboard) navigator.clipboard.writeText(Sync.household.invite_code).then(() => toast('Code copied')); },
  signOut() { busy(async () => { await Sync.signOut(); toast('Signed out. Data stays on this phone.'); }); },
  leaveHousehold() { if (confirm('Leave this family space? Data stays on this phone but stops syncing.')) busy(() => Sync.leaveHousehold()); },
  forgotPw(el) {
    const email = el.closest('form').elements.email.value.trim();
    if (!email) { toast('Type your email first.'); return; }
    busy(async () => { await Sync.resetPassword(email); toast('Password reset email sent.'); });
  },
};

// ---------- forms ----------
// A handler returns false to keep a sheet open (validation failed).
const FORMS = {
  quick(f, fd) {
    const text = String(fd.get('q') || '').trim();
    if (!text) return false;
    UI.quickActions = parseQuick(text);
    f.reset();
    if (!UI.quickActions.length) { toast('Didn’t catch that — try “paid 500 for scan” or “bp 120/80”.'); return false; }
    openSheet('Add these?', `<p class="muted small">“${esc(text)}”</p><ul class="qa-list">${UI.quickActions.map((a, i) => `<li><label class="check"><input type="checkbox" name="qa" value="${i}" checked> <span class="qa-icon">${a.icon}</span> ${esc(a.label)}</label></li>`).join('')}</ul>
      <button class="btn" data-act="quickApply">Add</button>`);
    return false;
  },
  wizDue(f, fd) {
    const p = Store.state.profile;
    p.dueDate = fd.get('dueDate') || '';
    p.lmp = fd.get('lmp') || '';
    if (!p.dueDate && p.lmp) p.dueDate = addDays(p.lmp, 280);
    if (!p.dueDate) { toast('Pick the due date (or the last period date).'); return false; }
    UI.step++; commit();
  },
  wizNames(f, fd) { Object.assign(Store.state.profile, { momName: fd.get('momName').trim(), dadName: fd.get('dadName').trim() }); UI.step++; commit(); },
  wizMeds(f, fd) {
    for (const i of fd.getAll('preset')) {
      const p = MED_PRESETS[Number(i)];
      Store.state.meds.push({ id: uid(), active: true, name: p.name, dose: '', times: [...p.times], perDose: 1, stock: '', unit: 'tablet', refillDays: 5, notes: p.notes });
    }
    UI.step++; commit();
  },
  wizDoctor(f, fd) {
    for (const k of ['doctorName', 'doctorPhone', 'hospital', 'hospitalPhone']) Store.state.profile[k] = fd.get(k).trim();
    ACTIONS.wizFinish();
  },
  profile(f, fd) {
    const p = Store.state.profile;
    for (const [k, v] of fd.entries()) p[k] = String(v).trim();
    if (p.lmp && !p.dueDate) p.dueDate = addDays(p.lmp, 280);
    commit('Saved ✓');
  },
  bp(f, fd) {
    const h = healthDay();
    Object.assign(h, { sys: fd.get('sys'), dia: fd.get('dia'), sugar: fd.get('sugar') });
    commit(bpHigh(h) ? '⚠️ High reading — please tell the doctor.' : 'Saved');
  },
  med(f, fd) {
    const s = Store.state;
    const times = [...new Set([...fd.getAll('slot'), fd.get('time')].filter(Boolean))].sort();
    if (!times.length) { toast('Pick at least one time.'); return false; }
    const data = { name: fd.get('name').trim(), dose: fd.get('dose').trim(), times, perDose: Number(fd.get('perDose')) || 1,
      stock: fd.get('stock') === '' ? '' : Number(fd.get('stock')), unit: fd.get('unit').trim() || 'tablet',
      refillDays: Number(fd.get('refillDays')) || 0, notes: fd.get('notes').trim() };
    if (f.dataset.id) Object.assign(find(s.meds, f.dataset.id), data);
    else s.meds.push({ id: uid(), active: true, ...data });
    commit(`${data.name} saved · reminders at ${times.map(fmtTime).join(', ')}`);
  },
  appt(f, fd) {
    const s = Store.state;
    const data = Object.fromEntries(['title', 'date', 'time', 'doctor', 'place', 'notes', 'questions', 'testId'].map(k => [k, String(fd.get(k) || '').trim()]));
    if (f.dataset.id) Object.assign(find(s.appts, f.dataset.id), data);
    else s.appts.push({ id: uid(), done: false, ...data });
    commit(`Saved · ${relDay(data.date)}${data.time ? ' ' + fmtTime(data.time) : ''}`);
  },
  question(f, fd) {
    const a = find(Store.state.appts, f.dataset.id);
    a.questions = [a.questions, fd.get('q').trim()].filter(Boolean).join('\n');
    commit('Question added');
  },
  dailyTask(f, fd) { Store.state.daily.custom.push({ id: 'c_' + uid(), text: fd.get('text').trim(), who: fd.get('who') }); commit(); },
  todo(f, fd) {
    const raw = fd.get('text').trim();
    const when = parseWhen(raw);
    Store.state.todos.push({ id: uid(), text: capitalize(stripWhen(raw)) || raw, due: when.date, done: false });
    commit();
  },
  budget(f, fd) { Store.state.money.budget = Number(fd.get('budget')) || 0; commit(); },
  expense(f, fd) {
    const amount = Number(fd.get('amount'));
    if (!(amount > 0)) { toast('Enter an amount.'); return false; }
    Store.state.money.expenses.push({ id: uid(), amount, date: fd.get('date') || isoDate(), category: fd.get('category') || 'Other',
      note: fd.get('note').trim(), claimable: fd.get('claimable') === 'on', claimed: false });
    commit(`Added ${fmtMoney(amount)}`);
  },
  planned(f, fd) { Store.state.money.planned.push({ id: uid(), name: fd.get('name').trim(), estimate: Number(fd.get('estimate')) || 0, bought: false }); commit(); },
  book(f, fd) { Store.state.library.custom.push({ id: 'u_' + uid(), custom: true, title: fd.get('title').trim(), by: fd.get('by').trim(), type: fd.get('type'), for: fd.get('for') }); commit('Added'); },
  listItem(f, fd) {
    const c = Store.state.checklists.custom, id = f.dataset.list;
    c[id] = [...(c[id] || []), fd.get('text').trim()];
    commit();
  },
  born(f, fd) { Object.assign(Store.state.baby, { born: true, name: fd.get('name').trim(), dob: fd.get('dob') }); commit('Congratulations! 🎉'); },
  babyName(f, fd) { Store.state.baby.name = fd.get('name').trim(); commit('Saved'); },
  growth(f, fd) {
    Store.state.baby.growth.push({ id: uid(), date: fd.get('date'), weight: fd.get('weight'), length: fd.get('length'), head: fd.get('head') });
    commit('Measurement saved');
  },
  notifTime(f, fd) { Device.state.notif.dailyTime = fd.get('dailyTime') || '21:00'; Device.save(); toast('Saved'); },
  cloudConfig(f, fd) {
    Device.state.cloud = { url: fd.get('url').trim(), key: fd.get('key').trim() };
    Device.save();
    Sync.init().then(render);
  },
  signin(f, fd) { busy(() => Sync.signIn(fd.get('email').trim(), fd.get('password'))); },
  signup(f, fd) {
    busy(async () => {
      const r = await Sync.signUp(fd.get('email').trim(), fd.get('password'), fd.get('name').trim());
      if (r === 'confirm') { UI.authMode = 'signin'; toast('Check your email to confirm, then sign in.'); }
    });
  },
  join(f, fd) { busy(async () => { await Sync.joinHousehold(fd.get('code')); toast('Joined 🎉 Your data is now shared.'); }); },
};

// ---------- inputs that save as you go ----------
const CHANGES = {
  estimate(el) { const p = find(Store.state.money.planned, el.dataset.id); p.estimate = Number(el.value) || 0; Store.save(); render(); },
  libProgress(el) { const st = Store.state.library.status[el.dataset.id]; st.progress = Number(el.value); if (st.progress >= 100) st.state = 'done'; commit(); },
  healthNote(el) { healthDay(el.dataset.date).notes = el.value.trim(); Store.save(); toast('Saved'); },
  meals(el) { foodDay().meals = el.value; Store.save(); toast('Saved'); },
  testResult(el) { const s = Store.state; s.tests[el.dataset.id] = { ...(s.tests[el.dataset.id] || {}), result: el.value.trim() }; Store.save(); toast('Saved'); },
  expCat(el) { el.form.elements.claimable.checked = CLAIMABLE_CATEGORIES.includes(el.value); },
  importJSON(el) {
    const file = el.files[0];
    if (!file) return;
    file.text().then(t => {
      if (!confirm(Sync.connected() ? 'Replace your data with this backup? This also updates your partner\'s phone.' : 'Replace the data on this phone with this backup?')) return;
      try { Store.importJSON(t); render(); toast('Backup imported ✓'); } catch (e) { toast('Import failed: ' + e.message); }
    });
  },
};

// ---------- router & wiring ----------
const TAB_OF = { home: 'home', week: 'home', meds: 'meds', visits: 'visits' };
function render() {
  const [route, arg] = (location.hash.slice(1) || 'home').split('/');
  const view = VIEWS[route] || VIEWS.home;
  document.getElementById('main').innerHTML = view(arg);
  const tab = TAB_OF[route] || (VIEWS[route] ? 'more' : 'home');
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  const wizardOn = !Store.state.setupDone && !Store.state.baby.born && (route === 'home' || !VIEWS[route]);
  document.body.classList.toggle('wizard-on', wizardOn);
  renderSyncBadge();
  tickTimers();
}

function renderSyncBadge() {
  const el = document.getElementById('syncBadge');
  if (!Sync.connected()) { el.hidden = true; return; }
  el.hidden = false;
  const map = { synced: ['✓', 'Shared · up to date'], syncing: ['↻', 'Syncing…'], offline: ['⤫', 'Offline — will sync later'], error: ['!', 'Sync problem'] };
  const [icon, label] = map[Sync.status] || ['', Sync.status];
  el.className = 'sync-badge ' + Sync.status;
  el.textContent = '☁' + icon;
  el.setAttribute('aria-label', label);
  el.title = label;
}

function tickTimers() {
  document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmtDuration(Date.now() - Number(el.dataset.timer)); });
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !ACTIONS[el.dataset.act]) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  ACTIONS[el.dataset.act](el);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f || !FORMS[f.dataset.form]) return;
  e.preventDefault();
  const inSheet = !!f.closest('#sheet');
  const res = FORMS[f.dataset.form](f, new FormData(f));
  if (inSheet && res !== false) closeSheet();
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el);
});
document.addEventListener('toggle', e => {
  if (e.target.matches && e.target.matches('details.list-card')) UI.openLists[e.target.dataset.list] = e.target.open;
}, true);
document.addEventListener('focusout', () => setTimeout(flushRender, 0));

// Chart tooltips: hover or tap a point
function showTip(pt) {
  const fig = pt.closest('.chart'), box = fig.querySelector('.tip-box');
  const r = pt.querySelector('.dot').getBoundingClientRect(), fr = fig.getBoundingClientRect();
  box.textContent = pt.dataset.tip;
  box.hidden = false;
  box.style.left = `${r.left - fr.left + r.width / 2}px`;
  box.style.top = `${r.top - fr.top}px`;
}
document.addEventListener('pointerover', e => { const pt = e.target.closest('.pt'); if (pt) showTip(pt); });
document.addEventListener('focusin', e => { const pt = e.target.closest('.pt'); if (pt) showTip(pt); });
document.addEventListener('pointerout', e => { const pt = e.target.closest('.pt'); if (pt) pt.closest('.chart').querySelector('.tip-box').hidden = true; });

window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });

(function boot() {
  const sheet = document.getElementById('sheet');
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  sheet.addEventListener('close', () => setTimeout(flushRender, 0));
  Device.load();
  Store.load();
  Sync.onChange(() => { renderSyncBadge(); if (/^#(account|settings)/.test(location.hash) && !isTyping()) render(); });
  render();
  setInterval(tickTimers, 1000);
  setInterval(() => { if (location.hash === '' || location.hash === '#home') safeRender(); }, 60000); // keep "due now" cards fresh
  Notify.start();
  Sync.init();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
