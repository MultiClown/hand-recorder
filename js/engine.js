// Hand logic. A hand is its setup, its cards and a list of actions; everything
// else (pot, whose turn, which street) is derived by replaying those actions.
//
// Seat states: 'in' = involved in the hand, 'out' = dealt in but folds
// preflop without being recorded, 'away' = not dealt in (missing player).

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS = ['s', 'h', 'd', 'c'];
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const STREETS = ['Preflop', 'Flop', 'Turn', 'River'];
const CARDS_THROUGH = [0, 3, 4, 5];
export const HERO = 0;

const POSITION_NAMES = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
  10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'HJ', 'CO'],
};

const seated = (seat) => seat.state !== 'away';

export function occupiedSeats(hand) {
  return hand.seats.map((s, i) => (seated(s) ? i : -1)).filter((i) => i >= 0);
}

export function nextOccupied(hand, from) {
  const n = hand.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (seated(hand.seats[i])) return i;
  }
  return from;
}

export function effectiveButton(hand) {
  return hand.seats[hand.button] && seated(hand.seats[hand.button]) ? hand.button : nextOccupied(hand, hand.button);
}

export function positions(hand) {
  const occ = occupiedSeats(hand);
  const map = {};
  if (occ.length < 2) return map;
  const names = POSITION_NAMES[occ.length] || POSITION_NAMES[10];
  let s = effectiveButton(hand);
  for (let k = 0; k < occ.length; k++) {
    map[s] = names[k] ?? `MP${k}`;
    s = nextOccupied(hand, s);
  }
  return map;
}

// Positions in the order players act preflop, for the hero-position picker.
export function positionChoices(count) {
  const names = POSITION_NAMES[Math.min(Math.max(count, 2), 10)];
  return names.length > 3 ? names.slice(3).concat(names.slice(0, 3)) : names;
}

export function buttonForHeroPos(hand, name) {
  for (const b of occupiedSeats(hand)) {
    if (positions({ ...hand, button: b })[HERO] === name) return b;
  }
  return null;
}

export function blindSeats(hand) {
  const btn = effectiveButton(hand);
  if (occupiedSeats(hand).length === 2) return { sb: btn, bb: nextOccupied(hand, btn) };
  const sb = nextOccupied(hand, btn);
  return { sb, bb: nextOccupied(hand, sb) };
}

// Board cards as entered, up to the first gap.
export function boardCards(hand) {
  const out = [];
  for (const c of hand.board || []) {
    if (!c) break;
    out.push(c);
  }
  return out;
}

