import { Game } from './game.js';
import { initAudio, setSound, sfx } from './audio.js';
import { KEEPER_SKILL } from './world.js';
import { TEAMS, PracticeMode, TargetMode, RoundsMode, Cup, ShootoutMode, ROUND_NAMES } from './modes.js';

const $ = (id) => document.getElementById(id);

// ---------------- persistence ----------------
function load(key, def) {
  try { return { ...def, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { ...def }; }
}
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }

const settings = load('jjf.settings', { sound: true, vibrate: true, seenHowto: false });
const stats = load('jjf.stats', { cups: 0, target: 0, crossbar: 0, freekick: 0 });
setSound(settings.sound);

const game = new Game($('game'), settings);
window.__game = game; // handy for debugging from the console

// ---------------- UI facade used by modes ----------------
let bannerTimer = 0;
const ui = {
  hud({ left, center, right }) {
    if (left !== undefined) $('hudLeft').textContent = left;
    if (center !== undefined) $('hudCenter').textContent = center;
    if (right !== undefined) $('hudRight').textContent = right;
  },
  banner(main, sub = '', cls = 'good', dur = 1.2) {
    const b = $('banner');
    b.querySelector('.banner-main').textContent = main;
    b.querySelector('.banner-sub').textContent = sub;
    b.className = `banner ${cls} show`;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), dur * 1000);
  },
  hint(t) { $('hint').textContent = t; },
  showSpotButton(show, fn) {
    const b = $('spotBtn');
    b.classList.toggle('hidden', !show);
    b.onclick = () => { if (game.phase === 'aim') { sfx('click'); fn(); } };
  },
  shootout(user, opp, kicks, turn) {
    const el = $('shootout');
    if (!user) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const row = (t, arr, active) => {
      const n = Math.max(5, kicks.u.length, kicks.o.length);
      let dots = '';
      for (let i = 0; i < n; i++) dots += `<span class="dot ${arr[i] === undefined ? '' : arr[i] ? 'y' : 'n'}"></span>`;
      return `<div class="so-row ${active ? 'active' : ''}">${flag(t)}<span class="nm">${t.id}</span><span class="dots">${dots}</span><span class="sc">${arr.filter(Boolean).length}</span></div>`;
    };
    el.innerHTML = row(user, kicks.u, turn === 'u') + row(opp, kicks.o, turn === 'o');
  },
};

function flag(t) {
  const [a, b, c] = t.flag;
  return `<span class="flag" style="background:linear-gradient(180deg, ${a} 0 33.3%, ${b} 33.3% 66.6%, ${c} 66.6%)"></span>`;
}

// ---------------- screens ----------------
const SCREENS = ['menu', 'practiceSetup', 'cupTeams', 'bracket', 'results', 'pause', 'settings', 'howto'];
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  const inGame = id === null || id === 'pause';
  $('hud').classList.toggle('hidden', !inGame);
  if (id === 'menu') refreshMenu();
}

function refreshMenu() {
  $('trophyCount').textContent = `🏆 ${stats.cups} cup${stats.cups === 1 ? '' : 's'} won`;
  $('bestTarget').textContent = stats.target ? `Best: ${stats.target}` : '60 s challenge';
  $('bestCrossbar').textContent = stats.crossbar ? `Best: ${stats.crossbar}` : '10 balls';
  $('bestFreekick').textContent = stats.freekick ? `Best: ${stats.freekick} pts` : '10 free kicks vs wall + keeper';
}

/** Attract-mode scene behind menus. */
function idleScene() {
  game.setMode(null);
  game.setupShot({ x: 0, z: 11, keeper: KEEPER_SKILL.medium });
  game.phase = 'idle';
  ui.shootout(null);
  ui.showSpotButton(false);
  ui.hint('');
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) {
    initAudio(); sfx('click');
    const target = go.dataset.go;
    if (target === 'menu') idleScene();
    show(target);
  }
  const st = e.target.closest('[data-start]');
  if (st) { initAudio(); sfx('click'); startChallenge(st.dataset.start); }
});

