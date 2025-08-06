import { z } from 'zod';
import { jsonWithCors } from "@gaiaprotocol/worker-common";

const querySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '유효하지 않은 이더리움 주소'),
});

export async function handleGetProfile(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(query);

    if (!parsed.success) {
      return jsonWithCors(
        { error: parsed.error.format() },
        400
      );
    }

    const { address } = parsed.data;

    const row = await env.DB.prepare(`
      SELECT nickname, bio
      FROM profiles
      WHERE account = ?
    `).bind(address).first<{ nickname: string | null, bio: string | null }>();

    const result = {
      nickname: row?.nickname ?? undefined,
      bio: row?.bio ?? undefined
    };

    return jsonWithCors(result);
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
