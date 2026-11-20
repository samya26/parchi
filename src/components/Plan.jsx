import { useEffect, useMemo, useState } from 'react';
import { decodeDosage, plainLanguage, unitWord } from '../lib/dosage.js';
import { getAlternatives } from '../lib/meds.js';
import { buildEvents, googleLink, icsFile, SLOT_LABEL } from '../lib/calendar.js';

const ICON = { morning: '🌅', afternoon: '☀️', night: '🌙' };
const inr = (n) => (typeof n !== 'number' || !isFinite(n) ? '—' : '₹' + (n >= 100 ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2).replace(/\.00$/, '')));

function enrich(m) {
  const dec = decodeDosage(m.dosage, m.duration, m.food === 'before' ? 'AC' : m.food === 'after' ? 'PC' : '');
  const name = m.product?.name || m.query || 'Medicine';
  const form = m.product?.form || m.form || 'tablet';
  const perDay = dec.slots.morning + dec.slots.afternoon + dec.slots.night;
  return { ...m, dec, name, form, perDay, plain: plainLanguage(dec, form, m.amount) };
}

function Savings({ med }) {
  const [alt, setAlt] = useState(null);
  useEffect(() => { if (med.product) getAlternatives(med.product.gid, med.product.idx, 4).then(setAlt).catch(() => setAlt({ failed: true })); }, [med.product]);
  if (!med.product) return null;
  if (alt?.failed) return null;
  if (!alt) return <div className="alt loading">Finding same-salt alternatives…</div>;
  if (!alt.mine.unitPrice) {
    return (
      <div className="alt">
        <div className="alt-head"><div><b>{med.name}</b><small>{alt.composition} · {alt.total} brands with this exact salt & form</small></div><div className="mine">{inr(alt.mine.price)}<small>per pack</small></div></div>
        <p className="hint">We can't compare prices fairly for this pack size yet — ask your pharmacist for a cheaper brand with the same salt.</p>
      </div>
    );
  }
  const unit = alt.mine.unitType === 'unit' ? unitWord(alt.form)[0] : alt.mine.unitType;
  const units = alt.mine.unitType === 'unit' && med.dec.days && med.perDay ? med.perDay * med.dec.days : null;
  const trusted = alt.trusted.filter((x) => x.unitPrice < alt.mine.unitPrice);
  const lowest = alt.cheapest.filter((x) => x.unitPrice < alt.mine.unitPrice).slice(0, 3);
  const cheaper = [...trusted, ...lowest];
  const best = trusted[0] || lowest[0];
  const row = (x) => {
    const pct = Math.round((1 - x.unitPrice / alt.mine.unitPrice) * 100);
    return (
      <li key={x.name}>
        <span><b>{x.name}</b><small>{x.maker}</small></span>
        <span className="price">{inr(x.unitPrice)}<small>{pct}% less</small></span>
      </li>
    );
  };
  return (
    <div className="alt">
      <div className="alt-head">
        <div><b>{med.name}</b><small>{alt.composition} · {alt.total} brands with this exact salt & form · typical {inr(alt.median)}</small></div>
        <div className="mine">{inr(alt.mine.unitPrice)}<small>per {unit}</small></div>
      </div>
      {cheaper.length === 0 ? <p className="hint">Your prescribed medicine is already among the cheapest. 👍</p> : (
        <>
          {trusted.length > 0 && <><p className="alt-sub">From large manufacturers</p><ul>{trusted.map(row)}</ul></>}
          {lowest.length > 0 && <><p className="alt-sub">Lowest prices</p><ul>{lowest.map(row)}</ul></>}
        </>
      )}
      {units && best && best.unitPrice < alt.mine.unitPrice && (
        <p className="course-save">For this {med.dec.days}-day course ({units} {unitWord(alt.form)[1]}): <b>{inr(alt.mine.unitPrice * units)}</b> → <b className="g">{inr(best.unitPrice * units)}</b></p>
      )}
    </div>
  );
}

