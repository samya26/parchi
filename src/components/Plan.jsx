import { useEffect, useMemo, useState } from 'react';
import { decodeDosage, plainLanguage, unitWord } from '../lib/dosage.js';
import { getAlternatives } from '../lib/meds.js';
import { buildEvents, googleLink, icsFile, SLOT_LABEL } from '../lib/calendar.js';
import { useReveal } from '../lib/reveal.js';

const ICON = { morning: '🌅', afternoon: '☀️', night: '🌙' };
const inr = (n) => (typeof n !== 'number' || !isFinite(n) ? '—' : '₹' + (n >= 100 ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2).replace(/\.00$/, '')));
const short = (name) => name.replace(/\s+(tablet|capsule|syrup|suspension|injection|ointment|cream|gel|drops?|spray|solution)s?\b.*$/i, '');

function enrich(m) {
  const dec = decodeDosage(m.dosage, m.duration, m.food === 'before' ? 'AC' : m.food === 'after' ? 'PC' : '');
  const name = m.product?.name || m.query || 'Medicine';
  const form = m.product?.form || m.form || 'tablet';
  const perDay = dec.slots.morning + dec.slots.afternoon + dec.slots.night;
  return { ...m, dec, name, form, perDay, plain: plainLanguage(dec, form, m.amount) };
}

// Compare price per tablet/ml; work out savings for the whole course when we can.
function savingsFor(med, alt) {
  if (!alt || alt.failed || !alt.mine.unitPrice) return null;
  const trusted = alt.trusted.filter((x) => x.unitPrice < alt.mine.unitPrice);
  const lowest = alt.cheapest.filter((x) => x.unitPrice < alt.mine.unitPrice).slice(0, 3);
  const best = trusted[0] || lowest[0];
  const units = alt.mine.unitType === 'unit' && med.dec.days && med.perDay ? med.perDay * med.dec.days : null;
  return { trusted, lowest, best, units, course: units && best ? (alt.mine.unitPrice - best.unitPrice) * units : 0 };
}

function SaveCard({ med, alt }) {
  const s = savingsFor(med, alt);
  const unit = alt.mine.unitType === 'unit' ? unitWord(alt.form)[0] : alt.mine.unitType;
  const row = (x) => (
    <li key={x.name}><span><b>{short(x.name)}</b><small>{x.maker}</small></span><span className="price">{inr(x.unitPrice)}<small>−{Math.round((1 - x.unitPrice / alt.mine.unitPrice) * 100)}%</small></span></li>
  );
  return (
    <article className="save-card rv">
      <div className="sc-top">
        <b>{short(med.name)}</b>
        <small>{alt.composition}</small>
      </div>
      {!s ? <p className="muted">Ask your pharmacist for a cheaper brand with the same salt.</p>
        : !s.best ? <p className="muted">Already one of the cheapest 👍</p>
        : (
          <>
            <div className="vs">
              <div><small>Yours</small><b>{inr(alt.mine.unitPrice)}</b><small>per {unit}</small></div>
              <span>→</span>
              <div className="g"><small>From</small><b>{inr(s.best.unitPrice)}</b><small>per {unit}</small></div>
            </div>
            <ul>{[...s.trusted, ...s.lowest].slice(0, 3).map(row)}</ul>
            {s.course > 0 && <p className="course">Save <b>{inr(s.course)}</b> on this {med.dec.days}-day course</p>}
          </>
        )}
    </article>
  );
}

