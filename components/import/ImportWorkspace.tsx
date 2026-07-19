'use client';

import { useCallback, useEffect } from 'react';
import Dropzone from '@/components/ui/Dropzone';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDurableBatchUpload } from '@/lib/hooks/useDurableBatchUpload';
import { consumePendingFonts } from '@/utils/pendingFonts';
import { filesFromInput, type WalkedFile } from '@/utils/walkDirectoryEntries';

export default function ImportWorkspace() {
  const { user } = useAuth();
  const { upload: durableUpload, isUploading, recovery, progressBySource } = useDurableBatchUpload();
  const upload = useCallback(async (walked: WalkedFile[]) => {
    await durableUpload(walked);
  }, [durableUpload]);
  const handleWalked = useCallback(
    (walked: WalkedFile[]) => {
      if (!user || walked.length === 0) return;
      void upload(walked);
    },
    [user, upload]
  );

  useEffect(() => {
    if (!user) return;
    const pending = consumePendingFonts(user.uid);
    if (pending && pending.length > 0) void upload(filesFromInput(pending));
  }, [user, upload]);

  return (
    <>
      {recovery && !isUploading && (
        <p id="import-recovery-hint" className="mb-4 text-sm" role="status" aria-live="polite">
          This import is waiting for files. Reselect the original files or folder to resume it; matching name, path, and size keep the saved source IDs.
        </p>
      )}
      <Dropzone onFilesWalked={handleWalked} allowFolders accept=".ttf,.otf,.woff,.woff2,.zip" disabled={isUploading} />
      {Object.entries(progressBySource).length > 0 && <div className="mt-3 space-y-1 text-xs" role="status" aria-live="polite">
        {Object.entries(progressBySource).map(([sourceId, percent]) => <p key={sourceId}>{sourceId}: {percent}%</p>)}
      </div>}
    </>
  );
}
