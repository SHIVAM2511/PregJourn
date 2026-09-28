// "Just tell Nestling": turn a typed or spoken sentence into entries.
//   "paid 2500 for NT scan"            → expense ₹2,500 · Tests & scans
//   "bp 120/80 weight 62.4, headache"  → today's health log
//   "anomaly scan tuesday 10:30am"     → appointment
//   "took iron" / "all meds done"      → marks doses taken
//   "bought 30 calcium"                → refills stock
//   "buy car seat by next week"        → to-do
// Nothing is saved until the preview is confirmed.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SYMPTOM_WORDS = [
  ['Nausea', /nause|queasy|morning sickness/], ['Vomiting', /vomit|threw up|throwing up/], ['Fatigue', /tired|exhaust|fatigue|sleepy/],
  ['Headache', /headache|head ache|migraine/], ['Back pain', /back ?pain|backache|back hurts/], ['Heartburn', /heartburn|acidity|acid reflux|gas\b/],
  ['Constipation', /constipat/], ['Swelling', /swell|swollen|puffy/], ['Cramps', /cramp/], ['Insomnia', /insomnia|can'?t sleep|couldn'?t sleep|no sleep/],
  ['Spotting', /spotting|bleeding/], ['Dizziness', /dizz|lighthead/], ['Breathless', /breathless|short of breath|out of breath/],
  ['Anxiety', /anxious|anxiety|worried|nervous|stress/],
];
const MOOD_WORDS = [['😄', /\b(great|amazing|awesome|very happy|excited)\b/], ['🙂', /\b(good|happy|fine|better|well)\b/], ['😐', /\b(ok|okay|meh|so so)\b/],
  ['😔', /\b(sad|low|down|upset)\b/], ['😢', /\b(crying|cried|terrible|awful)\b/], ['😤', /\b(angry|irritated|cranky|annoyed|frustrated)\b/]];

function parseWhen(text) {
  const t = text.toLowerCase();
  const today = isoDate();
  let date = '', time = '';
  let m;
  if (/day after tomorrow/.test(t)) date = addDays(today, 2);
  else if (/\b(tomorrow|tmrw|tmr)\b/.test(t)) date = addDays(today, 1);
  else if (/\b(today|tonight)\b/.test(t)) date = today;
  else if ((m = t.match(/\bin (\d+|a|one|two|three|four) (day|days|week|weeks)\b/))) {
    const n = { a: 1, one: 1, two: 2, three: 3, four: 4 }[m[1]] || Number(m[1]);
    date = addDays(today, m[2].startsWith('week') ? n * 7 : n);
  } else if (/\bnext week\b/.test(t)) date = addDays(today, 7);
  else if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/)) ||
           (m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/))) {
    const day = Number(/\d/.test(m[1]) ? m[1] : m[2]);
    const mon = MONTHS.indexOf(/\d/.test(m[1]) ? m[2] : m[1]);
    const now = new Date();
    let d = new Date(now.getFullYear(), mon, day);
    if (isoDate(d) < today) d = new Date(now.getFullYear() + 1, mon, day);
    date = isoDate(d);
  } else if ((m = t.match(/\b(?:on |next |this )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/))) {
    const target = WEEKDAYS.indexOf(m[1]);
    const diff = (target - new Date().getDay() + 7) % 7 || 7;
    date = addDays(today, diff);
  }
  if ((m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/))) {
    let h = Number(m[1]) % 12;
    if (m[3] === 'pm') h += 12;
    time = `${pad(h)}:${m[2] || '00'}`;
  } else if ((m = t.match(/\b(?:at\s*)(\d{1,2})(?::(\d{2}))?\b/)) || (m = t.match(/\b(\d{1,2}):(\d{2})\b/))) {
    let h = Number(m[1]);
    if (h >= 1 && h < 8) h += 12; // "at 5" almost always means 5 pm for appointments
    if (h < 24) time = `${pad(h)}:${m[2] || '00'}`;
  }
  return { date, time };
}

