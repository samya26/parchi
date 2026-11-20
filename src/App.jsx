import { Component, useState } from 'react';

// If any screen crashes, show a friendly recovery card instead of a blank page.
class Safe extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="error" style={{ marginTop: 24 }}>
        <p><b>Something went wrong on this screen.</b> Your scan is safe — go back and try again.</p>
        <p className="detail">Details (for fixing): {String(this.state.err.message || this.state.err)}</p>
        <button className="primary" onClick={() => { this.setState({ err: null }); this.props.onBack(); }}>Go back</button>
      </div>
    );
  }
}
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
          <div className="progress" aria-label={`Step ${idx + 1} of 3: ${STEPS[idx]}`}>
            <span className="p-label">{STEPS[idx]}</span>
            <span className="p-dots">{STEPS.map((x, i) => <i key={x} className={i <= idx ? 'on' : ''} />)}</span>
          </div>
        )}
      </header>

      <main key={step} className="page">
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
          <Safe key="confirm" onBack={restart}><Confirm image={image} reading={reading} onDone={(m) => { setMeds(m); setStep('plan'); window.scrollTo(0, 0); }} onBack={restart} /></Safe>
        )}
        {step === 'plan' && (
          <Safe key="plan" onBack={() => setStep('confirm')}>
            <Plan meds={meds} advice={reading?.advice || []} onEdit={() => setStep('confirm')} onRestart={restart} />
          </Safe>
        )}
      </main>

      <footer className="foot">
        Not medical advice — confirm with your doctor or pharmacist.
      </footer>
    </div>
  );
}
