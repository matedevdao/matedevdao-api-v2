import { PublicClient, getAddress, parseAbiItem } from "viem";

/**
 * ABI event fragments for NFTMarketplace
 */
const EVT_LISTED = parseAbiItem(
  "event Listed(uint256 indexed listId, address indexed owner, address indexed nftAddress, uint256 tokenId, uint256 price)"
);
const EVT_BOUGHT = parseAbiItem(
  "event Bought(uint256 indexed listId, address indexed buyer)"
);
const EVT_CANCELLED = parseAbiItem(
  "event Cancelled(uint256 indexed listId)"
);

/**
 * Sync NFT marketplace listings, purchases, and cancellations into
 * the `nft_marketplace_listings` table.
 *
 * Schema expectations (already created by you):
 * - Primary key: list_id (INTEGER)
 * - NOT NULL columns for listing baseline (owner, nft_address, token_id, price_wei, tx_listed)
 * - status in {'LISTED','BOUGHT','CANCELLED'}
 *
 * Cursor table: contract_event_sync_status(contract_type, last_synced_block_number, last_synced_at)
 * We use contract_type = 'NFT_MARKETPLACE'
 */
export async function syncMarketplaceEvents(
  env: Env,
  client: PublicClient,
  marketplaceAddress: `0x${string}`,
  blockStep: number
): Promise<void> {
  // 1) load sync cursor
  const statusRow = await env.DB.prepare(
    `SELECT last_synced_block_number FROM contract_event_sync_status WHERE contract_type = ?`
  )
    .bind("NFT_MARKETPLACE")
    .first<{ last_synced_block_number: number }>();

  const lastSynced = statusRow ? BigInt(statusRow.last_synced_block_number) : undefined;
  if (lastSynced === undefined) {
    throw new Error("No previously synced block found for NFT_MARKETPLACE");
  }

  // 2) compute scan window with overlap (like your ERC721 sync)
  let toBlock = lastSynced + BigInt(blockStep);
  const currentBlock = await client.getBlockNumber();
  if (toBlock > currentBlock) toBlock = currentBlock;

  let fromBlock = toBlock - BigInt(blockStep) * 2n;
  if (fromBlock < 0n) fromBlock = 0n;

  // 3) fetch logs per-event (keeps decoding simple), then merge & sort
  const [listedLogs, boughtLogs, cancelledLogs] = await Promise.all([
    client.getLogs({ address: marketplaceAddress, event: EVT_LISTED, fromBlock, toBlock }),
    client.getLogs({ address: marketplaceAddress, event: EVT_BOUGHT, fromBlock, toBlock }),
    client.getLogs({ address: marketplaceAddress, event: EVT_CANCELLED, fromBlock, toBlock }),
  ]);

  const all = [...listedLogs, ...boughtLogs, ...cancelledLogs].sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return Number(a.logIndex - b.logIndex);
    return Number(a.blockNumber - b.blockNumber);
  });

  if (all.length === 0) {
    // still advance the cursor so we don't re-scan the same empty range forever
    await env.DB.prepare(
      `UPDATE contract_event_sync_status
       SET last_synced_block_number = ?, last_synced_at = strftime('%s','now')
       WHERE contract_type = ?`
    )
      .bind(Number(toBlock), "NFT_MARKETPLACE")
      .run();
    return;
  }

  // 4) cache blockNumber -> timestamp (seconds) to avoid N RPCs
  const tsCache = new Map<bigint, number>();
  async function tsFor(blockNumber: bigint): Promise<number> {
    const cached = tsCache.get(blockNumber);
    if (cached !== undefined) return cached;
    const blk = await client.getBlock({ blockNumber });
    const ts = Number(blk.timestamp); // viem returns bigint
    tsCache.set(blockNumber, ts);
    return ts;
  }

  // 5) prepared SQL
  const insertOrRefreshListingSql = `
    INSERT INTO nft_marketplace_listings
      (list_id, owner, nft_address, token_id, price_wei, status, buyer,
       tx_listed, tx_settled, block_listed, block_settled, ts_listed, ts_settled)
    VALUES (?, ?, ?, ?, ?, 'LISTED', NULL,
            ?, NULL, ?, NULL, ?, NULL)
    ON CONFLICT(list_id) DO UPDATE SET
      owner         = excluded.owner,
      nft_address   = excluded.nft_address,
      token_id      = excluded.token_id,
      price_wei     = excluded.price_wei,
      tx_listed     = excluded.tx_listed,
      block_listed  = excluded.block_listed,
      ts_listed     = excluded.ts_listed
    -- Only refresh the "listing-side" columns if the row is still a live listing.
    WHERE nft_marketplace_listings.status = 'LISTED'
  `;

  const markBoughtSql = `
    UPDATE nft_marketplace_listings
       SET status        = 'BOUGHT',
           buyer         = ?,
           tx_settled    = ?,
           block_settled = ?,
           ts_settled    = ?
     WHERE list_id = ? AND status != 'BOUGHT'
  `;

  const markCancelledSql = `
    UPDATE nft_marketplace_listings
       SET status        = 'CANCELLED',
           tx_settled    = ?,
           block_settled = ?,
           ts_settled    = ?
     WHERE list_id = ? AND status != 'CANCELLED'
  `;

  // 6) process logs in-order (handles overlap windows safely)
  for (const log of all) {
    const blockNumber = log.blockNumber!;
    const blockTs = await tsFor(blockNumber);
    const txHash = log.transactionHash!;
    const idx0 = log as any;

    // Listed
    if (idx0.args?.tokenId !== undefined && idx0.args?.price !== undefined && idx0.args?.owner) {
      const listId = Number(idx0.args.listId);
      const owner = getAddress(idx0.args.owner as string);
      const nftAddr = getAddress(idx0.args.nftAddress as string);
      const tokenId = (idx0.args.tokenId as bigint).toString(10);
      const priceWei = (idx0.args.price as bigint).toString(10);

      await env.DB.prepare(insertOrRefreshListingSql)
        .bind(
          listId,
          owner,
          nftAddr,
          tokenId,
          priceWei,
          txHash,
          Number(blockNumber),
          blockTs
        )
        .run();
      continue;
    }

    // Bought
    if (idx0.args?.buyer !== undefined && idx0.args?.listId !== undefined && idx0.eventName === "Bought") {
      const listId = Number(idx0.args.listId);
      const buyer = getAddress(idx0.args.buyer as string);

      // If the listing row does not exist yet (e.g., scan window misses the original Listed),
      // this UPDATE will no-op due to NOT NULL constraints on baseline columns — that’s OK.
      await env.DB.prepare(markBoughtSql)
        .bind(buyer, txHash, Number(blockNumber), blockTs, listId)
        .run();
      continue;
    }

    // Cancelled
    if (idx0.eventName === "Cancelled" && idx0.args?.listId !== undefined) {
      const listId = Number(idx0.args.listId);
      await env.DB.prepare(markCancelledSql)
        .bind(txHash, Number(blockNumber), blockTs, listId)
        .run();
      continue;
    }
  }

  // 7) advance cursor
  await env.DB.prepare(
    `UPDATE contract_event_sync_status
     SET last_synced_block_number = ?, last_synced_at = strftime('%s','now')
     WHERE contract_type = ?`
  )
    .bind(Number(toBlock), "NFT_MARKETPLACE")
    .run();
}
