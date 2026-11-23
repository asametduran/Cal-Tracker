import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Small compressed JPEG data URI for storing with a meal. Undefined if the image can't be processed. */
export async function makeThumbnail(uri: string, width = 256): Promise<string | undefined> {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
    return result.base64 ? `data:image/jpeg;base64,${result.base64}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Downscaled JPEG for AI analysis. Meal photos don't need camera resolution, and a smaller upload is
 * faster and cheaper. Returns null if the image can't be processed.
 */
export async function prepareForAnalysis(uri: string, width = 1024): Promise<string | null> {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    return result.base64 ?? null;
  } catch {
    return null;
  }
}

/** Reads any image URI (file://, blob:, http) into a bare base64 string. Fallback when the picker gives none. */
export async function uriToBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
