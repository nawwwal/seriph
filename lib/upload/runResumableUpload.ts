import type { MutableRefObject } from 'react';
import type { User } from 'firebase/auth';
import type { UploadTask } from 'firebase/storage';
import { uploadFileResumable, getRetryDelay } from '@/lib/utils/resumableUpload';
import { NORMALIZATION_SPEC_VERSION } from '@/utils/normalizationSpec';
import { findRegistration } from './registrationResponse';
import { patchFile, type SetFiles, type UploadableFile } from './uploadTypes';

interface Ctx {
  user: User;
  setFiles: SetFiles;
  tasks: MutableRefObject<Map<string, UploadTask>>;
}

async function register(file: UploadableFile, user: User) {
  const idToken = await user.getIdToken();
  const res = await fetch('/api/v1/uploads/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      files: [{
        originalName: file.file.name,
        size: file.file.size,
        contentType: file.file.type,
        contentHash: file.parseResult?.contentHash,
        quickHash: file.parseResult?.quickHash,
        normalizationSpecVersion: NORMALIZATION_SPEC_VERSION,
        previewFamilyKey: file.parseResult?.provisionalFamily
          ? `${file.parseResult.provisionalFamily}-${user.uid}-${Date.now()}`
          : undefined,
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Registration failed: ${res.status}`);
  }
  const data: unknown = await res.json();
  return findRegistration(data, file.file.name);
}

function startUpload(file: UploadableFile, storagePath: string, ingestId: string, attempt: number, ctx: Ctx) {
  const { setFiles, tasks } = ctx;
  const result = uploadFileResumable(file.file, storagePath, {
    onProgress: (progress) => patchFile(setFiles, file.id, { progress: Math.round(progress), lastProgressTime: new Date().toISOString() }),
    onPause: () => patchFile(setFiles, file.id, { status: 'paused' }),
    onResume: () => patchFile(setFiles, file.id, { status: 'submitting' }),
    onError: (error) => {
      const next = attempt + 1;
      if (next < 8) {
        patchFile(setFiles, file.id, { status: 'retrying', retryCount: next, error: `Retrying... (attempt ${next})` });
        setTimeout(() => startUpload(file, storagePath, ingestId, next, ctx), getRetryDelay(attempt));
      } else {
        patchFile(setFiles, file.id, { status: 'error', error: `Upload failed after ${next} attempts: ${error.message}` });
      }
    },
    onComplete: () =>
      patchFile(setFiles, file.id, { status: 'processed_by_api', progress: 100, apiResponseMessage: 'File submitted for server processing.', ingestId }),
  });
  tasks.current.set(file.id, result.task);
  patchFile(setFiles, file.id, { uploadTask: result.task, retryCount: attempt, error: undefined });
}

/** Register + resumable-upload a single file, with bounded retries on the register step. */
export async function runResumableUpload(file: UploadableFile, ctx: Ctx, retryAttempt = 0): Promise<void> {
  const { user, setFiles } = ctx;
  patchFile(setFiles, file.id, { status: 'submitting', progress: 0, error: undefined, apiResponseMessage: undefined, retryCount: retryAttempt });

  try {
    const registration = await register(file, user);
    if (!registration) throw new Error('Failed to register upload');
    if (registration.error === 'duplicate') {
      patchFile(setFiles, file.id, { status: 'error', error: 'This file already exists in your library.', apiResponseMessage: 'Duplicate file detected. Skip or replace existing?' });
      return;
    }
    if (!registration.success) throw new Error(registration.error || 'Failed to register upload');
    if (!registration.storagePath || !registration.ingestId) throw new Error('Upload registration was incomplete');
    startUpload(file, registration.storagePath, registration.ingestId, 0, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    const next = retryAttempt + 1;
    const retriable = message.includes('network') || message.includes('Failed to fetch');
    if (next < 4 && retriable) {
      patchFile(setFiles, file.id, { status: 'retrying', retryCount: next, error: `Retrying register... (attempt ${next})` });
      setTimeout(() => {
        runResumableUpload(file, ctx, next).catch(() =>
          patchFile(setFiles, file.id, { status: 'error', error: `Upload failed after ${next} attempts.` })
        );
      }, getRetryDelay(next - 1));
    } else {
      patchFile(setFiles, file.id, { status: 'error', error: message });
    }
  }
}
