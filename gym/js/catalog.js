// Equipment, exercises and training splits. Plain data, no logic.

// on: in Ben's gym (his list, 2026-10-26). He can tick more under My gym.
// words: what to match when Ben types or names new equipment.
export const EQUIPMENT = [
  { id: 'treadmill', name: 'Treadmill', cat: 'Cardio', on: true, words: ['treadmill', 'incline walk'] },
  { id: 'elliptical', name: 'Elliptical', cat: 'Cardio', on: true, words: ['elliptical', 'cross trainer', 'crosstrainer'] },
  { id: 'bike', name: 'Stationary bike', cat: 'Cardio', on: false, words: ['bike', 'cycle', 'spin'] },
  { id: 'stairs', name: 'Stair climber', cat: 'Cardio', on: false, words: ['stair', 'stepmill', 'stairmaster'] },
  { id: 'rower', name: 'Rowing machine', cat: 'Cardio', on: false, words: ['rower', 'rowing', 'erg'] },

  { id: 'smith', name: 'Smith machine', cat: 'Free weights & racks', on: true, words: ['smith'] },
  { id: 'dumbbells', name: 'Dumbbells', cat: 'Free weights & racks', on: true, words: ['dumbbell', 'db'] },
  { id: 'bench', name: 'Adjustable bench', cat: 'Free weights & racks', on: true, words: ['bench', 'incline bench'] },
  { id: 'barbell', name: 'Barbell + squat rack', cat: 'Free weights & racks', on: false, words: ['barbell', 'squat rack', 'power rack', 'olympic bar'] },
  { id: 'ezbar', name: 'EZ curl bar', cat: 'Free weights & racks', on: false, words: ['ez bar', 'curl bar', 'ez curl'] },
  { id: 'kettlebell', name: 'Kettlebells', cat: 'Free weights & racks', on: false, words: ['kettlebell', 'kb'] },

  { id: 'cable', name: 'Cable arch / crossover (adjustable pulleys)', cat: 'Cables', on: true, words: ['cable', 'pulley', 'functional trainer', 'crossover', 'arch'] },
  { id: 'pullupbar', name: 'Pull-up bar (on the cable arch)', cat: 'Cables', on: true, words: ['pull-up bar', 'pullup bar', 'chin-up bar', 'chin bar'] },
  { id: 'pulldown', name: 'Lat pulldown (wide + narrow handles)', cat: 'Cables', on: true, words: ['lat pulldown', 'pulldown', 'pull down'] },
  { id: 'cablerow', name: 'Seated cable row', cat: 'Cables', on: false, words: ['seated row', 'cable row', 'low row'] },

  { id: 'chestpress', name: 'Chest press machine', cat: 'Machines', on: false, words: ['chest press'] },
  { id: 'pecdeck', name: 'Seated chest fly (pec deck)', cat: 'Machines', on: true, words: ['pec deck', 'pec fly', 'butterfly', 'rear delt'] },
  { id: 'shoulderpress', name: 'Shoulder press machine', cat: 'Machines', on: true, words: ['shoulder press', 'overhead press machine'] },
  { id: 'rowmachine', name: 'Seated row machine (chest pad)', cat: 'Machines', on: false, words: ['row machine', 'chest supported row'] },
  { id: 'assist', name: 'Assisted pull-up / dip machine', cat: 'Machines', on: false, words: ['assisted', 'pull-up', 'pullup', 'chin', 'dip'] },
  { id: 'legpress', name: 'Leg press', cat: 'Machines', on: true, words: ['leg press'] },
  { id: 'legext', name: 'Leg extension', cat: 'Machines', on: false, words: ['leg extension'] },
  { id: 'legcurl', name: 'Leg curl (seated or lying)', cat: 'Machines', on: false, words: ['leg curl', 'hamstring curl'] },
  { id: 'hipabd', name: 'Hip abductor / adductor', cat: 'Machines', on: false, words: ['abductor', 'adductor', 'hip machine', 'inner thigh', 'outer thigh'] },
  { id: 'calfmachine', name: 'Calf raise machine', cat: 'Machines', on: false, words: ['calf'] },
  { id: 'abmachine', name: 'Ab crunch machine', cat: 'Machines', on: false, words: ['ab crunch', 'abdominal', 'ab machine'] },
  { id: 'captain', name: "Captain's chair / back extension", cat: 'Machines', on: false, words: ["captain", 'roman chair', 'back extension', 'hyperextension', 'knee raise'] },

  { id: 'mat', name: 'Floor mat', cat: 'Floor', on: true, words: ['mat', 'floor'] },
  { id: 'ball', name: 'Stability ball', cat: 'Floor', on: false, words: ['stability ball', 'swiss ball', 'exercise ball'] },
  { id: 'bands', name: 'Resistance bands', cat: 'Floor', on: false, words: ['band'] },
  { id: 'trx', name: 'TRX straps', cat: 'Floor', on: true, words: ['trx', 'suspension', 'straps'] },
  { id: 'bosu', name: 'BOSU half ball', cat: 'Floor', on: true, words: ['bosu', 'bonsai', 'half ball'] },
];

