// Sends the photo to /api/read (Gemini, server-side) — or returns the stored reading for demo samples.
export async function shrink(file, max = 1600) {
  const url = typeof file === 'string' ? file : URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}

export async function readPrescription(dataUrl) {
  const image = dataUrl.split(',')[1];
  let r;
  try {
    r = await fetch('/api/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, mime: 'image/jpeg' }) });
  } catch (e) {
    throw new Error('offline');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Could not read the prescription');
  return j;
}
