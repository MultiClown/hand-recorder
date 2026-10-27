import { EQUIPMENT, EXERCISES, BARS, MUSCLES, DEFAULTS, SPLITS, ELLIPTICAL_PROGRAMS } from './catalog.js';
import { treadmillKcal, ellipticalKcal, metKcal, OTHER_CARDIO, strengthMets } from './calc.js';

// ---------- Storage ----------
// Same origin as the poker app (multiclown.github.io), so the key must not clash with hhr.*.

const KEY = 'gym.v1';
const KG = 0.45359237;
const round1 = (n) => Math.round(n * 10) / 10;
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.sessions) return d;
  } catch {}
  return {
    profile: { weightKg: 95, age: 32, sex: 'm' },
    settings: { split: 'ppl', goal: 5, bars: { ...BARS }, ellipticalMax: 20, sound: true },
    equipment: {}, customEquipment: [], customExercises: [],
    picks: {}, exPrefs: {}, sessions: [], activeId: null, timer: null,
  };
}
let db = load();
// Earlier builds kept body weight in lb and asked for it on a welcome screen.
if (!('weightKg' in db.profile)) {
  db.profile = { weightKg: 95, age: 32, sex: 'm' };
  save();
}
// Equipment defaults now match Ben's real gym; clear ticks made against the old starter list.
if (db.gymList !== 1) { db.equipment = {}; db.gymList = 1; save(); }
// Defaults moved to 5 × 12; forget sets/reps saved against the old defaults.
if (db.prefsV !== 1) {
  for (const p of Object.values(db.exPrefs)) { delete p.sets; delete p.reps; }
  db.prefsV = 1; save();
}
db.lastPick = db.lastPick || {};
// Ben asked (2026-10-26, 8 pm) to clear everything logged while trying the app out. Only
// workouts started before then are dropped, so nothing real can be lost later.
if (db.testWipe !== 1) {
  db.sessions = db.sessions.filter((s) => s.start > 1793070506323);
  if (!db.sessions.some((s) => s.id === db.activeId)) db.activeId = null;
  db.timer = null; db.lastPick = {}; db.exPrefs = {}; db.picks = {};
  db.testWipe = 1; save();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// ---------- Catalog helpers ----------

const allExercises = () => [...EXERCISES, ...db.customExercises];
const exById = (id) => allExercises().find((x) => x.id === id);
const hasEq = (id) => {
  if (id in db.equipment) return db.equipment[id];
  const e = EQUIPMENT.find((q) => q.id === id);
  return e ? e.on : db.customEquipment.some((c) => c.id === id);
};
const canDo = (x) => x.eq.every(hasEq);
const eqName = (id) => EQUIPMENT.find((q) => q.id === id)?.name || db.customEquipment.find((c) => c.id === id)?.name || id;
const split = () => SPLITS[db.settings.split] || SPLITS.ppl;
const dayDef = (key, splitKey = db.settings.split) => SPLITS[splitKey]?.days.find((d) => d.key === key);

function candidates(slot, taken) {
  const pool = allExercises().filter((x) => canDo(x) && slot.muscles.includes(x.muscle) && !taken.has(x.id));
  const exact = pool.filter((x) => x.kind === slot.kind);
  return exact.length ? [...exact, ...pool.filter((x) => x.kind !== slot.kind)] : pool;
}

// Fill each slot of a day from what the gym has. A swap is remembered for next time.
function planFor(splitKey, day) {
  const taken = new Set();
  const plan = [];
  day.slots.forEach((slot, i) => {
    const list = candidates(slot, taken);
    const remembered = db.picks[`${splitKey}.${day.key}.${i}`];
    const pick = list.find((x) => x.id === remembered) || list[0];
    if (pick) { taken.add(pick.id); plan.push({ id: pick.id, slot: i }); }
  });
  return plan;
}

// What's ticked when a day opens: what Ben picked last time for that day, else the suggested plan.
function defaultSelection(day) {
  const last = (db.lastPick[`${db.settings.split}.${day.key}`] || []).filter((id) => exById(id) && canDo(exById(id)));
  return last.length ? last : planFor(db.settings.split, day).map((p) => p.id);
}

const dayMuscles = (day) => day ? [...new Set(day.slots.flatMap((s) => s.muscles))] : Object.keys(MUSCLES);
const KIND_RANK = { compound: 0, isolation: 1, core: 2 };
const kindLabel = (x) => ({ compound: 'Main lift', isolation: 'Finisher', core: 'Core' }[x.kind]);

// Workout order: main lifts first, then finishers, then core; muscles in the day's order.
function orderSelection(ids, day) {
  const mus = [...dayMuscles(day), ...Object.keys(MUSCLES)];
  return ids.map(exById).filter(Boolean)
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || mus.indexOf(a.muscle) - mus.indexOf(b.muscle))
    .map((x) => x.id);
}

// Rough lifting time: ~45 s per set (or the hold), plus rest, plus a minute to set up each exercise.
function estimateMin(ids) {
  return Math.round(ids.map(exById).reduce((a, x) => {
    const p = prefsFor(x);
    const work = x.load === 'time' ? (db.exPrefs[x.id]?.sec || 30) : 45;
    return a + p.sets * (work + p.rest) / 60 + 1;
  }, 0));
}

function nextDay() {
  const sp = split();
  const last = [...db.sessions].reverse().find((s) => s.end && s.split === db.settings.split && s.day !== 'custom');
  if (!last) return sp.days[0];
  const i = sp.days.findIndex((d) => d.key === last.day);
  return sp.days[(i + 1) % sp.days.length];
}

// ---------- Session helpers ----------

const active = () => db.sessions.find((s) => s.id === db.activeId && !s.end) || null;
const sessionDayName = (s) => s.day === 'custom' ? (s.customName || 'Custom') : (dayDef(s.day, s.split)?.name || s.day);

function prefsFor(x) {
  return { ...DEFAULTS[x.kind], ...(db.exPrefs[x.id] || {}) };
}

function startSession(day, plan, customName) {
  const s = {
    id: uid(), start: Date.now(), end: null, split: db.settings.split, day, customName,
    cardio: [], ex: plan.map((p) => ({ id: p.id, slot: p.slot, sets: [] })), bodyWeight: null,
  };
  db.sessions.push(s);
  db.activeId = s.id;
  save();
  return s;
}

// Most recent earlier session where this exercise had sets.
function lastTime(exId, beforeSession) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const s = db.sessions[i];
    if (beforeSession && s.id === beforeSession.id) continue;
    const e = s.ex.find((q) => q.id === exId && q.sets.length);
    if (e) return { session: s, entry: e };
  }
  return null;
}

function setText(x, st) {
  if (x.load === 'time') return `${st.sec}s`;
  if (x.load === 'body') return `${st.reps} reps${st.w ? ` · +${st.w} lb` : ''}`;
  const each = x.eq.includes('dumbbells') ? ' each' : '';
  const w = st.bar ? `${st.w} + bar` : `${st.w} lb${each}`;
  return `${w} × ${st.reps}`;
}

function setsSummary(x, sets) {
  if (!sets.length) return '';
  if (x.load === 'time') return sets.map((s) => `${s.sec}s`).join(', ');
  const ws = [...new Set(sets.map((s) => (x.load === 'body' ? '' : s.bar ? `${s.w}+bar` : `${s.w}`)))];
  const reps = sets.map((s) => s.reps).join(', ');
  return ws.length === 1 && ws[0] !== '' ? `${ws[0]} lb × ${reps}` : ws[0] === '' ? `${reps} reps` : sets.map((s) => setText(x, s)).join(', ');
}