// Bar weights (lb). Ben can change them in Settings: Smith bars vary a lot between gyms.
export const BARS = { smith: 15, barbell: 45, ezbar: 25 };

export const MUSCLES = {
  chest: 'Chest', shoulders: 'Shoulders', triceps: 'Triceps',
  back: 'Back', biceps: 'Biceps', reardelts: 'Rear shoulders',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  abs: 'Abs & core',
};

// eq: everything the exercise needs. bar: which bar it uses (weight entry can add it).
// kind: compound | isolation | core. load: weight | body (bodyweight reps) | time (seconds).
const X = (id, name, muscle, kind, eq, how, extra = {}) => ({ id, name, muscle, kind, eq, how, load: 'weight', ...extra });

export const EXERCISES = [
  // Chest
  X('smith_bench', 'Smith bench press', 'chest', 'compound', ['smith', 'bench'],
    'Flat bench under the Smith bar so it lines up with mid-chest. Unrack with a twist, lower slowly until the bar is an inch off your chest, press back up. Elbows about 45° from your body, not flared straight out.', { bar: 'smith' }),
  X('smith_incline', 'Smith incline press', 'chest', 'compound', ['smith', 'bench'],
    'Bench at 30°, bar over your upper chest. Lower to just below the collarbone, press up. Works the upper chest, which gives the "lifted" look.', { bar: 'smith' }),
  X('db_bench', 'Dumbbell bench press', 'chest', 'compound', ['dumbbells', 'bench'],
    'Lie flat, dumbbells over your chest, palms facing your feet. Lower until your elbows are just below the bench, press up and slightly together.'),
  X('db_incline', 'Incline dumbbell press', 'chest', 'compound', ['dumbbells', 'bench'],
    'Bench at 30°. Press the dumbbells up over your upper chest, lower slowly to chest level.'),
  X('machine_chest', 'Machine chest press', 'chest', 'compound', ['chestpress'],
    'Seat so the handles sit at mid-chest. Press out without locking elbows hard, return slowly until you feel a stretch.'),
  X('pec_fly', 'Seated chest fly machine', 'chest', 'isolation', ['pecdeck'],
    'Seat so the vertical handles line up with your chest, elbows slightly bent. Squeeze the handles together, hold a second, open slowly.'),
  X('cable_fly', 'Cable chest fly', 'chest', 'isolation', ['cable'],
    'Pulleys at shoulder height, one step forward. Slight bend in the elbows, sweep your hands together in front of your chest like hugging a tree, open back slowly.'),
  X('db_fly', 'Dumbbell fly', 'chest', 'isolation', ['dumbbells', 'bench'],
    'Lie flat, dumbbells above chest, palms facing. With a soft bend in the elbows, open your arms wide until you feel a chest stretch, then bring them back up.'),
  X('trx_chest', 'TRX chest press', 'chest', 'compound', ['trx'],
    'Straps at mid-length. Face away from the anchor, a handle in each hand at chest height, arms straight, body leaning forward in a straight line. Bend your elbows to lower your chest between your hands, push back up. Step your feet back to make it harder.', { load: 'body' }),
  X('pushup', 'Push-up', 'chest', 'compound', ['mat'],
    'Hands a bit wider than shoulders, body in one straight line. Lower your chest to a fist off the floor, push up. Too hard? Hands on a bench or Smith bar set high.', { load: 'body' }),

  // Shoulders
  X('smith_ohp', 'Smith shoulder press', 'shoulders', 'compound', ['smith', 'bench'],
    'Bench upright (80–90°), bar just in front of your face. Lower to chin level, press overhead without arching your lower back.', { bar: 'smith' }),
  X('db_ohp', 'Seated dumbbell shoulder press', 'shoulders', 'compound', ['dumbbells', 'bench'],
    'Bench upright. Dumbbells at shoulder height, palms forward. Press up until arms are nearly straight, lower to ear level.'),
  X('machine_ohp', 'Machine shoulder press', 'shoulders', 'compound', ['shoulderpress'],
    'This is the "shoulder push-up" machine. Seat so the handles start at shoulder height. Press straight up overhead, lower slowly, back flat against the pad.'),
  X('lat_raise', 'Dumbbell lateral raise', 'shoulders', 'isolation', ['dumbbells'],
    'Stand tall, light dumbbells at your sides. Raise out to the sides to shoulder height, little fingers slightly up, lower slowly. Light weight, strict form: this one shapes the shoulder.'),
  X('cable_lat_raise', 'Cable lateral raise', 'shoulders', 'isolation', ['cable'],
    'Pulley at the bottom, handle in the far hand so the cable crosses in front of you. Raise out to the side to shoulder height. Do both sides.'),
  X('front_raise', 'Front raise', 'shoulders', 'isolation', ['dumbbells'],
    'Dumbbells in front of your thighs. Raise straight ahead to shoulder height, lower slowly.'),

  // Triceps
  X('pushdown', 'Cable triceps pushdown', 'triceps', 'isolation', ['cable'],
    'Rope or bar on a high pulley. Elbows pinned to your sides, push down until arms are straight, let it back up to 90°.'),
  X('overhead_ext', 'Overhead cable triceps extension', 'triceps', 'isolation', ['cable'],
    'Rope on a low pulley, face away, rope behind your head. Elbows pointing up, straighten your arms overhead.'),
  X('db_overhead_ext', 'Dumbbell overhead extension', 'triceps', 'isolation', ['dumbbells'],
    'Hold one dumbbell with both hands overhead. Lower it behind your head by bending only the elbows, then straighten.'),
  X('smith_close_bench', 'Smith close-grip bench press', 'triceps', 'compound', ['smith', 'bench'],
    'Like the bench press with hands shoulder-width apart and elbows tucked in. Lower to lower chest, press up.', { bar: 'smith' }),
  X('bench_dip', 'Bench dip', 'triceps', 'compound', ['bench'],
    'Hands on the edge of a bench behind you, feet out front. Bend your elbows to about 90°, push back up. Bend knees to make it easier.', { load: 'body' }),
  X('trx_tri', 'TRX triceps extension', 'triceps', 'isolation', ['trx'],
    'Straps at mid-length, face away, arms straight out in front at head height, leaning forward. Keep your elbows pointing forward and bend only at the elbows so your hands come toward your forehead, then straighten. Step back to make it harder.', { load: 'body' }),
  X('assisted_dip', 'Assisted dip', 'triceps', 'compound', ['assist'],
    'Kneel on the pad, grip the dip bars. Lower until elbows are at 90°, push up. More counterweight = easier. Log the assist weight.'),

  // Back
  X('pulldown', 'Lat pulldown', 'back', 'compound', ['pulldown'],
    'Use the wide handles (or the narrow ones for a different feel), one in each hand, moving together. Lean back slightly, pull the bar to your upper chest by driving elbows down, let it rise slowly until arms are straight.'),
  X('cable_row', 'Seated cable row', 'back', 'compound', ['cablerow'],
    'Sit tall, knees soft. Pull the handle to your belly button, squeeze your shoulder blades together, return slowly without rounding forward.'),
  X('machine_row', 'Machine row (chest supported)', 'back', 'compound', ['rowmachine'],
    'Chest against the pad. Pull the handles back, elbows close to your body, squeeze, return slowly.'),
  X('cable_row_stand', 'Cable row (standing or kneeling)', 'back', 'compound', ['cable'],
    'Handles or a bar on the arch at chest height (or kneel with them low). Step back until the weight lifts, knees soft, chest up. Pull the handles to your ribs, squeeze your shoulder blades together, let your arms straighten slowly.'),
  X('smith_row', 'Smith bent-over row', 'back', 'compound', ['smith'],
    'Bar at knee height. Hinge at the hips until your torso is at about 45°, back flat. Pull the bar to your lower ribs, lower with control.', { bar: 'smith' }),
  X('db_row', 'One-arm dumbbell row', 'back', 'compound', ['dumbbells', 'bench'],
    'One knee and hand on a bench, back flat. Pull the dumbbell to your hip, lower until your arm is straight. Do both sides.'),
  X('assisted_pullup', 'Assisted pull-up', 'back', 'compound', ['assist'],
    'Kneel on the pad, grip the handles. Pull until your chin clears the bar, lower slowly. Log the assist weight.'),
  X('trx_row', 'TRX row', 'back', 'compound', ['trx'],
    'Straps at mid-length. Face the anchor, a handle in each hand, lean back with straight arms and your body in one line, heels on the floor. Pull your chest up to your hands, elbows close to your sides, lower slowly. Walk your feet closer to the anchor to make it harder.', { load: 'body' }),
  X('pullup', 'Pull-up (or slow lowering)', 'back', 'compound', ['pullupbar'],
    'Hands a bit wider than shoulders on the bar on the arch. Pull until your chin passes the bar, lower all the way. Can\'t do one yet? Step up so your chin is over the bar and lower yourself as slowly as you can (3 to 5 seconds). Count those as reps.', { load: 'body' }),
  X('straight_arm', 'Straight-arm cable pulldown', 'back', 'isolation', ['cable'],
    'Bar or rope on a high pulley. Arms almost straight, sweep the bar down to your thighs, let it rise slowly.'),
  X('back_ext', 'Back extension', 'back', 'isolation', ['captain'],
    'Hips on the pad, ankles locked. Lower your torso slowly, rise until your body is in a straight line. Don\'t over-arch.', { load: 'body' }),

  // Rear delts
  X('face_pull', 'Cable face pull', 'reardelts', 'isolation', ['cable'],
    'Rope at face height. Pull toward your forehead, splitting the rope apart, elbows high. Great for posture.'),
  X('reverse_fly', 'Reverse fly on the chest fly machine', 'reardelts', 'isolation', ['pecdeck'],
    'If the arms swivel round to the back: sit facing the pad, handles in front. Sweep your arms back out to the sides, squeeze between your shoulder blades.'),
  X('trx_rear_fly', 'TRX rear fly', 'reardelts', 'isolation', ['trx'],
    'Face the anchor, arms straight out in front holding the handles, lean back. Open your arms out to a T, pulling your body up, squeeze between your shoulder blades, lower slowly.', { load: 'body' }),
  X('db_rear_fly', 'Bent-over dumbbell rear fly', 'reardelts', 'isolation', ['dumbbells'],
    'Hinge forward, light dumbbells hanging. Raise them out to the sides with soft elbows, lower slowly.'),

  // Biceps
  X('db_curl', 'Dumbbell curl', 'biceps', 'isolation', ['dumbbells'],
    'Stand tall, elbows at your sides. Curl up, turning palms to face you, lower slowly. No swinging.'),
  X('hammer_curl', 'Hammer curl', 'biceps', 'isolation', ['dumbbells'],
    'Palms facing each other the whole time. Curl up, lower slowly.'),
  X('cable_curl', 'Cable curl', 'biceps', 'isolation', ['cable'],
    'Bar on a low pulley. Elbows at your sides, curl up, lower slowly.'),
  X('ez_curl', 'EZ-bar curl', 'biceps', 'isolation', ['ezbar'],
    'Grip the angled part of the bar. Elbows still, curl up, lower slowly.', { bar: 'ezbar' }),
  X('trx_curl', 'TRX biceps curl', 'biceps', 'isolation', ['trx'],
    'Face the anchor, palms up, arms straight, lean back. Curl the handles toward your forehead by bending only your elbows, so your body rises. Lower slowly.', { load: 'body' }),
  X('incline_curl', 'Incline dumbbell curl', 'biceps', 'isolation', ['dumbbells', 'bench'],
    'Bench at 45°, arms hanging straight down behind you. Curl up without moving your elbows forward.'),

  // Quads
  X('smith_squat', 'Smith squat', 'quads', 'compound', ['smith'],
    'Bar on your upper back, feet slightly in front of the bar, shoulder-width. Sit down and back until thighs are about parallel, drive up through your heels.', { bar: 'smith' }),
  X('leg_press', 'Leg press', 'quads', 'compound', ['legpress'],
    'Feet shoulder-width in the middle of the platform. Lower until knees are near 90°, press up without locking your knees.'),
  X('goblet_squat', 'Goblet squat', 'quads', 'compound', ['dumbbells'],
    'Hold one dumbbell against your chest. Squat down between your knees, chest up, stand back up.'),
  X('smith_split_squat', 'Smith split squat', 'quads', 'compound', ['smith'],
    'Bar on your back, one foot forward and one back in a long stance. Drop your back knee toward the floor, push up through the front heel. Do both legs.', { bar: 'smith' }),
  X('db_lunge', 'Dumbbell walking lunge', 'quads', 'compound', ['dumbbells'],
    'Dumbbells at your sides. Step forward and lower your back knee toward the floor, then step through into the next lunge. Count reps per leg.'),
  X('trx_squat', 'TRX assisted squat', 'quads', 'compound', ['trx'],
    'Face the anchor holding the handles, arms straight. Sit back and down as deep as you can, using the straps only for balance, then stand up. Good for learning a deep squat.', { load: 'body' }),
  X('bosu_squat', 'BOSU squat', 'quads', 'compound', ['bosu'],
    'Dome side up, feet on the dome about hip-width. Squat to a comfortable depth keeping your balance, stand up. Hold a dumbbell at your chest when it gets easy.', { load: 'body' }),
  X('leg_ext', 'Leg extension', 'quads', 'isolation', ['legext'],
    'Pad on your lower shins, knees lined up with the machine\'s pivot. Straighten your legs, squeeze, lower slowly.'),

  // Hamstrings
  X('smith_rdl', 'Smith Romanian deadlift', 'hamstrings', 'compound', ['smith'],
    'Hold the bar at your thighs, knees soft. Push your hips back and slide the bar down your legs to mid-shin, back flat, then stand up by squeezing your glutes.', { bar: 'smith' }),
  X('db_rdl', 'Dumbbell Romanian deadlift', 'hamstrings', 'compound', ['dumbbells'],
    'Same hip hinge as the Smith version with dumbbells in front of your thighs.'),
  X('leg_curl', 'Leg curl', 'hamstrings', 'isolation', ['legcurl'],
    'Pad just above your heels. Curl your heels toward you, squeeze, return slowly.'),

  X('trx_ham_curl', 'TRX hamstring curl', 'hamstrings', 'isolation', ['trx'],
    'Straps lowered to about a foot off the floor. Lie on your back, heels in the foot cradles. Lift your hips off the floor, then pull your heels toward your bum, keeping hips up. Straighten slowly.', { load: 'body' }),
  X('cable_pullthrough', 'Cable pull-through', 'hamstrings', 'compound', ['cable'],
    'Rope on a low pulley, face away and hold it between your legs. Push your hips back with a flat back until you feel your hamstrings stretch, then drive your hips forward to stand tall.'),
  // Glutes
  X('smith_hip_thrust', 'Smith hip thrust', 'glutes', 'compound', ['smith', 'bench'],
    'Upper back against a bench, bar across your hips (use a pad). Feet flat, drive your hips up until your body is level, squeeze, lower.', { bar: 'smith' }),
  X('glute_bridge', 'Glute bridge', 'glutes', 'compound', ['mat'],
    'Lie on your back, knees bent, feet flat. Drive hips up, squeeze, lower. Add a dumbbell on your hips when it gets easy.'),
  X('abductor', 'Hip abductor', 'glutes', 'isolation', ['hipabd'],
    'Pads on the outside of your knees. Push your legs apart, hold a second, return slowly.'),
  X('cable_abduction', 'Cable hip abduction', 'glutes', 'isolation', ['cable'],
    'Ankle strap on a low pulley on the outer leg, standing side-on and holding the frame. Lift that leg out to the side, hold a second, return slowly. Do both legs.'),
  X('cable_kickback', 'Cable glute kickback', 'glutes', 'isolation', ['cable'],
    'Ankle strap on a low pulley. Holding the frame, kick that leg straight back, squeeze, return. Do both legs.'),

  // Calves
  X('smith_calf', 'Smith calf raise', 'calves', 'isolation', ['smith'],
    'Bar on your back, balls of your feet on a plate or step. Rise up onto your toes, pause, lower until heels dip.', { bar: 'smith' }),
  X('calf_machine', 'Calf raise machine', 'calves', 'isolation', ['calfmachine'],
    'Shoulders under the pads, balls of feet on the edge. Rise up, pause, lower slowly.'),
  X('legpress_calf', 'Leg press calf raise', 'calves', 'isolation', ['legpress'],
    'On the leg press, slide your feet so only the balls are on the platform edge. Push with your toes, let heels come back.'),
  X('db_calf', 'Dumbbell calf raise', 'calves', 'isolation', ['dumbbells'],
    'Dumbbells at your sides, balls of your feet on a step. Rise up, lower slowly.'),

  // Abs & core
  X('plank', 'Plank', 'abs', 'core', ['mat'],
    'Forearms on the floor, body in a straight line from head to heels. Squeeze glutes and abs, breathe. Log seconds held.', { load: 'time' }),
  X('knee_raise', "Captain's chair knee raise", 'abs', 'core', ['captain'],
    'Back against the pad, forearms on the rests. Lift your knees toward your chest, lower slowly without swinging.', { load: 'body' }),
  X('cable_crunch', 'Cable crunch', 'abs', 'core', ['cable'],
    'Rope on a high pulley, kneel facing it with the rope by your head. Crunch down, bringing elbows toward your knees. Move from the abs, not the hips.'),
  X('ab_machine', 'Ab crunch machine', 'abs', 'core', ['abmachine'],
    'Set the pads, crunch forward, return slowly.'),
  X('dead_bug', 'Dead bug', 'abs', 'core', ['mat'],
    'Lie on your back, arms up, knees bent at 90°. Press your lower back into the floor. Lower the opposite arm and leg toward the floor, return, switch. Count reps per side.', { load: 'body' }),
  X('bicycle', 'Bicycle crunch', 'abs', 'core', ['mat'],
    'On your back, hands by your head. Bring opposite elbow toward opposite knee, alternating. Slow and controlled. Count each side.', { load: 'body' }),
  X('woodchop', 'Cable woodchop', 'abs', 'core', ['cable'],
    'Pulley high, stand side-on. Pull the handle down and across your body to the opposite hip, turning through your torso. Do both sides.'),
  X('pallof', 'Pallof press', 'abs', 'core', ['cable'],
    'Pulley at chest height, stand side-on. Press the handle straight out and hold 2 seconds without letting it twist you. Do both sides.'),
  X('bosu_crunch', 'BOSU crunch', 'abs', 'core', ['bosu'],
    'Sit on the dome with your lower back on it, feet flat. Hands by your head, curl up until your abs are tight, lower back over the dome slowly.', { load: 'body' }),
  X('bosu_climber', 'BOSU mountain climber', 'abs', 'core', ['bosu'],
    'Dome side down, hands on the edges of the flat side, body in a plank. Drive one knee toward your chest, then the other, at a steady pace. Count each knee.', { load: 'body' }),
  X('trx_tuck', 'TRX knee tuck', 'abs', 'core', ['trx'],
    'Straps low, feet in the foot cradles, hands on the floor in a push-up position. Pull your knees in toward your chest, push them back out. Keep your hips level.', { load: 'body' }),
  X('hanging_knee', 'Hanging knee raise', 'abs', 'core', ['pullupbar'],
    'Hang from the bar on the arch. Lift your knees toward your chest without swinging, lower slowly. Grip giving out first? Do it lying on a bench instead.', { load: 'body' }),
  X('side_plank', 'Side plank', 'abs', 'core', ['mat'],
    'On one forearm, feet stacked, hips up in a straight line. Log seconds per side.', { load: 'time' }),
];

