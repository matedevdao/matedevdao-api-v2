type NftOwnershipStat = {
    owned: boolean;
    totalHolders: number;
};
export type NftOwnershipStatsResult = Record<string, NftOwnershipStat>;
export declare function fetchNftOwnershipStats(address: `0x${string}`): Promise<NftOwnershipStatsResult>;
export {};
//# sourceMappingURL=nft-ownership-stats.d.ts.map