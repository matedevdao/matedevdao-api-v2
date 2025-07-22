import { z } from 'zod';
import { jsonWithCors } from '../services/cors';

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

async function handleUploadImage(request: Request, env: Env): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonWithCors({ error: '유효하지 않은 Content-Type입니다' }, 400);
    }

    const formData = await request.formData();
    const imageFile = formData.get('image');

    if (!(imageFile instanceof File)) {
      return jsonWithCors({ error: '유효하지 않은 이미지 파일입니다' }, 400);
    }

    // 업로드
    const uploadResponse = await fetch(`${IMGBB_API_URL}?key=${env.IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return jsonWithCors({ error: `업로드 실패: ${errorText}` }, 500);
    }

    const data = await uploadResponse.json();

    const schema = z.object({
      data: z.object({
        url: z.url(),
        thumb: z.object({ url: z.url() }).optional(),
      }),
    });

    const parsed = schema.parse(data);

    return jsonWithCors({
      imageUrl: parsed.data.url,
      thumbnailUrl: parsed.data.thumb?.url || null,
    });
  } catch (err) {
    return jsonWithCors({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

export { handleUploadImage };