// Progress nudge from last time.
function suggestion(x, prev, prefs) {
  if (!prev) return null;
  const sets = prev.entry.sets;
  if (x.load === 'time') {
    const best = Math.max(...sets.map((s) => s.sec || 0));
    return { text: `Best hold last time ${best}s. Try ${best + 10}s.`, sec: best + 10 };
  }
  const hitAll = sets.length >= prefs.sets && sets.every((s) => s.reps >= prefs.reps);
  if (x.load === 'body') {
    return hitAll ? { text: `All ${prefs.sets} sets done last time. Try ${prefs.reps + 2} reps.`, reps: prefs.reps + 2 }
      : { text: `Aim for ${prefs.sets} × ${prefs.reps} today.` };
  }
  const lastW = sets.at(-1).w;
  if (hitAll) return { text: `You hit ${prefs.sets} × ${prefs.reps} last time. Try ${lastW + 5}.`, w: lastW + 5 };
  return { text: `Same weight as last time, aim for ${prefs.sets} × ${prefs.reps}.`, w: lastW };
}

// ---------- Calories ----------

const weight = () => (db.profile.weightKg || 95) / KG; // lb, for calc.js

function cardioKcal(c) {
  if (c.type === 'treadmill') return treadmillKcal(c, weight());
  if (c.type === 'elliptical') return ellipticalKcal(c, { ...db.profile, weightLb: weight() }, db.settings.ellipticalMax);
  const o = OTHER_CARDIO[c.type];
  return o ? Math.round(metKcal(o.mets[c.effort] || o.mets.moderate, weight(), c.min)) : 0;
}

// Lifting block: first set (counting that set as a minute) to last set, minus any cardio logged inside it.
function strengthStats(s) {
  const times = s.ex.flatMap((e) => e.sets.map((st) => st.t)).sort((a, b) => a - b);
  if (!times.length) return { min: 0, kcal: 0, sets: 0 };
  let min = (times.at(-1) - times[0]) / 60000 + 1;
  for (const c of s.cardio) if (c.t > times[0] && c.t < times.at(-1)) min -= c.min;
  min = Math.max(min, times.length);
  const gaps = s.ex.flatMap((e) => e.sets.slice(1).map((st, i) => (st.t - e.sets[i].t) / 1000)).filter((g) => g < 600);
  const avgRest = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length - 30 : null;
  const mets = strengthMets(avgRest);
  return { min: Math.round(min), kcal: Math.round(metKcal(mets, weight(), min)), sets: times.length, mets };
}

function sessionStats(s) {
  const cardio = s.cardio.reduce((a, c) => a + cardioKcal(c), 0);
  const cardioMin = s.cardio.reduce((a, c) => a + c.min, 0);
  const st = strengthStats(s);
  const end = s.end || Date.now();
  return { cardio, cardioMin, strength: st, total: cardio + st.kcal, gymMin: Math.round((end - s.start) / 60000) };
}

// ---------- Rest timer ----------

let audio = null;
function unlockAudio() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
}
function beep(times = 3) {
  if (!db.settings.sound || !audio) return;
  audio.resume?.();
  for (let i = 0; i < times; i++) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = i === times - 1 ? 1320 : 880;
    o.connect(g); g.connect(audio.destination);
    const t = audio.currentTime + i * 0.28;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.start(t); o.stop(t + 0.22);
  }
}

function startTimer(sec, label) {
  db.timer = { end: Date.now() + sec * 1000, total: sec, label, done: false };
  save();
  tickTimer();
}

const timerEl = document.getElementById('timer');
function tickTimer() {
  const t = db.timer;
  if (!t) { timerEl.hidden = true; return; }
  const left = Math.ceil((t.end - Date.now()) / 1000);
  if (left <= 0 && !t.done) {
    t.done = true; save();
    beep();
    navigator.vibrate?.([300, 120, 300]);
  }
  if (left <= -8) { db.timer = null; save(); timerEl.hidden = true; return; }
  timerEl.hidden = false;
  timerEl.classList.toggle('go', left <= 0);
  const pct = Math.max(0, Math.min(1, left / t.total));
  const mm = Math.floor(Math.max(left, 0) / 60), ss = String(Math.max(left, 0) % 60).padStart(2, '0');
  timerEl.innerHTML = left > 0 ? `
    <div class="tbar" style="width:${pct * 100}%"></div>
    <div class="tin">
      <div><div class="tlabel">Rest · ${esc(t.label)}</div><div class="tclock">${mm}:${ss}</div></div>
      <div class="tbtns">
        <button class="tbtn" data-act="timer-add" data-v="-15">−15</button>
        <button class="tbtn" data-act="timer-add" data-v="15">+15</button>
        <button class="tbtn" data-act="timer-skip">Skip</button>
      </div>
    </div>` : `
    <div class="tin"><div class="tclock">Go! Next set</div><button class="tbtn" data-act="timer-skip">OK</button></div>`;
}
setInterval(tickTimer, 250);

function addSet(e, x, st) {
  st.t = Date.now();
  e.sets.push(st);
  save();
  const prefs = prefsFor(x);
  if (e.sets.length < prefs.sets) startTimer(prefs.rest, `set ${e.sets.length + 1} of ${prefs.sets} next`);
  else startTimer(Math.max(prefs.rest, 60), 'next exercise');
  render();
}

// Plank-style holds: 5 s to get into position, then count down the target. Lives in memory only.
let hold = null;
function finishHold(sec) {
  const s = db.sessions.find((q) => q.id === hold.sid);
  const e = s?.ex[hold.exIdx];
  hold = null;
  if (!e) { render(); return; }
  addSet(e, exById(e.id), { sec });
}
setInterval(() => {
  if (!hold) return;
  const now = Date.now();
  if (now >= hold.start && !hold.started) { hold.started = true; beep(1); }
  if (now >= hold.start + hold.target * 1000) { beep(2); navigator.vibrate?.(300); finishHold(hold.target); return; }
  const el = root.querySelector('[data-live="hold"]');
  if (el) el.innerHTML = holdInner();
}, 200);

// Keep the screen on during a workout (where the browser allows it).
let wakeLock = null;
async function keepAwake() {
  if (!active() || document.visibilityState !== 'visible' || wakeLock) return;
  try { wakeLock = await navigator.wakeLock?.request('screen'); wakeLock?.addEventListener('release', () => { wakeLock = null; }); } catch {}
}
document.addEventListener('visibilitychange', () => { keepAwake(); tickTimer(); render(); });

// ---------- Navigation ----------

const root = document.getElementById('app');
let nav = active() ? [{ view: 'home' }, { view: 'session' }] : [{ view: 'home' }];
const cur = () => nav.at(-1);
function go(view, params = {}) { nav.push({ view, ...params }); render(); window.scrollTo(0, 0); }
function back() { if (nav.length > 1) nav.pop(); else nav = [{ view: 'home' }]; render(); window.scrollTo(0, 0); }
function home() { nav = [{ view: 'home' }]; render(); window.scrollTo(0, 0); }

