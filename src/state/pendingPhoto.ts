import type { PhotoInput } from '@/ai/types';

/** The photo handed from the Capture screen to the Review screen. Memory only. */
let pending: PhotoInput | null = null;

export function setPendingPhoto(photo: PhotoInput): void {
  pending = photo;
}

export function getPendingPhoto(): PhotoInput | null {
  return pending;
}

export function clearPendingPhoto(): void {
  pending = null;
}
