'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import NavBar from '@/components/layout/NavBar';
import Dropzone from '@/components/ui/Dropzone';
import ProcessingView, { UploadItem, UploadStatus } from '@/components/import/ProcessingView';
import Stat from '@/components/ui/Stat';
import { useAuth } from '@/lib/contexts/AuthContext';
import { consumePendingFonts } from '@/utils/pendingFonts';
import { db } from '@/lib/firebase/config';
import { FontFamily } from '@/models/font.models';

const TERMINAL_STATUSES = new Set<UploadStatus>(['completed', 'failed']);

const mapIngestStatus = (status?: string): UploadStatus => {
  if (!status) return 'uploaded';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'uploaded') return 'uploaded';
  return 'processing';
};

export default function ImportPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'summary'>('idle');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listenersRef = useRef<Map<string, () => void>>(new Map());
  const familyNameCacheRef = useRef<Map<string, string>>(new Map());

  const clearListeners = useCallback(() => {
    listenersRef.current.forEach((unsubscribe) => unsubscribe());
    listenersRef.current.clear();
  }, []);

  const resetState = useCallback(() => {
    clearListeners();
    setUploads([]);
    setPhase('idle');
    setError(null);
  }, [clearListeners]);

  const fetchFamilyName = useCallback(async (ingestId: string, familyId: string) => {
    if (!familyId) return;
    if (familyNameCacheRef.current.has(familyId)) {
      const cachedName = familyNameCacheRef.current.get(familyId)!;
      setUploads((prev) =>
        prev.map((upload) =>
          upload.ingestId === ingestId ? { ...upload, familyId, familyName: cachedName } : upload
        )
      );
      return;
    }

    try {
      const familySnap = await getDoc(doc(db, 'fontfamilies', familyId));
      if (familySnap.exists()) {
        const data = familySnap.data() as { name?: string };
        const name = data?.name ?? null;
        if (name) {
          familyNameCacheRef.current.set(familyId, name);
          setUploads((prev) =>
            prev.map((upload) =>
              upload.ingestId === ingestId ? { ...upload, familyId, familyName: name } : upload
            )
          );
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch family name', err);
    }

    setUploads((prev) =>
      prev.map((upload) =>
        upload.ingestId === ingestId ? { ...upload, familyId, familyName: upload.familyName ?? null } : upload
      )
    );
  }, []);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!files.length || phase === 'uploading' || phase === 'processing') {
        return;
      }

      const fontFiles = files.filter((file) => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['ttf', 'otf', 'woff', 'woff2'].includes(ext || '');
      });

      if (fontFiles.length === 0) {
        setError('No valid font files found. Please upload .ttf, .otf, .woff, or .woff2 files.');
        return;
      }

      if (!user) {
        setError('Please sign in to upload fonts.');
        return;
      }

      clearListeners();
      setError(null);
      setPhase('uploading');
      setUploads(fontFiles.map((file) => ({ fileName: file.name, status: 'uploaded' })));

      try {
        const idToken = await user.getIdToken();
        const form = new FormData();
        for (const file of fontFiles) form.append('fonts', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
          body: form,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Upload failed');
        }

        const results = Array.isArray(payload?.results) ? payload.results : [];
        const successfulUploads: UploadItem[] = results
          .filter((result: any) => result?.success)
          .map((result: any) => ({
            ingestId: result.ingestId ?? result.id,
            fileName: result.originalName ?? 'Font file',
            status: 'uploaded',
          }));
        const failedUploads: UploadItem[] = results
          .filter((result: any) => !result?.success)
          .map((result: any) => ({
            fileName: result.originalName ?? 'Font file',
            status: 'failed',
            error: result.error ?? 'Failed to submit file for processing.',
          }));

        const combined = [...successfulUploads, ...failedUploads];
        if (!combined.length) {
          setError('No files were uploaded.');
          setUploads([]);
          setPhase('idle');
          return;
        }

        setUploads(combined);
        setPhase(successfulUploads.length > 0 ? 'processing' : 'summary');
      } catch (err: any) {
        console.error('Upload failed:', err);
        setError(err?.message || 'Upload failed.');
        setUploads([]);
        setPhase('idle');
      }
    },
    [clearListeners, phase, user]
  );

  useEffect(() => {
    if (!user || phase !== 'processing') {
      return;
    }

    uploads.forEach((upload) => {
      if (!upload.ingestId || TERMINAL_STATUSES.has(upload.status)) {
        return;
      }

      if (listenersRef.current.has(upload.ingestId)) {
        return;
      }

      const unsubscribe = onSnapshot(
        doc(db, 'users', user.uid, 'ingests', upload.ingestId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setUploads((prev) =>
              prev.map((item) =>
                item.ingestId === upload.ingestId
                  ? { ...item, status: 'failed', error: 'Upload record missing.' }
                  : item
              )
            );
            return;
          }

          const data = snapshot.data() as Record<string, any>;
          const nextStatus = mapIngestStatus(data.status);
          setUploads((prev) =>
            prev.map((item) =>
              item.ingestId === upload.ingestId
                ? {
                    ...item,
                    status: nextStatus,
                    error: data.error ?? item.error ?? null,
                    familyId: data.familyId ?? item.familyId ?? null,
                  }
                : item
            )
          );

          if (data.familyId) {
            fetchFamilyName(upload.ingestId!, data.familyId);
          }
        },
        (listenerError) => {
          console.error('Ingest listener error:', listenerError);
          setUploads((prev) =>
            prev.map((item) =>
              item.ingestId === upload.ingestId
                ? { ...item, status: 'failed', error: listenerError.message }
                : item
            )
          );
        }
      );

      listenersRef.current.set(upload.ingestId, unsubscribe);
    });
  }, [fetchFamilyName, phase, uploads, user]);

  useEffect(() => {
    uploads.forEach((upload) => {
      if (!upload.ingestId) return;
      if (!TERMINAL_STATUSES.has(upload.status)) return;
      const unsubscribe = listenersRef.current.get(upload.ingestId);
      if (unsubscribe) {
        unsubscribe();
        listenersRef.current.delete(upload.ingestId);
      }
    });
  }, [uploads]);

  useEffect(() => {
    if (phase !== 'processing' || uploads.length === 0) return;
    const allDone = uploads.every((upload) => TERMINAL_STATUSES.has(upload.status));
    if (allDone) {
      setPhase('summary');
    }
  }, [phase, uploads]);

  // Warm shelf cache via server API when any upload completes so Shelf shows fonts immediately
  useEffect(() => {
    (async () => {
      if (!user || uploads.length === 0) return;
      const anyCompleted = uploads.some((u) => u.status === 'completed');
      if (!anyCompleted) return;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/families', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const families: FontFamily[] = Array.isArray(json?.families) ? json.families : [];
        const cacheKey = user?.uid ? `fontFamiliesCache_all_${user.uid}` : 'fontFamiliesCache_all';
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), data: families })
        );
      } catch (e) {
        // Non-fatal cache warm failure
        console.warn('Shelf cache warm failed', e);
      }
    })();
  }, [uploads, user]);

  useEffect(() => {
    if (isLoading) return;
    const pending = consumePendingFonts();
    if (pending && pending.length > 0) {
      handleFilesSelected(pending);
    }
  }, [handleFilesSelected, isLoading]);

  useEffect(() => clearListeners, [clearListeners]);

  const stats = useMemo(() => {
    if (uploads.length === 0) {
      return { total: 0, completed: 0, processing: 0, failed: 0 };
    }
    const completed = uploads.filter((upload) => upload.status === 'completed').length;
    const failed = uploads.filter((upload) => upload.status === 'failed').length;
    const processing = uploads.filter(
      (upload) => upload.status === 'processing' || upload.status === 'uploaded'
    ).length;
    return { total: uploads.length, completed, processing, failed };
  }, [uploads]);

  const statusLabel =
    phase === 'summary'
      ? 'Complete'
      : phase === 'processing'
      ? 'Processing'
      : phase === 'uploading'
      ? 'Uploading'
      : 'Ready';
  const isDropzoneDisabled = phase === 'uploading' || phase === 'processing';

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
            <p className="mt-2">Please sign in to upload fonts to your library.</p>
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
                onClick={() => router.push('/')}
                className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink text-sm sm:text-base"
              >
                ← Back to Shelf
              </button>
            </div>
          </div>
          <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
            Upload font files to add them to your library. Files are processed and organized
            automatically.
          </p>
        </header>

        {uploads.length > 0 && (
          <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <Stat label="Total Files" value={stats.total} />
              <Stat label="Completed" value={stats.completed} />
              <Stat label="Processing" value={stats.processing} />
              <Stat label="Failed" value={stats.failed} />
              <div className="p-3 sm:p-4">
                <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Status</div>
                <div className="text-2xl sm:text-3xl font-black cap-tight">{statusLabel}</div>
              </div>
            </div>
          </section>
        )}

        <main className="mt-6 sm:mt-8 md:mt-10 space-y-8">
          {(phase === 'idle' || phase === 'summary') && (
            <div className="fade-in">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                  {phase === 'summary' ? 'Import More Fonts' : 'Select Font Files'}
                </h2>
                <p className="mt-2 text-lg">
                  Drag and drop or click to browse your font files.
                </p>
              </div>
              <Dropzone onFilesSelected={handleFilesSelected} disabled={isDropzoneDisabled} />
            </div>
          )}

          {phase === 'uploading' && uploads.length > 0 && (
            <div className="text-center p-10 rule rounded-[var(--radius)] fade-in">
              <h2 className="text-2xl font-black uppercase mb-4">Uploading Fonts</h2>
              <p className="text-lg">
                Submitting {uploads.length} file{uploads.length !== 1 ? 's' : ''} for processing...
              </p>
            </div>
          )}

          {phase === 'processing' && uploads.length > 0 && (
            <ProcessingView uploads={uploads} phase="processing" />
          )}

          {phase === 'summary' && uploads.length > 0 && (
            <ProcessingView uploads={uploads} phase="summary" />
          )}

          {error && (
            <div className="text-center p-10 rule rounded-[var(--radius)] fade-in bg-[var(--muted)]">
              <h2 className="text-2xl font-black uppercase mb-4">Upload Issue</h2>
              <p className="text-lg mb-6">{error}</p>
              <button
                onClick={resetState}
                className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink"
              >
                Try Again
              </button>
            </div>
          )}
        </main>

        <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">
                A no-fuss library to browse, test, and tidy your type. One color, many voices.
              </p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Tips</div>
              <ul className="mt-2 list-disc pl-5 leading-tight">
                <li>Upload all styles for better grouping.</li>
                <li>Rename files to include weight/style.</li>
              </ul>
            </div>
            <div>
              <div className="uppercase font-bold">Supported Formats</div>
              <p className="mt-2 uppercase text-xs font-bold">TTF · OTF · WOFF · WOFF2</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
