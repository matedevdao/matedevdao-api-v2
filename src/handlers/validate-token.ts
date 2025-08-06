import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";

export async function handleValidateToken(request: Request, env: Env) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonWithCors('인증되지 않았습니다', 401);
  }

  const token = auth.slice(7);

  const payload = await verifyToken(token, env);
  if (!payload) return jsonWithCors('인증되지 않았습니다', 401);

  return jsonWithCors({ user: payload });
}
