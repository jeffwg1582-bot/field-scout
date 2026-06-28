// POST /.netlify/functions/apollo  (owner) — find the owner + a VERIFIED email for a company via Apollo.
// Search (free) -> pick the best owner/decision-maker match -> enrich/match (1 Apollo credit) to reveal the email.
// Fails SOFT: any problem returns {found:false} so the app falls back to the web-search research.
// NOTE: verify endpoint paths/response shape against current Apollo API on activation, and test ONE lead first.
//   Docs: https://docs.apollo.io/reference  (people search + people match/enrichment)
import { OWNER_PASSCODE, json } from './_lib.mjs';

const BASE = 'https://api.apollo.io/api/v1';
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let b;
  try { b = await req.json(); } catch (e) { return json({ found: false }, 200); }
  const pass = b.pass || req.headers.get('x-owner-pass') || '';
  if (OWNER_PASSCODE && pass !== OWNER_PASSCODE) return json({ error: 'unauthorized' }, 401);

  const KEY = process.env.APOLLO_API_KEY;
  const company = (b.company || '').trim();
  if (!KEY || !company) return json({ found: false }, 200); // soft -> app uses web search

  const H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': KEY };
  try {
    // 1) free search for the owner/decision-maker at this company
    const sBody = {
      person_titles: ['owner', 'president', 'ceo', 'founder', 'co-founder', 'general manager', 'principal', 'partner', 'managing partner'],
      q_keywords: company, per_page: 5,
    };
    if (b.domain) sBody.q_organization_domains_list = [String(b.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '')];
    if (b.area) sBody.organization_locations = [b.area];

    const sr = await fetch(BASE + '/mixed_people/search', { method: 'POST', headers: H, body: JSON.stringify(sBody) });
    if (!sr.ok) return json({ found: false }, 200);
    const sj = await sr.json();
    const people = sj.people || sj.contacts || [];
    if (!people.length) return json({ found: false }, 200);

    // best match = person whose org name resembles the snapped company; require a real overlap before spending a credit
    const cn = norm(company);
    let pick = people.find(p => p.organization && cn && norm(p.organization.name).includes(cn.slice(0, Math.min(8, cn.length))));
    if (!pick) pick = people.find(p => p.organization && cn && norm(p.organization.name).slice(0, 6) === cn.slice(0, 6));
    if (!pick) return json({ found: false, note: 'no confident company match' }, 200);

    const org = pick.organization || {};
    const emp = Number(org.estimated_num_employees || 0);
    const industry = (org.industry || '').toLowerCase();
    const isPublic = !!(org.publicly_traded_symbol || org.publicly_traded_exchange);

    // ---- BEST-FIT RULES (judged from the FREE search — NO credit spent yet) ----
    // PEO sweet spot = independent U.S. SMB, ~5-100 W-2 employees, a reachable owner.
    // Toss the obvious misfits here so we never pay to reveal a Walmart/chain email.
    const BAD_INDUSTRY = /staffing|recruiting|professional employer|government|public administration|education|religious/;
    let peo_fit, scope, fit_reason;
    if (isPublic)                         { peo_fit = 'none'; scope = 'public company';        fit_reason = 'publicly traded'; }
    else if (emp > 500)                   { peo_fit = 'none'; scope = 'national / large';      fit_reason = emp + ' employees (too big)'; }
    else if (BAD_INDUSTRY.test(industry)) { peo_fit = 'none'; scope = 'out-of-profile';        fit_reason = org.industry || 'industry'; }
    else if (emp > 250)                   { peo_fit = 'low';  scope = 'regional / large';      fit_reason = emp + ' employees'; }
    else if (emp >= 5 && emp <= 100)      { peo_fit = 'high'; scope = 'local independent';     fit_reason = emp + ' employees'; }
    else if (emp >= 2)                     { peo_fit = 'medium'; scope = 'local independent';   fit_reason = emp + ' employees'; }
    else if (emp === 1)                   { peo_fit = 'low';  scope = 'solo / owner-operator'; fit_reason = 'solo operator (few/no W-2 staff)'; }
    else                                  { peo_fit = 'medium'; scope = 'local independent';   fit_reason = 'size unknown'; }
    const est_size = emp ? String(emp) : '';

    // TOSS non-fits for FREE — return the verdict without spending an enrich credit.
    if (peo_fit === 'none') return json({ found: false, peo_fit, scope, est_size, fit_reason }, 200);

    // 2) good fit — enrich the picked person to reveal the work email (1 credit)
    const mr = await fetch(BASE + '/people/match', { method: 'POST', headers: H, body: JSON.stringify({ id: pick.id }) });
    if (!mr.ok) return json({ found: false, peo_fit, scope, est_size, fit_reason }, 200);
    const mj = await mr.json();
    const per = mj.person || {};
    let email = per.email || '';
    if (/email_not_unlocked|notunlocked|@domain\.com/i.test(email)) email = '';

    const name = [per.first_name || pick.first_name, per.last_name || pick.last_name].filter(Boolean).join(' ').trim();
    const title = per.title || pick.title || '';
    // LEADERSHIP-ONLY: reject anyone who isn't a decision-maker
    const LEAD = /owner|president|ceo|founder|principal|partner|proprietor|managing|general manager|\bgm\b|vice president|\bvp\b|director|chief|co-?owner/i;

    if (!email || !LEAD.test(title)) return json({ found: false, peo_fit, scope, est_size, fit_reason, note: 'no leadership email' }, 200);
    return json({
      found: true, email, email_type: 'personal',
      contact_name: name, contact_title: title,
      scope, est_size, peo_fit, fit_reason, source: 'Apollo verified',
    }, 200);
  } catch (e) {
    return json({ found: false }, 200);
  }
};
