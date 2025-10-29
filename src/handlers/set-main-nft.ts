import { z } from 'zod';
import { jsonWithCors, verifyToken } from '@gaiaprotocol/worker-common';

const ethAddr = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

const setMainNftSchema = z.object({
  room: z.string().trim().min(1),       // 방(컬렉션) ID
  contract_addr: ethAddr,              // NFT 컨트랙트 주소
  token_id: z.string().min(1).max(100) // 토큰 ID (문자열 권장)
});

export async function handleSetMainNft(request: Request, env: Env): Promise<Response> {
  try {
    // 인증
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return jsonWithCors('Unauthorized', 401);

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload?.sub) return jsonWithCors('Unauthorized', 401);
    const userAddress = payload.sub;

    // 바디 파싱 및 검증
    const body = await request.json();
    const parsed = setMainNftSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithCors({ error: parsed.error.message }, 400);
    }

    const { room, contract_addr, token_id } = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    // 동일 토큰을 다른 유저가 쓰고 있는 경우 제거
    await env.DB.prepare(`
      DELETE FROM main_nft_per_room
      WHERE room = ? AND contract_addr = ? AND token_id = ? AND user_address != ?
    `).bind(room, contract_addr, token_id, userAddress).run();

    // UPSERT (room, user_address 기준)
    await env.DB.prepare(`
      INSERT INTO main_nft_per_room (room, user_address, contract_addr, token_id, selected_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(room, user_address) DO UPDATE SET
        contract_addr = excluded.contract_addr,
        token_id     = excluded.token_id,
        selected_at  = excluded.selected_at
    `).bind(
      room,
      userAddress,
      contract_addr,
      token_id,
      now
    ).run();

    return jsonWithCors({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
