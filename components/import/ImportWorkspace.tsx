'use client';

import { useCallback, useEffect } from 'react';
import Dropzone from '@/components/ui/Dropzone';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useResumableBatchUpload } from '@/lib/hooks/useResumableBatchUpload';
import { consumePendingFonts } from '@/utils/pendingFonts';
import { filesFromInput, type WalkedFile } from '@/utils/walkDirectoryEntries';

export default function ImportWorkspace() {
  const { user } = useAuth();
  const { upload, isUploading } = useResumableBatchUpload();
  const handleWalked = useCallback(
    (walked: WalkedFile[]) => {
      if (!user || walked.length === 0) return;
      upload(walked);
    },
    [user, upload]
  );

  useEffect(() => {
    if (!user) return;
    const pending = consumePendingFonts(user.uid);
    if (pending && pending.length > 0) upload(filesFromInput(pending));
  }, [user, upload]);

  return (
    <Dropzone
      onFilesWalked={handleWalked}
      allowFolders
      accept=".ttf,.otf,.woff,.woff2,.zip"
      disabled={isUploading}
    />
  );
}
