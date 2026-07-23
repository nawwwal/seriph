'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useUploads } from '@/lib/contexts/UploadContext';
import { useDurableBatchUpload } from '@/lib/hooks/useDurableBatchUpload';
import { filesFromInput } from '@/utils/walkDirectoryEntries';

export default function ImportOptionsModal() {
  const { isImportOpen, closeImport } = useUploads();
  const { upload, isUploading } = useDurableBatchUpload();
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    if (files.length === 0) return;
    closeImport();
    void upload(filesFromInput(files));
  };

  return (
    <Modal isOpen={isImportOpen} onClose={closeImport} title="Import" size="sm">
      <button type="button" disabled={isUploading} onClick={() => fileInput.current?.click()} className="grid w-full place-items-center gap-2 border-2 border-dashed border-[var(--ink)] px-5 py-10 text-center transition-colors hover:bg-[var(--control-track)] disabled:opacity-50">
        <Upload size={24} aria-hidden />
        <strong className="text-lg">Drop fonts here</strong>
        <span className="text-sm opacity-70">Files, folders, or ZIPs</span>
        <span className="text-xs font-bold uppercase underline">Choose fonts</span>
      </button>
      <input ref={fileInput} hidden type="file" multiple accept=".ttf,.otf,.woff,.woff2,.zip" onChange={selected} />
    </Modal>
  );
}
