import { combinePngs } from '@gaiaprotocol/worker-common';
import parts from './kingcrowndao-kongz-parts.json' assert { type: 'json' };

export async function generateKingCrowndaoKongzImage(env: Env, url: string, data: {
  traits?: { [traitName: string]: string | number };
  parts: { [partName: string]: string | number };
}) {
  const skins: string[] = [];
  for (const [partName, part] of Object.entries(data.parts)) {
    skins.push(`${partName}/${part}`);
  }

  const images: { path: string; drawingOrder: number }[] = [];
  for (const [partName, partValue] of Object.entries(data.parts)) {
    const category = parts.find((cat) => cat.name === partName);
    if (category) {
      const part = category.parts.find((p) => p.name === partValue);
      if (part?.images) {
        for (const image of part.images) {
          images.push({
            path: `/kingcrowndao-kongz/parts-images/${image.path}`,
            drawingOrder: image.drawingOrder,
          });
        }
      }
    }
  }

  const buffers = await Promise.all(
    images.map((image) =>
      env.ASSETS.fetch(new URL(image.path, url)).then((response) =>
        response.arrayBuffer()
      )
    ),
  );

  return combinePngs(1000, 1000, buffers);
}