// Default sets / reps / rest per kind. Ben wants 5 × 12 on everything; rest stays short for toning.
export const DEFAULTS = {
  compound: { reps: 12, sets: 5, rest: 60 },
  isolation: { reps: 12, sets: 5, rest: 45 },
  core: { reps: 12, sets: 5, rest: 30 },
};

// Training splits. Each day is a list of slots; a slot lists acceptable muscles and the kind wanted.
// The app fills each slot from the exercises Ben's gym can do.
const S = (muscles, kind) => ({ muscles, kind });

export const SPLITS = {
  ppl: {
    name: 'Push / Pull / Legs',
    blurb: 'Rotate Push → Pull → Legs, whatever the weekday. Each muscle gets worked about twice a week at 5–6 sessions.',
    days: [
      { key: 'push', name: 'Push', sub: 'Chest · Shoulders · Triceps', slots: [
        S(['chest'], 'compound'), S(['shoulders'], 'compound'), S(['chest'], 'compound'),
        S(['shoulders'], 'isolation'), S(['chest'], 'isolation'), S(['triceps'], 'isolation'), S(['abs'], 'core')] },
      { key: 'pull', name: 'Pull', sub: 'Back · Biceps · Rear shoulders', slots: [
        S(['back'], 'compound'), S(['back'], 'compound'), S(['back'], 'compound'),
        S(['reardelts'], 'isolation'), S(['biceps'], 'isolation'), S(['biceps'], 'isolation'), S(['abs'], 'core')] },
      { key: 'legs', name: 'Legs & Core', sub: 'Quads · Hamstrings · Glutes · Abs', slots: [
        S(['quads'], 'compound'), S(['hamstrings'], 'compound'), S(['glutes'], 'compound'),
        S(['quads'], 'isolation'), S(['hamstrings'], 'isolation'), S(['calves'], 'isolation'), S(['abs'], 'core'), S(['abs'], 'core')] },
    ],
  },
  ul: {
    name: 'Upper / Lower',
    blurb: 'Alternate Upper and Lower. Good if you can only make 3–4 days in a week.',
    days: [
      { key: 'upper', name: 'Upper', sub: 'Chest · Back · Shoulders · Arms', slots: [
        S(['chest'], 'compound'), S(['back'], 'compound'), S(['shoulders'], 'compound'), S(['back'], 'compound'),
        S(['shoulders'], 'isolation'), S(['biceps'], 'isolation'), S(['triceps'], 'isolation')] },
      { key: 'lower', name: 'Lower & Core', sub: 'Quads · Hamstrings · Glutes · Abs', slots: [
        S(['quads'], 'compound'), S(['hamstrings'], 'compound'), S(['glutes'], 'compound'),
        S(['quads'], 'isolation'), S(['calves'], 'isolation'), S(['abs'], 'core'), S(['abs'], 'core')] },
    ],
  },
  bro: {
    name: 'One muscle group a day',
    blurb: 'Chest → Back → Legs → Shoulders → Arms, with a core finisher each day. Each muscle only once a week.',
    days: [
      { key: 'chest', name: 'Chest', sub: 'Chest + core', slots: [
        S(['chest'], 'compound'), S(['chest'], 'compound'), S(['chest'], 'compound'), S(['chest'], 'isolation'), S(['chest'], 'isolation'), S(['abs'], 'core')] },
      { key: 'back', name: 'Back', sub: 'Back + rear shoulders + core', slots: [
        S(['back'], 'compound'), S(['back'], 'compound'), S(['back'], 'compound'), S(['back'], 'isolation'), S(['reardelts'], 'isolation'), S(['abs'], 'core')] },
      { key: 'legs', name: 'Legs', sub: 'Quads · Hamstrings · Glutes · Calves', slots: [
        S(['quads'], 'compound'), S(['hamstrings'], 'compound'), S(['glutes'], 'compound'), S(['quads'], 'isolation'), S(['hamstrings'], 'isolation'), S(['calves'], 'isolation')] },
      { key: 'shoulders', name: 'Shoulders', sub: 'Shoulders + core', slots: [
        S(['shoulders'], 'compound'), S(['shoulders'], 'isolation'), S(['shoulders'], 'isolation'), S(['reardelts'], 'isolation'), S(['abs'], 'core'), S(['abs'], 'core')] },
      { key: 'arms', name: 'Arms', sub: 'Biceps · Triceps', slots: [
        S(['triceps'], 'compound'), S(['biceps'], 'isolation'), S(['triceps'], 'isolation'), S(['biceps'], 'isolation'), S(['triceps'], 'isolation'), S(['abs'], 'core')] },
    ],
  },
};

export const ELLIPTICAL_PROGRAMS = ['Manual', 'Fat burn', 'Hill', 'Interval', 'Cardio', 'Random'];
