// Static reference content. General guidance only — her doctor's advice always wins.

// Week-by-week: [size comparison, length, weight, baby, mom, dad tip]
const WEEKS = {
  1:  ['—', '', '', 'Pregnancy is dated from the first day of the last period, so conception hasn\'t happened yet.', 'Regular cycle. A good time to already be on folic acid.', 'Start the folic acid habit together — you take a vitamin too.'],
  2:  ['—', '', '', 'Ovulation and conception happen around the end of this week.', 'No symptoms yet.', 'Cut down alcohol and smoking at home — it helps both of you.'],
  3:  ['—', '', '', 'The fertilised egg travels to the uterus and starts dividing rapidly.', 'Some women notice light spotting as it implants.', 'Nothing to do yet — just be patient.'],
  4:  ['poppy seed', '0.1 cm', '', 'The embryo implants. The placenta and amniotic sac begin forming.', 'A missed period; home test may turn positive.', 'Congratulations! Book the first doctor visit together.'],
  5:  ['sesame seed', '0.2 cm', '', 'The neural tube (future brain and spine) is forming — folic acid matters most now.', 'Tiredness, tender breasts, needing to pee more.', 'Take over tasks that make her tired. Let her nap without guilt.'],
  6:  ['lentil', '0.6 cm', '', 'A heartbeat-like flicker may be seen on an ultrasound.', 'Nausea (“morning sickness”, any time of day) often starts.', 'Keep plain snacks (crackers, toast) by the bed for mornings.'],
  7:  ['blueberry', '1.3 cm', '', 'Arm and leg buds appear. The brain is growing quickly.', 'Nausea, food aversions, strong sense of smell.', 'Avoid cooking strong-smelling food around her if it bothers her.'],
  8:  ['raspberry', '1.6 cm', '1 g', 'Fingers and toes begin to form. Baby starts making tiny movements.', 'Bloating, mood swings, fatigue.', 'Go to the first scan with her. Save the picture.'],
  9:  ['cherry', '2.3 cm', '2 g', 'All essential organs have started forming. Tail is gone.', 'Clothes may feel tighter at the waist.', 'Start a shared note of questions for the doctor.'],
  10: ['strawberry', '3.1 cm', '4 g', 'Now officially a “fetus”. Vital organs are in place and starting to work.', 'Visible veins, continued nausea.', 'Start setting money aside — see the Money section.'],
  11: ['fig', '4.1 cm', '7 g', 'Bones begin to harden. Baby can hiccup.', 'Nausea may start easing for some.', 'Book the NT scan (11–14 weeks) if not already done.'],
  12: ['lime', '5.4 cm', '14 g', 'Reflexes develop; baby can open and close fingers.', 'Risk of miscarriage drops significantly after this point.', 'Decide together when and whom to tell.'],
  13: ['lemon', '7.4 cm', '23 g', 'Vocal cords and fingerprints are forming.', 'Last week of the first trimester — energy often returns.', 'Plan something relaxing together for the second trimester.'],
  14: ['peach', '8.7 cm', '43 g', 'Baby can squint, frown and make faces.', 'Appetite often returns. “Honeymoon trimester” begins.', 'Start a pregnancy-safe walk routine together.'],
  15: ['apple', '10 cm', '70 g', 'Baby can sense light through closed eyelids.', 'Possible nasal congestion and nosebleeds.', 'Research maternity/paternity leave policies at both your jobs.'],
  16: ['avocado', '11.6 cm', '100 g', 'Heart pumps around 25 litres of blood a day. Eyes can move.', 'Some feel the first flutters (“quickening”), usually 16–22 weeks.', 'Ask her to tell you when she first feels movement.'],
  17: ['pomegranate', '13 cm', '140 g', 'Skeleton is changing from cartilage to bone. Fat begins to form.', 'Growing bump; round ligament pain on the sides.', 'Help with a pregnancy pillow for better sleep.'],
  18: ['bell pepper', '14 cm', '190 g', 'Ears are in position; baby may begin to hear sounds.', 'Backache; sleeping on the side becomes more comfortable.', 'Start talking to the bump — baby is starting to hear.'],
  19: ['mango', '15 cm', '240 g', 'A protective waxy coating (vernix) covers the skin.', 'Possible dizziness; stand up slowly.', 'Book the anomaly scan (18–22 weeks).'],
  20: ['banana', '25 cm', '300 g', 'Halfway there! Baby swallows and practises digesting.', 'Belly button may pop out. Scan may show the sex (where legal).', 'Celebrate halfway. Start the nursery / baby-space plan.'],
  21: ['carrot', '27 cm', '360 g', 'Movements become stronger and more coordinated.', 'Possible leg cramps and swelling of feet.', 'Give her foot massages — it genuinely helps.'],
  22: ['papaya', '28 cm', '430 g', 'Eyebrows and eyelids are formed. Sense of touch develops.', 'Stretch marks may appear.', 'Start reading a book for fathers (see Library).'],
  23: ['grapefruit', '29 cm', '500 g', 'Baby can feel movement — like your rocking or walking.', 'Braxton Hicks (practice) contractions may start.', 'Learn the difference between practice and real contractions.'],
  24: ['corn cob', '30 cm', '600 g', 'Lungs are developing airways. Viability milestone.', 'Glucose test (24–28 weeks) coming up.', 'You might be able to feel kicks from outside now!'],
  25: ['cauliflower', '35 cm', '660 g', 'Baby responds to familiar voices.', 'Heartburn, trouble sleeping.', 'Keep antacids the doctor approves handy; smaller meals help.'],
  26: ['lettuce', '36 cm', '760 g', 'Eyes begin to open. Brain wave activity increases.', 'Blood pressure checks matter more now.', 'Sign up for a childbirth / parenting class together.'],
  27: ['cabbage', '37 cm', '875 g', 'Baby sleeps and wakes on a regular pattern.', 'Last week of the second trimester.', 'Research and shortlist paediatricians.'],
  28: ['eggplant', '38 cm', '1 kg', 'Eyes open and close; baby can blink. Third trimester begins.', 'Start daily kick counting. Visits become more frequent.', 'Learn the warning signs (Emergency tab) by heart.'],
  29: ['butternut squash', '39 cm', '1.15 kg', 'Muscles and lungs keep maturing. Head grows for the brain.', 'Shortness of breath, frequent urination.', 'Do more of the lifting and bending at home.'],
  30: ['cucumber', '40 cm', '1.3 kg', 'Baby\'s bone marrow now makes red blood cells.', 'Fatigue returns; sleep is harder.', 'Start assembling the crib / car seat.'],
  31: ['coconut', '41 cm', '1.5 kg', 'All five senses are working.', 'Leaky breasts (colostrum) can start.', 'Tour the hospital / birthing centre together.'],
  32: ['squash', '42 cm', '1.7 kg', 'Baby practises breathing; toenails are here.', 'Growth scan often around now.', 'Draft a birth plan together and share it with the doctor.'],
  33: ['pineapple', '44 cm', '1.9 kg', 'Bones harden, except the skull which stays soft for birth.', 'Pelvic pressure increases.', 'Plan the route to the hospital and a backup route.'],
  34: ['cantaloupe', '45 cm', '2.1 kg', 'Central nervous system and lungs are maturing.', 'Blurry vision or swelling — report sudden changes!', 'Pack the hospital bags (Checklists tab).'],
  35: ['honeydew melon', '46 cm', '2.4 kg', 'Rapid weight gain for baby. Kidneys are fully developed.', 'Weekly visits often start around 36 weeks.', 'Install the car seat properly — many are fitted wrong.'],
  36: ['papaya (large)', '47 cm', '2.6 kg', 'Baby may drop lower into the pelvis (“lightening”).', 'Easier breathing but more pressure on the bladder.', 'Keep your phone charged and the tank full.'],
  37: ['winter melon', '49 cm', '2.9 kg', 'Early term. Baby practises sucking and gripping.', 'Mucus plug may come out.', 'Prepare freezer meals for the first weeks home.'],
  38: ['pumpkin', '50 cm', '3.1 kg', 'Organs are ready for life outside.', 'Contractions may become more frequent.', 'Arrange help (family/friends) for the first weeks.'],
  39: ['watermelon', '51 cm', '3.3 kg', 'Full term. Brain is still developing fast.', 'Watch for labour signs: regular contractions, water breaking.', 'Time contractions with the timer in the Health tab.'],
  40: ['small pumpkin', '51 cm', '3.5 kg', 'Due date! Only ~5% of babies arrive on the exact day.', 'Doctor may discuss next steps if labour doesn\'t start.', 'Stay calm, stay close. You\'ve got this.'],
  41: ['watermelon', '52 cm', '3.6 kg', 'Past due — still normal. Extra monitoring is common.', 'Doctor may recommend monitoring or induction.', 'Follow the doctor\'s plan and keep her company.'],
  42: ['watermelon', '52 cm', '3.7 kg', 'Most doctors recommend delivery by this point.', 'Induction is common by now.', 'Almost there!'],
};

