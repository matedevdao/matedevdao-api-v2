import { jsonWithCors } from "@gaiaprotocol/worker-common";
import { z } from 'zod';

const bodySchema = z.object({
  addresses: z.array(
    z.string().regex(/^0x[a-fA-F0-9]{40}$/, '유효하지 않은 이더리움 주소')
  ).nonempty()
});

export async function handleGetProfiles(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonWithCors({ error: parsed.error.format() }, 400);

    const { addresses } = parsed.data;

    const placeholders = addresses.map(() => '?').join(', ');
    const query = `
      SELECT
        account,
        nickname,
        bio,
        primary_nft_contract_address,
        primary_nft_token_id
      FROM profiles
      WHERE account IN (${placeholders})
    `;

    const rows = await env.DB.prepare(query).bind(...addresses).all<{
      account: string,
      nickname: string | null,
      bio: string | null,
      primary_nft_contract_address: string | null,
      primary_nft_token_id: string | null,
    }>();

    const result: Record<string, {
      nickname?: string,
      bio?: string,
      primary_nft_contract_address?: string,
      primary_nft_token_id?: string,
    } | null> = {};

    for (const addr of addresses) result[addr] = null;

    for (const row of rows.results) {
      result[row.account] = {
        nickname: row.nickname ?? undefined,
        bio: row.bio ?? undefined,
        primary_nft_contract_address: row.primary_nft_contract_address ?? undefined,
        primary_nft_token_id: row.primary_nft_token_id ?? undefined,
      };
    }

    return jsonWithCors(result);
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
