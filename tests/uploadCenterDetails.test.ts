import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/Button', () => ({ Button: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => createElement('button', props, children) }));

import UploadReviewPanel from '@/components/upload/UploadReviewPanel';

describe('Upload Center detail actions', () => {
  it('shows actionable structured errors without exposing private paths', () => {
    const html = renderToStaticMarkup(createElement(UploadReviewPanel, {
      batchId: 'batch-1',
      reviewItems: [{ id: 'item-1', filename: 'Atlas.otf', reason: 'Path traversal blocked', attempts: 1, maxAttempts: 3, error: 'gs://private-bucket/users/secret/Atlas.otf', retryable: true }],
      actions: { retry: vi.fn(), cancel: vi.fn() },
    }));
    expect(html).toContain('Path traversal blocked');
    expect(html).toContain('Attempt 1 of 3');
    expect(html).toContain('Retry');
    expect(html).not.toContain('gs://');
  });
});
