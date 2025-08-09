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

const schema = z.object({
  collection: z.string(),
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).nonempty(),
});

export async function handleGetMainNftsWithInfo(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') return jsonWithCors({ error: 'Method Not Allowed' }, 405);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonWithCors({ error: parsed.error.message }, 400);

    const { collection, addresses } = parsed.data;

    const placeholders = addresses.map(() => '?').join(', ');
    const stmt = `
      SELECT collection, user_address, contract_addr, token_id, selected_at
      FROM main_nft_per_room
      WHERE collection = ? AND user_address IN (${placeholders})
    `;

    const { results } = await env.DB.prepare(stmt)
      .bind(collection, ...addresses)
      .all<{ collection: string; user_address: string; contract_addr: string; token_id: string; selected_at: number }>();

    const rows = results ?? [];
    if (rows.length === 0) return jsonWithCors([], 200);

    // 일괄 NFT 조회
    const tokenIds = Array.from(
      new Set(
        rows.map(r => `${collection}:${r.token_id}`)
      )
    );

    let byKey: Record<string, NftItem> = {};
    if (tokenIds.length > 0) {
      const res = await fetch(`${env.NFT_API_BASE_URI}/nfts/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: tokenIds }),
      });

      if (res.ok) {
        const payload: any = await res.json().catch(() => ({} as any));
        if (payload?.results && typeof payload.results === 'object') {
          byKey = payload.results as Record<string, NftItem>;
        } else if (Array.isArray(payload)) {
          // 배열 방어: key를 `${collection}:${id}` 형태로 합성해서 매핑
          byKey = Object.fromEntries(
            payload.map((x: any) => [`${collection}:${Number(x?.token_id)}`, x]).filter(([, v]) => v)
          );
        }
      } else {
        const text = await res.text().catch(() => '');
        console.error(`nfts/by-ids failed: ${res.status} ${res.statusText}`, text);
      }
    }

    // 병합
    const items = rows.map(r => {
      const tid = Number(r.token_id);
      const candidates = [
        `${collection}:${tid}`,
        `${r.contract_addr}:${tid}`,
        String(tid),
      ];
      let nft: NftItem | null = null;
      for (const k of candidates) {
        if (k in byKey) { nft = byKey[k]; break; }
      }
      return {
        collection,
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