let toastMsg = null;
function toast(msg) {
  toastMsg = msg;
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- Views ----------

const top = (title, sub = '', right = '') => `
  <header class="top">
    <button class="icon-btn" data-act="back" aria-label="Back">‹</button>
    <div class="title">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    <div class="top-right">${right}</div>
  </header>`;

const tabs = (on) => `
  <nav class="tabs">
    ${[['home', 'Today', '◎'], ['history', 'History', '☰'], ['gym', 'My gym', '⚙︎'], ['settings', 'Settings', '•••']]
      .map(([v, l, i]) => `<button class="${on === v ? 'on' : ''}" data-act="tab" data-v="${v}"><span>${i}</span>${l}</button>`).join('')}
  </nav>`;

const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtMin = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;

function weekStart(t = Date.now()) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const views = {
  home() {
    const s = active();
    const sp = split();
    const day = nextDay();
    const plan = orderSelection(defaultSelection(day), day);
    const wk = db.sessions.filter((x) => x.end && x.start >= weekStart());
    const wkKcal = wk.reduce((a, x) => a + sessionStats(x).total, 0);
    const recent = db.sessions.filter((x) => x.end).slice(-3).reverse();
    const goal = db.settings.goal || 5;
    return `
    <div class="page">
      <div class="row between"><h1>${new Date().toLocaleDateString(undefined, { weekday: 'long' })}</h1>
        <button class="link" data-act="go" data-v="guide">How this works</button></div>
      ${s ? `
        <button class="card resume" data-act="go" data-v="session">
          <div class="eyebrow">Workout in progress</div>
          <div class="h2">${esc(sessionDayName(s))}</div>
          <div class="muted">Started ${fmtTime(s.start)} · ${fmtMin(sessionStats(s).gymMin)}</div>
          <div class="cta">Resume →</div>
        </button>` : `
        <div class="card up-next">
          <div class="eyebrow">Up next · ${esc(sp.name)}</div>
          <div class="h2">${esc(day.name)} day</div>
          <div class="muted">${esc(day.sub)}</div>
          <ol class="plan-preview">${plan.map((id) => `<li>${esc(exById(id).name)}</li>`).join('')}</ol>
          <div class="muted small">Next you'll see every option for the day, grouped by muscle, and tick the ones you want.</div>
          <button class="big" data-act="build" data-v="${day.key}">Start ${esc(day.name)} day</button>
          <div class="other-days">
            <span class="muted small">Or:</span>
            ${sp.days.filter((d) => d.key !== day.key).map((d) => `<button class="chip" data-act="build" data-v="${d.key}">${esc(d.name)}</button>`).join('')}
            <button class="chip" data-act="build" data-v="">Build my own…</button>
          </div>
        </div>`}
      <div class="card">
        <div class="row between"><b>This week</b><span class="muted">${wk.length} of ${goal} sessions</span></div>
        <div class="dots">${Array.from({ length: Math.max(goal, wk.length) }, (_, i) => `<i class="${i < wk.length ? 'on' : ''}"></i>`).join('')}</div>
        <div class="muted small">${wkKcal ? `${wkKcal.toLocaleString()} kcal burned in the gym this week` : 'No sessions yet this week.'}</div>
      </div>
      ${recent.length ? `<div class="section-h">Recent</div>${recent.map(sessionRow).join('')}` : ''}
    </div>
    ${tabs('home')}`;
  },

  build() {
    const c = cur();
    const day = c.day ? dayDef(c.day) : null;
    if (!c.sel) c.sel = day ? defaultSelection(day) : [];
    const mine = dayMuscles(day);
    const others = Object.keys(MUSCLES).filter((m) => !mine.includes(m));
    const rec = new Set(day ? planFor(db.settings.split, day).map((p) => p.id) : []);
    const group = (m) => {
      const list = allExercises().filter((x) => x.muscle === m && canDo(x))
        .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
      if (!list.length) return '';
      return `<div class="section-h row between"><span>${MUSCLES[m]}</span><span class="muted" data-live="count-${m}">${pickedText(c.sel, m)}</span></div>
        <div class="card list">${list.map((x) => `
          <div class="pick-row">
            <label class="check pick"><input type="checkbox" data-k="pick" data-id="${x.id}" ${c.sel.includes(x.id) ? 'checked' : ''}>
              <span class="grow"><b>${rec.has(x.id) ? '<span class="star" title="Recommended">★</span> ' : ''}${esc(x.name)}</b><span class="muted small">${kindLabel(x)} · ${esc(x.eq.map((q) => eqName(q).split(' (')[0].split(' / ')[0]).join(' + '))}</span></span></label>
            <button class="info" data-act="info" data-v="${x.id}" aria-label="What is this?">?</button>
          </div>
          <div class="pick-how" data-how="${x.id}" hidden>${esc(x.how)}<div class="muted small">You need: ${esc(x.eq.map(eqName).join(', '))}. ${x.eq.every(hasEq) ? 'Your gym has it.' : ''}</div></div>`).join('')}
        </div>`;
    };
    return `${top(day ? `${day.name} day` : 'Build a workout', day?.sub || 'Tick any exercises')}
    <div class="page">
      <p class="muted small">${day ? '<span class="star">★</span> = recommended for this day. Ticked = what you did last time (the ★ ones the first time). ' : ''}Tap <b>?</b> to see what an exercise is. The workout runs main lifts first, then finishers, then core.</p>
      ${mine.map(group).join('')}
      ${others.length ? `<details class="more"><summary>Other muscles</summary>${others.map(group).join('')}</details>` : ''}
    </div>
    <div class="build-bar" data-live="build-bar">${buildBar(c.sel)}</div>`;
  },

  session() {
    const s = active();
    if (!s) return views.home();
    const st = sessionStats(s);
    return `${top(sessionDayName(s), `Started ${fmtTime(s.start)}`, `<button class="btn-sm accent" data-act="finish">Finish</button>`)}
    <div class="page">
      <div class="stats3">
        <div><b data-live="gymmin">${fmtMin(st.gymMin)}</b><span>in gym</span></div>
        <div><b>${st.strength.sets}</b><span>sets</span></div>
        <div><b>${st.total}</b><span>kcal so far</span></div>
      </div>

      <div class="section-h">Cardio</div>
      ${s.cardio.length ? s.cardio.map((c, i) => `
        <div class="item">
          <div class="grow"><b>${esc(cardioTitle(c))}</b><div class="muted small">${esc(cardioDetail(c))}</div></div>
          <div class="kcal">${cardioKcal(c)} kcal</div>
          <button class="x" data-act="cardio-del" data-v="${i}" aria-label="Remove">✕</button>
        </div>`).join('') : `
        <button class="card dashed" data-act="go" data-v="cardio">
          <b>Start with 15 min cardio</b><div class="muted small">Incline walk or elliptical. Log it when you step off.</div>
        </button>`}
      ${s.cardio.length ? `<button class="btn-ghost full" data-act="go" data-v="cardio">+ Add cardio</button>` : ''}

      <div class="section-h">Exercises</div>
      ${s.ex.map((e, i) => exRow(s, e, i)).join('')}
      <button class="btn-ghost full" data-act="go" data-v="picker">+ Add exercise</button>
    </div>`;
  },

  cardio() {
    const c = cur().draft || (cur().draft = cardioDraft('treadmill'));
    const type = c.type;
    return `${top('Log cardio')}
    <div class="page">
      <div class="seg">${[['treadmill', 'Incline walk'], ['elliptical', 'Elliptical'], ['other', 'Other']].map(([k, l]) =>
        `<button class="${(type === k || (k === 'other' && OTHER_CARDIO[type])) ? 'on' : ''}" data-act="cardio-type" data-v="${k}">${l}</button>`).join('')}</div>
      ${field('Minutes', stepper('min', c.min, 1))}
      ${type === 'treadmill' ? `
        ${field('Speed (mph)', `${chips('mph', [3.0, 3.1, 3.2, 3.3, 3.4, 3.5], c.mph, (v) => v.toFixed(1))}${stepper('mph', c.mph, 0.1)}`)}
        ${field('Incline %', `${chips('incline', [8, 10, 12, 15], c.incline)}${stepper('incline', c.incline, 1)}`)}
        ${toggle('rails', c.rails, 'Held the handrails', 'Holding on takes a lot of the work off your legs. Counts 20% less.')}
      ` : type === 'elliptical' ? `
        ${field(`Resistance level (1–${db.settings.ellipticalMax})`, stepper('level', c.level, 1))}
        ${field('Program', chips('program', ELLIPTICAL_PROGRAMS, c.program))}
        ${field('Average heart rate (optional)', `<input inputmode="numeric" data-k="hr" value="${c.hr ?? ''}" placeholder="From the grips, e.g. 135">`,
          'With heart rate (and your age) the estimate uses it instead of the level, which is usually closer.')}
        ${field('What the machine said (optional)', `<input inputmode="numeric" data-k="machineKcal" value="${c.machineKcal ?? ''}" placeholder="kcal">`,
          'Kept for reference only. Machines usually read 10–20% high.')}
      ` : `
        ${field('Machine', chips('type', Object.keys(OTHER_CARDIO), type, (k) => OTHER_CARDIO[k].name))}
        ${field('Effort', chips('effort', ['easy', 'moderate', 'hard'], c.effort, (v) => v[0].toUpperCase() + v.slice(1)))}
      `}
      <div class="estimate"><span>Estimated burn</span><b data-live="cardio-kcal">${cardioKcal(c)} kcal</b></div>
      <button class="big" data-act="cardio-save">Save cardio</button>
      ${cardioNote(type)}
    </div>`;
  },

  exercise() {
    const s = active();
    const { exIdx } = cur();
    const e = s?.ex[exIdx];
    if (!e) return views.session();
    const x = exById(e.id);
    const prefs = prefsFor(x);
    const prev = lastTime(x.id, s);
    const sug = suggestion(x, prev, prefs);
    const d = cur().draft || (cur().draft = logDraft(x, e, prev, sug, prefs));
    const n = e.sets.length;
    const next = s.ex.findIndex((q, i) => i > exIdx && !q.sets.length);
    const barW = x.bar ? db.settings.bars[x.bar] : 0;
    return `${top(x.name, MUSCLES[x.muscle])}
    <div class="page">
      <details class="how" ${prev || n ? '' : 'open'}><summary>How to do it</summary><p>${esc(x.how)}</p>
        <div class="muted small">Uses: ${x.eq.map(eqName).map(esc).join(', ')}</div></details>

      ${prev ? `<div class="last"><span class="muted small">Last time · ${fmtDate(prev.session.start)}</span><div>${esc(setsSummary(x, prev.entry.sets))}</div>
        ${sug ? `<div class="sug">${esc(sug.text)}</div>` : ''}</div>` : `<div class="last"><span class="muted small">First time doing this one.</span><div class="sug">${x.load === 'time' ? 'Start with a hold you can keep with good form, around 30 seconds. Stop when your hips sag.'
          : x.load === 'body' ? `Aim for ${prefs.reps} clean reps. Make it easier or harder as the how-to says.`
          : `Pick a weight you can do ${prefs.reps} times with 2–3 reps left in the tank.`}</div></div>`}

      <div class="logger">
        ${x.load === 'time' ? holdPanel(d, s, exIdx, n, prefs) : `
          ${x.load === 'weight' ? field(x.eq.includes('dumbbells') ? 'Weight per dumbbell (lb)' : x.bar ? 'Plates (lb)' : 'Weight (lb)', stepper('w', d.w, x.bar ? 2.5 : 5, 'lg')) : ''}
          ${x.bar ? `<label class="bar-toggle"><input type="checkbox" data-k="bar" ${d.bar ? 'checked' : ''}> + bar (${barW} lb) <span class="muted" data-live="bar-total">= ${round1((d.w || 0) + (d.bar ? barW : 0))} lb total</span></label>` : ''}
          ${field('Reps', stepper('reps', d.reps, 1, 'lg'))}
        <button class="big" data-act="log-set">${setLabel(n, prefs)}</button>`}
      </div>

      ${n ? `<div class="sets">${e.sets.map((st, i) => `
        <div class="set"><span class="n">${i + 1}</span><span class="grow">${esc(setText(x, st))}</span>
        <button class="x" data-act="set-del" data-v="${i}" aria-label="Delete set">✕</button></div>`).join('')}</div>` : ''}

      ${n >= prefs.sets ? `<div class="done-banner">Done: ${n} sets ✓
        ${next >= 0 ? `<button class="btn-sm accent" data-act="open-ex" data-v="${next}">Next: ${esc(exById(s.ex[next].id).name)} →</button>`
          : `<button class="btn-sm accent" data-act="back">Back to workout</button>`}</div>` : ''}

      <div class="section-h">Plan for this exercise</div>
      <div class="plan-grid">
        ${field('Sets', stepper('p-sets', prefs.sets, 1))}
        ${x.load === 'time' ? '' : field('Target reps', stepper('p-reps', prefs.reps, 1))}
      </div>
      ${field('Rest between sets', chips('p-rest', [30, 45, 60, 90, 120], prefs.rest, (v) => v < 60 ? `${v}s` : `${v / 60}m`.replace('1.5m', '1:30').replace('2m', '2 min').replace('1m', '1 min')))}
    </div>`;
  },

  picker() {
    const m = cur().muscle || Object.keys(MUSCLES)[0];
    const s = active();
    const inPlan = new Set(s?.ex.map((e) => e.id));
    const list = allExercises().filter((x) => x.muscle === m);
    return `${top('Add exercise')}
    <div class="page">
      <div class="chips scroll">${Object.entries(MUSCLES).map(([k, v]) =>
        `<button class="chip ${k === m ? 'on' : ''}" data-act="picker-muscle" data-v="${k}">${v}</button>`).join('')}</div>
      ${list.map((x) => {
        const ok = canDo(x);
        return `<button class="item ${ok ? '' : 'off'}" data-act="picker-add" data-v="${x.id}">
          <div class="grow"><b>${esc(x.name)}</b><div class="muted small">${ok ? esc(x.kind === 'compound' ? 'Main lift' : x.kind === 'core' ? 'Core' : 'Finisher') : `Needs ${x.eq.filter((q) => !hasEq(q)).map(eqName).map(esc).join(', ')}`}</div></div>
          <span class="muted">${inPlan.has(x.id) ? '✓ added' : ok ? '+' : ''}</span></button>`;
      }).join('')}
    </div>`;
  },

  swap() {
    const s = active();
    const { exIdx } = cur();
    const e = s.ex[exIdx];
    const x = exById(e.id);
    const taken = new Set(s.ex.map((q) => q.id));
    const day = dayDef(s.day, s.split);
    const slot = e.slot != null && day ? day.slots[e.slot] : { muscles: [x.muscle], kind: x.kind };
    const list = candidates(slot, taken);
    return `${top('Swap exercise', x.name)}
    <div class="page">
      <p class="muted">Same muscle, using what your gym has. Your pick is remembered for next ${esc(day?.name || '')} day.</p>
      ${list.length ? list.map((q) => `<button class="item" data-act="swap-pick" data-v="${q.id}">
        <div class="grow"><b>${esc(q.name)}</b><div class="muted small">${esc(q.how.split('. ')[0])}.</div></div><span>→</span></button>`).join('')
        : '<p class="muted">Nothing else in your gym works this muscle. Add equipment under My gym.</p>'}
    </div>`;
  },

  summary() {
    const s = db.sessions.find((q) => q.id === cur().id);
    if (!s) return views.home();
    const st = sessionStats(s);
    const fresh = cur().fresh;
    return `${fresh ? `<header class="top"><div class="title">Workout done</div></header>` : top(sessionDayName(s), fmtDate(s.start))}
    <div class="page">
      ${fresh ? `<div class="hero small"><div class="h2">Nice work 💪</div><div class="muted">${esc(sessionDayName(s))} · ${fmtDate(s.start)}</div></div>` : ''}
      <div class="stats3 lg">
        <div><b>${fmtMin(st.gymMin)}</b><span>in the gym</span></div>
        <div><b>${st.total}</b><span>kcal burned</span></div>
        <div><b>${st.strength.sets}</b><span>sets</span></div>
      </div>
      <div class="muted small center">${fmtTime(s.start)} – ${fmtTime(s.end || Date.now())}</div>
      <div class="card">
        <div class="kv"><span>Cardio · ${st.cardioMin} min</span><b>${st.cardio} kcal</b></div>
        ${s.cardio.map((c) => `<div class="kv sub"><span>${esc(cardioTitle(c))} · ${esc(cardioDetail(c))}</span><span>${cardioKcal(c)}</span></div>`).join('')}
        <div class="kv"><span>Weights · ${st.strength.min} min</span><b>${st.strength.kcal} kcal</b></div>
        <div class="muted small">Estimates. They include what your body burns at rest, like machine readouts do.</div>
      </div>
      <div class="section-h">Exercises</div>
      ${s.ex.filter((e) => e.sets.length).map((e) => { const x = exById(e.id) || { name: e.id, eq: [], load: 'weight' };
        return `<div class="item"><div class="grow"><b>${esc(x.name)}</b><div class="muted small">${esc(setsSummary(x, e.sets))}</div></div></div>`; }).join('') || '<p class="muted">No sets logged.</p>'}
      ${field('Body weight today (optional, kg)', `<input inputmode="decimal" data-k="bodyWeight" data-session="${s.id}" value="${s.bodyWeight ?? ''}" placeholder="${db.profile.weightKg ?? ''}">`,
        'Updates your profile weight so calorie estimates stay right as you lose weight.')}
      ${fresh ? `<button class="big" data-act="home">Done</button>` : `<button class="btn-ghost full danger" data-act="session-del" data-v="${s.id}">Delete this workout</button>`}
    </div>`;
  },

  history() {
    const done = db.sessions.filter((s) => s.end).reverse();
    const groups = [];
    for (const s of done) {
      const w = weekStart(s.start);
      if (!groups.length || groups.at(-1).w !== w) groups.push({ w, list: [] });
      groups.at(-1).list.push(s);
    }
    return `<header class="top"><div class="title">History</div></header>
    <div class="page">
      ${groups.length ? groups.map((g) => {
        const kcal = g.list.reduce((a, s) => a + sessionStats(s).total, 0);
        return `<div class="section-h row between"><span>Week of ${new Date(g.w).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span class="muted">${g.list.length} sessions · ${kcal.toLocaleString()} kcal</span></div>
          ${g.list.map(sessionRow).join('')}`;
      }).join('') : '<p class="muted">Finished workouts show up here.</p>'}
      ${weightTrend()}
    </div>
    ${tabs('history')}`;
  },

  gym() {
    const cats = [...new Set(EQUIPMENT.map((e) => e.cat))];
    const n = allExercises().filter(canDo).length;
    return `<header class="top"><div class="title">My gym</div></header>
    <div class="page">
      <p class="muted">This is your gym. Suggestions only use what's ticked. Tick or add anything new. ${n} exercises available.</p>
      <div class="card">
        <b>Add equipment</b>
        <input data-k="newEq" placeholder="What is it? e.g. hack squat, rowing machine" value="${esc(cur().newEq || '')}">
        <label class="photo-btn">📷 ${cur().photo ? 'Photo added ✓' : 'Add a photo (optional)'}<input type="file" accept="image/*" capture="environment" data-k="photo" hidden></label>
        ${cur().photo ? `<img class="thumb" src="${cur().photo}" alt="">` : ''}
        <button class="btn-sm accent" data-act="eq-add">Add</button>
        <div class="muted small">The app matches names to what it knows and unlocks those exercises. It can't recognise photos on its own: send the photo to Claude in chat and the exercises get added properly.</div>
      </div>
      ${db.customEquipment.length ? `<div class="section-h">Added by you</div>${db.customEquipment.map((c) => `
        <div class="card">
          <div class="row">${c.photo ? `<img class="thumb sm" src="${c.photo}" alt="">` : ''}<b class="grow">${esc(c.name)}</b>
            <button class="x" data-act="eq-del" data-v="${c.id}" aria-label="Remove">✕</button></div>
          ${db.customExercises.filter((x) => x.eq.includes(c.id)).map((x) => `<div class="muted small">• ${esc(x.name)} (${MUSCLES[x.muscle]})</div>`).join('')}
          <button class="link" data-act="go" data-v="newex" data-eq="${c.id}">+ Add an exercise for this</button>
        </div>`).join('')}` : ''}
      ${cats.map((cat) => `<div class="section-h">${cat}</div><div class="card list">
        ${EQUIPMENT.filter((e) => e.cat === cat).map((e) => `
          <label class="check"><input type="checkbox" data-k="eq" data-id="${e.id}" ${hasEq(e.id) ? 'checked' : ''}><span>${esc(e.name)}</span></label>`).join('')}
      </div>`).join('')}
    </div>
    ${tabs('gym')}`;
  },

  newex() {
    const d = cur().draft || (cur().draft = { name: '', muscle: 'chest', kind: 'compound', load: 'weight', how: '' });
    return `${top('New exercise', eqName(cur().eq))}
    <div class="page">
      ${field('Name', `<input data-k="name" value="${esc(d.name)}" placeholder="e.g. Hack squat">`)}
      ${field('Muscle', chips('muscle', Object.keys(MUSCLES), d.muscle, (k) => MUSCLES[k]))}
      ${field('Type', chips('kind', ['compound', 'isolation', 'core'], d.kind, (k) => ({ compound: 'Main lift', isolation: 'Finisher', core: 'Core' }[k])))}
      ${field('Logged as', chips('load', ['weight', 'body', 'time'], d.load, (k) => ({ weight: 'Weight × reps', body: 'Reps only', time: 'Seconds' }[k])))}
      ${field('How to do it (optional)', `<textarea data-k="how" placeholder="A line or two to remind you">${esc(d.how)}</textarea>`)}
      <button class="big" data-act="newex-save">Save exercise</button>
    </div>`;
  },

  settings() {
    return `<header class="top"><div class="title">Settings</div></header>
    <div class="page">
      <div class="section-h">You</div>
      ${profileFields()}
      <div class="section-h">Training plan</div>
      ${Object.entries(SPLITS).map(([k, sp]) => `
        <button class="card option ${db.settings.split === k ? 'on' : ''}" data-act="split" data-v="${k}">
          <div class="row between"><b>${esc(sp.name)}</b>${k === 'ppl' ? '<span class="badge">Recommended</span>' : ''}</div>
          <div class="muted small">${esc(sp.blurb)}</div></button>`).join('')}
      ${field('Weekly goal', stepper('s-goal', db.settings.goal, 1))}
      <div class="section-h">Equipment details</div>
      <div class="plan-grid">
        ${field('Smith bar (lb)', `<input inputmode="decimal" data-k="bar-smith" value="${db.settings.bars.smith}">`)}
        ${field('Barbell (lb)', `<input inputmode="decimal" data-k="bar-barbell" value="${db.settings.bars.barbell}">`)}
        ${field('EZ bar (lb)', `<input inputmode="decimal" data-k="bar-ezbar" value="${db.settings.bars.ezbar}">`)}
        ${field('Elliptical top level', `<input inputmode="numeric" data-k="ellipticalMax" value="${db.settings.ellipticalMax}">`)}
      </div>
      <div class="muted small">Smith bars are often counterbalanced and weigh anywhere from 6 to 25 lb. Ask the front desk or check the sticker on the machine.</div>
      ${toggle('sound', db.settings.sound, 'Beep when rest is over', 'Phone needs to be off silent for sound.')}
      <div class="section-h">Backup</div>
      <div class="row">
        <button class="btn-ghost grow" data-act="backup">Download backup</button>
        <label class="btn-ghost grow center">Restore<input type="file" accept=".json,application/json" data-k="restore" hidden></label>
      </div>
      <div class="muted small">Everything lives on this phone. Download a backup now and then.</div>
    </div>
    ${tabs('settings')}`;
  },

  guide() {
    return `${top('How this works')}
    <div class="page prose">
      <h2>Push / Pull / Legs, on a rotation</h2>
      <p>You asked: one muscle group per day, or push/pull days? For your goal, <b>Push / Pull / Legs</b> wins, for three reasons:</p>
      <ul>
        <li><b>Each muscle twice a week.</b> At 5–6 sessions you hit everything about twice weekly. Research reviews (Schoenfeld et al., 2016 and later) find twice a week keeps muscle better than once, which matters most while you're eating less to lose fat.</li>
        <li><b>Missed days don't break it.</b> The app suggests whatever comes next in the rotation, not by weekday. Skip Wednesday and you just pick up where you left off. With one-muscle-a-day, missing chest day means two weeks without chest.</li>
        <li><b>Big muscles together burn more.</b> Pushing, pulling and leg days each use several large muscles, so each session burns more than an arms-only day.</li>
      </ul>
      <p>Abs get a core move at the end of every session and two on leg day. Only make 3–4 days a week? Switch to Upper / Lower in Settings.</p>

      <h2>Toning, not bulking</h2>
      <p>"Toned" is muscle you can see because there's less fat over it. You won't get bulky by accident: that takes years of eating in a surplus. The plan here:</p>
      <ul>
        <li><b>10–15 reps, 3 sets</b>, with a weight that leaves 2–3 reps in the tank on the last set.</li>
        <li><b>Short rests</b>: 60s for main lifts, 45s for finishers, 30s for core. Keeps your heart rate up.</li>
        <li><b>Add weight when it gets easy.</b> When you hit every rep on every set, the app suggests +5 lb next time. Lifting the same light weight forever doesn't tone anything.</li>
      </ul>

      <h2>Cardio and calories</h2>
      <p>15 min of incline walking at 12% and 3.2 mph burns about 220 kcal at 95 kg, a bit more than moderate elliptical. Don't hold the rails: it cuts the burn a lot. The weights part of a session usually burns 150–250 kcal more.</p>
      <p>Fat loss itself comes from eating a bit less than you burn. The gym keeps the weight you lose coming off fat, not muscle. Aim for plenty of protein (roughly 1.6–2 g per kg of goal body weight, so 130–170 g a day for you).</p>

      <h2>How calories are worked out</h2>
      <ul>
        <li><b>Incline walk:</b> the ACSM walking equation (speed, incline, your weight).</li>
        <li><b>Elliptical:</b> resistance level mapped to effort (about 4 METs at the lowest level to 9 at the top). If you enter average heart rate, it uses the Keytel heart-rate formula instead. Programs like Fat burn change the profile, not the maths.</li>
        <li><b>Weights:</b> about 3.5–5 METs for your lifting time, higher when your rests are short.</li>
      </ul>
      <p class="muted">All numbers are estimates within about ±20%, like any watch or machine.</p>
    </div>`;
  },
};

// ---------- View pieces ----------

const setLabel = (n, prefs) => n < prefs.sets ? `Log set ${n + 1} of ${prefs.sets}` : `Log extra set (${n + 1})`;
const pickedText = (sel, m) => { const n = sel.filter((id) => exById(id)?.muscle === m).length; return n ? `${n} picked` : ''; };
const buildBar = (sel) => {
  const sets = sel.reduce((a, id) => a + prefsFor(exById(id)).sets, 0);
  return `<div class="grow"><b>${sel.length} exercise${sel.length === 1 ? '' : 's'}</b><div class="muted small">${sets} sets · about ${estimateMin(sel)} min of lifting</div></div>
    <button class="btn-sm accent" data-act="build-start" ${sel.length ? '' : 'disabled'}>Start</button>`;
};

function holdPanel(d, s, exIdx, n, prefs) {
  if (hold && hold.sid === s.id && hold.exIdx === exIdx) {
    return `<div class="hold" data-live="hold">${holdInner()}</div>
      <button class="big stop" data-act="hold-stop">Stop and log</button>
      <button class="link center" data-act="hold-cancel">Cancel</button>`;
  }
  return `${field('Hold for (seconds)', stepper('sec', d.sec, 5, 'lg'))}
    <button class="big" data-act="hold-start">Start ${setLabel(n, prefs).replace('Log ', '').replace('set', 'hold')} · ${d.sec}s</button>
    <button class="link center" data-act="log-set">Log ${d.sec}s without the timer</button>`;
}

function holdInner() {
  const now = Date.now();
  if (now < hold.start) return `<div class="muted">Get into position</div><div class="hold-clock">${Math.ceil((hold.start - now) / 1000)}</div><div class="muted small">Hold starts with a beep</div>`;
  const done = (now - hold.start) / 1000;
  const left = Math.max(0, Math.ceil(hold.target - done));
  return `<div class="cyan">Hold!</div><div class="hold-clock">${left}</div>
    <div class="hold-track"><i style="width:${Math.min(100, (done / hold.target) * 100)}%"></i></div>
    <div class="muted small">${Math.floor(done)}s of ${hold.target}s</div>`;
}

const field = (label, inner, note = '') => `<div class="field"><label>${esc(label)}</label>${inner}${note ? `<div class="muted small">${esc(note)}</div>` : ''}</div>`;
const stepper = (k, v, step, cls = '') => `<div class="stepper ${cls}">
  <button data-act="step" data-k="${k}" data-v="${-step}">−</button>
  <input inputmode="decimal" data-k="${k}" value="${v ?? ''}">
  <button data-act="step" data-k="${k}" data-v="${step}">+</button></div>`;
const chips = (k, opts, val, label = (v) => v) => `<div class="chips wrap">${opts.map((o) =>
  `<button class="chip ${o === val ? 'on' : ''}" data-act="chip" data-k="${k}" data-v="${esc(o)}">${esc(label(o))}</button>`).join('')}</div>`;
const toggle = (k, on, label, note) => `<label class="toggle"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><span class="sw"></span>
  <span class="grow"><b>${esc(label)}</b>${note ? `<div class="muted small">${esc(note)}</div>` : ''}</span></label>`;

function profileFields() {
  const p = db.profile;
  return `<div class="card">
    <div class="plan-grid">
      ${field('Body weight (kg)', `<input inputmode="decimal" data-k="weightKg" value="${p.weightKg ?? ''}" placeholder="e.g. 95">`)}
      ${field('Age', `<input inputmode="numeric" data-k="age" value="${p.age ?? ''}" placeholder="e.g. 32">`)}
    </div>
    ${field('Sex (for heart-rate calories)', chips('sex', ['m', 'f'], p.sex, (v) => (v === 'm' ? 'Male' : 'Female')))}
  </div>`;
}

function sessionRow(s) {
  const st = sessionStats(s);
  return `<button class="item" data-act="open-session" data-v="${s.id}">
    <div class="grow"><b>${esc(sessionDayName(s))}</b><div class="muted small">${fmtDate(s.start)} · ${fmtMin(st.gymMin)} · ${st.strength.sets} sets</div></div>
    <div class="kcal">${st.total} kcal</div></button>`;
}

function exRow(s, e, i) {
  const x = exById(e.id);
  if (!x) return '';
  const prefs = prefsFor(x);
  const prev = lastTime(x.id, s);
  const n = e.sets.length;
  const done = n >= prefs.sets;
  return `<div class="item ex ${done ? 'done' : ''}">
    <button class="grow tap" data-act="open-ex" data-v="${i}">
      <b>${esc(x.name)}</b>
      <div class="muted small">${MUSCLES[x.muscle]} · ${x.load === 'time' ? `${prefs.sets} holds` : `${prefs.sets} × ${prefs.reps}`}${prev ? ` · last ${esc(setsSummary(x, prev.entry.sets))}` : ''}</div>
    </button>
    <span class="prog ${done ? 'ok' : ''}">${done ? '✓' : `${n}/${prefs.sets}`}</span>
    ${n ? '' : `<button class="x" data-act="swap" data-v="${i}" aria-label="Swap">⇄</button><button class="x" data-act="ex-del" data-v="${i}" aria-label="Remove">✕</button>`}
  </div>`;
}

function cardioTitle(c) {
  if (c.type === 'treadmill') return 'Incline walk';
  if (c.type === 'elliptical') return `Elliptical${c.program && c.program !== 'Manual' ? ` · ${c.program}` : ''}`;
  return OTHER_CARDIO[c.type]?.name || c.type;
}
function cardioDetail(c) {
  if (c.type === 'treadmill') return `${c.min} min · ${c.incline}% · ${Number(c.mph).toFixed(1)} mph${c.rails ? ' · rails' : ''}`;
  if (c.type === 'elliptical') return `${c.min} min · level ${c.level}${c.hr ? ` · ${c.hr} bpm` : ''}${c.machineKcal ? ` · machine said ${c.machineKcal}` : ''}`;
  return `${c.min} min · ${c.effort}`;
}
function cardioNote(type) {
  if (type === 'treadmill') return '<p class="muted small">Uses the ACSM walking formula with your body weight. Update your weight in Settings as it changes.</p>';
  if (type === 'elliptical') return `<p class="muted small">Elliptical levels aren't standard between brands. If your machine's top level isn't ${db.settings.ellipticalMax}, change it in Settings.</p>`;
  return '';
}

// Defaults for cardio come from the last time that machine was logged.
function cardioDraft(type) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const c = [...db.sessions[i].cardio].reverse().find((q) => q.type === type);
    if (c) { const { t, ...rest } = c; return { ...rest }; }
  }
  if (type === 'treadmill') return { type, min: 15, mph: 3.2, incline: 12, rails: false };
  if (type === 'elliptical') return { type, min: 15, level: 8, program: 'Fat burn', hr: null, machineKcal: null };
  return { type, min: 15, effort: 'moderate' };
}