export function replay(hand) {
  const occ = occupiedSeats(hand);
  const { bb: bbAmt, sb: sbAmt } = hand.game;
  const board = boardCards(hand);
  const st = {
    btn: effectiveButton(hand),
    pos: positions(hand),
    street: 0,
    board: [],
    contrib: {}, // this street
    total: {}, // whole hand, excluding antes
    anteBy: {},
    antes: 0,
    folded: new Set(),
    allin: new Set(),
    currentBet: 0,
    minRaise: bbAmt,
    needToAct: new Set(),
    lastActor: null,
    toAct: null,
    log: [],
  };
  occ.forEach((s) => { st.contrib[s] = 0; st.total[s] = 0; st.anteBy[s] = 0; });
  st.remaining = () => Infinity;
  if (occ.length < 2) return finish(st, occ);

  // An empty or zero stack means "not entered", never all-in for nothing.
  // Until an opponent's stack is entered, they play as if covering the same stack as hero.
  const known = (s) => (hand.seats[s].stack > 0 ? hand.seats[s].stack : null);
  const stackOf = (s) => known(s) ?? known(HERO) ?? Infinity;
  const remaining = (s) => stackOf(s) - st.total[s] - st.anteBy[s];
  st.remaining = remaining;
  st.stackOf = stackOf;
  st.known = known;
  const put = (s, amt) => {
    const a = Math.max(0, Math.min(amt, remaining(s)));
    st.contrib[s] += a;
    st.total[s] += a;
    if (remaining(s) <= 0) st.allin.add(s);
    return a;
  };
  const payAnte = (s, amt) => {
    const a = Math.max(0, Math.min(amt, remaining(s)));
    st.anteBy[s] += a;
    st.antes += a;
    if (remaining(s) <= 0) st.allin.add(s);
  };
  const active = () => occ.filter((s) => !st.folded.has(s));
  const canAct = () => active().filter((s) => !st.allin.has(s));
  const startBetting = (lastActor) => {
    const able = canAct();
    // With one player left who can act, they only act if they face a bet.
    st.needToAct = new Set(able.length > 1 ? able : able.filter((s) => st.contrib[s] < st.currentBet));
    st.lastActor = lastActor;
  };

  // Fold uninvolved players as the action reaches them, and deal the next
  // street from the entered board once a betting round is complete.
  const settle = () => {
    for (let guard = 0; guard < 50; guard++) {
      if (active().length <= 1) return;
      if (st.needToAct.size > 0) {
        const s = nextIn(st.needToAct, st.lastActor, occ);
        if (hand.seats[s].state !== 'out') return;
        st.folded.add(s);
        st.needToAct.delete(s);
        st.lastActor = s;
        st.log.push({ idx: null, auto: true, street: st.street, kind: 'act', seat: s, a: 'fold', to: 0, added: 0 });
        continue;
      }
      if (st.street >= 3 || board.length < CARDS_THROUGH[st.street + 1]) return;
      st.street += 1;
      const cards = board.slice(CARDS_THROUGH[st.street - 1], CARDS_THROUGH[st.street]);
      st.board.push(...cards);
      occ.forEach((s) => { st.contrib[s] = 0; });
      st.currentBet = 0;
      st.minRaise = bbAmt;
      startBetting(st.btn);
      st.log.push({ idx: null, street: st.street, kind: 'board', cards });
    }
  };

  const blinds = blindSeats(hand);
  st.sbSeat = blinds.sb;
  st.bbSeat = blinds.bb;
  const ante = hand.game.ante || 0;
  if (hand.game.anteType === 'bb') payAnte(blinds.bb, ante);
  else if (hand.game.anteType === 'all') occ.forEach((s) => payAnte(s, ante));
  st.blindsPosted = put(blinds.sb, sbAmt) + put(blinds.bb, bbAmt);
  st.currentBet = bbAmt;
  startBetting(blinds.bb);
  settle();

  hand.events.forEach((ev, idx) => {
    const s = ev.seat;
    if (!(s in st.contrib) || st.folded.has(s)) return;
    let a = ev.a;
    let target = ev.to;
    if (a === 'allin') {
      target = st.contrib[s] + remaining(s);
      a = target > st.currentBet ? 'raise' : 'call';
    }
    let added = 0;
    if (a === 'fold') st.folded.add(s);
    else if (a === 'call') added = put(s, st.currentBet - st.contrib[s]);
    else if (a === 'bet' || a === 'raise') {
      added = put(s, target - st.contrib[s]);
      const to = st.contrib[s];
      if (to > st.currentBet) {
        const inc = to - st.currentBet;
        if (inc >= st.minRaise) st.minRaise = inc;
        a = st.currentBet === 0 ? 'bet' : 'raise';
        st.currentBet = to;
        st.needToAct = new Set(canAct().filter((x) => x !== s));
      } else {
        a = st.currentBet - to > 0 ? 'call' : 'check';
      }
    } else if (a === 'check' && st.currentBet > st.contrib[s]) {
      a = 'call';
      added = put(s, st.currentBet - st.contrib[s]);
    }
    st.needToAct.delete(s);
    st.lastActor = s;
    const allin = added > 0 && st.allin.has(s);
    st.log.push({
      idx, street: st.street, kind: 'act', seat: s, a,
      to: st.contrib[s], added, allin,
      // Effective stack: the most this all-in can actually be called for.
      eff: allin ? effectiveStack(st, occ, s) : null,
      // Chips left behind after the action, when the stack was actually entered.
      behind: added > 0 && known(s) != null ? Math.max(0, remaining(s)) : null,
    });
    settle();
  });

  return finish(st, occ);
}

