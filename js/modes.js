import { KEEPER_SKILL, HALF_W, GOAL_H, rand, clamp } from './world.js';
import { sfx } from './audio.js';

export const TEAMS = [
  { id: 'ISL', name: 'Iceland',     shirt: '#1d4fd8', shorts: '#ffffff', socks: '#1d4fd8', flag: ['#02529C', '#ffffff', '#DC1E35'], rating: 3 },
  { id: 'BRA', name: 'Brazil',      shirt: '#ffdc02', shorts: '#1b47c4', socks: '#ffffff', flag: ['#009c3b', '#ffdf00', '#002776'], rating: 5 },
  { id: 'ARG', name: 'Argentina',   shirt: '#7ac4f0', shorts: '#111111', socks: '#ffffff', flag: ['#74acdf', '#ffffff', '#74acdf'], rating: 5 },
  { id: 'FRA', name: 'France',      shirt: '#1b2c6b', shorts: '#ffffff', socks: '#d62d3a', flag: ['#0055A4', '#ffffff', '#EF4135'], rating: 5 },
  { id: 'GER', name: 'Germany',     shirt: '#ffffff', shorts: '#111111', socks: '#ffffff', flag: ['#000000', '#DD0000', '#FFCE00'], rating: 4 },
  { id: 'ESP', name: 'Spain',       shirt: '#c8102e', shorts: '#13235b', socks: '#c8102e', flag: ['#AA151B', '#F1BF00', '#AA151B'], rating: 4 },
  { id: 'ENG', name: 'England',     shirt: '#f4f4f4', shorts: '#1b2c6b', socks: '#f4f4f4', flag: ['#ffffff', '#CE1124', '#ffffff'], rating: 4 },
  { id: 'POR', name: 'Portugal',    shirt: '#a8102a', shorts: '#0d5c2e', socks: '#a8102a', flag: ['#006600', '#FF0000', '#FF0000'], rating: 4 },
  { id: 'NED', name: 'Netherlands', shirt: '#ff6b00', shorts: '#ff6b00', socks: '#ff6b00', flag: ['#AE1C28', '#ffffff', '#21468B'], rating: 4 },
  { id: 'JPN', name: 'Japan',       shirt: '#0b2a7a', shorts: '#ffffff', socks: '#0b2a7a', flag: ['#ffffff', '#BC002D', '#ffffff'], rating: 3 },
  { id: 'NGA', name: 'Nigeria',     shirt: '#0f8a4a', shorts: '#ffffff', socks: '#0f8a4a', flag: ['#008751', '#ffffff', '#008751'], rating: 3 },
  { id: 'MAR', name: 'Morocco',     shirt: '#c1272d', shorts: '#0b7a3a', socks: '#c1272d', flag: ['#C1272D', '#C1272D', '#C1272D'], rating: 3 },
];

const KEEPER_KITS = [
  { shirt: '#f5e13b', trim: '#111', shorts: '#111' },
  { shirt: '#39d353', trim: '#111', shorts: '#111' },
  { shirt: '#ff7a1a', trim: '#111', shorts: '#222' },
  { shirt: '#c44dff', trim: '#fff', shorts: '#222' },
];

const kitOf = (t) => ({ shirt: t.shirt, shorts: t.shorts, socks: t.socks });

function randomSpot(kind) {
  switch (kind) {
    case 'penalty': return { x: 0, z: 11 };
    case 'edge': return { x: rand(-9, 9), z: rand(16.5, 20) };
    case 'freekick': {
      const z = rand(19, 27), side = Math.random() < 0.5 ? -1 : 1;
      return { x: side * rand(1, Math.min(14, z * 0.5)), z, wall: z < 24 ? 4 : 5 };
    }
    default: return randomSpot(['penalty', 'edge', 'freekick'][(Math.random() * 3) | 0]);
  }
}

