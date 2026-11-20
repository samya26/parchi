# Parchi — your prescription, explained

Scan a (handwritten) prescription → Parchi reads it with AI → you confirm each medicine next to the original handwriting → you get a plain-language daily plan, calendar reminders for the whole course, and cheaper medicines with the exact same salt, strength and form.

## How it works
1. **Reading** — `api/read.js` (Vercel serverless) sends the photo to Gemini with a strict JSON schema: medicine name, dosage as written, duration, food timing, confidence and the line's bounding box. No personal details are requested.
2. **Human check** — every medicine shows a crop of the original handwriting, a confidence badge and fuzzy matches from a 2.5 lakh-medicine dataset (`src/lib/meds.js`, bigram similarity + strength-number check).
3. **Dosage decoder** — `src/lib/dosage.js` is rule-based on purpose (1-0-1, BD, TDS, QID, HS, SOS, STAT, AC/PC, "x 5d", "1 month"), so every reading can be explained ("How Parchi read it").
4. **Plan & reminders** — `src/lib/calendar.js` builds one recurring reminder per time slot (Google Calendar link + .ics file).
5. **Same-salt alternatives** — grouped by exact salt + strength + form + release type (SR/ER/MR are never mixed). Price outliers (likely data errors) are dropped.

## Run locally
```
npm install
npm run dev
```
Live reading needs the API: run with `npx vercel dev` and a `GEMINI_API_KEY`.

## Deploy (free) on Vercel
1. Push this folder to a GitHub repo.
2. vercel.com → Add New Project → import the repo (framework: Vite).
3. Settings → Environment Variables → `GEMINI_API_KEY` = your key from aistudio.google.com (optional `GEMINI_MODEL`).
4. Deploy.

## Data
- Medicine data: [Indian-Medicine-Dataset](https://github.com/junioralive/Indian-Medicine-Dataset) (MIT). Rebuild with `python3 scripts/build_data.py <csv> public/data`.
- Sample prescriptions in `public/samples` are fictional (`scripts/make_samples.py`).

Parchi is not medical advice. Always confirm with a doctor or pharmacist.
