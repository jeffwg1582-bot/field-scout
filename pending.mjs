// GET /.netlify/functions/pending  (owner) — list raw submissions waiting to be processed.
import { getStore } from '@netlify/blobs';
import { json, isOwner } from './_lib.mjs';

export default async (req) => {
  if (!isOwner(req)) return json({ error: 'unauthorized' }, 401);
  const store = getStore('field-scout');
  const { blobs } = await store.list({ prefix: 'inbox/' });
  const subs = [];
  for (const x of blobs) {
    const v = await store.get(x.key, { type: 'json' });
    if (v) subs.push(v);
  }
  subs.sort((a, b) => (a.captured || '').localeCompare(b.captured || ''));
  return json({ ok: true, subs });
};