function logDraft(x, e, prev, sug, prefs) {
  const lastSet = e.sets.at(-1) || prev?.entry.sets.at(-1);
  return {
    w: e.sets.length ? lastSet.w : sug?.w ?? lastSet?.w ?? (x.load === 'weight' ? null : 0),
    bar: lastSet ? !!lastSet.bar : !!x.bar,
    reps: e.sets.length ? lastSet.reps : sug?.reps ?? prefs.reps,
    sec: e.sets.length ? lastSet.sec : sug?.sec ?? 30,
  };
}

function weightTrend() {
  const pts = db.sessions.filter((s) => s.bodyWeight).map((s) => ({ t: s.start, w: s.bodyWeight }));
  if (pts.length < 2) return '';
  const first = pts[0], last = pts.at(-1);
  const diff = round1(last.w - first.w);
  const ws = pts.map((p) => p.w), lo = Math.min(...ws), hi = Math.max(...ws), span = hi - lo || 1;
  const path = pts.map((p, i) => `${(i / (pts.length - 1)) * 300},${70 - ((p.w - lo) / span) * 60}`).join(' ');
  return `<div class="section-h">Body weight</div><div class="card">
    <div class="row between"><b>${last.w} kg</b><span class="${diff <= 0 ? 'good' : 'bad'}">${diff > 0 ? '+' : ''}${diff} kg since ${fmtDate(first.t)}</span></div>
    <svg viewBox="-4 0 308 76" class="spark"><polyline points="${path}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg></div>`;
}

