import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/Button', () => ({ Button: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => createElement('button', props, children) }));

import UploadReviewPanel from '@/components/upload/UploadReviewPanel';

describe('import tray detail actions', () => {
  it('shows actionable structured errors without exposing private paths', () => {
    const html = renderToStaticMarkup(createElement(UploadReviewPanel, {
      batchId: 'batch-1',
      families: [{ id: 'family-1', familyName: '/private/families/Atlas', state: 'failed', retryable: true, attempts: 1, maxAttempts: 3 }],
      reviewItems: [{ id: 'item-1', filename: '/private/Atlas.otf', reason: 'Path traversal blocked /private/reason', detail: '/private/detail', provenance: 'gs://private-bucket/users/secret', state: 'failed', attempts: 1, maxAttempts: 3, error: 'gs://private-bucket/users/secret/Atlas.otf', retryable: true }],
      actions: { retry: vi.fn(), cancel: vi.fn() },
      cancellable: true,
    }));
    expect(html).toContain('Path traversal blocked');
    expect(html).toContain('Attempt 1 of 3');
    expect(html).toContain('Retry');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('gs://');
    expect(html).not.toContain('/private/');

    const terminalHtml = renderToStaticMarkup(createElement(UploadReviewPanel, {
      batchId: 'batch-1', reviewItems: [], actions: { retry: vi.fn(), cancel: vi.fn() }, cancellable: false,
    }));
    expect(terminalHtml).not.toContain('Cancel batch');
  });
});
