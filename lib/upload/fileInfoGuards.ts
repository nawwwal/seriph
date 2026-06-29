import type { FileInfo } from '@/lib/upload/registerFiles';

export function isFileInfoArray(value: unknown): value is FileInfo[] {
  return Array.isArray(value) && value.every((item) => (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as { originalName?: unknown }).originalName === 'string'
  ));
}
