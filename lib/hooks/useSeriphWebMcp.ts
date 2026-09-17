'use client';

import { useEffect } from 'react';
import { seriphFontTools } from '@/lib/mcp/fontTools';
import { importFontsTool } from '@/lib/mcp/importFonts';
import { registerSeriphWebMcp } from '@/lib/webmcp/register';

export function useSeriphWebMcp(getIdToken?: () => Promise<string>, familyId?: string) {
  useEffect(() => {
    if (!getIdToken) return;
    const controller = new AbortController();
    void registerSeriphWebMcp(
      [...seriphFontTools({ getIdToken, familyId }), importFontsTool(getIdToken)],
      controller.signal,
    );
    return () => controller.abort();
  }, [familyId, getIdToken]);
}
