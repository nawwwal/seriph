'use client';

import { useCallback, useEffect } from 'react';
import Dropzone from '@/components/ui/Dropzone';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDurableBatchUpload } from '@/lib/hooks/useDurableBatchUpload';
import { useResumableBatchUpload } from '@/lib/hooks/useResumableBatchUpload';
import { consumePendingFonts } from '@/utils/pendingFonts';
import { filesFromInput, type WalkedFile } from '@/utils/walkDirectoryEntries';

export default function ImportWorkspace() {
  const { user } = useAuth();
  const legacy = useResumableBatchUpload();
  const durable = useDurableBatchUpload();
  const upload = useCallback(async (walked: WalkedFile[]) => {
    if (!await durable.upload(walked)) await legacy.upload(walked);
  }, [durable, legacy]);
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
    <Dropzone
      onFilesWalked={handleWalked}
      allowFolders
      accept=".ttf,.otf,.woff,.woff2,.zip"
      disabled={durable.isUploading || legacy.isUploading}
    />
  );
}
