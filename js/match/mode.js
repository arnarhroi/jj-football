// Runs a match on screen: input (tap / swipe / hold), HUD, sound, banners.
import { Match } from './engine.js';
import { MatchRenderer } from './render.js';
import { sfx, crowdLevel } from '../audio.js';

const $ = (id) => document.getElementById(id);

export class MatchScreen {
  constructor() {
    this.cv = $('matchCanvas');       // 2D pitch, or the transparent overlay in 3D
    this.cv3d = $('match3d');         // WebGL canvas for the 3D view
    this.r2d = new MatchRenderer(this.cv);
    this.r3d = null;
    this.r = this.r2d;
    this.active = false;
    this.paused = false;
    this.ptr = null;
    this.uiState = { swipe: null, steer: null, tapMark: null };
    window.addEventListener('resize', () => this.r.resize());
    this.cv.addEventListener('pointerdown', (e) => this.down(e));
    this.cv.addEventListener('pointermove', (e) => this.move(e));
    this.cv.addEventListener('pointerup', (e) => this.up(e));
    this.cv.addEventListener('pointercancel', () => this.cancel());
    $('matchPauseBtn').onclick = () => this.pause(true);
    $('mResume').onclick = () => { sfx('click'); this.pause(false); };
    $('mQuit').onclick = () => { sfx('click'); this.stop(); this.onQuit?.(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.active) this.pause(true); });
  }

  /** Load the 3D renderer on first use. Returns null if WebGL isn't available. */
  async get3D() {
    if (this.r3d) return this.r3d;
    if (this.no3d) return null;
    try {
      const mod = await import('./render3d.js');
      this.r3d = new mod.Match3DRenderer(this.cv3d, this.cv);
    } catch (err) {
      console.warn('3D view unavailable, using 2D', err);
      this.no3d = true;
    }
    return this.r3d;
  }

  /** opts: match options (see Match) + { settings, view: '2d' | '3d', onEnd(result), onQuit() } */
  async start(opts) {
    this.r = (opts.view === '3d' && await this.get3D()) || this.r2d;
    const is3d = this.r !== this.r2d;
    this.cv3d.classList.toggle('hidden', !is3d);
    this.cv.classList.toggle('overlay', is3d);
    this.settings = opts.settings;
    this.onEnd = opts.onEnd; this.onQuit = opts.onQuit;
    this.m = new Match({ ...opts, onEvent: (t, d) => this.event(t, d) });
    this.r.resize();
    this.r.follow(this.m, 0, true);
    this.active = true; this.paused = false; this.ended = false;
    this.cv.classList.remove('hidden');
    $('matchHud').classList.remove('hidden');
    $('matchPause').classList.add('hidden');
    const [h, a] = this.m.teams;
    $('mhHome').textContent = h.short; $('mhAway').textContent = a.short;
    $('mhHomeKit').style.background = h.kit[0]; $('mhAwayKit').style.background = a.kit[0];
    this.updateHud();
    this.banner('KICK OFF', `${h.name} v ${a.name}`, 'meh', 1.6);
    this.hint('Tap a team-mate to pass · Swipe to shoot · Hold to run', 7);
    sfx('whistle'); crowdLevel(0.07);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  stop() {
    this.active = false;
    this.cv.classList.add('hidden');
    this.cv3d.classList.add('hidden');
    $('matchHud').classList.add('hidden');
    $('matchPause').classList.add('hidden');
    crowdLevel(0.05);
  }

  pause(p) {
    if (!this.active || this.ended) return;
    this.paused = p;
    $('matchPause').classList.toggle('hidden', !p);
    if (p) this.cancel();
    else this.last = performance.now();
  }

  frame(now) {
    if (!this.active) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      // holding a finger still (or dragging slowly) steers the controlled player
      const p = this.ptr;
      if (p && !p.steering && now - p.t0 > 200) {
        const recent = p.pts.filter((q) => now - q.t < 120);
        const moved = recent.length > 1 ? Math.hypot(recent[recent.length - 1].x - recent[0].x, recent[recent.length - 1].y - recent[0].y) : 0;
        if (moved < 30) p.steering = true;
      }
      if (p && p.steering) {
        const w = this.r.toWorld(p.cx, p.cy);
        this.m.userSteer(w); this.uiState.steer = w; this.uiState.swipe = null;
      }
      this.m.update(dt);
      this.r.follow(this.m, dt);
      if (this.uiState.tapMark) this.uiState.tapMark.t -= dt * 2;
      this.updateHud();
      if (this.m.state === 'full' && !this.ended) this.finish();
    }
    this.r.draw(this.m, this.uiState);
    requestAnimationFrame((t) => this.frame(t));
  }

  updateHud() {
    const m = this.m;
    $('mhScore').textContent = `${m.teams[0].score} – ${m.teams[1].score}`;
    const min = m.minute();
    $('mhClock').textContent = m.state === 'half' ? 'HT' : m.state === 'full' ? 'FT' : `${min}'`;
  }

  finish() {
    this.ended = true;
    const m = this.m;
    setTimeout(() => {
      this.stop();
      this.onEnd?.({ hg: m.teams[0].score, ag: m.teams[1].score, events: m.events.map((e) => ({ side: e.team === m.teams[0] ? 0 : 1, scorer: e.scorer, minute: e.minute })) });
    }, 2200);
  }

  // ------------------------------------------------------------------ events
  event(type, d) {
    const user = this.m.teams[0];
    switch (type) {
      case 'kick': sfx('kick', d.power ?? 0.5); break;
      case 'goal': {
        sfx('net');
        const mine = d.team === user;
        if (mine) {
          sfx('cheer'); crowdLevel(0.14); setTimeout(() => crowdLevel(0.07), 2500);
          if (this.settings?.vibrate && navigator.vibrate) navigator.vibrate([30, 40, 80]);
        } else sfx('groan');
        this.banner('GOAL!', `${d.scorer} ${d.minute}'`, mine ? 'good' : 'bad', 2.6);
        break;
      }
      case 'save': sfx('save'); this.banner(d.parry ? 'PARRIED!' : 'SAVED!', '', d.team === user ? 'good' : 'bad', 1); break;
      case 'post': sfx('post'); this.banner('OFF THE WOODWORK!', '', 'meh', 1); break;
      case 'tackle': sfx('save'); break;
      case 'half': sfx('whistle'); this.banner('HALF TIME', `${user.short} ${user.score} – ${user.opp.score} ${user.opp.short}`, 'meh', 2.5); break;
      case 'full': sfx('whistle'); this.banner('FULL TIME', `${user.short} ${user.score} – ${user.opp.score} ${user.opp.short}`, 'meh', 3); break;
      case 'whistle': sfx('whistle'); break;
      case 'corner': this.banner('CORNER', d.team.name, 'meh', 0.9); if (d.team === user) this.hint('Tap a team-mate in the box to cross it in', 4); break;
      case 'throwin': this.banner('THROW-IN', '', 'meh', 0.7); if (d.team === user) this.hint('Tap a team-mate to throw it to them', 3); break;
      case 'goalkick': this.banner('GOAL KICK', '', 'meh', 0.7); break;
      case 'miss': if (d.team === user) sfx('groan'); break;
    }
  }

  banner(main, sub, cls, dur) {
    const b = $('mBanner');
    b.querySelector('.banner-main').textContent = main;
    b.querySelector('.banner-sub').textContent = sub;
    b.className = `banner ${cls} show`;
    clearTimeout(this.bt);
    this.bt = setTimeout(() => b.classList.remove('show'), dur * 1000);
  }

  hint(t, dur) {
    $('mHint').textContent = t;
    clearTimeout(this.ht);
    if (dur) this.ht = setTimeout(() => { $('mHint').textContent = ''; }, dur * 1000);
  }

  // ------------------------------------------------------------------ input
  pt(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }

  down(e) {
    if (this.paused || this.ptr) return;
    const p = this.pt(e);
    this.ptr = { id: e.pointerId, t0: p.t, x0: p.x, y0: p.y, cx: p.x, cy: p.y, pts: [p], steering: false };
    this.cv.setPointerCapture?.(e.pointerId);
  }

  move(e) {
    const P = this.ptr;
    if (!P || e.pointerId !== P.id) return;
    const p = this.pt(e);
    P.cx = p.x; P.cy = p.y; P.pts.push(p);
    if (P.pts.length > 40) P.pts.shift();
    if (!P.steering) this.uiState.swipe = P.pts;
  }

  up(e) {
    const P = this.ptr;
    if (!P || e.pointerId !== P.id) return;
    this.ptr = null;
    this.uiState.swipe = null;
    if (P.steering) { this.m.userSteer(null); this.uiState.steer = null; return; }
    const p = this.pt(e);
    const dx = p.x - P.x0, dy = p.y - P.y0, d = Math.hypot(dx, dy), dur = Math.max(0.04, (p.t - P.t0) / 1000);
    if (d < 16 && dur < 0.35) {
      const w = this.r.tapPoint ? this.r.tapPoint(p.x, p.y, this.m) : this.r.toWorld(p.x, p.y);
      this.m.userTap(w);
      this.uiState.tapMark = { x: w.x, y: w.y, t: 1 };
      return;
    }
    if (d >= 30) {
      const sp = (d / Math.min(this.r.W, this.r.H)) / dur; // screen widths per second
      const power = Math.max(0, Math.min(1, (sp - 0.5) / 3.2));
      // turn the screen swipe into a direction on the pitch (matters when the camera is in 3D)
      const a = this.r.toWorld(P.x0, P.y0), c = this.r.toWorld(p.x, p.y);
      const wl = Math.hypot(c.x - a.x, c.y - a.y);
      if (wl > 1e-3) this.m.userSwipe((c.x - a.x) / wl, (c.y - a.y) / wl, power);
    }
  }

  cancel() {
    if (this.ptr?.steering) this.m.userSteer(null);
    this.ptr = null; this.uiState.swipe = null; this.uiState.steer = null;
  }
}
