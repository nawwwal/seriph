'use client';

import { useCallback, useRef, useState } from 'react';
import type { UploadTask } from 'firebase/storage';
import { useFontParserWorker } from '@/lib/hooks/useFontParserWorker';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploadConnectivity } from '@/lib/hooks/useUploadConnectivity';
import { useUploadQueue } from '@/lib/hooks/useUploadQueue';
import { parseFilesForPreview } from '@/lib/upload/parseFilesForPreview';
import type { UploadableFile } from '@/lib/upload/uploadTypes';
import PreviewGroupingPanel from './PreviewGroupingPanel';
import UploadDropArea from './UploadDropArea';
import UploadQueueItem from './UploadQueueItem';
import { Button } from '@/components/ui/Button';

interface ModalUploadFormProps {
  onUploadComplete?: () => void;
}

export default function ModalUploadForm({ onUploadComplete }: ModalUploadFormProps) {
  const [filesToUpload, setFilesToUpload] = useState<UploadableFile[]>([]);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [showPreviewGrouping, setShowPreviewGrouping] = useState(false);
  const { parseBatch } = useFontParserWorker();
  const { user } = useAuth();
  const uploadTasksRef = useRef<Map<string, UploadTask>>(new Map());

  useUploadConnectivity(setFilesToUpload, globalMessage, setGlobalMessage);
  const { isBatchProcessing, startBatchUpload } = useUploadQueue({
    files: filesToUpload,
    setFiles: setFilesToUpload,
    user,
    tasks: uploadTasksRef,
    setGlobalMessage,
    onUploadComplete,
  });

  const addFiles = useCallback(
    (files: File[]) =>
      parseFilesForPreview(files, filesToUpload, parseBatch, {
        setFiles: setFilesToUpload,
        setGlobalMessage,
        setShowPreview: setShowPreviewGrouping,
      }),
    [filesToUpload, parseBatch]
  );
  const removeFile = (id: string) => setFilesToUpload((prev) => prev.filter((f) => f.id !== id));

  const pendingCount = filesToUpload.filter((f) => f.status === 'pending').length;
  const submittingCount = filesToUpload.filter((f) => f.status === 'submitting').length;
  const previewFiles = filesToUpload.filter((f) => f.parseResult?.success);

  return (
    <div className="p-1">
      <UploadDropArea onFiles={addFiles} />

      {globalMessage && (
        <p className={`mb-4 text-sm text-center ${
          globalMessage.includes('successfully') ? 'text-[var(--success)]'
            : globalMessage.toLowerCase().includes('fail') || globalMessage.toLowerCase().includes('error') ? 'text-[var(--danger)]'
            : 'opacity-70'}`}>
          {globalMessage}
        </p>
      )}

      {showPreviewGrouping && previewFiles.length > 0 && (
        <div className="mb-6">
          <PreviewGroupingPanel
            files={previewFiles.map((f) => ({ id: f.id, file: f.file, parseResult: f.parseResult, parseError: f.parseError }))}
            onRemoveFile={removeFile}
          />
        </div>
      )}

      {filesToUpload.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          <h3 className="text-lg font-semibold opacity-70 mb-2">Upload Queue ({filesToUpload.length})</h3>
          {filesToUpload.map((item) => (
            <UploadQueueItem key={item.id} item={item} setFiles={setFilesToUpload} tasks={uploadTasksRef} onRemove={removeFile} />
          ))}
        </div>
      )}

      {filesToUpload.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <Button
            onClick={startBatchUpload}
            disabled={pendingCount === 0 || isBatchProcessing}
            size="uploadSubmit"
            tone="success"
          >
            {isBatchProcessing
              ? `Submitting ${submittingCount} file(s)...`
              : pendingCount > 0 ? `Submit ${pendingCount} Pending File${pendingCount > 1 ? 's' : ''} to Server` : 'All Files Submitted'}
          </Button>
        </div>
      )}
    </div>
  );
}