// ---------- Render ----------

function render() {
  const v = views[cur().view] || views.home;
  root.innerHTML = v();
  keepAwake();
}

// Live numbers that change while typing, without re-rendering (which would close the keyboard).
function live() {
  const c = cur();
  if (c.view === 'build') {
    root.querySelector('[data-live="build-bar"]').innerHTML = buildBar(c.sel);
    for (const m of Object.keys(MUSCLES)) {
      const el = root.querySelector(`[data-live="count-${m}"]`);
      if (el) el.textContent = pickedText(c.sel, m);
    }
  }
  if (c.view === 'cardio') {
    const el = root.querySelector('[data-live="cardio-kcal"]');
    if (el) el.textContent = `${cardioKcal(c.draft)} kcal`;
  }
  if (c.view === 'exercise') {
    const el = root.querySelector('[data-live="bar-total"]');
    const x = exById(active().ex[c.exIdx].id);
    if (el) el.textContent = `= ${round1((c.draft.w || 0) + (c.draft.bar ? db.settings.bars[x.bar] : 0))} lb total`;
  }
}
setInterval(() => {
  const el = root.querySelector('[data-live="gymmin"]');
  const s = active();
  if (el && s) el.textContent = fmtMin(Math.round((Date.now() - s.start) / 60000));
}, 15000);

