// Competition state: Premier League (league season), Champions League & World Cup (groups + knockouts).
import { PREMIER_LEAGUE, CHAMPIONS_LEAGUE, NATIONS, teamById, teamRating, defaultLineup } from './teams.js';

export const COMPETITIONS = {
  league: { name: 'Premier League', icon: '🦁', kind: 'league', pool: () => PREMIER_LEAGUE },
  ucl: { name: 'Champions League', icon: '⭐', kind: 'cup', pool: () => CHAMPIONS_LEAGUE },
  wc: { name: 'World Cup', icon: '🌍', kind: 'cup', pool: () => NATIONS },
};

const KO_NAMES = { QF: 'Quarter-final', SF: 'Semi-final', F: 'Final' };

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

function poisson(l) { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= Math.random(); } while (p > L); return k - 1; }

const ratingCache = new Map();
const rating = (id) => { if (!ratingCache.has(id)) ratingCache.set(id, teamRating(teamById(id))); return ratingCache.get(id); };

/** Quick result for matches the user doesn't play. */
export function simScore(a, b) {
  const d = (rating(a) - rating(b)) / 8;
  const la = Math.min(3.6, Math.max(0.35, 1.35 * Math.exp(d * 0.5)));
  const lb = Math.min(3.6, Math.max(0.35, 1.35 * Math.exp(-d * 0.5)));
  return [poisson(la), poisson(lb)];
}

function penWinner(a, b) { return Math.random() < 0.5 + (rating(a) - rating(b)) * 0.01 ? a : b; }

/** Circle-method round robin: returns rounds of [home, away] pairs. */
function roundRobin(ids) {
  const t = [...ids], n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}

const newRow = (id) => ({ id, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 });

function addResult(table, h, a, hg, ag) {
  const rh = table.find((r) => r.id === h), ra = table.find((r) => r.id === a);
  if (!rh || !ra) return;
  rh.P++; ra.P++; rh.GF += hg; rh.GA += ag; ra.GF += ag; ra.GA += hg;
  if (hg > ag) { rh.W++; ra.L++; rh.Pts += 3; } else if (hg < ag) { ra.W++; rh.L++; ra.Pts += 3; } else { rh.D++; ra.D++; rh.Pts++; ra.Pts++; }
}

export function sortTable(table) {
  return [...table].sort((x, y) => y.Pts - x.Pts || (y.GF - y.GA) - (x.GF - x.GA) || y.GF - x.GF || rating(y.id) - rating(x.id));
}

export function newCompetition(key, userId, difficulty) {
  const def = COMPETITIONS[key];
  const ids = def.pool().map((t) => t.id);
  const c = {
    key, name: def.name, kind: def.kind, user: userId, difficulty,
    lineup: defaultLineup(teamById(userId), '4-3-3'),
    results: [], scorers: {}, done: false, champion: null, out: false,
  };
  if (def.kind === 'league') {
    c.rounds = roundRobin(shuffle(ids));
    c.round = 0;
    c.table = ids.map(newRow);
  } else {
    const others = shuffle(ids.filter((i) => i !== userId));
    const all = [userId, ...others];
    c.groups = [0, 1, 2, 3].map((g) => ({ name: 'ABCD'[g], ids: all.slice(g * 4, g * 4 + 4), table: all.slice(g * 4, g * 4 + 4).map(newRow) }));
    c.groups.forEach((g) => { g.rounds = roundRobin(g.ids); });
    c.stage = 'groups'; c.round = 0;
  }
  return c;
}

/** The user's next match: { opp, home, label } or null when the competition is over for them. */
export function nextFixture(c) {
  if (c.done || c.out) return null;
  if (c.kind === 'league') {
    const pair = c.rounds[c.round].find((p) => p.includes(c.user));
    return { opp: pair[0] === c.user ? pair[1] : pair[0], home: pair[0] === c.user, label: `Matchday ${c.round + 1} of ${c.rounds.length}` };
  }
  if (c.stage === 'groups') {
    const g = c.groups.find((gr) => gr.ids.includes(c.user));
    const pair = g.rounds[c.round].find((p) => p.includes(c.user));
    return { opp: pair[0] === c.user ? pair[1] : pair[0], home: pair[0] === c.user, label: `Group ${g.name} · Match ${c.round + 1} of 3`, knockout: false };
  }
  const tie = c.ko.ties.find((t) => t.includes(c.user));
  return { opp: tie[0] === c.user ? tie[1] : tie[0], home: tie[0] === c.user, label: KO_NAMES[c.ko.stage], knockout: true };
}

/**
 * Record the user's result (from the user's point of view), simulate the rest of the round and advance.
 * For knockout draws pass `pens` = 'user' | 'opp' (and optionally penScore like "4-3").
 */
