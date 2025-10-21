import { jsonWithCors } from '@gaiaprotocol/worker-common';
import { OAuth2ProviderConfig } from './provider';

export type ProviderRegistry = Record<string, OAuth2ProviderConfig>;

// 세션 레코드 타입(예시)
type SessionRecord = {
  provider: string;
  created_at: number;
  token?: {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    [k: string]: unknown;
  };
  user?: unknown;
};

// Authorization 헤더에서 sessionId 추출
function getSessionId(req: Request): string | null {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// (선택) RFC 7009 토큰 무효화 시도
async function tryRevokeToken(
  which: 'access' | 'refresh',
  session: SessionRecord,
  cfg: OAuth2ProviderConfig & { revoke_url?: string }
) {
  const token =
    which === 'access' ? session.token?.access_token : session.token?.refresh_token;
  if (!token || !cfg.revoke_url) return;

  // 일부 공급자는 client_secret이 필수/선택 다를 수 있음
  const params = new URLSearchParams({
    token,
    token_type_hint: which === 'access' ? 'access_token' : 'refresh_token',
    client_id: cfg.client_id,
  });
  if (cfg.client_secret) params.set('client_secret', cfg.client_secret);

  // 메모: 어떤 공급자는 Basic Auth를 요구하기도 함(필요 시 추가)
  await fetch(cfg.revoke_url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  }).catch(() => void 0); // 실패해도 로그아웃 자체는 계속 진행
}

/**
 * POST /oauth2/logout[?revoke=access|refresh|both]
 * - Authorization: Bearer <sessionId> 필수(없어도 200 ok로 처리하여 idempotent)
 * - 세션 삭제, (선택) 공급자 토큰 무효화 시도
 */
export async function oauth2Logout(
  request: Request,
  env: Env,
  providers: ProviderRegistry
): Promise<Response> {
  const url = new URL(request.url);
  const revokeMode = (url.searchParams.get('revoke') || 'access') as
    | 'access'
    | 'refresh'
    | 'both';

  const sessionId = getSessionId(request);
  if (!sessionId) {
    // 이미 로그아웃된 상태로 간주
    return jsonWithCors({ ok: true });
  }

  const key = `sess:${sessionId}`;
  const sessionJson = await env.SESSIONS.get(key);
  if (!sessionJson) {
    // 없는 세션 → 역시 성공으로 응답(멱등성 보장)
    return jsonWithCors({ ok: true });
  }

  // 세션 로드
  let session: SessionRecord;
  try {
    session = JSON.parse(sessionJson) as SessionRecord;
  } catch {
    // 파싱 실패하더라도 세션 삭제만 진행
    await env.SESSIONS.delete(key);
    return jsonWithCors({ ok: true });
  }

  // (선택) 공급자 토큰 무효화
  const cfg = providers[session.provider] as OAuth2ProviderConfig & { revoke_url?: string };
  if (cfg && session.token) {
    try {
      if (revokeMode === 'access' || revokeMode === 'both') {
        await tryRevokeToken('access', session, cfg);
      }
      if (revokeMode === 'refresh' || revokeMode === 'both') {
        await tryRevokeToken('refresh', session, cfg);
      }
    } catch {
      // 토큰 무효화 실패는 무시(세션 삭제는 계속)
    }
  }

  // 서버 세션 삭제(핵심)
  await env.SESSIONS.delete(key);

  // 클라이언트는 localStorage의 sid를 삭제해야 함(프론트에서 처리)
  // 원하는 경우 회전/삭제 신호를 헤더로 전달할 수도 있음
  return jsonWithCors({ ok: true });
}
