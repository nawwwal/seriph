import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(file: string): string {
  const filePath = path.join(repoRoot, file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

describe('SeriphLogo', () => {
  it('renders the accessible themed mask primitive', () => {
    const logo = readRepoFile('components/brand/SeriphLogo.tsx');

    expect(logo).toContain('/seriph-logo.svg');
    expect(logo).toContain("aspectRatio: '193 / 48'");
    expect(logo).toContain("backgroundColor: 'currentColor'");
    expect(logo).toContain("role={label ? 'img' : undefined}");
    expect(logo).toContain('aria-label={label}');
  });

  it('uses the wordmark component across primary brand surfaces', () => {
    const navBar = readRepoFile('components/layout/NavBar.tsx');
    const landingPage = readRepoFile('components/home/LandingPage.tsx');

    for (const source of [navBar, landingPage]) {
      expect(source).toContain("from '@/components/brand/SeriphLogo'");
      expect(source).toMatch(/<SeriphLogo[^>]*label="Seriph"/);
    }
  });

  it('removes the legacy text-only wordmark from primary brand surfaces', () => {
    for (const file of ['components/layout/NavBar.tsx', 'components/home/LandingPage.tsx']) {
      expect(readRepoFile(file)).not.toMatch(/>\s*Seriph\s*</);
    }
  });
});
