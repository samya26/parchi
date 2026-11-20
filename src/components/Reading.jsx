import { useEffect, useState } from 'react';
import { readPrescription } from '../lib/read.js';

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
        if (alive) setError(e.message === 'offline' || /404|Unexpected/.test(e.message)
          ? 'Live reading needs the deployed app (it calls the AI from a server). In this preview, try a sample prescription or type the medicines instead.'
          : e.message);
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
        <p className="status"><span className="dot" />{LINES[msg]}</p>
      ) : (
        <div className="error">
          <p>{error}</p>
          <button className="primary" onClick={onBack}>Back</button>
        </div>
      )}
    </section>
  );
}
