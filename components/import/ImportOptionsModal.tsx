'use client';

import { useRef } from 'react';
import { FolderUp, Upload } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useUploads } from '@/lib/contexts/UploadContext';
import { filesFromInput } from '@/utils/walkDirectoryEntries';

export default function ImportOptionsModal() {
  const { state, actions } = useUploads();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const selected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    if (files.length === 0) return;
    actions.closeImport();
    void actions.upload(filesFromInput(files));
  };

  return (
    <Modal isOpen={state.isImportOpen} onClose={actions.closeImport} title="Import" size="sm">
      <div className="space-y-3">
        <button type="button" disabled={state.isClientUploading} onClick={() => fileInput.current?.click()} className="grid w-full place-items-center gap-2 border-2 border-dashed border-[var(--ink)] px-5 py-9 text-center transition-colors hover:bg-[var(--control-track)] disabled:opacity-50">
          <Upload size={24} aria-hidden />
          <strong className="text-lg">{state.isClientUploading ? 'Upload in progress' : 'Choose fonts'}</strong>
        </button>
        <button type="button" disabled={state.isClientUploading} onClick={() => folderInput.current?.click()} className="rule flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-xs font-bold uppercase transition-colors hover:bg-[var(--control-track)] disabled:opacity-50">
          <FolderUp size={15} aria-hidden />
          <span>Choose folder</span>
        </button>
      </div>
      <input ref={fileInput} hidden type="file" multiple accept=".ttf,.otf,.woff,.woff2,.zip" onChange={selected} />
      <input ref={folderInput} hidden type="file" multiple onChange={selected} {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} />
    </Modal>
  );
}
