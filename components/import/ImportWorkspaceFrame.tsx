'use client';

import { Button } from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type ImportWorkspaceFrameProps =
  | { kind: 'idle'; onOpen: () => void }
  | { kind: 'loading' };

export function ImportWorkspaceFrame(props: ImportWorkspaceFrameProps) {
  return (
    <div className="mx-auto flex min-h-[300px] max-w-3xl items-center justify-center dashed-border rounded-[var(--radius)] p-8">
      {props.kind === 'loading' ? (
        <LoadingSpinner size="small" className="p-0" />
      ) : (
        <Button onClick={props.onOpen} size="mdText">Start import</Button>
      )}
    </div>
  );
}

export function ImportWorkspaceLoading() {
  return <ImportWorkspaceFrame kind="loading" />;
}
