import { ChatRoom } from "./do/chat-room";
import { handleGetProfile } from "./handlers/get-profile";
import { handleLogin } from "./handlers/login";
import { handleNftOwnershipStats } from "./handlers/nft-ownership-stats";
import { handleNonce } from "./handlers/nonce";
import { handleSetProfile } from "./handlers/set-profile";
import { handleUploadImage } from "./handlers/upload-image";
import { handleValidateToken } from "./handlers/validate-token";
import { preflightResponse } from "./services/cors";

export { ChatRoom };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return preflightResponse();
    }

    const url = new URL(request.url);
    if (url.pathname === '/nonce' && request.method === 'POST') {
      return handleNonce(request, env);
    }

    if (url.pathname === '/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (url.pathname === '/validate-token' && request.method === 'GET') {
      return handleValidateToken(request, env);
    }

    if (url.pathname === '/upload-image' && request.method === 'POST') {
      return handleUploadImage(request, env);
    }

    if (url.pathname === '/nft-ownership-stats' && request.method === 'GET') {
      return handleNftOwnershipStats(request, env);
    }

    if (url.pathname === '/profile' && request.method === 'GET') {
      return handleGetProfile(request, env);
    }

    if (url.pathname === '/profile' && request.method === 'POST') {
      return handleSetProfile(request, env);
    }

    const chatMatch = url.pathname.match(/^\/chat\/([^/]+)\/(stream|send)$/);
    if (chatMatch) {
      const [_, roomId, action] = chatMatch;

      const id = env.CHATROOM.idFromName(roomId);
      const obj = env.CHATROOM.get(id);

      // DO에 요청 위임
      return obj.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
