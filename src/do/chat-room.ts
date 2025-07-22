import { DurableObject } from 'cloudflare:workers';
import z from 'zod';
import { nftAddresses } from '../nft/nft-addresses';
import { corsHeaders, jsonWithCors } from '../services/cors';
import { verifyToken } from '../services/jwt';
import { getBalances } from '../services/nft';
import { Attachment, ChatMessage } from '../types/chat';

const WHITELIST = [
  '0xbB22b6F3CE72A5Beb3CC400d9b6AF808A18E0D4c',
  '0xa9a6D8C0ACc5266CC5Db2c3FE2EF799A10d9ceA8',
  '0x67aaB54e9F81d35B2d9Ad7Bc3b6505095618aeB0',
  '0x7a2bBEc3a4064d43A691A5809fAC81547f3Fa202',
  '0x5223595e40ACeAaC6F829b4aa79D9ef430758E09',
  '0x80A594e6555D04D718Ac565358daB8eA76D0eEe5',
];

interface Client {
  account: string;
  writer: WritableStreamDefaultWriter;
  controller: AbortController;
}

const ROOM_NFTS: Record<string, string[]> = {
  'mates': ['dogesoundclub-mates', 'dogesoundclub-e-mates', 'dogesoundclub-biased-mates'],
  'sigor-sparrows': ['sigor-sparrows'],
  'kcd-kongz': ['kingcrowndao-kongz'],
  'babyping': ['babyping'],
};

class ChatRoom extends DurableObject<Env> {
  #clients: Client[] = [];
  readonly #MAX_MESSAGES = 50;

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/stream')) {
      const auth = request.headers.get('authorization');
      if (!auth?.startsWith('Bearer ')) {
        return jsonWithCors({ error: 'Unauthorized' }, 401);
      }

      const token = auth.slice(7);
      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) {
        return jsonWithCors({ error: 'Unauthorized' }, 401);
      }

      return this.#join(payload.sub as `0x${string}`);
    }

    if (request.method === 'POST' && url.pathname.endsWith('/send')) {
      const auth = request.headers.get('authorization');
      if (!auth?.startsWith('Bearer ')) {
        return jsonWithCors({ error: 'Unauthorized' }, 401);
      }

      const token = auth.slice(7);
      const payload = await verifyToken(token, this.env);
      if (!payload?.sub) {
        return jsonWithCors({ error: 'Unauthorized' }, 401);
      }

      const schema = z.object({
        text: z.string().optional().default(''),
        localId: z.uuid(),
        attachments: z.array(
          z.object({
            kind: z.literal('image'),
            url: z.url(),
            thumb: z.url().optional()
          })
        ).default([]),
      });

      const parseResult = schema.safeParse(await request.json());
      if (!parseResult.success) {
        return jsonWithCors({ error: parseResult.error.format() }, 400);
      }

      const { text, attachments, localId } = parseResult.data;
      const id = await this.#saveMessageToD1(payload.sub, text.trim(), attachments);

      const message: ChatMessage = {
        id,
        localId,
        type: 'chat',
        account: payload.sub,
        text: text.trim(),
        attachments,
        timestamp: Date.now(),
      };

      this.#broadcast(message);

      return jsonWithCors(message);
    }

    return jsonWithCors({ error: 'Not Found' }, 404);
  }

  async #join(account: `0x${string}`): Promise<Response> {
    const roomId = this.ctx.id.toString();

    const requiredNfts = ROOM_NFTS[roomId] ?? [];
    if (requiredNfts.length > 0) {
      const hasNft = await this.#checkNftOwnership(account, requiredNfts);
      if (!hasNft) {
        return jsonWithCors({ error: 'NFT required' }, 403);
      }
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const controller = new AbortController();

    const client: Client = { account, writer, controller };
    this.#clients.push(client);

    const encoder = new TextEncoder();

    controller.signal.addEventListener('abort', () => {
      this.#clients = this.#clients.filter(c => c !== client);
      writer.close();
    });

    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders()
      },
    });

    queueMicrotask(async () => {
      const history = await this.#loadRecentMessagesFromD1();
      for (const msg of history) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      }
    });

    return response;
  }

  async #checkNftOwnership(account: `0x${string}`, nftIds: string[]): Promise<boolean> {
    if (WHITELIST.includes(account)) return true;
    const contracts = nftIds.map(id => nftAddresses[id]);
    const balances = await getBalances(account, contracts);
    return balances.some(balance => balance > 0n);
  }

  #broadcast(message: ChatMessage) {
    const json = JSON.stringify(message);
    const data = `data: ${json}\n\n`;
    const encoder = new TextEncoder();

    this.#clients.forEach(async (c) => {
      try {
        await c.writer.write(encoder.encode(data));
      } catch (err) {
        console.error(`Failed to send to ${c.account}`, err);
        c.controller.abort();
      }
    });
  }

  async #saveMessageToD1(account: string, text: string, attachments: Attachment[]) {
    const roomId = this.ctx.id.toString();
    const timestamp = Date.now();

    const result = await this.env.DB.prepare(`
      INSERT INTO messages (room_id, account, text, attachments, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).bind(roomId, account, text, JSON.stringify(attachments), timestamp).run();

    return result.meta.last_row_id;
  }

  async #loadRecentMessagesFromD1(): Promise<ChatMessage[]> {
    const roomId = this.ctx.id.toString();

    const { results } = await this.env.DB.prepare(`
      SELECT id, account, text, attachments, timestamp
      FROM messages
      WHERE room_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).bind(roomId, this.#MAX_MESSAGES).all<{
      id: number;
      account: string;
      text: string;
      attachments: string;
      timestamp: number;
    }>();

    return results.reverse().map(row => ({
      id: row.id,
      type: 'chat',
      account: row.account,
      text: row.text,
      attachments: JSON.parse(row.attachments),
      timestamp: row.timestamp,
    }));
  }
}

export { ChatRoom };
