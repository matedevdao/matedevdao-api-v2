/**
 * Firebase Cloud Messaging 서비스
 * Topic 기반 푸시 발송
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
  clickAction?: string;
}

// 기본 토픽 이름
export const FCM_TOPIC_NOTICES = 'mate-notices';

// JWT 생성을 위한 base64url 인코딩
function base64url(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ArrayBuffer를 base64url로 변환
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64url(binary);
}

// PEM 키를 CryptoKey로 변환
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// JWT 토큰 생성
async function createJwt(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1시간 유효

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = arrayBufferToBase64url(signature);
  return `${signatureInput}.${encodedSignature}`;
}

// OAuth2 액세스 토큰 획득
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const jwt = await createJwt(serviceAccount);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth2 token request failed: ${text}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * FCM 서비스 클래스
 */
export class FcmService {
  private serviceAccount: ServiceAccount;
  private publicOrigin: string;

  constructor(env: Env) {
    this.serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    this.publicOrigin = env.MATEAPP_URI || 'https://matedevdao.github.io/mate-app';
  }

  /**
   * 토픽 구독
   */
  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    try {
      const accessToken = await getAccessToken(this.serviceAccount);

      const response = await fetch('https://iid.googleapis.com/iid/v1:batchAdd', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'access_token_auth': 'true',
        },
        body: JSON.stringify({
          to: `/topics/${topic}`,
          registration_tokens: [token],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[FCM] Topic subscribe failed: ${text}`);
        return false;
      }

      console.log(`[FCM] Subscribed to topic: ${topic}`);
      return true;
    } catch (err) {
      console.error('[FCM] Subscribe error:', err);
      return false;
    }
  }

  /**
   * 토픽 구독 해제
   */
  async unsubscribeFromTopic(token: string, topic: string): Promise<boolean> {
    try {
      const accessToken = await getAccessToken(this.serviceAccount);

      const response = await fetch('https://iid.googleapis.com/iid/v1:batchRemove', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'access_token_auth': 'true',
        },
        body: JSON.stringify({
          to: `/topics/${topic}`,
          registration_tokens: [token],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[FCM] Topic unsubscribe failed: ${text}`);
        return false;
      }

      console.log(`[FCM] Unsubscribed from topic: ${topic}`);
      return true;
    } catch (err) {
      console.error('[FCM] Unsubscribe error:', err);
      return false;
    }
  }

  /**
   * 토픽으로 푸시 발송
   */
  async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      const accessToken = await getAccessToken(this.serviceAccount);

      const icon = payload.icon || `${this.publicOrigin}/icons/icon-192x192.png`;
      const link = payload.clickAction || this.publicOrigin;

      const message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          ...payload.data,
          clickAction: payload.clickAction || '/',
        },
        android: {
          priority: 'high' as const,
          notification: {
            channel_id: 'notices',
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            icon,
            badge: icon,
          },
          fcm_options: {
            link,
          },
        },
      };

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.serviceAccount.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(`[FCM] Send to topic failed: ${text}`);
        return false;
      }

      console.log(`[FCM] Sent to topic: ${topic}`);
      return true;
    } catch (err) {
      console.error('[FCM] Send error:', err);
      return false;
    }
  }
}

/**
 * 공지사항 푸시 발송 헬퍼
 */
export async function sendAnnouncementPush(
  env: Env,
  announcement: { id: number; title: string; content: string; link_url?: string | null }
): Promise<{ success: boolean }> {
  const fcm = new FcmService(env);

  const bodyPreview = announcement.content.length > 100
    ? announcement.content.substring(0, 97) + '...'
    : announcement.content;

  const success = await fcm.sendToTopic(FCM_TOPIC_NOTICES, {
    title: announcement.title,
    body: bodyPreview,
    data: {
      type: 'announcement',
      announcementId: String(announcement.id),
    },
    clickAction: announcement.link_url || undefined,
  });

  return { success };
}
