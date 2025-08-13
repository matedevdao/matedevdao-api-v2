export type Profile = {
    nickname?: string;
    bio?: string;
};
type SetProfilePayload = {
    nickname?: string;
    bio?: string;
};
type SetProfileResponse = {
    success: boolean;
};
/**
 * 프로필을 설정합니다.
 */
export declare function setProfile(payload: SetProfilePayload, token: string): Promise<SetProfileResponse>;
/**
 * 프로필을 가져옵니다.
 */
export declare function fetchProfile(address: `0x${string}`): Promise<Profile>;
export {};
//# sourceMappingURL=profile.d.ts.map