import { act, create } from 'react-test-renderer';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const stable = vi.hoisted(() => ({ upload: vi.fn() }));

vi.mock('@/components/ui/Dropzone', () => ({ default: (props: Record<string, unknown>) => createElement('dropzone', props) }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'user-a' } }) }));
vi.mock('@/lib/hooks/useDurableBatchUpload', () => ({ useDurableBatchUpload: () => ({ upload: stable.upload, isUploading: false, recovery: null, progressBySource: {} }) }));
vi.mock('@/utils/pendingFonts', () => ({ consumePendingFonts: () => null }));

import ImportWorkspace from '@/components/import/ImportWorkspace';

describe('ImportWorkspace boundary', () => {
  it('shows a visible message when durable setup cannot start an import', async () => {
    stable.upload.mockResolvedValue({ ok: false, phase: 'setup', mutationStarted: false, error: new Error('offline') });
    let renderer!: ReturnType<typeof create>;
    await act(async () => { renderer = create(createElement(ImportWorkspace)); });
    const dropzone = renderer.root.findAll((node) => String(node.type) === 'dropzone')[0]!;

    await act(async () => { await dropzone.props.onFilesWalked([{ file: { name: 'one.otf', size: 1 }, relativePath: 'one.otf' }]); });

    expect(renderer.root.findByProps({ id: 'import-error' }).props.children).toContain('Your files were not uploaded');
    renderer.unmount();
  });
});
