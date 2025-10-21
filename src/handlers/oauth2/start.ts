import { OAuth2ProviderConfig } from './provider';

export type ProviderRegistry = Record<string, OAuth2ProviderConfig>;

type StatePayload = {
  s: string;       // csrf
  t: string;       // txn id
  p: string;       // provider name
  ts: number;      // timestamp
};

type TxnRecord = {
  provider: string;
  code_verifier: string;
  csrf: string;
  created_at: number;
  return_to: string | null;
};

// --- Utils ---
const base64url = (buf: ArrayBuffer | Uint8Array | string): string => {
  const bin =
    typeof buf === 'string'
      ? btoa(buf)
      : btoa(String.fromCharCode(...(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
  return bin.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const randomBytesBase64Url = (n = 32): string => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return base64url(a);
};

const sha256 = async (input: string): Promise<Uint8Array> => {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return new Uint8Array(digest);
};

const makePkcePair = async () => {
  const verifier = randomBytesBase64Url(64);
  const challenge = base64url(await sha256(verifier));
  return { verifier, challenge, method: 'S256' as const };
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

// --- The Function ---
// Redirects to the provider authorize endpoint with PKCE + state.
// Persists TXN (code_verifier, csrf, return_to...) in KV for 10 minutes.
export async function oauth2Start(
  request: Request,
  env: Env,
  providerName: string,
  providers: ProviderRegistry,
  redirectUri: string
): Promise<Response> {
  const url = new URL(request.url);

  // 1) Resolve provider
  const cfg = providers[providerName];
  if (!cfg) return json({ error: 'Unknown provider', providerKey: providerName }, 400);

  // 2) Create PKCE + CSRF + TXN
  const pkce = await makePkcePair();
  const csrf = randomBytesBase64Url(32);
  const txnId = randomBytesBase64Url(32);

  const statePayload: StatePayload = { s: csrf, t: txnId, p: providerName, ts: Date.now() };
  const state = base64url(JSON.stringify(statePayload));

  const txn: TxnRecord = {
    provider: providerName,
    code_verifier: pkce.verifier,
    csrf,
    created_at: Date.now(),
    return_to: url.searchParams.get('return_to'),
  };

  // 3) Persist TXN to KV (TTL: 10min)
  await env.TXNS.put(`txn:${txnId}`, JSON.stringify(txn), { expirationTtl: 600 });

  // 4) Build authorize URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.client_id,
    redirect_uri: redirectUri,
    scope: cfg.scope,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    state,
  });

  // 5) Redirect to provider
  return Response.redirect(`${cfg.auth_url}?${params.toString()}`, 302);
}
