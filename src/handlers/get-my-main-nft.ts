import { z } from 'zod';
import { jsonWithCors, verifyToken } from '@gaiaprotocol/worker-common';

const getMyMainNftSchema = z.object({
  room: z.string().trim().min(1),
});

export async function handleGetMyMainNft(request: Request, env: Env): Promise<Response> {
  try {
    // 인증
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return jsonWithCors('Unauthorized', 401);

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload?.sub) return jsonWithCors('Unauthorized', 401);
    const userAddress = payload.sub;

    const body = await request.json().catch(() => ({}));
    const parsed = getMyMainNftSchema.safeParse(body);
    if (!parsed.success) return jsonWithCors({ error: parsed.error.message }, 400);

    const { room } = parsed.data;

    const { results } = await env.DB.prepare(`
      SELECT contract_addr, token_id, selected_at
      FROM main_nft_per_room
      WHERE room = ? AND user_address = ?
      LIMIT 1
    `)
      .bind(room, userAddress)
      .all<{ contract_addr: string; token_id: string; selected_at: number }>();

    const row = results?.[0];

    return jsonWithCors(
      row
        ? { room, user_address: userAddress, ...row }
        : { room, user_address: userAddress, contract_addr: undefined, token_id: undefined, selected_at: undefined },
      200
    );
  } catch (err) {
    console.error(err);
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
