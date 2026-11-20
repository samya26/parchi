import { useEffect, useState } from 'react';
import { readPrescription, isPreview } from '../lib/read.js';

const LINES = ['Cleaning up the photo…', 'Finding each medicine line…', 'Reading the handwriting…', 'Decoding the doctor’s shorthand…'];

export default function Reading({ image, preset, onDone, onBack }) {
  const [msg, setMsg] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setMsg((m) => Math.min(m + 1, LINES.length - 1)), 900);
    let alive = true;
    (async () => {
      try {
        const r = preset ? (await new Promise((res) => setTimeout(res, 3200)), preset) : await readPrescription(image);
        if (alive) onDone({ medicines: r.medicines || [], advice: r.advice || [] });
      } catch (e) {
        if (!alive) return;
        if (isPreview() && e.kind !== 'server') {
          setError({ msg: 'Live reading needs the deployed app (it calls the AI from a server). In this preview, try a sample prescription or type the medicines instead.' });
        } else {
          setError({ msg: e.kind === 'network'
            ? 'The connection dropped while Parchi was reading. Check your internet (Wi-Fi works best), keep the screen open, and try again.'
            : 'Parchi couldn’t read this one. Try again with a sharper, well-lit photo — or type the medicines instead.', detail: e.message });
        }
      }
    })();
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <section className="reading">
      <div className={`scan-frame ${error ? 'stopped' : ''}`}>
        {image && <img src={image} alt="Your prescription" />}
        {!error && <div className="beam" />}
      </div>
      {!error ? (
        <>
          <p className="status"><span className="dot" />{LINES[msg]}</p>
          <p className="wait">Messy handwriting can take up to a minute. Keep this screen open.</p>
        </>
      ) : (
        <div className="error">
          <p>{error.msg}</p>
          {error.detail && <p className="detail">Details (for fixing): {error.detail}</p>}
          <button className="primary" onClick={onBack}>Back</button>
        </div>
      )}
    </section>
  );
}