export default function Plan({ meds, advice, onEdit, onRestart }) {
  const list = useMemo(() => meds.map(enrich), [meds]);
  const [times, setTimes] = useState({ morning: '08:00', afternoon: '14:00', night: '21:00' });
  const [alts, setAlts] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    list.forEach((m) => {
      if (!m.product) return;
      getAlternatives(m.product.gid, m.product.idx, 4).then((a) => setAlts((x) => ({ ...x, [m.id]: a }))).catch(() => setAlts((x) => ({ ...x, [m.id]: { failed: true } })));
    });
  }, [list]);

  const regular = list.filter((m) => m.perDay > 0);
  const asNeeded = list.filter((m) => (m.dec.asNeeded || m.dec.once) && m.perDay === 0);
  const unclear = list.filter((m) => m.perDay === 0 && !m.dec.asNeeded && !m.dec.once);
  const longest = Math.max(0, ...list.map((m) => m.dec.days || 0));
  const totalSave = list.reduce((sum, m) => sum + (savingsFor(m, alts[m.id])?.course || 0), 0);
  const withAlts = list.filter((m) => alts[m.id] && !alts[m.id].failed);
  useReveal([withAlts.length, list.length]);

  const slots = ['morning', 'afternoon', 'night'].map((slot) => ({
    slot, time: times[slot],
    meds: regular.filter((m) => m.dec.slots[slot] > 0).map((m) => ({
      name: m.name, food: m.dec.food, days: m.dec.days,
      dose: m.amount || `${m.dec.slots[slot]} ${unitWord(m.form)[m.dec.slots[slot] > 1 ? 1 : 0]}`,
    })),
  })).filter((s) => s.meds.length);

  const events = buildEvents(slots.map((s) => ({ ...s, days: Math.max(0, ...s.meds.map((m) => m.days || 0)) || null })));
  const icsUrl = useMemo(() => URL.createObjectURL(new Blob([icsFile(events)], { type: 'text/calendar' })), [JSON.stringify(slots)]);
  const shareText = ['🗒️ Medicine plan (Parchi)', ...list.map((m) => `• ${short(m.name)}: ${m.plain}`), advice.length ? `Advice: ${advice.join(', ')}` : '', 'Please confirm with the doctor/pharmacist.'].filter(Boolean).join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) {} };
  const fmt = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

  return (
    <section className="plan">
      <div className="plan-hero rv">
        <h2>Your plan</h2>
        <div className="stats">
          <span><b>{list.length}</b>medicine{list.length !== 1 ? 's' : ''}</span>
          {longest > 0 && <span><b>{longest}</b>days</span>}
          {totalSave > 0 && <span className="g"><b>{inr(totalSave)}</b>to save</span>}
        </div>
      </div>

      <div className="timeline stagger">
        {slots.map((s, i) => (
          <div key={s.slot} className="slot rv">
            <div className="rail"><span className="ico">{ICON[s.slot]}</span>{i < slots.length - 1 && <i />}</div>
            <div className="slot-body">
              <div className="slot-head">
                <b>{SLOT_LABEL[s.slot]}</b>
                <label className="time-chip">{fmt(times[s.slot])}<input type="time" value={times[s.slot]} onChange={(e) => setTimes({ ...times, [s.slot]: e.target.value })} aria-label={`${s.slot} time`} /></label>
              </div>
              {s.meds.map((m) => (
                <div key={m.name} className="dose-row"><span className="pill" /><div><b>{short(m.name)}</b><small>{[m.dose, m.food && `${m.food} food`, m.days && `${m.days} days`].filter(Boolean).join(' · ')}</small></div></div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {asNeeded.length > 0 && (
        <div className="note-card sos rv"><b>Only when needed</b>{asNeeded.map((m) => <p key={m.id}>{short(m.name)} <small>— {m.plain}</small></p>)}</div>
      )}
      {unclear.length > 0 && (
        <div className="note-card ask rv"><b>Ask your pharmacist how often</b>{unclear.map((m) => <p key={m.id}>{short(m.name)} <small>— doctor wrote “{[m.dosage, m.amount, m.duration].filter(Boolean).join(' ')}”</small></p>)}</div>
      )}
      {advice.length > 0 && <div className="advice rv">{advice.map((a) => <span key={a}>{a}</span>)}</div>}

      {slots.length > 0 && (
        <div className="remind rv">
          <div><b>Never miss a dose</b><small>Daily reminders until the course ends</small></div>
          <div className="remind-btns">
            <a className="primary" href={icsUrl} download="parchi-reminders.ics">⏰ Add reminders</a>
            <a className="icon-btn" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener" aria-label="Send on WhatsApp">💬</a>
            <button className="icon-btn" onClick={copy} aria-label="Copy plan">{copied ? '✓' : '⧉'}</button>
          </div>
          {events.length > 0 && <div className="gcal">{slots.map((s, i) => <a key={s.slot} href={googleLink(events[i])} target="_blank" rel="noopener">+ {SLOT_LABEL[s.slot]} in Google Calendar</a>)}</div>}
        </div>
      )}

      {withAlts.length > 0 && (
        <>
          <div className="row-head rv"><span>Save money</span><small>swipe →</small></div>
          <div className="hscroll stagger saves">{withAlts.map((m) => <SaveCard key={m.id} med={m} alt={alts[m.id]} />)}</div>
          <p className="fine rv">Same salt, strength & form. Prices from a public dataset — confirm with your pharmacist before switching.</p>
        </>
      )}

      <div className="sticky-cta">
        <button className="ghost" onClick={onEdit}>← Edit</button>
        <button className="primary big" onClick={onRestart}>Scan another</button>
      </div>
    </section>
  );
}