// Recommended tests / visits by gestational week. Schedules differ by country and doctor.
const TESTS = [
  { id: 't_first', from: 6, to: 10, name: 'First prenatal visit', detail: 'Confirm pregnancy, calculate due date, medical history, start folic acid & prenatal vitamins.' },
  { id: 't_dating', from: 6, to: 10, name: 'Dating / viability ultrasound', detail: 'Confirms heartbeat, number of babies and due date.' },
  { id: 't_blood1', from: 6, to: 12, name: 'First-trimester blood & urine tests', detail: 'CBC (haemoglobin), blood group & Rh, blood sugar, thyroid (TSH), HIV, Hepatitis B, syphilis (VDRL), rubella immunity, urine routine.' },
  { id: 't_nipt', optional: true, from: 10, to: 14, name: 'NIPT (optional)', detail: 'Cell-free DNA blood test screening for chromosomal conditions. Ask if recommended.' },
  { id: 't_nt', from: 11, to: 14, name: 'NT scan + double marker', detail: 'First-trimester combined screening: nuchal translucency scan with blood test.' },
  { id: 't_quad', optional: true, from: 15, to: 20, name: 'Quadruple marker (if advised)', detail: 'Second-trimester blood screening — usually only if the first-trimester screening was not done.' },
  { id: 't_anomaly', from: 18, to: 22, name: 'Anomaly scan (Level II / TIFFA)', detail: 'Detailed ultrasound checking the baby\'s organs, spine, heart, and placenta position.' },
  { id: 't_gtt', from: 24, to: 28, name: 'Glucose tolerance test (OGTT)', detail: 'Screens for gestational diabetes. Usually fasting — confirm instructions.' },
  { id: 't_cbc2', from: 26, to: 30, name: 'Repeat CBC / haemoglobin', detail: 'Checks for anaemia in the third trimester.' },
  { id: 't_antid', optional: true, from: 28, to: 28, name: 'Anti-D injection (only if Rh negative)', detail: 'Given if her blood group is Rh-negative. Ask the doctor.' },
  { id: 't_tdap', from: 27, to: 36, name: 'Tdap / Td vaccine', detail: 'Protects the newborn against whooping cough and tetanus. Timing per her doctor.' },
  { id: 't_growth', from: 28, to: 34, name: 'Growth scan / Doppler', detail: 'Checks the baby\'s growth, fluid and blood flow.' },
  { id: 't_gbs', optional: true, from: 35, to: 37, name: 'Group B strep swab (where routine)', detail: 'Routine in some countries. Ask if it applies.' },
  { id: 't_nst', from: 36, to: 42, name: 'NST / weekly check-ups', detail: 'Non-stress test and weekly visits as advised near the due date.' },
  { id: 't_flu', optional: true, from: 4, to: 40, name: 'Flu vaccine (during flu season)', detail: 'Safe in any trimester and recommended in many countries. Ask the doctor.' },
];

