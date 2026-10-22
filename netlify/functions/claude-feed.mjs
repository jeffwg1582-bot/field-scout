// POST /.netlify/functions/claude-feed — read-and-clear feed for Claude's daily sweep.
// Gated by CLAUDE_FEED_TOKEN (Netlify env var). Never uses OWNER_PASSCODE.
// Body: { token, op: "list" | "clear", ids?: [...] }
//   list  → every raw submission in inbox/ (same shape process.mjs writes) + any backup/ leads
//   clear → delete the given ids from inbox/ (after Claude has pushed them to OT)
import { getStore } from '@netlify/blobs';
import { json } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const TOKEN = process.env.CLAUDE_FEED_TOKEN || '';
  if (!TOKEN || (b.token || '') !== TOKEN) return json({ error: 'unauthorized' }, 401);
  const store = getStore('field-scout');
  const op = b.op || 'list';
  try {
    if (op === 'list') {
      const out = { ok: true, inbox: [], backup: [] };
      const { blobs: ib = [] } = await store.list({ prefix: 'inbox/' });
      for (const x of ib) { const v = await store.get(x.key, { type: 'json' }); if (v) out.inbox.push(v); }
      const { blobs: bb = [] } = await store.list({ prefix: 'backup/' });
      for (const x of bb) { const v = await store.get(x.key, { type: 'json' }); if (v && v.lead) out.backup.push(v.lead); }
      out.inbox.sort((a, c) => (a.captured || '').localeCompare(c.captured || ''));
      return json(out);
    }
    if (op === 'clear') {
      const ids = Array.isArray(b.ids) ? b.ids : [];
      for (const id of ids) await store.delete('inbox/' + id);
      return json({ ok: true, cleared: ids.length });
    }
    return json({ error: 'unknown op' }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