function stripWhen(text) {
  return text
    .replace(/\b(day after tomorrow|tomorrow|tmrw|tmr|today|tonight|next week)\b/gi, '')
    .replace(/\bin (\d+|a|one|two|three|four) (days?|weeks?)\b/gi, '')
    .replace(/\b(on |next |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi, '')
    .replace(/\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, '')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?\b/gi, '')
    .replace(/\b(at\s*)?\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\bat\s*\d{1,2}(:\d{2})?\b/gi, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/\b(by|on|at|for)\s*$/i, '')
    .replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function findMed(t) {
  return Store.state.meds.find(m => {
    const first = m.name.toLowerCase().split(/[\s/]+/)[0];
    return first.length > 2 && t.includes(first);
  });
}

function parseQuick(raw) {
  const text = raw.trim();
  const t = text.toLowerCase();
  const s = Store.state;
  const today = isoDate();
  const actions = [];
  const add = (icon, label, apply) => actions.push({ icon, label, apply });
  let m;

  // ---- money ----
  const money = t.match(/(?:paid|spent|spend|cost|costs|₹|rs\.?|inr|\$|usd)\s*(\d[\d,]*(?:\.\d+)?)/) ||
                t.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:rs|rupees|₹|inr|bucks|dollars|usd)\b/);
  const med = findMed(t);
  const refill = !money && med && /\b(refill|restock|bought|got|purchased)\b/.test(t) && (m = t.match(/\b(\d{1,3})\b/));
  if (money) {
    const amount = Number(money[1].replace(/,/g, ''));
    const cat = (CATEGORY_WORDS.find(([, re]) => re.test(t)) || ['Other'])[0];
    const note = capitalize(text.replace(money[0], '').replace(/\b(paid|spent|spend|for|on|rs\.?|rupees|inr|₹|\$)\b/gi, '').replace(/\s{2,}/g, ' ').trim().replace(/^[,.\s-]+|[,.\s-]+$/g, ''));
    add(CATEGORY_ICONS[cat] || '💰', `Expense ${fmtMoney(amount)} · ${cat}${note ? ' · ' + note : ''}`, () => {
      s.money.expenses.push({ id: uid(), amount, date: today, category: cat, note, claimable: CLAIMABLE_CATEGORIES.includes(cat), claimed: false });
    });
  } else if (refill) {
    const n = Number(m[1]);
    add('📦', `Add ${n} ${med.unit || 'tablet'}(s) of ${med.name} to stock`, () => { med.stock = (Number(med.stock) || 0) + n; });
  }

  // ---- medicines taken ----
  if (!money && !refill && /\b(took|taken|take|had|gave|done)\b/.test(t)) {
    const all = /\b(all|every)\b.*\b(med|meds|medicine|medicines|tablets|pills)\b|\bmeds done\b/.test(t);
    const targets = all ? s.meds.filter(x => x.active) : (med ? [med] : []);
    for (const tm of targets) {
      const slot = tm.times.find(sl => !medTaken(tm.id, today, sl) && sl <= addMinutes(nowTime(), 90)) || tm.times.find(sl => !medTaken(tm.id, today, sl));
      if (slot) add('💊', `${tm.name} taken (${fmtTime(slot)})`, () => markTaken(tm, today, slot, true));
    }
  }

  // ---- health ----
  if ((m = t.match(/(?:bp|blood pressure)?\s*\b(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})\b/)) && Number(m[1]) >= 70 && Number(m[1]) <= 220 && Number(m[2]) >= 40 && Number(m[2]) <= 140) {
    const [sys, dia] = [m[1], m[2]];
    add('🩺', `Blood pressure ${sys}/${dia}${Number(sys) >= 140 || Number(dia) >= 90 ? ' ⚠️ high — tell the doctor' : ''}`, () => Object.assign(healthDay(today), { sys, dia }));
  }
  if (!money && ((m = t.match(/\b(?:weight|wt|weighs?|weighed)\s*(?:is\s*)?(\d{2,3}(?:\.\d+)?)/)) || (m = t.match(/\b(\d{2,3}(?:\.\d+)?)\s*kgs?\b/)))) {
    const w = Number(m[1]);
    if (w >= 30 && w <= 200) add('⚖️', `Weight ${w} kg`, () => { healthDay(today).weight = String(w); });
  }
  if ((m = t.match(/\b(?:sugar|glucose)\s*(?:is\s*|level\s*)?(\d{2,3})\b/))) add('🩸', `Blood sugar ${m[1]} mg/dL`, () => { healthDay(today).sugar = m[1]; });
  if ((m = t.match(/\b(\d+|a|one|two|three|four|five)?\s*(?:glass|glasses|bottle|bottles)\s*(?:of\s*)?water\b/)) || /\bdrank water\b/.test(t)) {
    const n = m && m[1] ? ({ a: 1, one: 1, two: 2, three: 3, four: 4, five: 5 }[m[1]] || Number(m[1])) : 1;
    add('💧', `Water +${n} glass${n > 1 ? 'es' : ''}`, () => { foodDay().water += n; });
  }
  const symptoms = SYMPTOM_WORDS.filter(([, re]) => re.test(t)).map(([n]) => n);
  if (symptoms.length && !money) {
    add('🤒', `Symptoms: ${symptoms.join(', ')}${symptoms.includes('Spotting') ? ' ⚠️ call the doctor about bleeding' : ''}`, () => {
      const h = healthDay(today);
      h.symptoms = [...new Set([...(h.symptoms || []), ...symptoms])];
      h.symptomsAsked = true;
    });
  }
  const mood = MOOD_WORDS.find(([, re]) => re.test(t));
  if (mood && /\b(feel|feeling|felt|mood|she'?s|i'?m|am)\b/.test(t)) add(mood[0], `Mood ${mood[0]}`, () => { healthDay(today).mood = mood[0]; });

  // ---- baby (after birth) ----
  if (s.baby.born) {
    const log = (type, label, icon) => add(icon, label, () => s.baby.logs.push({ id: uid(), type, at: Date.now() }));
    if (/\b(fed|feed|feeding|nursed|breastfed)\b/.test(t)) log(/bottle|formula/.test(t) ? 'feedB' : /right/.test(t) ? 'feedR' : 'feedL', 'Baby feed', '🍼');
    if (/\bwet\b/.test(t)) log('wet', 'Wet diaper', '💧');
    if (/\b(poop|poo|dirty|pooped)\b/.test(t)) log('dirty', 'Dirty diaper', '💩');
  }

  // ---- appointment or to-do ----
  const when = parseWhen(text);
  const handled = actions.length > 0;
  const apptWords = /\b(appointment|appt|check-?up|scan|ultrasound|sonography|visit|doctor|dr\.?|test|vaccine|injection|consult|class)\b/;
  const todoWords = /^(todo|to do|to-do|remind me to|remember to|need to|don'?t forget to|buy|call|book|pack|order|get|pick up|arrange|research|find|register|apply|pay)\b/;
  if (!money && !refill && !todoWords.test(t) && apptWords.test(t) && (when.date || when.time)) {
    const title = capitalize(stripWhen(text).replace(/^(i have|we have|there'?s|have)\s+(an?\s+)?/i, '').replace(/^(appointment|appt)\s+(for|with)\s+/i, '')) || 'Doctor appointment';
    const test = TESTS.find(x => { const w = x.name.toLowerCase().split(/[\s(/]/)[0]; return w.length > 3 && title.toLowerCase().includes(w); });
    const date = when.date || today;
    add('📅', `Appointment: ${title} · ${relDay(date)}${when.time ? ' ' + fmtTime(when.time) : ''}`, () => {
      s.appts.push({ id: uid(), title, date, time: when.time, doctor: s.profile.doctorName, place: s.profile.hospital, notes: '', questions: '', testId: test ? test.id : '', done: false });
    });
  } else if (!handled || todoWords.test(t)) {
    const txt = capitalize(stripWhen(text.replace(/^(todo|to do|to-do|remind me to|remember to|need to|don'?t forget to)\s*:?\s*/i, '')));
    if (txt) add('📝', `To-do: ${txt}${when.date ? ' · by ' + relDay(when.date) : ''}`, () => { s.todos.push({ id: uid(), text: txt, due: when.date, done: false }); });
  }
  return actions;
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

// ---------- voice input ----------
const Voice = {
  supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  listen(onText, onEnd) {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new R();
    rec.lang = navigator.language || 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = e => {
      finalText = Array.from(e.results).map(r => r[0].transcript).join(' ');
      onText(finalText, false);
    };
    rec.onerror = e => { if (e.error === 'not-allowed') toast('Microphone permission was blocked.'); };
    rec.onend = () => onEnd(finalText);
    rec.start();
    return rec;
  },
};
