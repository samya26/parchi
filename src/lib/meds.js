// Medicine lookup over the sharded dataset in /data (built by scripts/build_data.py).
const base = (import.meta.env?.BASE_URL ?? '/') + 'data/';
const cache = new Map();
async function get(path) {
  if (!cache.has(path)) cache.set(path, fetch(base + path).then((r) => { if (!r.ok) throw new Error(path); return r.json(); }));
  return cache.get(path);
}

let meta;
export async function getMeta() { return (meta ||= await get('meta.json')); }

export const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s = '') => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i + 2); out.set(b, (out.get(b) || 0) + 1); }
  return out;
}
function dice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a), B = bigrams(b);
  let inter = 0;
  for (const [k, v] of A) inter += Math.min(v, B.get(k) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

// Fuzzy search: handles small OCR mistakes ("Augmentine 625", "pan40", "montair-lc").
const FORM_WORDS = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|syp|syrup|susp|inj|injection|oint|ointment|cream|gel|drops?|t\.)\b\.?/g;
const cleanQuery = (q) => q.toLowerCase().replace(FORM_WORDS, ' ').replace(/(\d+(?:\.\d+)?)\s*(mg|mcg|ml|gm|g|%)\b/g, '$1').replace(/\s+/g, ' ').trim();

// Fuzzy search: handles small OCR mistakes ("Augmentine 625mg", "pan40", "montair-lc").
export async function searchMedicine(query, limit = 5) {
  const cq = cleanQuery(query);
  const q = norm(cq);
  if (!q) return [];
  const first = /[a-z]/.test(q[0]) ? q[0] : '0';
  let shard;
  try { shard = await get(`names/${first}.json`); } catch (e) { return []; }
  const qWords = words(cq);
  const brand = qWords.find((w) => /[a-z]/.test(w)) || '';
  const qNums = cq.match(/\d+(?:\.\d+)?/g) || [];
  const scored = [];
  for (const [name, gid, idx] of shard) {
    const n = norm(name);
    const nWords = words(name);
    let s = dice(q, n.slice(0, q.length + 6));
    if (n.startsWith(q)) s += 0.35;
    // the brand word matters most ("Augmentin" must beat "Augumed")
    const bw = nWords[0] || '';
    const b = dice(brand, bw);
    s += b >= 0.99 ? 0.45 : b >= 0.8 ? 0.2 : 0;
    // strengths like 625 / 40 must agree
    if (qNums.length) {
      const ok = qNums.every((x) => nWords.some((w) => w === x || w.startsWith(x)));
      s += ok ? 0.15 : -0.3;
    }
    if (s > 0.45) scored.push({ name, gid, idx, score: s });
  }
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  const seen = new Set();
  return scored.filter((r) => (seen.has(r.name) ? false : seen.add(r.name))).slice(0, limit);
}

export async function getGroup(gid) {
  const m = await getMeta();
  const shard = await get(`groups/${gid % m.groups}.json`);
  return shard[gid];
}

// item: [name, price, maker, pack, unitPrice, unitType, discontinued]
export async function getProduct(gid, idx) {
  const g = await getGroup(gid);
  const [name, price, maker, pack, unitPrice, unitType, disc] = g.i[idx];
  return { gid, idx, name, price, maker, pack, unitPrice, unitType, disc: !!disc, composition: g.c, form: g.f };
}

export async function getAlternatives(gid, idx, limit = 5) {
  const m = await getMeta();
  const g = await getGroup(gid);
  const me = g.i[idx];
  const big = new Set(m.bigMakers);
  const all = g.i
    .map(([name, price, maker, pack, unitPrice, unitType, disc], i) => ({ i, name, price, maker, pack, unitPrice, unitType, disc: !!disc, big: big.has(maker) }))
    .filter((x) => !x.disc && x.i !== idx && x.unitPrice && x.unitType === me[5]);
  all.sort((a, b) => a.unitPrice - b.unitPrice);
  // Prices far below the typical price are usually data errors (wrong pack size) — leave them out.
  const median = all.length ? all[Math.floor(all.length / 2)].unitPrice : 0;
  const sane = all.filter((x) => x.unitPrice >= median * 0.3);
  const trusted = sane.filter((x) => x.big).slice(0, 2);
  const cheapest = sane.filter((x) => !trusted.includes(x)).slice(0, limit);
  return { composition: g.c, form: g.f, total: g.i.length, median, cheapest, trusted, mine: { unitPrice: me[4], unitType: me[5], price: me[1] } };
}
