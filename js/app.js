import {
  RANKS, SUITS, SUIT_SYMBOL, STREETS, HERO,
  replay, occupiedSeats, effectiveButton, positions, positionChoices, buttonForHeroPos,
  boardCards, seatsBefore, results, endStack, handName, eventParts,
  cardText, fmt, parseAmount, seatLabel, actionText, blindsText, handToText,
} from './engine.js';

// ---------- Storage ----------

const KEY = 'hhr.v2';
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.sessions) return d;
  } catch {}
  return { sessions: [], settings: { fullNumbers: false } };
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

const uid = () => Math.random().toString(36).slice(2, 10);
const F = (n) => fmt(n, db.settings.fullNumbers);

function newSession() {
  const prev = db.sessions.at(-1);
  // Tournaments only for now: blinds rise, always a big blind ante.
  const s = {
    id: uid(), createdAt: Date.now(), type: 'tournament',
    game: prev ? { ...prev.game } : { sb: 1000, bb: 2000, ante: 2000, anteType: 'bb' },
    maxSeats: prev?.maxSeats || 9,
    hands: [],
  };
  db.sessions.push(s);
  save();
  return s;
}

const blankSeat = (i) => ({ state: i === HERO ? 'in' : 'out', name: '', stack: null });

function newHand(session) {
  const prev = session.hands.at(-1);
  let seats;
  if (prev && prev.seats.length === session.maxSeats) {
    const st = replay(prev);
    seats = prev.seats.map((s, i) => ({
      state: i === HERO ? 'in' : s.state === 'away' ? 'away' : 'out',
      name: s.name,
      // Opponents change seats and stacks between hands, so only hero's stack carries over.
      stack: i === HERO ? endStack(prev, i, st) : null,
    }));
  } else {
    seats = Array.from({ length: session.maxSeats }, (_, i) => blankSeat(i));
  }
  if (session.myStack != null) seats[HERO].stack = session.myStack;
  const hand = {
    tourney: tourneySnapshot(session),
    id: uid(), num: session.hands.length + 1, createdAt: Date.now(),
    game: { ...session.game, anteType: 'bb', ante: session.game.bb }, seats, button: 0, heroPos: null, stage: 'setup',
    board: [null, null, null, null, null], holes: { [HERO]: [null, null] },
    events: [], winners: [], notes: '', done: false,
  };
  session.hands.push(hand);
  save();
  return hand;
}

// ---------- UI state ----------

const ui = {
  view: 'home', sessionId: null, handId: null,
  sheet: null, // {type:'edit', idx, seat, a}
  raise: null, // {str, unit}
  slot: null, // {k:'board', i} | {k:'hole', seat, i}
  confirmDelete: false,
  toast: null,
};

const root = document.getElementById('app');
const session = () => db.sessions.find((s) => s.id === ui.sessionId) || db.sessions.at(-1) || newSession();
const hand = () => session().hands.find((h) => h.id === ui.handId);

function toast(msg) {
  ui.toast = msg;
  render();
  setTimeout(() => { ui.toast = null; render(); }, 1400);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove();
  }
  toast('Copied');
}

const involved = (h) => h.seats.map((s, i) => (s.state === 'in' ? i : -1)).filter((i) => i >= 0);

// Keep the button wherever it must be for hero to sit in the chosen position.
function placeButton(h) {
  if (!h.heroPos) return;
  const b = buttonForHeroPos(h, h.heroPos);
  if (b == null) h.heroPos = null;
  else h.button = b;
}

// ---------- Small renderers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mc = (c, lg = '') => (c ? `<span class="mc ${c[1]} ${lg}">${cardText(c)}</span>` : `<span class="mc blank ${lg}">?</span>`);
const posName = (h, st, s) => (s === HERO ? 'Hero' : st.pos[s] || `Seat ${s + 1}`);

function allSlots(h) {
  const slots = [0, 1, 2, 3, 4].map((i) => ({ k: 'board', i }));
  [HERO, ...involved(h).filter((s) => s !== HERO)].forEach((seat) => {
    slots.push({ k: 'hole', seat, i: 0 }, { k: 'hole', seat, i: 1 });
  });
  return slots;
}
const slotCard = (h, sl) => (sl.k === 'board' ? h.board[sl.i] : h.holes[sl.seat]?.[sl.i] || null);
const sameSlot = (a, b) => a && b && a.k === b.k && a.i === b.i && a.seat === b.seat;

function setSlot(h, sl, c) {
  if (sl.k === 'board') h.board[sl.i] = c;
  else {
    h.holes[sl.seat] = h.holes[sl.seat] || [null, null];
    h.holes[sl.seat][sl.i] = c;
  }
}

function cardGrid(used, current) {
  let html = '<div class="grid">';
  for (const s of SUITS) {
    for (const r of RANKS) {
      const c = r + s;
      const on = c === current;
      html += `<button class="${s} ${on ? 'picked' : ''}" data-act="card" data-card="${c}" ${used.has(c) && !on ? 'disabled' : ''}>${r}<small>${SUIT_SYMBOL[s]}</small></button>`;
    }
  }
  return html + '</div>';
}

// ---------- Views ----------

function render() {
  if (ui.view === 'hand' && hand()) root.innerHTML = handView();
  else if (ui.view === 'review' && hand()) root.innerHTML = reviewView();
  else { ui.view = 'home'; root.innerHTML = homeView(); }
  if (ui.toast) root.insertAdjacentHTML('beforeend', `<div class="toast">${esc(ui.toast)}</div>`);
}

function handSummary(h) {
  const st = replay(h);
  const { net, winners } = results(h, st);
  const hole = h.holes?.[HERO];
  const cards = hole?.[0] ? hole.map((c) => mc(c)).join('') : '<span class="muted">no cards</span>';
  const vs = involved(h).filter((s) => s !== HERO).map((s) => st.pos[s]).join(', ');
  const n = net[HERO] || 0;
  const status = !h.done ? '<span class="muted">in progress</span>'
    : winners.length ? `<span class="${n >= 0 ? 'pos-net' : 'neg-net'}">${n >= 0 ? '+' : ''}${F(n)}</span>` : '';
  return `<button class="hand-item" data-act="open" data-id="${h.id}">
    <span><b>#${h.num}</b> ${cards} <span class="muted">${h.heroPos || ''}${vs ? ' vs ' + vs : ''}</span></span>${status}</button>`;
}

