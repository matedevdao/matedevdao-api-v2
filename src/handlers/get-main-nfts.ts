import { jsonWithCors } from '@gaiaprotocol/worker-common';
import { z } from 'zod';

const getMainNftsSchema = z.object({
  room: z.string().trim().min(1, 'room is required'),
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).nonempty(),
});

export async function handleGetMainNfts(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return jsonWithCors({ error: 'Method Not Allowed' }, 405);
    }

    const body = await request.json();
    const parsed = getMainNftsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWithCors({ error: parsed.error.message }, 400);
    }

    const { room, addresses } = parsed.data;

    const placeholders = addresses.map(() => '?').join(', ');
    const stmt = `
      SELECT user_address, contract_addr, token_id, selected_at
      FROM main_nft_per_room
      WHERE room = ? AND user_address IN (${placeholders})
    `;

    const { results } = await env.DB.prepare(stmt)
      .bind(room, ...addresses)
      .all<{
        user_address: string;
        contract_addr: string;
        token_id: string;
        selected_at: number;
      }>();

    const items = (results ?? []).map(r => ({
      room,
      user_address: r.user_address,
      contract_addr: r.contract_addr,
      token_id: r.token_id,
      selected_at: r.selected_at,
    }));

    return jsonWithCors(items, 200);
  } catch (err) {
    console.error(err);
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}
