import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";
import { z } from "zod";

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(1000).optional(),
  link_url: z.string().url().nullish(),
  priority: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
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

export async function handleUpdateAnnouncement(
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

    const json = await request.json();
    const parseResult = updateAnnouncementSchema.safeParse(json);
    if (!parseResult.success) {
      return jsonWithCors({ error: parseResult.error.message }, 400);
    }

    const { title, content, link_url, priority, is_active } = parseResult.data;

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (title !== undefined) {
      updates.push("title = ?");
      values.push(title);
    }
    if (content !== undefined) {
      updates.push("content = ?");
      values.push(content);
    }
    if (link_url !== undefined) {
      updates.push("link_url = ?");
      values.push(link_url);
    }
    if (priority !== undefined) {
      updates.push("priority = ?");
      values.push(priority);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return jsonWithCors({ error: "No fields to update" }, 400);
    }

    updates.push("updated_at = CAST(strftime('%s','now') AS INTEGER)");
    values.push(announcementId);

    await env.DB.prepare(`
      UPDATE announcements
      SET ${updates.join(", ")}
      WHERE id = ?
    `).bind(...values).run();

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
