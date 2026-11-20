// Vercel serverless function: sends the prescription photo to Gemini and returns structured JSON.
// Set GEMINI_API_KEY in Vercel → Project → Settings → Environment Variables.
// Optional: GEMINI_MODEL. If the model isn't available, we automatically pick a current "flash" model.
// Health check: open /api/read in a browser (GET) to see if the key and model work.
export const config = { maxDuration: 60 };

const API = 'https://generativelanguage.googleapis.com/v1beta';

const PROMPT = `You are reading a photo of an Indian doctor's prescription (it may be handwritten, messy, or partly printed).
Extract ONLY the prescribed medicines. Do NOT return the patient's or doctor's name, phone, or any personal details.
For each medicine return:
- as_written: exactly what is written for the medicine line, as best you can read it
- name: the most likely Indian brand or generic name, with strength (e.g. "Augmentin 625 Duo", "Pan 40", "Dolo 650")
- form: tablet / capsule / syrup / injection / drops / cream / spray / other (from "Tab", "Cap", "Syp", "Inj" etc.)
- dosage_as_written: the dosage exactly as written (e.g. "1-0-1", "BD", "TDS", "5ml TDS", "SOS", "HS", "1 puff - 1 puff")
- amount: amount per dose if not a whole tablet (e.g. "5 ml", "½ tab", "1 puff"), else ""
- duration_as_written: e.g. "x 5 days", "1 week", "15 days", "" if missing
- food: "before" / "after" / "with" / "" (AC = before, PC = after)
- confidence: 0 to 1, how sure you are about the medicine name
- box_2d: [ymin, xmin, ymax, xmax] of that medicine line in the image, normalized 0-1000
Also return "advice": short general instructions the doctor wrote (e.g. "plenty of fluids"), without personal details.
If something is unreadable, still include it with low confidence instead of guessing confidently.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    medicines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          as_written: { type: 'STRING' }, name: { type: 'STRING' }, form: { type: 'STRING' },
          dosage_as_written: { type: 'STRING' }, amount: { type: 'STRING' }, duration_as_written: { type: 'STRING' },
          food: { type: 'STRING' }, confidence: { type: 'NUMBER' },
          box_2d: { type: 'ARRAY', items: { type: 'NUMBER' } },
        },
        required: ['as_written', 'name', 'dosage_as_written', 'confidence'],
      },
    },
    advice: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['medicines'],
};

let cachedModel = null;

async function listFlashModels(key) {
  const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  const j = await r.json();
  if (!r.ok) throw new Error(`ListModels ${r.status}: ${j.error?.message || 'failed'}`);
  const names = (j.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => /flash/.test(n) && !/(image|tts|live|audio|embedding|omni|exp)/.test(n));
  // Prefer the stable alias, then plain "gemini-X.Y-flash" (newest first), then "-lite", then anything else.
  const ver = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
  const rank = (n) => (n === 'gemini-flash-latest' ? 0 : /^gemini-\d+(\.\d+)?-flash$/.test(n) ? 1 : /^gemini-\d+(\.\d+)?-flash-lite$/.test(n) ? 2 : 3);
  return names.sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a));
}

async function generate(key, model, image, mime) {
  return fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime || 'image/jpeg', data: image } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });
}

function parseJSON(text) {
  const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(clean);
}

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;

  if (req.method === 'GET') {
    if (!key) return res.status(200).json({ ok: false, problem: 'GEMINI_API_KEY is not set in Vercel (Settings → Environment Variables), then redeploy.' });
    try {
      const models = await listFlashModels(key);
      return res.status(200).json({ ok: true, configuredModel: process.env.GEMINI_MODEL || 'gemini-flash-latest', availableFlashModels: models.slice(0, 8) });
    } catch (e) {
      return res.status(200).json({ ok: false, problem: String(e.message || e) });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!key) return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY (add it in Vercel settings, then redeploy).' });

  const { image, mime } = req.body || {};
  if (!image) return res.status(400).json({ error: 'No image received' });

  try {
    // Try the working/configured model first; if it's retired (404) or has no free quota (429),
    // fall back through other current flash models.
    const first = cachedModel || process.env.GEMINI_MODEL || 'gemini-flash-latest';
    let candidates = [first];
    let model, r, j, tried = [];
    const t0 = Date.now();
    for (let i = 0; i < 5 && i < candidates.length && Date.now() - t0 < 40000; i++) {
      model = candidates[i];
      tried.push(model);
      r = await generate(key, model, image, mime);
      j = await r.json().catch(() => ({}));
      const retry = r.status === 404 || r.status === 429 || /not found|not supported/i.test(j.error?.message || '');
      if (!retry) break;
      if (candidates.length === 1) candidates = [first, ...(await listFlashModels(key)).filter((m) => m !== first)];
    }
    if (!r.ok) return res.status(502).json({ error: `Gemini ${r.status}: ${(j.error?.message || 'error').slice(0, 300)}`, tried });
    cachedModel = model;

    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text) return res.status(502).json({ error: `Gemini returned no text (${j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || 'unknown'})`, model });
    const out = parseJSON(text);
    return res.status(200).json({ ...out, model });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