// ---------- Input handling ----------

const PREF_KEYS = { 'p-sets': 'sets', 'p-reps': 'reps', 'p-rest': 'rest' };

function setValue(k, raw, el) {
  const c = cur();
  const v = el?.type === 'checkbox' ? el.checked : raw;
  // Profile
  if (['weightKg', 'age'].includes(k)) { db.profile[k] = num(v); save(); return; }
  if (k === 'sex') { db.profile.sex = v; save(); render(); return; }
  // Settings
  if (k.startsWith('bar-') && c.view === 'settings') { const n = num(v); if (n != null) db.settings.bars[k.slice(4)] = n; save(); return; }
  if (k === 'ellipticalMax') { const n = num(v); if (n) db.settings.ellipticalMax = n; save(); return; }
  if (k === 's-goal') { db.settings.goal = Math.max(1, Math.min(7, Math.round(num(v) || 5))); save(); render(); return; }
  if (k === 'sound' && c.view === 'settings') { db.settings.sound = v; save(); return; }
  // Gym
  if (k === 'eq') { db.equipment[el.dataset.id] = v; save(); render(); return; }
  if (k === 'pick') {
    const id = el.dataset.id;
    c.sel = v ? [...c.sel.filter((q) => q !== id), id] : c.sel.filter((q) => q !== id);
    live(); return;
  }
  if (k === 'newEq') { c.newEq = v; return; }
  if (k === 'bodyWeight') {
    const s = db.sessions.find((q) => q.id === el.dataset.session);
    s.bodyWeight = num(v);
    if (s.bodyWeight && s === db.sessions.filter((q) => q.bodyWeight).at(-1)) db.profile.weightKg = s.bodyWeight;
    save(); return;
  }
  // Exercise plan prefs
  if (PREF_KEYS[k] && c.view === 'exercise') {
    const x = exById(active().ex[c.exIdx].id);
    const p = (db.exPrefs[x.id] = { ...prefsFor(x) });
    p[PREF_KEYS[k]] = Math.max(1, Math.round(num(v) || 1));
    save(); render(); return;
  }
  // Drafts (cardio, set logger, new exercise)
  if (c.draft) {
    if (c.view === 'cardio' && k === 'type') { c.draft = cardioDraft(v); render(); return; }
    const isText = ['name', 'how', 'program', 'muscle', 'kind', 'load', 'effort'].includes(k);
    c.draft[k] = typeof v === 'boolean' || isText ? v : num(v);
    live();
  }
}

