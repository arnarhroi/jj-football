import { Game } from './game.js';
import { initAudio, setSound, sfx } from './audio.js';
import { KEEPER_SKILL } from './world.js';
import { TEAMS, PracticeMode, TargetMode, RoundsMode, Cup, ShootoutMode, ROUND_NAMES } from './modes.js';
import { MatchScreen } from './match/mode.js';
import {
  initProfiles, listProfiles, activeProfile, profileData, saveProfilePart, createProfile, switchProfile,
  renameProfile, deleteProfile, resetProfile, exportCode, importCode, DEFAULT_STATS,
} from './storage.js';
import { CLUBS, NATIONS, FORMATIONS, teamById, stars, defaultLineup, matchKits } from './match/teams.js';
import { COMPETITIONS, newCompetition, nextFixture, recordResult, simulateUserMatch, sortTable } from './match/competitions.js';

const $ = (id) => document.getElementById(id);

// ---------------- persistence ----------------
function load(key, def) {
  try { return { ...def, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { ...def }; }
}
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }

const settings = load('jjf.settings', { sound: true, vibrate: true, seenHowto: false });
// Records and progress belong to the active player profile (see storage.js).
initProfiles();
const saved = profileData();
const stats = saved.stats;
const saveStats = () => saveProfilePart('stats', stats);
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
const SCREENS = ['menu', 'practiceSetup', 'cupTeams', 'bracket', 'results', 'pause', 'settings', 'howto', 'matchMenu', 'teamPick', 'lineup', 'compHub', 'profiles'];
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  const inGame = id === null || id === 'pause';
  $('hud').classList.toggle('hidden', !inGame);
  if (id === 'menu') refreshMenu();
}

function refreshMenu() {
  $('profileName').textContent = activeProfile().name;
  const n = stats.cups + (stats.titles || 0);
  $('trophyCount').textContent = `🏆 ${n} troph${n === 1 ? 'y' : 'ies'}`;
  const cc = typeof comp !== 'undefined' && comp;
  $('continueComp').classList.toggle('hidden', !cc);
  if (cc) $('continueSub').textContent = `${comp.name} · ${teamById(comp.user).name}`;
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
    if (target === 'cupTeams' && cup && cup.alive && !cup.won) { showBracket(); return; }
    if (target === 'profiles') { showProfiles(); return; }
    show(target);
  }
  const st = e.target.closest('[data-start]');
  if (st) { initAudio(); sfx('click'); startChallenge(st.dataset.start); }
});

// chip groups
const choice = { pos: 'penalty', keeper: 'medium', cupDiff: 'medium', matchDiff: 'easy', matchLen: '120' };
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
  if (isBest) { stats[r.key] = r.score; saveStats(); }
  $('resultsIcon').textContent = isBest && r.score > 0 ? '🌟' : '🏁';
  $('resultsTitle').textContent = r.title;
  $('resultsScore').textContent = r.score;
  $('resultsScore').style.fontSize = '';
  $('resultsDetail').textContent = r.detail;
  $('resultsBest').textContent = isBest && r.score > 0 ? 'NEW PERSONAL BEST!' : `Best: ${Math.max(prev, r.score)}`;
  $('resultsRetry').textContent = 'Play again';
  $('resultsRetry').onclick = () => { sfx('click'); retry(); };
  sfx(isBest && r.score > 0 ? 'win' : 'whistle');
  game.setMode(null); game.phase = 'idle';
  show('results');
}

// ---------------- Penalty Cup ----------------
let selectedTeam = null, cup = restoreCup(saved.cup);

function restoreCup(d) {
  const user = d && TEAMS.find((t) => t.id === d.user);
  if (!user || !Array.isArray(d.rounds) || !d.rounds[0] || d.rounds[0].some((id) => !TEAMS.some((t) => t.id === id))) return null;
  return Object.assign(Object.create(Cup.prototype), d, { user });
}
const saveCup = () => saveProfilePart('cup', cup ? { ...cup, user: cup.user.id } : null);

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
  saveCup();
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
    $('playMatch').onclick = () => { sfx('click'); cup = null; saveCup(); idleScene(); show('menu'); };
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