const VISIT_CADENCE = 'Typical rhythm: about every 4 weeks until week 28, every 2 weeks until 36, then weekly — your doctor may differ.';

const WARNING_SIGNS = [
  'Vaginal bleeding or leaking fluid',
  'Severe or persistent headache, or vision changes (blurring, spots, flashes)',
  'Sudden swelling of the face, hands or feet',
  'Severe belly pain or cramping that doesn\'t go away',
  'Fever of 38°C / 100.4°F or higher',
  'Baby moving less than usual (after 28 weeks) — don\'t wait until the next day',
  'Regular contractions before 37 weeks',
  'Vomiting so much she can\'t keep fluids down',
  'Chest pain, trouble breathing, or fainting',
  'Pain or burning when urinating',
  'Pain, redness or swelling in one leg',
  'Feeling hopeless, very anxious, or thoughts of self-harm — at any time, including after birth',
];

const FOOD_EAT = [
  ['Leafy greens, lentils, beans', 'Folate and iron'],
  ['Milk, curd/yoghurt, paneer, pasteurised cheese', 'Calcium and protein'],
  ['Eggs (fully cooked), chicken, fish low in mercury', 'Protein, B12, choline'],
  ['Salmon, sardines, walnuts, flax/chia seeds', 'Omega-3 / DHA for baby\'s brain'],
  ['Citrus, guava, amla, tomatoes, bell pepper', 'Vitamin C — helps absorb iron'],
  ['Whole grains, oats, millets, brown rice', 'Fibre (helps constipation) and energy'],
  ['Dates, figs, raisins, jaggery (in moderation)', 'Iron and quick energy'],
  ['Nuts and seeds', 'Healthy fats, protein, magnesium'],
  ['Plenty of water, coconut water, buttermilk', 'Hydration — about 2.5–3 litres a day'],
];