// chip groups
const choice = { pos: 'penalty', keeper: 'medium', cupDiff: 'medium' };
document.querySelectorAll('.chips').forEach((grp) => {
  grp.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    grp.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    choice[grp.dataset.group] = b.dataset.v;
    sfx('click');
  });
});

// ---------------- modes ----------------
let restart = null;

function play(makeMode) {
  initAudio();
  restart = () => play(makeMode);
  ui.shootout(null);
  ui.showSpotButton(false);
  show(null);
  game.setMode(makeMode());
}

$('startPractice').onclick = () => play(() => new PracticeMode(ui, { pos: choice.pos, keeper: choice.keeper }));

function startChallenge(kind) {
  const end = (r) => showResults(r, () => startChallenge(kind));
  if (kind === 'target') play(() => new TargetMode(ui, end));
  else play(() => new RoundsMode(ui, end, kind));
}

function showResults(r, retry) {
  const prev = stats[r.key] || 0;
  const isBest = r.score > prev;
  if (isBest) { stats[r.key] = r.score; save('jjf.stats', stats); }
  $('resultsIcon').textContent = isBest && r.score > 0 ? '🌟' : '🏁';
  $('resultsTitle').textContent = r.title;
  $('resultsScore').textContent = r.score;
  $('resultsDetail').textContent = r.detail;
  $('resultsBest').textContent = isBest && r.score > 0 ? 'NEW PERSONAL BEST!' : `Best: ${Math.max(prev, r.score)}`;
  $('resultsRetry').textContent = 'Play again';
  $('resultsRetry').onclick = () => { sfx('click'); retry(); };
  sfx(isBest && r.score > 0 ? 'win' : 'whistle');
  game.setMode(null); game.phase = 'idle';
  show('results');
}

// ---------------- Penalty Cup ----------------
let selectedTeam = null, cup = null;

function buildTeamGrid() {
  const grid = $('teamGrid');
  grid.innerHTML = '';
  for (const t of TEAMS) {
    const b = document.createElement('button');
    b.className = 'team';
    b.innerHTML = `${flag(t)}<span>${t.name}</span><span class="stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</span>`;
    b.onclick = () => {
      selectedTeam = t; sfx('click');
      grid.querySelectorAll('.team').forEach((x) => x.classList.toggle('on', x === b));
      $('startCup').disabled = false;
      $('startCup').textContent = `Start with ${t.name}`;
    };
    grid.appendChild(b);
  }
}
buildTeamGrid();

$('startCup').onclick = () => {
  if (!selectedTeam) return;
  sfx('click');
  cup = new Cup(selectedTeam, choice.cupDiff);
  showBracket();
};

function showBracket() {
  const view = $('bracketView');
  view.innerHTML = '';
  const names = ['Quarter-finals', 'Semi-finals', 'Final'];
  for (let r = 0; r < 3; r++) {
    const col = document.createElement('div');
    col.className = 'round-col';
    let html = `<h3>${names[r]}</h3><div class="matches">`;
    const teams = cup.rounds[r];
    const res = cup.results[r];
    const count = 4 >> r;
    for (let m = 0; m < count; m++) {
      const a = teams ? cup.team(teams[m * 2]) : null, b = teams ? cup.team(teams[m * 2 + 1]) : null;
      const mr = res?.[m];
      const isUser = a?.id === cup.user.id || b?.id === cup.user.id;
      const rowF = (t, sc) => t
        ? `<div class="m-row ${mr && mr.winner !== t.id ? 'lost' : ''}">${flag(t)}<span>${t.name}</span><b>${sc ?? ''}</b></div>`
        : `<div class="m-row tbd">TBD</div>`;
      html += `<div class="match ${isUser && !mr ? 'user' : ''}">${rowF(a, mr?.sa)}${rowF(b, mr?.sb)}</div>`;
    }
    col.innerHTML = html + '</div>';
    view.appendChild(col);
  }
  if (cup.won || !cup.alive) {
    $('bracketTitle').textContent = cup.won ? 'Champions!' : 'Knocked out';
    $('playMatch').textContent = 'Back to menu';
    $('playMatch').onclick = () => { sfx('click'); idleScene(); show('menu'); };
    $('quitCup').classList.add('hidden');
  } else {
    const opp = cup.currentOpponent();
    $('bracketTitle').textContent = ROUND_NAMES[cup.round];
    $('playMatch').textContent = `Play vs ${opp.name}`;
    $('playMatch').onclick = () => { sfx('click'); startMatch(); };
    $('quitCup').classList.remove('hidden');
  }
  show('bracket');
}

