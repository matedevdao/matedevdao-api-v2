declare class TokenManager {
    static readonly TOKEN_KEY = "token";
    static readonly ADDRESS_KEY = "token_address";
    static set(token: string, address: `0x${string}`): void;
    static getToken(): string | undefined;
    static getAddress(): `0x${string}` | undefined;
    static clear(): void;
    static has(): boolean;
    static isMatchedWith(currentAddress: `0x${string}`): boolean;
}
export { TokenManager };
//# sourceMappingURL=token-mananger.d.ts.map