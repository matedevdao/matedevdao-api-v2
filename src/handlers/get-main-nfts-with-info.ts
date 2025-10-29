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

const ROOM_NFTS: Record<string, string[]> = {
  mates: ['dogesoundclub-mates', 'dogesoundclub-e-mates', 'dogesoundclub-biased-mates'],
  'sigor-sparrows': ['sigor-sparrows'],
  'kcd-kongz': ['kingcrowndao-kongz'],
  babyping: ['babyping'],
};

// collection 또는 room 중 최소 하나는 필요 (collection 우선)
const schema = z.object({
  collection: z.string().trim().min(1).optional(),
  room: z.string().trim().min(1).optional(),
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).nonempty(),
}).refine(d => !!d.collection || !!d.room, {
  message: 'Either collection or room must be provided',
  path: ['collection'],
});

export async function handleGetMainNftsWithInfo(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') return jsonWithCors({ error: 'Method Not Allowed' }, 405);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonWithCors({ error: parsed.error.message }, 400);

    const { collection, room } = parsed.data;
    // 주소 중복 제거
    const addresses = Array.from(new Set(parsed.data.addresses));

    // 조회 대상 컬렉션 결정 (collection 우선, 없으면 room → ROOM_NFTS 매핑)
    let targetCollections: string[] = [];
    if (collection) {
      targetCollections = [collection];
    } else if (room) {
      const mapped = ROOM_NFTS[room];
      if (!mapped) return jsonWithCors({ error: `Invalid room: ${room}` }, 400);
      targetCollections = mapped;
    }

    if (targetCollections.length === 0) return jsonWithCors([], 200);

    // SQL IN 절 플레이스홀더 구성
    const colPlaceholders = targetCollections.map(() => '?').join(', ');
    const addrPlaceholders = addresses.map(() => '?').join(', ');

    const stmt = `
      SELECT collection, user_address, contract_addr, token_id, selected_at
      FROM main_nft_per_room
      WHERE collection IN (${colPlaceholders})
        AND user_address IN (${addrPlaceholders})
    `;

    const { results } = await env.DB.prepare(stmt)
      .bind(...targetCollections, ...addresses)
      .all<{
        collection: string;
        user_address: string;
        contract_addr: string;
        token_id: string;
        selected_at: number;
      }>();

    const rows = results ?? [];
    if (rows.length === 0) return jsonWithCors([], 200);

    // 일괄 NFT 메타데이터 조회용 키 구성 (중복 제거)
    // 우선 `${collection}:${token_id}` 키를 시도 (백업으로 `${contract_addr}:${token_id}`, `${token_id}`도 병합 단계에서 시도)
    const tokenIds = Array.from(
      new Set(
        rows.map(r => `${r.collection}:${r.token_id}`)
      )
    );

    let byKey: Record<string, NftItem> = {};
    if (tokenIds.length > 0) {
      // env.NFT_API_WORKER 의 인터페이스 가정: fetchNftDataByIds(string[]) => Record<string, NftItem>
      byKey = await (env.NFT_API_WORKER as any).fetchNftDataByIds(tokenIds);
    }

    // 병합
    const items = rows.map(r => {
      const tidNum = Number(r.token_id);
      const keyCandidates = [
        `${r.collection}:${tidNum}`,
        `${r.contract_addr}:${tidNum}`,
        String(tidNum),
      ];

      let nft: NftItem | null = null;
      for (const k of keyCandidates) {
        if (k in byKey) { nft = byKey[k]; break; }
      }

      return {
        collection: r.collection,
        user_address: r.user_address,
        contract_addr: r.contract_addr,
        token_id: r.token_id,
        selected_at: r.selected_at,
        nft, // null일 수 있음
      };
    });

    return jsonWithCors(items, 200);
  } catch (err) {
    console.error(err);
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
