// 11-a-side match simulation. World units are metres, top-down.
// Pitch: x across (-HW..HW), y along (-HL..HL). Team 0 (the user) attacks towards -y (up the screen).
import { FORMATIONS } from './teams.js';

export const HW = 34, HL = 52.5, GW = 3.66, GH = 2.44;
const G = 9.81, ROLL = 3.0, DT = 1 / 60;

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const DIFFICULTY = {
  easy:   { cpuTackle: 0.45, cpuShotErr: 1.6, cpuSpeed: 0.9,  cpuPassErr: 1.5, cpuThink: 0.6,  gk: 0.75 },
  medium: { cpuTackle: 0.8,  cpuShotErr: 1.15, cpuSpeed: 0.96, cpuPassErr: 1.1, cpuThink: 0.42, gk: 1.0 },
  hard:   { cpuTackle: 1.15, cpuShotErr: 0.85, cpuSpeed: 1.0,  cpuPassErr: 0.85, cpuThink: 0.28, gk: 1.15 },
};

class Player {
  constructor(team, info, slot, idx) {
    this.team = team; this.idx = idx;
    this.name = info.name; this.num = info.num; this.r = info.r;
    this.slot = { fx: slot[0], p: slot[1], role: slot[2] };
    this.isGK = slot[2] === 'GK';
    this.speed = clamp(5.8 + (info.r - 60) / 35 * 2.0, 5.6, 8.0);
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.face = team.dir < 0 ? -Math.PI / 2 : Math.PI / 2;
    this.tx = 0; this.ty = 0; this.want = 0;
    this.kickCD = 0; this.stun = 0; this.slide = 0; this.dive = 0;
    this.recv = null; this.run = null; this.runT = rnd(0, 3);
    this.anim = Math.random() * 6;
    this.thinkT = 0;
  }
}