const FOOD_AVOID = [
  ['Alcohol', 'No known safe amount in pregnancy'],
  ['Raw or undercooked meat, eggs, seafood', 'Salmonella, listeria, toxoplasma'],
  ['Unpasteurised milk and soft cheeses (brie, feta, blue) unless pasteurised', 'Listeria'],
  ['High-mercury fish: shark, swordfish, king mackerel, tilefish, bigeye tuna', 'Mercury harms the baby\'s nervous system'],
  ['More than 200 mg caffeine a day (~2 cups of coffee)', 'Linked to low birth weight'],
  ['Raw sprouts; unwashed fruits and vegetables', 'Bacteria'],
  ['Liver and high-dose vitamin A supplements', 'Too much vitamin A can harm the baby'],
  ['Unripe / semi-ripe papaya (commonly advised)', 'Contains latex that may trigger contractions'],
  ['Herbal remedies or supplements not cleared by the doctor', 'Many aren\'t tested in pregnancy'],
  ['Smoking and second-hand smoke', 'Includes the partner smoking indoors'],
];

const NUTRIENTS = [
  ['Folic acid', '400–600 mcg / day', 'Especially critical in the first 12 weeks'],
  ['Iron', '27 mg / day', 'Take with vitamin C, not with tea/coffee/calcium'],
  ['Calcium', '1000 mg / day', 'Space it apart from iron tablets'],
  ['Protein', '~70 g / day', 'From the second trimester'],
  ['DHA (omega-3)', '200–300 mg / day', 'Fish, algae oil, or supplement if advised'],
  ['Iodine', '220 mcg / day', 'Iodised salt'],
  ['Vitamin D', '600 IU / day', 'Many need a supplement — ask the doctor'],
  ['Extra calories', 'T1: none · T2: ~340 · T3: ~450', 'Eating “for two” is a myth'],
];

// Daily food checklist
const FOOD_CHECKS = [
  ['greens', 'Green leafy vegetables'],
  ['protein', 'Protein at every meal'],
  ['dairy', '2–3 servings of dairy / calcium'],
  ['fruit', '2+ fruits (one rich in vitamin C)'],
  ['grains', 'Whole grains / fibre'],
  ['omega', 'Nuts, seeds or omega-3 source'],
];

