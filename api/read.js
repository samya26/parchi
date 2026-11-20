// Vercel serverless function: sends the prescription photo to Gemini and returns structured JSON.
// Set GEMINI_API_KEY in Vercel → Project → Settings → Environment Variables.
// Optional: GEMINI_MODEL (defaults below — change it if Google renames models).
export const config = { maxDuration: 60 };

const PROMPT = `You are reading a photo of an Indian doctor's prescription (it may be handwritten, messy, or partly printed).
Extract ONLY the prescribed medicines. Do NOT return the patient's or doctor's name, phone, or any personal details.
For each medicine return:
- as_written: exactly what is written for the medicine line, as best you can read it
- name: the most likely Indian brand or generic name, with strength (e.g. "Augmentin 625 Duo", "Pan 40", "Dolo 650")
- form: tablet / capsule / syrup / injection / drops / cream / other (from "Tab", "Cap", "Syp", "Inj" etc.)
- dosage_as_written: the dosage exactly as written (e.g. "1-0-1", "BD", "TDS", "5ml TDS", "SOS", "HS")
- amount: amount per dose if not a whole tablet (e.g. "5 ml", "½ tab"), else ""
- duration_as_written: e.g. "x 5 days", "1 week", "" if missing
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });
  const { image, mime } = req.body || {};
  if (!image) return res.status(400).json({ error: 'No image' });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime || 'image/jpeg', data: image } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: j.error?.message || 'Gemini error' });
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '{}';
    return res.status(200).json(JSON.parse(text));
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
