/**
 * Resumable upload utility for Firebase Storage
 */

import { ref, uploadBytesResumable, getDownloadURL, UploadTask, UploadTaskSnapshot } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

export interface ResumableUploadOptions {
  onProgress?: (progress: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onError?: (error: Error) => void;
  onComplete?: (downloadURL: string) => void;
}

export interface ResumableUploadResult {
  task: UploadTask;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

/**
 * Upload a file to Firebase Storage with resumable upload support
 * 
 * @param file - File to upload
 * @param path - Storage path (e.g., 'unprocessed_fonts/filename.ttf')
 * @param options - Upload options and callbacks
 * @returns Upload task and control functions
 */
export function uploadFileResumable(
  file: File,
  path: string,
  options: ResumableUploadOptions = {}
): ResumableUploadResult {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  // Set up event listeners
  uploadTask.on(
    'state_changed',
    (snapshot: UploadTaskSnapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      options.onProgress?.(progress);

      switch (snapshot.state) {
        case 'paused':
          options.onPause?.();
          break;
        case 'running':
          options.onResume?.();
          break;
      }
    },
    (error) => {
      options.onError?.(error);
    },
    () => {
      // Upload completed
      getDownloadURL(uploadTask.snapshot.ref)
        .then((downloadURL) => {
          options.onComplete?.(downloadURL);
        })
        .catch((error) => {
          options.onError?.(error);
        });
    }
  );

  return {
    task: uploadTask,
    pause: () => uploadTask.pause(),
    resume: () => uploadTask.resume(),
    cancel: () => uploadTask.cancel(),
  };
}

/**
 * Exponential backoff with jitter for retry logic
 * Ensures minimum delay of baseDelay plus random jitter up to exponentialDelay
 */
export function getRetryDelay(attempt: number, baseDelay: number = 500, maxDelay: number = 30000): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Ensure minimum delay of baseDelay, with random jitter up to exponentialDelay
  const jitter = baseDelay + Math.random() * (exponentialDelay - baseDelay);
  return jitter;
}

