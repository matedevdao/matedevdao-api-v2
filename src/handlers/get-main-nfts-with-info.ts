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

const ADDR_TO_COLLECTION: Record<string, string> = {
  "0xE47E90C58F8336A2f24Bcd9bCB530e2e02E1E8ae": "dogesoundclub-mates",
  "0x2B303fd0082E4B51e5A6C602F45545204bbbB4DC": "dogesoundclub-e-mates",
  "0xDeDd727ab86bce5D416F9163B2448860BbDE86d4": "dogesoundclub-biased-mates",
  "0x81b5C41Bac33ea696D9684D9aFdB6cd9f6Ee5CFF": "kingcrowndao-pixel-kongz",
  "0xF967431fb8F5B4767567854dE5448D2EdC21a482": "kingcrowndao-kongz",
  "0x7340a44AbD05280591377345d21792Cdc916A388": "sigor-sparrows",
  "0x455Ee7dD1fc5722A7882aD6B7B8c075655B8005B": "sigor-housedeeds",
  "0x595b299Db9d83279d20aC37A85D36489987d7660": "babyping",
};

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

    // NFT 메타데이터 조회 키 구성 (`collection:token_id`)
    const tokenIds = Array.from(
      new Set(rows.map(r => `${ADDR_TO_COLLECTION[r.contract_addr]}:${r.token_id}`))
    );

    let byKey: Record<string, NftItem> = {};
    if (tokenIds.length > 0) {
      byKey = await (env.NFT_API_WORKER as any).fetchNftDataByIds(tokenIds);
    }

    const items = rows.map(r => {
      const tidNum = Number(r.token_id);
      const keyCandidates = [
        `${ADDR_TO_COLLECTION[r.contract_addr]}:${tidNum}`,
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
