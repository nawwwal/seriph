import type { ThemeName } from '@/lib/theme/themes';
import { themeOptions } from '@/lib/theme/themes';

export interface ThemeMeta {
  value: ThemeName;
  label: string;
  edition: string;
}

export const themeMetaList: readonly ThemeMeta[] = themeOptions.map((option, index) => ({
  value: option.value,
  label: option.label,
  edition: String(index + 1).padStart(2, '0'),
}));

export function themeMetaFor(theme: ThemeName): ThemeMeta {
  return themeMetaList.find((item) => item.value === theme) ?? themeMetaList[0];
}