// Default daily tasks. minWeek/maxWeek restrict when they appear. who: mom|dad|both
const DAILY_TASKS = [
  { id: 'd_water', text: 'Drink 8–10 glasses of water', who: 'mom' },
  { id: 'd_walk', text: '20–30 min walk or prenatal exercise (if doctor approves)', who: 'both' },
  { id: 'd_kegel', text: 'Pelvic floor (Kegel) exercises', who: 'mom' },
  { id: 'd_read', text: '15 min reading / listening from the Library', who: 'both' },
  { id: 'd_rest', text: 'Rest with feet up for a while', who: 'mom', minWeek: 20 },
  { id: 'd_talk', text: 'Talk, read or sing to the baby', who: 'both', minWeek: 18 },
  { id: 'd_kicks', text: 'Kick count session (Health tab)', who: 'mom', minWeek: 28 },
  { id: 'd_checkin', text: 'Ask her how she\'s really feeling — and listen', who: 'dad' },
  { id: 'd_chore', text: 'Take one chore completely off her plate', who: 'dad' },
  { id: 'd_massage', text: 'Back or foot massage', who: 'dad', minWeek: 14 },
];

const LIBRARY = [
  { id: 'b1', type: 'book', title: 'What to Expect When You\'re Expecting', by: 'Heidi Murkoff', for: 'both', when: 'Any time', why: 'The classic month-by-month reference.' },
  { id: 'b2', type: 'book', title: 'Expecting Better', by: 'Emily Oster', for: 'both', when: 'Trimester 1', why: 'Data-driven look at pregnancy rules (caffeine, food, tests).' },
  { id: 'b3', type: 'book', title: 'Mayo Clinic Guide to a Healthy Pregnancy', by: 'Mayo Clinic', for: 'mom', when: 'Any time', why: 'Medically reviewed, calm and thorough.' },
  { id: 'b4', type: 'book', title: 'The Expectant Father', by: 'Armin A. Brott & Jennifer Ash', for: 'dad', when: 'Any time', why: 'Month-by-month guide written for dads.' },
  { id: 'b5', type: 'book', title: 'The Birth Partner', by: 'Penny Simkin', for: 'dad', when: 'Trimester 3', why: 'How to actually support her during labour.' },
  { id: 'b6', type: 'book', title: 'Ina May\'s Guide to Childbirth', by: 'Ina May Gaskin', for: 'mom', when: 'Trimester 2–3', why: 'Reassuring birth stories and preparation.' },
  { id: 'b7', type: 'book', title: 'The Womanly Art of Breastfeeding', by: 'La Leche League International', for: 'mom', when: 'Trimester 3', why: 'The go-to breastfeeding guide.' },
  { id: 'b8', type: 'book', title: 'The Happiest Baby on the Block', by: 'Harvey Karp', for: 'both', when: 'Trimester 3', why: 'Soothing techniques for newborns (the 5 S\'s).' },
  { id: 'b9', type: 'book', title: 'Cribsheet', by: 'Emily Oster', for: 'both', when: 'Before birth', why: 'Data-driven guide to the baby years.' },
  { id: 'b10', type: 'book', title: 'The Wonder Weeks', by: 'Hetty van de Rijt & Frans Plooij', for: 'both', when: 'After birth', why: 'Understand baby\'s developmental leaps and fussy phases.' },
  { id: 'b11', type: 'book', title: 'The Whole-Brain Child', by: 'Daniel J. Siegel & Tina Payne Bryson', for: 'both', when: 'Later', why: 'Parenting with brain development in mind.' },
  { id: 'p1', type: 'podcast', title: 'The Birth Hour', by: 'Bryn Huntpalmer', for: 'both', when: 'Any time', why: 'Real birth stories — many kinds of births.' },
  { id: 'p2', type: 'podcast', title: 'Evidence Based Birth', by: 'Rebecca Dekker', for: 'both', when: 'Trimester 2–3', why: 'Research behind common birth choices.' },
];