$('quitCup').onclick = () => { sfx('click'); cup = null; idleScene(); show('menu'); };

function startMatch() {
  play(() => new ShootoutMode(ui, cup, (su, so) => {
    const round = cup.round;
    cup.recordUserMatch(su, so);
    if (cup.won) {
      stats.cups++; save('jjf.stats', stats);
      sfx('win');
      $('resultsIcon').textContent = '🏆';
      $('resultsTitle').textContent = `${cup.user.name} are champions!`;
      $('resultsScore').textContent = `${su} – ${so}`;
      $('resultsDetail').textContent = `You won the final on penalties.`;
      $('resultsBest').textContent = `Cups won: ${stats.cups}`;
      $('resultsRetry').textContent = 'View bracket';
      $('resultsRetry').onclick = () => { sfx('click'); showBracket(); };
    } else if (!cup.alive) {
      sfx('lose');
      $('resultsIcon').textContent = '😢';
      $('resultsTitle').textContent = `Out in the ${ROUND_NAMES[round].toLowerCase()}`;
      $('resultsScore').textContent = `${su} – ${so}`;
      $('resultsDetail').textContent = `Beaten on penalties. Keep practising!`;
      $('resultsBest').textContent = '';
      $('resultsRetry').textContent = 'Try again';
      $('resultsRetry').onclick = () => { sfx('click'); cup = new Cup(cup.user, cup.difficulty); showBracket(); };
    } else {
      sfx('win');
      $('resultsIcon').textContent = '✅';
      $('resultsTitle').textContent = `Through to the ${ROUND_NAMES[cup.round].toLowerCase()}!`;
      $('resultsScore').textContent = `${su} – ${so}`;
      $('resultsDetail').textContent = `Next up: ${cup.currentOpponent().name}`;
      $('resultsBest').textContent = '';
      $('resultsRetry').textContent = 'Continue';
      $('resultsRetry').onclick = () => { sfx('click'); showBracket(); };
    }
    game.setMode(null); game.phase = 'idle';
    ui.shootout(null);
    show('results');
  }));
}

// ---------------- pause / settings ----------------
$('pauseBtn').onclick = () => { sfx('click'); game.paused = true; show('pause'); };
$('resumeBtn').onclick = () => { sfx('click'); game.paused = false; show(null); };
$('restartBtn').onclick = () => { sfx('click'); game.paused = false; restart?.(); };
$('quitBtn').onclick = () => { sfx('click'); game.paused = false; idleScene(); if (cup && cup.alive && !cup.won) showBracket(); else show('menu'); };

$('optSound').checked = settings.sound;
$('optVibrate').checked = settings.vibrate;
$('optSound').onchange = (e) => { settings.sound = e.target.checked; setSound(settings.sound); save('jjf.settings', settings); initAudio(); sfx('click'); };
$('optVibrate').onchange = (e) => { settings.vibrate = e.target.checked; save('jjf.settings', settings); if (settings.vibrate) navigator.vibrate?.(30); };
$('resetStats').onclick = () => {
  if (!confirm('Reset all records and trophies?')) return;
  Object.assign(stats, { cups: 0, target: 0, crossbar: 0, freekick: 0 });
  save('jjf.stats', stats);
  sfx('click');
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !$('hud').classList.contains('hidden') && $('pause').classList.contains('hidden')) {
    game.paused = true; show('pause');
  }
});

// ---------------- boot ----------------
idleScene();
if (!settings.seenHowto) { settings.seenHowto = true; save('jjf.settings', settings); show('howto'); }
else show('menu');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
