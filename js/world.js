// Physics & entities. World units are metres.
// Axes: x = right, y = up, z = towards the camera. Goal line is z = 0, goal centred at x = 0.

export const HALF_W = 3.66;      // half of 7.32 m goal width
export const GOAL_H = 2.44;
export const BALL_R = 0.11;
export const POST_R = 0.06;
export const NET_TOP_Z = -1.0;   // top net runs back to here
export const NET_BACK_Z = -2.0;  // back net meets the ground here
export const KEEPER_Z = 0.35;
export const GRAVITY = 9.81;
const DRAG = 0.0085;

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export class Ball {
  constructor() { this.reset(0, 11); }
  reset(x, z) {
    this.x = x; this.y = BALL_R; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.spin = 0;          // lateral (side) acceleration from curl, m/s²
    this.rotA = 0; this.rotB = 0;
    this.held = false; this._inGoal = false; this._netHit = false;
  }
  speed() { return Math.hypot(this.vx, this.vy, this.vz); }
}

/** Integrate one step of free flight (gravity, drag, curl, ground). */
export function stepBall(b, dt) {
  if (b.held) return;
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  const drag = DRAG * sp;
  const curl = b.spin * Math.min(1, sp / 18);
  b.vx += (-drag * b.vx + curl) * dt;
  b.vy += (-drag * b.vy - GRAVITY) * dt;
  b.vz += (-drag * b.vz) * dt;
  b.spin *= 1 - 0.25 * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.y < BALL_R) {
    b.y = BALL_R;
    if (b.vy < -1.2) {
      b.vy = -b.vy * 0.5;
      b.vx *= 0.85; b.vz *= 0.85; b.spin *= 0.4;
    } else {
      b.vy = 0;
      const f = Math.max(0, 1 - 1.6 * dt);
      b.vx *= f; b.vz *= f; b.spin *= 0.9;
    }
  }
  b.rotA += (sp / BALL_R) * dt * 0.12;
  b.rotB += b.spin * dt * 0.6;
}

/** Simulate a copy of the ball forward until it reaches plane z = zPlane. */
export function predictCrossing(b, zPlane, maxT = 3) {
  const c = { ...b };
  const dt = 1 / 240;
  for (let t = 0; t < maxT; t += dt) {
    const pz = c.z;
    stepBall(c, dt);
    if (pz > zPlane && c.z <= zPlane) {
      const k = (pz - zPlane) / (pz - c.z);
      return { x: c.x - c.vx * dt * (1 - k), y: c.y - c.vy * dt * (1 - k), t };
    }
    if (c.vz > -0.3 && c.y <= BALL_R + 1e-3) return null; // stopped short
  }
  return null;
}

/**
 * Find a launch velocity so a ball kicked from (sx,sz) at `speed` with `spin`
 * crosses the goal plane at (tx, ty). Iterative shooting method.
 */
export function solveShot(sx, sz, tx, ty, speed, spin) {
  ty = Math.max(ty, BALL_R);
  const dist = Math.hypot(tx - sx, sz);
  let yaw = Math.atan2(tx - sx, sz);
  let pitch = Math.atan2(ty - BALL_R, dist) + 0.5 * Math.asin(clamp(GRAVITY * dist / (speed * speed), -1, 1)) * 0.9;
  const probe = new Ball();
  const make = () => {
    probe.reset(sx, sz);
    probe.vx = speed * Math.cos(pitch) * Math.sin(yaw);
    probe.vy = speed * Math.sin(pitch);
    probe.vz = -speed * Math.cos(pitch) * Math.cos(yaw);
    probe.spin = spin;
  };
  for (let i = 0; i < 14; i++) {
    make();
    const c = predictCrossing(probe, 0, 4);
    if (!c) { pitch = Math.min(pitch + 0.06, 0.95); continue; }
    const ex = tx - c.x, ey = ty - c.y;
    if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) break;
    yaw += (ex / dist) * 0.95;
    pitch = clamp(pitch + (ey / dist) * 0.95, -0.15, 0.95);
  }
  make();
  return { vx: probe.vx, vy: probe.vy, vz: probe.vz };
}

