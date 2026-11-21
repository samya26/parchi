import { useEffect, useRef, useState } from 'react';
import { shrink, unlock, getCode } from '../lib/read.js';
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

// Real scanning is locked behind an access code + an "I understand" step (portfolio demo, not a medical tool).
function UnlockSheet({ what, onClose, onPick, onManual }) {
  const [code, setCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState('idle');
  const submit = async (e) => {
    e.preventDefault();
    setState('checking');
    try { if (await unlock(code)) { what === 'type' ? onManual() : setState('ok'); } else setState('wrong'); } catch (err) { setState('wrong'); }
  };
  if (state === 'ok') {
    // iPhones only open the camera from a direct tap, so the last step is a real button.
    return (
      <div className="sheet-bg" onClick={onClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <b className="sheet-title">Unlocked ✓</b>
          <p>Tip: hold the phone flat above the page, no flash, and fill the screen with the handwriting.</p>
          <button className="primary big" onClick={onPick}>📷 Choose a photo</button>
        </div>
      </div>
    );
  }
  return (
    <div className="sheet-bg" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <b className="sheet-title">Scan your own prescription</b>
        <p>Parchi is a <b>student portfolio demo</b>, so real scanning is limited to people with an access code. Everyone can try the samples.</p>
        <label className="fld"><span>Access code</span><input value={code} onChange={(e) => { setCode(e.target.value); setState('idle'); }} placeholder="e.g. word-word-1234" autoCapitalize="none" autoCorrect="off" /></label>
        {state === 'wrong' && <p className="hint warn">That code didn't work.</p>}
        <label className="agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I understand Parchi can misread handwriting and is <b>not medical advice</b>. I'll follow my doctor and pharmacist. My photo is sent to Google Gemini to be read, so I'll cover personal details.</span>
        </label>
        <div className="sheet-btns">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!code.trim() || !agree || state === 'checking'}>{state === 'checking' ? 'Checking…' : 'Continue'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Home({ onImage, onManual }) {
  const input = useRef();
  const [samples, setSamples] = useState([]);
  const [sheet, setSheet] = useState(null); // 'scan' | 'type'
  const unlocked = !!getCode();
  const want = (what) => (unlocked ? (what === 'scan' ? input.current.click() : onManual()) : setSheet(what));
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
        <p className="lede rv">Parchi turns a doctor's scribbles into a plain-words plan.</p>
      </div>

      <Decoder />

      <div className="row-head rv"><span>Try a sample</span><small>swipe →</small></div>
      <div className="hscroll stagger">
        {samples.map((s) => (
          <button key={s.id} className="sample rv" onClick={() => onImage(BASE + s.image, s.reading)}>
            <img src={BASE + s.image} alt="" />
            <span>{s.title}<small>{s.reading.medicines.length} medicines · tap to try</small></span>
          </button>
        ))}
      </div>

      <button className="scan-btn rv" onClick={() => want('scan')}>
        <span className="cam">{unlocked ? '📷' : '🔒'}</span>
        <span><b>Scan your own</b><small>{unlocked ? 'Photo or upload' : 'Needs a demo access code'}</small></span>
        <span className="go">→</span>
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <button className="link-btn center rv" onClick={() => want('type')}>or type medicine names</button>

      <div className="row-head rv"><span>What you get</span></div>
      <div className="hscroll stagger feats">
        <div className="feat rv"><i>✍️</i><b>Reads handwriting</b><p>Even the messy kind.</p></div>
        <div className="feat rv"><i>🗓️</i><b>Daily plan</b><p>Morning, noon, night.</p></div>
        <div className="feat rv"><i>⏰</i><b>Reminders</b><p>For the whole course.</p></div>
        <div className="feat rv"><i>💸</i><b>Save money</b><p>Same salt, cheaper brand.</p></div>
      </div>
      {sheet && <UnlockSheet what={sheet} onClose={() => setSheet(null)} onPick={() => { input.current.click(); setSheet(null); }} onManual={onManual} />}
    </section>
  );
}
