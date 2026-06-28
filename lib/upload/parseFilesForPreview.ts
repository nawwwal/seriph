import type { ParseResult } from '@/lib/workers/fontParseTypes';
import type { SetFiles, UploadableFile } from './uploadTypes';

type ParseBatch = (files: File[], opts?: { onProgress?: (id: string, p: number) => void; onComplete?: (r: ParseResult) => void }) => Promise<ParseResult[]>;

interface Sinks {
  setFiles: SetFiles;
  setGlobalMessage: (msg: string | null) => void;
  setShowPreview: (show: boolean) => void;
}

const isWoff2 = (name: string) => name.toLowerCase().endsWith('.woff2');

/** Add files to the queue, client-parse the non-woff2 ones, and reveal the preview. */
export async function parseFilesForPreview(
  newFiles: File[],
  currentFiles: UploadableFile[],
  parseBatch: ParseBatch,
  { setFiles, setGlobalMessage, setShowPreview }: Sinks
): Promise<void> {
  const unique = newFiles.filter(
    (file) => !currentFiles.some((e) => e.file.name === file.name && e.file.size === file.size)
  );
  if (unique.length === 0) return;

  const woff2 = unique.filter((f) => isWoff2(f.name));
  const parseable = unique.filter((f) => !isWoff2(f.name));

  const entries: UploadableFile[] = unique.map((file) => ({
    id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    file,
    status: isWoff2(file.name) ? 'pending' : 'parsing',
    progress: 0,
    parseError: isWoff2(file.name) ? 'WOFF2 files will be parsed on the server' : undefined,
  }));
  setFiles((prev) => [...prev, ...entries]);
  setGlobalMessage(null);

  if (parseable.length > 0) {
    try {
      const results = await parseBatch(parseable, {
        onComplete: (result) =>
          setFiles((prev) => {
            const match = prev.find((f) => f.file.name === result.id.split('-')[0] || f.parseResult?.id === result.id);
            return match ? prev.map((f) => (f.id === match.id ? { ...f, status: result.success ? 'pending' : 'error', parseResult: result, parseError: result.success ? undefined : result.errors?.join(', ') } : f)) : prev;
          }),
      });
      setFiles((prev) =>
        prev.map((file) => {
          const result = results.find((r) => r.id.split('-').slice(0, -3).join('-') === file.file.name || r.filename === file.file.name);
          return result ? { ...file, status: result.success ? 'pending' : 'error', parseResult: result, parseError: result.success ? undefined : result.errors?.join(', ') } : file;
        })
      );
      if (results.some((r) => r.success)) setShowPreview(true);
    } catch (error: any) {
      console.error('Failed to parse files:', error);
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'error', parseError: `Failed to parse: ${error.message}` })));
    }
  }

  if (woff2.length > 0) {
    setGlobalMessage(`${woff2.length} WOFF2 file${woff2.length > 1 ? 's' : ''} will be parsed on the server.`);
  }
}