$('quitCup').onclick = () => {
  if (!confirm('Quit this Penalty Cup? Your progress in it will be lost.')) return;
  sfx('click'); cup = null; saveCup(); idleScene(); show('menu');
};

function startMatch() {
  play(() => new ShootoutMode(ui, cup, (su, so) => {
    const round = cup.round;
    cup.recordUserMatch(su, so);
    saveCup();
    if (cup.won) {
      stats.cups++; saveStats();
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
      $('resultsRetry').onclick = () => { sfx('click'); cup = new Cup(cup.user, cup.difficulty); saveCup(); showBracket(); };
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
$('quitBtn').onclick = () => {
  sfx('click'); game.paused = false; idleScene();
  if (pensActive) { pensActive = false; showHub(); } else if (cup && cup.alive && !cup.won) showBracket(); else show('menu');
};

$('optSound').checked = settings.sound;
$('optVibrate').checked = settings.vibrate;
$('optSound').onchange = (e) => { settings.sound = e.target.checked; setSound(settings.sound); save('jjf.settings', settings); initAudio(); sfx('click'); };
$('optVibrate').onchange = (e) => { settings.vibrate = e.target.checked; save('jjf.settings', settings); if (settings.vibrate) navigator.vibrate?.(30); };
$('resetStats').onclick = () => {
  if (!confirm(`Reset ${activeProfile().name}'s records and trophies? League and cup progress is kept.`)) return;
  Object.assign(stats, DEFAULT_STATS);
  saveStats();
  sfx('click');
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !$('hud').classList.contains('hidden') && $('pause').classList.contains('hidden')) {
    game.paused = true; show('pause');
  }
});

// ======================================================================
// 11-a-side matches: friendlies, Premier League, Champions League, World Cup
// ======================================================================
const matchScreen = new MatchScreen();
window.__matchScreen = matchScreen; // handy for debugging from the console
let comp = validComp(saved.comp) ? saved.comp : null;
const saveComp = () => saveProfilePart('comp', comp);

/** Guard against damaged saves (or save codes) before trusting them. */
function validComp(c) {
  if (!c || typeof c !== 'object' || !COMPETITIONS[c.key] || !teamById(c.user)) return false;
  if (!c.lineup || !FORMATIONS[c.lineup.formation] || !Array.isArray(c.lineup.xi) || c.lineup.xi.length !== 11) return false;
  if (!Array.isArray(c.results) || typeof c.scorers !== 'object') return false;
  if (c.kind === 'league') return Array.isArray(c.rounds) && Array.isArray(c.table);
  if (c.kind === 'cup') return Array.isArray(c.groups) && c.groups.length === 4;
  return false;
}
let pensActive = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kitDot = (t) => `<span class="kitdot" style="background:${t.home[0]}"></span>`;
const kitHTML = (t) => {
  const [shirt, stripe] = t.home;
  const stripes = stripe ? [6, 15, 24].map((l) => `<i style="left:${l}px;background:${stripe}"></i>`).join('') : '';
  return `<span class="kit" style="background:${shirt}">${stripes}</span>`;
};
const starStr = (t) => { const n = stars(t); return '★'.repeat(n) + '☆'.repeat(5 - n); };

function enterMatchView() { show('match'); game.sleep = true; }
function leaveMatchView() { game.sleep = false; idleScene(); }

// ---------------- team picker ----------------
function pickTeam({ title, sub = '', pool = null, tabs = false, exclude = null, back, startTab = 'clubs' }, cb) {
  $('pickTitle').textContent = title;
  $('pickSub').textContent = sub;
  $('pickTabs').classList.toggle('hidden', !tabs);
  let tab = startTab;
  $('pickTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === tab));
  const render = () => {
    const list = pool || (tab === 'clubs' ? CLUBS : NATIONS);
    const grid = $('pickGrid');
    grid.innerHTML = '';
    for (const t of list) {
      if (t.id === exclude) continue;
      const b = document.createElement('button');
      b.className = 'team';
      b.innerHTML = `${kitHTML(t)}<span class="tn">${esc(t.name)}</span><span class="stars">${starStr(t)}</span>`;
      b.onclick = () => { sfx('click'); cb(t); };
      grid.appendChild(b);
    }
  };
  $('pickTabs').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.v;
    $('pickTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  };
  $('pickBack').onclick = () => { sfx('click'); back ? back() : show('matchMenu'); };
  render();
  show('teamPick');
  $('teamPick').scrollTop = 0;
}

// ---------------- line-up editor ----------------
/** Re-seat the chosen XI into a new formation, putting players in their natural positions where possible. */
function refit(team, xi, formation) {
  const pool = [...xi], out = [];
  for (const s of FORMATIONS[formation]) {
    let bi = -1;
    pool.forEach((si, k) => { if (team.squad[si].pos === s[2] && (bi < 0 || team.squad[si].r > team.squad[pool[bi]].r)) bi = k; });
    if (bi < 0) pool.forEach((si, k) => { if ((s[2] === 'GK') === (team.squad[si].pos === 'GK') && bi < 0) bi = k; });
    if (bi < 0) bi = 0;
    out.push(pool.splice(bi, 1)[0]);
  }
  return out;
}

function openLineup(teamId, lineup, doneLabel, onDone) {
  const team = teamById(teamId);
  let sel = null;
  $('lineupTitle').textContent = team.name;
  $('lineupDone').textContent = doneLabel;
  const row = (si, role, kind, i) => {
    const p = team.squad[si];
    const warn = role && role !== p.pos ? `<span class="warn">(${p.pos})</span>` : '';
    const isSel = sel && sel.kind === kind && sel.i === i;
    return `<button class="sq-row ${isSel ? 'sel' : ''}" data-kind="${kind}" data-i="${i}">
      <span class="pos ${role || p.pos}">${role || p.pos}</span><span class="num">${p.num}</span>
      <span class="nm">${esc(p.name)}${warn}</span><span class="rt">${p.r}</span></button>`;
  };
  const render = () => {
    $('formChips').innerHTML = Object.keys(FORMATIONS).map((f) => `<button data-v="${f}" class="${f === lineup.formation ? 'on' : ''}">${f}</button>`).join('');
    const slots = FORMATIONS[lineup.formation];
    $('xiList').innerHTML = lineup.xi.map((si, i) => row(si, slots[i][2], 'xi', i)).join('');
    const bench = team.squad.map((_, i) => i).filter((i) => !lineup.xi.includes(i));
    $('benchList').innerHTML = bench.map((si) => row(si, null, 'bench', si)).join('');
  };
  $('formChips').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sfx('click');
    lineup.formation = b.dataset.v;
    lineup.xi = refit(team, lineup.xi, lineup.formation);
    sel = null; render();
  };
  const onRow = (e) => {
    const b = e.target.closest('.sq-row'); if (!b) return;
    sfx('click');
    const cur = { kind: b.dataset.kind, i: +b.dataset.i };
    if (!sel || (sel.kind === 'bench' && cur.kind === 'bench')) { sel = (sel && sel.i === cur.i && sel.kind === cur.kind) ? null : cur; render(); return; }
    if (sel.kind === cur.kind && sel.i === cur.i) { sel = null; render(); return; }
    if (sel.kind === 'xi' && cur.kind === 'xi') { [lineup.xi[sel.i], lineup.xi[cur.i]] = [lineup.xi[cur.i], lineup.xi[sel.i]]; }
    else {
      const xiPos = sel.kind === 'xi' ? sel.i : cur.i;
      const benchIdx = sel.kind === 'bench' ? sel.i : cur.i;
      lineup.xi[xiPos] = benchIdx;
    }
    sel = null; render();
  };
  $('xiList').onclick = onRow; $('benchList').onclick = onRow;
  $('lineupDone').onclick = () => { sfx('click'); onDone(); };
  render();
  show('lineup');
  $('lineup').scrollTop = 0;
}

// ---------------- starting matches ----------------
const OPP_FORMATIONS = ['4-3-3', '4-3-3', '4-4-2', '4-2-3-1'];

function launchMatch({ user, opp, lineup, userHome, difficulty, halfSeconds, onEnd, onQuit }) {
  const kits = userHome ? matchKits(user, opp) : matchKits(opp, user).reverse();
  const of = OPP_FORMATIONS[(Math.random() * OPP_FORMATIONS.length) | 0];
  const ol = defaultLineup(opp, of);
  initAudio();
  enterMatchView();
  matchScreen.start({
    home: user, away: opp, homeXI: lineup.xi, awayXI: ol.xi, homeFormation: lineup.formation, awayFormation: of,
    kits, difficulty, halfSeconds, settings,
    onEnd: (r) => { leaveMatchView(); onEnd(r); },
    onQuit: () => { leaveMatchView(); onQuit(); },
  });
}

function scorerLine(r, user, opp) {
  const fmt = (side) => r.events.filter((e) => e.side === side).map((e) => `${esc(e.scorer.split(' ').slice(-1)[0])} ${e.minute}'`).join(', ');
  const a = fmt(0), b = fmt(1);
  return [a && `${user.short}: ${a}`, b && `${opp.short}: ${b}`].filter(Boolean).join(' · ') || 'No goals';
}

function showMatchResult({ user, opp, ug, og, detail, extra = '', button = 'Continue', onContinue }) {
  const icon = ug > og ? '🎉' : ug < og ? '😞' : '🤝';
  $('resultsIcon').textContent = icon;
  $('resultsTitle').textContent = ug > og ? 'You won!' : ug < og ? 'You lost' : 'Draw';
  $('resultsScore').textContent = `${user.short} ${ug} – ${og} ${opp.short}`;
  $('resultsScore').style.fontSize = '44px';
  $('resultsDetail').innerHTML = detail;
  $('resultsBest').textContent = extra;
  $('resultsRetry').textContent = button;
  $('resultsRetry').onclick = () => { sfx('click'); onContinue(); };
  sfx(ug > og ? 'win' : ug < og ? 'lose' : 'whistle');
  show('results');
}

// ---------------- friendly ----------------
function startFriendlyFlow() {
  pickTeam({ title: 'Choose your team', tabs: true }, (u) => {
    const startTab = NATIONS.includes(u) ? 'nations' : 'clubs';
    pickTeam({ title: 'Choose the opponent', sub: `You are ${u.name}`, tabs: true, exclude: u.id, back: startFriendlyFlow, startTab }, (o) => {
      const lineup = defaultLineup(u, '4-3-3');
      const go = () => launchMatch({
        user: u, opp: o, lineup, userHome: true, difficulty: choice.matchDiff, halfSeconds: +choice.matchLen,
        onEnd: (r) => showMatchResult({ user: u, opp: o, ug: r.hg, og: r.ag, detail: scorerLine(r, u, o), button: 'Play again',
          onContinue: () => go() }),
        onQuit: () => show('matchMenu'),
      });
      openLineup(u.id, lineup, 'Kick off!', go);
    });
  });
}

// ---------------- competitions ----------------
function startCompetitionFlow(key) {
  const def = COMPETITIONS[key];
  if (comp && !comp.done && !comp.out && !confirm(`Start a new ${def.name}? Your ${comp.name} with ${teamById(comp.user).name} will be lost.`)) return;
  pickTeam({ title: def.name, sub: key === 'wc' ? 'Choose your nation' : 'Choose your club', pool: def.pool() }, (t) => {
    comp = newCompetition(key, t.id, choice.matchDiff);
    comp.halfSeconds = +choice.matchLen;
    saveComp();
    openLineup(t.id, comp.lineup, 'Save line-up', () => { saveComp(); showHub(); });
  });
}

function compUser() { return teamById(comp.user); }

function showHub() {
  if (!comp) { show('matchMenu'); return; }
  const user = compUser();
  $('hubTitle').textContent = `${COMPETITIONS[comp.key].icon} ${comp.name}`;
  $('hubTeam').innerHTML = `${kitDot(user)}<span>${esc(user.name)}</span><span class="stars">${starStr(user)}</span>`;

  // trophy bookkeeping
  if (comp.done && comp.champion === comp.user && !comp.counted) {
    comp.counted = true; stats.titles = (stats.titles || 0) + 1; saveStats(); saveComp();
  }

  const fx = nextFixture(comp);
  let card = '';
  if (comp.pendingPens) {
    const opp = teamById(fx.opp);
    card = `<div class="lbl">${esc(fx.label)} · ${comp.pendingPens.ug}–${comp.pendingPens.og}</div>
      <div class="vs">Penalty shoot-out vs ${esc(opp.name)}</div>
      <button class="big-btn primary" id="hubPens">🥅 Take the penalties</button>`;
  } else if (fx) {
    const opp = teamById(fx.opp);
    const [h, a] = fx.home ? [user, opp] : [opp, user];
    card = `<div class="lbl">${esc(fx.label)}</div>
      <div class="vs">${kitDot(h)} ${esc(h.name)} <small>v</small> ${esc(a.name)} ${kitDot(a)}</div>
      <div class="btns"><button class="big-btn primary" id="hubPlay">▶ Play</button>
      <button class="big-btn alt" id="hubSim">Sim</button><button class="big-btn" id="hubLineup">Team</button></div>`;
  } else {
    const champ = teamById(comp.champion);
    let pos = '';
    if (comp.kind === 'league') pos = `You finished ${ordinal(sortTable(comp.table).findIndex((r) => r.id === comp.user) + 1)}.`;
    else if (comp.out) pos = `You went out in ${comp.outAt}.`;
    card = comp.champion === comp.user
      ? `<div class="champ">🏆 ${esc(user.name)} are CHAMPIONS!</div>`
      : `<div class="champ">${kitDot(champ)} ${esc(champ.name)} won it</div><div class="lbl">${pos}</div>`;
    card += `<button class="big-btn primary" id="hubNew">New competition</button>`;
  }
  $('hubNext').innerHTML = card;
  $('hubPlay') && ($('hubPlay').onclick = () => { sfx('click'); playCompMatch(); });
  $('hubSim') && ($('hubSim').onclick = () => { sfx('click'); simCompMatch(); });
  $('hubLineup') && ($('hubLineup').onclick = () => { sfx('click'); openLineup(comp.user, comp.lineup, 'Save line-up', () => { saveComp(); showHub(); }); });
  $('hubPens') && ($('hubPens').onclick = () => { sfx('click'); startCompPens(); });
  $('hubNew') && ($('hubNew').onclick = () => { sfx('click'); comp = null; saveComp(); show('matchMenu'); });

  $('hubTable').innerHTML = hubTables();
  const recent = comp.results.slice(-6).reverse();
  let res = '';
  if (recent.length) {
    res += `<div class="section-h">Your results</div>`;
    for (const r of recent) {
      const ug = r.h === comp.user ? r.hg : r.ag, og = r.h === comp.user ? r.ag : r.hg;
      const won = ug > og || (ug === og && r.pens === comp.user), lost = ug < og || (ug === og && r.pens && r.pens !== comp.user);
      const cls = won ? 'w' : lost ? 'l' : 'd';
      const pen = r.pens ? ` (pens ${esc(r.penScore || '')})` : '';
      res += `<div class="res-row"><span>${esc(teamById(r.h).short)} ${r.hg}–${r.ag} ${esc(teamById(r.a).short)}${pen}</span><b class="${cls}">${won ? 'W' : lost ? 'L' : 'D'}</b></div>`;
    }
  }
  const top = Object.entries(comp.scorers).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) {
    res += `<div class="section-h">Your top scorers</div>`;
    for (const [n, g] of top) res += `<div class="res-row"><span>${esc(n)}</span><b>${g} ⚽</b></div>`;
  }
  $('hubResults').innerHTML = res;
  show('compHub');
  $('compHub').scrollTop = 0;
}

const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

function tableHTML(rows, cutAfter = -1) {
  let h = `<table class="tbl"><tr><th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>`;
  rows.forEach((r, i) => {
    const t = teamById(r.id);
    const cls = [r.id === comp.user ? 'me' : '', i === cutAfter ? 'cut' : ''].join(' ');
    h += `<tr class="${cls}"><td>${i + 1}</td><td><span class="mini" style="background:${t.home[0]}"></span>${esc(t.name)}</td><td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GF - r.GA}</td><td><b>${r.Pts}</b></td></tr>`;
  });
  return h + '</table>';
}

function hubTables() {
  if (comp.kind === 'league') return `<div class="section-h">Table</div>` + tableHTML(sortTable(comp.table), 4);
  let h = '';
  if (comp.ko) {
    const names = { QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final' };
    for (const r of [...comp.ko.history].reverse()) {
      h += `<div class="section-h">${names[r.stage]}</div>`;
      for (const t of r.ties) {
        const mine = t.h === comp.user || t.a === comp.user;
        h += `<div class="res-row" style="${mine ? 'outline:2px solid var(--accent)' : ''}"><span>${esc(teamById(t.h).name)} ${t.hg}–${t.ag} ${esc(teamById(t.a).name)}${t.ps ? ' (p)' : ''}</span><b>${esc(teamById(t.w).short)}</b></div>`;
      }
    }
    if (!comp.done) {
      h = `<div class="section-h">${names[comp.ko.stage]} draw</div>` + comp.ko.ties.map((t) =>
        `<div class="res-row"><span>${esc(teamById(t[0]).name)} v ${esc(teamById(t[1]).name)}</span></div>`).join('') + h;
    }
  }
  const groups = [...comp.groups].sort((a, b) => (b.ids.includes(comp.user) ? 1 : 0) - (a.ids.includes(comp.user) ? 1 : 0));
  for (const g of groups) h += `<div class="section-h">Group ${g.name}</div>` + tableHTML(sortTable(g.table), 2);
  return h;
}

function playCompMatch() {
  const fx = nextFixture(comp);
  const user = compUser(), opp = teamById(fx.opp);
  launchMatch({
    user, opp, lineup: comp.lineup, userHome: fx.home, difficulty: comp.difficulty, halfSeconds: comp.halfSeconds || 120,
    onEnd: (r) => {
      const scorers = r.events.filter((e) => e.side === 0 && !e.scorer.includes('(OG)')).map((e) => e.scorer);
      const detail = scorerLine(r, user, opp);
      if (fx.knockout && r.hg === r.ag) {
        comp.pendingPens = { ug: r.hg, og: r.ag, scorers };
        saveComp();
        showMatchResult({ user, opp, ug: r.hg, og: r.ag, detail, extra: "It's level — penalties!", button: '🥅 Take the penalties', onContinue: startCompPens });
        return;
      }
      recordResult(comp, r.hg, r.ag, scorers);
      saveComp();
      showMatchResult({ user, opp, ug: r.hg, og: r.ag, detail, onContinue: showHub });
    },
    onQuit: () => showHub(),
  });
}

function simCompMatch() {
  const user = compUser();
  const r = simulateUserMatch(comp);
  saveComp();
  const opp = teamById(r.opp);
  const detail = (r.scorers.length ? `⚽ ${r.scorers.map((s) => esc(s.split(' ').slice(-1)[0])).join(', ')}` : '') + (r.pens ? ` · penalties ${r.ps}` : '');
  showMatchResult({ user, opp, ug: r.ug, og: r.og, detail: detail || 'Simulated', extra: 'Simulated result', onContinue: showHub });
}

const penTeam = (t) => ({ id: t.short, name: t.name, shirt: t.home[0], shorts: t.home[2], socks: t.home[3], flag: [t.home[0], t.home[1] || t.home[2], t.home[2]] });

function startCompPens() {
  const fx = nextFixture(comp);
  const user = compUser(), opp = teamById(fx.opp);
  const adapter = {
    user: penTeam(user), round: 1,
    currentOpponent: () => penTeam(opp),
    keeperSkill: () => KEEPER_SKILL[comp.difficulty],
    opponentSkill: () => ({ easy: 0.3, medium: 0.55, hard: 0.75 })[comp.difficulty],
  };
  pensActive = true;
  play(() => new ShootoutMode(ui, adapter, (su, so) => {
    pensActive = false;
    const p = comp.pendingPens;
    delete comp.pendingPens;
    recordResult(comp, p.ug, p.og, p.scorers, su > so ? 'user' : 'opp', `${su}-${so}`);
    saveComp();
    game.setMode(null); idleScene(); ui.shootout(null);
    showMatchResult({ user, opp, ug: p.ug, og: p.og, detail: `Penalties: ${su}–${so}`, extra: su > so ? 'Won on penalties!' : 'Lost on penalties', onContinue: showHub });
    $('resultsIcon').textContent = su > so ? '🎉' : '😞';
    $('resultsTitle').textContent = su > so ? 'Through on penalties!' : 'Out on penalties';
  }));
}

document.querySelectorAll('[data-comp]').forEach((b) => b.addEventListener('click', () => {
  initAudio(); sfx('click');
  const key = b.dataset.comp;
  if (key === 'friendly') startFriendlyFlow(); else startCompetitionFlow(key);
}));
$('continueComp').onclick = () => {
  initAudio(); sfx('click');
  try { showHub(); } catch {
    // a damaged save (e.g. from a hand-edited save code) shouldn't lock the player out
    comp = null; saveComp();
    alert('The saved league/cup progress was damaged and has been cleared. Your trophies and records are safe.');
    idleScene(); show('menu');
  }
};
$('hubMenu').onclick = () => { sfx('click'); idleScene(); show('menu'); };
$('hubQuit').onclick = () => {
  if (!confirm('Abandon this competition? Progress will be lost.')) return;
  comp = null; saveComp(); sfx('click'); show('matchMenu');
};

// ======================================================================
// Player profiles: create, switch, rename, delete, move between devices
// ======================================================================

/** Promise-based dialog. Returns the entered text (or '' for plain confirms), or null if cancelled. */
function dialog({ title, text = '', input = null, area = null, ok = 'OK', cancel = 'Cancel', validate = null }) {
  return new Promise((resolve) => {
    const inp = $('dlgInput'), ta = $('dlgArea');
    $('dlgTitle').textContent = title;
    $('dlgText').textContent = text;
    $('dlgError').textContent = '';
    inp.classList.toggle('hidden', !input); ta.classList.toggle('hidden', !area);
    if (input) { inp.value = input.value || ''; inp.placeholder = input.placeholder || ''; }
    if (area) { ta.value = area.value || ''; ta.readOnly = !!area.readOnly; ta.placeholder = area.placeholder || ''; }
    $('dlgOk').textContent = ok;
    $('dlgCancel').textContent = cancel;
    $('dlgCancel').classList.toggle('hidden', !cancel);
    $('dialog').classList.remove('hidden');
    const done = (v) => { $('dialog').classList.add('hidden'); inp.onkeydown = null; resolve(v); };
    $('dlgOk').onclick = async () => {
      sfx('click');
      const v = input ? inp.value : area ? ta.value : '';
      if (validate) {
        const err = await validate(v);
        if (err) { $('dlgError').textContent = err; return; }
      }
      done(v);
    };
    $('dlgCancel').onclick = () => { sfx('click'); done(null); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') $('dlgOk').click(); };
    if (input) setTimeout(() => { inp.focus(); inp.select(); }, 50);
    if (area && area.readOnly) setTimeout(() => { ta.focus(); ta.select(); }, 50);
  });
}

function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function profileSummary(id) {
  const d = profileData(id);
  const n = (d.stats.cups || 0) + (d.stats.titles || 0);
  const bits = [`🏆 ${n} troph${n === 1 ? 'y' : 'ies'}`];
  if (d.stats.target) bits.push(`🎯 ${d.stats.target}`);
  const c = validComp(d.comp) ? d.comp : null;
  let prog = '';
  if (c) {
    let label = 'finished';
    try { const fx = c.done || c.out ? null : nextFixture(c); if (fx) label = fx.label; } catch { label = '?'; }
    prog = `${COMPETITIONS[c.key].name} with ${esc(teamById(c.user).name)} · ${esc(label)}`;
  }
  return bits.join(' · ') + (prog ? `<br>${prog}` : '');
}

function showProfiles() {
  const list = listProfiles();
  const canDelete = list.length > 1;
  $('profileList').innerHTML = list.map((p) => `
    <div class="profile ${p.active ? 'active' : ''}" data-id="${esc(p.id)}">
      <div class="p-head"><span class="p-name">${esc(p.name)}</span>${p.active ? '<span class="p-badge">PLAYING NOW</span>' : ''}</div>
      <div class="p-info">${profileSummary(p.id)}<br>Last played ${timeAgo(p.updated)}</div>
      <div class="p-btns">
        ${p.active ? '' : '<button class="play" data-act="play">▶ Play as this player</button>'}
        <button data-act="rename">✎ Rename</button>
        ${canDelete ? '<button class="del" data-act="delete">🗑 Delete</button>' : ''}
      </div>
    </div>`).join('');
  show('profiles');
}

/** Switching profile reloads the page so every screen picks up the new player's data cleanly. */
function reloadAsProfile(id) {
  switchProfile(id);
  location.reload();
}

$('profileList').onclick = async (e) => {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  sfx('click');
  const id = btn.closest('.profile').dataset.id;
  const p = listProfiles().find((x) => x.id === id);
  if (!p) return;
  if (btn.dataset.act === 'play') reloadAsProfile(id);
  else if (btn.dataset.act === 'rename') {
    const name = await dialog({ title: 'Rename player', input: { value: p.name, placeholder: 'Name' }, ok: 'Save',
      validate: (v) => (v.trim() ? null : 'Type a name') });
    if (name !== null) { renameProfile(id, name); refreshMenu(); showProfiles(); }
  } else if (btn.dataset.act === 'delete') {
    const yes = await dialog({ title: `Delete ${p.name}?`, text: 'All of their trophies, best scores and league progress will be gone for good.', ok: 'Delete' });
    if (yes === null) return;
    const wasActive = p.active;
    deleteProfile(id);
    if (wasActive) location.reload(); else showProfiles();
  }
};

$('newProfile').onclick = async () => {
  sfx('click');
  const name = await dialog({ title: 'New player', text: 'A fresh start: no trophies, no records, no league in progress. Your other players stay as they are.',
    input: { value: '', placeholder: `Player ${listProfiles().length + 1}` }, ok: 'Create' });
  if (name === null) return;
  const p = createProfile(name);
  reloadAsProfile(p.id);
};

$('exportProfile').onclick = async () => {
  sfx('click');
  const code = exportCode();
  try { await navigator.clipboard.writeText(code); } catch { /* the code is still shown to copy by hand */ }
  await dialog({ title: `Save code for ${activeProfile().name}`,
    text: 'Copied! Paste it into "Load code" on another phone or computer to carry on there. Anyone with this code gets a copy of this player.',
    area: { value: code, readOnly: true }, ok: 'Done', cancel: '' });
};

$('importProfile').onclick = async () => {
  sfx('click');
  let created = null;
  const v = await dialog({ title: 'Load a save code', text: 'Paste a save code from another device. It is added as a new player; nothing here is overwritten.',
    area: { value: '', placeholder: 'JJF1.…' }, ok: 'Load',
    validate: (code) => { try { created = importCode(code); return null; } catch (err) { return err.message; } } });
  if (v !== null && created) reloadAsProfile(created.id);
};

// ---------------- boot ----------------
idleScene();
if (!settings.seenHowto) { settings.seenHowto = true; save('jjf.settings', settings); show('howto'); }
else show('menu');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
