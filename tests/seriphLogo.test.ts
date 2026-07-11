import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(file: string): string {
  const filePath = path.join(repoRoot, file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

describe('SeriphLogo', () => {
  it('renders the accessible themed wordmark across primary brand surfaces', () => {
    const logo = readRepoFile('components/brand/SeriphLogo.tsx');

    expect(logo).toContain('/seriph-logo.svg');
    expect(logo).toContain("aspectRatio: '193 / 48'");
    expect(logo).toContain("backgroundColor: 'currentColor'");
    expect(logo).toContain('label');
    expect(readRepoFile('components/layout/NavBar.tsx')).toContain("from '@/components/brand/SeriphLogo'");
    expect(readRepoFile('components/home/LandingPage.tsx')).toContain("from '@/components/brand/SeriphLogo'");
  });
});
