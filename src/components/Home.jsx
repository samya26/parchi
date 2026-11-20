import { useEffect, useRef, useState } from 'react';
import { shrink } from '../lib/read.js';

export default function Home({ onImage, onManual }) {
  const input = useRef();
  const [samples, setSamples] = useState([]);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'samples/samples.json').then((r) => r.json()).then(setSamples).catch(() => {});
  }, []);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (f) onImage(await shrink(f));
  };

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">Your prescription, explained</p>
        <h1>Can't read what the doctor wrote? <em>Parchi can.</em></h1>
        <p className="lede">Snap your prescription. Parchi reads the handwriting, turns <span className="code">1-0-1 × 5d PC</span> into plain words, builds your medicine schedule, sets reminders, and shows cheaper medicines with the exact same salt.</p>
      </div>

      <button className="scan-btn" onClick={() => input.current.click()}>
        <span className="cam">📷</span>
        <span><b>Scan a prescription</b><small>Take a photo or upload one</small></span>
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={pick} />

      <div className="or"><span>or try a sample</span></div>
      <div className="samples">
        {samples.map((s) => (
          <button key={s.id} className="sample" onClick={() => onImage(import.meta.env.BASE_URL + s.image, s.reading)}>
            <img src={import.meta.env.BASE_URL + s.image} alt="" />
            <span>{s.title}<small>{s.reading.medicines.length} medicines</small></span>
          </button>
        ))}
      </div>
      <button className="link-btn" onClick={onManual}>Type medicine names instead →</button>

      <ul className="how">
        <li><i>1</i><div><b>Reads the handwriting</b><p>AI finds each medicine and the doctor's shorthand.</p></div></li>
        <li><i>2</i><div><b>You check it</b><p>See the original scribble next to what Parchi read. Fix anything.</p></div></li>
        <li><i>3</i><div><b>Plan, reminders & savings</b><p>A daily schedule, calendar reminders and same-salt alternatives.</p></div></li>
      </ul>
    </section>
  );
}
