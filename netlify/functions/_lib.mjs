// Shared helpers. The only server-side secret is OWNER_PASSCODE (set in Netlify env).
// The Anthropic key stays on the OWNER's device — scouts never touch it.
export const OWNER_PASSCODE = process.env.OWNER_PASSCODE || '';
export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
export function isOwner(req) {
  const p = req.headers.get('x-owner-pass') || new URL(req.url).searchParams.get('pass') || '';
  return !OWNER_PASSCODE || p === OWNER_PASSCODE;
}
