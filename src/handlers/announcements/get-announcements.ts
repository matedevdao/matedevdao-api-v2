import { jsonWithCors } from "@gaiaprotocol/worker-common";

export async function handleGetAnnouncements(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, title, content, link_url, priority, created_at, updated_at
      FROM announcements
      WHERE is_active = 1
      ORDER BY priority DESC, created_at DESC
      LIMIT 10
    `).all<{
      id: number;
      title: string;
      content: string;
      link_url: string | null;
      priority: number;
      created_at: number;
      updated_at: number | null;
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
