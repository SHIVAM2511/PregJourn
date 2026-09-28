// Nest — pregnancy companion. Plain JS, hash-routed views, event delegation.

const UI = {
  healthTab: 'log', who: 'all', libFilter: 'all', editMed: null, editAppt: null,
  kick: null,          // {start, count}
  contraction: null,   // {start}
  openLists: {},       // checklist id -> open/closed as the user left it
};

// ---------- helpers used across views & reminders ----------
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 4000);
}
function medTaken(medId, date, slot) { return Store.state.medLog.some(l => l.medId === medId && l.date === date && l.slot === slot); }
function medDaysLeft(m) {
  const perDay = (Number(m.perDose) || 1) * (m.times.length || 1);
  if (m.stock === '' || m.stock == null) return null;
  return Math.floor(Number(m.stock) / perDay);
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
function commit(msg) { Store.save(); render(); if (msg) toast(msg); }
function tel(num) { return num ? `<a class="btn small" href="tel:${esc(num.replace(/[^\d+]/g, ''))}">📞 Call</a>` : ''; }
function pill(text, kind = '') { return `<span class="pill ${kind}">${esc(text)}</span>`; }
function empty(text) { return `<p class="muted empty">${text}</p>`; }
function progressBar(pct, label = '') { return `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label)}"><span style="width:${pct}%"></span></div>`; }
function card(title, body, extra = '') { return `<section class="card">${title ? `<div class="card-h"><h2>${title}</h2>${extra}</div>` : ''}${body}</section>`; }
function segmented(name, current, options) {
  return `<div class="seg" role="tablist">${options.map(([v, l]) => `<button role="tab" aria-selected="${v === current}" class="${v === current ? 'on' : ''}" data-act="seg" data-name="${name}" data-val="${v}">${l}</button>`).join('')}</div>`;
}
function whoLabel(w) { return { mom: '🤰 Her', dad: '🧔 You', both: '👫 Both' }[w] || ''; }
function sizeLine(week) {
  const w = WEEKS[Math.min(42, Math.max(1, week))];
  if (!w || w[0] === '—') return 'Getting started';
  return `About the size of a <b>${esc(w[0])}</b>${w[1] ? ` · ${esc(w[1])}` : ''}${w[2] ? ` · ${esc(w[2])}` : ''}`;
}
function testStatus(t, info) {
  const st = Store.state.tests[t.id];
  if (st?.done) return ['done', '✓ Done'];
  if (!info) return ['', `Weeks ${t.from}–${t.to}`];
  if (info.week > t.to) return ['late', 'Window passed'];
  if (info.week >= t.from) return ['due', 'Due now'];
  return ['', `From ${fmtDate(dateForWeek(t.from), { day: 'numeric', month: 'short' })}`];
}

// ---------- views ----------
const VIEWS = {};

VIEWS.home = () => {
  const s = Store.state;
  const info = pregnancyInfo();
  if (!info && !s.baby.born) return onboarding();
  const today = isoDate();
  let out = '';

  if (s.baby.born) {
    out += `<section class="hero"><p class="eyebrow">Welcome to the world</p><h1>${esc(s.baby.name || 'Baby')} 👶</h1>
      <p>${s.baby.dob ? `${daysBetween(s.baby.dob, today)} days old` : ''}</p><a class="btn" href="#baby">Open baby tracker</a></section>`;
  } else {
    const w = WEEKS[Math.min(42, Math.max(1, info.week))];
    out += `<section class="hero">
      <p class="eyebrow">${esc(s.profile.momName || 'Your')}${s.profile.momName ? '\'s' : ''} pregnancy · Trimester ${info.trimester}</p>
      <h1>Week ${info.week}<small> + ${info.day} day${info.day === 1 ? '' : 's'}</small></h1>
      <p>${sizeLine(info.week)}</p>
      ${progressBar(info.percent, 'Pregnancy progress')}
      <div class="hero-row"><span><b>${info.daysLeft >= 0 ? info.daysLeft : 0}</b> days to go</span><span>Due ${fmtDate(info.due)}</span></div>
      <a class="link" href="#week/${info.week}">This week's guide →</a>
    </section>`;
    if (w) out += `<section class="card tip"><p class="eyebrow">Dad tip for week ${info.week}</p><p>${esc(w[5])}</p></section>`;
  }

  // Alerts: low stock, tests due, overdue todos
  const alerts = [];
  for (const m of s.meds.filter(m => m.active)) {
    const left = medDaysLeft(m);
    if (left !== null && left <= (m.refillDays ?? 5)) alerts.push(`⚠️ <b>${esc(m.name)}</b>: ${m.stock} left (~${left} day${left === 1 ? '' : 's'}). <a href="#meds">Refill</a>`);
  }
  if (info && !s.baby.born) {
    for (const t of TESTS) {
      if (!t.optional && testStatus(t, info)[0] === 'due' && !s.appts.some(a => a.testId === t.id && !a.done)) {
        alerts.push(`🧪 <b>${esc(t.name)}</b> is due (weeks ${t.from}–${t.to}). <a href="#visits">Book it</a>`);
      }
    }
  }
  const overdue = s.todos.filter(t => !t.done && t.due && t.due < today);
  if (overdue.length) alerts.push(`📝 ${overdue.length} overdue to-do${overdue.length > 1 ? 's' : ''}. <a href="#tasks">View</a>`);
  if (alerts.length) out += card('Needs attention', `<ul class="alerts">${alerts.map(a => `<li>${a}</li>`).join('')}</ul>`);

  // Today's medicines
  const slots = [];
  for (const m of s.meds.filter(m => m.active)) for (const slot of m.times) slots.push({ m, slot });
  slots.sort((a, b) => a.slot.localeCompare(b.slot));
  out += card('Today\'s medicines', slots.length ? `<ul class="list">${slots.map(({ m, slot }) => {
    const taken = medTaken(m.id, today, slot);
    return `<li class="row ${taken ? 'is-done' : ''}"><div><b>${esc(slot)}</b> · ${esc(m.name)} <span class="muted">${esc(m.dose || '')}</span></div>
      <button class="btn small ${taken ? 'ghost' : ''}" data-act="takeMed" data-id="${m.id}" data-slot="${slot}">${taken ? 'Undo' : 'Taken'}</button></li>`;
  }).join('')}</ul>` : empty('No medicines added. <a href="#meds">Add prenatal vitamins, iron, calcium…</a>'), '<a class="link" href="#meds">All</a>');

  // Next appointment
  const next = s.appts.filter(a => !a.done && a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  out += card('Next appointment', next
    ? `<p><b>${esc(next.title)}</b></p><p class="muted">${fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' })}${next.time ? ' · ' + esc(next.time) : ''}${next.place ? ' · ' + esc(next.place) : ''}</p>${next.questions ? `<p class="small">❓ ${esc(next.questions)}</p>` : ''}`
    : empty('Nothing scheduled. <a href="#visits">Add an appointment</a>'), '<a class="link" href="#visits">All</a>');

  // Tasks & water
  const tasks = dailyTasksFor(today);
  const done = (s.daily.log[today] || []).filter(id => tasks.some(t => t.id === id)).length;
  const fd = foodDay(today);
  out += `<div class="grid2">
    ${card('Daily tasks', `<p class="big">${done}<small>/${tasks.length}</small></p>${progressBar(tasks.length ? Math.round(done / tasks.length * 100) : 0, 'Daily tasks done')}<a class="link" href="#tasks">Open →</a>`)}
    ${card('Water', `<p class="big">${fd.water}<small>/10 glasses</small></p><div class="btn-row"><button class="btn small ghost" data-act="water" data-d="-1" aria-label="Remove a glass">−</button><button class="btn small" data-act="water" data-d="1">+ Glass</button></div>`)}
  </div>`;

  out += `<nav class="tiles" aria-label="Sections">
    ${[['#week/' + (info ? info.week : 1), '📖', 'Week guide'], ['#food', '🥗', 'Food'], ['#tasks', '✅', 'Tasks'], ['#money', '💰', 'Money'],
      ['#library', '📚', 'Read & listen'], ['#lists', '🧳', 'Checklists'], ['#baby', '👶', 'Baby'], ['#emergency', '🚨', 'Emergency']]
      .map(([h, i, l]) => `<a href="${h}"><span>${i}</span>${l}</a>`).join('')}
  </nav>`;
  return out;
};

function onboarding() {
  return `<section class="hero"><p class="eyebrow">Congratulations! 🎉</p><h1>Let's set things up</h1>
    <p>Everything stays on this phone. Enter her due date (or the first day of her last period) and the rest is calculated for you.</p></section>
    ${card('Getting started', profileForm(true))}`;
}

function profileForm(first = false) {
  const p = Store.state.profile;
  const f = (name, label, type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(p[name])}" ${extra}></label>`;
  return `<form data-form="profile" class="form">
    <div class="grid2">${f('momName', 'Her name')}${f('dadName', 'Your name')}</div>
    <div class="grid2">${f('dueDate', 'Due date (if known)', 'date')}${f('lmp', 'or first day of last period', 'date')}</div>
    ${first ? '' : `<div class="grid2">${f('bloodGroup', 'Her blood group', 'text', 'placeholder="e.g. B+"')}${f('currency', 'Currency symbol')}</div>
    <div class="grid2">${f('doctorName', 'Doctor')}${f('doctorPhone', 'Doctor phone', 'tel')}</div>
    <div class="grid2">${f('hospital', 'Hospital')}${f('hospitalPhone', 'Hospital phone', 'tel')}</div>
    ${f('emergencyPhone', 'Emergency / ambulance number', 'tel')}
    <label>Allergies & medical notes<textarea name="notes" rows="2">${esc(p.notes)}</textarea></label>`}
    <button class="btn" type="submit">${first ? 'Start' : 'Save'}</button>
  </form>`;
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
  let body = '';
  if (tab === 'log') body = healthLog();
  if (tab === 'weight') body = weightView();
  if (tab === 'kicks') body = kicksView();
  if (tab === 'contractions') body = contractionsView();
  return `<h1>Health</h1>${segmented('healthTab', tab, [['log', 'Daily log'], ['weight', 'Weight & BP'], ['kicks', 'Kicks'], ['contractions', 'Contractions']])}${body}`;
};

function healthLog() {
  const s = Store.state;
  const today = isoDate();
  const form = `<form data-form="health" class="form">
    <div class="grid2"><label>Date<input type="date" name="date" value="${today}" max="${today}"></label>
      <label>Weight (kg)<input type="number" step="0.1" name="weight" inputmode="decimal"></label></div>
    <div class="grid3"><label>BP systolic<input type="number" name="sys" inputmode="numeric" placeholder="120"></label>
      <label>BP diastolic<input type="number" name="dia" inputmode="numeric" placeholder="80"></label>
      <label>Sugar (mg/dL)<input type="number" name="sugar" inputmode="numeric"></label></div>
    <fieldset><legend>Symptoms</legend><div class="chips">${SYMPTOMS.map(x => `<label class="chip"><input type="checkbox" name="symptoms" value="${x}"><span>${x}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Mood</legend><div class="chips">${MOODS.map(x => `<label class="chip mood"><input type="radio" name="mood" value="${x}"><span>${x}</span></label>`).join('')}</div></fieldset>
    <div class="grid2"><label>Sleep (hours)<input type="number" step="0.5" name="sleep" inputmode="decimal"></label></div>
    <label>Notes<textarea name="notes" rows="2" placeholder="Anything to tell the doctor?"></textarea></label>
    <button class="btn" type="submit">Save entry</button></form>`;
  const entries = [...s.health].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const list = entries.length ? `<ul class="list">${entries.map(e => `<li><div class="row"><b>${fmtDate(e.date)}</b><span>${e.mood || ''}
      <button class="icon-btn" data-act="delHealth" data-id="${e.id}" aria-label="Delete entry">✕</button></span></div>
      <div class="small">${[e.weight && `${e.weight} kg`, e.sys && `BP ${e.sys}/${e.dia}`, e.sugar && `Sugar ${e.sugar}`, e.sleep && `Sleep ${e.sleep}h`].filter(Boolean).join(' · ')}</div>
      ${e.symptoms?.length ? `<div class="chips">${e.symptoms.map(x => pill(x)).join('')}</div>` : ''}
      ${e.notes ? `<p class="small muted">${esc(e.notes)}</p>` : ''}
      ${bpWarning(e)}</li>`).join('')}</ul>` : empty('No entries yet.');
  return card('How is she today?', form) + card('History', list);
}

function bpWarning(e) {
  if ((Number(e.sys) >= 140 || Number(e.dia) >= 90)) return `<p class="warn">⚠️ BP of 140/90 or higher in pregnancy should be reported to the doctor promptly.</p>`;
  if (e.symptoms?.includes('Spotting')) return `<p class="warn">⚠️ Report any bleeding or spotting to the doctor.</p>`;
  return '';
}

function lineChart(points, { unit = '', label = '' } = {}) {
  if (points.length < 2) return empty('Add at least two entries to see a chart.');
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

function weightView() {
  const s = Store.state;
  const byDate = [...s.health].sort((a, b) => a.date.localeCompare(b.date));
  const wts = byDate.filter(e => e.weight).map(e => ({ x: e.date, y: Number(e.weight) }));
  const bps = byDate.filter(e => e.sys);
  const gain = wts.length > 1 ? (wts[wts.length - 1].y - wts[0].y).toFixed(1) : null;
  return card('Weight (kg)', `${gain !== null ? `<p>Change since first entry: <b>${gain > 0 ? '+' : ''}${gain} kg</b></p>` : ''}${lineChart(wts, { unit: ' kg', label: 'Weight over time' })}
    <p class="small muted">Typical total gain for a normal starting BMI is about 11–16 kg, mostly in trimesters 2–3. Her doctor will set the right target.</p>`)
    + card('Blood pressure', bps.length ? `<table class="table"><thead><tr><th>Date</th><th>BP</th></tr></thead><tbody>${bps.slice(-15).reverse().map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.sys}/${e.dia} ${Number(e.sys) >= 140 || Number(e.dia) >= 90 ? '⚠️' : ''}</td></tr>`).join('')}</tbody></table>` : empty('No readings yet. Log them in the Daily log.'));
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
    + card('Past sessions', hist.length ? `<ul class="list">${hist.map(h => `<li class="row"><span>${new Date(h.start).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span><b>${h.count}</b> in ${fmtDuration(h.end - h.start)}</span></li>`).join('')}</ul>` : empty('No sessions yet.'));
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

// ---------- medicines ----------
VIEWS.meds = () => {
  const s = Store.state;
  const today = isoDate();
  const editing = UI.editMed ? s.meds.find(m => m.id === UI.editMed) : null;
  const m = editing || { name: '', dose: '', times: ['09:00'], perDose: 1, stock: '', unit: 'tablet', refillDays: 5, notes: '' };
  const form = `<form data-form="med" class="form">
    <div class="grid2"><label>Medicine name<input name="name" required value="${esc(m.name)}" placeholder="e.g. Folic acid"></label>
      <label>Dose / strength<input name="dose" value="${esc(m.dose)}" placeholder="e.g. 5 mg, 1 tablet"></label></div>
    <label>Reminder times</label>
    <div class="grid3">${[0, 1, 2].map(i => `<input type="time" name="time" aria-label="Time ${i + 1}" value="${esc(m.times[i] || '')}">`).join('')}</div>
    <div class="grid3"><label>Per dose<input type="number" name="perDose" min="0.5" step="0.5" value="${esc(m.perDose)}"></label>
      <label>In stock<input type="number" name="stock" min="0" step="0.5" value="${esc(m.stock)}" placeholder="30"></label>
      <label>Unit<input name="unit" value="${esc(m.unit)}"></label></div>
    <div class="grid2"><label>Warn me when ≤ days left<input type="number" name="refillDays" min="0" value="${esc(m.refillDays)}"></label></div>
    <label>Notes<input name="notes" value="${esc(m.notes)}" placeholder="e.g. after food, not with tea"></label>
    <div class="btn-row"><button class="btn" type="submit">${editing ? 'Save changes' : 'Add medicine'}</button>${editing ? '<button class="btn ghost" type="button" data-act="cancelMed">Cancel</button>' : ''}</div>
  </form>`;
  const list = s.meds.length ? s.meds.map(m => {
    const left = medDaysLeft(m);
    const low = left !== null && left <= (m.refillDays ?? 5);
    const last7 = [...Array(7)].map((_, i) => addDays(today, -i));
    const due = m.times.length * 7, taken = s.medLog.filter(l => l.medId === m.id && last7.includes(l.date)).length;
    return `<article class="med ${m.active ? '' : 'inactive'}">
      <div class="row"><div><b>${esc(m.name)}</b> <span class="muted">${esc(m.dose)}</span></div>${low ? pill('Refill soon', 'danger') : m.active ? '' : pill('Paused')}</div>
      <p class="small">${m.times.map(esc).join(' · ')}${m.notes ? ' — ' + esc(m.notes) : ''}</p>
      <div class="med-slots">${m.times.map(slot => { const t = medTaken(m.id, today, slot); return `<button class="slot ${t ? 'on' : ''}" data-act="takeMed" data-id="${m.id}" data-slot="${slot}">${t ? '✓' : '○'} ${slot}</button>`; }).join('')}</div>
      <div class="row small"><span>Stock: <b>${m.stock === '' ? '—' : m.stock}</b> ${esc(m.unit)}(s)${left !== null ? ` · ~${left} days` : ''}</span><span>7-day: ${taken}/${due}</span></div>
      <div class="btn-row">
        <button class="btn small ghost" data-act="refill" data-id="${m.id}">+ Refill</button>
        <button class="btn small ghost" data-act="editMed" data-id="${m.id}">Edit</button>
        <button class="btn small ghost" data-act="toggleMed" data-id="${m.id}">${m.active ? 'Pause' : 'Resume'}</button>
        <button class="btn small ghost danger" data-act="delMed" data-id="${m.id}">Delete</button>
      </div></article>`;
  }).join('') : empty('No medicines yet. Common ones her doctor may prescribe: folic acid, iron, calcium, vitamin D, DHA. Only add what the doctor prescribed.');
  return `<h1>Medicines</h1>${card('Current medicines', list)}${card(editing ? 'Edit medicine' : 'Add medicine', form)}
    <p class="disclaimer">Marking a dose as taken reduces the stock automatically. Never start or stop medicines without asking the doctor.</p>`;
};

// ---------- visits & tests ----------
VIEWS.visits = () => {
  const s = Store.state;
  const info = pregnancyInfo();
  const today = isoDate();
  const a = UI.editAppt ? s.appts.find(x => x.id === UI.editAppt) : null;
  const v = a || { date: '', time: '', title: '', doctor: s.profile.doctorName, place: s.profile.hospital, notes: '', questions: '', testId: '' };
  const form = `<form data-form="appt" class="form">
    <label>What<input name="title" required value="${esc(v.title)}" placeholder="e.g. Monthly check-up, Anomaly scan"></label>
    <div class="grid2"><label>Date<input type="date" name="date" required value="${esc(v.date)}"></label><label>Time<input type="time" name="time" value="${esc(v.time)}"></label></div>
    <div class="grid2"><label>Doctor<input name="doctor" value="${esc(v.doctor)}"></label><label>Place<input name="place" value="${esc(v.place)}"></label></div>
    <label>Linked test<select name="testId"><option value="">—</option>${TESTS.map(t => `<option value="${t.id}" ${v.testId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <label>Questions to ask<textarea name="questions" rows="2" placeholder="Write them down as they come up">${esc(v.questions)}</textarea></label>
    <label>Notes / what the doctor said<textarea name="notes" rows="2">${esc(v.notes)}</textarea></label>
    <div class="btn-row"><button class="btn" type="submit">${a ? 'Save' : 'Add appointment'}</button>${a ? '<button class="btn ghost" type="button" data-act="cancelAppt">Cancel</button>' : ''}</div></form>`;

  const upcoming = s.appts.filter(x => !x.done).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const past = s.appts.filter(x => x.done).sort((x, y) => y.date.localeCompare(x.date));
  const apptItem = x => `<li><div class="row"><div><b>${esc(x.title)}</b><br><span class="small muted">${fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${x.time ? ' · ' + esc(x.time) : ''}${x.place ? ' · ' + esc(x.place) : ''}</span></div>
      ${!x.done && x.date < today ? pill('Past date', 'danger') : ''}</div>
      ${x.questions ? `<p class="small">❓ ${esc(x.questions)}</p>` : ''}${x.notes ? `<p class="small muted">📝 ${esc(x.notes)}</p>` : ''}
      <div class="btn-row"><button class="btn small ghost" data-act="doneAppt" data-id="${x.id}">${x.done ? 'Reopen' : 'Mark done'}</button><button class="btn small ghost" data-act="editAppt" data-id="${x.id}">Edit</button><button class="btn small ghost danger" data-act="delAppt" data-id="${x.id}">Delete</button></div></li>`;

  const tests = TESTS.map(t => {
    const [kind, label] = testStatus(t, info);
    const st = s.tests[t.id] || {};
    return `<li class="test ${kind}"><div class="row"><div><b>${esc(t.name)}</b><br><span class="small muted">Weeks ${t.from}${t.to !== t.from ? '–' + t.to : ''}</span></div>${pill(label, kind)}</div>
      <details><summary class="small">Details & result</summary><p class="small">${esc(t.detail)}</p>
        <form data-form="test" data-id="${t.id}" class="form inline"><input name="result" value="${esc(st.result || '')}" placeholder="Result / notes" aria-label="Result">
        <label class="check"><input type="checkbox" name="done" ${st.done ? 'checked' : ''}> Done</label><button class="btn small" type="submit">Save</button></form>
        <button class="btn small ghost" data-act="bookTest" data-id="${t.id}">Create appointment</button></details></li>`;
  }).join('');

  return `<h1>Doctor & tests</h1>
    ${card('Upcoming', upcoming.length ? `<ul class="list">${upcoming.map(apptItem).join('')}</ul>` : empty('No upcoming appointments.'))}
    ${card(a ? 'Edit appointment' : 'Add appointment', form)}
    ${card('Recommended tests & scans', `<p class="small muted">${esc(VISIT_CADENCE)}</p><ul class="list">${tests}</ul>`)}
    ${past.length ? card('Past visits', `<ul class="list">${past.map(apptItem).join('')}</ul>`) : ''}
    <p class="disclaimer">Test schedules vary by country, hospital and her health. Treat this as a checklist to discuss with the doctor.</p>`;
};

// ---------- food ----------
VIEWS.food = () => {
  const fd = foodDay();
  const info = pregnancyInfo();
  const extra = !info ? '' : info.trimester === 1 ? 'no extra calories needed yet' : info.trimester === 2 ? 'about 340 extra calories a day' : 'about 450 extra calories a day';
  return `<h1>Food & nutrition</h1>
    ${card('Today', `
      <div class="row"><span>💧 Water: <b>${fd.water}</b> / 10 glasses</span><span class="btn-row"><button class="btn small ghost" data-act="water" data-d="-1" aria-label="Remove a glass">−</button><button class="btn small" data-act="water" data-d="1">+ Glass</button></span></div>
      ${progressBar(Math.min(100, fd.water * 10), 'Water')}
      <ul class="checks">${FOOD_CHECKS.map(([id, label]) => `<li><label class="check"><input type="checkbox" data-act="foodCheck" data-id="${id}" ${fd.checks.includes(id) ? 'checked' : ''}> ${esc(label)}</label></li>`).join('')}</ul>
      <form data-form="meals" class="form"><label>What she ate today<textarea name="meals" rows="3" placeholder="Breakfast, lunch, snacks, dinner…">${esc(fd.meals)}</textarea></label><button class="btn small" type="submit">Save</button></form>
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
    ${segmented('who', UI.who, [['all', 'Everyone'], ['mom', 'Her'], ['dad', 'You']])}
    ${card('Today', `<ul class="checks">${tasks.map(t => `<li class="row"><label class="check"><input type="checkbox" data-act="daily" data-id="${t.id}" ${done.includes(t.id) ? 'checked' : ''}> ${esc(t.text)}</label>
      <span>${pill(whoLabel(t.who))}<button class="icon-btn" data-act="hideTask" data-id="${t.id}" aria-label="Remove task">✕</button></span></li>`).join('')}</ul>
      ${streak ? `<p class="ok">🔥 ${streak}-day streak (at least half the tasks done)</p>` : ''}
      <form data-form="dailyTask" class="form inline"><input name="text" required placeholder="Add a daily task" aria-label="New daily task">
        <select name="who" aria-label="For whom"><option value="both">Both</option><option value="mom">Her</option><option value="dad">You</option></select><button class="btn small" type="submit">Add</button></form>
      ${s.daily.hidden.length ? `<button class="btn small ghost" data-act="restoreTasks">Restore ${s.daily.hidden.length} removed task(s)</button>` : ''}`)}
    ${card('To-dos', `<form data-form="todo" class="form inline"><input name="text" required placeholder="e.g. Buy car seat" aria-label="New to-do"><input type="date" name="due" aria-label="Due date"><button class="btn small" type="submit">Add</button></form>
      ${todos.length ? `<ul class="checks">${todos.map(t => `<li class="row ${t.done ? 'is-done' : ''}"><label class="check"><input type="checkbox" data-act="todo" data-id="${t.id}" ${t.done ? 'checked' : ''}> ${esc(t.text)}</label>
        <span>${t.due ? pill(fmtDate(t.due, { day: 'numeric', month: 'short' }), !t.done && t.due < today ? 'danger' : '') : ''}<button class="icon-btn" data-act="delTodo" data-id="${t.id}" aria-label="Delete">✕</button></span></li>`).join('')}</ul>` : empty('Nothing here yet.')}`)}`;
};

// ---------- money ----------
VIEWS.money = () => {
  const s = Store.state;
  const mo = s.money;
  const spent = mo.expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const planned = mo.planned.reduce((a, p) => a + Number(p.estimate || 0), 0);
  const plannedLeft = mo.planned.filter(p => !p.bought).reduce((a, p) => a + Number(p.estimate || 0), 0);
  const claimable = mo.expenses.filter(e => e.claimable && !e.claimed).reduce((a, e) => a + Number(e.amount || 0), 0);
  const byCat = EXPENSE_CATEGORIES.map(c => [c, mo.expenses.filter(e => e.category === c).reduce((a, e) => a + Number(e.amount || 0), 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...byCat.map(([, v]) => v));
  const exps = [...mo.expenses].sort((a, b) => b.date.localeCompare(a.date));
  return `<h1>Money</h1>
    <div class="stats">
      <div class="stat"><span>Spent</span><b>${fmtMoney(spent)}</b></div>
      <div class="stat"><span>Budget left</span><b class="${mo.budget && spent > mo.budget ? 'neg' : ''}">${mo.budget ? fmtMoney(mo.budget - spent) : '—'}</b></div>
      <div class="stat"><span>Still to buy</span><b>${fmtMoney(plannedLeft)}</b></div>
      <div class="stat"><span>To claim</span><b>${fmtMoney(claimable)}</b></div>
    </div>
    ${card('Budget', `<form data-form="budget" class="form inline"><input type="number" name="budget" min="0" value="${esc(mo.budget || '')}" placeholder="Total pregnancy budget" aria-label="Total budget"><button class="btn small" type="submit">Set</button></form>
      ${mo.budget ? progressBar(Math.min(100, Math.round(spent / mo.budget * 100)), 'Budget used') + `<p class="small muted">${Math.round(spent / mo.budget * 100)}% used · planned purchases total ${fmtMoney(planned)}</p>` : ''}`)}
    ${card('Add expense', `<form data-form="expense" class="form">
      <div class="grid2"><label>Amount<input type="number" name="amount" min="0" step="any" required inputmode="decimal"></label><label>Date<input type="date" name="date" value="${isoDate()}"></label></div>
      <div class="grid2"><label>Category<select name="category">${EXPENSE_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select></label><label>Note<input name="note" placeholder="e.g. NT scan"></label></div>
      <label class="check"><input type="checkbox" name="claimable"> Claimable from insurance</label>
      <button class="btn" type="submit">Add</button></form>`)}
    ${byCat.length ? card('Where it went', `<ul class="hbars">${byCat.map(([c, v]) => `<li title="${esc(c)}: ${fmtMoney(v)}"><span class="lbl">${esc(c)}</span><span class="track"><span style="width:${(v / max * 100).toFixed(1)}%"></span></span><span class="val">${fmtMoney(v)}</span></li>`).join('')}</ul>`) : ''}
    ${card('Planned purchases', `<ul class="checks">${mo.planned.map(p => `<li class="row ${p.bought ? 'is-done' : ''}"><label class="check"><input type="checkbox" data-act="bought" data-id="${p.id}" ${p.bought ? 'checked' : ''}> ${esc(p.name)}</label>
        <span><input class="mini" type="number" min="0" value="${esc(p.estimate || '')}" placeholder="Est." data-change="estimate" data-id="${p.id}" aria-label="Estimate for ${esc(p.name)}"><button class="icon-btn" data-act="delPlanned" data-id="${p.id}" aria-label="Delete">✕</button></span></li>`).join('')}</ul>
      <form data-form="planned" class="form inline"><input name="name" required placeholder="Add item" aria-label="Item"><input type="number" name="estimate" min="0" placeholder="Estimate" aria-label="Estimate"><button class="btn small" type="submit">Add</button></form>`)}
    ${card('Expenses', exps.length ? `<ul class="list">${exps.map(e => `<li><div class="row"><div><b>${fmtMoney(e.amount)}</b> · ${esc(e.category)}<br><span class="small muted">${fmtDate(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</span></div>
        <span>${e.claimable ? `<button class="btn small ${e.claimed ? 'ghost' : ''}" data-act="claimed" data-id="${e.id}">${e.claimed ? '✓ Claimed' : 'Mark claimed'}</button>` : ''}<button class="icon-btn" data-act="delExpense" data-id="${e.id}" aria-label="Delete">✕</button></span></div></li>`).join('')}</ul>` : empty('No expenses yet. Keep every bill — you\'ll need them for insurance and taxes.'))}`;
};

// ---------- library ----------
VIEWS.library = () => {
  const s = Store.state;
  const items = [...LIBRARY, ...s.library.custom].filter(b => UI.libFilter === 'all' || b.for === UI.libFilter || b.for === 'both');
  const states = { '': 'Add to list', want: '📌 Want', reading: '📖 In progress', done: '✓ Finished' };
  const counts = { reading: 0, done: 0 };
  Object.values(s.library.status).forEach(v => { if (counts[v.state] !== undefined) counts[v.state]++; });
  return `<h1>Read & listen</h1>
    <p class="muted">${counts.reading} in progress · ${counts.done} finished. Tip: many of these are on audiobook apps — great for commutes.</p>
    ${segmented('libFilter', UI.libFilter, [['all', 'All'], ['mom', 'For her'], ['dad', 'For you']])}
    ${card('', `<ul class="list">${items.map(b => {
      const st = s.library.status[b.id] || { state: '', progress: 0 };
      return `<li><div class="row"><div><b>${esc(b.title)}</b> <span class="muted small">${b.type === 'podcast' ? '🎧' : '📘'} ${esc(b.by || '')}</span></div>${pill(whoLabel(b.for))}</div>
        ${b.why ? `<p class="small">${esc(b.why)} <span class="muted">· ${esc(b.when || '')}</span></p>` : ''}
        <div class="row"><button class="btn small ${st.state ? '' : 'ghost'}" data-act="libState" data-id="${b.id}">${states[st.state]}</button>
        ${st.state === 'reading' ? `<label class="small range">Progress <input type="range" min="0" max="100" step="5" value="${st.progress || 0}" data-change="libProgress" data-id="${b.id}"> ${st.progress || 0}%</label>` : ''}
        ${b.custom ? `<button class="icon-btn" data-act="delBook" data-id="${b.id}" aria-label="Delete">✕</button>` : ''}</div></li>`;
    }).join('')}</ul>`)}
    ${card('Add a book or podcast', `<form data-form="book" class="form"><div class="grid2"><label>Title<input name="title" required></label><label>Author / host<input name="by"></label></div>
      <div class="grid2"><label>Type<select name="type"><option value="book">Book</option><option value="podcast">Podcast / audio</option></select></label>
      <label>For<select name="for"><option value="both">Both</option><option value="mom">Her</option><option value="dad">You</option></select></label></div>
      <button class="btn" type="submit">Add</button></form>`)}`;
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
      <ul class="checks">${items.map(i => `<li><label class="check"><input type="checkbox" data-act="listItem" data-list="${l.id}" data-item="${esc(i)}" ${done.includes(i) ? 'checked' : ''}> ${esc(i)}</label></li>`).join('')}</ul>
      <form data-form="listItem" data-list="${l.id}" class="form inline"><input name="text" required placeholder="Add item" aria-label="Add item to ${esc(l.title)}"><button class="btn small" type="submit">Add</button></form></details>`;
  }).join('')}`;
};

// ---------- baby ----------
VIEWS.baby = () => {
  const b = Store.state.baby;
  if (!b.born) {
    return `<h1>Baby</h1>${card('When baby arrives', `<p>Switch on the baby tracker to log feeds, diapers, sleep and growth.</p>
      <form data-form="born" class="form"><div class="grid2"><label>Baby's name<input name="name" value="${esc(b.name)}"></label><label>Date of birth<input type="date" name="dob" required></label></div>
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
    ${card('Growth', `<form data-form="growth" class="form"><div class="grid3"><label>Date<input type="date" name="date" value="${today}"></label><label>Weight (kg)<input type="number" step="0.01" name="weight"></label><label>Length (cm)<input type="number" step="0.1" name="length"></label></div>
      <label>Head (cm)<input type="number" step="0.1" name="head"></label><button class="btn" type="submit">Add measurement</button></form>
      ${lineChart([...b.growth].filter(g => g.weight).sort((x, y) => x.date.localeCompare(y.date)).map(g => ({ x: g.date, y: Number(g.weight) })), { unit: ' kg', label: 'Baby weight' })}
      <p class="small muted">Ask the paediatrician to plot these on WHO growth charts at each visit. Add vaccination dates as appointments so you get reminders.</p>`)}`;
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

// ---------- settings ----------
VIEWS.settings = () => {
  const n = Store.state.notif;
  const perm = Notify.supported() ? Notification.permission : 'unsupported';
  return `<h1>Settings</h1>
    ${card('Profile', profileForm())}
    ${card('Reminders', `<p>Status: <b>${n.enabled && perm === 'granted' ? 'On' : 'Off'}</b></p>
      ${n.enabled && perm === 'granted' ? '' : '<button class="btn" data-act="enableNotif">Turn on notifications</button>'}
      <form data-form="notifTime" class="form inline"><label>Evening task check-in<input type="time" name="dailyTime" value="${esc(n.dailyTime)}"></label><button class="btn small" type="submit">Save</button></form>
      <p class="small muted">In-app reminders run while the app is open or in the background on most phones. For alarms that always fire, even when the app is closed, add everything to the phone's calendar:</p>
      <button class="btn ghost" data-act="exportICS">📅 Export to calendar (.ics)</button>
      <p class="small muted">Re-export after adding new medicines or appointments. Delete the old calendar first to avoid duplicates.</p>`)}
    ${card('Backup & sharing', `<p class="small">Data lives only on this device. Export a backup regularly — and import it on the other partner's phone to share.</p>
      <div class="btn-row"><button class="btn ghost" data-act="exportJSON">⬇️ Export backup</button><label class="btn ghost file">⬆️ Import backup<input type="file" accept="application/json,.json" data-change="importJSON" hidden></label></div>`)}
    ${card('Danger zone', '<button class="btn ghost danger" data-act="reset">Erase all data</button>')}
    <p class="disclaimer">Nest is an organiser, not medical advice. Always follow her doctor's guidance.</p>`;
};

VIEWS.more = () => `<h1>More</h1><nav class="tiles big-tiles" aria-label="All sections">
  ${[['#food', '🥗', 'Food & nutrition'], ['#tasks', '✅', 'Daily tasks & to-dos'], ['#money', '💰', 'Money'], ['#library', '📚', 'Read & listen'],
    ['#lists', '🧳', 'Checklists'], ['#baby', '👶', 'Baby tracker'], ['#week', '📖', 'Week by week'], ['#emergency', '🚨', 'Emergency'], ['#settings', '⚙️', 'Settings & backup']]
    .map(([h, i, l]) => `<a href="${h}"><span>${i}</span>${l}</a>`).join('')}</nav>`;

// ---------- actions (clicks) ----------
const ACTIONS = {
  seg(el) { UI[el.dataset.name] = el.dataset.val; render(); },
  takeMed(el) {
    const s = Store.state, today = isoDate(), { id, slot } = el.dataset;
    const m = s.meds.find(x => x.id === id);
    const idx = s.medLog.findIndex(l => l.medId === id && l.date === today && l.slot === slot);
    const per = Number(m.perDose) || 1;
    if (idx >= 0) { s.medLog.splice(idx, 1); if (m.stock !== '') m.stock = Number(m.stock) + per; }
    else { s.medLog.push({ medId: id, date: today, slot, at: Date.now() }); if (m.stock !== '') m.stock = Math.max(0, Number(m.stock) - per); }
    commit();
  },
  refill(el) {
    const m = Store.state.meds.find(x => x.id === el.dataset.id);
    const n = prompt(`How many ${m.unit}(s) did you buy?`, '30');
    if (n && !isNaN(n)) { m.stock = (Number(m.stock) || 0) + Number(n); commit(`Stock updated: ${m.stock}`); }
  },
  editMed(el) { UI.editMed = el.dataset.id; render(); document.querySelector('form[data-form="med"]')?.scrollIntoView({ behavior: 'smooth' }); },
  cancelMed() { UI.editMed = null; render(); },
  toggleMed(el) { const m = Store.state.meds.find(x => x.id === el.dataset.id); m.active = !m.active; commit(); },
  delMed(el) {
    if (!confirm('Delete this medicine and its history?')) return;
    const s = Store.state; s.meds = s.meds.filter(x => x.id !== el.dataset.id); s.medLog = s.medLog.filter(l => l.medId !== el.dataset.id); commit();
  },
  water(el) { const fd = foodDay(); fd.water = Math.max(0, fd.water + Number(el.dataset.d)); commit(); },
  foodCheck(el) { const fd = foodDay(); const id = el.dataset.id; fd.checks = el.checked ? [...new Set([...fd.checks, id])] : fd.checks.filter(x => x !== id); commit(); },
  daily(el) {
    const log = Store.state.daily.log, today = isoDate();
    const cur = log[today] || [];
    log[today] = el.checked ? [...new Set([...cur, el.dataset.id])] : cur.filter(x => x !== el.dataset.id);
    commit();
  },
  hideTask(el) {
    const d = Store.state.daily, id = el.dataset.id;
    if (d.custom.some(t => t.id === id)) d.custom = d.custom.filter(t => t.id !== id); else d.hidden.push(id);
    commit();
  },
  restoreTasks() { Store.state.daily.hidden = []; commit(); },
  todo(el) { const t = Store.state.todos.find(x => x.id === el.dataset.id); t.done = el.checked; commit(); },
  delTodo(el) { Store.state.todos = Store.state.todos.filter(x => x.id !== el.dataset.id); commit(); },
  delHealth(el) { if (confirm('Delete this entry?')) { Store.state.health = Store.state.health.filter(x => x.id !== el.dataset.id); commit(); } },
  kickStart() { UI.kick = { start: Date.now(), count: 0 }; render(); },
  kick() { UI.kick.count++; if (navigator.vibrate) navigator.vibrate(30); render(); },
  kickStop() {
    if (UI.kick.count > 0) Store.state.kicks.push({ id: uid(), start: UI.kick.start, end: Date.now(), count: UI.kick.count });
    UI.kick = null; commit('Session saved');
  },
  contrStart() { UI.contraction = { start: Date.now() }; render(); },
  contrStop() { Store.state.contractions.push({ id: uid(), start: UI.contraction.start, end: Date.now() }); UI.contraction = null; commit(); },
  contrClear() { if (confirm('Clear contraction history?')) { Store.state.contractions = []; commit(); } },
  editAppt(el) { UI.editAppt = el.dataset.id; render(); document.querySelector('form[data-form="appt"]')?.scrollIntoView({ behavior: 'smooth' }); },
  cancelAppt() { UI.editAppt = null; render(); },
  doneAppt(el) {
    const s = Store.state, a = s.appts.find(x => x.id === el.dataset.id);
    a.done = !a.done;
    if (a.done && a.testId) s.tests[a.testId] = { ...(s.tests[a.testId] || {}), done: true, date: a.date };
    commit(a.done ? 'Marked done. Add the doctor\'s notes with Edit.' : '');
  },
  delAppt(el) { if (confirm('Delete this appointment?')) { Store.state.appts = Store.state.appts.filter(x => x.id !== el.dataset.id); commit(); } },
  bookTest(el) {
    const t = TESTS.find(x => x.id === el.dataset.id);
    const date = dateForWeek(t.from);
    const s = Store.state;
    s.appts.push({ id: uid(), title: t.name, date: date && date > isoDate() ? date : isoDate(), time: '', doctor: s.profile.doctorName, place: s.profile.hospital, notes: '', questions: '', testId: t.id, done: false });
    UI.editAppt = s.appts[s.appts.length - 1].id;
    commit('Appointment drafted — set the exact date & time.');
    document.querySelector('form[data-form="appt"]')?.scrollIntoView({ behavior: 'smooth' });
  },
  bought(el) { const p = Store.state.money.planned.find(x => x.id === el.dataset.id); p.bought = el.checked; commit(); },
  delPlanned(el) { Store.state.money.planned = Store.state.money.planned.filter(x => x.id !== el.dataset.id); commit(); },
  claimed(el) { const e = Store.state.money.expenses.find(x => x.id === el.dataset.id); e.claimed = !e.claimed; commit(); },
  delExpense(el) { if (confirm('Delete this expense?')) { Store.state.money.expenses = Store.state.money.expenses.filter(x => x.id !== el.dataset.id); commit(); } },
  libState(el) {
    const st = Store.state.library.status;
    const order = ['', 'want', 'reading', 'done'];
    const cur = st[el.dataset.id] || { state: '', progress: 0 };
    cur.state = order[(order.indexOf(cur.state) + 1) % order.length];
    if (cur.state === 'done') cur.progress = 100;
    st[el.dataset.id] = cur;
    commit();
  },
  delBook(el) { Store.state.library.custom = Store.state.library.custom.filter(b => b.id !== el.dataset.id); commit(); },
  listItem(el) {
    const d = Store.state.checklists.done, { list, item } = el.dataset;
    const cur = d[list] || [];
    d[list] = el.checked ? [...new Set([...cur, item])] : cur.filter(x => x !== item);
    commit();
  },
  babyLog(el) { Store.state.baby.logs.push({ id: uid(), type: el.dataset.type, at: Date.now() }); commit('Logged'); },
  babySleep() {
    const b = Store.state.baby, open = b.logs.find(l => l.type === 'sleep' && !l.end);
    if (open) open.end = Date.now(); else b.logs.push({ id: uid(), type: 'sleep', at: Date.now() });
    commit();
  },
  delBabyLog(el) { Store.state.baby.logs = Store.state.baby.logs.filter(l => l.id !== el.dataset.id); commit(); },
  async enableNotif() { if (await Notify.enable()) { toast('Notifications on ✓'); Notify.check(); } render(); },
  exportICS() { download('nest-reminders.ics', buildICS(), 'text/calendar'); toast('Open the downloaded file to add it to your calendar.'); },
  exportJSON() { download(`nest-backup-${isoDate()}.json`, Store.exportJSON(), 'application/json'); },
  reset() { if (confirm('Erase ALL data on this device? Export a backup first!') && confirm('Really erase everything?')) { Store.reset(); location.hash = '#home'; render(); } },
};

// ---------- forms ----------
const FORMS = {
  profile(f, fd) {
    const p = Store.state.profile;
    for (const [k, v] of fd.entries()) p[k] = String(v).trim();
    if (!p.dueDate && !p.lmp && !Store.state.baby.born) { toast('Please enter a due date or the first day of the last period.'); return; }
    if (p.lmp && !p.dueDate) p.dueDate = addDays(p.lmp, 280);
    commit('Saved ✓');
  },
  health(f, fd) {
    const e = { id: uid(), date: fd.get('date') || isoDate(), weight: fd.get('weight'), sys: fd.get('sys'), dia: fd.get('dia'), sugar: fd.get('sugar'),
      symptoms: fd.getAll('symptoms'), mood: fd.get('mood') || '', sleep: fd.get('sleep'), notes: fd.get('notes').trim() };
    Store.state.health.push(e);
    commit('Entry saved');
    if (bpWarning(e)) toast('⚠️ Please check this reading with the doctor.');
  },
  med(f, fd) {
    const s = Store.state;
    const times = fd.getAll('time').filter(Boolean).sort();
    if (!times.length) { toast('Add at least one reminder time.'); return; }
    const data = { name: fd.get('name').trim(), dose: fd.get('dose').trim(), times, perDose: Number(fd.get('perDose')) || 1,
      stock: fd.get('stock') === '' ? '' : Number(fd.get('stock')), unit: fd.get('unit').trim() || 'tablet',
      refillDays: Number(fd.get('refillDays')) || 0, notes: fd.get('notes').trim() };
    if (UI.editMed) Object.assign(s.meds.find(m => m.id === UI.editMed), data);
    else s.meds.push({ id: uid(), active: true, ...data });
    UI.editMed = null;
    commit('Medicine saved');
  },
  appt(f, fd) {
    const s = Store.state;
    const data = Object.fromEntries(['title', 'date', 'time', 'doctor', 'place', 'notes', 'questions', 'testId'].map(k => [k, String(fd.get(k) || '').trim()]));
    if (UI.editAppt) Object.assign(s.appts.find(a => a.id === UI.editAppt), data);
    else s.appts.push({ id: uid(), done: false, ...data });
    UI.editAppt = null;
    commit('Appointment saved');
  },
  test(f, fd) {
    const s = Store.state, id = f.dataset.id;
    s.tests[id] = { ...(s.tests[id] || {}), result: fd.get('result').trim(), done: fd.get('done') === 'on', date: s.tests[id]?.date || isoDate() };
    commit('Saved');
  },
  meals(f, fd) { foodDay().meals = fd.get('meals'); commit('Saved'); },
  dailyTask(f, fd) { Store.state.daily.custom.push({ id: 'c_' + uid(), text: fd.get('text').trim(), who: fd.get('who') }); commit(); },
  todo(f, fd) { Store.state.todos.push({ id: uid(), text: fd.get('text').trim(), due: fd.get('due'), done: false }); commit(); },
  budget(f, fd) { Store.state.money.budget = Number(fd.get('budget')) || 0; commit(); },
  expense(f, fd) {
    Store.state.money.expenses.push({ id: uid(), amount: Number(fd.get('amount')), date: fd.get('date') || isoDate(), category: fd.get('category'),
      note: fd.get('note').trim(), claimable: fd.get('claimable') === 'on', claimed: false });
    commit('Expense added');
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
  notifTime(f, fd) { Store.state.notif.dailyTime = fd.get('dailyTime') || '21:00'; commit('Saved'); },
};

// ---------- change handlers (inputs that save without a submit) ----------
const CHANGES = {
  estimate(el) { const p = Store.state.money.planned.find(x => x.id === el.dataset.id); p.estimate = Number(el.value) || 0; Store.save(); render(); },
  libProgress(el) { const st = Store.state.library.status[el.dataset.id]; st.progress = Number(el.value); if (st.progress >= 100) st.state = 'done'; commit(); },
  importJSON(el) {
    const file = el.files[0];
    if (!file) return;
    file.text().then(t => {
      if (!confirm('Replace all data on this device with this backup?')) return;
      try { Store.importJSON(t); render(); toast('Backup imported ✓'); } catch (e) { toast('Import failed: ' + e.message); }
    });
  },
};

// ---------- router & wiring ----------
const TAB_OF = { home: 'home', week: 'home', health: 'health', meds: 'meds', visits: 'visits' };
function render() {
  const [route, arg] = (location.hash.slice(1) || 'home').split('/');
  const view = VIEWS[route] || VIEWS.home;
  document.getElementById('main').innerHTML = view(arg);
  const tab = TAB_OF[route] || 'more';
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  tickTimers();
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
  FORMS[f.dataset.form](f, new FormData(f));
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el);
});
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

document.addEventListener('toggle', e => {
  if (e.target.matches?.('details.list-card')) UI.openLists[e.target.dataset.list] = e.target.open;
}, true);

window.addEventListener('hashchange', () => { UI.editMed = null; UI.editAppt = null; render(); window.scrollTo(0, 0); });

Store.load();
render();
setInterval(tickTimers, 1000);
Notify.start();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
