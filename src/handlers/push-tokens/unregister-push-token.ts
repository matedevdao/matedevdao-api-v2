import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import { z } from "zod";
import { FcmService, FCM_TOPIC_NOTICES } from "../../services/fcm";

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

    // 토픽 구독 해제
    try {
      const fcm = new FcmService(env);
      await fcm.unsubscribeFromTopic(fcm_token, FCM_TOPIC_NOTICES);
    } catch (err) {
      console.error('[PushToken] Topic unsubscribe failed:', err);
    }

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
