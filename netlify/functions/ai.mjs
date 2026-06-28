// POST /.netlify/functions/ai  (owner) — server-side proxy to Anthropic so the API key
// lives in Netlify env (ANTHROPIC_API_KEY), never on the device. Login becomes passcode-only.
import { OWNER_PASSCODE, json } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const pass = b.__pass || req.headers.get('x-owner-pass') || '';
  if (OWNER_PASSCODE && pass !== OWNER_PASSCODE) return json({ error: 'unauthorized' }, 401);
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return json({ error: 'Server is missing ANTHROPIC_API_KEY — add it in Netlify env.' }, 500);
  delete b.__pass;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(b),
    });
    const j = await r.json();
    return json(j, r.status);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
