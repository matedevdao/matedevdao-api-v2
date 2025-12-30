import { jsonWithCors } from "@gaiaprotocol/worker-common";
import { z } from "zod";
import { SignJWT } from "jose";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function handleAdminLogin(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const json = await request.json();
    const parseResult = loginSchema.safeParse(json);
    if (!parseResult.success) {
      return jsonWithCors({ error: parseResult.error.message }, 400);
    }

    const { username, password } = parseResult.data;

    // Check username and password
    if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
      return jsonWithCors({ error: "Invalid credentials" }, 401);
    }

    // Generate JWT token
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const expiresIn = 24 * 60 * 60; // 24 hours

    const token = await new SignJWT({
      sub: "admin",
      role: "admin",
      username: username,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(secret);

    return jsonWithCors({
      token,
      expires_in: expiresIn,
    });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
