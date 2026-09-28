# Go-Wanderella — Nest 🤰👶

**Nest** is a pregnancy companion for first-time parents. It's one app for the whole journey: her health, medicines, doctor visits, tests, food, money, daily tasks, reading, and the baby once they arrive.

It's a plain HTML/CSS/JS installable web app (PWA). There's no server, no account and no build step. **All data stays on the phone** (browser `localStorage`).

## What's inside

| Section | What it does |
|---|---|
| **Today** | Current week + day, trimester, days to go, baby's size, a dad tip for the week, items that need attention (low stock, tests due, overdue to-dos), today's medicines, next appointment, tasks and water |
| **Week by week** | Weeks 1–42: baby's development, changes in her body, what you can do, and tests around that time |
| **Health** | Daily log (weight, BP, sugar, symptoms, mood, sleep, notes), weight chart, BP history with ≥140/90 warnings, **kick counter**, **contraction timer** with the 5-1-1 hint |
| **Meds** | Medicines with dose, up to 3 reminder times, and stock. Marking a dose taken reduces the stock; you get a refill warning N days before it runs out, plus a 7-day adherence count |
| **Visits** | Appointments with "questions to ask" and the doctor's notes, plus a checklist of the standard tests and scans (dating scan, NT/double marker, anomaly scan, OGTT, Tdap…) with their target dates worked out from the due date |
| **Food** | Water counter, daily nutrition checklist, meal notes, foods to eat and avoid, daily nutrient targets, morning-sickness tips |
| **Tasks** | Daily tasks for her, you, or both (new ones unlock by week, e.g. kick counts from week 28), custom tasks, a streak count, one-off to-dos with due dates |
| **Money** | Budget, expenses by category, planned purchases with estimates, insurance-claim tracking |
| **Read & listen** | Curated books and podcasts for her and for you, with want / reading / finished status and progress |
| **Checklists** | Hospital bags (mom, baby, dad), baby gear, paperwork & admin, **things first-time dads miss**, first weeks after birth |
| **Baby** | After birth: one-tap logs for feeds, diapers and sleep, plus growth measurements with a chart |
| **Emergency (SOS)** | One-tap calls to the doctor, hospital and ambulance, warning signs, and her key details (blood group, allergies, meds) ready for the hospital |
| **Settings** | Profile, notifications, **calendar export (.ics)**, backup export/import, erase data |

## Run it

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### Put it on your phones (free)
1. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, pick the branch and `/ (root)`.
2. Open the Pages URL on her phone (and yours).
3. Choose **Add to Home Screen**. It then opens like an app and works offline.

## Reminders — read this
- While the app is open (or recently in the background), it sends notifications for doses, appointments (the evening before and 2 hours before), refills, test windows, the new week, and an evening check-in for daily tasks.
- Web apps **can't reliably notify when fully closed**. For alarms that always fire, use **Settings → Export to calendar**. This adds daily medicine alarms, appointments, test windows and the due date to the phone's calendar.

## Sharing between both of you
The data lives on one device. Use **Settings → Export backup** and import the file on the other phone. Export regularly: clearing browser data erases everything.

## Files
```
index.html            app shell + bottom navigation
css/styles.css        styles (light + dark)
js/content.js         week-by-week guide, tests, food, books, checklists
js/store.js           storage, backup, date & pregnancy math
js/notify.js          reminders + .ics calendar export
js/app.js             all screens and interactions
sw.js, manifest.webmanifest, icon.svg   offline / installable app
```

> Nest is an organiser, not medical advice. Test schedules and nutrition targets are general guidance. Always follow her doctor.
