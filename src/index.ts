import { handleLogin, handleNonce, handleUploadImage, handleValidateToken, jsonWithCors, preflightResponse, syncNftOwnershipFromEvents } from '@gaiaprotocol/worker-common';
import { createPublicClient, http } from 'viem';
import { kaia } from 'viem/chains';
import { ChatRoom } from './do/chat-room';
import { handleGetActiveListings } from './handlers/get-active-listings';
import { handleGetMainNftsWithInfo } from './handlers/get-main-nfts-with-info';
import { handleGetMyMainNft } from './handlers/get-my-main-nft';
import { handleGetProfile } from './handlers/get-profile';
import { handleGetProfiles } from './handlers/get-profiles';
import { handleNftOwnershipStats } from './handlers/nft-ownership-stats';
import { oauth2Callback } from './handlers/oauth2/callback';
import { oauth2LinkWallet } from './handlers/oauth2/link-wallet';
import { loginWithIdToken as oauth2LoginWithIdToken } from './handlers/oauth2/login-with-idtoken';
import { oauth2Logout } from './handlers/oauth2/logout';
import { oauth2Me } from './handlers/oauth2/me';
import { oauth2MeByToken } from './handlers/oauth2/me-by-token';
import { oauth2Start } from './handlers/oauth2/start';
import { oauth2UnlinkWalletBySession } from './handlers/oauth2/unlink-wallet-by-session';
import { oauth2UnlinkWalletByToken } from './handlers/oauth2/unlink-wallet-by-token';
import { handleSetMainNft } from './handlers/set-main-nft';
import { handleSetProfile } from './handlers/set-profile';
import { syncMarketplaceEvents } from './services/nft-marketplace-sync';

export { ChatRoom };

const KAIA_CLIENT = createPublicClient({ chain: kaia, transport: http() });

const TOKEN_IDS_RANGES: { [address: string]: { start: number; end: number } } = {
  '0xE47E90C58F8336A2f24Bcd9bCB530e2e02E1E8ae': { start: 0, end: 9999 }, // DogeSoundClub Mates
  '0x2B303fd0082E4B51e5A6C602F45545204bbbB4DC': { start: 0, end: 7999 }, // DogeSoundClub E-Mates
  '0xDeDd727ab86bce5D416F9163B2448860BbDE86d4': { start: 0, end: 19999 }, // DogeSoundClub Biased Mates
  '0x7340a44AbD05280591377345d21792Cdc916A388': { start: 0, end: 8000 }, // Sigor Sparrows
  '0x455Ee7dD1fc5722A7882aD6B7B8c075655B8005B': { start: 0, end: 8000 }, // Sigor House Deeds
  '0xF967431fb8F5B4767567854dE5448D2EdC21a482': { start: 0, end: 2999 }, // KCD Kongz
  '0x81b5C41Bac33ea696D9684D9aFdB6cd9f6Ee5CFF': { start: 1, end: 10000 }, // KCD Pixel Kongz
  '0x595b299Db9d83279d20aC37A85D36489987d7660': { start: 0, end: 2999 }, // BabyPing
};

const BLOCK_STEP = 2500;