function finish(st, occ) {
  st.active = occ.filter((s) => !st.folded.has(s));
  st.pot = st.antes + Object.values(st.total).reduce((a, b) => a + b, 0);
  if (st.active.length <= 1) st.phase = 'done';
  else if (st.needToAct.size > 0) {
    st.phase = 'action';
    st.toAct = nextIn(st.needToAct, st.lastActor, occ);
  } else if (st.street >= 3) st.phase = 'showdown';
  else {
    st.phase = 'needboard';
    st.missingStreet = st.street + 1;
  }
  // Once the hand is over, a bet nobody matched goes back to whoever made it,
  // so the pot is what the winner actually takes.
  if (st.phase === 'done' || st.phase === 'showdown') {
    const totals = occ.map((s) => [s, st.total[s]]).sort((x, y) => y[1] - x[1]);
    const excess = totals.length > 1 ? totals[0][1] - totals[1][1] : 0;
    if (excess > 0) {
      st.uncalled = { seat: totals[0][0], amount: excess };
      st.pot -= excess;
    }
  }
  return st;
}

function effectiveStack(st, occ, s) {
  const others = occ.filter((p) => p !== s && !st.folded.has(p)).map((p) => st.stackOf(p));
  return others.length ? Math.min(st.stackOf(s), Math.max(...others)) : st.stackOf(s);
}

function nextIn(set, from, occ) {
  const ordered = [...occ].sort((a, b) => a - b);
  const after = ordered.filter((s) => s > from).concat(ordered.filter((s) => s <= from));
  return after.find((s) => set.has(s)) ?? null;
}

// Seats that will act before `target` if action folds/checks around to it.
export function seatsBefore(st, hand, target) {
  if (!st.needToAct.has(target)) return null;
  const out = [];
  let s = st.toAct;
  let guard = 0;
  while (s !== target && guard++ < 20) {
    if (st.needToAct.has(s)) out.push(s);
    s = nextOccupied(hand, s);
  }
  return out;
}

// ---------- Hand strength (for picking the winner automatically) ----------

const rankValue = (c) => 14 - RANKS.indexOf(c[0]);

function rank5(cards) {
  const v = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  let straight = 0;
  if (new Set(v).size === 5) {
    if (v[0] - v[4] === 4) straight = v[0];
    else if (v[0] === 14 && v[1] === 5) straight = 5;
  }
  const counts = {};
  v.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
  const groups = Object.entries(counts).map(([k, c]) => [c, Number(k)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const kick = groups.map((g) => g[1]);
  if (straight && flush) return [8, straight];
  if (groups[0][0] === 4) return [7, ...kick];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...kick];
  if (flush) return [5, ...v];
  if (straight) return [4, straight];
  if (groups[0][0] === 3) return [3, ...kick];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...kick];
  if (groups[0][0] === 2) return [1, ...kick];
  return [0, ...v];
}

const cmp = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
};

function best(cards) {
  let top = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const five = cards.filter((_, i) => i !== a && i !== b);
    const r = rank5(five);
    if (!top || cmp(r, top) > 0) top = r;
  }
  return top;
}

const HAND_NAMES = ['high card', 'pair', 'two pair', 'trips', 'straight', 'flush', 'full house', 'quads', 'straight flush'];

export function handName(hole, board) {
  if (!hole?.[0] || !hole?.[1] || board.length < 5) return '';
  return HAND_NAMES[best([...hole, ...board])[0]];
}

