import { useEffect, useRef, useState } from 'react';
import { searchMedicine, getProduct } from '../lib/meds.js';
import { decodeDosage, plainLanguage } from '../lib/dosage.js';

let uid = 0;
const fromReading = (m) => ({
  id: ++uid,
  asWritten: m.as_written || '',
  query: m.name || '',
  form: (m.form || '').toLowerCase(),
  dosage: m.dosage_as_written || '',
  amount: m.amount || '',
  duration: m.duration_as_written || '',
  food: m.food || '',
  confidence: typeof m.confidence === 'number' ? m.confidence : null,
  box: m.box_2d || null,
  candidates: null,
  product: null,
  noMatch: false,
  confirmed: false,
});

function Crop({ image, box }) {
  const ref = useRef();
  useEffect(() => {
    if (!image || !box) return;
    const img = new Image();
    img.onload = () => {
      const [y0, x0, y1, x1] = box.map((v) => v / 1000);
      const px = 0.03, py = 0.015;
      const sx = Math.max(0, (x0 - px) * img.width), sy = Math.max(0, (y0 - py) * img.height);
      const sw = Math.min(img.width - sx, (x1 - x0 + 2 * px) * img.width), sh = Math.min(img.height - sy, (y1 - y0 + 2 * py) * img.height);
      const c = ref.current; if (!c) return;
      c.width = sw; c.height = sh;
      c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    };
    img.src = image;
  }, [image, box]);
  if (!image || !box) return null;
  return <div className="crop"><span>What the doctor wrote</span><canvas ref={ref} /></div>;
}

function MedCard({ med, image, onChange, onRemove }) {
  const set = (patch) => onChange({ ...med, ...patch, confirmed: patch.confirmed ?? false });
  const dec = decodeDosage(med.dosage, med.duration, med.food === 'before' ? 'AC' : med.food === 'after' ? 'PC' : '');
  const conf = med.confidence == null ? null : med.confidence >= 0.85 ? 'high' : med.confidence >= 0.6 ? 'mid' : 'low';

  const search = async (q) => {
    const c = await searchMedicine(q, 4);
    const prods = await Promise.all(c.map((x) => getProduct(x.gid, x.idx)));
    const pref = med.form ? prods.findIndex((p) => p.form.startsWith(med.form.slice(0, 4))) : 0;
    const best = prods[pref >= 0 ? pref : 0] || null;
    onChange({ ...med, query: q, candidates: prods, product: best, noMatch: !best, confirmed: false });
  };
  useEffect(() => { if (med.candidates === null && med.query) search(med.query); }, []);

  return (
    <article className={`med ${med.confirmed ? 'ok' : ''}`}>
      <Crop image={image} box={med.box} />
      <div className="med-head">
        <label className="fld grow"><span>Medicine</span>
          <input value={med.query} placeholder="e.g. Dolo 650" onChange={(e) => onChange({ ...med, query: e.target.value, confirmed: false })} onBlur={(e) => e.target.value && search(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(e.target.value)} />
        </label>
        {conf && <span className={`conf ${conf}`}>{conf === 'high' ? 'Clearly read' : conf === 'mid' ? 'Check this' : 'Hard to read'}</span>}
      </div>

      {med.candidates?.length > 0 && (
        <div className="matches">
          <span className="lbl">Matched to</span>
          {med.candidates.slice(0, 3).map((p) => (
            <label key={p.name} className={`match ${med.product?.name === p.name ? 'sel' : ''}`}>
              <input type="radio" name={`m${med.id}`} checked={med.product?.name === p.name} onChange={() => set({ product: p, noMatch: false })} />
              <span><b>{p.name}</b><small>{p.composition} · {p.maker}</small></span>
            </label>
          ))}
          <label className={`match ${med.noMatch ? 'sel' : ''}`}>
            <input type="radio" name={`m${med.id}`} checked={med.noMatch} onChange={() => set({ product: null, noMatch: true })} />
            <span><b>None of these</b><small>Keep it in my schedule without price info</small></span>
          </label>
        </div>
      )}
      {med.candidates?.length === 0 && <p className="hint warn">No match found in the medicine list. Check the spelling, or keep it as is.</p>}

      <div className="dose-grid">
        <label className="fld"><span>Dosage</span><input value={med.dosage} placeholder="1-0-1 / BD / SOS" onChange={(e) => set({ dosage: e.target.value })} /></label>
        <label className="fld"><span>Amount</span><input value={med.amount} placeholder="1 tab / 5 ml" onChange={(e) => set({ amount: e.target.value })} /></label>
        <label className="fld"><span>For how long</span><input value={med.duration} placeholder="5 days" onChange={(e) => set({ duration: e.target.value })} /></label>
        <label className="fld"><span>Food</span>
          <select value={med.food} onChange={(e) => set({ food: e.target.value })}>
            <option value="">Not specified</option><option value="before">Before food</option><option value="after">After food</option><option value="with">With food</option>
          </select>
        </label>
      </div>

      <div className="decoded">
        <p className="plain">{plainLanguage(dec, med.product?.form || med.form, med.amount)}</p>
        {dec.why.length > 0 && <p className="why"><b>How Parchi read it:</b> {dec.why.join(' · ')}</p>}
      </div>

      <div className="med-actions">
        <button className="ghost" onClick={onRemove}>Remove</button>
        <button className={med.confirmed ? 'confirmed' : 'primary'} onClick={() => onChange({ ...med, confirmed: !med.confirmed })}>
          {med.confirmed ? '✓ Confirmed' : 'Looks right'}
        </button>
      </div>
    </article>
  );
}

export default function Confirm({ image, reading, onDone, onBack }) {
  const [meds, setMeds] = useState(() => (reading?.medicines || []).map(fromReading));
  useEffect(() => { if (!meds.length) setMeds([fromReading({})]); }, []);
  const done = meds.filter((m) => m.confirmed).length;
  const update = (m) => setMeds((all) => all.map((x) => (x.id === m.id ? m : x)));

  return (
    <section className="confirm">
      <div className="sec-head">
        <h2>Check what Parchi read</h2>
        <p>Handwriting can be tricky. Compare each line with the original and fix anything that looks wrong — your pharmacist can help too.</p>
      </div>
      {meds.map((m) => (
        <MedCard key={m.id} med={m} image={image} onChange={update} onRemove={() => setMeds((all) => all.filter((x) => x.id !== m.id))} />
      ))}
      <button className="add" onClick={() => setMeds((all) => [...all, fromReading({})])}>+ Add a medicine</button>

      <div className="sticky-cta">
        <button className="ghost" onClick={onBack}>Start over</button>
        <button className="primary big" disabled={!meds.length || done < meds.length} onClick={() => onDone(meds)}>
          {done < meds.length ? `Confirm all (${done}/${meds.length})` : 'Build my plan →'}
        </button>
      </div>
    </section>
  );
}
