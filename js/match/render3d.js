// 3D match renderer (Three.js / WebGL). Same interface as the 2D MatchRenderer:
//   resize(), follow(match, dt, snap), draw(match, ui), toWorld(px, py), tapPoint(px, py, match), W, H
// Engine coordinates (x across, y along the pitch, z height) map to Three.js as (x, z, y).
import * as THREE from '../vendor/three.module.min.js';
import { HW, HL, GW, GH } from './engine.js';

const TEX_PPM = 12.8;             // pitch texture pixels per metre
const AREA_W = 80, AREA_L = 120;  // textured area around the pitch (metres)
const BALL_VIS = 0.11 * 1.5;      // ball radius, a bit larger than life so it reads on a phone
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

export class Match3DRenderer {
  constructor(glCanvas, overlayCanvas) {
    this.gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
    this.ov = overlayCanvas;
    this.octx = overlayCanvas.getContext('2d');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a1630');
    this.scene.fog = new THREE.Fog('#0a1630', 120, 260);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 400);
    this.camPos = new THREE.Vector3(0, 20, 30);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.ray = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmp = new THREE.Vector3();
    this.matCache = new Map();
    this.buildStatic();
    this.buildShared();
    this.resize();
  }

  mat(color) {
    if (!this.matCache.has(color)) this.matCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return this.matCache.get(color);
  }

  // ------------------------------------------------------------------ stadium
  buildStatic() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xe8f0ff, 0x335533, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(25, 60, 15);
    s.add(sun);

    // outer grass
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: '#25652f' }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02;
    s.add(outer);

    // pitch with stripes and markings painted into one texture
    const pitchTex = canvasTex(AREA_W * TEX_PPM, AREA_L * TEX_PPM, (g, w, h) => {
      const X = (x) => (x + AREA_W / 2) * TEX_PPM, Y = (y) => (y + AREA_L / 2) * TEX_PPM;
      g.fillStyle = '#2f8a3b'; g.fillRect(0, 0, w, h);
      const stripe = (HL * 2) / 14;
      for (let i = 0; i < 14; i++) {
        g.fillStyle = i % 2 ? '#2f8a3b' : '#38963f';
        g.fillRect(0, Y(-HL + i * stripe), w, stripe * TEX_PPM + 1);
      }
      // subtle noise so the grass isn't flat
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.035)`;
        g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 0.16 * TEX_PPM;
      g.strokeRect(X(-HW), Y(-HL), HW * 2 * TEX_PPM, HL * 2 * TEX_PPM);
      g.beginPath(); g.moveTo(X(-HW), Y(0)); g.lineTo(X(HW), Y(0)); g.stroke();
      g.beginPath(); g.arc(X(0), Y(0), 9.15 * TEX_PPM, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(X(0), Y(0), 0.3 * TEX_PPM, 0, Math.PI * 2); g.fill();
      for (const side of [-1, 1]) {
        const gy = side * HL;
        const box = (hw, depth) => { const y0 = side < 0 ? gy : gy - depth; g.strokeRect(X(-hw), Y(y0), hw * 2 * TEX_PPM, depth * TEX_PPM); };
        box(20.16, 16.5); box(9.16, 5.5);
        const py = gy - side * 11;
        g.beginPath(); g.arc(X(0), Y(py), 0.25 * TEX_PPM, 0, Math.PI * 2); g.fill();
        const a = Math.acos(5.5 / 9.15);
        g.beginPath();
        if (side < 0) g.arc(X(0), Y(py), 9.15 * TEX_PPM, Math.PI / 2 - a, Math.PI / 2 + a);
        else g.arc(X(0), Y(py), 9.15 * TEX_PPM, -Math.PI / 2 - a, -Math.PI / 2 + a);
        g.stroke();
        for (const cx of [-HW, HW]) { g.beginPath(); g.arc(X(cx), Y(gy), 1 * TEX_PPM, 0, Math.PI * 2); g.stroke(); }
      }
    });
    pitchTex.anisotropy = this.gl.capabilities.getMaxAnisotropy();
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(AREA_W, AREA_L), new THREE.MeshLambertMaterial({ map: pitchTex }));
    pitch.rotation.x = -Math.PI / 2;
    s.add(pitch);

    this.buildGoals();
    this.buildStands();
  }

  buildGoals() {
    const post = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const netTex = canvasTex(64, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
      g.strokeRect(0, 0, w, h);
    }, { repeat: [1, 1] });
    const netMat = (rx, ry) => {
      const t = netTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
      return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    };
    const depth = 2;
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const gy = side * HL;
      const pr = 0.07;
      const upright = new THREE.CylinderGeometry(pr, pr, GH + pr, 10);
      for (const x of [-GW - pr, GW + pr]) {
        const m = new THREE.Mesh(upright, post); m.position.set(x, (GH + pr) / 2, gy); g.add(m);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, GW * 2 + pr * 4, 10), post);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, GH + pr, gy); g.add(bar);
      // nets: back, top, two sides
      const back = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2, GH), netMat(GW * 2 / 0.25, GH / 0.25));
      back.position.set(0, GH / 2, gy + side * depth); g.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2, depth), netMat(GW * 2 / 0.25, depth / 0.25));
      top.rotation.x = Math.PI / 2; top.position.set(0, GH, gy + side * depth / 2); g.add(top);
      for (const x of [-GW, GW]) {
        const sd = new THREE.Mesh(new THREE.PlaneGeometry(depth, GH), netMat(depth / 0.25, GH / 0.25));
        sd.rotation.y = Math.PI / 2; sd.position.set(x, GH / 2, gy + side * depth / 2); g.add(sd);
      }
      this.scene.add(g);
    }
  }

  buildStands() {
    const s = this.scene;
    const crowd = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#1c2436'; g.fillRect(0, 0, w, h);
      const cols = ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#fd79a8', '#ffffff', '#34495e'];
      for (let row = 0; row < 16; row++) {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, row * 16 + 13, w, 3);
        for (let i = 0; i < 64; i++) {
          const x = i * 8 + Math.random() * 2, y = row * 16 + 3 + Math.random() * 2;
          g.fillStyle = cols[(Math.random() * cols.length) | 0];
          g.fillRect(x, y + 4, 6, 7);
          g.fillStyle = '#d9a77f'; g.fillRect(x + 1, y, 4, 4);
        }
      }
    }, { repeat: [1, 1] });
    const standMat = (len, rise) => {
      const t = crowd.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 30, rise / 14);
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const addStand = (len, rise, depth, cx, cz, rotY) => {
      const slope = Math.hypot(rise, depth);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, slope), standMat(len, slope));
      const g = new THREE.Group();
      m.rotation.x = -Math.atan2(depth, rise); // tilt back
      m.position.set(0, rise / 2 + 1.2, -depth / 2);
      g.add(m);
      // front wall
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.2), new THREE.MeshLambertMaterial({ color: '#141b2b' }));
      wall.position.set(0, 0.6, 0); g.add(wall);
      g.position.set(cx, 0, cz); g.rotation.y = rotY;
      s.add(g);
    };
    const gapSide = HW + 9, gapEnd = HL + 9;
    addStand(HL * 2 + 30, 26, 34, gapSide, 0, -Math.PI / 2);   // right touchline
    addStand(HL * 2 + 30, 26, 34, -gapSide, 0, Math.PI / 2);   // left touchline
    addStand(HW * 2 + 40, 24, 30, 0, -gapEnd, 0);              // behind far goal
    addStand(HW * 2 + 40, 24, 30, 0, gapEnd, Math.PI);         // behind near goal

    // advertising boards around the pitch
    const words = ['JJ FOOTBALL', 'SHOOT!', 'GOAL CUP', 'TOP BINS', 'PLAY FAIR'];
    const cols = ['#0b5ed7', '#d63384', '#198754', '#6f42c1', '#fd7e14'];
    const boardTex = canvasTex(1024, 64, (g, w, h) => {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = cols[i]; g.fillRect(i * w / 5, 0, w / 5, h);
        g.fillStyle = '#fff'; g.font = '900 italic 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(words[i], i * w / 5 + w / 10, h / 2 + 2);
      }
    });
    const board = (len, x, z, rotY) => {
      const t = boardTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 35, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), new THREE.MeshBasicMaterial({ map: t }));
      m.position.set(x, 0.45, z); m.rotation.y = rotY;
      s.add(m);
    };
    board(HL * 2 + 6, HW + 4, 0, -Math.PI / 2);
    board(HL * 2 + 6, -HW - 4, 0, Math.PI / 2);
    board(HW * 2 + 8, 0, -HL - 4.5, 0);
    board(HW * 2 + 8, 0, HL + 4.5, Math.PI);

    // floodlight towers
    const pole = new THREE.MeshLambertMaterial({ color: '#7d8597' });
    const lamp = new THREE.MeshBasicMaterial({ color: '#fffbe6' });
    for (const x of [-HW - 22, HW + 22]) {
      for (const z of [-HL - 18, HL + 18]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 42, 8), pole);
        p.position.set(x, 21, z); s.add(p);
        const l = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 1), lamp);
        l.position.set(x * 0.97, 43, z * 0.97); l.lookAt(0, 0, 0); s.add(l);
      }
    }
  }

  // ------------------------------------------------------------------ players & ball
  buildShared() {
    this.geo = {
      torso: new THREE.BoxGeometry(0.46, 0.56, 0.26),
      shorts: new THREE.BoxGeometry(0.42, 0.24, 0.28),
      thigh: new THREE.CylinderGeometry(0.08, 0.065, 0.46, 8),
      shin: new THREE.CylinderGeometry(0.062, 0.05, 0.44, 8),
      boot: new THREE.BoxGeometry(0.1, 0.08, 0.24),
      arm: new THREE.CylinderGeometry(0.058, 0.048, 0.56, 8),
      hand: new THREE.SphereGeometry(0.058, 8, 6),
      glove: new THREE.SphereGeometry(0.085, 8, 6),
      head: new THREE.SphereGeometry(0.125, 14, 10),
      hair: new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      neck: new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8),
      shadow: new THREE.CircleGeometry(0.55, 20),
      ring: new THREE.RingGeometry(0.85, 1.05, 32),
    };
    const shadowTex = canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    this.ringMats = {
      ctrl: new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.95, depthWrite: false }),
      mate: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }),
    };
    this.skins = ['#f1c7a5', '#e0ac7e', '#c68b5e', '#8d5a3b', '#5e3a24'];
    this.hairs = ['#2b1a0e', '#3a2416', '#111111', '#7a4b22', '#c9a46a'];

    // ball
    const ballTex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b1b1b';
      const spots = [[0.1, 0.5], [0.3, 0.2], [0.3, 0.8], [0.5, 0.5], [0.7, 0.2], [0.7, 0.8], [0.9, 0.5], [0.0, 0.05], [0.5, 0.02], [0.5, 0.98]];
      for (const [u, v] of spots) {
        g.beginPath();
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const x = u * w + Math.cos(a) * 14, y = v * h + Math.sin(a) * 12; k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.fill();
      }
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_VIS, 18, 12), new THREE.MeshLambertMaterial({ map: ballTex }));
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(this.geo.shadow, this.shadowMat);
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.scale.setScalar(0.4);
    this.scene.add(this.ballShadow);

    // rings: one for the controlled player, a pool for pass targets
    const flatRing = (mat) => { const r = new THREE.Mesh(this.geo.ring, mat); r.rotation.x = -Math.PI / 2; r.position.y = 0.03; r.renderOrder = 2; this.scene.add(r); return r; };
    this.ctrlRing = flatRing(this.ringMats.ctrl);
    this.mateRings = Array.from({ length: 10 }, () => flatRing(this.ringMats.mate));
    this.steerRing = flatRing(this.ringMats.mate); this.steerRing.scale.setScalar(0.8);
  }

  /** Torso material array: shirt colour/stripes all round, the number on the back. */
  torsoMats(kit, num) {
    const [shirt, stripe] = kit;
    const key = `torso:${shirt}:${stripe}`;
    if (!this.matCache.has(key)) {
      const t = canvasTex(64, 64, (g, w, h) => {
        g.fillStyle = shirt; g.fillRect(0, 0, w, h);
        if (stripe) { g.fillStyle = stripe; for (let x = 6; x < w; x += 20) g.fillRect(x, 0, 9, h); }
      });
      this.matCache.set(key, new THREE.MeshLambertMaterial({ map: t }));
    }
    const side = this.matCache.get(key);
    const backTex = canvasTex(64, 80, (g, w, h) => {
      g.fillStyle = shirt; g.fillRect(0, 0, w, h);
      if (stripe) { g.fillStyle = stripe; for (let x = 6; x < w; x += 20) g.fillRect(x, 0, 9, h); }
      const light = parseInt(shirt.slice(1, 3), 16) + parseInt(shirt.slice(3, 5), 16) + parseInt(shirt.slice(5, 7), 16) > 500;
      g.font = '900 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = light ? '#ffffff' : '#000000'; g.strokeText(num, w / 2, h / 2 + 2);
      g.fillStyle = light ? '#111111' : '#ffffff'; g.fillText(num, w / 2, h / 2 + 2);
    });
    const back = new THREE.MeshLambertMaterial({ map: backTex });
    this.disposables.push(back, backTex);
    // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
    return [side, side, side, side, side, back];
  }

  makePlayer(p) {
    const kit = p.isGK ? p.team.gkKit : p.team.kit;
    const skin = this.skins[(p.num * 7 + p.name.length) % this.skins.length];
    const hair = this.hairs[(p.num * 3 + p.name.length) % this.hairs.length];
    const G = this.geo;
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
    const shorts = new THREE.Mesh(G.shorts, this.mat(kit[2])); shorts.position.y = 0.02; hips.add(shorts);
    const legs = [];
    for (const sx of [1, -1]) {
      const leg = new THREE.Group(); leg.position.set(0.11 * sx, 0, 0); hips.add(leg);
      const thigh = new THREE.Mesh(G.thigh, this.mat(skin)); thigh.position.y = -0.23; leg.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.46; leg.add(knee);
      const shin = new THREE.Mesh(G.shin, this.mat(kit[3])); shin.position.y = -0.22; knee.add(shin);
      const boot = new THREE.Mesh(G.boot, this.mat('#151515')); boot.position.set(0, -0.44, 0.05); knee.add(boot);
      legs.push({ leg, knee });
    }
    const torso = new THREE.Mesh(G.torso, this.torsoMats(kit, String(p.num))); torso.position.y = 1.22; body.add(torso);
    const neck = new THREE.Mesh(G.neck, this.mat(skin)); neck.position.y = 1.53; body.add(neck);
    const head = new THREE.Mesh(G.head, this.mat(skin)); head.position.y = 1.66; body.add(head);
    const hairM = new THREE.Mesh(G.hair, this.mat(hair)); hairM.position.y = 1.675; hairM.rotation.x = -0.25; body.add(hairM);
    const arms = [];
    for (const sx of [1, -1]) {
      const arm = new THREE.Group(); arm.position.set(0.29 * sx, 1.46, 0); arm.rotation.z = 0.12 * sx; body.add(arm);
      const a = new THREE.Mesh(G.arm, this.mat(kit[0])); a.position.y = -0.28; arm.add(a);
      const h = new THREE.Mesh(p.isGK ? G.glove : G.hand, this.mat(p.isGK ? '#f4f4f4' : skin)); h.position.y = -0.58; arm.add(h);
      arms.push(arm);
    }
    const shadow = new THREE.Mesh(G.shadow, this.shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
    this.scene.add(shadow);
    this.playerGroup.add(root);
    return { root, body, legs, arms, shadow, lean: 0, roll: 0, drop: 0 };
  }

  setupMatch(m) {
    if (this.playerGroup) {
      this.scene.remove(this.playerGroup);
      for (const v of this.views.values()) this.scene.remove(v.shadow);
      for (const d of this.disposables) d.dispose();
    }
    this.disposables = [];
    this.playerGroup = new THREE.Group();
    this.scene.add(this.playerGroup);
    this.views = new Map();
    for (const p of m.all) this.views.set(p, this.makePlayer(p));
    this.ballSpin = new THREE.Quaternion();
    this.ball.quaternion.identity();
    this.match = m;
  }

  // ------------------------------------------------------------------ frame
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.gl.setPixelRatio(Math.min(dpr, 1.75));
    this.gl.setSize(this.W, this.H);
    this.ov.width = Math.round(this.W * dpr); this.ov.height = Math.round(this.H * dpr);
    this.ov.style.width = this.W + 'px'; this.ov.style.height = this.H + 'px';
    this.dpr = dpr;
    this.camera.aspect = this.W / this.H;
    this.landscape = this.W > this.H;
    this.camera.fov = this.landscape ? 27 : 58;
    this.camera.updateProjectionMatrix();
  }

  follow(m, dt, snap = false) {
    const b = m.ball;
    let pos, look;
    if (!this.landscape) {
      // behind your team, attacking into the screen
      const by = clamp(b.y + b.vy * 0.2, -HL + 12, HL - 4);
      const bx = clamp(b.x, -HW + 4, HW - 4);
      look = [bx * 0.85, 0, by - 7];
      pos = [bx * 0.6, 17, by + 19];
    } else {
      // TV camera on the touchline
      const bz = clamp(b.y + b.vy * 0.2, -HL + 16, HL - 16);
      look = [clamp(b.x, -HW, HW) * 0.55, 0, bz];
      pos = [HW + 33, 22, bz * 0.92];
    }
    const k = snap ? 1 : Math.min(1, dt * 3);
    this.camPos.set(lerp(this.camPos.x, pos[0], k), lerp(this.camPos.y, pos[1], k), lerp(this.camPos.z, pos[2], k));
    this.camLook.set(lerp(this.camLook.x, look[0], k), lerp(this.camLook.y, look[1], k), lerp(this.camLook.z, look[2], k));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  draw(m, ui) {
    if (m !== this.match) this.setupMatch(m);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - (this.lastT || now)); this.lastT = now;
    const user = m.teams[0], b = m.ball;
    const userBall = b.owner && b.owner.team === user;
    let ri = 0;
    for (const p of m.all) {
      const v = this.views.get(p);
      this.posePlayer(p, v, dt);
      if (userBall && p.team === user && p !== b.owner && !p.isGK && ri < this.mateRings.length) {
        const r = this.mateRings[ri++]; r.visible = true; r.position.set(p.x, 0.03, p.y);
      }
    }
    for (; ri < this.mateRings.length; ri++) this.mateRings[ri].visible = false;
    if (m.ctrl) { this.ctrlRing.visible = true; this.ctrlRing.position.set(m.ctrl.x, 0.035, m.ctrl.y); } else this.ctrlRing.visible = false;
    if (ui.steer) { this.steerRing.visible = true; this.steerRing.position.set(ui.steer.x, 0.03, ui.steer.y); } else this.steerRing.visible = false;

    // ball: position, roll, shadow
    this.ball.position.set(b.x, b.z + BALL_VIS, b.y);
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0.05) {
      this.tmp.set(b.vy, 0, -b.vx).normalize();
      this.ballSpin.setFromAxisAngle(this.tmp, sp * dt / BALL_VIS);
      this.ball.quaternion.premultiply(this.ballSpin);
    }
    this.ballShadow.position.set(b.x + b.z * 0.15, 0.02, b.y + b.z * 0.1);
    this.ballShadow.scale.setScalar(0.4 + b.z * 0.04);

    this.gl.render(this.scene, this.camera);
    this.drawOverlay(m, ui);
  }

  posePlayer(p, v, dt) {
    const { root, body, legs, arms, shadow } = v;
    root.position.set(p.x, 0, p.y);
    root.rotation.y = Math.PI / 2 - p.face;
    shadow.position.set(p.x + 0.15, 0.02, p.y + 0.1);
    const speed = Math.hypot(p.vx, p.vy);
    const amp = clamp(speed / 7, 0, 1);
    const ph = p.anim * 1.15;
    const swing = Math.sin(ph) * 0.85 * amp;
    let legL = -swing, legR = swing, kneeL = Math.max(0, Math.sin(ph + 1.2)) * 1.1 * amp + 0.05, kneeR = Math.max(0, Math.sin(ph + Math.PI + 1.2)) * 1.1 * amp + 0.05;
    let armL = swing * 0.8, armR = -swing * 0.8;
    let lean = amp * 0.16, roll = 0, drop = 0, armRaise = 0;
    if (p.kickCD > 0.12 && p === this.lastKicker(p)) { legR = -1.2; kneeR = 0.1; }
    if (p.slide > 0) { lean = -1.0; drop = -0.55; legL = -1.3; legR = -1.1; kneeL = kneeR = 0.1; }
    if (p.isGK && p.dive > 0) {
      // dive sideways: roll the body towards the direction of travel
      const th = root.rotation.y;
      const lx = p.vx * Math.cos(th) - p.vy * Math.sin(th);
      roll = -clamp(lx / 3.5, -1.35, 1.35);
      drop = -Math.abs(roll) * 0.3;
      armRaise = Math.abs(roll) > 0.3 ? 1 : 0;
    }
    if (p.stun > 0 && p.slide <= 0) lean = -0.25;
    const k = Math.min(1, dt * 12);
    v.lean = lerp(v.lean, lean, k); v.roll = lerp(v.roll, roll, k); v.drop = lerp(v.drop, drop, k);
    body.rotation.x = v.lean; body.rotation.z = v.roll; body.position.y = v.drop + Math.abs(Math.sin(ph)) * 0.04 * amp;
    legs[0].leg.rotation.x = legL; legs[1].leg.rotation.x = legR;
    legs[0].knee.rotation.x = kneeL; legs[1].knee.rotation.x = kneeR;
    arms[0].rotation.x = armRaise ? -2.8 : armL; arms[1].rotation.x = armRaise ? -2.8 : armR;
  }

  lastKicker(p) { return this.match.ball.last; }

  // ------------------------------------------------------------------ screen <-> world
  project(x, y, z) {
    this.tmp.set(x, z, y).project(this.camera);
    return { x: (this.tmp.x + 1) / 2 * this.W, y: (1 - this.tmp.y) / 2 * this.H, behind: this.tmp.z > 1 };
  }

  toWorld(px, py) {
    const ndc = new THREE.Vector2(px / this.W * 2 - 1, -(py / this.H * 2 - 1));
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.ground, hit)) return { x: hit.x, y: hit.z };
    const d = this.ray.ray.direction; // looking above the horizon: take a far point
    return { x: this.camera.position.x + d.x * 200, y: this.camera.position.z + d.z * 200 };
  }

  /** Tap target: snap to a team-mate drawn near the finger (their body, not just their feet). */
  tapPoint(px, py, m) {
    let best = null, bd = 48;
    for (const p of m.teams[0].players) {
      const s = this.project(p.x, p.y, 1.0);
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { x: best.x, y: best.y } : this.toWorld(px, py);
  }

  // ------------------------------------------------------------------ 2D overlay
  drawOverlay(m, ui) {
    const g = this.octx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    const b = m.ball;
    if (m.ctrl) this.label(g, m.ctrl, false);
    if (b.owner && b.owner !== m.ctrl) this.label(g, b.owner, true);
    if (ui.tapMark && ui.tapMark.t > 0) {
      const s = this.project(ui.tapMark.x, ui.tapMark.y, 0);
      g.strokeStyle = `rgba(255,210,63,${ui.tapMark.t})`; g.lineWidth = 3;
      g.beginPath(); g.ellipse(s.x, s.y, (1.6 - ui.tapMark.t) * 26, (1.6 - ui.tapMark.t) * 12, 0, 0, Math.PI * 2); g.stroke();
    }
    if (ui.swipe && ui.swipe.length > 1) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : 'rgba(80,200,255,0.35)';
        g.lineWidth = pass ? 4 : 14;
        g.beginPath(); g.moveTo(ui.swipe[0].x, ui.swipe[0].y);
        for (const p of ui.swipe) g.lineTo(p.x, p.y);
        g.stroke();
      }
    }
    this.radar(g, m);
  }

  label(g, p, dim) {
    const s = this.project(p.x, p.y, 2.15);
    if (s.behind) return;
    const name = p.name.split(' ').slice(-1)[0];
    g.font = '800 13px system-ui, sans-serif';
    const w = g.measureText(name).width + 10;
    g.fillStyle = dim ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.65)';
    g.beginPath(); g.roundRect ? g.roundRect(s.x - w / 2, s.y - 18, w, 18, 6) : g.rect(s.x - w / 2, s.y - 18, w, 18); g.fill();
    g.fillStyle = dim ? '#ffffff' : '#ffd23f'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, s.x, s.y - 8);
  }

  radar(g, m) {
    const w = 62, h = 96, x0 = this.W - w - 10, y0 = this.H - h - 12;
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
  }
}