/** Closest point on segment AB to P (3D). */
export function segClosest(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const L = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = clamp(((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / L, 0, 1);
  const cx = ax + abx * t, cy = ay + aby * t, cz = az + abz * t;
  return { cx, cy, cz, t, d: Math.hypot(px - cx, py - cy, pz - cz) };
}

/** Sphere vs capsule bounce. Returns true on contact. */
export function bounceCapsule(b, ax, ay, az, bx, by, bz, rad, e, extraVel) {
  const c = segClosest(b.x, b.y, b.z, ax, ay, az, bx, by, bz);
  const R = rad + BALL_R;
  if (c.d >= R) return false;
  let nx = (b.x - c.cx), ny = (b.y - c.cy), nz = (b.z - c.cz);
  const d = c.d || 1e-6;
  nx /= d; ny /= d; nz /= d;
  if (c.d < 1e-6) { nx = 0; ny = 0; nz = 1; }
  b.x = c.cx + nx * R; b.y = Math.max(BALL_R, c.cy + ny * R); b.z = c.cz + nz * R;
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
  }
  if (extraVel) { b.vx += extraVel.x; b.vy += extraVel.y; }
  b.spin *= 0.3;
  return { t: c.t, speed: Math.abs(vn) };
}

/** Goal frame & net. Returns 'post' | 'bar' | null on woodwork contact. */
export function collideGoal(b) {
  let hit = null;
  const pr = POST_R, px = HALF_W + pr, by = GOAL_H + pr;
  if (bounceCapsule(b, -px, 0, 0, -px, by, 0, pr, 0.55)) hit = 'post';
  if (bounceCapsule(b, px, 0, 0, px, by, 0, pr, 0.55)) hit = 'post';
  if (bounceCapsule(b, -px, by, 0, px, by, 0, pr, 0.55)) hit = hit || 'bar';
  // Net (only when ball is inside the goal volume)
  if (b.z < 0 && b.z > NET_BACK_Z - 0.5 && Math.abs(b.x) < HALF_W + 0.3 && b.y < GOAL_H + 0.3) {
    const inside = Math.abs(b.x) < HALF_W && b.y < GOAL_H;
    if (inside || b._inGoal) {
      b._inGoal = true;
      const lim = HALF_W - BALL_R;
      if (b.x > lim) { b.x = lim; b.vx = -Math.abs(b.vx) * 0.15; b.vz *= 0.6; }
      if (b.x < -lim) { b.x = -lim; b.vx = Math.abs(b.vx) * 0.15; b.vz *= 0.6; }
      if (b.y > GOAL_H - BALL_R) { b.y = GOAL_H - BALL_R; b.vy = -Math.abs(b.vy) * 0.1; b.vz *= 0.7; }
      const backZ = NET_BACK_Z + (b.y / GOAL_H) * (NET_TOP_Z - NET_BACK_Z) + BALL_R;
      if (b.z < backZ) {
        b.z = backZ;
        b.vz = Math.abs(b.vz) * 0.08; b.vx *= 0.35; b.vy *= 0.4; b.spin = 0;
        b._netHit = true;
      }
    }
  }
  return hit;
}

// ---------------------------------------------------------------------------
// Goalkeeper. Modelled as a body capsule + two arm capsules in the plane z = KEEPER_Z,
// posed by centre (cx, cy), lean angle `ang` (0 = upright, + = leaning right) and arm raise.

export const KEEPER_SKILL = {
  easy:   { react: 0.30, err: 0.95, shift: 1.70, speed: 0.80, catchSp: 14 },
  medium: { react: 0.20, err: 0.60, shift: 2.05, speed: 1.00, catchSp: 17 },
  hard:   { react: 0.12, err: 0.32, shift: 2.35, speed: 1.15, catchSp: 20 },
  legend: { react: 0.08, err: 0.20, shift: 2.50, speed: 1.25, catchSp: 22 },
  player: { react: 0.00, err: 0.00, shift: 2.40, speed: 1.20, catchSp: 18 },
};

export class Keeper {
  constructor(skill = KEEPER_SKILL.medium, colors = {}) {
    this.skill = skill;
    this.colors = { shirt: '#f5e13b', trim: '#1a1a1a', shorts: '#1a1a1a', glove: '#ffffff', skin: '#e0ac7e', ...colors };
    this.z = KEEPER_Z;
    this.reset(0);
  }
  reset(x0 = 0) {
    this.x0 = x0;
    this.cx = x0; this.cy = 1.0; this.ang = 0; this.arm = 0;
    this.state = 'ready'; this.t = 0; this.plannedAt = -1; this.target = null;
    this.holding = false; this.legPhase = 0;
  }
  /** Schedule a dive at T after `delay` seconds. */
  plan(T, delay) { this.target = T; this.plannedAt = delay; this.t = 0; this.state = 'waiting'; }
  dive(T) {
    if (this.state === 'diving' || this.state === 'down') return;
    this.target = T;
    const s = this.skill;
    const dx = T.x - this.x0, ty = T.y;
    let end;
    if (Math.abs(dx) < 0.75) {
      end = {
        cx: this.x0 + dx * 0.75,
        cy: ty > 1.6 ? clamp(ty - 0.6, 1.0, 1.5) : ty < 0.5 ? 0.82 : 0.95,
        ang: clamp(dx * 0.45, -0.4, 0.4),
        arm: ty > 1.4 ? 1 : 0.25,
      };
    } else {
      const ang = clamp(Math.atan2(dx, ty + 0.35), -1.5, 1.5);
      const reach = 1.05;
      let cx = T.x - Math.sin(ang) * reach;
      let cy = ty - Math.cos(ang) * reach;
      // limit how far the centre of mass can travel
      const ox = cx - this.x0, oy = cy - 1.0;
      const m = Math.hypot(ox, oy);
      if (m > s.shift) { cx = this.x0 + ox * s.shift / m; cy = 1.0 + oy * s.shift / m; }
      cy = clamp(cy, 0.3, 1.6);
      end = { cx, cy, ang, arm: 1 };
    }
    const travel = Math.hypot(end.cx - this.cx, end.cy - this.cy);
    this.from = { cx: this.cx, cy: this.cy, ang: this.ang, arm: this.arm };
    this.to = end;
    this.dur = (0.16 + 0.24 * travel / 2.3) / s.speed;
    this.t = 0;
    this.state = 'diving';
  }
  update(dt, time) {
    this.t += dt;
    if (this.state === 'ready') {
      this.cx = this.x0 + Math.sin(time * 2.2) * 0.18;
      this.cy = 1.0 + Math.abs(Math.sin(time * 4.4)) * 0.04;
      this.legPhase = time * 4.4;
    } else if (this.state === 'waiting') {
      if (this.t >= this.plannedAt) this.dive(this.target);
    } else if (this.state === 'diving') {
      const p = clamp(this.t / this.dur, 0, 1);
      const e = 1 - Math.pow(1 - p, 2.4);
      const a = this.from, b = this.to;
      this.cx = a.cx + (b.cx - a.cx) * e;
      this.cy = a.cy + (b.cy - a.cy) * e + Math.sin(p * Math.PI) * 0.12 * Math.abs(b.ang);
      this.ang = a.ang + (b.ang - a.ang) * e;
      this.arm = a.arm + (b.arm - a.arm) * Math.min(1, p * 2);
      if (p >= 1) { this.state = 'down'; this.t = 0; }
    } else if (this.state === 'down') {
      // fall to the ground after a full-stretch dive
      if (Math.abs(this.ang) > 0.7) {
        const floor = 0.28 + (1 - Math.abs(Math.sin(this.ang))) * 0.6;
        this.cy += (floor - this.cy) * Math.min(1, dt * 6);
      }
    }
  }
  /** World-space point from local body coordinates (lx = sideways, ly = along body). */
  local(lx, ly) {
    const s = Math.sin(this.ang), c = Math.cos(this.ang);
    return [this.cx + c * lx + s * ly, this.cy - s * lx + c * ly];
  }
  pose() {
    const a = this.arm;
    const handL = [-0.62 + 0.5 * a, 0.12 + 0.95 * a];
    const handR = [0.62 - 0.5 * a, 0.12 + 0.95 * a];
    const swing = this.state === 'ready' ? Math.sin(this.legPhase) * 0.04 : 0;
    return {
      head: this.local(0, 0.7),
      neck: this.local(0, 0.52),
      hip: this.local(0, -0.06),
      shL: this.local(-0.2, 0.44), shR: this.local(0.2, 0.44),
      hL: this.local(...handL), hR: this.local(...handR),
      kneeL: this.local(-0.2 - swing, -0.5), kneeR: this.local(0.2 + swing, -0.5),
      footL: this.local(-0.26, -0.92), footR: this.local(0.26, -0.92),
      hipL: this.local(-0.12, -0.08), hipR: this.local(0.12, -0.08),
    };
  }
  /** Ball collision. Returns contact info or null. */
  collide(b) {
    if (Math.abs(b.z - this.z) > 0.6) return null;
    const P = this.pose(), z = this.z;
    const vel = this.state === 'diving' ? { x: (this.to.cx - this.from.cx) * 0.5, y: 0 } : null;
    const body = this.local(0, -0.9), top = this.local(0, 0.62);
    let hit = bounceCapsule(b, body[0], body[1], z, top[0], top[1], z, 0.21, 0.35, vel);
    let part = 'body';
    for (const [sh, h] of [[P.shL, P.hL], [P.shR, P.hR]]) {
      const r = bounceCapsule(b, sh[0], sh[1], z, h[0], h[1], z, 0.1, 0.45, vel);
      if (r) { hit = r; part = 'hand'; }
    }
    if (!hit) return null;
    return { part, speed: hit.speed };
  }
}

// ---------------------------------------------------------------------------
// Defensive wall for free kicks.

export class Wall {
  constructor(ballX, ballZ, count, colors) {
    this.colors = colors;
    this.players = [];
    // aim the wall at the near-post half of the goal
    const side = ballX === 0 ? 1 : Math.sign(ballX);
    const aimX = side * 1.6;
    let dx = aimX - ballX, dz = -ballZ;
    const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const cxw = ballX + dx * 9.15, czw = ballZ + dz * 9.15;
    // perpendicular
    const px = -dz, pz = dx;
    for (let i = 0; i < count; i++) {
      const o = (i - (count - 1) / 2) * 0.58 + side * 0.25;
      this.players.push({ x: cxw + px * o, z: czw + pz * o, h: 0 });
    }
    this.t = -1;
  }
  jump() { this.t = 0; }
  update(dt) {
    if (this.t < 0) return;
    this.t += dt;
    const h = this.t < 0.6 ? Math.sin(Math.PI * this.t / 0.6) * 0.42 : 0;
    for (const p of this.players) p.h = h;
  }
  collide(b) {
    let hit = false;
    for (const p of this.players) {
      if (Math.abs(b.z - p.z) > 0.6) continue;
      if (bounceCapsule(b, p.x, 0.15 + p.h, p.z, p.x, 1.6 + p.h, p.z, 0.24, 0.35)) hit = true;
      if (bounceCapsule(b, p.x, 1.8 + p.h, p.z, p.x, 1.8 + p.h, p.z, 0.12, 0.35)) hit = true;
    }
    return hit;
  }
}
