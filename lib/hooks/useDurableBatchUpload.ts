'use client';

import { useUploads } from '@/lib/contexts/UploadContext';

export { runDurableUpload, prepareDurableSources } from '@/lib/imports/durableUploadRunner';

export function useDurableBatchUpload() {
  const { state, actions, meta } = useUploads();
  return {
    upload: actions.upload,
    cancel: actions.cancelClientUpload,
    isUploading: state.isClientUploading,
    enabled: meta.uploadEnabled,
    recovery: state.recovery,
    progressBySource: state.sourceProgress,
  };
}