const CHECKLISTS = [
  { id: 'bag_mom', title: 'Hospital bag — Mom', minWeek: 32, items: [
    'ID, insurance card, hospital file & all reports', 'Birth plan (printed)', 'Comfortable nightwear / front-opening kurtis', 'Nursing bras & breast pads',
    'Maternity pads & disposable underwear', 'Slippers & warm socks', 'Toiletries, lip balm, hair ties', 'Phone charger (long cable)',
    'Snacks & water bottle with straw', 'Going-home outfit (loose)', 'Nipple cream', 'Spectacles / contact lens case',
  ]},
  { id: 'bag_baby', title: 'Hospital bag — Baby', minWeek: 32, items: [
    'Newborn clothes (3–4 sets)', 'Swaddles / wrapping cloths', 'Cap, mittens, socks', 'Newborn diapers & wipes',
    'Soft towel', 'Blanket', 'Car seat installed in the car', 'Going-home outfit',
  ]},
  { id: 'bag_dad', title: 'Hospital bag — Dad', minWeek: 32, items: [
    'Change of clothes (2 days)', 'Toiletries', 'Chargers & power bank', 'Snacks & cash for parking/canteen',
    'List of people to call', 'Pillow & light blanket', 'Copies of ID & insurance',
  ]},
  { id: 'gear', title: 'Baby gear & nursery', minWeek: 20, items: [
    'Crib / bassinet with firm mattress', 'Car seat (rear-facing)', 'Stroller / pram', 'Baby carrier',
    'Diapers (newborn + size 1) & wipes', 'Changing mat', 'Baby clothes (0–3 months)', 'Swaddles & sleep sacks',
    'Baby bathtub & mild wash', 'Feeding bottles & sterilizer (even if breastfeeding)', 'Burp cloths & bibs', 'Digital thermometer',
    'Nail clippers / file', 'Baby first-aid kit', 'Room thermometer / fan', 'Breast pump (if planned)',
  ]},
  { id: 'admin', title: 'Paperwork & admin', minWeek: 4, items: [
    'Check health insurance maternity coverage & waiting period', 'Inform HR; apply for maternity leave', 'Apply for paternity leave',
    'Choose & register with the delivery hospital', 'Pre-register / pre-authorise insurance cashless admission', 'Keep all medical bills for claims',
    'Birth registration & birth certificate after delivery', 'Add baby to health insurance', 'Update / write a will & nominee details',
    'Start a savings / investment plan for the child', 'Life insurance review', 'Baby\'s ID documents (e.g. Aadhaar, passport) after birth',
  ]},
  { id: 'dad', title: 'Things first-time dads miss', minWeek: 4, items: [
    'Know her blood group, allergies and doctor\'s number by heart', 'Save doctor, hospital & ambulance numbers in your phone',
    'Learn the warning signs (Emergency tab)', 'Attend at least the major scans with her', 'Do a trial run of the drive to the hospital, day and night',
    'Keep the car fuelled and phone charged from week 36', 'Learn to swaddle, change a diaper, and burp a baby', 'Learn infant CPR / take a newborn care class',
    'Choose a paediatrician before birth', 'Plan who handles cooking & cleaning for the first 6 weeks', 'Set boundaries for visitors after birth',
    'Watch for postpartum depression signs — in her and in yourself', 'Take lots of photos of the bump (she\'ll want them later)',
    'Plan a small “babymoon” in the second trimester', 'Baby-proof home basics (sockets, sharp corners) before crawling',
  ]},
  { id: 'postpartum', title: 'After birth — first weeks', minWeek: 34, items: [
    'Postpartum check-up for mom (usually around 6 weeks)', 'Baby\'s first paediatrician visit & vaccination schedule', 'Newborn screening tests (heel prick, hearing)',
    'Birth certificate', 'Arrange lactation consultant if breastfeeding is hard', 'Meals prepared / help arranged',
    'Rest schedule — take night shifts in turns', 'Keep tracking baby feeds, diapers and sleep (Baby tab)',
  ]},
];

