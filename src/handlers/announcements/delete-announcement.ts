import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";

function isAdmin(payload: any, env: Env): boolean {
  // Check if admin role from admin login
  if (payload?.role === "admin") {
    return true;
  }

  // Check if wallet address is in admin list
  const address = payload?.sub;
  if (!address) return false;

  const admins = (env.ADMIN_ADDRESSES || "")
    .split(",")
    .map((a: string) => a.trim().toLowerCase())
    .filter((a: string) => a.length > 0);
  return admins.includes(address.toLowerCase());
}

export async function handleDeleteAnnouncement(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return jsonWithCors({ error: "Unauthorized" }, 401);
    }

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload) return jsonWithCors({ error: "Unauthorized" }, 401);

    if (!isAdmin(payload, env)) {
      return jsonWithCors({ error: "Forbidden: Admin access required" }, 403);
    }

    const announcementId = parseInt(id, 10);
    if (isNaN(announcementId)) {
      return jsonWithCors({ error: "Invalid announcement ID" }, 400);
    }

    await env.DB.prepare(`DELETE FROM announcements WHERE id = ?`).bind(announcementId).run();

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
