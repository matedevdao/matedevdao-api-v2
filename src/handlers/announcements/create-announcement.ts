import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import { z } from "zod";

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
  link_url: z.string().url().optional(),
  priority: z.number().int().min(0).max(100).optional().default(0),
});

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

export async function handleCreateAnnouncement(
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
    if (!payload) return jsonWithCors({ error: "Unauthorized" }, 401);

    if (!isAdmin(payload, env)) {
      return jsonWithCors({ error: "Forbidden: Admin access required" }, 403);
    }

    const account = (payload as any).role === "admin" ? "admin" : payload.sub;

    const json = await request.json();
    const parseResult = createAnnouncementSchema.safeParse(json);
    if (!parseResult.success) {
      return jsonWithCors({ error: parseResult.error.message }, 400);
    }

    const { title, content, link_url, priority } = parseResult.data;

    const result = await env.DB.prepare(`
      INSERT INTO announcements (title, content, link_url, priority, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(title, content, link_url ?? null, priority, account).run();

    return jsonWithCors({ success: true, id: result.meta.last_row_id });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
