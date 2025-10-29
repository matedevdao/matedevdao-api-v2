import { jsonWithCors } from '@gaiaprotocol/worker-common';
import { z } from 'zod';

type NftItem = {
  nft_address: string;
  token_id: number;
  holder: string;
  type?: string | null;
  gender?: string | null;
  parts?: string | null;
  image?: string | null;
};

// 이제 room만 사용
const schema = z.object({
  room: z.string().trim().min(1),
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).nonempty(),
});

export async function handleGetMainNftsWithInfo(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') return jsonWithCors({ error: 'Method Not Allowed' }, 405);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonWithCors({ error: parsed.error.message }, 400);

    const { room } = parsed.data;
    const addresses = Array.from(new Set(parsed.data.addresses));

    // SQL IN 절 플레이스홀더 구성
    const addrPlaceholders = addresses.map(() => '?').join(', ');

    const stmt = `
      SELECT room, user_address, contract_addr, token_id, selected_at
      FROM main_nft_per_room
      WHERE room = ?
        AND user_address IN (${addrPlaceholders})
    `;

    const { results } = await env.DB.prepare(stmt)
      .bind(room, ...addresses)
      .all<{
        room: string;
        user_address: string;
        contract_addr: string;
        token_id: string;
        selected_at: number;
      }>();

    const rows = results ?? [];
    if (rows.length === 0) return jsonWithCors([], 200);

    // NFT 메타데이터 조회 키 구성 (`room:token_id`)
    const tokenIds = Array.from(
      new Set(rows.map(r => `${r.room}:${r.token_id}`))
    );

    let byKey: Record<string, NftItem> = {};
    if (tokenIds.length > 0) {
      byKey = await (env.NFT_API_WORKER as any).fetchNftDataByIds(tokenIds);
    }

    const items = rows.map(r => {
      const tidNum = Number(r.token_id);
      const keyCandidates = [
        `${r.room}:${tidNum}`,
        `${r.contract_addr}:${tidNum}`,
        String(tidNum),
      ];

      let nft: NftItem | null = null;
      for (const k of keyCandidates) {
        if (k in byKey) { nft = byKey[k]; break; }
      }

      return {
        room: r.room,
        user_address: r.user_address,
        contract_addr: r.contract_addr,
        token_id: r.token_id,
        selected_at: r.selected_at,
        nft,
      };
    });

    return jsonWithCors(items, 200);
  } catch (err) {
    console.error(err);
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
