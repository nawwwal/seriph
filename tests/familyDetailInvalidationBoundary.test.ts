import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('family detail negative cache invalidation boundaries', () => {
  it('invalidates account negatives when shelf mutations or uploads refresh the library', () => {
    const source = readSource('components/home/HomePageContent.tsx');

    expect(source).toContain('clearFamilyDetailNegativeCacheForUser');
    expect(source).toContain('clearFamilyDetailNegativeCacheForUser(user.uid)');
  });

  it('clears account negatives during sign-out cache cleanup', () => {
    const source = readSource('lib/contexts/AuthContext.tsx');

    expect(source).toContain('clearFamilyDetailNegativeCacheForUser');
    expect(source).toContain('clearFamilyDetailNegativeCacheForUser(user.uid)');
  });
});
