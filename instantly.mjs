// POST /.netlify/functions/instantly  (owner) — enroll an approved lead into an Instantly campaign.
// Holds INSTANTLY_API_KEY server-side (Netlify env). Dormant until that env var + a campaign id are set.
// NOTE: verify the exact request shape against the live Instantly API when you activate:
//   https://developer.instantly.ai/api-reference/lead/add-leads-in-bulk-to-a-campaign-or-list
import { OWNER_PASSCODE, json } from './_lib.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const pass = b.pass || req.headers.get('x-owner-pass') || '';
  if (OWNER_PASSCODE && pass !== OWNER_PASSCODE) return json({ error: 'unauthorized' }, 401);

  const KEY = process.env.INSTANTLY_API_KEY;
  if (!KEY) return json({ error: 'Server is missing INSTANTLY_API_KEY (set it in Netlify when warmup is done).' }, 500);
  if (!b.campaign || !b.email) return json({ error: 'campaign + email required' }, 400);

  const payload = {
    campaign_id: b.campaign,
    leads: [{
      email: b.email,
      first_name: b.first_name || '',
      company_name: b.company_name || '',
      personalization: b.personalization || '',
      custom_variables: b.custom || {},
    }],
  };
  try {
    const r = await fetch('https://api.instantly.ai/api/v2/leads/add', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { j = { raw: txt }; }
    if (!r.ok) return json({ error: 'Instantly ' + r.status + ': ' + String(j.message || txt).slice(0, 200) }, 502);
    return json({ ok: true, result: j });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};
