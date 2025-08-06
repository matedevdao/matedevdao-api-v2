import { ChatStorage, WebSocketManager, ChatMessage } from '@gaiaprotocol/chat-worker';
import z from 'zod';
import { nftAddresses } from '../nft/nft-addresses';
import { getBalances } from '../services/nft';
import { corsHeaders, jsonWithCors, verifyToken } from '@gaiaprotocol/worker-common';

const WHITELIST = [
  '0xbB22b6F3CE72A5Beb3CC400d9b6AF808A18E0D4c',
  '0xa9a6D8C0ACc5266CC5Db2c3FE2EF799A10d9ceA8',
  '0x67aaB54e9F81d35B2d9Ad7Bc3b6505095618aeB0',
  '0x7a2bBEc3a4064d43A691A5809fAC81547f3Fa202',
  '0x5223595e40ACeAaC6F829b4aa79D9ef430758E09',
  '0x80A594e6555D04D718Ac565358daB8eA76D0eEe5',
];

const ROOM_NFTS: Record<string, string[]> = {
  'mates': ['dogesoundclub-mates', 'dogesoundclub-e-mates', 'dogesoundclub-biased-mates'],
  'sigor-sparrows': ['sigor-sparrows'],
  'kcd-kongz': ['kingcrowndao-kongz'],
  'babyping': ['babyping'],
};

export class ChatRoom {
  readonly #websockets: WebSocketManager;
  readonly #storage: ChatStorage;

  constructor(private ctx: DurableObjectState, private env: Env) {
    this.#websockets = new WebSocketManager();
    this.#storage = new ChatStorage(env, ctx);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    // ✅ WebSocket 연결 처리
    if (url.pathname.endsWith('/stream') && request.headers.get('upgrade') === 'websocket') {
      const token = url.searchParams.get('token');
      if (!token) return jsonWithCors('Unauthorized: missing token', 401);

      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) return jsonWithCors('Unauthorized: invalid token', 401);

      // 🔐 NFT 또는 화이트리스트 검증
      const allowed = await this.#isAllowedToJoin(payload.sub as `0x${string}`);
      if (!allowed) return jsonWithCors('Forbidden: NFT required', 403);

      const [clientSocket, serverSocket] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      this.#websockets.handleConnection(serverSocket, payload.sub, () => this.#storage.loadRecentMessages());

      return new Response(null, {
        status: 101,
        webSocket: clientSocket,
        headers: corsHeaders(),
      });
    }

    // ✅ 메시지 전송 처리
    if (request.method === 'POST' && url.pathname.endsWith('/send')) {
      const auth = request.headers.get('authorization');
      if (!auth?.startsWith('Bearer ')) return jsonWithCors('Unauthorized', 401);

      const token = auth.slice(7);
      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) return jsonWithCors('Unauthorized', 401);

      const schema = z.object({
        text: z.string().optional().default(''),
        localId: z.uuid(),
        attachments: z.array(
          z.object({
            kind: z.literal('image'),
            url: z.url(),
            thumb: z.url().optional(),
          })
        ).default([]),
      });

      const { text, attachments, localId } = schema.parse(await request.json());
      const id = await this.#storage.saveMessage(payload.sub, text.trim(), attachments);

      const message: ChatMessage = {
        id,
        localId,
        type: 'chat',
        account: payload.sub,
        text: text.trim(),
        attachments,
        timestamp: Date.now(),
      };

      this.#websockets.broadcast(message);

      return jsonWithCors(message);
    }

    return jsonWithCors('Not Found', 404);
  }

  // ✅ NFT 또는 화이트리스트 검증
  async #isAllowedToJoin(account: `0x${string}`): Promise<boolean> {
    if (WHITELIST.includes(account)) return true;

    const roomId = this.ctx.id.toString();
    const requiredNfts = ROOM_NFTS[roomId] ?? [];
    if (requiredNfts.length === 0) return true;

    const contracts = requiredNfts.map(id => nftAddresses[id]);
    const balances = await getBalances(account, contracts);

    return balances.some(balance => balance > 0n);
  }
}
