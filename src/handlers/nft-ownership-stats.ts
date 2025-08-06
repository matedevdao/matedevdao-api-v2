import { z } from 'zod';
import { nftAddresses } from '../nft/nft-addresses';
import { jsonWithCors } from "@gaiaprotocol/worker-common";
import { getBalances, getHolderCounts } from '../services/nft';

const WHITELIST = [
  '0xbB22b6F3CE72A5Beb3CC400d9b6AF808A18E0D4c',
  '0xa9a6D8C0ACc5266CC5Db2c3FE2EF799A10d9ceA8',
  '0x67aaB54e9F81d35B2d9Ad7Bc3b6505095618aeB0',
  '0x7a2bBEc3a4064d43A691A5809fAC81547f3Fa202',
  '0x5223595e40ACeAaC6F829b4aa79D9ef430758E09',
  '0x80A594e6555D04D718Ac565358daB8eA76D0eEe5',
];

const querySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '유효하지 않은 이더리움 주소'),
});

async function handleNftOwnershipStats(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsedQuery.success) {
      return jsonWithCors({ error: parsedQuery.error.message }, 400);
    }

    const { address } = parsedQuery.data;

    const nfts = Object.entries(nftAddresses).map(([collection, address]) => ({
      collection,
      address,
    }));

    const contracts = nfts.map(c => c.address);

    // 유저의 보유여부
    const balances = await getBalances(address as `0x${string}`, contracts);

    const result: Record<string, { owned: boolean, totalHolders: number }> = {};

    const holderCounts = await getHolderCounts(env, nfts);

    for (let i = 0; i < nfts.length; i++) {
      result[nfts[i].collection] = {
        owned: (balances[i] ?? 0n) > 0n,
        totalHolders: holderCounts[nfts[i].collection] ?? 0,
      };
    }

    if (WHITELIST.includes(address)) {
      for (const key of Object.keys(result)) {
        result[key].owned = true;
      }
    }

    return jsonWithCors(result);
  } catch (err) {
    console.error(err);
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

export { handleNftOwnershipStats };
