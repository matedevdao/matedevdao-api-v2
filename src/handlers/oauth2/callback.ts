import { OAuth2ProviderConfig } from './provider';

export type ProviderRegistry = Record<string, OAuth2ProviderConfig>;

type StatePayload = {
  s: string; // csrf
  t: string; // txn id
  p: string; // provider name
  ts: number;
};

type TxnRecord = {
  provider: string;
  code_verifier: string;
  csrf: string;
  created_at: number;
  return_to: string | null;
};

// —— Utils (oauth2Start에서 쓴 것과 동일/재사용) ——
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

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

const fromBase64UrlToJSON = <T = unknown>(s: string): T =>
  JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));

// —— The Function ——
export async function oauth2Callback(
  request: Request,
  env: Env,
  providerName: string,
  providers: ProviderRegistry,
  redirectUri: string,
  returnTo: string,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');

  if (!code || !stateRaw) {
    return json({ error: 'Missing code or state' }, 400);
  }

  // 1) state 파싱 및 기본 검증
  let parsed: StatePayload;
  try {
    parsed = fromBase64UrlToJSON<StatePayload>(stateRaw);
  } catch {
    return json({ error: 'Invalid state' }, 400);
  }
  const { s: csrf, t: txnId, p: providerFromState } = parsed || ({} as StatePayload);
  if (!csrf || !txnId) return json({ error: 'Invalid state payload' }, 400);

  // 2) TXN 조회 및 검증
  const txnKey = `txn:${txnId}`;
  const txnJSON = await env.TXNS.get(txnKey);
  if (!txnJSON) return json({ error: 'Transaction expired' }, 400);
  const txn = JSON.parse(txnJSON) as TxnRecord;

  if (txn.csrf !== csrf) return json({ error: 'CSRF mismatch' }, 400);

  // 3) 프로바이더 결정(라우트 vs state) 및 일치 검증
  const effectiveProvider = providerFromState || providerName;
  const cfg = providers[effectiveProvider];
  if (!cfg) return json({ error: 'Unknown provider', provider: effectiveProvider }, 400);
  if (txn.provider && txn.provider !== effectiveProvider) {
    return json({ error: 'Provider mismatch', expected: txn.provider, got: effectiveProvider }, 400);
  }

  // 4) 토큰 교환
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: cfg.client_id,
    code_verifier: txn.code_verifier,
  });
  if (cfg.client_secret) tokenParams.set('client_secret', cfg.client_secret);

  const tokenResp = await fetch(cfg.token_url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'application/json', // 일부 공급자(GitHub)는 이 헤더가 없으면 urlencoded로 반환
    },
    body: tokenParams,
  });

  if (!tokenResp.ok) {
    const detail = await tokenResp.text();
    return json({ error: 'Token exchange failed', detail }, 502);
  }

  const token = await tokenResp.json() as Record<string, unknown>;

  // 5) (선택) userinfo 조회
  let user: unknown = null;
  if (cfg.userinfo_url && token?.access_token) {
    const ui = await fetch(cfg.userinfo_url, {
      headers: { Authorization: `Bearer ${token.access_token}`, 'accept': 'application/json' },
    });
    if (ui.ok) {
      user = await ui.json();
    }
  }

  // 6) 세션 생성/저장
  const sessionId = randomBytesBase64Url(48);
  const sessionRecord = {
    provider: effectiveProvider,
    created_at: Date.now(),
    token, // access_token / refresh_token? / expires_in / id_token? 등
    user,
  };
  const ttlSeconds = 7 * 24 * 60 * 60 // 7 days
  await env.SESSIONS.put(`sess:${sessionId}`, JSON.stringify(sessionRecord), {
    expirationTtl: ttlSeconds,
  });

  // 7) 일회성 TXN 정리
  await env.TXNS.delete(txnKey);

  // 8) 응답: HTML (브라우저) 또는 JSON (API 클라이언트)
  const accept = request.headers.get('accept') || '';
  if (!accept.includes('application/json')) {
    const html = `<!doctype html>
<meta charset="utf-8">
<script>
  window.location.replace('${returnTo}?session=' + encodeURIComponent('${sessionId}'));
</script>`;
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  }

  return json({ ok: true, sessionId, user, provider: effectiveProvider });
}
