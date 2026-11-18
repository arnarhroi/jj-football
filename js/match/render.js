// Top-down match renderer with a camera that follows the ball.
import { HW, HL, GW } from './engine.js';

// players and ball are drawn larger than life so they read well on a phone
const SPRITE = 1.7;

export class MatchRenderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = 0; this.camY = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    // metres -> pixels: show roughly 36 m across the short side of the screen
    this.s = Math.min(this.W, this.H) / (this.W > this.H ? 34 : 27);
  }

  sx(x) { return this.W / 2 + (x - this.camX) * this.s; }
  sy(y) { return this.H / 2 + (y - this.camY) * this.s; }
  toWorld(px, py) { return { x: (px - this.W / 2) / this.s + this.camX, y: (py - this.H / 2) / this.s + this.camY }; }

  follow(m, dt, snap = false) {
    const b = m.ball;
    // look a little ahead in the direction of play
    const tx = b.x + b.vx * 0.25;
    const ty = b.y + b.vy * 0.25 + (m.poss?.dir ?? 0) * 4;
    const k = snap ? 1 : Math.min(1, dt * 3.5);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    const hw = this.W / 2 / this.s, hh = this.H / 2 / this.s;
    const mx = Math.max(0, HW + 4 - hw), my = Math.max(0, HL + 6 - hh);
    this.camX = Math.max(-mx, Math.min(mx, this.camX));
    this.camY = Math.max(-my, Math.min(my, this.camY));
  }

  draw(m, ui) {
    const g = this.ctx, s = this.s;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // surroundings
    g.fillStyle = '#1f5f2a'; g.fillRect(0, 0, this.W, this.H);
    // pitch stripes
    const stripe = 105 / 14;
    for (let i = 0; i < 14; i++) {
      const y0 = -HL + i * stripe;
      g.fillStyle = i % 2 ? '#2f8a3b' : '#348f40';
      g.fillRect(this.sx(-HW - 3), this.sy(y0), (HW * 2 + 6) * s, stripe * s + 1);
    }
    this.drawLines(g);
    this.drawGoal(g, -1); this.drawGoal(g, 1);

    // pass helpers: highlight team-mates you can tap
    const b = m.ball, user = m.teams[0];
    const userBall = b.owner && b.owner.team === user;
    // shadows
    for (const p of m.all) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(this.sx(p.x) + 0.25 * s * SPRITE, this.sy(p.y) + 0.3 * s * SPRITE, 0.55 * s * SPRITE, 0.4 * s * SPRITE, 0, 0, Math.PI * 2); g.fill();
    }
    const sorted = [...m.all].sort((a, c) => a.y - c.y);
    for (const p of sorted) {
      if (userBall && p.team === user && p !== b.owner && !p.isGK) this.ring(g, p, 'rgba(255,255,255,0.5)', 1.0 * SPRITE, 2);
      if (p === m.ctrl) this.ring(g, p, '#ffd23f', 1.05 * SPRITE, 3);
      this.drawPlayer(g, p);
    }
    if (m.ctrl) this.drawLabel(g, m.ctrl);
    if (b.owner && b.owner !== m.ctrl) this.drawLabel(g, b.owner, true);
    this.drawBall(g, b);
    if (ui.swipe) this.drawSwipe(g, ui.swipe);
    if (ui.steer) {
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.arc(this.sx(ui.steer.x), this.sy(ui.steer.y), 0.8 * s, 0, Math.PI * 2); g.stroke();
    }
    if (ui.tapMark && ui.tapMark.t > 0) {
      g.strokeStyle = `rgba(255,210,63,${ui.tapMark.t})`; g.lineWidth = 3;
      g.beginPath(); g.arc(this.sx(ui.tapMark.x), this.sy(ui.tapMark.y), (1.6 - ui.tapMark.t) * s, 0, Math.PI * 2); g.stroke();
    }
    this.drawRadar(g, m);
  }

  drawLines(g) {
    const s = this.s, X = (x) => this.sx(x), Y = (y) => this.sy(y);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1.5, 0.12 * s);
    g.strokeRect(X(-HW), Y(-HL), HW * 2 * s, HL * 2 * s);
    g.beginPath(); g.moveTo(X(-HW), Y(0)); g.lineTo(X(HW), Y(0)); g.stroke();
    g.beginPath(); g.arc(X(0), Y(0), 9.15 * s, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const side of [-1, 1]) {
      const gy = side * HL, inw = -side;
      g.strokeRect(X(-20.16), side < 0 ? Y(gy) : Y(gy - 16.5), 40.32 * s, 16.5 * s);
      g.strokeRect(X(-9.16), side < 0 ? Y(gy) : Y(gy - 5.5), 18.32 * s, 5.5 * s);
      const py = gy + inw * 11;
      g.beginPath(); g.arc(X(0), Y(py), 0.22 * s, 0, Math.PI * 2); g.fill();
      // penalty arc
      const a = Math.acos(5.5 / 9.15);
      g.beginPath();
      if (side < 0) g.arc(X(0), Y(py), 9.15 * s, Math.PI / 2 - a, Math.PI / 2 + a);
      else g.arc(X(0), Y(py), 9.15 * s, -Math.PI / 2 - a, -Math.PI / 2 + a);
      g.stroke();
      // corner arcs
      for (const cx of [-HW, HW]) {
        g.beginPath(); g.arc(X(cx), Y(gy), 1 * s, 0, Math.PI * 2); g.stroke();
      }
    }
    g.beginPath(); g.arc(X(0), Y(0), 0.25 * s, 0, Math.PI * 2); g.fill();
  }

  drawGoal(g, side) {
    const s = this.s, gy = side * HL, depth = 2;
    const x0 = this.sx(-GW), x1 = this.sx(GW), y0 = this.sy(gy), y1 = this.sy(gy + side * depth);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0));
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    g.beginPath();
    for (let x = -GW; x <= GW + 0.01; x += 0.6) { g.moveTo(this.sx(x), y0); g.lineTo(this.sx(x), y1); }
    for (let d = 0; d <= depth + 0.01; d += 0.5) { const yy = this.sy(gy + side * d); g.moveTo(x0, yy); g.lineTo(x1, yy); }
    g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(3, 0.25 * s);
    g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1, y1); g.stroke();
  }

  ring(g, p, color, r, w) {
    g.strokeStyle = color; g.lineWidth = w;
    g.beginPath(); g.arc(this.sx(p.x), this.sy(p.y), r * this.s, 0, Math.PI * 2); g.stroke();
  }

  drawPlayer(g, p) {
    const s = this.s * SPRITE, x = this.sx(p.x), y = this.sy(p.y);
    const kit = p.isGK ? p.team.gkKit : p.team.kit;
    g.save();
    g.translate(x, y);
    g.rotate(p.face + Math.PI / 2); // local -y = facing direction
    if (p.slide > 0) g.scale(0.85, 1.25);
    const step = Math.sin(p.anim) * 0.28 * Math.min(1, Math.hypot(p.vx, p.vy) / 3);
    // legs
    g.fillStyle = kit[3];
    g.beginPath(); g.ellipse(-0.17 * s, -step * s, 0.12 * s, 0.2 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0.17 * s, step * s, 0.12 * s, 0.2 * s, 0, 0, Math.PI * 2); g.fill();
    // body (shoulders)
    g.fillStyle = kit[0];
    g.beginPath(); g.ellipse(0, 0, 0.48 * s, 0.28 * s, 0, 0, Math.PI * 2); g.fill();
    if (kit[1]) {
      g.save(); g.clip();
      g.fillStyle = kit[1];
      for (let i = -2; i <= 2; i += 2) g.fillRect((i * 0.16 - 0.06) * s, -0.4 * s, 0.13 * s, 0.8 * s);
      g.restore();
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, 0.05 * s);
    g.beginPath(); g.ellipse(0, 0, 0.48 * s, 0.28 * s, 0, 0, Math.PI * 2); g.stroke();
    // arms
    g.fillStyle = kit[0];
    g.beginPath(); g.ellipse(-0.5 * s, step * 0.6 * s, 0.11 * s, 0.17 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0.5 * s, -step * 0.6 * s, 0.11 * s, 0.17 * s, 0, 0, Math.PI * 2); g.fill();
    // head
    g.fillStyle = '#3a2416';
    g.beginPath(); g.arc(0, 0.02 * s, 0.2 * s, 0, Math.PI * 2); g.fill();
    g.restore();
    // shirt number
    if (s > 10) {
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = `800 ${Math.round(0.42 * s)}px system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
      g.strokeText(p.num, x, y + 0.75 * s); g.fillText(p.num, x, y + 0.75 * s);
    }
  }

  drawLabel(g, p, dim) {
    const s = this.s, x = this.sx(p.x), y = this.sy(p.y) - 1.25 * s * SPRITE;
    const name = p.name.split(' ').slice(-1)[0];
    g.font = `800 ${Math.max(11, Math.round(0.5 * s))}px system-ui, sans-serif`;
    const w = g.measureText(name).width + 10;
    g.fillStyle = dim ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.65)';
    g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 9, w, 18, 6) : g.rect(x - w / 2, y - 9, w, 18); g.fill();
    g.fillStyle = dim ? '#ffffff' : '#ffd23f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, x, y + 1);
  }

  drawBall(g, b) {
    const s = this.s * 1.5;
    let bx = b.x, by = b.y;
    if (b.owner) { const f = b.owner.face, o = 0.62 * SPRITE; bx = b.owner.x + Math.cos(f) * o; by = b.owner.y + Math.sin(f) * o; }
    const x = this.sx(bx), y = this.sy(by);
    const h = b.z * s * 0.55;
    g.fillStyle = `rgba(0,0,0,${Math.max(0.12, 0.35 - b.z * 0.04)})`;
    g.beginPath(); g.ellipse(x + 0.1 * s, y + 0.1 * s, 0.24 * s, 0.17 * s, 0, 0, Math.PI * 2); g.fill();
    const r = (0.24 + b.z * 0.025) * s;
    const gr = g.createRadialGradient(x - r * 0.3, y - h - r * 0.3, r * 0.1, x, y - h, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#bdbdbd');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y - h, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222';
    g.beginPath(); g.arc(x, y - h, r * 0.35, 0, Math.PI * 2); g.fill();
  }

  drawSwipe(g, pts) {
    if (pts.length < 2) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : 'rgba(80,200,255,0.35)';
      g.lineWidth = pass ? 4 : 14;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.stroke();
    }
  }

  drawRadar(g, m) {
    const w = 62, h = 96, x0 = this.W - w - 10, y0 = this.H - h - 12 - (this.safeBottom || 0);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    g.strokeRect(x0, y0, w, h);
    g.beginPath(); g.moveTo(x0, y0 + h / 2); g.lineTo(x0 + w, y0 + h / 2); g.stroke();
    const X = (x) => x0 + (x + HW) / (HW * 2) * w, Y = (y) => y0 + (y + HL) / (HL * 2) * h;
    for (const T of m.teams) {
      g.fillStyle = T.user ? '#ffd23f' : '#ff5470';
      for (const p of T.players) { g.beginPath(); g.arc(X(p.x), Y(p.y), 2, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(m.ball.x), Y(m.ball.y), 2.2, 0, Math.PI * 2); g.fill();
    // camera window
    const tl = this.toWorld(0, 0), br = this.toWorld(this.W, this.H);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.strokeRect(X(Math.max(-HW, tl.x)), Y(Math.max(-HL, tl.y)), X(Math.min(HW, br.x)) - X(Math.max(-HW, tl.x)), Y(Math.min(HL, br.y)) - Y(Math.max(-HL, tl.y)));
  }
}
