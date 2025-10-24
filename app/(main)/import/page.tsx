'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/layout/NavBar';
import Dropzone from '@/components/ui/Dropzone';
import ProcessingView from '@/components/import/ProcessingView';
import Stat from '@/components/ui/Stat';
import { useAuth } from '@/lib/contexts/AuthContext';

type ImportState =
  | { kind: 'idle' }
  | { kind: 'drag-over' }
  | { kind: 'queued'; files: File[] }
  | {
      kind: 'processing';
      progress: number;
      processed: number;
      total: number;
      currentFile?: string;
    }
  | {
      kind: 'summary';
      families: Array<{ name: string; styles: number; classification: string }>;
    }
  | { kind: 'error'; message: string; files?: string[] };

export default function ImportPage() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>({ kind: 'idle' });
  const { user, isLoading } = useAuth();

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const fontFiles = files.filter((file) => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ['ttf', 'otf', 'woff', 'woff2'].includes(ext || '');
    });

    if (fontFiles.length === 0) {
      setState({
        kind: 'error',
        message: 'No valid font files found. Please upload .ttf, .otf, .woff, or .woff2 files.',
      });
      return;
    }

    if (!user) {
      setState({ kind: 'error', message: 'Please sign in to upload fonts.' });
      return;
    }

    setState({ kind: 'queued', files: fontFiles });

    try {
      const idToken = await user.getIdToken();
      const form = new FormData();
      for (const f of fontFiles) form.append('fonts', f);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Upload failed');
      }
      // Begin progress UI while background processing happens
      processFiles(fontFiles);
    } catch (e: any) {
      setState({ kind: 'error', message: e.message || 'Upload failed.' });
    }
  }, [user]);

  const processFiles = async (files: File[]) => {
    const total = files.length;
    let processed = 0;

    // Simulate processing
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setState({
        kind: 'processing',
        progress: Math.round(((i + 0.5) / total) * 100),
        processed: i,
        total,
        currentFile: file.name,
      });

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      processed++;
      setState({
        kind: 'processing',
        progress: Math.round((processed / total) * 100),
        processed,
        total,
      });
    }

    // Show summary
    setState({
      kind: 'summary',
      families: [
        { name: 'Roboto', styles: 3, classification: 'Sans' },
        { name: 'Montserrat', styles: files.length - 3, classification: 'Sans' },
      ],
    });

    // Redirect to home after 3 seconds
    setTimeout(() => {
      router.push('/');
    }, 3000);
  };

  const isDragOver = state.kind === 'drag-over';
  const isProcessing = state.kind === 'processing';
  const isSummary = state.kind === 'summary';
  const isError = state.kind === 'error';

  // Get stats based on state
  const getStats = () => {
    if (isProcessing) {
      return { families: 2, styles: state.total, recent: state.currentFile || '—' };
    }
    if (isSummary) {
      const totalStyles = state.families.reduce((sum, f) => sum + f.styles, 0);
      return { families: state.families.length, styles: totalStyles, recent: state.families[0]?.name || '—' };
    }
    return { families: 0, styles: 0, recent: '—' };
  };

  const stats = getStats();

  // Gate when signed out
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

        {(isProcessing || isSummary) && (
          <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <Stat label="Families" value={stats.families} />
              <Stat label="Styles" value={stats.styles} />
              <Stat label="Recently Added" value={stats.recent} />
              <div className="p-3 sm:p-4">
                <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Status</div>
                <div className="text-2xl sm:text-3xl font-black cap-tight">
                  {isProcessing ? 'Processing' : 'Complete'}
                </div>
              </div>
            </div>
          </section>
        )}

        <main className="mt-6 sm:mt-8 md:mt-10">
          {state.kind === 'idle' && (
            <div className="fade-in">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                  Select Font Files
                </h2>
                <p className="mt-2 text-lg">Drag and drop or click to browse</p>
              </div>
              <Dropzone onFilesSelected={handleFilesSelected} />
            </div>
          )}

          {state.kind === 'queued' && (
            <div className="text-center p-10 rule rounded-[var(--radius)] fade-in">
              <h2 className="text-2xl font-black uppercase mb-4">Preparing to Upload</h2>
              <p className="text-lg">
                {state.files.length} file{state.files.length !== 1 ? 's' : ''} ready to process
              </p>
            </div>
          )}

          {isProcessing && (
            <ProcessingView
              progress={state.progress}
              processed={state.processed}
              total={state.total}
              currentFile={state.currentFile}
              queuedFiles={
                state.currentFile
                  ? Array(state.total - state.processed - 1)
                      .fill(0)
                      .map((_, i) => `Font-${i + 1}.ttf`)
                  : []
              }
              organizedFamilies={[
                { name: 'Roboto', styles: Math.min(3, state.processed), classification: 'Sans' },
                {
                  name: 'Montserrat',
                  styles: Math.max(0, state.processed - 3),
                  classification: 'Sans',
                },
              ]}
            />
          )}

          {isSummary && (
            <div className="text-center p-10 rule rounded-[var(--radius)] fade-in">
              <h2 className="text-3xl font-black uppercase mb-4">Import Complete!</h2>
              <p className="text-lg mb-6">
                Successfully organized {state.families.length} font{' '}
                {state.families.length !== 1 ? 'families' : 'family'}
              </p>
              <div className="space-y-2 max-w-md mx-auto">
                {state.families.map((family, idx) => (
                  <div key={idx} className="rule p-3 rounded-[var(--radius)] text-left">
                    <div className="font-bold">{family.name}</div>
                    <div className="text-sm opacity-80">
                      {family.styles} style{family.styles !== 1 ? 's' : ''} · {family.classification}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm opacity-70">Redirecting to shelf...</p>
            </div>
          )}

          {isError && (
            <div className="text-center p-10 rule rounded-[var(--radius)] fade-in bg-[var(--muted)]">
              <h2 className="text-2xl font-black uppercase mb-4">Upload Error</h2>
              <p className="text-lg mb-6">{state.message}</p>
              <button
                onClick={() => setState({ kind: 'idle' })}
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

