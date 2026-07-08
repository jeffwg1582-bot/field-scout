// POST /.netlify/functions/backup  (owner) — safety-net store for the owner's OWN captures,
// so an iOS local-storage wipe / re-login never loses an in-flight photo.
// Photos are downscaled (~50-200KB) and held in Netlify Blobs under backup/<id> until the lead
// is approved or discarded (then cleared automatically). Ops: put | del | list | prune.
import { getStore } from '@netlify/blobs';
import { OWNER_PASSCODE, json } from './_lib.mjs';

const PREFIX = 'backup/';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const pass = b.pass || req.headers.get('x-owner-pass') || '';
  if (OWNER_PASSCODE && pass !== OWNER_PASSCODE) return json({ error: 'unauthorized' }, 401);

  const store = getStore('field-scout');
  const op = b.op || 'put';
  try {
    if (op === 'put') {
      const l = b.lead;
      if (!l || !l.id) return json({ error: 'lead+id required' }, 400);
      await store.setJSON(PREFIX + l.id, { lead: l, ts: new Date().toISOString() });
      return json({ ok: true, id: l.id });
    }
    if (op === 'del') {
      if (!b.id) return json({ error: 'id required' }, 400);
      await store.delete(PREFIX + b.id);
      return json({ ok: true });
    }
    if (op === 'list') {
      const { blobs = [] } = await store.list({ prefix: PREFIX });
      const leads = [];
      let bytes = 0;
      for (const bl of blobs) {
        const rec = await store.get(bl.key, { type: 'json' });
        if (rec && rec.lead) { leads.push(rec.lead); bytes += JSON.stringify(rec).length; }
      }
      return json({ ok: true, count: leads.length, bytes, leads });
    }
    if (op === 'prune') {
      const days = Number(b.days || 30);
      const cutoff = Date.now() - days * 86400000;
      const { blobs = [] } = await store.list({ prefix: PREFIX });
      let removed = 0;
      for (const bl of blobs) {
        const rec = await store.get(bl.key, { type: 'json' });
        const when = Date.parse((rec && (rec.ts || (rec.lead && rec.lead.captured))) || '') || 0;
        if (when && when < cutoff) { await store.delete(bl.key); removed++; }
      }
      return json({ ok: true, removed });
    }
    return json({ error: 'unknown op' }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
