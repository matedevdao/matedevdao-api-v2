import { jsonWithCors } from "@gaiaprotocol/worker-common";

const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

type ListingRow = {
  list_id: number;
  owner: string;
  nft_address: string;
  token_id: string;   // uint256 -> decimal string
  price_wei: string;  // uint256 -> decimal string
  tx_listed: string;
  block_listed: number | null;
  ts_listed: number | null; // seconds
};

export async function handleGetActiveListings(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);

    // Optional filters
    const owner = url.searchParams.get("owner");
    const nftAddress = url.searchParams.get("nft_address");

    // Cursor-based pagination (use list_id as cursor)
    const cursor = url.searchParams.get("cursor"); // expect numeric list_id
    const limitParam = url.searchParams.get("limit");
    const limit = Math.max(1, Math.min(Number(limitParam ?? 50) || 50, 200));

    // Validate inputs
    if (owner && !ETH_ADDR_RE.test(owner)) {
      return jsonWithCors({ error: "유효하지 않은 owner 주소" }, 400);
    }
    if (nftAddress && !ETH_ADDR_RE.test(nftAddress)) {
      return jsonWithCors({ error: "유효하지 않은 nft_address" }, 400);
    }
    if (cursor && !/^\d+$/.test(cursor)) {
      return jsonWithCors({ error: "유효하지 않은 cursor" }, 400);
    }

    // Build WHERE and binds
    const where: string[] = [`status = 'LISTED'`];
    const binds: (string | number)[] = [];

    if (owner) {
      where.push(`owner = ?`);
      binds.push(owner);
    }
    if (nftAddress) {
      where.push(`nft_address = ?`);
      binds.push(nftAddress);
    }
    if (cursor) {
      // paginate descending by list_id
      where.push(`list_id < ?`);
      binds.push(Number(cursor));
    }

    const sql = `
      SELECT
        list_id, owner, nft_address, token_id, price_wei,
        tx_listed, block_listed, ts_listed
      FROM nft_marketplace_listings
      WHERE ${where.join(" AND ")}
      ORDER BY list_id DESC
      LIMIT ?
    `;

    binds.push(limit);

    const statement = env.DB.prepare(sql).bind(...binds);
    const { results } = await statement.all<ListingRow>();

    const nextCursor =
      results.length === limit ? String(results[results.length - 1].list_id) : null;

    return jsonWithCors({
      items: results,
      nextCursor,
      // Echo filters for client convenience
      filters: { owner: owner ?? null, nft_address: nftAddress ?? null },
      pageInfo: { limit }
    });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