export function autoWinners(hand, st) {
  if (st.phase !== 'showdown') return [];
  // Players marked mucked are out; if only one player is left, they win.
  const mucked = new Set(hand.mucked || []);
  const live = st.active.filter((s) => !mucked.has(s));
  if (live.length === 1) return live;
  if (st.board.length < 5) return [];
  // Only known cards are recorded, so a player with no cards folded or mucked.
  const ranked = live.map((s) => {
    const h = hand.holes?.[s];
    return h?.[0] && h?.[1] ? [s, best([...h, ...st.board])] : null;
  }).filter(Boolean);
  if (!ranked.length) return [];
  let top = ranked[0][1];
  ranked.forEach(([, r]) => { if (cmp(r, top) > 0) top = r; });
  return ranked.filter(([, r]) => cmp(r, top) === 0).map(([s]) => s);
}

export function winnersOf(hand, st) {
  if (st.phase === 'done') return st.active.slice(0, 1);
  return hand.winners?.length ? hand.winners : autoWinners(hand, st);
}

export function results(hand, st = replay(hand)) {
  const winners = winnersOf(hand, st);
  const share = winners.length ? st.pot / winners.length : 0;
  const net = {};
  Object.keys(st.total).forEach((k) => {
    const s = Number(k);
    net[s] = (winners.includes(s) ? share : 0) - st.total[s] - st.anteBy[s]
      + (st.uncalled?.seat === s ? st.uncalled.amount : 0);
  });
  return { winners, share, net };
}

export function endStack(hand, seat, st = replay(hand)) {
  const start = hand.seats[seat].stack;
  if (start == null || !seated(hand.seats[seat])) return start;
  const { net } = results(hand, st);
  return Math.max(0, start + (net[seat] || 0));
}

// ---------- Formatting ----------

export function cardText(c) {
  return c ? c[0] + SUIT_SYMBOL[c[1]] : '';
}

function trim(n, d) {
  return String(Number(n.toFixed(d)));
}

export function fmt(n, full = false) {
  if (n == null || !isFinite(n)) return '—';
  if (full) return Math.round(n).toLocaleString('en-US');
  const abs = Math.abs(n);
  if (abs >= 1e6) return trim(n / 1e6, 2) + 'M';
  if (abs >= 1e3) return trim(n / 1e3, 2) + 'K';
  return trim(n, 2);
}

