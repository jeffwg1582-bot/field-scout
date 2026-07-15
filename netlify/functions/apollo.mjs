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
      person_titles: ['owner', 'president', 'ceo', 'founder', 'co-founder', 'general manager', 'principal', 'partner', 'managing partner', 'vice president', 'director'],
      q_keywords: company, per_page: 10,
    };
    if (b.domain) sBody.q_organization_domains_list = [String(b.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '')];
    // Only filter by location if it looks like a real "City, ST" — a granular neighborhood (e.g. "Prospect Creek") over-filters to zero.
    if (b.area && /,\s*[A-Za-z]{2,}/.test(b.area)) sBody.organization_locations = [b.area];

    const sr = await fetch(BASE + '/mixed_people/search', { method: 'POST', headers: H, body: JSON.stringify(sBody) });
    if (!sr.ok) return json({ found: false }, 200);
    const sj = await sr.json();
    const people = sj.people || sj.contacts || [];
    if (!people.length) return json({ found: false }, 200);

    // Best match by TOKEN OVERLAP — a sign name ("Altex") rarely equals the registered name
    // ("Altex Computers & Electronics, LTD."), so score on shared words, not a strict prefix.
    const cn = norm(company);
    const STOP = ['the', 'and', 'llc', 'inc', 'ltd', 'co', 'company', 'corp', 'group', 'services', 'service'];
    const toks = (company.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(t => !STOP.includes(t));
    const score = (p) => {
      const on = norm(p.organization && p.organization.name || ''); if (!on) return 0;
      if (on === cn) return 1000;
      if (on.includes(cn) || cn.includes(on)) return 500;
      let s = 0; for (const t of toks) if (on.includes(t)) s += t.length; return s;
    };
    let pick = null, best = 0;
    for (const p of people) { const s = score(p); if (s > best) { best = s; pick = p; } }
    if (!pick || best < 3) return json({ found: false, note: 'no confident company match' }, 200);

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
