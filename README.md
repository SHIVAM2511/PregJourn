# Nestling 🐣

Nestling is a pregnancy companion for two people. It covers her health, medicines, doctor visits, tests, food, money, daily tasks, reading, and the baby once they arrive. It runs on both phones and stays in sync between them.

**It tells you things, and asks one thing at a time.**

- **Hero:** a progress ring, the baby's size as a picture (🫑 at week 18), and days to go. Her mood and today's water are single taps right in the hero.
- **Up next:** one card at a time, e.g. "Did Priya take today's medicines? → Yes, all 2". Answer it or tap *Later*, and the next one slides in.
- **Coming up:** built automatically from what the app already knows: the next visit, test windows opening, "Halfway there in 10 days", "Iron runs out in 12 days", the due date.
- **This week:** swipeable cards for the baby, for her and for you.
- **One small thing today:** a single suggested habit instead of a checklist.

**Adding things** is the ＋ button in the tab bar: big tiles (How she feels, Expense, Visit, Medicine, Weight, Kick count…), or just say it, by typing or with the 🎤 mic:

| You say | Nestling does |
|---|---|
| "paid 2500 for NT scan" | Expense ₹2,500 · Tests & scans (marked claimable) |
| "bp 150/95, feeling tired and headache" | Logs BP (with a ⚠️ high warning) + symptoms |
| "anomaly scan tomorrow 10:30am" | Appointment, linked to the anomaly-scan checklist item |
| "buy car seat by next week" | To-do with a due date |
| "bought 30 iron" | Adds 30 tablets to the Iron stock |
| "took all meds" | Marks today's due doses taken |

You see a preview before anything is saved, and every delete can be undone.

## What's inside

| Section | Highlights |
|---|---|
| **Today** | Everything above: progress ring, baby size, one-card-at-a-time check-ins, automatic timeline |
| **Health** | Mood, symptoms, sleep and weight on one screen, BP and sugar, a weight chart, **kick counter**, **contraction timer** (5-1-1) |
| **Meds** | Add common medicines with one tap; time-of-day chips; stock goes down automatically when a dose is taken; refill alerts |
| **Visits** | Appointments with "questions for the doctor", plus a standard tests & scans checklist with dates worked out from the due date |
| **Food** | Water, a daily nutrition checklist, foods to eat and avoid, nutrient targets |
| **Tasks** | Daily habits for her, you, or both (new ones unlock by week), and to-dos that understand "tomorrow" or "next week" |
| **Money** | Expenses added by tapping a category icon, budget, planned purchases, insurance claims |
| **Read & listen** | Books and podcasts for each of you, with progress |
| **Checklists** | Hospital bags, baby gear, paperwork, *things first-time dads miss*, the first weeks after birth |
| **Baby** | After birth: one-tap feed, diaper and sleep logs, growth chart |
| **SOS** | One-tap calls, warning signs, and her details ready for the hospital |

## Sharing between both phones (Supabase)

Nestling works fully offline on one phone. To share with your partner, connect a free Supabase project (about 5 minutes):

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It is safe to re-run.
3. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key into [`js/config.js`](js/config.js).
   The anon key is meant to be public. The row-level security in `schema.sql` is what keeps your data private.
4. **Authentication → URL Configuration**: set **Site URL** to wherever you host Nestling (e.g. `https://shivam2511.github.io/pregjourn/`), so the confirmation-email links open the app.
   *(Optional)* **Authentication → Providers → Email**: turn off "Confirm email" to skip the confirmation step.
5. In the app, go to **More → Share with partner**. Each of you creates an account. One of you taps **Create our family space** and shares the code (e.g. `ABCD-EF23`); the other taps **Join**.

How sync behaves:
- **Live**: a dose ticked on her phone shows up on yours within a second.
- **Offline-first**: everything works without internet, and changes sync when you're back online.
- **No lost edits**: if you both change things at the same moment, the changes are merged item by item. Two expenses added at once both stay. You editing a medicine's stock while she edits its notes keeps both edits. Only when you both change the *same field* does the last phone to sync win.
- **Private**: only members of your family space can read or write its data. Joining requires the invite code.
- **Per phone**: each phone keeps its own reminder settings.

## Run it

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

To put it on your phones for free: GitHub **Settings → Pages → Deploy from a branch**, pick `main` and `/ (root)`. The app is then at **https://shivam2511.github.io/pregjourn/**. Open it on each phone and choose **Add to Home Screen**. It then opens like an app and works offline.

## Reminders
Nestling sends notifications for doses, appointments (the evening before and 2 hours before), refills, test windows, the new week, and an evening check-in for daily tasks. It can do this while it's open or recently used. Web apps can't reliably notify when fully closed, so use **Settings → Add to calendar (.ics)** for alarms that always ring.

## Files
```
index.html                 app shell, bottom navigation, bottom sheet
css/styles.css             styles (light + dark)
js/content.js              week-by-week guide, tests, food, books, checklists, presets
js/store.js                local storage, dates, pregnancy math, 3-way merge
js/sync.js                 Supabase auth, family space, live sync
js/config.js               ← your Supabase URL + anon key
js/quickadd.js             "tell Nestling" sentence parser + voice input
js/notify.js               reminders + calendar export
js/app.js                  screens, check-in feed, actions
js/vendor/supabase.js      supabase-js v2.117.2 (MIT), bundled so it works offline
supabase/schema.sql        tables, row-level security, invite codes, realtime
sw.js, manifest.webmanifest, icon.svg   offline / installable app
```

> Nestling is an organiser, not medical advice. Test schedules and nutrition targets are general guidance. Always follow her doctor.
