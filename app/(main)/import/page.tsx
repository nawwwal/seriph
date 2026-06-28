'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/layout/NavBar';
import Dropzone from '@/components/ui/Dropzone';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { useResumableBatchUpload } from '@/lib/hooks/useResumableBatchUpload';
import { consumePendingFonts } from '@/utils/pendingFonts';
import { filesFromInput, type WalkedFile } from '@/utils/walkDirectoryEntries';

export default function ImportPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { open: openUploadCenter } = useUploads();
  const { upload, isUploading } = useResumableBatchUpload();

  const handleWalked = useCallback(
    (walked: WalkedFile[]) => {
      if (!user || walked.length === 0) return;
      upload(walked);
    },
    [user, upload]
  );

  // Pick up files handed over from the shelf "Add Fonts" entry point.
  useEffect(() => {
    if (isLoading || !user) return;
    const pending = consumePendingFonts();
    if (pending && pending.length > 0) {
      upload(filesFromInput(pending));
    }
  }, [isLoading, user, upload]);

  if (!user && !isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col">
        <NavBar />
        <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
          <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
            <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
              Import Fonts
            </h1>
          </header>
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
              <button
                onClick={openUploadCenter}
                className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink text-sm sm:text-base"
              >
                Upload Center
              </button>
              <button
                onClick={() => router.push('/')}
                className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink text-sm sm:text-base"
              >
                ← Back to Shelf
              </button>
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
              {isUploading ? 'Uploading…' : 'Add your type'}
            </h2>
            <p className="mt-2 text-lg">
              {isUploading
                ? 'Watch progress in the Upload Center.'
                : 'Drag a folder or files, or pick a folder to ingest in one go.'}
            </p>
          </div>
          <Dropzone onFilesWalked={handleWalked} allowFolders accept=".ttf,.otf,.woff,.woff2,.zip" />
        </main>

        <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">Browse, test, and rediscover your own type. One color, many voices.</p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Tips</div>
              <ul className="mt-2 list-disc pl-5 leading-tight">
                <li>Drop the whole messy folder — zips and subfolders are fine.</li>
                <li>Duplicates are detected and skipped automatically.</li>
              </ul>
            </div>
            <div>
              <div className="uppercase font-bold">Supported</div>
              <p className="mt-2 uppercase text-xs font-bold">TTF · OTF · WOFF · WOFF2 · ZIP · FOLDERS</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
