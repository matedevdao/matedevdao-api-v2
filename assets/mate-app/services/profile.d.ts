/** 캐시에 저장되는 구조 */
type ProfileEntry = {
    nickname?: string | null;
    bio?: string | null;
    fetchedAt: number;
};
declare class ProfileService extends EventTarget {
    #private;
    /** 주소를 등록(=프리로드). */
    preload(accounts: string[]): void;
    /**
     * 비동기로 최신 프로필을 반환.
     */
    resolve(account: string): Promise<ProfileEntry | undefined>;
    /**
     * 캐시된(혹은 오래된) 값 그대로 반환. 없으면 undefined
     */
    getCached(account: string): ProfileEntry | undefined;
    /**
     * 강제로 프로필을 주입합니다.
     */
    setProfile(account: string, nickname?: string, bio?: string): void;
}
export declare const profileService: ProfileService;
export {};
//# sourceMappingURL=profile.d.ts.map