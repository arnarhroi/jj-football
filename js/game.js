import {
  Ball, Keeper, Wall, KEEPER_SKILL, HALF_W, GOAL_H, BALL_R,
  stepBall, predictCrossing, solveShot, collideGoal, clamp, rand, gauss,
} from './world.js';
import { Renderer } from './render.js';
import { sfx, crowdLevel } from './audio.js';

const CONFETTI = ['#ffd93b', '#ff4f6d', '#4fd1ff', '#7dff6b', '#ffffff', '#c38bff'];

export class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.r = new Renderer(canvas);
    this.ball = new Ball();
    this.keeper = null; this.wall = null; this.targets = []; this.shooter = null;
    this.phase = 'idle';
    this.control = 'shoot';
    this.mode = null;
    this.time = 0;
    this.timers = [];
    this.particles = [];
    this.trail = [];
    this.swipe = null;
    this.shake = 0; this.flash = 0;
    this.paused = false;
    this.keeperMarker = null;
    this.lastFrame = performance.now();

    window.addEventListener('resize', () => this.r.resize());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.swipe = null; });
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ flow
  setMode(mode) {
    this.timers = [];
    this.particles = [];
    this.mode = mode;
    this.paused = false;
    if (mode) mode.start(this);
  }

  after(sec, fn) { this.timers.push({ t: this.time + sec, fn }); }

  /**
   * cfg: { x, z, keeper: skill|null, keeperColors, control: 'shoot'|'keep',
   *        wall: n, wallColors, targets: [], cpu: {skill, colors, number} }
   */
  setupShot(cfg) {
    this.cfg = cfg;
    const b = this.ball;
    b.reset(cfg.x, cfg.z);
    {
      // camera sits behind the ball on the line from the centre of the goal
      const L = Math.hypot(cfg.x, cfg.z) || 1, back = 5.2;
      this.r.setCamera(cfg.x + (cfg.x / L) * back, 1.9 + Math.max(0, L - 11) * 0.03, cfg.z + (cfg.z / L) * back, 0, 0, back);
    }
    this.control = cfg.control || 'shoot';
    if (cfg.keeper) {
      this.keeper = new Keeper(cfg.keeper, cfg.keeperColors);
      this.keeper.reset(clamp(cfg.x * 0.1, -0.6, 0.6));
    } else this.keeper = null;
    this.wall = cfg.wall ? new Wall(cfg.x, cfg.z, cfg.wall, cfg.wallColors) : null;
    this.targets = cfg.targets || [];
    this.trail = [];
    this.swipe = null;
    this.keeperMarker = null;
    this.res = null;
    this.shooter = null;
    if (this.control === 'keep') {
      const c = cfg.cpu;
      this.shooter = { x: cfg.x - 2.6, z: cfg.z + 1.6, phase: 0, kick: 0, t: 0, colors: c.colors, number: c.number };
      this.phase = 'cpu-runup';
      this.runT = 1.5 + Math.random() * 0.6;
    } else {
      this.phase = 'aim';
    }
  }

  // ------------------------------------------------------------------ input
  pt(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }

  onDown(e) {
    if (this.paused) return;
    const p = this.pt(e);
    if (this.phase === 'aim' && this.control === 'shoot') {
      this.swipe = { pts: [p], id: e.pointerId };
      this.canvas.setPointerCapture?.(e.pointerId);
    } else if (this.control === 'keep' && (this.phase === 'cpu-runup' || this.phase === 'flight') && this.keeper) {
      if (this.keeper.state === 'diving' || this.keeper.state === 'down') return;
      const T = this.r.unproject(p.x, p.y, this.keeper.z);
      T.x = clamp(T.x, -HALF_W - 0.5, HALF_W + 0.5); T.y = clamp(T.y, 0.1, GOAL_H + 0.3);
      if (this.phase === 'flight') this.keeper.dive(T);
      else this.keeperMarker = T;
      sfx('click');
    }
  }

  onMove(e) {
    if (!this.swipe || e.pointerId !== this.swipe.id) return;
    const p = this.pt(e);
    const pts = this.swipe.pts, last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) > 2) pts.push(p);
    // auto-release on very long swipes so the shot feels snappy
    if (pts.length > 2 && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) > this.r.H * 0.55) this.onUp(e);
  }

  onUp(e) {
    if (!this.swipe || e.pointerId !== this.swipe.id) return;
    const sw = this.swipe;
    sw.pts.push(this.pt(e));
    this.swipe = null;
    if (this.phase !== 'aim') return;
    const shot = this.swipeToShot(sw.pts);
    if (!shot) { this.mode?.onHint?.('Swipe up towards the goal!'); return; }
    this.kick(shot.v, shot.spin, shot.power);
  }

  swipeToShot(pts) {
    // trim stationary start (finger resting before the flick)
    let i0 = 0;
    while (i0 < pts.length - 2 && Math.hypot(pts[i0 + 1].x - pts[0].x, pts[i0 + 1].y - pts[0].y) < 6) i0++;
    const s = pts[i0], e = pts[pts.length - 1];
    const dx = e.x - s.x, dy = e.y - s.y, len = Math.hypot(dx, dy);
    if (len < 30 || dy > -20) return null;
    const dur = Math.max(0.05, (e.t - s.t) / 1000);
    const sp = (len / this.r.H) / dur;              // screens per second
    const power = clamp((sp - 0.25) / 1.8, 0, 1);

    // aim: swipe vector applied from the ball, projected onto the goal plane
    const b = this.ball;
    const B = this.r.P(b.x, b.y, b.z);
    const gain = 1.1;
    const T = this.r.unproject(B[0] + dx * gain, B[1] + dy * gain, 0);
    T.y = Math.max(BALL_R, T.y);

    // curl: how far the path bulges from its chord
    const nx = -dy / len, ny = dx / len;
    let dev = 0;
    for (let i = i0; i < pts.length; i++) {
      const d = (pts[i].x - s.x) * nx + (pts[i].y - s.y) * ny;
      if (Math.abs(d) > Math.abs(dev)) dev = d;
    }
    const c = dev / len;
    const spin = Math.abs(c) < 0.05 ? 0 : -clamp(c, -0.45, 0.45) * 26;

    // execution error: a touch of randomness, more when blasting it
    const over = Math.max(0, power - 0.85);
    T.x += gauss() * (0.07 + over * 2.5);
    T.y += gauss() * 0.05 + over * rand(0, 7);
    const speed = 14 + power * 18;
    return { v: solveShot(b.x, b.z, T.x, T.y, speed, spin), spin, power };
  }

  kick(v, spin, power) {
    const b = this.ball;
    b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; b.spin = spin;
    this.phase = 'flight';
    this.flightT = 0;
    this.res = { goal: false, keeper: false, wall: false, woodwork: null, crossed: false, touchT: 0, power };
    sfx('kick', power);
    this.wall?.jump();
    const k = this.keeper;
    if (k) {
      if (this.control === 'keep') {
        if (this.keeperMarker) k.plan(this.keeperMarker, 0.03);
      } else {
        const s = k.skill;
        const c = predictCrossing(b, k.z) || { x: b.x * 0.2, y: 0.2 };
        // slower shots are easier to read
        const err = s.err * clamp(b.speed() / 22, 0.45, 1.3);
        const T = { x: c.x + gauss() * err, y: clamp(c.y + gauss() * err * 0.5, 0.1, 2.6) };
        k.plan(T, s.react + Math.random() * 0.06);
      }
    }
    this.mode?.onKick?.();
  }

  cpuKick() {
    const c = this.cfg.cpu;
    const skill = c.skill;
    const side = Math.random() < 0.5 ? -1 : 1;
    let tx = Math.random() < 0.14 ? rand(-0.6, 0.6) : side * rand(1.0, 3.35);
    let ty = Math.random() < 0.5 ? rand(0.15, 0.8) : rand(0.8, 2.25);
    const err = 0.25 + (1 - skill) * 0.75;
    tx += gauss() * err; ty += gauss() * err * 0.6;
    const speed = rand(18, 22) + skill * 3;
    const spin = rand(-2.5, 2.5);
    this.kick(solveShot(this.ball.x, this.ball.z, tx, Math.max(BALL_R, ty), speed, spin), spin, 0.6);
  }

  // ------------------------------------------------------------------ simulation
  frame(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (!this.paused && !this.sleep) this.update(dt);
    if (!this.sleep) this.r.draw(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.time >= this.timers[i].t) { const t = this.timers.splice(i, 1)[0]; t.fn(); }
    }
    this.mode?.tick?.(dt);

    if (this.phase === 'cpu-runup') {
      const sh = this.shooter;
      sh.t += dt;
      const p = clamp(sh.t / this.runT, 0, 1);
      sh.x = (this.cfg.x - 2.6) + 2.1 * p;
      sh.z = (this.cfg.z + 1.6) - 1.3 * p;
      sh.phase += dt * 13;
      if (p >= 1) { sh.kick = 1; this.cpuKick(); }
    } else if (this.shooter && this.shooter.kick > 0) {
      this.shooter.t += dt;
      this.shooter.kick = Math.max(0, 1 - (this.shooter.t - this.runT) * 1.5);
    }

    if (this.keeper && this.phase !== 'flight') this.keeper.update(dt, this.time);
    if (this.phase === 'flight') this.updateFlight(dt);
    else this.wall?.update(dt);

    for (const t of this.targets) if (t.hit) t.fade -= dt * 1.5;
    this.shake = Math.max(0, this.shake - dt * 2);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 600 * dt; p.vx *= 1 - dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt * 0.6;
      if (p.life <= 0 || p.y > this.r.H + 20) this.particles.splice(i, 1);
    }
  }

  updateFlight(dt) {
    const b = this.ball, res = this.res, k = this.keeper;
    this.flightT += dt;
    const N = 5, h = dt / N;
    for (let i = 0; i < N; i++) {
      const pz = b.z;
      stepBall(b, h);
      k?.update(h, this.time);
      this.wall?.update(h);
      if (this.wall && !b.held && this.wall.collide(b)) {
        if (!res.wall) { res.wall = true; res.touchT = this.flightT; sfx('save'); }
      }
      if (k && !b.held && !res.goal) {
        const hit = k.collide(b);
        if (hit && !res.keeper) {
          res.keeper = true; res.touchT = this.flightT;
          sfx('save');
          const sp = b.speed();
          if ((hit.part === 'body' && sp < k.skill.catchSp + 4) || (sp < k.skill.catchSp * 0.6)) {
            b.held = true; res.caught = true;
          }
        }
      }
      if (b.held && k) {
        const P = k.pose();
        b.x = (P.hL[0] + P.hR[0]) / 2; b.y = (P.hL[1] + P.hR[1]) / 2; b.z = k.z - 0.05;
        b.vx = b.vy = b.vz = 0;
      }
      const ww = b.held ? null : collideGoal(b);
      if (ww) {
        if (!res.woodwork) res.woodwork = ww;
        if (this.time - (this._lastPost || 0) > 0.25) { sfx('post'); this.shake = Math.max(this.shake, 0.25); }
        this._lastPost = this.time;
        if (!res.goal) res.touchT = this.flightT;
      }
      if (!res.crossed && pz > 0 && b.z <= 0) {
        res.crossed = true; res.crossT = this.flightT;
        const k2 = pz / (pz - b.z);
        res.x = b.x; res.y = b.y;
        if (Math.abs(b.x) < HALF_W && b.y < GOAL_H) {
          res.goal = true; res.goalT = this.flightT;
          for (const t of this.targets) {
            if (!t.hit && Math.hypot(b.x - t.x, b.y - t.y) < t.r + BALL_R * 0.5) { t.hit = true; t.fade = 1; res.target = t; }
          }
          this.onGoal();
        }
        void k2;
      }
      if (b._netHit && !res.netSound) { res.netSound = true; sfx('net'); }
    }
    this.trail.push({ x: b.x, y: b.y, z: b.z });
    if (this.trail.length > 14) this.trail.shift();

    // decide when the shot is over
    const t = this.flightT, sp = b.speed();
    let done = false;
    if (res.goal) done = t - res.goalT > 1.3;
    else if (res.caught) done = t - res.touchT > 1.0;
    else if (res.crossed) done = t - res.crossT > 0.7;
    else if ((res.keeper || res.wall || res.woodwork) && b.vz > -0.5) done = t - res.touchT > 1.0;
    if (!done && sp < 0.4 && b.y <= BALL_R + 0.01 && t > 0.5) done = true;
    if (t > 3.8) done = true;
    if (done) this.endShot();
  }

  onGoal() {
    const userScored = this.control === 'shoot';
    if (userScored) {
      this.flash = 0.8; this.shake = 0.7;
      sfx('cheer'); crowdLevel(0.12); setTimeout(() => crowdLevel(0.05), 2500);
      if (this.settings.vibrate && navigator.vibrate) navigator.vibrate([30, 40, 70]);
      this.confetti(90);
    } else {
      sfx('groan');
    }
  }

  confetti(n) {
    const W = this.r.W;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.6, y: this.r.H * 0.35,
        vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 700,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, s: 6 + Math.random() * 7,
        c: CONFETTI[i % CONFETTI.length], life: 1.4 + Math.random(),
      });
    }
  }

  endShot() {
    const r = this.res;
    this.phase = 'result';
    let label, kind;
    if (r.goal) { label = r.woodwork === 'post' ? 'IN OFF THE POST!' : r.woodwork === 'bar' ? 'OFF THE BAR & IN!' : 'GOAL!'; kind = 'goal'; }
    else if (r.keeper) { label = 'SAVED!'; kind = 'save'; }
    else if (r.wall) { label = 'BLOCKED!'; kind = 'block'; }
    else if (r.woodwork === 'bar') { label = 'CROSSBAR!'; kind = 'woodwork'; }
    else if (r.woodwork === 'post') { label = 'OFF THE POST!'; kind = 'woodwork'; }
    else { label = r.crossed && r.y > GOAL_H ? 'OVER THE BAR!' : 'WIDE!'; kind = 'miss'; }
    r.label = label; r.kind = kind;
    if (this.control === 'keep') {
      if (r.goal) { r.label = 'THEY SCORE'; }
      else if (r.keeper) {
        r.label = 'GREAT SAVE!';
        sfx('cheer'); this.flash = 0.5; this.confetti(50);
        if (this.settings.vibrate && navigator.vibrate) navigator.vibrate([30, 40, 70]);
      } else { r.label = 'THEY MISSED!'; sfx('cheer'); }
    } else if (!r.goal && kind !== 'woodwork') {
      sfx('groan');
    }
    this.mode?.onResult?.(r);
  }

  // used by renderer
  get aimGuide() {
    return this.phase === 'aim' && !this.swipe ? { x: this.ball.x, y: this.ball.y, z: this.ball.z } : null;
  }
}
