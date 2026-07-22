'use client';

import { useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUploads } from '@/lib/contexts/UploadContext';
import { useDurableBatchUpload } from '@/lib/hooks/useDurableBatchUpload';
import { filesFromInput } from '@/utils/walkDirectoryEntries';

export default function ImportOptionsModal() {
  const { isImportOpen, closeImport } = useUploads();
  const { upload, isUploading } = useDurableBatchUpload();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const choose = (input: React.RefObject<HTMLInputElement | null>) => input.current?.click();
  const selected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    if (files.length === 0) return;
    closeImport();
    void upload(filesFromInput(files));
  };

  return (
    <Modal isOpen={isImportOpen} onClose={closeImport} title="Import" size="sm">
      <p className="mb-4 text-sm opacity-75">Add fonts to your shelf. Folders and ZIPs keep their paths.</p>
      <div className="grid gap-2">
        <Button type="button" disabled={isUploading} onClick={() => choose(fileInput)}>Choose files</Button>
        <Button type="button" disabled={isUploading} onClick={() => choose(folderInput)}>Choose folder</Button>
        <Button type="button" disabled={isUploading} onClick={() => choose(zipInput)}>Choose ZIP</Button>
      </div>
      <input ref={fileInput} hidden type="file" multiple accept=".ttf,.otf,.woff,.woff2,.zip" onChange={selected} />
      <input ref={folderInput} hidden type="file" multiple onChange={selected} {...{ webkitdirectory: '' }} />
      <input ref={zipInput} hidden type="file" accept=".zip" onChange={selected} />
    </Modal>
  );
}
