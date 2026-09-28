// Reminders: checked every 30s while the app is open, plus calendar (.ics) export
// so the phone's own calendar can alert even when the app is closed.

const Notify = {
  supported() { return 'Notification' in window; },

  async enable() {
    if (!this.supported()) { toast('This browser does not support notifications. Use the calendar export instead.'); return false; }
    const perm = await Notification.requestPermission();
    Device.state.notif.enabled = perm === 'granted';
    Device.state.notif.asked = true;
    Device.save();
    if (perm !== 'granted') toast('Notifications were blocked. You can allow them in browser settings.');
    return perm === 'granted';
  },

  async show(title, body, tag) {
    toast(`🔔 ${title}: ${body}`);
    if (!Device.state.notif.enabled || !this.supported() || Notification.permission !== 'granted') return;
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) await reg.showNotification(title, { body, tag, icon: 'icon.svg', badge: 'icon.svg' });
      else new Notification(title, { body, tag, icon: 'icon.svg' });
    } catch (e) { /* toast already shown */ }
  },

  // Fire each reminder at most once, keyed by a stable string.
  once(key, title, body) {
    const sent = Device.state.notif.sent;
    if (sent[key]) return;
    sent[key] = Date.now();
    Device.save();
    this.show(title, body, key);
  },

  check() {
    const s = Store.state;
    const today = isoDate();
    const now = nowTime();
    
    // Medicines due now (within the last 2 hours and not taken)
    for (const m of s.meds.filter(m => m.active)) {
      for (const slot of m.times) {
        if (slot > now) continue;
        const [h, mi] = slot.split(':').map(Number);
        const minutesLate = (new Date().getHours() * 60 + new Date().getMinutes()) - (h * 60 + mi);
        if (minutesLate > 120) continue;
        if (medTaken(m.id, today, slot)) continue;
        this.once(`med:${m.id}:${today}:${slot}`, `💊 ${m.name}`, `Time for ${m.dose || m.perDose + ' ' + m.unit} (${fmtTime(slot)})`);
      }
      const left = medDaysLeft(m);
      if (left !== null && left <= (m.refillDays ?? 5)) {
        this.once(`stock:${m.id}:${today}`, `Refill ${m.name}`, `Only ${m.stock} ${m.unit}(s) left — about ${left} day(s).`);
      }
    }

    // Appointments: the day before (from 18:00) and 2 hours before
    for (const a of s.appts.filter(a => !a.done && a.date)) {
      const when = new Date(`${a.date}T${a.time || '09:00'}`);
      const hoursTo = (when - Date.now()) / 3600000;
      if (hoursTo > 0 && hoursTo <= 2) this.once(`appt2h:${a.id}`, `📅 ${a.title}`, `In about ${Math.max(1, Math.round(hoursTo * 60))} minutes${a.place ? ' at ' + a.place : ''}.`);
      else if (a.date === addDays(today, 1) && now >= '18:00') this.once(`appt1d:${a.id}`, `📅 Tomorrow: ${a.title}`, `${a.time || ''} ${a.place || ''}`.trim() || 'Don\'t forget!');
    }

    // Tests whose window has just opened
    const info = pregnancyInfo();
    if (info) {
      for (const t of TESTS) {
        if (s.tests[t.id]?.done || t.optional || s.appts.some(a => a.testId === t.id)) continue;
        if (info.week >= t.from && info.week <= t.to) this.once(`test:${t.id}`, '🧪 Test window open', `${t.name} (weeks ${t.from}–${t.to}). Time to book it.`);
      }
      if (info.week >= 4 && WEEKS[info.week]) this.once(`week:${info.week}`, `Week ${info.week} 🎉`, `Baby is about the size of a ${WEEKS[info.week][0]}. Open the app for this week's guide.`);
    }

    // Evening nudge for unfinished daily tasks
    if (now >= (Device.state.notif.dailyTime || '21:00')) {
      const tasks = dailyTasksFor(today);
      const done = s.daily.log[today] || [];
      const left = tasks.filter(t => !done.includes(t.id)).length;
      if (left > 0) this.once(`daily:${today}`, 'Daily check-in', `${left} of today's tasks are still open.`);
    }

    // Overdue to-dos, once a day
    const overdue = s.todos.filter(t => !t.done && t.due && t.due < today).length;
    if (overdue && now >= '09:00') this.once(`todo:${today}`, 'Overdue to-dos', `${overdue} to-do(s) are past their date.`);

    this.prune();
  },

  prune() {
    const sent = Device.state.notif.sent;
    const cutoff = Date.now() - 45 * 86400000;
    let changed = false;
    for (const k of Object.keys(sent)) {
      // Keep one-time keys (tests/weeks/appointments); drop old daily ones.
      if (/^(med|stock|daily|todo):/.test(k) && sent[k] < cutoff) { delete sent[k]; changed = true; }
    }
    if (changed) Device.save();
  },

  start() {
    this.check();
    setInterval(() => this.check(), 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
  },
};

// ---------- ICS calendar export ----------
function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m); }
function icsDate(date, time) { return date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : ''); }

function buildICS() {
  const s = Store.state;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nestling//Pregnancy Companion//EN', 'CALSCALE:GREGORIAN'];
  const ev = (id, fields, alarms) => {
    lines.push('BEGIN:VEVENT', `UID:${id}@nest`, `DTSTAMP:${stamp}`, ...fields);
    for (const trig of alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', `TRIGGER:${trig}`, 'END:VALARM');
    lines.push('END:VEVENT');
  };

  for (const m of s.meds.filter(m => m.active)) {
    for (const slot of m.times) {
      ev(`med-${m.id}-${slot.replace(':', '')}`, [
        `DTSTART:${icsDate(isoDate(), slot)}`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
        `SUMMARY:${icsEscape('💊 ' + m.name + (m.dose ? ' — ' + m.dose : ''))}`,
        `DESCRIPTION:${icsEscape(m.notes)}`,
      ], ['PT0M']);
    }
  }
  for (const a of s.appts.filter(a => !a.done && a.date && a.date >= isoDate())) {
    const fields = a.time
      ? [`DTSTART:${icsDate(a.date, a.time)}`, 'DURATION:PT1H']
      : [`DTSTART;VALUE=DATE:${icsDate(a.date)}`];
    ev(`appt-${a.id}`, [...fields, `SUMMARY:${icsEscape('📅 ' + a.title)}`, `LOCATION:${icsEscape(a.place)}`,
      `DESCRIPTION:${icsEscape([a.doctor, a.notes, a.questions && 'Questions: ' + a.questions].filter(Boolean).join('\n'))}`],
      a.time ? ['-P1D', '-PT2H'] : ['-PT15H']);
  }
  if (pregnancyInfo()) {
    for (const t of TESTS) {
      if (s.tests[t.id]?.done) continue;
      const start = dateForWeek(t.from);
      if (!start || addDays(start, (t.to - t.from + 1) * 7) < isoDate()) continue;
      ev(`test-${t.id}`, [`DTSTART;VALUE=DATE:${icsDate(start)}`, `SUMMARY:${icsEscape('🧪 Book: ' + t.name)}`,
        `DESCRIPTION:${icsEscape(`Weeks ${t.from}–${t.to}. ${t.detail}`)}`], ['PT9H']);
    }
    const due = pregnancyInfo().due;
    ev('duedate', [`DTSTART;VALUE=DATE:${icsDate(due)}`, 'SUMMARY:👶 Due date'], ['-P14D']);
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
