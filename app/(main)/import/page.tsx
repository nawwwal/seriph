'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/layout/NavBar';
import { Button } from '@/components/ui/Button';
import ImportFooter from '@/components/import/ImportFooter';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';

const ImportWorkspace = dynamic(() => import('@/components/import/ImportWorkspace'), { ssr: false });

export default function ImportPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { open: openUploadCenter } = useUploads();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(
    () => typeof window !== 'undefined' && Object.hasOwn(window, '__seriphPendingFontFiles')
  );

  if (!user && !isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
          <div className="mt-8 p-8 rule rounded-[var(--radius)] max-w-xl">
            <div className="text-xl font-bold">Sign in required</div>
            <p className="mt-2">Sign in to add fonts to your library.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
              Import Fonts
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Button
                onClick={openUploadCenter}
              >
                Upload Center
              </Button>
              <Button
                onClick={() => router.push('/')}
              >
                ← Back to Shelf
              </Button>
            </div>
          </div>
          <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
            Drop a whole folder, loose files, or zips. Seriph unpacks everything, groups it into
            families, and analyzes each face. Track live progress in the Upload Center.
          </p>
        </header>

        <main className="mt-6 sm:mt-8 md:mt-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Add your type
            </h2>
            <p className="mt-2 text-lg">
              Drag a folder or files, or pick a folder to ingest in one go.
            </p>
          </div>
          {isWorkspaceOpen ? (
            <ImportWorkspace />
          ) : (
            <div className="mx-auto flex min-h-[300px] max-w-3xl items-center justify-center dashed-border rounded-[var(--radius)] p-8">
              <Button onClick={() => setIsWorkspaceOpen(true)} size="mdText">
                Start import
              </Button>
            </div>
          )}
        </main>

        <ImportFooter />
      </div>
    </div>
  );
}
