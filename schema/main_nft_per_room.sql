CREATE TABLE main_nft_per_room (
    room           TEXT NOT NULL, -- 방
    user_address   TEXT NOT NULL, -- 유저의 지갑 주소 (checksummed or lowercased)
    contract_addr  TEXT NOT NULL, -- NFT 컨트랙트 주소
    token_id       TEXT NOT NULL, -- NFT 토큰 ID
    selected_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')), -- 선택 시간 (UNIX timestamp)

    PRIMARY KEY (room, user_address) -- 같은 방+유저 조합에 하나만 저장
);
