import type { ComicDatabase } from '@/db/schema';
import { canPerform } from '@/app/proPolicy';

export interface ImageFilters {
  contrast: number;
  sharpness: number;
  warmth: number;
}
export const ORIGINAL_FILTERS: Readonly<ImageFilters> = {
  contrast: 100,
  sharpness: 0,
  warmth: 0,
};
const amount = (
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
) =>
  value !== undefined && Number.isFinite(value)
    ? Math.round(Math.max(min, Math.min(max, value)))
    : fallback;
export function normalizeImageFilters(
  value?: Partial<ImageFilters>,
): ImageFilters {
  return {
    contrast: amount(value?.contrast, 50, 150, 100),
    sharpness: amount(value?.sharpness, 0, 100, 0),
    warmth: amount(value?.warmth, 0, 100, 0),
  };
}
export function originalFilters(value: ImageFilters): boolean {
  return value.contrast === 100 && value.sharpness === 0 && value.warmth === 0;
}
export function activeImageFilters(
  value: ImageFilters | undefined,
  pro: boolean,
): ImageFilters {
  return pro ? normalizeImageFilters(value) : { ...ORIGINAL_FILTERS };
}
/** 仅更新这本书；失去 Pro 后仍可还原，不触碰位置、书签或原件。 */
export async function saveImageFilters(
  db: ComicDatabase,
  bookId: string,
  value: ImageFilters,
  pro: boolean,
): Promise<ImageFilters> {
  const next = normalizeImageFilters(value);
  if (
    !canPerform(originalFilters(next) ? 'filters.reset' : 'filters.change', pro)
  )
    throw new Error('PRO_REQUIRED');
  const updated = await db.books.update(bookId, { imageFilters: next });
  if (!updated && !(await db.books.get(bookId)))
    throw new Error('BOOK_MISSING');
  return next;
}
