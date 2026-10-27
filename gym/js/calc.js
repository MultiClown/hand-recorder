// Calorie estimates. All return gross kcal (includes what you'd burn sitting still).

const LB = 0.45359237;

// Treadmill walking: ACSM walking equation, which accounts for incline.
// VO2 (ml/kg/min) = 0.1·speed + 1.8·speed·grade + 3.5, speed in m/min. 1 L O2 ≈ 5 kcal.
// Holding the handrails takes a lot of the work off; knock off 20%.
export function treadmillKcal({ min, mph, incline, rails }, weightLb) {
  const s = mph * 26.8224;
  const vo2 = 0.1 * s + 1.8 * s * (incline / 100) + 3.5;
  const perMin = (vo2 * weightLb * LB) / 1000 * 5;
  return Math.round(perMin * min * (rails ? 0.8 : 1));
}

// Elliptical: no standard equation, so effort level maps to METs (Compendium of Physical
// Activities puts moderate elliptical at ~5 METs, vigorous ~8–9). Level is scaled to the
// machine's range. With an average heart rate we use Keytel et al. (2005) instead, which is
// usually closer for the person in question.
export function ellipticalMets(level, maxLevel = 20) {
  const f = Math.min(Math.max((level - 1) / Math.max(maxLevel - 1, 1), 0), 1);
  return 4 + f * 5; // level 1 ≈ 4 METs, top level ≈ 9 METs
}

export function ellipticalKcal({ min, level, hr }, profile, maxLevel = 20) {
  if (hr && profile.age) return Math.round(keytel(hr, profile) * min);
  return Math.round(metKcal(ellipticalMets(level, maxLevel), profile.weightLb, min));
}

export function keytel(hr, { weightLb, age, sex }) {
  const kg = weightLb * LB;
  const kj = sex === 'f'
    ? -20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age
    : -55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age;
  return Math.max(kj / 4.184, 0);
}

export const metKcal = (mets, weightLb, min) => mets * weightLb * LB * (min / 60);

// Other cardio machines, by effort (Compendium values).
export const OTHER_CARDIO = {
  bike: { name: 'Stationary bike', mets: { easy: 4.8, moderate: 6.8, hard: 8.8 } },
  stairs: { name: 'Stair climber', mets: { easy: 5.5, moderate: 8, hard: 10 } },
  rower: { name: 'Rowing machine', mets: { easy: 4.8, moderate: 7, hard: 8.5 } },
};

// Weight training: Compendium gives 3.5 METs for "resistance training, multiple exercises,
// 8–15 reps" across the whole block including rests; short rests (circuit style) run ~5.
export function strengthMets(avgRestSec) {
  if (avgRestSec == null) return 3.5;
  if (avgRestSec <= 50) return 5;
  if (avgRestSec <= 75) return 4.3;
  return 3.5;
}
