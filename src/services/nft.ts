import { kaiaClient } from '../kaia';
import ParsingNFTDataArtifact from '../nft/ParsingNFTData.json';

const PARSING_NFT_DATA_CONTRACT_ADDRESS =
  '0x8A98A038dcA75091225EE0a1A11fC20Aa23832A0';

async function getBalances(address: `0x${string}`, contracts: `0x${string}`[]): Promise<bigint[]> {
  return await kaiaClient.readContract({
    address: PARSING_NFT_DATA_CONTRACT_ADDRESS,
    abi: ParsingNFTDataArtifact.abi,
    functionName: 'getERC721BalanceList_OneHolder',
    args: [address as `0x${string}`, contracts],
  }) as bigint[];
}

async function getHolderCounts(
  env: Env,
  collections: { collection: string, address: string }[],
): Promise<Record<string, number>> {
  const holderCounts: Record<string, number> = {};

  for (const { collection, address } of collections) {
    const row = await env.DB.prepare(`
      SELECT COUNT(DISTINCT holder) as count
      FROM nfts
      WHERE nft_address = ?
    `).bind(address).first<{ count: number }>();

    holderCounts[collection] = row?.count ?? 0;
  }

  return holderCounts;
}

export { getBalances, getHolderCounts };