export class Match {
  /**
   * opts: { home, away (team data), homeXI, awayXI (squad index arrays), homeFormation, awayFormation,
   *         kits: [homeKit, awayKit], difficulty, halfSeconds, onEvent(type, data) }
   */
  constructor(opts) {
    this.opts = opts;
    this.diff = DIFFICULTY[opts.difficulty || 'medium'];
    this.onEvent = opts.onEvent || (() => {});
    this.timeScale = 45 * 60 / (opts.halfSeconds || 120);
    this.teams = [
      this.makeTeam(opts.home, opts.homeXI, opts.homeFormation, opts.kits[0], -1, true),
      this.makeTeam(opts.away, opts.awayXI, opts.awayFormation, opts.kits[1], 1, false),
    ];
    this.teams[0].opp = this.teams[1]; this.teams[1].opp = this.teams[0];
    this.all = [...this.teams[0].players, ...this.teams[1].players];
    this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, shot: null };
    this.clock = 0; this.half = 1;
    this.time = 0; this.acc = 0;
    this.events = [];
    this.ctrl = null; this.ctrlLock = 0;
    this.input = { steer: null };
    this.poss = this.teams[0];
    this.kickoff(this.teams[0]);
  }

  makeTeam(data, xi, formation, kit, dir, user) {
    const T = { data, kit, dir, user, score: 0, name: data.name, short: data.short, players: [], formation };
    const slots = FORMATIONS[formation];
    xi.forEach((si, i) => T.players.push(new Player(T, data.squad[si], slots[i], i)));
    T.gk = T.players[0];
    T.gkKit = user ? ['#2ee59d', null, '#111111', '#2ee59d'] : ['#f5e13b', null, '#111111', '#f5e13b'];
    return T;
  }

  // ---------------------------------------------------------------- geometry helpers
  ownY(T) { return -T.dir * HL; }
  oppY(T) { return T.dir * HL; }
  prog(T, y) { return (this.ownY(T) - y) / (this.ownY(T) - this.oppY(T)); }
  pToY(T, p) { const o = this.ownY(T); return o + (this.oppY(T) - o) * p; }
  latToX(T, lat) { return -T.dir * lat; }
  minute() { return Math.min(this.half === 1 ? 45 : 90, Math.floor(this.clock / 60) + 1); }

  // ---------------------------------------------------------------- set pieces
  kickoff(T) {
    const b = this.ball;
    Object.assign(b, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, shot: null });
    this.goalBy = null;
    for (const tm of this.teams) {
      for (const pl of tm.players) {
        const s = pl.slot;
        const p = pl.isGK ? 0.03 : Math.min(s.p * 0.55 + 0.05, tm === T ? 0.47 : 0.4);
        pl.x = this.latToX(tm, s.fx * 26); pl.y = this.pToY(tm, p);
        pl.vx = pl.vy = 0; pl.recv = null; pl.run = null; pl.stun = 0; pl.slide = 0; pl.dive = 0; pl.kickCD = 0;
        pl.face = tm.dir < 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    // centre forward takes the kick-off, a team-mate alongside
    const fws = T.players.filter((p) => !p.isGK).sort((a, c) => c.slot.p - a.slot.p);
    const k = fws[0], mate = fws[1];
    k.x = 0; k.y = -T.dir * 0.9; k.face = T.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    mate.x = 2.5; mate.y = -T.dir * 0.5;
    this.take(k);
    k.kickCD = 0;
    this.state = 'kickoff'; this.stateT = 0;
    this.poss = T;
  }

  setRestart(type, T, x, y) {
    const b = this.ball;
    Object.assign(b, { x, y, z: 0, vx: 0, vy: 0, vz: 0, owner: null, shot: null });
    this.state = 'dead'; this.stateT = 0;
    this.restart = { type, team: T, x, y };
    this.poss = T;
    for (const pl of this.all) { pl.recv = null; pl.run = null; }
    this.onEvent(type, { team: T });
  }

  takeRestart() {
    const r = this.restart, T = r.team;
    let taker;
    if (r.type === 'goalkick') taker = T.gk;
    else {
      taker = null; let bd = 1e9;
      for (const pl of T.players) if (!pl.isGK) { const d = Math.hypot(pl.x - r.x, pl.y - r.y); if (d < bd) { bd = d; taker = pl; } }
    }
    // stand behind the ball, facing into the pitch
    const ax = -Math.sign(r.x || 1) * (r.type === 'throwin' ? 1 : 0.3);
    const ay = r.type === 'goalkick' ? T.dir : (r.type === 'corner' ? -Math.sign(r.y) : 0);
    const L = Math.hypot(ax, ay) || 1;
    taker.x = r.x - ax / L * 0.7; taker.y = r.y - ay / L * 0.7;
    taker.face = Math.atan2(ay, ax);
    taker.vx = taker.vy = 0;
    // opponents back off
    for (const pl of T.opp.players) {
      const d = Math.hypot(pl.x - r.x, pl.y - r.y);
      if (d < 6) { const k = 6 / (d || 1); pl.x = r.x + (pl.x - r.x) * k; pl.y = r.y + (pl.y - r.y) * k; }
    }
    this.take(taker);
    taker.hold = true; taker.holdT = 0;
    this.state = 'play';
  }

  take(pl) {
    const b = this.ball;
    b.owner = pl; b.last = pl; b.shot = null; b.z = 0; b.vz = 0;
    this.poss = pl.team;
    for (const p of pl.team.players) p.recv = null;
    pl.hold = false;
  }

  // ---------------------------------------------------------------- kicking
  release(pl) {
    const b = this.ball;
    b.owner = null; b.last = pl; pl.kickCD = 0.3; pl.hold = false;
    b.x = pl.x + Math.cos(pl.face) * 0.6; b.y = pl.y + Math.sin(pl.face) * 0.6;
  }

  laneBlocked(from, tx, ty, team, width = 1.6) {
    const dx = tx - from.x, dy = ty - from.y, L2 = dx * dx + dy * dy || 1;
    for (const o of team.opp.players) {
      const t = clamp(((o.x - from.x) * dx + (o.y - from.y) * dy) / L2, 0, 1);
      if (t < 0.05) continue;
      if (Math.hypot(from.x + dx * t - o.x, from.y + dy * t - o.y) < width) return true;
    }
    return false;
  }

  pass(pl, tx, ty, receiver, forceLoft = false) {
    const T = pl.team, b = this.ball;
    let dx = tx - pl.x, dy = ty - pl.y;
    const d = Math.hypot(dx, dy) || 1;
    const loft = forceLoft || d > 32 || (d > 14 && this.laneBlocked(pl, tx, ty, T, 1.4));
    const errScale = (1.08 - pl.r / 100) * 0.16 * (T.user ? 0.8 : this.diff.cpuPassErr);
    const ang = Math.atan2(dy, dx) + gauss() * errScale;
    pl.face = Math.atan2(dy, dx);
    this.release(pl);
    if (!loft) {
      const v = Math.sqrt(5.5 * 5.5 + 2 * ROLL * d);
      b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.vz = 0;
    } else {
      const ft = 0.8 + d / 26;
      const vh = d / ft;
      b.vx = Math.cos(ang) * vh; b.vy = Math.sin(ang) * vh; b.vz = G * ft / 2; b.z = 0.1;
    }
    if (receiver) receiver.recv = { x: tx, y: ty, t: this.time + 2.5 };
    this.onEvent('kick', { power: 0.4 });
  }

  shoot(pl, aimX, power, loft = 0) {
    const T = pl.team, b = this.ball;
    const gy = this.oppY(T);
    const dx = aimX - pl.x, dy = gy - pl.y, d = Math.hypot(dx, dy);
    const skill = pl.r / 100;
    const speed = (16 + power * 15) * (0.88 + skill * 0.14);
    pl.face = Math.atan2(dy, dx);
    this.release(pl);
    b.vx = dx / d * speed; b.vy = dy / d * speed;
    // vertical: keep it under the bar unless over-hit
    const t = d / speed;
    b.vz = clamp(0.5 * G * t * 0.9 + 0.4 + power * 1.1 + loft, 0, 14);
    b.z = 0.1;
    b.shot = { by: pl, team: T };
    this.onEvent('kick', { power });
  }

  /** CPU or assisted shot at goal with skill-based error. */
  aiShoot(pl) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const err = (1.1 - pl.r / 100) * 6 * (pl.team.user ? 1 : this.diff.cpuShotErr);
    const aimX = side * rnd(1.2, 3.2) + gauss() * err;
    this.shoot(pl, aimX, rnd(0.55, 0.9), gauss() * 0.6 * err / 3);
  }

  // ---------------------------------------------------------------- user input
  userSteer(pt) { this.input.steer = pt; }

  userTap(pt) {
    const T = this.teams[0], b = this.ball;
    if (this.state !== 'play' && this.state !== 'kickoff') return;
    const carrier = b.owner && b.owner.team === T ? b.owner : null;
    let best = null, bd = 6;
    for (const p of T.players) {
      if (p === carrier) continue;
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (carrier) {
      if (this.state === 'kickoff') this.state = 'play';
      if (best) {
        const lead = Math.min(0.9, dist(carrier, best) / 18);
        this.pass(carrier, best.x + best.vx * lead, best.y + best.vy * lead, best);
      } else {
        // pass into space: nearest team-mate runs onto it
        let r = null, rd = 1e9;
        for (const p of T.players) if (p !== carrier && !p.isGK) { const d = Math.hypot(p.x - pt.x, p.y - pt.y); if (d < rd) { rd = d; r = p; } }
        this.pass(carrier, pt.x, pt.y, r);
      }
      this.ctrlLock = 0;
      return;
    }
    if (best && !best.isGK) { this.ctrl = best; this.ctrlLock = 2; }
  }

  /** Swipe: shoot / clear when in possession, slide tackle when not. dx,dy is a unit direction. */
  userSwipe(dx, dy, power) {
    const T = this.teams[0], b = this.ball;
    if (this.state === 'kickoff') this.state = 'play';
    if (this.state !== 'play') return;
    const carrier = b.owner && b.owner.team === T ? b.owner : null;
    if (carrier) {
      const gy = this.oppY(T);
      const towardsGoal = dy * T.dir > 0.35;
      const dGoal = Math.hypot(carrier.x, carrier.y - gy);
      if (towardsGoal && dGoal < 45) {
        // project the swipe ray onto the goal line
        const t = (gy - carrier.y) / dy;
        const aimX = carrier.x + dx * t;
        const over = Math.max(0, power - 0.88) * 12;
        this.shoot(carrier, aimX, power, over);
      } else {
        const speed = 14 + power * 14;
        carrier.face = Math.atan2(dy, dx);
        this.release(carrier);
        b.vx = dx * speed; b.vy = dy * speed; b.vz = 3 + power * 5; b.z = 0.1;
        this.onEvent('kick', { power });
      }
      return;
    }
    const c = this.ctrl;
    if (c && !c.isGK && c.slide <= 0 && c.stun <= 0) {
      c.slide = 0.45; c.face = Math.atan2(dy, dx);
      c.vx = dx * 9; c.vy = dy * 9;
      c.slideDone = false;
    }
  }

  // ---------------------------------------------------------------- main update
  update(realDt) {
    this.acc += Math.min(realDt, 0.1);
    while (this.acc >= DT) { this.step(DT); this.acc -= DT; }
  }

  step(dt) {
    this.time += dt;
    this.stateT += dt;
    const b = this.ball;
    switch (this.state) {
      case 'kickoff':
        if (this.stateT > (this.poss.user ? 6 : 1.0) || (this.poss.user && this.input.steer)) this.state = 'play';
        break;
      case 'dead':
        if (this.stateT > 1.1) this.takeRestart();
        break;
      case 'goal':
        if (this.stateT > 3) this.kickoff(this.goalBy.opp);
        break;
      case 'half':
        if (this.stateT > 3) { this.half = 2; this.clock = 45 * 60; this.kickoff(this.teams[1]); this.onEvent('whistle', {}); }
        break;
      case 'full':
        return;
    }
    if (this.state === 'play' || this.state === 'dead') {
      this.clock += dt * this.timeScale;
      if (this.half === 1 && this.clock >= 45 * 60 && this.state === 'play' && !b.shot) {
        this.state = 'half'; this.stateT = 0; this.onEvent('half', {});
      } else if (this.half === 2 && this.clock >= 90 * 60 && this.state === 'play' && !b.shot) {
        this.state = 'full'; this.stateT = 0; this.onEvent('full', {});
        return;
      }
    }
    this.updateControl(dt);
    this.think(dt);
    this.movePlayers(dt);
    if (this.state === 'play' || this.state === 'goal' || this.state === 'kickoff') this.moveBall(dt);
    if (this.state === 'play') { this.possession(dt); this.tackles(dt); }
  }

  updateControl(dt) {
    const T = this.teams[0], b = this.ball;
    this.ctrlLock = Math.max(0, this.ctrlLock - dt);
    if (b.owner && b.owner.team === T) { this.ctrl = b.owner; return; }
    if (this.ctrlLock > 0 && this.ctrl && !this.ctrl.isGK) return;
    const bx = b.x + b.vx * 0.3, by = b.y + b.vy * 0.3;
    let best = null, bd = 1e9;
    for (const p of T.players) {
      if (p.isGK) continue;
      const d = Math.hypot(p.x - bx, p.y - by) - (p.recv ? 6 : 0);
      if (d < bd) { bd = d; best = p; }
    }
    if (!this.ctrl || this.ctrl.isGK) { this.ctrl = best; return; }
    const cd = Math.hypot(this.ctrl.x - bx, this.ctrl.y - by) - (this.ctrl.recv ? 6 : 0);
    if (best !== this.ctrl && bd < cd - 3) this.ctrl = best;
  }

  // ---------------------------------------------------------------- AI
  think(dt) {
    const b = this.ball;
    const live = this.state === 'play';
    for (const T of this.teams) {
      const owned = b.owner && b.owner.team === T;
      const oppOwned = b.owner && b.owner.team !== T;
      // who chases / presses
      const outfield = T.players.filter((p) => !p.isGK && p.stun <= 0);
      const bx = b.x + b.vx * 0.35, by = b.y + b.vy * 0.35;
      outfield.sort((p, q) => Math.hypot(p.x - bx, p.y - by) - Math.hypot(q.x - bx, q.y - by));
      let chaser = outfield[0], cover = outfield[1];
      if (T.user && this.ctrl && !this.ctrl.isGK) { chaser = this.ctrl; cover = outfield.find((p) => p !== chaser); }

      for (const pl of T.players) {
        pl.kickCD = Math.max(0, pl.kickCD - dt);
        pl.stun = Math.max(0, pl.stun - dt);
        pl.dive = Math.max(0, pl.dive - dt);
        if (pl.recv && (this.time > pl.recv.t || b.owner)) pl.recv = null;
        let want = 0.75;
        let tx, ty;

        if (!live) {
          ({ x: tx, y: ty } = this.shapeTarget(pl, true));
          want = 0.6;
          if (this.state === 'kickoff' && pl === b.owner) { tx = pl.x; ty = pl.y; }
        } else if (pl === b.owner) {
          if (T.user && this.input.steer && !pl.hold && !pl.isGK) { tx = this.input.steer.x; ty = this.input.steer.y; want = 0.95; }
          else ({ tx, ty, want } = this.carrierThink(pl, dt));
        } else if (pl.isGK) {
          ({ tx, ty, want } = this.keeperThink(pl));
        } else if (T.user && pl === this.ctrl && this.input.steer) {
          tx = this.input.steer.x; ty = this.input.steer.y; want = 1;
        } else if (pl.recv && !b.owner) {
          // run to meet the pass; when close, attack the ball itself
          const db = Math.hypot(pl.x - b.x, pl.y - b.y);
          if (db < 6) { tx = b.x + b.vx * 0.2; ty = b.y + b.vy * 0.2; } else { tx = pl.recv.x; ty = pl.recv.y; }
          want = 1;
        } else if (!b.owner && pl === chaser) {
          const lead = Math.min(1.2, Math.hypot(pl.x - b.x, pl.y - b.y) / 9);
          tx = b.x + b.vx * lead; ty = b.y + b.vy * lead; want = 1;
        } else if (oppOwned && pl === chaser) {
          const o = b.owner;
          // approach from the goal side
          const og = this.ownY(T);
          const gx = -o.x, gy = og - o.y, gl = Math.hypot(gx, gy) || 1;
          tx = o.x + gx / gl * 0.6 + o.vx * 0.25; ty = o.y + gy / gl * 0.6 + o.vy * 0.25;
          want = T.user ? 0.95 : 0.92 * this.diff.cpuSpeed + 0.05;
        } else if (oppOwned && pl === cover) {
          const o = b.owner, og = this.ownY(T);
          tx = o.x * 0.7; ty = o.y + (og - o.y) * 0.25;
          want = 0.85;
        } else if (owned && pl.run) {
          tx = pl.run.x; ty = pl.run.y; want = 0.95;
          pl.run.t -= dt;
          if (pl.run.t <= 0) pl.run = null;
        } else {
          ({ x: tx, y: ty } = this.shapeTarget(pl, false));
          const d = Math.hypot(tx - pl.x, ty - pl.y);
          want = d > 8 ? 0.85 : 0.55;
          if (owned && !pl.isGK) {
            pl.runT -= dt;
            if (pl.runT <= 0) {
              pl.runT = rnd(2.5, 5);
              if ((pl.slot.role === 'FW' || (pl.slot.role === 'MF' && Math.random() < 0.4)) && Math.random() < 0.55) {
                const bp = this.prog(T, b.y);
                pl.run = { x: clamp(pl.x + rnd(-8, 8), -HW + 3, HW - 3), y: this.pToY(T, clamp(bp + rnd(0.15, 0.3), 0.45, 0.9)), t: rnd(1.5, 2.5) };
              }
            }
          }
        }
        if (pl.slide > 0) continue;
        pl.tx = tx; pl.ty = ty; pl.want = want;
      }
    }
  }

  shapeTarget(pl, dead) {
    const T = pl.team, b = this.ball;
    if (pl.isGK) return this.gkPos(pl);
    const poss = this.poss === T;
    const bp = this.prog(T, b.y);
    const s = pl.slot;
    let p = poss ? s.p * 0.62 + bp * 0.42 + 0.03 : s.p * 0.58 + bp * 0.38 - 0.06;
    if (s.role === 'DF') p = Math.min(p, poss ? 0.58 : 0.4 + bp * 0.15);
    if (s.role === 'FW') p = Math.max(p, poss ? 0.45 : 0.32);
    if (!poss && s.role !== 'FW') p = Math.min(p, bp + 0.04);
    if (dead && this.restart && this.restart.type === 'corner' && poss && s.role !== 'DF') p = Math.max(p, 0.86);
    if (dead && this.restart && this.restart.type === 'corner' && !poss) p = Math.min(p, 0.12);
    p = clamp(p, 0.05, 0.92);
    const width = poss ? 1 : 0.68;
    let x = this.latToX(T, s.fx * 28 * width) + b.x * (poss ? 0.18 : 0.38);
    if (dead && this.restart?.type === 'corner') x *= 0.45;
    return { x: clamp(x, -HW + 1.5, HW - 1.5), y: this.pToY(T, p) };
  }

  gkPos(gk) {
    const T = gk.team, b = this.ball, oy = this.ownY(T);
    const dx = b.x, dy = b.y - oy, d = Math.hypot(dx, dy) || 1;
    const off = clamp(d * 0.1, 1, 5);
    return { x: clamp(dx / d * off, -GW, GW), y: oy + dy / d * off };
  }

  keeperThink(gk) {
    const T = gk.team, b = this.ball, oy = this.ownY(T);
    const sp = Math.hypot(b.vx, b.vy);
    // incoming shot: get across to the line of the ball
    if (!b.owner && sp > 8 && (b.y - oy) * b.vy < 0) {
      const t = (gk.y - b.y) / (b.vy || 1e-6);
      if (t > 0 && t < 2.2) {
        const px = b.x + b.vx * t;
        if (Math.abs(px) < GW + 2) {
          gk.dive = 0.15;
          return { tx: clamp(px, -GW - 0.5, GW + 0.5), ty: gk.y, want: 1.6 * (T.user ? 1 : this.diff.gk) };
        }
      }
    }
    // loose ball in the six-yard / penalty area: come and claim it
    if (!b.owner && Math.abs(b.y - oy) < 14 && Math.abs(b.x) < 14 && sp < 9) {
      const mates = T.players.filter((p) => !p.isGK);
      const myD = dist(gk, b);
      const oppD = Math.min(...T.opp.players.map((p) => dist(p, b)));
      if (myD < oppD + 2 && myD < Math.min(...mates.map((p) => dist(p, b))) + 1) return { tx: b.x, ty: b.y, want: 1.1 };
    }
    const p = this.gkPos(gk);
    return { tx: p.x, ty: p.y, want: 0.8 };
  }

  carrierThink(pl, dt) {
    const T = pl.team, b = this.ball;
    const gy = this.oppY(T);
    const dGoal = Math.hypot(pl.x, pl.y - gy);
    let pressure = 1e9, nearest = null;
    for (const o of T.opp.players) { const d = dist(o, pl); if (d < pressure) { pressure = d; nearest = o; } }

    // restart takers and keepers holding the ball stand still until they release it
    if (pl.hold || (pl.isGK && this.prog(T, pl.y) < 0.2)) {
      pl.holdT = (pl.holdT || 0) + dt;
      const wait = T.user ? 4 : this.diff.cpuThink + 0.7;
      if (pl.holdT > wait) this.aiDistribute(pl);
      return { tx: pl.x, ty: pl.y, want: 0 };
    }

    const isUser = T.user && !this.opts.autoplay;
    pl.thinkT -= dt;
    if (!isUser && pl.thinkT <= 0) {
      pl.thinkT = this.diff.cpuThink * rnd(0.7, 1.3);
      const angleOK = Math.abs(pl.x) < 18 + (dGoal < 14 ? 6 : 0);
      if (dGoal < 25 && angleOK) {
        const chance = dGoal < 11 ? 0.95 : dGoal < 17 ? 0.6 : 0.25;
        if (Math.random() < chance) { this.aiShoot(pl); return { tx: pl.x, ty: pl.y, want: 0.3 }; }
      }
      const opt = this.bestPass(pl);
      if (opt && (pressure < 3.2 || (opt.score > 10 && Math.random() < 0.45) || (opt.score > 4 && Math.random() < 0.18))) {
        this.pass(pl, opt.x, opt.y, opt.mate);
        return { tx: pl.x, ty: pl.y, want: 0.3 };
      }
    }

    // dribble towards goal, bending away from the nearest opponent
    let dx = -pl.x * 0.4, dy = gy - pl.y;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    if (nearest && pressure < 6) {
      const ax = pl.x - nearest.x, ay = pl.y - nearest.y, al = Math.hypot(ax, ay) || 1;
      const w = (6 - pressure) / 6 * 0.9;
      dx += ax / al * w; dy += ay / al * w * 0.5;
    }
    if (Math.abs(pl.x) > HW - 4) dx -= Math.sign(pl.x) * 0.6;
    const want = isUser ? 0.7 : 0.8 * this.diff.cpuSpeed;
    return { tx: pl.x + dx * 6, ty: pl.y + dy * 6, want };
  }

  bestPass(pl) {
    const T = pl.team;
    let best = null;
    const myP = this.prog(T, pl.y);
    for (const m of T.players) {
      if (m === pl || m.isGK) continue;
      const d = dist(m, pl);
      if (d < 6 || d > 42) continue;
      const lead = Math.min(0.9, d / 18);
      const x = clamp(m.x + m.vx * lead, -HW + 1, HW - 1), y = clamp(m.y + m.vy * lead, -HL + 1, HL - 1);
      let open = 1e9;
      for (const o of T.opp.players) open = Math.min(open, Math.hypot(o.x - x, o.y - y));
      const gain = this.prog(T, y) - myP;
      const blocked = this.laneBlocked(pl, x, y, T);
      const score = gain * 45 + Math.min(open, 8) * 1.3 - (blocked ? (d > 14 ? 6 : 14) : 0) - d * 0.06;
      if (!best || score > best.score) best = { mate: m, x, y, score };
    }
    return best;
  }

  aiDistribute(pl) {
    const opt = this.bestPass(pl);
    if (opt) this.pass(pl, opt.x, opt.y, opt.mate);
    else {
      const T = pl.team;
      pl.face = T.dir < 0 ? -Math.PI / 2 : Math.PI / 2;
      this.release(pl);
      this.ball.vx = rnd(-4, 4); this.ball.vy = T.dir * 22; this.ball.vz = 8;
    }
  }

  // ---------------------------------------------------------------- physics
  movePlayers(dt) {
    const b = this.ball;
    for (const pl of this.all) {
      pl.anim += Math.hypot(pl.vx, pl.vy) * dt * 1.6;
      if (pl.slide > 0) {
        pl.slide -= dt;
        pl.x += pl.vx * dt; pl.y += pl.vy * dt;
        pl.vx *= 1 - 3 * dt; pl.vy *= 1 - 3 * dt;
        if (pl.slide <= 0) pl.stun = pl.slideDone ? 0.2 : 0.6;
        continue;
      }
      if (pl.stun > 0) { pl.vx *= 1 - 6 * dt; pl.vy *= 1 - 6 * dt; pl.x += pl.vx * dt; pl.y += pl.vy * dt; continue; }
      let dx = pl.tx - pl.x, dy = pl.ty - pl.y;
      const d = Math.hypot(dx, dy);
      let speed = pl.speed * pl.want * (pl === b.owner ? 0.86 : 1);
      if (!pl.team.user) speed *= this.diff.cpuSpeed;
      if (d < 2) speed *= d / 2;
      const dvx = d > 0.05 ? dx / d * speed : 0, dvy = d > 0.05 ? dy / d * speed : 0;
      const acc = pl.isGK && pl.dive > 0 ? 40 : 14;
      let ax = dvx - pl.vx, ay = dvy - pl.vy;
      const al = Math.hypot(ax, ay), maxA = acc * dt;
      if (al > maxA) { ax *= maxA / al; ay *= maxA / al; }
      pl.vx += ax; pl.vy += ay;
      pl.x += pl.vx * dt; pl.y += pl.vy * dt;
      const sp = Math.hypot(pl.vx, pl.vy);
      let tf;
      if (sp > 0.6) tf = Math.atan2(pl.vy, pl.vx);
      else tf = Math.atan2(b.y - pl.y, b.x - pl.x);
      if (pl !== b.owner || sp > 0.6) {
        let df = tf - pl.face;
        while (df > Math.PI) df -= Math.PI * 2;
        while (df < -Math.PI) df += Math.PI * 2;
        pl.face += df * Math.min(1, dt * (pl === b.owner ? 7 : 10));
      }
      pl.x = clamp(pl.x, -HW - 3, HW + 3); pl.y = clamp(pl.y, -HL - 3, HL + 3);
    }
    // keep players from overlapping
    for (let i = 0; i < this.all.length; i++) {
      for (let j = i + 1; j < this.all.length; j++) {
        const a = this.all[i], c = this.all[j];
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 1.0) {
          const push = (1.0 - d) / 2;
          a.x -= dx / d * push; a.y -= dy / d * push; c.x += dx / d * push; c.y += dy / d * push;
        }
      }
    }
  }

  moveBall(dt) {
    const b = this.ball;
    if (b.owner) {
      const o = b.owner;
      const sp = Math.hypot(o.vx, o.vy);
      const ahead = 0.55 + Math.min(0.35, sp * 0.05);
      b.x = o.x + Math.cos(o.face) * ahead; b.y = o.y + Math.sin(o.face) * ahead;
      b.z = 0; b.vx = o.vx; b.vy = o.vy; b.vz = 0;
      return;
    }
    const px = b.x, py = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.z > 0 || b.vz > 0) {
      b.vz -= G * dt; b.z += b.vz * dt;
      b.vx *= 1 - 0.08 * dt; b.vy *= 1 - 0.08 * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -2) { b.vz = -b.vz * 0.45; b.vx *= 0.82; b.vy *= 0.82; } else b.vz = 0;
      }
    } else {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - ROLL * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
    }
    if (this.state === 'goal') {
      // ball in the net
      if (Math.abs(b.y) > HL + 1.8) { b.y = Math.sign(b.y) * (HL + 1.8); b.vy = 0; b.vx *= 0.3; }
      if (Math.abs(b.x) > GW - 0.2) { b.x = Math.sign(b.x) * (GW - 0.2); b.vx = 0; }
      if (b.z > GH - 0.2) { b.z = GH - 0.2; b.vz = 0; }
      return;
    }
    if (this.state !== 'play') return;
    // goal line
    for (const side of [-1, 1]) {
      const line = side * HL;
      if ((py - line) * (b.y - line) <= 0 && py !== b.y) {
        const t = (line - py) / (b.y - py), cx = px + (b.x - px) * t;
        const ax = Math.abs(cx);
        if (ax < GW && b.z < GH) {
          const T = this.teams.find((tm) => tm.dir === side);
          this.scoreGoal(T);
          return;
        }
        if (Math.abs(ax - GW) < 0.3 && b.z < GH + 0.1) {
          b.y = line - side * 0.12; b.vy = -b.vy * 0.6; b.vx += Math.sign(cx) * -2; b.shot = null;
          this.onEvent('post', {});
          continue;
        }
        if (ax < GW && b.z < GH + 0.35) {
          b.y = line - side * 0.12; b.vy = -b.vy * 0.5; b.vz = -Math.abs(b.vz) * 0.5; b.shot = null;
          this.onEvent('post', {});
          continue;
        }
      }
    }
    // out of play
    if (Math.abs(b.x) > HW + 0.15) {
      const T = b.last ? b.last.team.opp : this.teams[0];
      this.setRestart('throwin', T, Math.sign(b.x) * (HW - 0.2), clamp(b.y, -HL + 1, HL - 1));
    } else if (Math.abs(b.y) > HL + 0.15) {
      const side = Math.sign(b.y);
      const attacking = this.teams.find((tm) => tm.dir === side);
      const defending = attacking.opp;
      const wasShot = b.shot;
      if (b.last && b.last.team === attacking) {
        this.setRestart('goalkick', defending, 0, side * (HL - 5.5));
        if (wasShot) this.onEvent('miss', { team: attacking });
      } else {
        this.setRestart('corner', attacking, Math.sign(b.x || 1) * (HW - 0.5), side * (HL - 0.5));
      }
    }
  }

  scoreGoal(T) {
    const b = this.ball;
    T.score++;
    const scorer = b.last && b.last.team === T ? b.last.name : (b.last ? `${b.last.name} (OG)` : '');
    const ev = { team: T, scorer, minute: this.minute() };
    this.events.push(ev);
    this.goalBy = T;
    this.state = 'goal'; this.stateT = 0;
    b.shot = null;
    this.onEvent('goal', ev);
  }

  possession(dt) {
    const b = this.ball;
    if (b.owner) return;
    const sp = Math.hypot(b.vx, b.vy);
    let cands = [];
    for (const pl of this.all) {
      if (pl.kickCD > 0 || pl.stun > 0) continue;
      const reach = pl.isGK ? 1.25 + (pl.dive > 0 ? 0.8 : 0) : (pl.slide > 0 ? 1.1 : 0.85);
      const zmax = pl.isGK ? 2.6 : 1.9;
      const d = Math.hypot(b.x - pl.x, b.y - pl.y);
      if (d < reach && b.z < zmax) cands.push({ pl, d });
    }
    if (!cands.length) return;
    cands.sort((a, c) => a.d - c.d);
    for (const { pl } of cands) {
      const T = pl.team;
      const inBox = Math.abs(pl.y - this.ownY(T)) < 17 && Math.abs(pl.x) < 21;
      if (pl.isGK && inBox) {
        if (sp > 14) {
          const skill = (pl.r - 60) / 40 * (T.user ? 1 : this.diff.gk);
          const p = clamp(0.55 + skill * 0.4 - (sp - 14) * 0.025, 0.15, 0.95);
          if (Math.random() > p) { pl.kickCD = 0.5; continue; }
          if (sp > 21 && Math.random() < 0.55) {
            // parry wide
            b.vx = Math.sign(b.x - pl.x || rnd(-1, 1)) * rnd(6, 11); b.vy = -b.vy * 0.25; b.vz = rnd(1, 4);
            b.last = pl; b.shot = null; pl.kickCD = 0.6;
            this.onEvent('save', { team: T, parry: true });
            return;
          }
          this.onEvent('save', { team: T });
        }
        this.take(pl);
        pl.hold = true; pl.holdT = 0;
        return;
      }
      if (sp > 17 && b.z > 0.3 && Math.random() < 0.5) { pl.kickCD = 0.3; continue; }
      if (sp > 22 && Math.random() < 0.55) { pl.kickCD = 0.3; continue; }
      // a slide tackle that reaches a loose ball pokes it on
      if (pl.slide > 0) { pl.slideDone = true; b.vx = Math.cos(pl.face) * 7; b.vy = Math.sin(pl.face) * 7; b.last = pl; this.poss = T; pl.kickCD = 0.3; return; }
      if (b.shot && b.shot.team !== T) this.onEvent('block', { team: T });
      this.take(pl);
      return;
    }
  }

  tackles(dt) {
    const b = this.ball, o = b.owner;
    if (!o || o.hold) return;
    for (const d of o.team.opp.players) {
      if (d.stun > 0) continue;
      const dd = dist(d, o);
      if (d.slide > 0 && !d.slideDone && dd < 1.4) {
        d.slideDone = true;
        if (Math.random() < 0.72) { this.winBall(d, o, Math.random() < 0.4); return; }
        continue;
      }
      if (dd > 1.25 || d.isGK && Math.abs(d.y - this.ownY(d.team)) > 16) continue;
      const base = d.team.user ? 1.3 : 1.25 * this.diff.cpuTackle;
      const rate = base * Math.pow(d.r / o.r, 2) * (o.team.user ? 1 : 1.1);
      if (Math.random() < rate * dt) { this.winBall(d, o, Math.random() < 0.55); return; }
    }
  }

  winBall(d, o, keep) {
    const b = this.ball;
    o.stun = 0.7;
    if (keep) { this.take(d); }
    else {
      b.owner = null; b.last = d; this.poss = d.team;
      const a = d.face + rnd(-0.6, 0.6);
      b.vx = Math.cos(a) * rnd(4, 7); b.vy = Math.sin(a) * rnd(4, 7);
      d.kickCD = 0.2;
    }
    this.onEvent('tackle', { team: d.team });
  }
}
