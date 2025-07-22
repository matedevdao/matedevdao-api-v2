import { verifyMessage } from "viem";
import { createSiweMessage } from "viem/siwe";

export async function validateSiwe(address: `0x${string}`, signature: `0x${string}`, env: Env) {
  const expectedDomain = env.ALLOWED_DOMAIN;
  const expectedUri = env.ALLOWED_URI;

  const stored = await env.SIWE_NONCES.get(`nonce:${address}`);
  if (!stored) return false;

  const { nonce, issuedAt } = JSON.parse(stored);

  console.log({
    domain: expectedDomain,
    address,
    statement: env.MESSAGE_FOR_WALLET_LOGIN,
    uri: expectedUri,
    version: '1',
    chainId: 8217,
    nonce,
    issuedAt: new Date(issuedAt),
  });

  const siweMessage = createSiweMessage({
    domain: expectedDomain,
    address,
    statement: env.MESSAGE_FOR_WALLET_LOGIN,
    uri: expectedUri,
    version: '1',
    chainId: 8217,
    nonce,
    issuedAt: new Date(issuedAt),
  });

  const isValidSig = await verifyMessage({
    address,
    message: siweMessage,
    signature,
  });

  if (!isValidSig) return false;

  // delete nonce here to prevent reuse
  await env.SIWE_NONCES.delete(`nonce:${address}`);

  return true;
}
