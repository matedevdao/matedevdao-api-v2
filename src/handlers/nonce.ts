import { customAlphabet } from 'nanoid';
import { getAddress } from 'viem';
import { z } from 'zod';
import { jsonWithCors } from "@gaiaprotocol/worker-common";

// 알파벳: alphanumeric only
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// 길이: 최소 8 이상
const generateNonce = customAlphabet(alphabet, 16);

export async function handleNonce(request: Request, env: Env) {
  const schema = z.object({
    address: z.string(),
    domain: z.string(),
    uri: z.string(),
  });

  const { address } = schema.parse(await request.json());

  const normalizedAddress = getAddress(address);
  const nonce = generateNonce();
  const issuedAt = new Date().toISOString();

  await env.SIWE_NONCES.put(`nonce:${normalizedAddress}`, JSON.stringify({ nonce, issuedAt }), { expirationTtl: 300 });

  return jsonWithCors({ nonce, issuedAt });
}
