// Turns doctor shorthand ("1-0-1 x 5d PC", "BD", "TDS AC", "SOS") into plain language.
// Rule-based on purpose: every reading is explainable, and we can show *why* we read it that way.

const SLOT_NAMES = ['morning', 'afternoon', 'night'];
const FRACTIONS = { '½': 0.5, '1/2': 0.5, '¼': 0.25, '1/4': 0.25, '1½': 1.5 };

function num(s) {
  if (s in FRACTIONS) return FRACTIONS[s];
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function decodeDosage(raw = '', durationRaw = '', foodRaw = '') {
  const text = `${raw} ${durationRaw} ${foodRaw}`.trim();
  const t = ` ${text.toLowerCase().replace(/[–—_]/g, '-').replace(/-{2,}/g, '-').replace(/\s*-\s*/g, '-')} `;
  const why = [];
  let m;
  const res = { slots: { morning: 0, afternoon: 0, night: 0 }, asNeeded: false, food: null, days: null, once: false, why };

  // 1) Number pattern: 1-0-1 or 1-1-1-1 (morning-afternoon-(evening)-night)
  const pat = t.match(/(\d(?:\/\d|\.\d)?|½|¼)\s*-\s*(\d(?:\/\d|\.\d)?|½|¼)\s*-\s*(\d(?:\/\d|\.\d)?|½|¼)(?:\s*-\s*(\d(?:\/\d|\.\d)?|½|¼))?/);
  if (pat) {
    const parts = pat.slice(1).filter(Boolean).map(num);
    if (parts.length === 4) {
      res.slots = { morning: parts[0], afternoon: parts[1] + parts[2], night: parts[3] };
    } else {
      res.slots = { morning: parts[0], afternoon: parts[1], night: parts[2] };
    }
    why.push(`"${pat[0].trim()}" = ${parts.length === 4 ? 'morning – afternoon – evening – night' : 'morning – afternoon – night'}`);
  } else if ((m = t.match(/\(?\s*\b([man])\b\s*\)?\s*-\s*\(?\s*\b([man])\b\s*\)?(?:\s*-\s*\(?\s*\b([man])\b\s*\)?)?/))) {
    // Letter style: (M) - (N) = morning and night, M-A-N = morning, afternoon, night
    const map = { m: 'morning', a: 'afternoon', n: 'night' };
    m.slice(1).filter(Boolean).forEach((l) => { res.slots[map[l]] = 1; });
    why.push(`"${m[0].trim()}" = M = morning, A = afternoon, N = night`);
  } else {
    // 2) Latin/Indian shorthand
    const rules = [
      [/\b(qid|qds|4\s*times|four times)\b/, { morning: 1, afternoon: 2, night: 1 }, 'QID = four times a day'],
      [/\b(tds|tid|thrice|3\s*times|three times)\b/, { morning: 1, afternoon: 1, night: 1 }, 'TDS = three times a day'],
      [/\b(bd|bid|b\.d|twice|2\s*times|two times)\b/, { morning: 1, afternoon: 0, night: 1 }, 'BD = twice a day'],
      [/\b(hs|h\.s|bedtime|at night|raat)\b/, { morning: 0, afternoon: 0, night: 1 }, 'HS = at bedtime'],
      [/\b(od|qd|o\.d|once daily|once a day|daily|1\s*time)\b/, { morning: 1, afternoon: 0, night: 0 }, 'OD = once a day'],
    ];
    for (const [re, slots, explain] of rules) {
      if (re.test(t)) { res.slots = { ...slots }; why.push(explain); break; }
    }
  }
  if (/\b(sos|prn|as needed|if needed|when needed|zarurat)\b/.test(t)) {
    res.asNeeded = true; why.push('SOS = only when needed');
  }
  if (/\bstat\b/.test(t)) { res.once = true; why.push('STAT = take one dose immediately'); }

  // 3) Food timing
  if (/\b(ac|a\.c|b\/f|bf|before food|before meal|before breakfast|empty stomach|khali pet|khaali pet)\b/.test(t)) {
    res.food = 'before'; why.push('AC / B/F = before food');
  } else if (/\b(pc|p\.c|a\/f|af|after food|after meal|after breakfast|khane ke baad)\b/.test(t)) {
    res.food = 'after'; why.push('PC / A/F = after food');
  } else if (/\b(with food|with meal)\b/.test(t)) res.food = 'with';

  // 4) Duration
  const d = t.match(/(?:x|×|for)?\s*(\d+)\s*(d\b|days?|din|dins?|w\b|wks?\b|weeks?|m\b|months?|mths?)/);
  if (d) {
    const n = parseInt(d[1], 10), u = d[2];
    res.days = u.startsWith('w') ? n * 7 : (u.startsWith('m') ? n * 30 : n);
    why.push(`"${d[0].trim()}" = ${res.days} days`);
  }
  return res;
}

const word = (n) => (n === 0.5 ? 'half' : n === 0.25 ? 'quarter' : n === 1.5 ? '1½' : String(n));

export function unitWord(form = '') {
  if (form.startsWith('capsule')) return ['capsule', 'capsules'];
  if (form.startsWith('syrup') || form.startsWith('suspension') || form.startsWith('solution')) return ['dose', 'doses'];
  if (form.startsWith('drops')) return ['dose', 'doses'];
  if (form.startsWith('cream') || form.startsWith('gel') || form.startsWith('ointment') || form.startsWith('lotion')) return ['application', 'applications'];
  if (form.startsWith('inhaler') || form.startsWith('respules')) return ['puff', 'puffs'];
  return ['tablet', 'tablets'];
}

export function plainLanguage(dec, form, amount) {
  const [one, many] = unitWord(form);
  const taken = SLOT_NAMES.filter((s) => dec.slots[s] > 0);
  const what = amount || '';
  const topical = /^(cream|gel|ointment|lotion)/.test(form || '');
  const parts = taken.map((s) => {
    const n = dec.slots[s];
    const unit = what ? what : `${word(n)} ${n > 1 ? many : one}`;
    const when = s === 'morning' ? 'in the morning' : s === 'afternoon' ? 'in the afternoon' : 'at night';
    return `${unit} ${when}`;
  });
  let s = '';
  if (dec.once) s = `Take one dose right away`;
  else if (topical && taken.length) {
    const whens = taken.map((x) => (x === 'morning' ? 'in the morning' : x === 'afternoon' ? 'in the afternoon' : 'at night'));
    s = 'Apply on the affected area ' + (whens.length > 1 ? whens.slice(0, -1).join(', ') + ' and ' + whens.at(-1) : whens[0]);
  } else if (parts.length) s = 'Take ' + (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0]);
  if (dec.asNeeded) s = s ? `${s} — only when needed` : 'Take only when needed (e.g. for fever or pain)';
  if (!s) s = 'Ask your pharmacist how often to take this';
  if (dec.food === 'before') s += ', before food';
  if (dec.food === 'after') s += ', after food';
  if (dec.food === 'with') s += ', with food';
  if (dec.days) s += `, for ${dec.days} day${dec.days > 1 ? 's' : ''}`;
  return s + '.';
}

export const timesPerDay = (dec) => SLOT_NAMES.filter((s) => dec.slots[s] > 0).length;
