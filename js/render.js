import { HALF_W, GOAL_H, BALL_R, POST_R, NET_TOP_Z, NET_BACK_Z } from './world.js';

const CROWD_COLORS = ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8', '#ffffff'];

// Icosahedron vertices -> 12 pentagon centres of a classic football.
const PHI = (1 + Math.sqrt(5)) / 2;
const PATCHES = [];
for (const [a, b] of [[1, PHI], [-1, PHI], [1, -PHI], [-1, -PHI]]) {
  PATCHES.push([0, a, b], [a, b, 0], [b, 0, a]);
}
for (const p of PATCHES) { const l = Math.hypot(...p); p[0] /= l; p[1] /= l; p[2] /= l; }

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.cam = { x: 0, y: 1.9, z: 16.2, fx: 0, fz: -1, f: 600, cx: 0, hy: 0 };
    this.ballDist = 5.2;
    this.crowd = [];
    for (let i = 0; i < 6000; i++) {
      this.crowd.push({ u: Math.random() * 2 - 1, v: Math.pow(Math.random(), 0.8), c: CROWD_COLORS[(Math.random() * CROWD_COLORS.length) | 0] });
    }
    this.dirty = true;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth; this.H = window.innerHeight;
    for (const c of [this.cv, this.bg]) { c.width = Math.round(this.W * dpr); c.height = Math.round(this.H * dpr); }
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.layout();
  }

  /** Place the camera at (x,y,z) looking horizontally towards (lookX, lookZ). */
  setCamera(x, y, z, lookX = 0, lookZ = 0, ballDist = 5.2) {
    const fx = lookX - x, fz = lookZ - z, L = Math.hypot(fx, fz) || 1;
    Object.assign(this.cam, { x, y, z, fx: fx / L, fz: fz / L });
    this.ballDist = ballDist;
    this.layout();
  }

  layout() {
    const c = this.cam, W = this.W, H = this.H;
    const landscape = W > H;
    c.f = landscape ? H * 1.35 : Math.min(W * 1.75, H * 1.05);
    c.cx = W / 2;
    c.hy = H * (landscape ? 0.8 : 0.74) - c.y * c.f / this.ballDist;
    this.dirty = true;
  }

  /** World -> camera space [right, up, depth]. */
  C(x, y, z) {
    const c = this.cam, dx = x - c.x, dz = z - c.z;
    return [-dx * c.fz + dz * c.fx, y - c.y, dx * c.fx + dz * c.fz];
  }

  P(x, y, z) {
    const c = this.cam, q = this.C(x, y, z), s = c.f / Math.max(0.05, q[2]);
    return [c.cx + q[0] * s, c.hy - q[1] * s, s];
  }

  /** Screen point -> world point on the plane z = zp. */
  unproject(sx, sy, zp) {
    const c = this.cam, u = (sx - c.cx) / c.f, v = -(sy - c.hy) / c.f;
    const dx = c.fx - c.fz * u, dz = c.fz + c.fx * u;
    const t = (zp - c.z) / (Math.abs(dz) < 1e-4 ? -1e-4 : dz);
    return { x: c.x + dx * t, y: c.y + v * t };
  }

  /** Fill a world-space polygon, clipped against the near plane. */
  poly(g, pts) {
    const near = 0.3, c = this.cam;
    const cam = pts.map((p) => this.C(p[0], p[1], p[2]));
    const out = [];
    for (let i = 0; i < cam.length; i++) {
      const a = cam[i], b = cam[(i + 1) % cam.length];
      const ain = a[2] >= near, bin = b[2] >= near;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (near - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
      }
    }
    if (out.length < 3) return;
    g.beginPath();
    out.forEach((q, i) => { const s = c.f / q[2], X = c.cx + q[0] * s, Y = c.hy - q[1] * s; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.closePath(); g.fill();
  }

  // ---------------- static background (redrawn only when camera moves) -------------
  drawBackground() {
    const g = this.bg.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.W, H = this.H, c = this.cam;
    const P = (x, y, z) => this.P(x, y, z);

    // sky
    const sky = g.createLinearGradient(0, 0, 0, c.hy);
    sky.addColorStop(0, '#050b1f'); sky.addColorStop(1, '#1b3159');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    // stands (sloped plane behind the goal)
    const s1 = P(-90, 1.4, -10), s3 = P(90, 34, -60);
    const st = g.createLinearGradient(0, s3[1], 0, s1[1]);
    st.addColorStop(0, '#0d1424'); st.addColorStop(1, '#232c40');
    g.fillStyle = st;
    this.poly(g, [[-90, 0, -10], [90, 0, -10], [90, 34, -60], [-90, 34, -60]]);
    for (const p of this.crowd) {
      const z = -10 - p.v * 50, y = 1.4 + p.v * 32.6, x = p.u * 90;
      const q = P(x, y, z);
      if (q[0] < -5 || q[0] > W + 5) continue;
      const r = Math.max(0.5, q[2] * 0.12);
      g.fillStyle = p.c;
      g.globalAlpha = 0.35 + 0.4 * (1 - p.v);
      g.fillRect(q[0] - r, q[1] - r, r * 2, r * 2.6);
      g.fillStyle = '#e8c4a0';
      g.fillRect(q[0] - r * 0.6, q[1] - r * 2.2, r * 1.2, r * 1.2);
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let v = 0.25; v < 1; v += 0.25) {
      const a = P(-90, 1.4 + v * 32.6, -10 - v * 50), b = P(90, 1.4 + v * 32.6, -10 - v * 50);
      g.lineWidth = Math.max(1, a[2] * 0.4);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }

    // floodlight glow
    for (const fx of [-0.15, 1.15]) {
      const gx = W * fx, gy = Math.min(c.hy * 0.2, 80);
      const gr = g.createRadialGradient(gx, gy, 0, gx, gy, W * 0.6);
      gr.addColorStop(0, 'rgba(255,255,230,0.35)'); gr.addColorStop(1, 'rgba(255,255,230,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }

    // pitch with mowing stripes
    g.fillStyle = '#2f8a3b';
    this.poly(g, [[-90, 0, -10], [90, 0, -10], [90, 0, 80], [-90, 0, 80]]);
    g.fillStyle = '#358f41';
    for (let z = -10; z < 80; z += 8) this.poly(g, [[-90, 0, z], [90, 0, z], [90, 0, z + 4], [-90, 0, z + 4]]);
    const top = P(0, 0, -10)[1];
    const vg = g.createLinearGradient(0, top, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0.22)'); vg.addColorStop(0.3, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = vg; g.fillRect(0, Math.min(top, c.hy), W, H);

    // advertising boards
    const adZ = -7.5;
    const boards = ['JJ FOOTBALL', 'SHOOT!', 'GOAL CUP', 'JJ FOOTBALL', 'TOP BINS', 'PLAY FAIR'];
    const bcol = ['#0b5ed7', '#d63384', '#198754', '#fd7e14', '#6f42c1', '#dc3545'];
    for (let i = -8; i < 8; i++) {
      const x0 = i * 7, x1 = x0 + 7, k = (i + 80) % boards.length;
      g.fillStyle = bcol[k];
      this.poly(g, [[x0, 0.95, adZ], [x1, 0.95, adZ], [x1, 0, adZ], [x0, 0, adZ]]);
      const A = P(x0, 0.95, adZ), B = P(x1, 0.95, adZ), D = P(x0, 0, adZ);
      if (B[0] < 0 || A[0] > W) continue;
      // affine map: board units (7 x 0.95) -> screen
      g.save();
      g.transform((B[0] - A[0]) / 7, (B[1] - A[1]) / 7, (D[0] - A[0]) / 0.95, (D[1] - A[1]) / 0.95, A[0], A[1]);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.font = '900 italic 0.55px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(boards[k], 3.5, 0.5);
      g.restore();
    }

    // pitch markings
    g.fillStyle = 'rgba(255,255,255,0.88)';
    const lw = 0.12;
    const line = (x1, z1, x2, z2) => {
      const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L * lw / 2, nz = dx / L * lw / 2;
      this.poly(g, [[x1 + nx, 0, z1 + nz], [x2 + nx, 0, z2 + nz], [x2 - nx, 0, z2 - nz], [x1 - nx, 0, z1 - nz]]);
    };
    line(-45, 0, 45, 0);
    line(-9.16, 0, -9.16, 5.5); line(9.16, 0, 9.16, 5.5); line(-9.16, 5.5, 9.16, 5.5);
    line(-20.16, 0, -20.16, 16.5); line(20.16, 0, 20.16, 16.5); line(-20.16, 16.5, 20.16, 16.5);
    // penalty arc ("D")
    const ac = Math.acos(5.5 / 9.15);
    let prev = null;
    for (let i = 0; i <= 24; i++) {
      const a = -ac + (2 * ac * i) / 24;
      const pt = [Math.sin(a) * 9.15, 11 + Math.cos(a) * 9.15];
      if (prev) line(prev[0], prev[1], pt[0], pt[1]);
      prev = pt;
    }
    // penalty spot
    const spot = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; spot.push([Math.cos(a) * 0.15, 0, 11 + Math.sin(a) * 0.15]); }
    this.poly(g, spot);

    this.drawNet(g);
    this.dirty = false;
  }

  drawNet(g) {
    const P = (x, y, z) => this.P(x, y, z);
    const w = HALF_W;
    const backZ = (y) => NET_BACK_Z + (y / GOAL_H) * (NET_TOP_Z - NET_BACK_Z);
    // shaded net volume
    g.fillStyle = 'rgba(10,20,10,0.25)';
    const q = [P(-w, GOAL_H, NET_TOP_Z), P(w, GOAL_H, NET_TOP_Z), P(w, 0, NET_BACK_Z), P(-w, 0, NET_BACK_Z)];
    g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) g.lineTo(p[0], p[1]); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 1;
    const seg = (a, b) => { const A = P(...a), B = P(...b); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); };
    g.beginPath();
    const step = 0.3;
    // back net verticals & horizontals
    for (let x = -w; x <= w + 1e-6; x += step) seg([x, GOAL_H, NET_TOP_Z], [x, 0, NET_BACK_Z]);
    for (let y = 0; y <= GOAL_H + 1e-6; y += step) seg([-w, y, backZ(y)], [w, y, backZ(y)]);
    // top net
    for (let x = -w; x <= w + 1e-6; x += step) seg([x, GOAL_H, 0], [x, GOAL_H, NET_TOP_Z]);
    for (let z = 0; z >= NET_TOP_Z - 1e-6; z -= step) seg([-w, GOAL_H, z], [w, GOAL_H, z]);
    // side nets
    for (const sx of [-w, w]) {
      for (let y = 0; y <= GOAL_H + 1e-6; y += step) seg([sx, y, 0], [sx, y, backZ(y)]);
      for (let z = 0; z >= NET_BACK_Z - 1e-6; z -= step) {
        const ytop = z >= NET_TOP_Z ? GOAL_H : GOAL_H * (z - NET_BACK_Z) / (NET_TOP_Z - NET_BACK_Z);
        seg([sx, 0, z], [sx, ytop, z]);
      }
    }
    g.stroke();
    // frame supports
    g.strokeStyle = 'rgba(230,230,230,0.9)'; g.lineWidth = 2;
    g.beginPath();
    seg([-w, GOAL_H, NET_TOP_Z], [-w, 0, NET_BACK_Z]); seg([w, GOAL_H, NET_TOP_Z], [w, 0, NET_BACK_Z]);
    seg([-w, GOAL_H, NET_TOP_Z], [w, GOAL_H, NET_TOP_Z]);
    g.stroke();
  }

  // ---------------- per-frame ----------------
  draw(state) {
    if (this.dirty) this.drawBackground();
    const g = this.ctx, W = this.W, H = this.H;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.bg, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (state.shake > 0) g.translate((Math.random() - 0.5) * state.shake * 14, (Math.random() - 0.5) * state.shake * 14);

    const b = state.ball;
    // ball shadow first (on grass)
    {
      const p = this.P(b.x, 0, b.z);
      const a = Math.max(0, 0.45 - b.y * 0.08);
      if (a > 0 && this.C(b.x, 0, b.z)[2] > 0.3) {
        g.fillStyle = `rgba(0,0,0,${a})`;
        g.beginPath(); g.ellipse(p[0] + 2, p[1], BALL_R * 1.2 * p[2], BALL_R * 0.35 * p[2], 0, 0, Math.PI * 2); g.fill();
      }
    }

    const items = [];
    const add = (x, z, draw) => items.push({ d: this.C(x, 0, z)[2], draw });
    add(0, 0, () => this.drawFrame(g));
    for (const t of state.targets) add(t.x, 0.03, () => this.drawTarget(g, t));
    if (state.keeper) {
      const k = state.keeper;
      if (state.keeperMarker) add(state.keeperMarker.x, k.z + 0.01, () => this.drawMarker(g, state.keeperMarker, k.z));
      add(k.cx, k.z, () => this.drawKeeper(g, k));
    }
    if (state.wall) for (const p of state.wall.players) add(p.x, p.z, () => this.drawWallPlayer(g, p, state.wall.colors));
    if (state.shooter) add(state.shooter.x, state.shooter.z, () => this.drawShooter(g, state.shooter));
    add(b.x, b.z + (b._inGoal ? 0 : 0.05), () => this.drawBall(g, b, state.trail));
    items.sort((a, c) => c.d - a.d);
    for (const it of items) it.draw();

    if (state.aimGuide) this.drawAimGuide(g, state.aimGuide);
    if (state.swipe && state.swipe.pts.length > 1) this.drawSwipe(g, state.swipe.pts);
    for (const p of state.particles) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.r);
      g.fillStyle = p.c; g.globalAlpha = Math.min(1, p.life);
      g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    g.globalAlpha = 1;
    if (state.flash > 0) { g.fillStyle = `rgba(255,255,255,${state.flash * 0.5})`; g.fillRect(-20, -20, W + 40, H + 40); }
  }

  drawFrame(g) {
    const px = HALF_W + POST_R, top = GOAL_H + POST_R * 2;
    const post = (x) => {
      const a = this.P(x - POST_R, top, 0), b = this.P(x + POST_R, 0, 0);
      const gr = g.createLinearGradient(a[0], 0, b[0], 0);
      gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(0.4, '#ffffff'); gr.addColorStop(1, '#b8b8b8');
      g.fillStyle = gr; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    };
    post(-px); post(px);
    const a = this.P(-px - POST_R, top, 0), b = this.P(px + POST_R, GOAL_H, 0);
    const gr = g.createLinearGradient(0, a[1], 0, b[1]);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c4c4c4');
    g.fillStyle = gr; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  }

  drawBall(g, b, trail) {
    if (trail && trail.length) {
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i], p = this.P(t.x, t.y, t.z);
        g.fillStyle = `rgba(255,255,255,${(i / trail.length) * 0.25})`;
        g.beginPath(); g.arc(p[0], p[1], BALL_R * p[2] * (0.4 + 0.6 * i / trail.length), 0, Math.PI * 2); g.fill();
      }
    }
    const p = this.P(b.x, b.y, b.z);
    const r = Math.max(1.5, BALL_R * p[2]);
    const gr = g.createRadialGradient(p[0] - r * 0.35, p[1] - r * 0.4, r * 0.1, p[0], p[1], r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#e9e9e9'); gr.addColorStop(1, '#9a9a9a');
    g.fillStyle = gr;
    g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
    if (r > 3) {
      const ca = Math.cos(b.rotA), sa = Math.sin(b.rotA), cb = Math.cos(b.rotB), sb = Math.sin(b.rotB);
      g.fillStyle = '#1d1d1d';
      for (const v of PATCHES) {
        // rotate about x (roll) then y (spin)
        let y = v[1] * ca - v[2] * sa, z = v[1] * sa + v[2] * ca, x = v[0];
        const x2 = x * cb + z * sb; z = -x * sb + z * cb; x = x2;
        if (z <= 0.05) continue;
        const pr = r * 0.3 * z;
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + b.rotB;
          const qx = p[0] + x * r * 0.85 + Math.cos(a) * pr, qy = p[1] - y * r * 0.85 + Math.sin(a) * pr * (0.6 + 0.4 * z);
          k ? g.lineTo(qx, qy) : g.moveTo(qx, qy);
        }
        g.fill();
      }
    }
  }

  drawTarget(g, t) {
    const p = this.P(t.x, t.y, 0.03), r = t.r * p[2];
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.04;
    g.save();
    g.globalAlpha = t.hit ? Math.max(0, t.fade) : 0.92;
    const rings = ['#ff3b3b', '#ffffff', '#ff3b3b', '#ffffff'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = rings[i];
      g.beginPath(); g.arc(p[0], p[1], r * pulse * (1 - i * 0.24), 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#111'; g.font = `900 ${Math.max(9, r * 0.55)}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t.pts, p[0], p[1] + 1);
    g.restore();
  }

  drawMarker(g, m, z) {
    const p = this.P(m.x, m.y, z), r = 0.35 * p[2];
    g.strokeStyle = 'rgba(255,230,80,0.95)'; g.lineWidth = 3;
    g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(p[0] - r * 1.4, p[1]); g.lineTo(p[0] + r * 1.4, p[1]); g.moveTo(p[0], p[1] - r * 1.4); g.lineTo(p[0], p[1] + r * 1.4); g.stroke();
  }

  limb(g, a, b, w, color) {
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }

  drawKeeper(g, k) {
    const P = k.pose(), z = k.z;
    const pr = (pt) => this.P(pt[0], pt[1], z);
    const s = this.P(k.cx, k.cy, z)[2];
    const c = k.colors;
    const q = {}; for (const key in P) q[key] = pr(P[key]);
    // shadow
    const sh = this.P(k.cx, 0, z);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(sh[0], sh[1], 0.6 * s, 0.12 * s, 0, 0, Math.PI * 2); g.fill();
    // legs
    this.limb(g, q.hipL, q.kneeL, 0.17 * s, c.shorts);
    this.limb(g, q.hipR, q.kneeR, 0.17 * s, c.shorts);
    this.limb(g, q.kneeL, q.footL, 0.13 * s, '#111');
    this.limb(g, q.kneeR, q.footR, 0.13 * s, '#111');
    // torso
    this.limb(g, q.hip, q.neck, 0.42 * s, c.shirt);
    this.limb(g, q.hipL, q.hipR, 0.22 * s, c.shorts);
    // arms
    this.limb(g, q.shL, q.hL, 0.13 * s, c.shirt);
    this.limb(g, q.shR, q.hR, 0.13 * s, c.shirt);
    // number stripe
    this.limb(g, pr(k.local(-0.12, 0.25)), pr(k.local(0.12, 0.25)), 0.05 * s, c.trim);
    // gloves
    for (const h of [q.hL, q.hR]) {
      g.fillStyle = c.glove; g.beginPath(); g.arc(h[0], h[1], 0.11 * s, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(1, 0.02 * s); g.stroke();
    }
    // head
    g.fillStyle = c.skin; g.beginPath(); g.arc(q.head[0], q.head[1], 0.12 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b1a0e'; g.beginPath(); g.arc(q.head[0], q.head[1] - 0.03 * s, 0.12 * s, Math.PI * 1.05 - k.ang, Math.PI * 1.95 - k.ang); g.fill();
  }

  drawWallPlayer(g, p, c) {
    const P = (x, y) => this.P(x, y, p.z);
    const s = P(p.x, 1)[2], h = p.h, x = p.x;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    const sh = P(x, 0); g.beginPath(); g.ellipse(sh[0], sh[1], 0.35 * s, 0.08 * s, 0, 0, Math.PI * 2); g.fill();
    this.limb(g, P(x - 0.1, 0.9 + h), P(x - 0.12, 0.12 + h), 0.15 * s, c.socks);
    this.limb(g, P(x + 0.1, 0.9 + h), P(x + 0.12, 0.12 + h), 0.15 * s, c.socks);
    this.limb(g, P(x - 0.1, 0.95 + h), P(x + 0.1, 0.95 + h), 0.26 * s, c.shorts);
    this.limb(g, P(x, 1.0 + h), P(x, 1.45 + h), 0.44 * s, c.shirt);
    // arms crossed in front
    this.limb(g, P(x - 0.22, 1.4 + h), P(x - 0.08, 0.95 + h), 0.12 * s, c.shirt);
    this.limb(g, P(x + 0.22, 1.4 + h), P(x + 0.08, 0.95 + h), 0.12 * s, c.shirt);
    const hd = P(x, 1.72 + h);
    g.fillStyle = '#d9a17a'; g.beginPath(); g.arc(hd[0], hd[1], 0.12 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b1a0e'; g.beginPath(); g.arc(hd[0], hd[1] - 0.03 * s, 0.12 * s, Math.PI, 0); g.fill();
  }

  drawShooter(g, sh) {
    const c = sh.colors;
    const x = sh.x, z = sh.z, ph = sh.phase, k = sh.kick;
    const P = (dx, y, dz = 0) => this.P(x + dx, y, z + dz);
    const s = P(0, 1)[2];
    const shp = P(0, 0); g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(shp[0], shp[1], 0.4 * s, 0.1 * s, 0, 0, Math.PI * 2); g.fill();
    const run = Math.sin(ph) * (1 - k);
    // legs (back view): stride shown as vertical foot offset; kick leg (right) swings forward
    const lf = P(-0.14, 0.08 + Math.max(0, run) * 0.25, 0);
    const rf = k > 0 ? P(0.18, 0.15 + k * 0.35, -0.6 * k) : P(0.14, 0.08 + Math.max(0, -run) * 0.25, 0);
    this.limb(g, P(-0.1, 0.92), lf, 0.15 * s, c.socks);
    this.limb(g, P(0.1, 0.92), rf, 0.15 * s, c.socks);
    this.limb(g, P(-0.11, 0.95), P(0.11, 0.95), 0.27 * s, c.shorts);
    this.limb(g, P(0, 1.0), P(0, 1.45), 0.46 * s, c.shirt);
    this.limb(g, P(-0.24, 1.42), P(-0.32 - k * 0.2, 1.05 + run * 0.12 + k * 0.3), 0.12 * s, c.shirt);
    this.limb(g, P(0.24, 1.42), P(0.32 + k * 0.1, 1.05 - run * 0.12), 0.12 * s, c.shirt);
    g.fillStyle = '#ffffff'; g.font = `900 ${0.28 * s}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = P(0, 1.25); g.fillText(sh.number || '9', n[0], n[1]);
    const hd = P(0, 1.7);
    g.fillStyle = '#2b1a0e'; g.beginPath(); g.arc(hd[0], hd[1], 0.12 * s, 0, Math.PI * 2); g.fill();
  }

  drawSwipe(g, pts) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : 'rgba(80,200,255,0.35)';
      g.lineWidth = pass ? 4 : 14;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.stroke();
    }
  }

  drawAimGuide(g, a) {
    const p = this.P(a.x, a.y, a.z);
    const t = performance.now() / 500;
    g.strokeStyle = `rgba(255,255,255,${0.35 + Math.sin(t * 3) * 0.2})`;
    g.lineWidth = 2;
    g.setLineDash([6, 6]);
    g.beginPath(); g.arc(p[0], p[1], BALL_R * p[2] * 2.2, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }
}