const NFT_MARKETPLACE_ADDRESS = '0x53F54285c4112232CC933bE787E3170fe2931218';

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

    const url = new URL(request.url);

    // Other APIs
    if (request.method === 'OPTIONS') return preflightResponse();
    if (url.pathname === '/nonce' && request.method === 'POST') return handleNonce(request, env);
    if (url.pathname === '/login' && request.method === 'POST') return handleLogin(request, 8217, env);
    if (url.pathname === '/validate-token' && request.method === 'GET') return handleValidateToken(request, env);
    if (url.pathname === '/upload-image' && request.method === 'POST') return handleUploadImage(request, env);
    if (url.pathname === '/nft-ownership-stats') return handleNftOwnershipStats(request, env);
    if (url.pathname === '/profile' && request.method === 'GET') return handleGetProfile(request, env);
    if (url.pathname === '/profile' && request.method === 'POST') return handleSetProfile(request, env);
    if (url.pathname === '/profiles') return handleGetProfiles(request, env);
    if (url.pathname === '/set-main-nft') return handleSetMainNft(request, env);
    if (url.pathname === '/get-my-main-nft') return handleGetMyMainNft(request, env);
    if (url.pathname === '/get-main-nfts-with-info') return handleGetMainNftsWithInfo(request, env);
    if (url.pathname === '/get-active-listings') return handleGetActiveListings(request, env);

    // OAuth2
    const oauth2Providers = {
      google: {
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_url: 'https://oauth2.googleapis.com/token',
        userinfo_url: 'https://openidconnect.googleapis.com/v1/userinfo',
        scope: 'openid email profile',
        oidc: {
          issuer: 'https://accounts.google.com',
          discovery: 'https://accounts.google.com/.well-known/openid-configuration',
          require_email_verified: false,
        }
      },
    }
    if (url.pathname === '/oauth2/start/mateapp2google') return oauth2Start(request, env, 'google', oauth2Providers, env.OAUTH2_MATEAPP2GOOGLE_REDIRECT_URI);
    if (url.pathname === '/oauth2/callback/mateapp2google') return oauth2Callback(request, env, 'google', oauth2Providers, env.OAUTH2_MATEAPP2GOOGLE_REDIRECT_URI, env.GOOGLE_MATEAPP_REDIRECT_TO);
    if (url.pathname === '/oauth2/login-with-idtoken/google') return oauth2LoginWithIdToken(request, env, oauth2Providers, 'google')
    if (url.pathname === '/oauth2/me') return oauth2Me(request, env, oauth2Providers)
    if (url.pathname === '/oauth2/me-by-token/google') return oauth2MeByToken(request, env, 'google')
    if (url.pathname === '/oauth2/logout') return oauth2Logout(request, env, oauth2Providers)
    if (url.pathname === '/oauth2/link-wallet') return oauth2LinkWallet(request, env)
    if (url.pathname === '/oauth2/unlink-wallet-by-token') return oauth2UnlinkWalletByToken(request, env)
    if (url.pathname === '/oauth2/unlink-wallet-by-session') return oauth2UnlinkWalletBySession(request, env)

    const chatMatch = url.pathname.match(/^\/chat\/([^/]+)\/(stream|send)$/);
    if (chatMatch) {
      const [_, roomId, action] = chatMatch;

      const id = env.CHATROOM.idFromName(roomId);
      const obj = env.CHATROOM.get(id);

      // DO에 요청 위임
      return obj.fetch(request);
    }

    if (url.pathname === '/sync-nft-ownership-from-events') {
      try {
        await syncNftOwnershipFromEvents(env, KAIA_CLIENT, TOKEN_IDS_RANGES, BLOCK_STEP);
      } catch (e: any) {
        console.error(e);
        return jsonWithCors({ error: e.message }, 500);
      }
      return jsonWithCors({ message: 'OK' });
    }

    if (url.pathname === '/sync-marketplace-events') {
      try {
        await syncMarketplaceEvents(env, KAIA_CLIENT, NFT_MARKETPLACE_ADDRESS, BLOCK_STEP);
      } catch (e: any) {
        console.error(e);
        return jsonWithCors({ error: e.message }, 500);
      }
      return jsonWithCors({ message: 'OK' });
    }

    return new Response('Not Found', { status: 404 });
  },
  async scheduled(event, env, ctx) {
    const cron = event.cron; // "*/2 * * * *" 또는 "1-59/2 * * * *"

    try {
      if (cron === "*/2 * * * *") {
        // 소유권 이벤트만
        await syncNftOwnershipFromEvents(env, KAIA_CLIENT, TOKEN_IDS_RANGES, BLOCK_STEP);
        return;
      }
      if (cron === "1-59/2 * * * *") {
        // 마켓플레이스 이벤트만
        await syncMarketplaceEvents(env, KAIA_CLIENT, NFT_MARKETPLACE_ADDRESS, BLOCK_STEP);
        return;
      }
    } catch (e) {
      console.error("[cron error]", cron, e);
    }
  },
} satisfies ExportedHandler<Env>;