root.addEventListener('input', (e) => {
  const el = e.target.closest('[data-k]');
  if (!el || el.type === 'file' || el.type === 'checkbox') return;
  setValue(el.dataset.k, el.value, el);
});

root.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-k]');
  if (!el) return;
  const k = el.dataset.k;
  if (el.type === 'checkbox') { setValue(k, el.checked, el); return; }
  if (k === 'photo' && el.files[0]) { cur().photo = await shrinkPhoto(el.files[0]); render(); return; }
  if (k === 'restore' && el.files[0]) { restore(el.files[0]); return; }
});

function shrinkPhoto(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 240, r = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * r); cv.height = Math.round(img.height * r);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

function matchEquipment(text) {
  const t = text.toLowerCase();
  // Whole words only, so "machine" doesn't match "chin".
  const has = (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t);
  return EQUIPMENT.filter((e) => e.words.some(has) || t.includes(e.name.toLowerCase()));
}

const actions = {
  back, home,
  tab: (el) => { nav = [{ view: el.dataset.v }]; render(); window.scrollTo(0, 0); },
  go: (el) => go(el.dataset.v, el.dataset.eq ? { eq: el.dataset.eq } : {}),

  build: (el) => go('build', { day: el.dataset.v || null }),
  'build-start': () => {
    const c = cur();
    const day = c.day ? dayDef(c.day) : null;
    const ids = orderSelection(c.sel, day);
    if (!ids.length) return;
    if (day) {
      db.lastPick[`${db.settings.split}.${day.key}`] = ids;
      startSession(day.key, ids.map((id) => ({ id })));
    } else {
      const mus = [...new Set(ids.map((id) => exById(id).muscle))];
      startSession('custom', ids.map((id) => ({ id })), mus.map((m) => MUSCLES[m]).join(' + '));
    }
    nav = [{ view: 'home' }, { view: 'session' }];
    render(); window.scrollTo(0, 0);
  },

  'hold-start': () => {
    unlockAudio();
    const d = cur().draft;
    if (!(d.sec > 0)) { toast('Set the seconds'); return; }
    const x = exById(active().ex[cur().exIdx].id);
    db.exPrefs[x.id] = { ...db.exPrefs[x.id], sec: d.sec };
    save();
    hold = { sid: active().id, exIdx: cur().exIdx, start: Date.now() + 5000, target: d.sec, started: false };
    render();
  },
  'hold-stop': () => {
    if (!hold) return;
    const done = Math.floor((Date.now() - hold.start) / 1000);
    if (done < 1) { hold = null; render(); return; }
    finishHold(done);
  },
  'hold-cancel': () => { hold = null; render(); },
  info: (el) => {
    const box = root.querySelector(`[data-how="${el.dataset.v}"]`);
    box.hidden = !box.hidden;
    el.classList.toggle('on', !box.hidden);
  },

  finish: () => {
    const s = active();
    const sets = s.ex.reduce((a, e) => a + e.sets.length, 0);
    if (!sets && !s.cardio.length) {
      if (confirm('Nothing logged. Discard this workout?')) { db.sessions = db.sessions.filter((q) => q !== s); db.activeId = null; db.timer = null; save(); home(); }
      return;
    }
    if (!confirm('Finish this workout?')) return;
    s.end = Date.now();
    s.ex = s.ex.filter((e) => e.sets.length);
    if (s.day !== 'custom' && s.ex.length) db.lastPick[`${s.split}.${s.day}`] = s.ex.map((e) => e.id);
    hold = null;
    db.activeId = null; db.timer = null;
    save();
    wakeLock?.release(); wakeLock = null;
    nav = [{ view: 'home' }, { view: 'summary', id: s.id, fresh: true }];
    render(); window.scrollTo(0, 0);
  },

  'cardio-type': (el) => { cur().draft = cardioDraft(el.dataset.v === 'other' ? 'bike' : el.dataset.v); render(); },
  'cardio-save': () => {
    const d = cur().draft;
    if (!(d.min > 0)) { toast('Add minutes'); return; }
    active().cardio.push({ ...d, t: Date.now() });
    save(); back();
  },
  'cardio-del': (el) => { if (confirm('Remove this cardio?')) { active().cardio.splice(+el.dataset.v, 1); save(); render(); } },

  'open-ex': (el) => {
    const i = +el.dataset.v;
    if (cur().view === 'exercise') nav.pop();
    go('exercise', { exIdx: i });
  },
  'ex-del': (el) => { active().ex.splice(+el.dataset.v, 1); save(); render(); },
  swap: (el) => go('swap', { exIdx: +el.dataset.v }),
  'swap-pick': (el) => {
    const s = active();
    const e = s.ex[cur().exIdx];
    if (e.slot != null && s.day !== 'custom') db.picks[`${s.split}.${s.day}.${e.slot}`] = el.dataset.v;
    e.id = el.dataset.v;
    save(); back();
  },
  'picker-muscle': (el) => { cur().muscle = el.dataset.v; render(); },
  'picker-add': (el) => {
    const x = exById(el.dataset.v);
    if (!canDo(x)) { toast(`Your gym list doesn't have: ${x.eq.filter((q) => !hasEq(q)).map(eqName).join(', ')}`); return; }
    const s = active();
    if (!s.ex.some((e) => e.id === x.id)) s.ex.push({ id: x.id, sets: [] });
    save();
    nav.pop();
    go('exercise', { exIdx: s.ex.findIndex((e) => e.id === x.id) });
  },

  'log-set': () => {
    unlockAudio();
    const s = active();
    const c = cur();
    const e = s.ex[c.exIdx];
    const x = exById(e.id);
    const d = c.draft;
    let st;
    if (x.load === 'time') { if (!(d.sec > 0)) { toast('Add seconds'); return; } st = { sec: d.sec }; }
    else {
      if (!(d.reps > 0)) { toast('Add reps'); return; }
      if (x.load === 'weight' && d.w == null) { toast('Add the weight'); return; }
      st = { w: d.w || 0, reps: d.reps };
      if (x.bar && d.bar) st.bar = db.settings.bars[x.bar];
    }
    addSet(e, x, st);
  },
  'set-del': (el) => {
    if (!confirm('Delete this set?')) return;
    active().ex[cur().exIdx].sets.splice(+el.dataset.v, 1);
    save(); render();
  },

  step: (el) => {
    const k = el.dataset.k;
    const step = +el.dataset.v;
    const input = root.querySelector(`input[data-k="${k}"]`);
    const curV = num(input?.value) ?? 0;
    const min = k === 'w' ? 0 : k === 'mph' ? 0.5 : k === 'incline' ? 0 : 1;
    const next = Math.max(min, round1(curV + step));
    setValue(k, String(next), input);
    if (cur().view === 'cardio' || cur().view === 'exercise') { if (input) input.value = next; live(); }
  },
  chip: (el) => {
    const k = el.dataset.k;
    const raw = el.dataset.v;
    const val = ['mph', 'incline', 'p-rest'].includes(k) ? Number(raw) : raw;
    if (cur().draft && !PREF_KEYS[k] && k !== 'sex') { setValue(k, val); render(); return; }
    setValue(k, val);
  },

  'timer-add': (el) => { if (db.timer) { db.timer.end += +el.dataset.v * 1000; db.timer.total = Math.max(db.timer.total, Math.ceil((db.timer.end - Date.now()) / 1000)); save(); tickTimer(); } },
  'timer-skip': () => { db.timer = null; save(); tickTimer(); },

  'open-session': (el) => go('summary', { id: el.dataset.v }),
  'session-del': (el) => {
    if (!confirm('Delete this workout for good?')) return;
    db.sessions = db.sessions.filter((s) => s.id !== el.dataset.v);
    save(); back();
  },

  split: (el) => { db.settings.split = el.dataset.v; save(); render(); toast(`Plan: ${SPLITS[el.dataset.v].name}`); },

  'eq-add': () => {
    const c = cur();
    const name = (c.newEq || '').trim();
    if (!name) { toast('Type what the equipment is'); return; }
    const hits = matchEquipment(name);
    if (hits.length) {
      hits.forEach((h) => { db.equipment[h.id] = true; });
      const n = allExercises().filter((x) => x.eq.some((q) => hits.some((h) => h.id === q)) && canDo(x)).length;
      toast(`Matched ${hits.map((h) => h.name).join(', ')}. ${n ? `${n} exercises use it.` : 'Ticked in your list.'}`);
      c.newEq = ''; c.photo = null; save(); render();
      return;
    }
    const id = `c_${uid()}`;
    db.customEquipment.push({ id, name, photo: c.photo || null });
    c.newEq = ''; c.photo = null;
    save();
    go('newex', { eq: id });
    toast("Added. Now tell it what exercise you'd do on it.");
  },
  'eq-del': (el) => {
    if (!confirm('Remove this equipment and its exercises?')) return;
    const id = el.dataset.v;
    db.customEquipment = db.customEquipment.filter((c) => c.id !== id);
    db.customExercises = db.customExercises.filter((x) => !x.eq.includes(id));
    save(); render();
  },
  'newex-save': () => {
    const c = cur(); const d = c.draft;
    if (!d.name.trim()) { toast('Give it a name'); return; }
    db.customExercises.push({ id: `cx_${uid()}`, name: d.name.trim(), muscle: d.muscle, kind: d.kind, load: d.load, eq: [c.eq], how: d.how.trim() || 'Your own exercise.' });
    save(); back(); toast('Saved. It will show up in suggestions for that muscle.');
  },

  backup: () => {
    const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};

// Merge by id; never deletes anything already on the phone.
async function restore(file) {
  try {
    const d = JSON.parse(await file.text());
    if (!d.sessions) throw new Error();
    const have = new Set(db.sessions.map((s) => s.id));
    const added = d.sessions.filter((s) => !have.has(s.id));
    db.sessions = [...db.sessions, ...added].sort((a, b) => a.start - b.start);
    for (const k of ['customEquipment', 'customExercises']) {
      const ids = new Set(db[k].map((q) => q.id));
      db[k].push(...(d[k] || []).filter((q) => !ids.has(q.id)));
    }
    db.equipment = { ...d.equipment, ...db.equipment };
    db.picks = { ...d.picks, ...db.picks };
    db.exPrefs = { ...d.exPrefs, ...db.exPrefs };
    
    save(); render();
    toast(`Restored ${added.length} workouts`);
  } catch { toast("That file isn't a Gym Log backup"); }
}

document.addEventListener('click', (e) => {
  unlockAudio();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});

render();
tickTimer();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
