import { z } from 'zod';
import { jsonWithCors } from "@gaiaprotocol/worker-common";

const bodySchema = z.object({
  addresses: z.array(
    z.string().regex(/^0x[a-fA-F0-9]{40}$/, '유효하지 않은 이더리움 주소')
  ).nonempty()
});

export async function handleGetProfiles(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithCors({ error: parsed.error.format() }, 400);
    }

    const { addresses } = parsed.data;

    // placeholders: "?, ?, ?, ..."
    const placeholders = addresses.map(() => '?').join(', ');
    const query = `
      SELECT account, nickname, bio
      FROM profiles
      WHERE account IN (${placeholders})
    `;

    const statement = env.DB.prepare(query).bind(...addresses);
    const rows = await statement.all<{ account: string, nickname: string | null, bio: string | null }>();

    // 결과를 address: { nickname, bio } 형식으로 변환
    const result: Record<string, { nickname?: string, bio?: string } | null> = {};

    // 먼저 null로 초기화
    for (const addr of addresses) {
      result[addr] = null;
    }

    // 실제 값 채우기
    for (const row of rows.results) {
      result[row.account] = {
        nickname: row.nickname ?? undefined,
        bio: row.bio ?? undefined
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
