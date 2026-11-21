// Player profiles ("save slots") stored in the browser.
// Each profile keeps its own records, trophies and competition progress.
// Device settings (sound, vibration) stay shared across profiles.
//
// localStorage layout:
//   jjf.profiles   { active: id, list: [{ id, name, created, updated }] }
//   jjf.p.<id>     { stats, comp, cup }

const INDEX = 'jjf.profiles';
const dataKey = (id) => `jjf.p.${id}`;
export const DEFAULT_STATS = { cups: 0, titles: 0, target: 0, crossbar: 0, freekick: 0 };
const MAX_NAME = 24;

let memory = null; // fallback when localStorage is unavailable (private mode)

function read(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return memory?.[key] ?? null; }
}
function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    memory = memory || {};
    if (value === null) delete memory[key]; else memory[key] = value;
  }
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cleanName = (n, fallback) => (String(n ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME)) || fallback;

let index = null;

function saveIndex() { write(INDEX, index); }

function touch(id) {
  const p = index.list.find((x) => x.id === id);
  if (p) { p.updated = Date.now(); saveIndex(); }
}

/** Load the profile index, migrating the old single-save format on first run. */
export function initProfiles() {
  index = read(INDEX);
  if (index && Array.isArray(index.list) && index.list.length) {
    if (!index.list.some((p) => p.id === index.active)) index.active = index.list[0].id;
    return;
  }
  index = { active: null, list: [] };
  // migrate saves from before profiles existed
  const oldStats = read('jjf.stats'), oldComp = read('jjf.comp');
  const p = createProfile('Player 1', { stats: { ...DEFAULT_STATS, ...(oldStats || {}) }, comp: oldComp || null, cup: null });
  index.active = p.id;
  saveIndex();
  if (oldStats) write('jjf.stats', null);
  if (oldComp) write('jjf.comp', null);
  // ask the browser not to evict our data under storage pressure
  try { navigator.storage?.persist?.(); } catch { /* not supported */ }
}

export function listProfiles() { return index.list.map((p) => ({ ...p, active: p.id === index.active })); }
export function activeProfile() { return index.list.find((p) => p.id === index.active); }

export function profileData(id = index.active) {
  const d = read(dataKey(id)) || {};
  return { stats: { ...DEFAULT_STATS, ...(d.stats || {}) }, comp: d.comp ?? null, cup: d.cup ?? null };
}

/** Save one part ('stats' | 'comp' | 'cup') of the active profile. */
export function saveProfilePart(part, value) {
  const id = index.active;
  const d = read(dataKey(id)) || {};
  d[part] = value ?? null;
  write(dataKey(id), d);
  touch(id);
}

export function createProfile(name, data = null) {
  const id = newId(), now = Date.now();
  const p = { id, name: cleanName(name, `Player ${index.list.length + 1}`), created: now, updated: now };
  index.list.push(p);
  write(dataKey(id), data || { stats: { ...DEFAULT_STATS }, comp: null, cup: null });
  saveIndex();
  return p;
}

export function switchProfile(id) {
  if (!index.list.some((p) => p.id === id)) return false;
  index.active = id;
  saveIndex();
  return true;
}

export function renameProfile(id, name) {
  const p = index.list.find((x) => x.id === id);
  if (!p) return;
  p.name = cleanName(name, p.name);
  saveIndex();
}

/** Delete a profile. The last remaining profile can't be deleted (reset it instead). */
export function deleteProfile(id) {
  if (index.list.length <= 1) return false;
  index.list = index.list.filter((p) => p.id !== id);
  write(dataKey(id), null);
  if (index.active === id) index.active = index.list[0].id;
  saveIndex();
  return true;
}

/** Wipe a profile's progress but keep its name. */
export function resetProfile(id) {
  write(dataKey(id), { stats: { ...DEFAULT_STATS }, comp: null, cup: null });
  touch(id);
}

// ---------------------------------------------------------------- transfer codes
// A save code is the profile's data as base64 JSON, so progress can be moved to another device.

export function exportCode(id = index.active) {
  const p = index.list.find((x) => x.id === id);
  const payload = { v: 1, name: p?.name, data: profileData(id) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return 'JJF1.' + btoa(bin);
}

/** Import a save code as a new profile. Returns the new profile, or throws on a bad code. */
export function importCode(code) {
  const raw = String(code || '').trim().replace(/\s+/g, '');
  if (!raw.startsWith('JJF1.')) throw new Error('That is not a JJ Football save code.');
  let payload;
  try {
    const bin = atob(raw.slice(5));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('The save code is damaged. Copy it again, all of it.');
  }
  const d = payload?.data;
  if (!d || typeof d !== 'object' || typeof d.stats !== 'object') throw new Error('The save code is damaged.');
  const stats = {};
  for (const k of Object.keys(DEFAULT_STATS)) stats[k] = Math.max(0, Math.floor(+d.stats[k] || 0));
  const comp = d.comp && typeof d.comp === 'object' ? d.comp : null;
  const cup = d.cup && typeof d.cup === 'object' ? d.cup : null;
  return createProfile(payload.name || 'Imported player', { stats, comp, cup });
}
