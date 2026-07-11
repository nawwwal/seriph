'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import AppShell from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import ImportFooter from '@/components/import/ImportFooter';
import { ImportWorkspaceFrame, ImportWorkspaceLoading } from '@/components/import/ImportWorkspaceFrame';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';

const ImportWorkspace = dynamic(() => import('@/components/import/ImportWorkspace'), {
  ssr: false,
  loading: ImportWorkspaceLoading,
});

export default function ImportPage() {
  const { user, isLoading } = useAuth();
  const { open: openUploadCenter } = useUploads();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(
    () => typeof window !== 'undefined' && Object.hasOwn(window, '__seriphPendingFontFiles')
  );

  if (!user && !isLoading) {
    return (
      <AppShell density="compact">
        <div className="h-full overflow-auto p-6 sm:p-8 md:p-10">
          <div className="max-w-xl rounded-[var(--radius)] rule p-8">
            <div className="text-xl font-bold">Sign in required</div>
            <p className="mt-2">Sign in to add fonts to your library.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      density="compact"
      headerActions={
        <div className="ml-auto flex h-full shrink-0 items-center">
          <Button onClick={openUploadCenter} size="sm">
            Upload Center
          </Button>
        </div>
      }
    >
      <div className="h-full min-h-0 overflow-auto p-5 sm:p-6 md:p-8">
        <header className="rule-b w-full pb-4 sm:pb-5">
          <h1 className="cap-tight text-[clamp(40px,6vw,72px)] font-black uppercase leading-[0.9] tracking-tight">
            Import Fonts
          </h1>
          <p className="mt-3 max-w-3xl text-base tracking-tight sm:text-lg">
            Drop a whole folder, loose files, or zips. Seriph unpacks everything, groups it into
            families, and analyzes each face.
          </p>
        </header>

        <main className="mt-6 sm:mt-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-black uppercase tracking-tight md:text-3xl">
              Add your type
            </h2>
            <p className="mt-2 text-lg">
              Drag a folder or files, or pick a folder to ingest in one go.
            </p>
          </div>
          {isWorkspaceOpen ? (
            <ImportWorkspace />
          ) : (
            <ImportWorkspaceFrame kind="idle" onOpen={() => setIsWorkspaceOpen(true)} />
          )}
        </main>

        <ImportFooter />
      </div>
    </AppShell>
  );
}
