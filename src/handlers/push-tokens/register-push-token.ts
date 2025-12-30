import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import { z } from "zod";

const registerPushTokenSchema = z.object({
  fcm_token: z.string().min(1),
  device_info: z.string().max(500).optional(),
});

export async function handleRegisterPushToken(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return jsonWithCors({ error: "Unauthorized" }, 401);
    }

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload?.sub) return jsonWithCors({ error: "Unauthorized" }, 401);

    const userAddress = payload.sub;

    const json = await request.json();
    const parseResult = registerPushTokenSchema.safeParse(json);
    if (!parseResult.success) {
      return jsonWithCors({ error: parseResult.error.message }, 400);
    }

    const { fcm_token, device_info } = parseResult.data;

    // UPSERT: Update user_address if token exists, or insert new
    await env.DB.prepare(`
      INSERT INTO push_tokens (user_address, fcm_token, device_info)
      VALUES (?, ?, ?)
      ON CONFLICT(fcm_token) DO UPDATE SET
        user_address = excluded.user_address,
        device_info = excluded.device_info,
        updated_at = CAST(strftime('%s','now') AS INTEGER)
    `).bind(userAddress, fcm_token, device_info ?? null).run();

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
