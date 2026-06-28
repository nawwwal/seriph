'use client';

import { FileText, CheckCircle2, AlertTriangle, Hourglass, Pause, Play, XCircle } from 'lucide-react';
import { patchFile, type SetFiles, type UploadableFile } from '@/lib/upload/uploadTypes';

function statusMeta(item: UploadableFile): { icon: React.ReactNode; color: string; text: string } {
  const spin = 'mr-3 shrink-0 animate-spin';
  switch (item.status) {
    case 'processed_by_api':
      return { icon: <CheckCircle2 className="text-[var(--success)] mr-3 shrink-0" size={20} />, color: 'text-[var(--success)]', text: item.apiResponseMessage || 'Submitted for server processing' };
    case 'error':
      return { icon: <AlertTriangle className="text-[var(--danger)] mr-3 shrink-0" size={20} />, color: 'text-[var(--danger)]', text: item.error || item.parseError || 'An unknown error occurred' };
    case 'parsing':
      return { icon: <Hourglass className={`text-[var(--info)] ${spin}`} size={20} />, color: 'text-[var(--info)]', text: 'Parsing font...' };
    case 'paused':
      return { icon: <Pause className="text-[var(--warning)] mr-3 shrink-0" size={20} />, color: 'text-[var(--warning)]', text: item.lastProgressTime ? `Paused at ${item.progress}% (${new Date(item.lastProgressTime).toLocaleTimeString()})` : `Paused at ${item.progress}%` };
    case 'retrying':
      return { icon: <Hourglass className={`text-[var(--warning)] ${spin}`} size={20} />, color: 'text-[var(--warning)]', text: item.error || `Retrying... (attempt ${(item.retryCount || 0) + 1})` };
    case 'resumed':
      return { icon: <Play className="text-[var(--info)] mr-3 shrink-0" size={20} />, color: 'text-[var(--info)]', text: `Resumed... ${item.progress}%` };
    case 'verifying':
      return { icon: <Hourglass className={`text-[var(--info)] ${spin}`} size={20} />, color: 'text-[var(--info)]', text: 'Verifying...' };
    case 'submitting':
      return { icon: <Hourglass className={`text-[var(--info)] ${spin}`} size={20} />, color: 'text-[var(--info)]', text: `Uploading... ${item.progress}%` };
    default:
      return { icon: <FileText className="opacity-70 mr-3 shrink-0" size={20} />, color: 'opacity-70', text: item.parseError || 'Pending submission' };
  }
}

interface Props {
  item: UploadableFile;
  setFiles: SetFiles;
  tasks: React.MutableRefObject<Map<string, import('firebase/storage').UploadTask>>;
  onRemove: (id: string) => void;
}

export default function UploadQueueItem({ item, setFiles, tasks, onRemove }: Props) {
  const { icon, color, text } = statusMeta(item);
  const canRemove = ['pending', 'parsing', 'error', 'paused'].includes(item.status);
  const showProgress = ['submitting', 'paused', 'retrying', 'resumed'].includes(item.status) && item.progress < 100;

  const resume = () => { item.uploadTask?.resume(); patchFile(setFiles, item.id, { status: 'resumed' }); };
  const pause = () => { item.uploadTask?.pause(); patchFile(setFiles, item.id, { status: 'paused' }); };
  const remove = () => {
    if (item.uploadTask) { item.uploadTask.cancel(); tasks.current.delete(item.id); }
    onRemove(item.id);
  };

  return (
    <div className="p-3 border rounded-md bg-[var(--surface)] shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          {icon}
          <div className="flex-grow min-w-0">
            <p className="text-sm font-medium opacity-70 truncate" title={item.file.name}>{item.file.name}</p>
            <p className={`text-xs ${color}`}>
              ({(item.file.size / 1024).toFixed(1)} KB) -
              <span className="font-medium ml-1" title={item.error || item.apiResponseMessage}>
                {text.substring(0, 60)}{text.length > 60 ? '...' : ''}
              </span>
            </p>
          </div>
        </div>
        {canRemove && (
          <div className="flex items-center gap-2">
            {item.status === 'paused' && item.uploadTask && (
              <button onClick={resume} className="text-[var(--info)] p-1 rounded-full hover:bg-[color-mix(in_srgb,var(--info)_12%,transparent)]" aria-label="Resume upload"><Play size={18} /></button>
            )}
            <button onClick={remove} className="text-[var(--danger)] p-1 rounded-full hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]" aria-label={`Remove ${item.file.name}`}><XCircle size={18} /></button>
          </div>
        )}
        {item.status === 'submitting' && item.uploadTask && (
          <button onClick={pause} className="text-[var(--warning)] p-1 rounded-full hover:bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]" aria-label="Pause upload"><Pause size={18} /></button>
        )}
      </div>
      {showProgress && (
        <div className="mt-2 h-2 w-full bg-[var(--muted)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-150 ${item.status === 'retrying' ? 'bg-[var(--warning)]' : 'bg-[var(--info)]'}`} style={{ width: `${item.progress}%` }} />
        </div>
      )}
    </div>
  );
}
