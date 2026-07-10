import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const workspaceRoutes = [
  'components/layout/CenteredShell.tsx',
  'components/home/HomePageContent.tsx',
  'components/home/LandingPage.tsx',
  'app/login/page.tsx',
  'app/(main)/search/page.tsx',
  'app/(main)/import/page.tsx',
  'app/(main)/family/[familyId]/page.tsx',
];

function read(file: string): string {
  const filePath = path.join(repoRoot, file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

describe('persistent application frame', () => {
  it('places NavBar in one root AppFrame and not in workspace route modules', () => {
    expect(read('app/layout.tsx')).toContain('<AppFrame>');
    expect(read('components/layout/AppFrame.tsx')).toContain('<NavBar />');

    for (const file of workspaceRoutes) {
      expect(read(file), file).not.toMatch(/(?:@\/components\/layout\/NavBar|\.\/NavBar)/);
    }
  });

  it('keeps UploadCenterModal behind an interaction-bound dynamic import', () => {
    const layout = read('app/layout.tsx');
    const overlay = read('components/upload/UploadCenterOverlay.tsx');

    expect(overlay).toContain("dynamic(() => import('./UploadCenterModal')");
    expect(overlay).toContain('ssr: false');
    expect(overlay).toContain('isOpen');
    expect(layout).toContain('<UploadCenterOverlay />');
    expect(layout).not.toContain('UploadCenterModal');
  });
});
