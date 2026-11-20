// Sends the photo to /api/read (Gemini, server-side) — or returns the stored reading for demo samples.
export async function shrink(file, max = 1400) {
  const url = typeof file === 'string' ? file : URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}

// True when running inside the claude.ai preview (no server there).
export const isPreview = () => /claude|usercontent|localhost|127\.0\.0\.1/.test(location.hostname) && !location.port.startsWith('3');

export async function readPrescription(dataUrl) {
  const image = dataUrl.split(',')[1];
  let r, text;
  try {
    r = await fetch('/api/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, mime: 'image/jpeg', hint: (() => { try { return localStorage.getItem('parchi-model'); } catch (e) { return null; } })() }) });
    text = await r.text();
  } catch (e) {
    const err = new Error(`Network error: ${e.message}`); err.kind = 'network'; throw err;
  }
  let j = {};
  try { j = JSON.parse(text); } catch (e) { /* non-JSON (e.g. Vercel error page) */ }
  if (!r.ok) {
    const err = new Error(j.error || `Server ${r.status}: ${text.slice(0, 160)}`);
    err.kind = r.status === 404 ? 'missing-api' : 'server';
    throw err;
  }
  try { if (j.model) localStorage.setItem('parchi-model', j.model); } catch (e) {}
  return j;
}