// ---------------------------------------------------------------------------
export class PracticeMode {
  constructor(ui, opts) { this.ui = ui; this.opts = opts; this.name = 'Practice'; }
  start(game) {
    this.g = game;
    this.shots = 0; this.goals = 0; this.streak = 0; this.best = 0;
    this.spot = randomSpot(this.opts.pos);
    this.ui.hud({ left: 'PRACTICE', center: '', right: '' });
    this.ui.showSpotButton(this.opts.pos !== 'penalty', () => { this.spot = randomSpot(this.opts.pos); this.setup(); });
    this.setup();
    this.ui.hint(this.opts.pos === 'freekick' ? 'Curve your swipe to bend it round the wall' : 'Swipe from the ball towards the goal');
  }
  setup() {
    const s = this.spot;
    const keeper = this.opts.keeper === 'off' ? null : KEEPER_SKILL[this.opts.keeper];
    this.g.setupShot({
      x: s.x, z: s.z, keeper, keeperColors: KEEPER_KITS[0],
      wall: s.wall || 0, wallColors: kitOf(TEAMS[5]),
    });
    this.updateHud();
  }
  updateHud() {
    const pct = this.shots ? Math.round(100 * this.goals / this.shots) : 0;
    this.ui.hud({ left: 'PRACTICE', center: `${this.goals} / ${this.shots}`, right: this.shots ? `${pct}% · streak ${this.streak}` : 'Swipe to shoot' });
  }
  onHint(t) { this.ui.hint(t); }
  onKick() { this.ui.hint(''); }
  onResult(r) {
    this.shots++;
    if (r.goal) { this.goals++; this.streak++; } else this.streak = 0;
    this.ui.banner(r.label, r.goal && this.streak > 1 ? `${this.streak} in a row!` : '', r.goal ? 'good' : 'bad');
    this.updateHud();
    if (this.opts.pos === 'random') this.spot = randomSpot('random');
    this.g.after(1.1, () => this.setup());
  }
}

// ---------------------------------------------------------------------------
export class TargetMode {
  constructor(ui, onEnd) { this.ui = ui; this.onEnd = onEnd; this.name = 'Target Challenge'; this.key = 'target'; }
  start(game) {
    this.g = game;
    this.score = 0; this.timeLeft = 60; this.combo = 0; this.over = false; this.shots = 0; this.hits = 0;
    this.targets = [];
    this.spawnTargets();
    this.setup();
    this.ui.hint('Hit the targets! Small & corner targets score more.');
  }
  spawnTargets() {
    while (this.targets.length < 2) {
      const small = Math.random() < 0.45;
      const r = small ? 0.42 : 0.62;
      const corner = Math.random() < 0.5;
      const x = corner ? (Math.random() < 0.5 ? -1 : 1) * rand(HALF_W - r - 0.5, HALF_W - r - 0.05) : rand(-HALF_W + r + 0.1, HALF_W - r - 0.1);
      const y = corner ? rand(GOAL_H - r - 0.6, GOAL_H - r - 0.05) : rand(r + 0.05, GOAL_H - r - 0.05);
      if (this.targets.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + 0.3)) continue;
      const pts = (small ? 100 : 50) + (corner ? 50 : 0);
      this.targets.push({ x, y, r, pts, hit: false, fade: 1 });
    }
  }
  setup() {
    const spot = this.shots === 0 ? { x: 0, z: 13 } : { x: rand(-7, 7), z: rand(12, 21) };
    this.g.setupShot({ x: spot.x, z: spot.z, keeper: null, targets: this.targets });
    this.updateHud();
  }
  updateHud() {
    this.ui.hud({ left: `⏱ ${Math.ceil(this.timeLeft)}s`, center: `${this.score}`, right: this.combo > 1 ? `combo x${this.combo}` : 'TARGETS' });
  }
  tick(dt) {
    if (this.over) return;
    const prev = Math.ceil(this.timeLeft);
    if (this.g.phase === 'aim' || this.g.phase === 'flight') this.timeLeft = Math.max(0, this.timeLeft - dt);
    const now = Math.ceil(this.timeLeft);
    if (now !== prev) { this.updateHud(); if (now <= 5 && now > 0) sfx('tick'); }
    if (this.timeLeft <= 0 && this.g.phase === 'aim') this.finish();
  }
  onHint(t) { this.ui.hint(t); }
  onKick() { this.ui.hint(''); }
  onResult(r) {
    this.shots++;
    let gained = 0;
    if (r.target) {
      this.combo++; this.hits++;
      gained = r.target.pts * Math.min(this.combo, 4);
      sfx('ding');
      this.ui.banner(`+${gained}`, this.combo > 1 ? `Combo x${Math.min(this.combo, 4)}` : 'Bullseye!', 'good');
      this.targets.splice(this.targets.indexOf(r.target), 1);
      this.timeLeft += 2;
    } else if (r.goal) {
      gained = 10; this.combo = 0;
      this.ui.banner('+10', 'Goal — but missed the target', 'meh');
    } else { this.combo = 0; this.ui.banner(r.label, '', 'bad'); }
    this.score += gained;
    this.spawnTargets();
    this.updateHud();
    if (this.timeLeft <= 0) { this.g.after(1.0, () => this.finish()); return; }
    this.g.after(0.9, () => this.setup());
  }
  finish() {
    if (this.over) return;
    this.over = true;
    this.g.phase = 'idle';
    this.onEnd({ key: this.key, title: "Time's up!", score: this.score, detail: `${this.hits} targets hit from ${this.shots} shots` });
  }
}