export function recordResult(c, ug, og, scorers = [], pens = null, penScore = '') {
  const fx = nextFixture(c);
  const h = fx.home ? c.user : fx.opp, a = fx.home ? fx.opp : c.user;
  const hg = fx.home ? ug : og, ag = fx.home ? og : ug;
  for (const s of scorers) c.scorers[s] = (c.scorers[s] || 0) + 1;
  c.results.push({ label: fx.label, h, a, hg, ag, pens: pens ? (pens === 'user' ? c.user : fx.opp) : null, penScore });

  if (c.kind === 'league') {
    for (const [ph, pa] of c.rounds[c.round]) {
      if (ph === h && pa === a) addResult(c.table, h, a, hg, ag);
      else { const [x, y] = simScore(ph, pa); addResult(c.table, ph, pa, x, y); }
    }
    c.round++;
    if (c.round >= c.rounds.length) { c.done = true; c.champion = sortTable(c.table)[0].id; }
    return;
  }

  if (c.stage === 'groups') {
    for (const g of c.groups) {
      for (const [ph, pa] of g.rounds[c.round]) {
        if (ph === h && pa === a) addResult(g.table, h, a, hg, ag);
        else { const [x, y] = simScore(ph, pa); addResult(g.table, ph, pa, x, y); }
      }
    }
    c.round++;
    if (c.round >= 3) {
      const q = c.groups.map((g) => sortTable(g.table).map((r) => r.id));
      c.stage = 'ko';
      c.ko = { stage: 'QF', ties: [[q[0][0], q[1][1]], [q[1][0], q[0][1]], [q[2][0], q[3][1]], [q[3][0], q[2][1]]], history: [] };
      if (!c.ko.ties.some((t) => t.includes(c.user))) { c.out = true; c.outAt = 'the group stage'; finishWithoutUser(c); }
    }
    return;
  }

  // knockout round
  const winners = [], played = [];
  for (const [th, ta] of c.ko.ties) {
    let x, y, w, ps = '';
    if (th === h && ta === a) {
      x = hg; y = ag;
      w = x > y ? th : x < y ? ta : (pens === 'user' ? c.user : fx.opp);
      ps = penScore;
    } else {
      [x, y] = simScore(th, ta);
      w = x > y ? th : x < y ? ta : penWinner(th, ta);
      if (x === y) ps = 'pens';
    }
    winners.push(w); played.push({ h: th, a: ta, hg: x, ag: y, w, ps });
  }
  c.ko.history.push({ stage: c.ko.stage, ties: played });
  if (!winners.includes(c.user)) { c.out = true; c.outAt = `the ${KO_NAMES[c.ko.stage].toLowerCase()}`; }
  advanceKO(c, winners);
  if (c.out && !c.done) finishWithoutUser(c);
}

function advanceKO(c, winners) {
  if (c.ko.stage === 'F') { c.done = true; c.champion = winners[0]; return; }
  c.ko.stage = c.ko.stage === 'QF' ? 'SF' : 'F';
  c.ko.ties = [];
  for (let i = 0; i < winners.length; i += 2) c.ko.ties.push([winners[i], winners[i + 1]]);
}

/** User knocked out: play out the remaining rounds so there's a champion. */
function finishWithoutUser(c) {
  while (!c.done) {
    const winners = [], played = [];
    for (const [th, ta] of c.ko.ties) {
      const [x, y] = simScore(th, ta);
      const w = x > y ? th : x < y ? ta : penWinner(th, ta);
      winners.push(w); played.push({ h: th, a: ta, hg: x, ag: y, w, ps: x === y ? 'pens' : '' });
    }
    c.ko.history.push({ stage: c.ko.stage, ties: played });
    advanceKO(c, winners);
  }
}

/** Simulate the user's own match instantly. */
export function simulateUserMatch(c) {
  const fx = nextFixture(c);
  const [ug, og] = simScore(c.user, fx.opp);
  let pens = null, ps = '';
  if (fx.knockout && ug === og) { pens = penWinner(c.user, fx.opp) === c.user ? 'user' : 'opp'; ps = pens === 'user' ? '5-4' : '4-5'; }
  const squad = teamById(c.user).squad;
  const att = c.lineup.xi.map((i) => squad[i]).filter((p) => p.pos !== 'GK');
  const scorers = [];
  for (let i = 0; i < ug; i++) {
    const weights = att.map((p) => (p.pos === 'FW' ? 4 : p.pos === 'MF' ? 2 : 0.5) * p.r);
    let r = Math.random() * weights.reduce((x, y) => x + y, 0);
    let k = 0; while (r > weights[k]) { r -= weights[k]; k++; }
    scorers.push(att[Math.min(k, att.length - 1)].name);
  }
  recordResult(c, ug, og, scorers, pens, ps);
  return { ug, og, pens, ps, scorers, opp: fx.opp };
}
