import { z } from 'zod';
import { jsonWithCors } from '../services/cors';
import { verifyToken } from '../services/jwt';

const profileSchema = z.object({
  nickname: z.string().max(30).optional(),
  bio: z.string().max(200).optional(),
}).refine(
  (data) => data.nickname || data.bio,
  { message: 'nickname 또는 bio 중 하나는 반드시 있어야 합니다' }
);

export async function handleSetProfile(request: Request, env: Env): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonWithCors('인증되지 않았습니다', 401);
    }

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload?.sub) return jsonWithCors('인증되지 않았습니다', 401);

    const address = payload.sub;

    const json = await request.json();
    const parseResult = profileSchema.safeParse(json);

    if (!parseResult.success) {
      return jsonWithCors(
        { error: parseResult.error.message },
        400
      );
    }

    const { nickname, bio } = parseResult.data;

    await env.DB.prepare(`
      INSERT INTO profiles (account, nickname, bio)
      VALUES (?, ?, ?)
      ON CONFLICT(account) DO UPDATE
      SET nickname = excluded.nickname, bio = excluded.bio
    `).bind(
      address,
      nickname ?? null,
      bio ?? null,
    ).run();

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