// ---------------------------------------------------------------------------
/** Fixed number of balls, scored per shot. Used for Crossbar & Free-Kick challenges. */
export class RoundsMode {
  constructor(ui, onEnd, kind) {
    this.ui = ui; this.onEnd = onEnd; this.kind = kind; this.key = kind;
    this.name = kind === 'crossbar' ? 'Crossbar Challenge' : 'Free Kick Challenge';
  }
  start(game) {
    this.g = game; this.n = 0; this.total = 10; this.score = 0; this.log = [];
    this.ui.hint(this.kind === 'crossbar' ? 'Hit the crossbar (3 pts) or a post (1 pt)' : 'Beat the wall and the keeper — top corners score double!');
    this.setup();
  }
  setup() {
    if (this.kind === 'crossbar') {
      const z = 16 + this.n * 0.8;
      this.g.setupShot({ x: rand(-3, 3), z, keeper: null });
    } else {
      const s = randomSpot('freekick');
      this.g.setupShot({ x: s.x, z: s.z, keeper: KEEPER_SKILL.medium, keeperColors: KEEPER_KITS[1], wall: s.wall, wallColors: kitOf(TEAMS[3]) });
    }
    this.updateHud();
  }
  updateHud() {
    this.ui.hud({ left: `Ball ${Math.min(this.n + 1, this.total)}/${this.total}`, center: `${this.score}`, right: this.kind === 'crossbar' ? 'CROSSBAR' : 'FREE KICKS' });
  }
  onHint(t) { this.ui.hint(t); }
  onKick() { this.ui.hint(''); }
  onResult(r) {
    let pts = 0, msg = r.label, sub = '';
    if (this.kind === 'crossbar') {
      if (r.woodwork === 'bar') { pts = 3; msg = 'CROSSBAR!'; sub = '+3'; sfx('ding'); }
      else if (r.woodwork === 'post') { pts = 1; msg = 'POST!'; sub = '+1'; }
      else if (r.goal) { msg = 'In the net…'; sub = 'Aim for the bar!'; }
    } else if (r.goal) {
      const top = Math.abs(r.x) > HALF_W - 1.0 && r.y > GOAL_H - 0.9;
      pts = top ? 2 : 1; sub = top ? 'TOP BINS! +2' : '+1';
    }
    this.score += pts;
    this.n++;
    this.ui.banner(msg, sub, pts > 0 ? 'good' : 'bad');
    this.updateHud();
    if (this.n >= this.total) {
      this.g.after(1.3, () => this.onEnd({ key: this.key, title: 'Challenge complete', score: this.score, detail: `${this.total} balls` }));
    } else this.g.after(1.1, () => this.setup());
  }
}

// ---------------------------------------------------------------------------
export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];

