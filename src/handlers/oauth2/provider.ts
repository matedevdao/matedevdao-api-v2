export type OAuth2ProviderConfig = {
  // OAuth2 (코드 교환용)
  client_id: string;
  client_secret: string;
  auth_url: string;
  token_url: string;
  userinfo_url: string;
  scope: string;

  // OIDC (id_token 검증용)
  oidc?: {
    issuer: string;                    // ex) "https://accounts.google.com"
    discovery?: string;                // ex) "https://accounts.google.com/.well-known/openid-configuration"
    jwks_uri?: string;                 // discovery 미사용 시 직접 지정
    acceptable_audiences?: string[];   // aud가 배열인 경우 등 허용 목록
    require_email_verified?: boolean;  // 이메일 검증 필수 정책
  };
};

export type ProviderRegistry = Record<string, OAuth2ProviderConfig>;