const EXPENSE_CATEGORIES = ['Doctor visits', 'Tests & scans', 'Medicines', 'Food & supplements', 'Maternity clothes', 'Baby gear', 'Hospital & delivery', 'Classes', 'Insurance', 'Other'];

const PLANNED_DEFAULTS = [
  ['Delivery / hospital package', 0], ['Scans & tests (total)', 0], ['Car seat', 0], ['Crib / bassinet', 0],
  ['Stroller', 0], ['Diapers — first 3 months', 0], ['Baby clothes', 0], ['Childbirth class', 0],
];

const SYMPTOMS = ['Nausea', 'Vomiting', 'Fatigue', 'Headache', 'Back pain', 'Heartburn', 'Constipation', 'Swelling', 'Cramps', 'Insomnia', 'Spotting', 'Dizziness', 'Breathless', 'Anxiety'];
const MOODS = ['😄', '🙂', '😐', '😔', '😢', '😤'];

// ---------- one-tap presets (so adding things is tapping, not typing) ----------
// Timings are only suggestions — match what the doctor prescribed.
const MED_PRESETS = [
  { name: 'Folic acid', times: ['09:00'], notes: '' },
  { name: 'Prenatal multivitamin', times: ['09:00'], notes: 'After breakfast' },
  { name: 'Iron', times: ['14:00'], notes: 'After lunch · not with milk, tea or calcium' },
  { name: 'Calcium', times: ['10:00', '21:00'], notes: 'Keep 2 hours apart from iron' },
  { name: 'Vitamin D', times: ['09:00'], notes: '' },
  { name: 'DHA / Omega-3', times: ['20:00'], notes: 'With dinner' },
];

const TIME_SLOTS = [['07:00', '🌅 Early'], ['09:00', '☀️ Morning'], ['14:00', '🍽 Afternoon'], ['18:00', '🌇 Evening'], ['21:00', '🌙 Night']];

const APPT_KINDS = [['Check-up', '🩺'], ['Scan', '🖥'], ['Blood test', '🩸'], ['Vaccine', '💉'], ['Class', '🎓'], ['Other', '📅']];

const CATEGORY_ICONS = {
  'Doctor visits': '🩺', 'Tests & scans': '🧪', 'Medicines': '💊', 'Food & supplements': '🥗', 'Maternity clothes': '👗',
  'Baby gear': '🍼', 'Hospital & delivery': '🏥', 'Classes': '🎓', 'Insurance': '🛡', 'Other': '🧾',
};
const CLAIMABLE_CATEGORIES = ['Doctor visits', 'Tests & scans', 'Medicines', 'Hospital & delivery'];

// Words that hint at an expense category when typing/saying "paid 2500 for NT scan"
const CATEGORY_WORDS = [
  ['Tests & scans', /scan|ultrasound|sonography|usg|test|blood|report|lab|nt\b|nipt|marker|tiffa|anomaly|doppler|gtt|ogtt/],
  ['Medicines', /medicine|meds|tablet|pharmacy|chemist|capsule|syrup|folic|iron|calcium|vitamin|injection/],
  ['Doctor visits', /doctor|dr\.?\s|consult|visit|fee|opd|gyn|obgyn/],
  ['Hospital & delivery', /hospital|delivery|admission|labou?r|c-?section|room/],
  ['Baby gear', /crib|cot|stroller|pram|diaper|nappy|car seat|carrier|bottle|baby|swaddle|onesie/],
  ['Maternity clothes', /maternity|dress|kurti|bra|clothes|leggings/],
  ['Food & supplements', /food|fruit|grocer|protein|milk|dry ?fruit|nuts|supplement|meal/],
  ['Classes', /class|course|yoga|lamaze|workshop/],
  ['Insurance', /insurance|premium|policy/],
];

const SLEEP_OPTIONS = [['4', '< 5h'], ['5.5', '5–6h'], ['7', '6–8h'], ['8.5', '8h+']];
