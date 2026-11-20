import { useEffect, useRef, useState } from 'react';
import { shrink } from '../lib/read.js';
import { useReveal } from '../lib/reveal.js';

const BASE = import.meta.env.BASE_URL;

// The hero "decoder": doctor shorthand turns into plain words, on a loop.
const DEMOS = [
  { code: '1-0-1 × 5d PC', plain: ['🌅 Morning', '🌙 Night', 'After food', '5 days'] },
  { code: 'BD × 1 wk AC', plain: ['🌅 Morning', '🌙 Night', 'Before food', '7 days'] },
  { code: '0-0-1 HS', plain: ['🌙 At bedtime'] },
  { code: 'SOS', plain: ['Only when needed'] },
];

function Decoder() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % DEMOS.length), 2600); return () => clearInterval(t); }, []);
  const d = DEMOS[i];
  return (
    <div className="decoder rv" aria-hidden="true">
      <div className="dec-code" key={'c' + i}><span>Doctor wrote</span><b>{d.code}</b></div>
      <div className="dec-arrow">↓</div>
      <div className="dec-plain" key={'p' + i}>{d.plain.map((p, k) => <i key={p} style={{ animationDelay: `${0.25 + k * 0.12}s` }}>{p}</i>)}</div>
    </div>
  );
}

export default function Home({ onImage, onManual }) {
  const input = useRef();
  const [samples, setSamples] = useState([]);
  useEffect(() => { fetch(BASE + 'samples/samples.json').then((r) => r.json()).then(setSamples).catch(() => {}); }, []);
  useReveal([samples.length]);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (f) onImage(await shrink(f));
  };

  return (
    <section className="home">
      <div className="hero">
        <h1 className="rv">Can't read your <em>prescription?</em></h1>
        <p className="lede rv">Snap it. Parchi explains every medicine in plain words.</p>
      </div>

      <Decoder />

      <button className="scan-btn rv" onClick={() => input.current.click()}>
        <span className="cam">📷</span>
        <span><b>Scan a prescription</b><small>Photo or upload</small></span>
        <span className="go">→</span>
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={pick} />

      <div className="row-head rv"><span>Try a sample</span><button className="link-btn" onClick={onManual}>or type names</button></div>
      <div className="hscroll stagger">
        {samples.map((s) => (
          <button key={s.id} className="sample rv" onClick={() => onImage(BASE + s.image, s.reading)}>
            <img src={BASE + s.image} alt="" />
            <span>{s.title}<small>{s.reading.medicines.length} medicines</small></span>
          </button>
        ))}
      </div>

      <div className="row-head rv"><span>What you get</span></div>
      <div className="hscroll stagger feats">
        <div className="feat rv"><i>✍️</i><b>Reads handwriting</b><p>Even the messy kind.</p></div>
        <div className="feat rv"><i>🗓️</i><b>Daily plan</b><p>Morning, noon, night.</p></div>
        <div className="feat rv"><i>⏰</i><b>Reminders</b><p>For the whole course.</p></div>
        <div className="feat rv"><i>💸</i><b>Save money</b><p>Same salt, cheaper brand.</p></div>
      </div>
    </section>
  );
}
