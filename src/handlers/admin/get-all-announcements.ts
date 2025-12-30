import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";

export async function handleGetAllAnnouncements(
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

    // Check if admin role
    if (!payload || (payload as any).role !== "admin") {
      return jsonWithCors({ error: "Forbidden: Admin access required" }, 403);
    }

    const { results } = await env.DB.prepare(`
      SELECT id, title, content, link_url, priority, is_active, created_at, updated_at, created_by
      FROM announcements
      ORDER BY created_at DESC
    `).all<{
      id: number;
      title: string;
      content: string;
      link_url: string | null;
      priority: number;
      is_active: number;
      created_at: number;
      updated_at: number | null;
      created_by: string;
    }>();

    return jsonWithCors({ announcements: results ?? [] });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
