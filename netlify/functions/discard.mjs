// POST /.netlify/functions/discard  (owner) — drop a raw submission without using it.
import { getStore } from '@netlify/blobs';
import { json, isOwner } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!isOwner(req)) return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!b.id) return json({ error: 'no id' }, 400);
  await getStore('field-scout').delete('inbox/' + b.id);
  return json({ ok: true });
};
