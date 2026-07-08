// POST /.netlify/functions/note  (owner) — voice/text field notes + idea storage.
// The Siri Shortcut and the in-app 🎤 both land here. Ops:
//   add        {pass, text, lat?, lng?, via?}     -> stores a RAW note under note/<id> (classified later on the owner's device)
//   list       {pass}                             -> pending raw notes
//   del        {pass, id}                         -> remove a raw note (after the app ingests it)
//   idea       {pass, idea:{title,category,details,captured}} -> files a classified idea under idea/<id>
//   ideas      {pass, all?}                       -> list ideas (default: unarchived only). Also works as GET ?op=ideas&pass=...
//   idea-arch  {pass, id}                         -> archive an idea
//   idea-del   {pass, id}                         -> delete an idea
// Auth = OWNER_PASSCODE (same as backup/ai). No new env vars.
import { getStore } from '@netlify/blobs';
import { OWNER_PASSCODE, json } from './_lib.mjs';

const NOTE = 'note/';
const IDEA = 'idea/';
const rid = (p) => p + Date.now() + Math.random().toString(36).slice(2, 7);

export default async (req) => {
  let b = {};
  if (req.method === 'POST') {
    try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  } else {
    const u = new URL(req.url);
    b = Object.fromEntries(u.searchParams.entries());
  }
  const pass = b.pass || req.headers.get('x-owner-pass') || '';
  if (OWNER_PASSCODE && pass !== OWNER_PASSCODE) return json({ error: 'unauthorized' }, 401);

  const store = getStore('field-scout');
  const op = b.op || 'add';
  try {
    if (op === 'add') {
      const text = (b.text || '').trim();
      if (!text) return json({ error: 'no text' }, 400);
      const id = rid('N');
      await store.setJSON(NOTE + id, {
        id, text,
        lat: b.lat ? Number(b.lat) : null,
        lng: b.lng ? Number(b.lng) : null,
        via: b.via || 'siri',
        captured: new Date().toISOString(),
      });
      return json({ ok: true, id, saved: text.slice(0, 80) });
    }
    if (op === 'list') {
      const { blobs = [] } = await store.list({ prefix: NOTE });
      const notes = [];
      for (const x of blobs) { const v = await store.get(x.key, { type: 'json' }); if (v) notes.push(v); }
      notes.sort((a, c) => (a.captured || '').localeCompare(c.captured || ''));
      return json({ ok: true, notes });
    }
    if (op === 'del') {
      if (!b.id) return json({ error: 'id required' }, 400);
      await store.delete(NOTE + b.id);
      return json({ ok: true });
    }
    if (op === 'idea') {
      const i = b.idea || {};
      if (!i.title && !i.details) return json({ error: 'idea required' }, 400);
      const id = i.id || rid('I');
      await store.setJSON(IDEA + id, {
        id,
        title: i.title || (i.details || '').slice(0, 60),
        category: i.category || 'idea',
        details: i.details || '',
        captured: i.captured || new Date().toISOString(),
        archived: false,
      });
      return json({ ok: true, id });
    }
    if (op === 'ideas') {
      const { blobs = [] } = await store.list({ prefix: IDEA });
      const ideas = [];
      for (const x of blobs) {
        const v = await store.get(x.key, { type: 'json' });
        if (v && (b.all || !v.archived)) ideas.push(v);
      }
      ideas.sort((a, c) => (c.captured || '').localeCompare(a.captured || ''));
      return json({ ok: true, ideas });
    }
    if (op === 'idea-arch') {
      if (!b.id) return json({ error: 'id required' }, 400);
      const v = await store.get(IDEA + b.id, { type: 'json' });
      if (v) { v.archived = true; await store.setJSON(IDEA + b.id, v); }
      return json({ ok: true });
    }
    if (op === 'idea-del') {
      if (!b.id) return json({ error: 'id required' }, 400);
      await store.delete(IDEA + b.id);
      return json({ ok: true });
    }
    return json({ error: 'unknown op' }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
