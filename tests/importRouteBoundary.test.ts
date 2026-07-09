import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

describe('import route boundary', () => {
  it('keeps upload and parser work out of the initial import route module', () => {
    const routeSource = readRepoFile('app/(main)/import/page.tsx');

    expect(routeSource).toContain("dynamic(() => import('@/components/import/ImportWorkspace')");
    expect(routeSource).not.toContain("from '@/components/ui/Dropzone'");
    expect(routeSource).not.toContain("from '@/lib/hooks/useResumableBatchUpload'");
    expect(routeSource).not.toContain("from '@/utils/pendingFonts'");
    expect(routeSource).not.toContain("from '@/utils/walkDirectoryEntries'");
  });

  it('contains the upload-only imports behind the interaction-bound workspace', () => {
    const workspaceSource = readRepoFile('components/import/ImportWorkspace.tsx');

    expect(workspaceSource).toContain("from '@/components/ui/Dropzone'");
    expect(workspaceSource).toContain("from '@/lib/hooks/useResumableBatchUpload'");
    expect(workspaceSource).toContain("from '@/utils/pendingFonts'");
    expect(workspaceSource).toContain("from '@/utils/walkDirectoryEntries'");
  });
});