export function parseAmount(str) {
  const m = String(str).trim().replace(/,/g, '').match(/^(\d*\.?\d*)\s*([kKmM]?)$/);
  if (!m || m[1] === '' || m[1] === '.') return null;
  const mult = { k: 1e3, m: 1e6 }[m[2].toLowerCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

export function seatLabel(hand, st, seat) {
  const pos = st.pos[seat] || `Seat ${seat + 1}`;
  const name = hand.seats[seat].name;
  const base = seat === HERO ? `Hero (${pos})` : pos;
  return name && seat !== HERO ? `${base} [${name}]` : base;
}

const VERB = { fold: 'folds', check: 'checks', call: 'calls', bet: 'bets', raise: 'raises to' };

export function actionText(e, full) {
  if (e.allin) {
    const eff = e.eff != null && e.eff < e.to ? ` (eff. ${fmt(e.eff, full)})` : '';
    return e.a === 'call' ? `calls all-in ${fmt(e.added, full)}${eff}` : `all-in ${fmt(e.to, full)}${eff}`;
  }
  if (e.a === 'bet' || e.a === 'raise') return `${VERB[e.a]} ${fmt(e.to, full)}`;
  if (e.a === 'call') return `calls ${fmt(e.added, full)}`;
  return VERB[e.a];
}

export function blindsText(game, full) {
  let t = `${fmt(game.sb, full)}/${fmt(game.bb, full)}`;
  if (game.anteType === 'bb') t += ` (BB ante ${fmt(game.ante, full)})`;
  else if (game.anteType === 'all') t += ` (ante ${fmt(game.ante, full)})`;
  return t;
}

// Tournament name plus buy-in and GTD, skipping either when the name already says it.
export function eventParts(t, buyinLabel, gtdLabel) {
  const name = (t.name || '').toLowerCase();
  const has = (v) => name.includes(String(v).toLowerCase());
  return [
    t.name,
    t.buyin && !has(t.buyin) && buyinLabel(t.buyin),
    t.gtd && !has(t.gtd) && gtdLabel(t.gtd),
  ].filter(Boolean);
}

const holeText = (h) => (h?.[0] && h?.[1] ? h.map(cardText).join(' ') : '');

export function handToText(hand, full = false) {
  const st = replay(hand);
  const L = (s) => seatLabel(hand, st, s);
  const when = new Date(hand.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const lines = [`Hand #${hand.num} · ${when}`];
  const t = hand.tourney || {};
  const event = eventParts(t, (b) => `Buy-in ${b}`, (g) => `GTD ${g}`);
  if (event.length) lines.push(event.join(' · '));
  const field = [
    t.left && t.entries ? `${t.left} left of ${t.entries}` : t.left ? `${t.left} left` : t.entries && `${t.entries} entries`,
    t.bullets && `bullet #${t.bullets}`,
  ].filter(Boolean);
  if (field.length) lines.push(`Field: ${field.join(' · ')}`);
  lines.push(`Blinds ${blindsText(hand.game, full)}`);
  const heroHole = holeText(hand.holes?.[HERO]);
  if (heroHole) lines.push(`Hero (${st.pos[HERO] || '?'}): ${heroHole}`);

  const stacks = occupiedSeats(hand)
    .filter((s) => hand.seats[s].stack != null)
    .map((s) => `${L(s)} ${fmt(hand.seats[s].stack, full)}`);
  if (stacks.length) lines.push(`Stacks: ${stacks.join(' · ')}`);

  // Group actions by street, collapsing runs of folds.
  let parts = [];
  let folds = [];
  let header = 'Preflop:';
  const flushFolds = () => {
    if (folds.length) parts.push(`${folds.join(', ')} fold${folds.length > 1 ? '' : 's'}`);
    folds = [];
  };
  const flushStreet = () => {
    flushFolds();
    lines.push('');
    lines.push(header);
    if (parts.length) lines.push('  ' + parts.join(', '));
    parts = [];
  };
  let pot = (st.blindsPosted || 0) + st.antes;
  for (const e of st.log) {
    if (e.kind === 'board') {
      flushStreet();
      header = `${STREETS[e.street]} ${e.cards.map(cardText).join(' ')} (pot ${fmt(pot, full)})`;
      continue;
    }
    pot += e.added;
    if (e.a === 'fold') folds.push(L(e.seat));
    else {
      flushFolds();
      parts.push(`${L(e.seat)} ${actionText(e, full)}`);
    }
  }
  flushStreet();

  const { winners, share } = results(hand, st);
  if (st.phase === 'showdown') {
    lines.push('');
    lines.push('Showdown:');
    for (const s of st.active) {
      const h = holeText(hand.holes?.[s]);
      const name = handName(hand.holes?.[s], st.board);
      const mucked = (hand.mucked || []).includes(s);
      lines.push(`  ${L(s)} ${h && !mucked ? `shows ${h}${name ? ` (${name})` : ''}` : 'mucks'}`);
    }
  }
  // Cards known for players who folded (e.g. shown after the hand).
  const known = occupiedSeats(hand)
    .filter((s) => s !== HERO && st.folded.has(s) && holeText(hand.holes?.[s]))
    .map((s) => `${L(s)} had ${holeText(hand.holes[s])}`);
  if (known.length) lines.push(`(${known.join(' · ')})`);

  if (winners.length) {
    lines.push('');
    lines.push(winners.length > 1
      ? `Split pot ${fmt(st.pot, full)}: ${winners.map(L).join(', ')} (${fmt(share, full)} each)`
      : `${L(winners[0])} wins ${fmt(st.pot, full)}`);
  }
  if (hand.notes?.trim()) {
    lines.push('');
    lines.push(`Notes: ${hand.notes.trim()}`);
  }
  if (hand.commentary?.trim()) {
    lines.push('');
    lines.push(`Commentary: ${hand.commentary.trim()}`);
  }
  return lines.join('\n');
}