export default function Plan({ meds, advice, onEdit, onRestart }) {
  const list = useMemo(() => meds.map(enrich), [meds]);
  const [times, setTimes] = useState({ morning: '08:00', afternoon: '14:00', night: '21:00' });
  const [copied, setCopied] = useState(false);
  const regular = list.filter((m) => m.perDay > 0);
  const asNeeded = list.filter((m) => m.dec.asNeeded && m.perDay === 0);
  const longest = Math.max(0, ...regular.map((m) => m.dec.days || 0));

  const slots = ['morning', 'afternoon', 'night'].map((slot) => ({
    slot, time: times[slot],
    meds: regular.filter((m) => m.dec.slots[slot] > 0).map((m) => ({
      name: m.name, food: m.dec.food, days: m.dec.days,
      dose: m.amount || `${m.dec.slots[slot]} ${unitWord(m.form)[m.dec.slots[slot] > 1 ? 1 : 0]}`,
    })),
  }));

  // one recurring reminder per slot; length = longest medicine in that slot
  const events = buildEvents(slots.map((s) => ({ ...s, days: Math.max(0, ...s.meds.map((m) => m.days || 0)) || null })));
  const evBySlot = Object.fromEntries(slots.filter((s) => s.meds.length).map((s, i) => [s.slot, events[i]]));
  const icsUrl = useMemo(() => URL.createObjectURL(new Blob([icsFile(events)], { type: 'text/calendar' })), [JSON.stringify(slots)]);

  const shareText = ['🗒️ Medicine plan (made with Parchi)', ...list.map((m) => `• ${m.name}: ${m.plain}`), advice.length ? `Doctor's advice: ${advice.join(', ')}` : '', 'Please confirm with the doctor/pharmacist.'].filter(Boolean).join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {} };

  return (
    <section className="plan">
      <div className="sec-head">
        <h2>Your medicine plan</h2>
        <p>{regular.length} daily medicine{regular.length !== 1 ? 's' : ''}{asNeeded.length ? ` + ${asNeeded.length} only when needed` : ''}{longest ? ` · course of up to ${longest} days` : ''}</p>
      </div>

      <div className="day">
        {slots.map((s) => (
          <div key={s.slot} className={`slot ${s.meds.length ? '' : 'empty'}`}>
            <div className="slot-head">
              <span className="ico">{ICON[s.slot]}</span>
              <b>{SLOT_LABEL[s.slot]}</b>
              <input type="time" value={times[s.slot]} onChange={(e) => setTimes({ ...times, [s.slot]: e.target.value })} aria-label={`${s.slot} time`} />
            </div>
            {s.meds.length ? (
              <ul>
                {s.meds.map((m) => (
                  <li key={m.name}><span className="pill" />{m.name}<small>{m.dose}{m.food ? ` · ${m.food} food` : ''}{m.days ? ` · ${m.days}d` : ''}</small></li>
                ))}
              </ul>
            ) : <p className="none">Nothing</p>}
            {s.meds.length > 0 && evBySlot[s.slot] && (
              <a className="cal" href={googleLink(evBySlot[s.slot])} target="_blank" rel="noopener">＋ Remind me daily</a>
            )}
          </div>
        ))}
      </div>

      {asNeeded.length > 0 && (
        <div className="asneeded">
          <b>Only when needed</b>
          {asNeeded.map((m) => <p key={m.id}><span className="pill sos" />{m.name} — {m.plain}</p>)}
        </div>
      )}

      <div className="reminders">
        <div><b>⏰ Reminders for the whole course</b><p>Adds a daily reminder at each time above, ending when the course ends.</p></div>
        <div className="rem-btns">
          <a className="primary" href={icsUrl} download="parchi-reminders.ics">Add all to calendar</a>
          <a className="ghost" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener">Send plan on WhatsApp</a>
          <button className="ghost" onClick={copy}>{copied ? 'Copied ✓' : 'Copy plan'}</button>
        </div>
      </div>

      <h3 className="h3">In plain words</h3>
      <div className="plain-list">
        {list.map((m) => (
          <div key={m.id} className="plain-item"><b>{m.name}</b><p>{m.plain}</p><small>Doctor wrote: “{[m.dosage, m.amount, m.duration].filter(Boolean).join(' ')}”</small></div>
        ))}
        {advice.length > 0 && <div className="plain-item adv"><b>Doctor's advice</b><p>{advice.join(' · ')}</p></div>}
      </div>

      <h3 className="h3">Save money — same salt, cheaper brands</h3>
      <p className="hint">Same active ingredient, same strength and same form (e.g. tablet vs. SR tablet are never mixed). Prices come from a public medicine dataset and may differ from today's MRP. <b>Ask your doctor or pharmacist before switching.</b></p>
      {list.map((m) => <Savings key={m.id} med={m} />)}

      <div className="sticky-cta">
        <button className="ghost" onClick={onEdit}>← Edit</button>
        <button className="primary big" onClick={onRestart}>Scan another</button>
      </div>
    </section>
  );
}
