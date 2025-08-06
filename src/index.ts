import { ChatRoom } from "./do/chat-room";
import { handleGetProfile } from "./handlers/get-profile";
import { handleGetProfiles } from "./handlers/get-profiles";
import { handleLogin } from "./handlers/login";
import { handleNftOwnershipStats } from "./handlers/nft-ownership-stats";
import { handleNonce } from "./handlers/nonce";
import { handleSetProfile } from "./handlers/set-profile";
import { handleUploadImage } from "./handlers/upload-image";
import { handleValidateToken } from "./handlers/validate-token";
import { preflightResponse } from "@gaiaprotocol/worker-common";

export { ChatRoom };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    /*const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const fcmOptions = new FcmOptions({
      serviceAccount,
      kvStore: env.FCM_TOKEN_CACHE,
      kvCacheKey: 'fcm_access_token',
    });
    const fcm = new FCM(fcmOptions);  

    const message: EnhancedFcmMessage = {
      notification: {
        title: 'New Message',
        body: 'You have a new message!',
        //image: 'https://example.com/image.png'
      },
      data: {
        key: 'value',
      },
      // Optional platform-specific configurations
      android: {
        notification: {
          click_action: 'OPEN_MESSAGE',
          channel_id: 'messages',
          icon: 'message_icon'
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default'
          }
        }
      },
      webpush: {
        notification: {
          //icon: 'https://example.com/icon.png',
          //badge: 'https://example.com/badge.png',
          actions: [
            {
              action: 'view',
              title: 'View Message'
            }
          ]
        }
      }
    };

    try {
      console.log('Sending message...');
      await fcm.sendToToken(message, 'czPiIUmzVga6GuaMxJvhzV:APA91bGPYi3dH0OtWi6sugZtN6svaX-OrwsO85oZYAM4SiXmSpdMNE2RZyt5WpeWU0xPlhTWCKKVIlcsTcaBkA012vd-XkVaxzyzuSCUW4uPdQLcT00z6Y4');
    } catch (error) {
      console.error('Error sending message:', error);
    }*/

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

    if (url.pathname === '/profiles') {
      return handleGetProfiles(request, env);
    }

    const chatMatch = url.pathname.match(/^\/chat\/([^/]+)\/(stream|send)$/);
    console.log(url.pathname, chatMatch);
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
