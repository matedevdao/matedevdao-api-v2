import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import { z } from "zod";

const unregisterPushTokenSchema = z.object({
  fcm_token: z.string().min(1),
});

export async function handleUnregisterPushToken(
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
    const parseResult = unregisterPushTokenSchema.safeParse(json);
    if (!parseResult.success) {
      return jsonWithCors({ error: parseResult.error.message }, 400);
    }

    const { fcm_token } = parseResult.data;

    // Only delete if the token belongs to this user
    await env.DB.prepare(`
      DELETE FROM push_tokens
      WHERE fcm_token = ? AND user_address = ?
    `).bind(fcm_token, userAddress).run();

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
