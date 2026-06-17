// POST /.netlify/functions/process  — a scout uploads one raw photo + note (no AI, no key).
import { getStore } from '@netlify/blobs';
import { json } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const { image, mediaType = 'image/jpeg', note = '', scout = '', neighborhood = '', area = '' } = b;
  if (!image) return json({ error: 'no image' }, 400);
  if (!note.trim()) return json({ error: 'a note is required' }, 400);

  const id = 'S' + Date.now() + Math.random().toString(36).slice(2, 7);
  const sub = { id, image, mediaType, note: note.trim(), scout, neighborhood, area, captured: new Date().toISOString() };
  await getStore('field-scout').setJSON('inbox/' + id, sub);
  return json({ ok: true, id });
};
