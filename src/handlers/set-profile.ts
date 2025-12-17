import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import { z } from "zod";

const ethAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "유효하지 않은 컨트랙트 주소");

const profileSchema = z
  .object({
    nickname: z.string().max(30).optional(),
    bio: z.string().max(200).optional(),

    // primary nft
    primary_nft_contract_address: ethAddressSchema.optional(),
    primary_nft_token_id: z.string().max(100).optional(),
  })
  .refine(
    (data) =>
      data.nickname !== undefined ||
      data.bio !== undefined ||
      data.primary_nft_contract_address !== undefined ||
      data.primary_nft_token_id !== undefined,
    { message: "nickname, bio, primary_nft 중 하나는 반드시 있어야 합니다" },
  )
  .refine(
    (data) =>
      // primary nft는 둘 다 오거나, 둘 다 안 오거나
      !(
        (data.primary_nft_contract_address !== undefined &&
          data.primary_nft_token_id === undefined) ||
        (data.primary_nft_contract_address === undefined &&
          data.primary_nft_token_id !== undefined)
      ),
    { message: "primary_nft_contract_address 와 primary_nft_token_id 는 함께 제공되어야 합니다" },
  );

export async function handleSetProfile(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return jsonWithCors("인증되지 않았습니다", 401);
    }

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload?.sub) return jsonWithCors("인증되지 않았습니다", 401);

    const account = payload.sub;

    const json = await request.json();
    const parseResult = profileSchema.safeParse(json);
    if (!parseResult.success) {
      return jsonWithCors({ error: parseResult.error.message }, 400);
    }

    const { nickname, bio, primary_nft_contract_address, primary_nft_token_id } =
      parseResult.data;

    // 핵심: "요청에 없으면 undefined" → 바인딩에서 null로 만들지 말고 그대로 undefined를 null로만 변환하지 않게 해야 함
    // D1 bind는 undefined를 직접 허용하지 않는 경우가 많아서, "없음"을 null로 넘기되,
    // SQL에서 COALESCE(excluded.col, profiles.col)로 기존 값을 보존하도록 처리
    await env.DB.prepare(`
      INSERT INTO profiles (
        account,
        nickname,
        bio,
        primary_nft_contract_address,
        primary_nft_token_id,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, CAST(strftime('%s','now') AS INTEGER))
      ON CONFLICT(account) DO UPDATE
      SET
        nickname = COALESCE(excluded.nickname, profiles.nickname),
        bio = COALESCE(excluded.bio, profiles.bio),
        primary_nft_contract_address = COALESCE(excluded.primary_nft_contract_address, profiles.primary_nft_contract_address),
        primary_nft_token_id = COALESCE(excluded.primary_nft_token_id, profiles.primary_nft_token_id),
        updated_at = CAST(strftime('%s','now') AS INTEGER)
    `).bind(
      account,
      nickname ?? null,
      bio ?? null,
      primary_nft_contract_address ?? null,
      primary_nft_token_id ?? null,
    ).run();

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
