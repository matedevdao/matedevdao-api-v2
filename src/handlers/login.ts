import { getAddress } from 'viem';
import { z } from 'zod';
import { jsonWithCors } from '../services/cors';
import { generateToken } from '../services/jwt';
import { validateSiwe } from '../services/siwe';

export async function handleLogin(request: Request, env: Env) {
  const schema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '잘못된 이더리움 주소입니다'),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/, '잘못된 서명입니다'),
  });

  const { address, signature } = schema.parse(await request.json());

  const normalizedAddress = getAddress(address);

  const valid = await validateSiwe(
    normalizedAddress,
    signature as `0x${string}`,
    env
  );

  if (!valid) {
    return jsonWithCors('유효하지 않은 서명 또는 nonce입니다', 401);
  }

  const token = await generateToken(address, env);
  return jsonWithCors({ token });
}