export class Cup {
  constructor(userTeam, difficulty) {
    this.user = userTeam;
    this.difficulty = difficulty; // 'easy' | 'medium' | 'hard'
    const others = TEAMS.filter((t) => t.id !== userTeam.id).sort(() => Math.random() - 0.5).slice(0, 7);
    const teams = [userTeam, ...others];
    // user always in first slot of bracket; randomise rest
    this.rounds = [teams.map((t) => t.id)];
    this.round = 0;
    this.alive = true;
    this.won = false;
    this.results = []; // per round: array of {a,b,sa,sb,winner}
  }
  team(id) { return TEAMS.find((t) => t.id === id); }
  currentOpponent() { const r = this.rounds[this.round]; return this.team(r[1]); }
  simulate(a, b) {
    // penalty shoot-out sim between two CPU teams
    const ta = this.team(a), tb = this.team(b);
    let sa = 0, sb = 0, i = 0;
    const pa = 0.62 + ta.rating * 0.04, pb = 0.62 + tb.rating * 0.04;
    while (i < 5 || sa === sb) { if (Math.random() < pa) sa++; if (Math.random() < pb) sb++; i++; if (i > 20) break; }
    return { a, b, sa, sb, winner: sa > sb ? a : b };
  }
  recordUserMatch(su, so) {
    const r = this.rounds[this.round];
    const matches = [{ a: r[0], b: r[1], sa: su, sb: so, winner: su > so ? r[0] : r[1] }];
    for (let i = 2; i < r.length; i += 2) matches.push(this.simulate(r[i], r[i + 1]));
    this.results[this.round] = matches;
    if (su < so) { this.alive = false; return; }
    if (this.round === 2) { this.won = true; return; }
    this.rounds.push(matches.map((m) => m.winner));
    this.round++;
  }
  opponentSkill() {
    const base = { easy: 0.25, medium: 0.5, hard: 0.75 }[this.difficulty];
    return clamp(base + this.round * 0.12 + (this.currentOpponent().rating - 3) * 0.05, 0, 1);
  }
  keeperSkill() {
    const order = ['easy', 'medium', 'hard', 'legend'];
    const base = { easy: 0, medium: 1, hard: 2 }[this.difficulty];
    return KEEPER_SKILL[order[Math.min(3, base + (this.round === 2 ? 1 : 0))]];
  }
}

/** A penalty shoot-out match: user shoots, then user keeps, alternating. */
export class ShootoutMode {
  constructor(ui, cup, onEnd) {
    this.ui = ui; this.cup = cup; this.onEnd = onEnd; this.name = 'Penalty Cup';
  }
  start(game) {
    this.g = game;
    this.user = this.cup.user; this.opp = this.cup.currentOpponent();
    this.kicks = { u: [], o: [] };
    this.turn = 'u';
    this.done = false;
    this.ui.shootout(this.user, this.opp, this.kicks);
    this.ui.hud({ left: '', center: '', right: '' });
    sfx('whistle');
    this.next();
  }
  next() {
    const n = Math.max(this.kicks.u.length, this.kicks.o.length) + (this.turn === 'u' ? 1 : 0);
    if (this.turn === 'u') {
      this.ui.hint(`Kick ${this.kicks.u.length + 1}: swipe to shoot`);
      this.g.setupShot({ x: 0, z: 11, keeper: this.cup.keeperSkill(), keeperColors: KEEPER_KITS[(this.cup.round + 1) % 4] });
    } else {
      this.ui.hint('Your turn in goal — tap where to dive!');
      this.g.setupShot({
        x: 0, z: 11, control: 'keep', keeper: KEEPER_SKILL.player, keeperColors: KEEPER_KITS[0],
        cpu: { skill: this.cup.opponentSkill(), colors: kitOf(this.opp), number: String(n + 6) },
      });
    }
    this.ui.shootout(this.user, this.opp, this.kicks, this.turn);
  }
  onHint(t) { this.ui.hint(t); }
  onKick() { if (this.turn === 'u') this.ui.hint(''); }
  decided() {
    const u = this.kicks.u, o = this.kicks.o;
    const su = u.filter(Boolean).length, so = o.filter(Boolean).length;
    if (u.length <= 5 && o.length <= 5 && !(u.length === 5 && o.length === 5)) {
      const ru = 5 - u.length, ro = 5 - o.length;
      if (su + ru < so) return true;
      if (so + ro < su) return true;
      return false;
    }
    return u.length === o.length && su !== so;
  }
  onResult(r) {
    const scored = r.goal;
    this.kicks[this.turn].push(scored);
    const good = this.turn === 'u' ? scored : !scored;
    this.ui.banner(r.label, '', good ? 'good' : 'bad');
    this.turn = this.turn === 'u' ? 'o' : 'u';
    this.ui.shootout(this.user, this.opp, this.kicks, this.turn);
    if (this.decided()) {
      const su = this.kicks.u.filter(Boolean).length, so = this.kicks.o.filter(Boolean).length;
      this.done = true;
      this.g.after(1.6, () => this.onEnd(su, so));
    } else {
      if (this.kicks.u.length === 5 && this.kicks.o.length === 5 && this.turn === 'u') this.g.after(0.9, () => this.ui.banner('SUDDEN DEATH', 'Next miss could be fatal', 'meh'));
      this.g.after(1.4, () => this.next());
    }
  }
}
