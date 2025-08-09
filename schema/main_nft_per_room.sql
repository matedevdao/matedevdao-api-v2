CREATE TABLE main_nft_per_room (
    collection     TEXT NOT NULL, -- 컬렉션
    user_address   TEXT NOT NULL, -- 유저의 지갑 주소 (checksummed or lowercased)
    contract_addr  TEXT NOT NULL, -- NFT 컨트랙트 주소
    token_id       TEXT NOT NULL, -- NFT 토큰 ID
    selected_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')), -- 선택 시간 (UNIX timestamp)

    PRIMARY KEY (collection, user_address) -- 같은 컬렉션+유저 조합에 하나만 저장
);
