import { z } from 'zod';
import { jsonWithCors, verifyToken } from '@gaiaprotocol/worker-common';

const ethAddr = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

const setMainNftSchema = z.object({
  collection: z.string(),     // 방(컬렉션) ID
  contract_addr: ethAddr,  // NFT 컨트랙트 주소
  token_id: z.string().min(1).max(100), // 토큰 ID (문자열로 보관 권장)
});

export async function handleSetMainNft(request: Request, env: Env): Promise<Response> {
  try {
    // 인증
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return jsonWithCors('Unauthorized', 401);

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload?.sub) return jsonWithCors('Unauthorized', 401);
    const userAddress = payload.sub; // 토큰의 소유자 주소

    // 바디 파싱/검증
    const body = await request.json();
    const parse = setMainNftSchema.safeParse(body);
    if (!parse.success) {
      return jsonWithCors({ error: parse.error.message }, 400);
    }

    const { collection, contract_addr, token_id } = parse.data;
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      DELETE FROM main_nft_per_room
      WHERE collection = ? AND contract_addr = ? AND token_id = ? AND user_address != ?
    `).bind(collection, contract_addr, token_id, userAddress).run();

    // UPSERT
    await env.DB.prepare(`
      INSERT INTO main_nft_per_room (collection, user_address, contract_addr, token_id, selected_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(collection, user_address) DO UPDATE SET
        contract_addr = excluded.contract_addr,
        token_id     = excluded.token_id,
        selected_at  = excluded.selected_at
    `).bind(
      collection,
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
