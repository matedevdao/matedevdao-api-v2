import { handleGoogleLogin, handleGoogleLogout, handleGoogleMe, handleGoogleMeByWallet, handleLinkGoogleWeb3Wallet, handleLogin, handleNonce, handleOAuth2Callback, handleOAuth2Verify, handleUnlinkGoogleWeb3WalletBySession, handleUnlinkGoogleWeb3WalletByToken, handleUploadImage, handleValidateToken, preflightResponse, preflightResponseWithOrigin, syncNftOwnershipFromEvents } from '@gaiaprotocol/worker-common';
import { createPublicClient, http } from 'viem';
import { kaia } from 'viem/chains';
import { ChatRoom } from './do/chat-room';
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

    // Google Login
    if (url.pathname === '/google-login/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      return handleGoogleLogin(request, env, env.GOOGLE_MATEAPP_REDIRECT_URI);
    }
    if (url.pathname === '/google-login/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      return handleGoogleLogin(request, env, env.GOOGLE_SIGOR_REDIRECT_URI);
    }

    if (url.pathname === '/oauth2/callback/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      return handleOAuth2Callback(request, env, env.GOOGLE_MATEAPP_REDIRECT_URI, env.GOOGLE_MATEAPP_REDIRECT_TO);
    }
    if (url.pathname === '/oauth2/callback/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      return handleOAuth2Callback(request, env, env.GOOGLE_SIGOR_REDIRECT_URI, env.GOOGLE_SIGOR_REDIRECT_TO);
    }

    if (url.pathname === '/google-logout/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      return handleGoogleLogout(request, env.GOOGLE_MATEAPP_REDIRECT_TO, env.GOOGLE_MATEAPP_ORIGIN);
    }
    if (url.pathname === '/google-logout/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      return handleGoogleLogout(request, env.GOOGLE_SIGOR_REDIRECT_TO, env.GOOGLE_SIGOR_ORIGIN);
    }

    if (url.pathname === '/oauth2/verify/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      return handleOAuth2Verify(request, env, env.GOOGLE_MATEAPP_ORIGIN);
    }
    if (url.pathname === '/oauth2/verify/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      return handleOAuth2Verify(request, env, env.GOOGLE_SIGOR_ORIGIN);
    }

    if (url.pathname === '/google-me/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      return handleGoogleMe(request, env, env.GOOGLE_MATEAPP_ORIGIN);
    }
    if (url.pathname === '/google-me/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      return handleGoogleMe(request, env, env.GOOGLE_SIGOR_ORIGIN);
    }

    if (url.pathname === '/google-link-web3-wallet/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      if (request.method === 'POST') return handleLinkGoogleWeb3Wallet(request, env, env.GOOGLE_MATEAPP_ORIGIN);
    }
    if (url.pathname === '/google-link-web3-wallet/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      if (request.method === 'POST') return handleLinkGoogleWeb3Wallet(request, env, env.GOOGLE_SIGOR_ORIGIN);
    }

    if (url.pathname === '/google-unlink-web3-wallet-by-token/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      if (request.method === 'POST') return handleUnlinkGoogleWeb3WalletByToken(request, env, env.GOOGLE_MATEAPP_ORIGIN);
    }
    if (url.pathname === '/google-unlink-web3-wallet-by-token/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      if (request.method === 'POST') return handleUnlinkGoogleWeb3WalletByToken(request, env, env.GOOGLE_SIGOR_ORIGIN);
    }

    if (url.pathname === '/google-unlink-web3-wallet-by-session/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      if (request.method === 'POST') return handleUnlinkGoogleWeb3WalletBySession(request, env, env.GOOGLE_MATEAPP_ORIGIN);
    }
    if (url.pathname === '/google-unlink-web3-wallet-by-session/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      if (request.method === 'POST') return handleUnlinkGoogleWeb3WalletBySession(request, env, env.GOOGLE_SIGOR_ORIGIN);
    }

    if (url.pathname === '/google-me-by-wallet/mateapp') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_MATEAPP_ORIGIN);
      return handleGoogleMeByWallet(request, env, env.GOOGLE_MATEAPP_ORIGIN);
    }
    if (url.pathname === '/google-me-by-wallet/sigor') {
      if (request.method === 'OPTIONS') return preflightResponseWithOrigin(env.GOOGLE_SIGOR_ORIGIN);
      return handleGoogleMeByWallet(request, env, env.GOOGLE_SIGOR_ORIGIN);
    }

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

    return new Response('Not Found', { status: 404 });
  },
  async scheduled(controller, env, ctx) {
    await syncNftOwnershipFromEvents(env, KAIA_CLIENT, TOKEN_IDS_RANGES, BLOCK_STEP);
  },
} satisfies ExportedHandler<Env>;
