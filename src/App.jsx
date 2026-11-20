import { useState } from 'react';
import Home from './components/Home.jsx';
import Reading from './components/Reading.jsx';
import Confirm from './components/Confirm.jsx';
import Plan from './components/Plan.jsx';

const STEPS = ['Scan', 'Check', 'Your plan'];

export default function App() {
  const [step, setStep] = useState('home');
  const [image, setImage] = useState(null); // data URL of the prescription photo
  const [reading, setReading] = useState(null); // raw AI reading
  const [meds, setMeds] = useState([]); // confirmed medicines

  const restart = () => { setStep('home'); setImage(null); setReading(null); setMeds([]); window.scrollTo(0, 0); };
  const idx = { home: 0, reading: 0, confirm: 1, plan: 2 }[step];

  return (
    <div className="shell">
      <header className="top">
        <button className="logo" onClick={restart} aria-label="Parchi home">
          <span className="slip">पर्ची</span><span className="word">Parchi</span>
        </button>
        {step !== 'home' && (
          <ol className="steps">
            {STEPS.map((s, i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'on' : ''}><i>{i < idx ? '✓' : i + 1}</i>{s}</li>)}
          </ol>
        )}
      </header>

      <main>
        {step === 'home' && (
          <Home
            onImage={(img, sample) => { setImage(img); setReading(sample || null); setStep('reading'); }}
            onManual={() => { setImage(null); setReading({ medicines: [], advice: [] }); setStep('confirm'); }}
          />
        )}
        {step === 'reading' && (
          <Reading image={image} preset={reading} onDone={(r) => { setReading(r); setStep('confirm'); }} onBack={restart} />
        )}
        {step === 'confirm' && (
          <Confirm image={image} reading={reading} onDone={(m) => { setMeds(m); setStep('plan'); window.scrollTo(0, 0); }} onBack={restart} />
        )}
        {step === 'plan' && <Plan meds={meds} advice={reading?.advice || []} onEdit={() => setStep('confirm')} onRestart={restart} />}
      </main>

      <footer className="foot">
        Parchi helps you <b>understand</b> a prescription. It is not medical advice — always confirm medicines, doses and any switch to an alternative with your doctor or pharmacist.
      </footer>
    </div>
  );
}
