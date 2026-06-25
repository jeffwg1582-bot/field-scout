// POST /.netlify/functions/process  — a scout uploads one raw photo + note (no AI, no key).
import { getStore } from '@netlify/blobs';
import { json } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const { image, mediaType = 'image/jpeg', note = '', scout = '', neighborhood = '', area = '' } = b;
  const SCOUT_CODE = process.env.SCOUT_CODE || '';
  if (SCOUT_CODE && (b.code || '') !== SCOUT_CODE) return json({ error: 'Wrong team code — ask the person who invited you.' }, 403);
  if (!image) return json({ error: 'no image' }, 400);
  // note is OPTIONAL now — if blank, the owner's device auto-derives the hook from the photo

  const id = 'S' + Date.now() + Math.random().toString(36).slice(2, 7);
  const sub = { id, image, mediaType, note: note.trim(), scout, neighborhood, area, captured: new Date().toISOString() };
  await getStore('field-scout').setJSON('inbox/' + id, sub);
  return json({ ok: true, id });
};