function homeView() {
  const s = session();
  const dateOf = (x) => new Date(x.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const past = db.sessions.filter((x) => x.id !== s.id).reverse();
  return `<div class="home">
    <div class="row between"><h1>Hand Recorder</h1>
      <button class="btn-ghost" data-act="units">${db.settings.fullNumbers ? '1,000' : '1K'}</button></div>
    ${swipe('session', s.id, tourneyCard(s, dateOf(s)))}
    <button class="big" data-act="new-hand">+ New hand</button>
    ${s.hands.slice().reverse().map((h) => swipe('hand', h.id, handSummary(h))).join('')}
    ${s.hands.length ? `<div class="row"><button class="secondary" style="flex:1" data-act="export-editor">Export for vlog editor</button>
      <button class="secondary" style="flex:1" data-act="copy-all">Copy all as text</button></div>
      <div class="hint">Swipe a hand or session left to delete it.</div>` : ''}
    ${past.length ? `<div class="muted" style="margin-top:8px">Past sessions</div>
      ${past.map((p) => swipe('session', p.id, `<button class="hand-item" data-act="session" data-id="${p.id}">
        <span>${esc(p.name || 'Tournament')} · ${dateOf(p)}</span>
        <span class="muted">${p.hands.length} hands</span></button>`)).join('')}` : ''}
    <div class="muted" style="margin-top:8px">Backup <span class="hint">· every session and hand, to move phones or keep safe</span></div>
    <div class="row"><button class="secondary" style="flex:1" data-act="backup">Back up all</button>
      <button class="secondary" style="flex:1" data-act="restore">Restore</button></div>
    <input type="file" id="restore-file" accept=".json,application/json" hidden>
  </div>`;
}

// ---------- Backup / restore (everything in the app, as one file) ----------

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function backup() {
  const stamp = new Date().toLocaleString('sv-SE').slice(0, 16).replace(/[: ]/g, '-');
  download(`hand-recorder-backup_${stamp}.json`, JSON.stringify({ app: 'hand-recorder', backup: 1, saved_at: new Date().toISOString(), data: db }));
  toast('Backup saved');
}

// Merge a backup in: sessions it has are added, or replaced by the backup's copy
// when the same session is already here. Nothing already here is deleted.
async function restore(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Not a backup file'); }
  const incoming = data?.app === 'hand-recorder' ? data.data?.sessions : null;
  if (!Array.isArray(incoming)) return toast('Not a backup file');
  let added = 0;
  incoming.forEach((s) => {
    const at = db.sessions.findIndex((x) => x.id === s.id);
    if (at >= 0) db.sessions[at] = s; else { db.sessions.push(s); added += 1; }
  });
  db.sessions.sort((a, b) => a.createdAt - b.createdAt);
  ui.sessionId = null;
  save();
  toast(`Restored ${incoming.length} session${incoming.length === 1 ? '' : 's'}${added < incoming.length ? ` (${incoming.length - added} updated)` : ''}`);
}

// The live tournament: details, field size, and the blinds/stack that new hands start from.
function tourneyCard(s, when) {
  const f = (key, label, ph, mode = 'text') => `<label class="tf"><span>${label}</span>
    <input data-input="t-${key}" inputmode="${mode}" placeholder="${ph}" value="${esc(s[key] ?? '')}"></label>`;
  return `<div class="card tcard">
    <div class="row between"><input class="tname" data-input="t-name" placeholder="Tournament name" value="${esc(s.name || '')}">
      <button class="btn-ghost" data-act="new-session">New</button></div>
    <div class="muted">${when} · ${s.hands.length} hands</div>
    <div class="tgrid3">${f('buyin', 'Buy-in', '$1,600')}${f('gtd', 'GTD', '$1M')}${f('bullets', 'My bullets', '1', 'numeric')}</div>
    <div class="tgrid3">${f('entries', 'Entries', '350', 'numeric')}${f('left', 'Players left', '87', 'numeric')}<span></span></div>
    <div class="tgrid3">
      <label class="tf"><span>SB</span><input data-input="t-sb" inputmode="decimal" value="${F(s.game.sb)}"></label>
      <label class="tf"><span>BB <span class="muted">+ BB ante</span></span><input data-input="t-bb" inputmode="decimal" value="${F(s.game.bb)}"></label>
      <label class="tf"><span>My stack</span><input data-input="t-stack" inputmode="decimal" placeholder="in ${STACK_UNITS.find(([u]) => u === (s.stackUnit || 1e3))[1]}" value="${s.myStack != null ? +(s.myStack / (s.stackUnit || 1e3)).toFixed(2) : ''}"></label>
    </div>
    <div class="hint" id="t-eq">${s.myStack != null ? `My stack = ${F(s.myStack)} (${(s.myStack / s.game.bb).toFixed(1)} BB)` : 'New hands start with these blinds and your stack.'}</div>
  </div>`;
}

// What the tournament looked like when the hand was played, for the hand text.
function tourneySnapshot(s) {
  const t = {};
  ['name', 'buyin', 'gtd', 'entries', 'left', 'bullets'].forEach((k) => { if (s[k]) t[k] = s[k]; });
  return t;
}

const SWIPE_W = 88;
const swipe = (kind, id, inner) => `<div class="swipe ${ui.swiped === kind + id ? 'open' : ''}" data-kind="${kind}" data-id="${id}">
  <button class="swipe-del" data-act="swipe-delete">Delete</button><div class="swipe-body">${inner}</div></div>`;

const notesFields = (h) => `
  <textarea class="note" data-input="notes" placeholder="Notes: reads, table talk, anything outside the betting">${esc(h.notes)}</textarea>
  <textarea class="note" data-input="commentary" placeholder="Commentary: what I want to say about this hand">${esc(h.commentary)}</textarea>`;

// Card drawn like a real one: white face, rank and suit in the suit's colour.
const bigCard = (c) => (c ? `<span class="pc ${c[1]}">${c[0] === 'T' ? '10' : c[0]}<i>${SUIT_SYMBOL[c[1]]}</i></span>` : '');

// Actions grouped by street (uninvolved auto-folds left out), with the pot each street starts with.
function streetsOf(st) {
  let pot = (st.blindsPosted || 0) + st.antes;
  const out = [{ street: 0, cards: [], pot, acts: [] }];
  for (const e of st.log) {
    if (e.kind === 'board') { out.push({ street: e.street, cards: e.cards, pot, acts: [] }); continue; }
    pot += e.added;
    if (!e.auto) out.at(-1).acts.push(e);
  }
  return out;
}

// One hand on one screen, for reading while recording commentary. Swipe or arrow to move between hands.
function reviewView() {
  const h = hand();
  const s = session();
  const st = replay(h);
  const idx = s.hands.indexOf(h);
  const full = db.settings.fullNumbers;
  const t = h.tourney || {};
  const { winners, net } = results(h, st);
  const stackTxt = (seat) => (h.seats[seat].stack != null
    ? `${F(h.seats[seat].stack)} <span class="muted">${Math.round(h.seats[seat].stack / h.game.bb)}bb</span>` : '');
  const hole = (seat) => {
    const c = h.holes[seat];
    return c?.[0] && c?.[1] ? c.map(bigCard).join('') : '<span class="muted">—</span>';
  };
  const field = [
    t.left && t.entries ? `${t.left}/${t.entries} left` : t.left ? `${t.left} left` : t.entries ? `${t.entries} entries` : '',
    t.bullets && `bullet #${t.bullets}`,
  ].filter(Boolean).join(' · ');
  const n = net[HERO] || 0;
  const row = (seat, who) => `<div class="hs-row"><span class="hs-who">${who}</span>
    <span class="hs-cards">${hole(seat)}</span><span class="hs-stack">${stackTxt(seat)}</span></div>`;
  return `<div class="top"><button class="btn-ghost" data-act="home">← Hands</button>
      <div class="title">Hand ${h.num} / ${s.hands.length}<small>${esc([t.name, blindsText(h.game, full)].filter(Boolean).join(' · '))}</small></div>
      <button class="btn-ghost" data-act="edit-hand">Edit</button></div>
    <div class="hs" id="hs">
      ${field ? `<div class="muted">${esc(field)}</div>` : ''}
      ${row(HERO, `<b>Hero</b> ${h.heroPos || ''}`)}
      ${involved(h).filter((x) => x !== HERO).map((v) => row(v, `<b>${st.pos[v]}</b>${h.seats[v].name ? ` <span class="tag">${esc(h.seats[v].name)}</span>` : ''}`)).join('')}
      ${streetsOf(st).map((sx) => `<div class="hs-street">
        <div class="hs-sh"><b>${STREETS[sx.street]}</b>${sx.cards.map(bigCard).join('')}${sx.street ? `<span class="muted">pot ${F(sx.pot)}</span>` : ''}</div>
        <div class="hs-acts">${sx.acts.map((e) => `<span class="hs-a"><b>${posName(h, st, e.seat)}</b> <span class="k-${e.a}">${actionText(e, full)}</span></span>`).join('') || '<span class="muted">—</span>'}</div></div>`).join('')}
      <div class="hs-result">${winners.length
        ? `${winners.map((w) => posName(h, st, w)).join(' & ')} ${winners.length > 1 ? 'split' : 'wins'} ${F(st.pot)}${st.phase === 'showdown' ? ' at showdown' : ''}
           · <span class="${n >= 0 ? 'pos-net' : 'neg-net'}">Hero ${n >= 0 ? '+' : ''}${F(n)}</span>`
        : '<span class="muted">No result yet</span>'}</div>
      ${h.commentary?.trim() ? `<div class="hs-say"><b>TO SAY</b>${esc(h.commentary)}</div>` : ''}
      ${h.notes?.trim() ? `<div class="hs-notes"><b>Notes</b>${esc(h.notes)}</div>` : ''}
    </div>
    <div class="hs-nav">
      <button class="btn-ghost" data-act="prev-hand" ${idx <= 0 ? 'disabled' : ''}>‹ Prev</button>
      <button class="btn-ghost" data-act="copy-hand">Copy</button>
      <button class="btn-ghost del" data-act="delete-hand">${ui.confirmDelete ? 'Tap again' : 'Delete'}</button>
      <button class="btn-ghost" data-act="next-hand" ${idx >= s.hands.length - 1 ? 'disabled' : ''}>Next ›</button></div>`;
}

function stepHand(d) {
  const s = session();
  const next = s.hands[s.hands.indexOf(hand()) + d];
  if (!next) return;
  ui.handId = next.id;
  ui.confirmDelete = false;
  render();
}

// ---------- Export for the vlog editor (matches its work/hands.json) ----------

const STREET_KEYS = ['preflop', 'flop', 'turn', 'river'];
const num = (v) => (v == null || v === '' ? null : isFinite(Number(String(v).replace(/,/g, ''))) ? Number(String(v).replace(/,/g, '')) : v);

function editorHand(h) {
  const st = replay(h);
  const who = (s) => (s === HERO ? 'hero' : st.pos[s]);
  const cards = (s) => (h.holes[s]?.[0] && h.holes[s]?.[1] ? [...h.holes[s]] : null);
  const stackStart = (s) => (h.seats[s].stack > 0 ? h.seats[s].stack : null);
  const streets = [{ street: 'preflop', board: [], actions: [] }];
  for (const e of st.log) {
    if (e.kind === 'board') { streets.push({ street: STREET_KEYS[e.street], board: e.cards, actions: [] }); continue; }
    if (e.auto) continue;
    const a = { who: who(e.seat), act: e.a };
    if (e.a === 'raise') a.to = e.to;
    if (e.a === 'bet') a.amount = e.to;
    if (e.allin) { a.allin = true; if (e.a === 'call') a.amount = e.added; }
    streets.at(-1).actions.push(a);
  }
  const { winners } = results(h, st);
  const t = h.tourney || {};
  return {
    hand_no: h.num,
    played_at: new Date(h.createdAt).toISOString(),
    level: { sb: h.game.sb, bb: h.game.bb, ante: h.game.anteType === 'bb' ? h.game.ante : 0 },
    hero: { pos: h.heroPos || st.pos[HERO], cards: cards(HERO), stack_start: stackStart(HERO) },
    villains: involved(h).filter((s) => s !== HERO).map((s) => ({
      pos: st.pos[s], cards: cards(s), stack_start: stackStart(s), ...(h.seats[s].name ? { tag: h.seats[s].name } : {}),
    })),
    say: (h.commentary || '').split('\n').map((x) => x.trim()).filter(Boolean),
    notes: (h.notes || '').trim(),
    streets,
    result: {
      winner: winners.length > 1 ? winners.map(who) : winners.length ? who(winners[0]) : null,
      showdown: st.phase === 'showdown',
      pot: st.pot,
    },
    field: { entries: num(t.entries), left: num(t.left), bullets: num(t.bullets) },
    flags: h.done ? [] : ['not finished in the app'],
    event: eventParts(t, (b) => b, (g) => `${g} GTD`).join(' · '),
  };
}

function exportForEditor() {
  const s = session();
  const day = new Date(s.createdAt).toLocaleDateString('en-CA');
  const data = {
    _source: `Hand Recorder app export (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`,
    tournament: { name: s.name || '', buyin: s.buyin || '', gtd: s.gtd || '', date: day },
    hands: s.hands.map(editorHand),
  };
  const json = JSON.stringify(data, null, 1);
  const slug = (s.name || 'tournament').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `hands_${slug}_${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  copy(json);
}

const SEAT_POS = (i, n, rx, ry, rot = 0) => {
  const a = ((90 + (i * 360) / n + rot) * Math.PI) / 180;
  return { x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
};

function tableView(h, st) {
  const n = h.seats.length;
  const stage = h.stage;
  let html = '<div class="table-wrap"><div class="felt"></div>';
  const board = stage === 'play' ? st.board : h.board.filter(Boolean);
  html += `<div class="center"><div>${board.map((c) => mc(c, 'lg')).join('')}</div>
    ${stage === 'play' ? `<div class="pot">Pot ${F(st.pot)}</div>` : ''}</div>`;
  h.seats.forEach((seat, i) => {
    const p = SEAT_POS(i, n, 43, 41);
    const cls = ['seat', `st-${seat.state}`];
    if (i === HERO) cls.push('hero');
    if (stage === 'play' && st.folded.has(i)) cls.push('folded');
    if (stage === 'play' && st.phase === 'action' && st.toAct === i && !ui.raise) cls.push('toact');
    if (stage === 'play' && st.allin.has(i)) cls.push('allin');
    let label;
    if (seat.state === 'away') label = 'away';
    else label = `${i === HERO ? 'Hero ' : ''}${h.heroPos ? st.pos[i] || '' : ''}` || '·';
    let sub = '';
    if (seat.state === 'in') {
      if (stage === 'play' && st.allin.has(i)) sub = 'ALL-IN';
      else if (seat.stack != null) sub = F(stage === 'play' ? st.remaining(i) : seat.stack);
    } else if (seat.state === 'out' && stage === 'setup') sub = 'not in hand';
    const hole = h.holes[i];
    const cards = hole?.some(Boolean) ? hole.map((c) => mc(c)).join('') : '';
    html += `<div class="${cls.join(' ')}" data-act="seat" data-seat="${i}" style="left:${p.x}%;top:${p.y}%">
      <div class="p">${label}</div>
      ${sub ? `<div class="s">${sub}</div>` : ''}
      ${seat.name && i !== HERO && seat.state === 'in' ? `<div class="n">${esc(seat.name)}</div>` : ''}
      ${cards ? `<div class="mini">${cards}</div>` : ''}</div>`;
    if (stage === 'play' && st.contrib[i] > 0) {
      const b = SEAT_POS(i, n, 25, 21);
      html += `<div class="betchip" style="left:${b.x}%;top:${b.y}%">${F(st.contrib[i])}</div>`;
    }
  });
  if (h.heroPos) {
    const d = SEAT_POS(effectiveButton(h), n, 31, 27, 14);
    html += `<div class="dealer" style="left:${d.x}%;top:${d.y}%">D</div>`;
  }
  return html + '</div>';
}

function logView(h, st) {
  let html = '<div class="log">';
  const shown = st.log.filter((e) => !e.auto);
  if (!shown.length) html += '<span class="empty">Actions will show here. Tap one to fix it.</span>';
  let street = -1;
  for (const e of shown) {
    if (e.kind === 'board') {
      street = e.street;
      html += `<button class="chip st" data-act="goto" data-stage="cards">${STREETS[e.street]} ${e.cards.map(cardText).join('')}</button>`;
      continue;
    }
    if (street === -1) { street = 0; html += '<span class="chip st">Pre</span>'; }
    html += `<button class="chip ${e.a}" data-act="edit-log" data-idx="${e.idx}">${posName(h, st, e.seat)} ${actionText(e, db.settings.fullNumbers)}</button>`;
  }
  return html + '</div>';
}

function stepper(h) {
  const steps = [['setup', '1 Setup'], ['cards', '2 Cards'], ['play', '3 Actions']];
  return `<div class="steps">${steps.map(([k, l]) => `<button class="${h.stage === k ? 'on' : ''}" data-act="goto" data-stage="${k}" ${k !== 'setup' && !h.heroPos ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
}

function handView() {
  const h = hand();
  const st = replay(h);
  let panel;
  if (h.stage === 'setup') panel = setupPanel(h, st);
  else if (h.stage === 'cards') panel = cardsPanel(h);
  else panel = playPanel(h, st);
  return `<div class="top">
      <button class="btn-ghost" data-act="home">←</button>
      <div class="title">Hand #${h.num}<small>${blindsText(h.game, db.settings.fullNumbers)}</small></div>
      <button class="btn-ghost" data-act="undo" ${h.stage !== 'play' || !h.events.length ? 'disabled' : ''}>Undo</button></div>
    ${stepper(h)}
    ${tableView(h, st)}
    ${h.stage === 'play' ? logView(h, st) : ''}
    <div class="panel">${panel}</div>
    ${ui.sheet ? sheetView(h, st) : ''}`;
}

const STACK_UNITS = [[1e3, '1K'], [1e4, '10K'], [1e5, '100K']];
const stackUnit = () => session().stackUnit || 1e3;

// A plain number is taken in the chosen unit; "1.2m" or "450k" still work as typed.
function parseStack(v) {
  const t = v.trim();
  if (t === '') return null;
  if (/^[\d.,]+$/.test(t)) {
    const n = parseFloat(t.replace(/,/g, ''));
    return isFinite(n) ? Math.round(n * stackUnit()) : null;
  }
  return parseAmount(t);
}

function setupPanel(h, st) {
  const g = h.game;
  const count = occupiedSeats(h).length;
  const choices = positionChoices(count);
  return `<div class="blinds-row"><label>SB</label><input data-input="sb" inputmode="decimal" value="${F(g.sb)}">
      <label>BB</label><input data-input="bb" inputmode="decimal" value="${F(g.bb)}"><span class="muted">+ BB ante</span></div>
    <div class="row between"><span class="label">Table</span>
      <div class="seg" style="flex:none">${[6, 8, 9, 10].map((n) => `<button class="${h.seats.length === n ? 'on' : ''}" data-act="table" data-n="${n}">${n}-max</button>`).join('')}</div></div>
    <div class="label">Hero's position <span class="muted">(${count} players dealt)</span></div>
    <div class="chips poschips" style="--n:${choices.length}">${choices.map((p) => `<button class="${h.heroPos === p ? 'on' : ''}" data-act="hero-pos" data-p="${p}">${p}</button>`).join('')}</div>
    <div class="hint">Tap players on the table: not in hand → in hand → away. Stacks come at the end.</div>
    <button class="primary" data-act="goto" data-stage="cards" ${h.heroPos ? '' : 'disabled'}>${h.heroPos ? 'Cards →' : 'Pick hero\'s position'}</button>`;
}

function cardsPanel(h) {
  const slots = allSlots(h);
  if (!ui.slot || !slots.some((s) => sameSlot(s, ui.slot))) ui.slot = slots.find((s) => !slotCard(h, s)) || slots[0];
  const used = new Set(slots.map((s) => slotCard(h, s)).filter(Boolean));
  const current = slotCard(h, ui.slot);
  const slotBtn = (sl) => `<button class="slot ${sameSlot(sl, ui.slot) ? 'on' : ''}" data-act="slot" data-k="${sl.k}" data-i="${sl.i}" data-seat="${sl.seat ?? ''}">${slotCard(h, sl) ? mc(slotCard(h, sl)) : ''}</button>`;
  const st = replay(h);
  const nb = boardCards(h).length;
  const boardOk = nb === 0 || nb >= 3;
  let rows = `<div class="slot-row"><span class="who">Board</span>
    <span class="slot-group">${[0, 1, 2].map((i) => slotBtn({ k: 'board', i })).join('')}</span>
    <span class="slot-group">${slotBtn({ k: 'board', i: 3 })}</span>
    <span class="slot-group">${slotBtn({ k: 'board', i: 4 })}</span></div>`;
  const seatsWithCards = [HERO, ...involved(h).filter((s) => s !== HERO)];
  rows += '<div class="hole-rows">' + seatsWithCards.map((s) => `<div class="slot-row"><span class="who">${posName(h, st, s)}</span>
    <span class="slot-group">${slotBtn({ k: 'hole', seat: s, i: 0 })}${slotBtn({ k: 'hole', seat: s, i: 1 })}</span></div>`).join('') + '</div>';
  return `${rows}
    ${cardGrid(used, current)}
    <div class="row"><button class="secondary" data-act="clear-slot" ${current ? '' : 'disabled'}>Clear</button>
      <span class="hint" style="flex:1">${boardOk ? 'Tap a player on the table to add or remove them. No cards = folded.' : 'The flop needs 3 cards.'}</span></div>
    <button class="primary" data-act="goto" data-stage="play" ${boardOk ? '' : 'disabled'}>Actions →</button>`;
}

function playPanel(h, st) {
  if (ui.stackEdit) return `${stacksBlock(h, st)}<button class="primary" data-act="stacks-edit">Done</button>`;
  if (st.phase === 'action') return ui.raise ? raisePanel(h, st) : actionPanel(h, st);
  if (st.phase === 'needboard') {
    return `<div class="prompt">${STREETS[st.missingStreet]} card missing <small>the hand is still going</small></div>
      <button class="primary" data-act="goto" data-stage="cards">Add ${STREETS[st.missingStreet].toLowerCase()} card</button>`;
  }
  return endPanel(h, st);
}

function actionPanel(h, st) {
  const s = st.toAct;
  const facing = st.currentBet - st.contrib[s];
  const callAmt = Math.min(facing, st.remaining(s));
  const hasStack = isFinite(st.remaining(s));
  return `<div class="prompt">${seatLabel(h, st, s)} <small>${STREETS[st.street]}${facing > 0 ? ` · ${F(callAmt)} to call` : ''}</small></div>
    <div class="actions">
      <button class="a-fold" data-act="do" data-a="fold">Fold</button>
      <button class="a-call" data-act="do" data-a="${facing > 0 ? 'call' : 'check'}">${facing > 0 ? 'Call' : 'Check'}</button>
      <button class="a-raise" data-act="open-raise">${st.currentBet > 0 ? 'Raise' : 'Bet'}</button>
      ${hasStack ? `<button class="a-allin" data-act="do" data-a="allin">All-in ${F(st.remaining(s) + st.contrib[s])}</button>` : ''}
    </div>
    <div class="row between"><span class="hint">Tap a seat to ${facing > 0 ? 'fold' : 'check'} around to it.</span>
      <button class="btn-ghost" data-act="stacks-edit">Stacks</button></div>`;
}

function raiseBounds(h, st) {
  const s = st.toAct;
  const minTo = st.currentBet > 0 ? st.currentBet + st.minRaise : h.game.bb;
  const maxTo = isFinite(st.remaining(s)) ? st.remaining(s) + st.contrib[s] : Math.max(minTo * 5, st.pot * 3);
  return { minTo, maxTo, step: Math.max(1, Math.round(h.game.sb / 2)) };
}

function raiseValue() {
  const v = parseFloat(ui.raise.str);
  return isFinite(v) ? Math.round(v * ui.raise.unit) : 0;
}

function presets(h, st) {
  const pot = st.pot;
  const potRaise = st.currentBet + pot + (st.currentBet - st.contrib[st.toAct]);
  const out = [];
  if (st.street === 0 && st.currentBet <= h.game.bb) [2, 2.5, 3].forEach((m) => out.push([`${m}x`, st.currentBet * m]));
  else if (st.currentBet === 0) [[1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [1, 'Pot']].forEach(([f, l]) => out.push([l, pot * f]));
  else [2.5, 3].forEach((m) => out.push([`${m}x`, st.currentBet * m]));
  if (st.currentBet > 0) out.push(['Pot', potRaise]);
  const step = Math.max(1, h.game.sb / 2);
  return out.map(([l, v]) => [l, Math.round(v / step) * step]);
}

function raisePanel(h, st) {
  const { minTo, maxTo, step } = raiseBounds(h, st);
  const v = raiseValue();
  const verb = st.currentBet > 0 ? 'Raise to' : 'Bet';
  const units = [[1, '×1'], [1e3, 'K'], [1e6, 'M']];
  return `<div class="rdisp"><span class="val" id="rval">${esc(ui.raise.str || '0')}</span>
      <div class="seg" style="flex:none">${units.map(([u, l]) => `<button class="${ui.raise.unit === u ? 'on' : ''}" data-act="unit" data-u="${u}">${l}</button>`).join('')}</div>
      <span class="eq" id="req">= ${fmt(v, true)}</span></div>
    <div class="presets">${presets(h, st).map(([l, val]) => `<button data-act="preset" data-v="${val}">${l} <span class="muted">${F(val)}</span></button>`).join('')}
      <button data-act="preset" data-v="${minTo}">Min <span class="muted">${F(minTo)}</span></button></div>
    <input type="range" data-input="slider" min="${minTo}" max="${maxTo}" step="${step}" value="${Math.min(maxTo, Math.max(minTo, v || minTo))}">
    <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => `<button data-act="key" data-k="${k}">${k}</button>`).join('')}</div>
    <div class="row"><button class="secondary" style="flex:1" data-act="cancel-raise">Cancel</button>
      <button class="primary" style="flex:2" id="rconfirm" data-act="confirm-raise" ${v <= st.currentBet ? 'disabled' : ''}>${verb} ${F(v)}</button></div>`;
}

function stacksBlock(h, st) {
  const unit = stackUnit();
  return `<div class="row between"><span class="label">Stacks at start <span class="muted">(blank = same as Hero)</span></span>
      <div class="seg" style="flex:none">${STACK_UNITS.map(([u, l]) => `<button class="${unit === u ? 'on' : ''}" data-act="stack-unit" data-u="${u}">${l}</button>`).join('')}</div></div>
    ${involved(h).map((s) => {
      const c = h.holes[s];
      return `<div class="inv-row"><span class="who">${posName(h, st, s)}</span>
        <span class="inv-cards">${c?.[0] && c?.[1] ? c.map((x) => mc(x)).join('') : ''}</span>
        <input data-input="stack" data-seat="${s}" inputmode="decimal" placeholder="stack" value="${h.seats[s].stack != null ? +(h.seats[s].stack / unit).toFixed(2) : ''}">
        ${s === HERO ? '<span class="namefill"></span>' : `<input data-input="name" data-seat="${s}" placeholder="tag" value="${esc(h.seats[s].name)}">`}</div>`;
    }).join('')}`;
}

function endPanel(h, st) {
  const { winners } = results(h, st);
  let html = '';
  if (st.phase === 'done') {
    html += `<div class="prompt">${seatLabel(h, st, winners[0])} wins ${F(st.pot)}</div>`;
  } else {
    html += `<div class="row between"><span class="prompt">Showdown <small>winner (tap 2+ to split)</small></span>
      <button class="btn-ghost" data-act="goto" data-stage="cards">Edit cards</button></div>
      <div class="chips">${st.active.map((s) => `<button class="${winners.includes(s) ? 'on' : ''}" data-act="winner" data-seat="${s}">${posName(h, st, s)} <span class="muted">${handName(h.holes[s], st.board)}</span></button>`).join('')}</div>`;
  }
  // Stacks and tags come last: the hand is recorded first, details after.
  html += stacksBlock(h, st);
  html += `<div class="label">Notes <span class="muted">(optional)</span></div>${notesFields(h)}
    <button class="primary" data-act="finish" ${winners.length ? '' : 'disabled'}>Save hand</button>`;
  return html;
}

function sheetView(h, st) {
  const sh = ui.sheet;
  const ev = h.events[sh.idx];
  const kinds = ['fold', 'check', 'call', 'raise', 'allin'];
  return `<div class="overlay" data-act="close-sheet"><div class="sheet" data-stop>
    <h3>Fix action</h3>
    <div class="muted">Player</div>
    <div class="chips">${occupiedSeats(h).filter((s) => h.seats[s].state === 'in').map((s) => `<button class="${sh.seat === s ? 'on' : ''}" data-act="edit-seat" data-seat="${s}">${posName(h, st, s)}</button>`).join('')}</div>
    <div class="muted">Action</div>
    <div class="chips">${kinds.map((k) => `<button class="${sh.a === k ? 'on' : ''}" data-act="edit-a" data-a="${k}">${k === 'raise' ? 'Bet / raise' : k === 'allin' ? 'All-in' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
    ${sh.a === 'raise' ? `<label class="muted">To amount</label><input data-input="edit-to" inputmode="decimal" value="${ev.to ? F(ev.to) : ''}">` : ''}
    <div class="row"><button class="danger" data-act="edit-delete">Delete</button><span style="flex:1"></span>
      <button class="secondary" data-act="close-sheet">Cancel</button><button class="primary" data-act="edit-save">Save</button></div>
  </div></div>`;
}

// ---------- Actions ----------

function doAction(a, to) {
  const h = hand();
  const st = replay(h);
  if (st.phase !== 'action') return;
  h.events.push({ t: 'act', seat: st.toAct, a, to });
  ui.raise = null;
  save();
  render();
}

function openRaise() {
  const h = hand();
  ui.raise = { str: '', unit: h.game.bb >= 1e6 ? 1e6 : h.game.bb >= 1000 ? 1e3 : 1 };
  render();
}

function setRaiseValue(v) {
  ui.raise.str = String(Number((v / ui.raise.unit).toFixed(3)));
}

function refreshRaise() {
  // Update the amount without rebuilding the panel (keeps the slider drag smooth).
  const st = replay(hand());
  const v = raiseValue();
  const val = root.querySelector('#rval');
  if (!val) return render();
  val.textContent = ui.raise.str || '0';
  root.querySelector('#req').textContent = `= ${fmt(v, true)}`;
  const btn = root.querySelector('#rconfirm');
  btn.textContent = `${st.currentBet > 0 ? 'Raise to' : 'Bet'} ${F(v)}`;
  btn.disabled = v <= st.currentBet;
}

function pickCard(c) {
  const h = hand();
  const sl = ui.slot;
  if (!sl) return;
  if (slotCard(h, sl) === c) setSlot(h, sl, null);
  else {
    setSlot(h, sl, c);
    // Move on to the next empty slot.
    const slots = allSlots(h);
    const at = slots.findIndex((s) => sameSlot(s, sl));
    ui.slot = slots.slice(at + 1).find((s) => !slotCard(h, s)) || slots.find((s) => !slotCard(h, s)) || sl;
  }
  save();
  render();
}

function seatTap(i) {
  const h = hand();
  if (h.stage === 'setup') {
    if (i === HERO) return;
    const order = ['out', 'in', 'away'];
    const seat = h.seats[i];
    seat.state = order[(order.indexOf(seat.state) + 1) % 3];
    if (seat.state !== 'in') delete h.holes[i];
    placeButton(h);
    save();
    return render();
  }
  // Cards page: tap an opponent to bring them into the hand, or take them out.
  if (h.stage === 'cards') {
    if (i === HERO || h.seats[i].state === 'away') return;
    const seat = h.seats[i];
    seat.state = seat.state === 'in' ? 'out' : 'in';
    if (seat.state === 'out') delete h.holes[i];
    else ui.slot = { k: 'hole', seat: i, i: 0 };
    save();
    return render();
  }
  const st = replay(h);
  if (h.stage !== 'play' || st.phase !== 'action' || ui.raise || i === st.toAct) return;
  const before = seatsBefore(st, h, i);
  if (!before) return;
  for (const s of before) {
    const cur = replay(h);
    h.events.push({ t: 'act', seat: s, a: cur.currentBet - cur.contrib[s] > 0 ? 'fold' : 'check' });
  }
  save();
  render();
}

function resizeTable(h, n) {
  const seats = Array.from({ length: n }, (_, i) => h.seats[i] || blankSeat(i));
  h.seats = seats;
  Object.keys(h.holes).forEach((k) => { if (Number(k) >= n) delete h.holes[k]; });
  session().maxSeats = n;
  placeButton(h);
}

const handlers = {
  home() { ui.view = 'home'; ui.stackEdit = false; ui.raise = null; ui.sheet = null; ui.slot = null; ui.confirmDelete = false; render(); },
  units() { db.settings.fullNumbers = !db.settings.fullNumbers; save(); render(); },
  'new-session'() { ui.sessionId = newSession().id; toast('New session started'); },
  session(el) { ui.sessionId = el.dataset.id; render(); },
  'new-hand'() { const h = newHand(session()); ui.handId = h.id; ui.view = 'hand'; render(); },
  open(el) { ui.handId = el.dataset.id; ui.view = hand().done ? 'review' : 'hand'; render(); },
  'copy-all'() { copy(session().hands.map((h) => handToText(h, db.settings.fullNumbers)).join('\n\n---\n\n')); },
  'copy-hand'() { copy(handToText(hand(), db.settings.fullNumbers)); },
  'export-editor'() { exportForEditor(); },
  backup() { backup(); },
  restore() { root.querySelector('#restore-file').click(); },
  'prev-hand'() { stepHand(-1); },
  'next-hand'() { stepHand(1); },
  'edit-hand'() { hand().done = false; save(); ui.view = 'hand'; render(); },
  'delete-hand'() {
    if (!ui.confirmDelete) { ui.confirmDelete = true; return render(); }
    const s = session();
    s.hands = s.hands.filter((h) => h.id !== ui.handId);
    s.hands.forEach((h, i) => { h.num = i + 1; });
    save(); handlers.home();
  },
  ante(el) {
    const g = hand().game;
    g.anteType = el.dataset.v;
    g.ante = g.anteType === 'bb' ? g.bb : 0;
    session().game = { ...g };
    save(); render();
  },
  table(el) { resizeTable(hand(), Number(el.dataset.n)); save(); render(); },
  'stacks-edit'() { ui.stackEdit = !ui.stackEdit; ui.raise = null; render(); },
  'stack-unit'(el) { session().stackUnit = Number(el.dataset.u); save(); render(); },
  'hero-pos'(el) { const h = hand(); h.heroPos = el.dataset.p; placeButton(h); save(); render(); },
  goto(el) {
    const h = hand();
    h.stage = el.dataset.stage;
    h.done = false;
    ui.slot = null; ui.raise = null; ui.stackEdit = false;
    save(); render();
  },
  seat(el) { seatTap(Number(el.dataset.seat)); },
  slot(el) {
    const d = el.dataset;
    ui.slot = d.k === 'board' ? { k: 'board', i: Number(d.i) } : { k: 'hole', seat: Number(d.seat), i: Number(d.i) };
    render();
  },
  'clear-slot'() { setSlot(hand(), ui.slot, null); save(); render(); },
  card(el) { pickCard(el.dataset.card); },
  'close-sheet'(el, e) { if (e.target.closest('[data-stop]') && !el.matches('button')) return; ui.sheet = null; render(); },
  do(el) { doAction(el.dataset.a); },
  'open-raise'() { openRaise(); },
  'cancel-raise'() { ui.raise = null; render(); },
  unit(el) { const v = raiseValue(); ui.raise.unit = Number(el.dataset.u); if (v) setRaiseValue(v); render(); },
  preset(el) { setRaiseValue(Number(el.dataset.v)); render(); },
  key(el) {
    const k = el.dataset.k;
    if (k === '⌫') ui.raise.str = ui.raise.str.slice(0, -1);
    else if (k === '.' && ui.raise.str.includes('.')) return;
    else ui.raise.str += k;
    refreshRaise();
  },
  'confirm-raise'() {
    const v = raiseValue();
    const st = replay(hand());
    if (v <= st.currentBet) return;
    doAction(st.currentBet > 0 ? 'raise' : 'bet', v);
  },
  undo() { const h = hand(); h.events.pop(); h.winners = []; h.done = false; ui.raise = null; save(); render(); },
  winner(el) {
    const h = hand();
    const st = replay(h);
    const s = Number(el.dataset.seat);
    const cur = results(h, st).winners;
    h.winners = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    save(); render();
  },
  finish() {
    const h = hand();
    const s = session();
    h.winners = results(h).winners;
    h.done = true;
    // The latest hand moves the live tournament forward: my stack after the hand.
    if (s.hands.at(-1) === h) {
      h.tourney = tourneySnapshot(s);
      if (h.seats[HERO].stack != null) s.myStack = endStack(h, HERO);
    }
    save(); ui.view = 'review'; render();
  },
  'edit-log'(el) {
    const idx = Number(el.dataset.idx);
    const ev = hand().events[idx];
    ui.sheet = { type: 'edit', idx, seat: ev.seat, a: ev.a === 'bet' ? 'raise' : ev.a };
    render();
  },
  'edit-seat'(el) { ui.sheet.seat = Number(el.dataset.seat); render(); },
  'edit-a'(el) { ui.sheet.a = el.dataset.a; render(); },
  'edit-save'() {
    const h = hand();
    const ev = h.events[ui.sheet.idx];
    ev.seat = ui.sheet.seat;
    ev.a = ui.sheet.a;
    if (ev.a === 'raise') {
      const to = parseAmount(root.querySelector('[data-input="edit-to"]')?.value);
      if (to) ev.to = to;
    } else delete ev.to;
    ui.sheet = null; save(); render();
  },
  'edit-delete'() { hand().events.splice(ui.sheet.idx, 1); ui.sheet = null; save(); render(); },
  'swipe-delete'(el) {
    const { kind, id } = el.closest('.swipe').dataset;
    if (kind === 'hand') {
      const s = session();
      s.hands = s.hands.filter((h) => h.id !== id);
      s.hands.forEach((h, i) => { h.num = i + 1; });
    } else {
      db.sessions = db.sessions.filter((x) => x.id !== id);
      if (ui.sessionId === id) ui.sessionId = null;
    }
    ui.swiped = null;
    save();
    toast(kind === 'hand' ? 'Hand deleted' : 'Session deleted');
  },
};

// Swipe a row left to reveal Delete (mouse drag works too).
root.addEventListener('pointerdown', (e) => {
  const body = e.target.closest('.swipe-body');
  if (!body) return;
  const wrap = body.parentElement;
  const key = wrap.dataset.kind + wrap.dataset.id;
  const base = ui.swiped === key ? -SWIPE_W : 0;
  const startX = e.clientX;
  let dx = base;
  let moved = false;
  const move = (ev) => {
    if (Math.abs(ev.clientX - startX) > 6) moved = true;
    if (!moved) return;
    dx = Math.min(0, Math.max(-SWIPE_W, base + ev.clientX - startX));
    body.classList.add('dragging');
    body.style.transform = `translateX(${dx}px)`;
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (!moved) return;
    ui.swiped = dx < -SWIPE_W / 2 ? key : null;
    ui.justDragged = true;
    setTimeout(() => { ui.justDragged = false; }, 0);
    render();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

document.addEventListener('click', (e) => {
  if (ui.swiped && !root.contains(e.target)) { ui.swiped = null; render(); }
});

root.addEventListener('click', (e) => {
  if (ui.justDragged) return;
  const el = e.target.closest('[data-act]');
  if (ui.swiped && el?.dataset.act !== 'swipe-delete') { ui.swiped = null; render(); return; }
  if (!el || el.disabled) return;
  if (el.classList.contains('overlay') && e.target !== el) return;
  if (el.dataset.act !== 'delete-hand') ui.confirmDelete = false;
  handlers[el.dataset.act]?.(el, e);
});

root.addEventListener('input', (e) => {
  const key = e.target.dataset.input;
  if (!key) return;
  const h = hand();
  const v = e.target.value;
  if (key.startsWith('t-')) {
    const s = session();
    const k = key.slice(2);
    if (k === 'sb' || k === 'bb') {
      const n = parseAmount(v);
      if (n == null) return;
      s.game[k] = n;
      if (k === 'sb') {
        s.game.bb = n * 2;
        const bbInput = root.querySelector('[data-input="t-bb"]');
        if (bbInput) bbInput.value = F(s.game.bb);
      }
      s.game.anteType = 'bb';
      s.game.ante = s.game.bb;
    } else if (k === 'stack') s.myStack = parseStack(v);
    else s[k] = v;
    const eq = root.querySelector('#t-eq');
    if (eq && s.myStack != null) eq.textContent = `My stack = ${F(s.myStack)} (${(s.myStack / s.game.bb).toFixed(1)} BB)`;
    save();
    return;
  }
  if (key === 'notes' || key === 'commentary') { h[key] = v; save(); return; }
  if (key === 'slider') { setRaiseValue(Number(v)); refreshRaise(); return; }
  if (key === 'sb' || key === 'bb') {
    const n = parseAmount(v);
    if (n == null) return;
    h.game[key] = n;
    if (key === 'sb') {
      h.game.bb = n * 2;
      const bbInput = root.querySelector('[data-input="bb"]');
      if (bbInput) bbInput.value = F(h.game.bb);
    }
    if (h.game.anteType === 'bb') h.game.ante = h.game.bb;
    session().game = { ...h.game };
    save();
    root.querySelector('.title small').textContent = blindsText(h.game, db.settings.fullNumbers);
    return;
  }
  const seat = Number(e.target.dataset.seat);
  if (key === 'stack') {
    h.seats[seat].stack = parseStack(v);
    save();
    const eq = root.querySelector(`[data-eq="${seat}"]`);
    if (eq) eq.textContent = h.seats[seat].stack != null ? '= ' + F(h.seats[seat].stack) : '';
    return;
  }
  if (key === 'name') { h.seats[seat].name = v; save(); }
});

// Redraw the table once a stack or name field is done being edited.
root.addEventListener('change', (e) => {
  // Blinds show in the standard format (1,500 or 1.5K) once typing is done.
  const key = e.target.dataset.input;
  if (['sb', 'bb', 't-sb', 't-bb'].includes(key)) {
    const n = parseAmount(e.target.value);
    if (n != null) e.target.value = F(n);
    return;
  }
  if (e.target.id === 'restore-file') {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) restore(f);
    return;
  }
  if (['stack', 'name'].includes(e.target.dataset.input)) render();
});

// Hand sheet: swipe left/right (or drag with the mouse) to move between hands.
root.addEventListener('pointerdown', (e) => {
  if (ui.view !== 'review' || !e.target.closest('#hs')) return;
  const x0 = e.clientX;
  const up = (ev) => {
    window.removeEventListener('pointerup', up);
    const dx = ev.clientX - x0;
    if (Math.abs(dx) > 60) stepHand(dx < 0 ? 1 : -1);
  };
  window.addEventListener('pointerup', up);
});

// Desktop shortcuts: arrows on the hand sheet; F / C / R, digits in the raise panel, Enter, Esc.
document.addEventListener('keydown', (e) => {
  if (ui.view === 'review' && !e.target.matches?.('input, textarea')) {
    if (e.key === 'ArrowRight') stepHand(1);
    else if (e.key === 'ArrowLeft') stepHand(-1);
    return;
  }
  if (ui.view !== 'hand' || e.target.matches?.('input, textarea')) return;
  const h = hand();
  if (h.stage !== 'play') return;
  const st = replay(h);
  if (st.phase !== 'action') return;
  if (ui.raise) {
    if (/^[0-9.]$/.test(e.key)) { if (e.key !== '.' || !ui.raise.str.includes('.')) ui.raise.str += e.key; refreshRaise(); }
    else if (e.key === 'Backspace') { ui.raise.str = ui.raise.str.slice(0, -1); refreshRaise(); }
    else if (e.key === 'Enter') handlers['confirm-raise']();
    else if (e.key === 'Escape') handlers['cancel-raise']();
    else if (e.key.toLowerCase() === 'k') { ui.raise.unit = 1e3; render(); }
    return;
  }
  const facing = st.currentBet - st.contrib[st.toAct];
  const k = e.key.toLowerCase();
  if (k === 'f') doAction('fold');
  else if (k === 'c') doAction(facing > 0 ? 'call' : 'check');
  else if (k === 'r' || k === 'b') openRaise();
});

render();

// Offline support once the app is served from a secure address (the hosted site, or localhost).
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
