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

  // joined from nfts (nullable)
  nft_holder: string | null;
  nft_style: string | null;
  nft_parts: string | null;
  nft_dialogue: string | null;
  nft_image: string | null;
};

type ListingItem = {
  list_id: number;
  owner: string;
  nft_address: string;
  token_id: string;
  price_wei: string;
  tx_listed: string;
  block_listed: number | null;
  ts_listed: number | null;
  nft: {
    holder?: string;
    style?: string;
    parts?: string;
    dialogue?: string;
    image?: string;
  } | null;
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
    const where: string[] = [`l.status = 'LISTED'`];
    const binds: (string | number)[] = [];

    if (owner) {
      where.push(`l.owner = ?`);
      binds.push(owner);
    }
    if (nftAddress) {
      where.push(`l.nft_address = ?`);
      binds.push(nftAddress);
    }
    if (cursor) {
      // paginate descending by list_id
      where.push(`l.list_id < ?`);
      binds.push(Number(cursor));
    }

    // LEFT JOIN nfts to attach NFT meta; token_id type mismatch handled via CAST
    const sql = `
      SELECT
        l.list_id, l.owner, l.nft_address, l.token_id, l.price_wei,
        l.tx_listed, l.block_listed, l.ts_listed,
        n.holder     AS nft_holder,
        n.style      AS nft_style,
        n.parts      AS nft_parts,
        n.dialogue   AS nft_dialogue,
        n.image      AS nft_image
      FROM nft_marketplace_listings AS l
      LEFT JOIN nfts AS n
        ON n.nft_address = l.nft_address
       AND n.token_id = CAST(l.token_id AS INTEGER)
      WHERE ${where.join(" AND ")}
      ORDER BY l.list_id DESC
      LIMIT ?
    `;

    binds.push(limit);

    const statement = env.DB.prepare(sql).bind(...binds);
    const { results } = await statement.all<ListingRow>();

    const items: ListingItem[] = results.map((r) => ({
      list_id: r.list_id,
      owner: r.owner,
      nft_address: r.nft_address,
      token_id: r.token_id,
      price_wei: r.price_wei,
      tx_listed: r.tx_listed,
      block_listed: r.block_listed,
      ts_listed: r.ts_listed,
      nft: (r.nft_holder || r.nft_style || r.nft_parts || r.nft_dialogue || r.nft_image)
        ? {
          holder: r.nft_holder ?? undefined,
          style: r.nft_style ?? undefined,
          parts: r.nft_parts ?? undefined,
          dialogue: r.nft_dialogue ?? undefined,
          image: r.nft_image ?? undefined
        }
        : null
    }));

    const nextCursor =
      results.length === limit ? String(results[results.length - 1].list_id) : null;

    return jsonWithCors({
      items,
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
