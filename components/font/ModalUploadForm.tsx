'use client';

import { useState, useCallback, ChangeEvent, DragEvent, useEffect, useRef } from 'react';
import { UploadCloud, FileText, XCircle, CheckCircle2, AlertTriangle, Hourglass, Pause, Play } from 'lucide-react';
import { useFontParserWorker } from '@/lib/hooks/useFontParserWorker';
import PreviewGroupingPanel, { type PreviewFile } from './PreviewGroupingPanel';
import type { ParseResult } from '@/lib/workers/font-parser.worker';
import { useAuth } from '@/lib/contexts/AuthContext';
import { uploadFileResumable, getRetryDelay } from '@/lib/utils/resumableUpload';
import { NORMALIZATION_SPEC_VERSION } from '@/utils/normalizationSpec';
import type { UploadTask } from 'firebase/storage';

// Upload file status tracking
type UploadClientStatus =
  | 'pending'          // Waiting in client queue
  | 'parsing'          // Parsing font file for preview grouping
  | 'submitting'       // Resumable upload in progress
  | 'paused'           // Upload paused (user action or network offline)
  | 'retrying'         // Retry in progress after failure
  | 'resumed'          // Upload resumed after pause
  | 'verifying'        // Server confirms file integrity and creates ingest record
  | 'processed_by_api' // Upload complete, submitted for processing
  | 'error';           // Error during upload or API reported failure

interface UploadableFile {
  id: string;
  file: File;
  status: UploadClientStatus;
  progress: number; // 0-100 for upload progress
  error?: string; // Error message from upload or API response for this file
  apiResponseMessage?: string; // Success message from API for this file
  parseResult?: ParseResult; // Font parsing result for preview grouping
  parseError?: string; // Error during parsing
  uploadTask?: UploadTask; // Firebase Storage upload task for pause/resume
  ingestId?: string; // Ingest record ID from registration
  retryCount?: number; // Number of retry attempts
  lastProgressTime?: string; // Timestamp of last progress update
}

interface ModalUploadFormProps {
  onUploadComplete?: () => void;
}

const MAX_CONCURRENT_UPLOADS = 3; // Max concurrent XHR uploads

export default function ModalUploadForm({ onUploadComplete }: ModalUploadFormProps) {
  const [filesToUpload, setFilesToUpload] = useState<UploadableFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [activeUploadCount, setActiveUploadCount] = useState(0);
  const [showPreviewGrouping, setShowPreviewGrouping] = useState(false);
  const { parseBatch } = useFontParserWorker();
  const { user } = useAuth();
  const uploadTasksRef = useRef<Map<string, UploadTask>>(new Map());
  const isOnlineRef = useRef(navigator.onLine);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFilesToList(Array.from(event.target.files));
      event.target.value = '';
    }
  };

  const addFilesToList = useCallback(async (newFiles: File[]) => {
    // Filter out duplicates
    const uniqueFiles = newFiles.filter(
      file => !filesToUpload.some(existing => existing.file.name === file.name && existing.file.size === file.size)
    );

    if (uniqueFiles.length === 0) return;

    // Check for WOFF2 files (not supported client-side)
    const woff2Files = uniqueFiles.filter(f => f.name.toLowerCase().endsWith('.woff2'));
    const parseableFiles = uniqueFiles.filter(f => !f.name.toLowerCase().endsWith('.woff2'));

    // Create file entries
    const newUploadableFiles: UploadableFile[] = uniqueFiles.map(file => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      status: file.name.toLowerCase().endsWith('.woff2') ? 'pending' : 'parsing',
      progress: 0,
      parseError: file.name.toLowerCase().endsWith('.woff2') 
        ? 'WOFF2 files will be parsed on the server' 
        : undefined,
    }));

    setFilesToUpload(prev => [...prev, ...newUploadableFiles]);
    setGlobalMessage(null);

    // Parse parseable files for preview grouping
    if (parseableFiles.length > 0) {
      try {
        const parseResults = await parseBatch(parseableFiles, {
          onProgress: (id, progress) => {
            // Update progress if needed
          },
          onComplete: (result) => {
            setFilesToUpload(prev =>
              prev.map(f => {
                if (f.file.name === result.id.split('-')[0] || f.parseResult?.id === result.id) {
                  return {
                    ...f,
                    status: result.success ? 'pending' : 'error',
                    parseResult: result,
                    parseError: result.success ? undefined : result.errors?.join(', '),
                  };
                }
                return f;
              })
            );
          },
        });

        // Update files with parse results - match by filename
        setFilesToUpload(prev =>
          prev.map(file => {
            // Find matching result by comparing filename
            const result = parseResults.find(r => {
              // Result ID format: filename-timestamp-random, so extract filename
              const resultFilename = r.id.split('-').slice(0, -3).join('-');
              return file.file.name === resultFilename || r.filename === file.file.name;
            });
            if (result) {
              return {
                ...file,
                status: result.success ? 'pending' : 'error',
                parseResult: result,
                parseError: result.success ? undefined : result.errors?.join(', '),
              };
            }
            return file;
          })
        );

        // Show preview grouping if we have successful parses
        const hasSuccessfulParses = parseResults.some(r => r.success);
        if (hasSuccessfulParses) {
          setShowPreviewGrouping(true);
        }
      } catch (error: any) {
        console.error('Failed to parse files:', error);
        // Mark all as error
        setFilesToUpload(prev =>
          prev.map(f => ({
            ...f,
            status: 'error',
            parseError: `Failed to parse: ${error.message}`,
          }))
        );
      }
    }

    // Show message for WOFF2 files
    if (woff2Files.length > 0) {
      setGlobalMessage(
        `${woff2Files.length} WOFF2 file${woff2Files.length > 1 ? 's' : ''} will be parsed on the server.`
      );
    }
  }, [filesToUpload, parseBatch]);

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      addFilesToList(Array.from(event.dataTransfer.files));
      event.dataTransfer.clearData();
    }
  };

  const removeFile = (fileId: string) => {
    // Only remove the specific file. The previous logic kept only
    // pending files, inadvertently dropping any others from the list.
    setFilesToUpload(prev => prev.filter(f => f.id !== fileId));
  };

  // Connectivity monitoring
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      // Resume paused uploads when back online
      setFilesToUpload(prev =>
        prev.map(f => {
          if (f.status === 'paused' && f.uploadTask) {
            f.uploadTask.resume();
            return { ...f, status: 'submitting' as UploadClientStatus };
          }
          return f;
        })
      );
      if (globalMessage?.includes('Poor connection')) {
        setGlobalMessage('Connection restored. Uploads resuming...');
      }
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      // Pause active uploads when offline
      setFilesToUpload(prev =>
        prev.map(f => {
          if (f.status === 'submitting' && f.uploadTask) {
            f.uploadTask.pause();
            return { ...f, status: 'paused' as UploadClientStatus };
          }
          return f;
        })
      );
      setGlobalMessage('Poor connection detected. Uploads will resume automatically.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [globalMessage]);

  const uploadSingleFileResumable = async (fileToProcess: UploadableFile, retryAttempt: number = 0): Promise<void> => {
    if (!user) {
      setFilesToUpload(prev =>
        prev.map(f =>
          f.id === fileToProcess.id
            ? { ...f, status: 'error', error: 'Please sign in to upload fonts.' }
            : f
        )
      );
      return;
    }

    // Update status to submitting
    setFilesToUpload(prev =>
      prev.map(f =>
        f.id === fileToProcess.id
          ? {
              ...f,
              status: 'submitting',
              progress: 0,
              error: undefined,
              apiResponseMessage: undefined,
              retryCount: retryAttempt,
            }
          : f
      )
    );

    try {
      // Step 1: Register upload with API to get storage path
      const idToken = await user.getIdToken();
      const registerResponse = await fetch('/api/upload/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          files: [
            {
              originalName: fileToProcess.file.name,
              size: fileToProcess.file.size,
              contentType: fileToProcess.file.type,
              contentHash: fileToProcess.parseResult?.contentHash,
              quickHash: fileToProcess.parseResult?.quickHash,
              normalizationSpecVersion: NORMALIZATION_SPEC_VERSION,
              previewFamilyKey: fileToProcess.parseResult?.provisionalFamily
                ? `${fileToProcess.parseResult.provisionalFamily}-${user.uid}-${Date.now()}`
                : undefined,
            },
          ],
        }),
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Registration failed: ${registerResponse.status}`);
      }

      const registerData = await registerResponse.json();
      const registration = registerData.results?.find(
        (r: any) => r.originalName === fileToProcess.file.name
      );

      if (!registration) {
        throw new Error('Failed to register upload');
      }

      // Handle duplicate
      if (registration.error === 'duplicate') {
        setFilesToUpload(prev =>
          prev.map(f =>
            f.id === fileToProcess.id
              ? {
                  ...f,
                  status: 'error',
                  error: 'This file already exists in your library.',
                  apiResponseMessage: 'Duplicate file detected. Skip or replace existing?',
                }
              : f
          )
        );
        return;
      }

      if (!registration.success) {
        throw new Error(registration.error || 'Failed to register upload');
      }

      // Step 2: Upload file to Storage using resumable upload
      const uploadResult = uploadFileResumable(fileToProcess.file, registration.storagePath, {
        onProgress: (progress) => {
          setFilesToUpload(prev =>
            prev.map(f =>
              f.id === fileToProcess.id
                ? {
                    ...f,
                    progress: Math.round(progress),
                    lastProgressTime: new Date().toISOString(),
                  }
                : f
            )
          );
        },
        onPause: () => {
          setFilesToUpload(prev =>
            prev.map(f =>
              f.id === fileToProcess.id ? { ...f, status: 'paused' as UploadClientStatus } : f
            )
          );
        },
        onResume: () => {
          setFilesToUpload(prev =>
            prev.map(f =>
              f.id === fileToProcess.id ? { ...f, status: 'submitting' as UploadClientStatus } : f
            )
          );
        },
        onError: (error) => {
          const retryCount = (fileToProcess.retryCount || 0) + 1;
          if (retryCount < 8) {
            // Retry with exponential backoff
            const delay = getRetryDelay(retryCount - 1);
            setTimeout(() => {
              uploadSingleFileResumable(fileToProcess, retryCount).catch(() => {
                setFilesToUpload(prev =>
                  prev.map(f =>
                    f.id === fileToProcess.id
                      ? { ...f, status: 'error', error: `Upload failed after ${retryCount} attempts.` }
                      : f
                  )
                );
              });
            }, delay);
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === fileToProcess.id
                  ? { ...f, status: 'retrying' as UploadClientStatus, retryCount }
                  : f
              )
            );
          } else {
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === fileToProcess.id
                  ? {
                      ...f,
                      status: 'error',
                      error: `Upload failed after ${retryCount} attempts: ${error.message}`,
                    }
                  : f
              )
            );
          }
        },
        onComplete: () => {
          setFilesToUpload(prev =>
            prev.map(f =>
              f.id === fileToProcess.id
                ? {
                    ...f,
                    status: 'processed_by_api',
                    progress: 100,
                    apiResponseMessage: 'File submitted for server processing.',
                    ingestId: registration.ingestId,
                  }
                : f
            )
          );
        },
      });

      // Store upload task for pause/resume
      uploadTasksRef.current.set(fileToProcess.id, uploadResult.task);
      setFilesToUpload(prev =>
        prev.map(f =>
          f.id === fileToProcess.id ? { ...f, uploadTask: uploadResult.task } : f
        )
      );
    } catch (error: any) {
      const retryCount = (fileToProcess.retryCount || 0) + 1;
      if (retryCount < 8 && (error.message?.includes('network') || error.message?.includes('Failed to fetch'))) {
        // Retry on network errors
        const delay = getRetryDelay(retryCount - 1);
        setTimeout(() => {
          uploadSingleFileResumable(fileToProcess, retryCount).catch(() => {
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === fileToProcess.id
                  ? { ...f, status: 'error', error: `Upload failed after ${retryCount} attempts.` }
                  : f
              )
            );
          });
        }, delay);
        setFilesToUpload(prev =>
          prev.map(f =>
            f.id === fileToProcess.id
              ? { ...f, status: 'retrying' as UploadClientStatus, retryCount, error: `Retrying... (attempt ${retryCount})` }
              : f
          )
        );
      } else {
        setFilesToUpload(prev =>
          prev.map(f =>
            f.id === fileToProcess.id
              ? { ...f, status: 'error', error: error.message || 'Upload failed.' }
              : f
          )
        );
      }
    }
  };

  const manageUploadQueue = useCallback(async () => {
    const filesCurrentlyPendingClient = filesToUpload.filter(f => f.status === 'pending');
    const canStartMore = MAX_CONCURRENT_UPLOADS - activeUploadCount;

    for (let i = 0; i < Math.min(filesCurrentlyPendingClient.length, canStartMore); i++) {
      const fileToSubmit = filesCurrentlyPendingClient[i];
      setActiveUploadCount(prev => prev + 1);
      uploadSingleFileResumable(fileToSubmit).finally(() => {
        setActiveUploadCount(prev => prev - 1);
      });
    }
  }, [filesToUpload, activeUploadCount, user]);

  useEffect(() => {
    if (isBatchProcessing && filesToUpload.some(f => f.status === 'pending')) {
      manageUploadQueue();
    }

    const nonFinalStates: UploadClientStatus[] = ['pending', 'parsing', 'submitting', 'paused', 'retrying', 'resumed', 'verifying'];
    if (isBatchProcessing && activeUploadCount === 0 && !filesToUpload.some(f => nonFinalStates.includes(f.status))) {
      setIsBatchProcessing(false);
      const successfulCount = filesToUpload.filter(f => f.status === 'processed_by_api').length;
      const errorCount = filesToUpload.filter(f => f.status === 'error').length;

      if (successfulCount > 0 && errorCount === 0) {
        setGlobalMessage(`All ${successfulCount} file(s) submitted successfully for server processing.`);
      } else if (filesToUpload.length > 0) {
        setGlobalMessage(`Batch submission finished. ${successfulCount} submitted, ${errorCount} failed. Check individual file status.`);
      } else {
        setGlobalMessage("No files were submitted.");
      }

      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
          // Optionally clear the list after completion and message visibility
          // setFilesToUpload([]);
          // setGlobalMessage(null);
        }, 2000);
      }
    }
  }, [filesToUpload, activeUploadCount, isBatchProcessing, manageUploadQueue, onUploadComplete]);

  const startBatchUpload = () => {
    const filesToSubmit = filesToUpload.filter(f => f.status === 'pending');
    if (filesToSubmit.length === 0) {
      setGlobalMessage("No new files to submit, or all files are already processed/failed.");
      return;
    }
    setIsBatchProcessing(true);
    setGlobalMessage(`Submitting ${filesToSubmit.length} file(s)...`);
    // useEffect will call manageUploadQueue
  };

  const pendingFileCount = filesToUpload.filter(f => f.status === 'pending').length;
  const currentlySubmittingCount = filesToUpload.filter(f => f.status === 'submitting').length;

  return (
    <div className="p-1">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors
                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <UploadCloud className={`mx-auto mb-3 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} size={48} />
        <p className="mb-2 text-gray-600">
          Drag & drop your font files here (TTF, OTF, WOFF, WOFF2, EOT)
        </p>
        <p className="text-sm text-gray-500 mb-3">or</p>
        <input
          type="file"
          id="modal-font-upload-simplified"
          multiple
          onChange={handleFileChange}
          accept=".ttf,.otf,.woff,.woff2,.eot"
          className="hidden"
        />
        <label
          htmlFor="modal-font-upload-simplified"
          className="cursor-pointer px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Choose Files
        </label>
        {isDragging && <p className="mt-3 text-blue-500 font-semibold">Release to drop files</p>}
      </div>

      {globalMessage && (
          <p className={`mb-4 text-sm text-center ${
              globalMessage.includes('successfully') ? 'text-green-600' :
              globalMessage.toLowerCase().includes('fail') || globalMessage.toLowerCase().includes('error')? 'text-red-600' : 'text-gray-700'}`}>
              {globalMessage}
          </p>
      )}

      {/* Preview Grouping Panel */}
      {showPreviewGrouping && filesToUpload.some(f => f.parseResult?.success) && (
        <div className="mb-6">
          <PreviewGroupingPanel
            files={filesToUpload
              .filter(f => f.parseResult?.success)
              .map(f => ({
                id: f.id,
                file: f.file,
                parseResult: f.parseResult,
                parseError: f.parseError,
              }))}
            onRemoveFile={(id) => removeFile(id)}
          />
        </div>
      )}

      {filesToUpload.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Upload Queue ({filesToUpload.length})</h3>
          {filesToUpload.map(item => {
            let statusIcon, statusColor, statusText;

            switch(item.status) {
                case 'processed_by_api':
                    statusIcon = <CheckCircle2 className="text-green-500 mr-3 shrink-0" size={20} />;
                    statusColor = 'text-green-600';
                    statusText = item.apiResponseMessage || 'Submitted for server processing';
                    break;
                case 'error':
                    statusIcon = <AlertTriangle className="text-red-500 mr-3 shrink-0" size={20} />;
                    statusColor = 'text-red-600';
                    statusText = item.error || item.parseError || 'An unknown error occurred';
                    break;
                case 'parsing':
                    statusIcon = <Hourglass className="text-blue-500 mr-3 shrink-0 animate-spin" size={20} />;
                    statusColor = 'text-blue-600';
                    statusText = 'Parsing font...';
                    break;
                case 'paused':
                    statusIcon = <Pause className="text-yellow-500 mr-3 shrink-0" size={20} />;
                    statusColor = 'text-yellow-600';
                    statusText = item.lastProgressTime
                      ? `Paused at ${item.progress}% (${new Date(item.lastProgressTime).toLocaleTimeString()})`
                      : `Paused at ${item.progress}%`;
                    break;
                case 'retrying':
                    statusIcon = <Hourglass className="text-orange-500 mr-3 shrink-0 animate-spin" size={20} />;
                    statusColor = 'text-orange-600';
                    statusText = item.error || `Retrying... (attempt ${(item.retryCount || 0) + 1})`;
                    break;
                case 'resumed':
                    statusIcon = <Play className="text-blue-500 mr-3 shrink-0" size={20} />;
                    statusColor = 'text-blue-600';
                    statusText = `Resumed... ${item.progress}%`;
                    break;
                case 'verifying':
                    statusIcon = <Hourglass className="text-blue-500 mr-3 shrink-0 animate-spin" size={20} />;
                    statusColor = 'text-blue-600';
                    statusText = 'Verifying...';
                    break;
                case 'submitting':
                    statusIcon = <Hourglass className="text-blue-500 mr-3 shrink-0 animate-spin" size={20} />;
                    statusColor = 'text-blue-600';
                    statusText = `Uploading... ${item.progress}%`;
                    break;
                case 'pending':
                default:
                    statusIcon = <FileText className="text-gray-500 mr-3 shrink-0" size={20} />;
                    statusColor = 'text-gray-500';
                    statusText = item.parseError || 'Pending submission';
                    break;
            }

            return (
              <div key={item.id} className="p-3 border rounded-md bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    {statusIcon}
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate" title={item.file.name}>{item.file.name}</p>
                      <p className={`text-xs ${statusColor}`}>
                        ({(item.file.size / 1024).toFixed(1)} KB) -
                        <span className="font-medium ml-1" title={item.error || item.apiResponseMessage}>
                           {statusText.substring(0,60)}{statusText.length > 60 ? '...':''}
                        </span>
                      </p>
                    </div>
                  </div>
                  {(item.status === 'pending' || item.status === 'parsing' || item.status === 'error' || item.status === 'paused') && (
                    <div className="flex items-center gap-2">
                      {item.status === 'paused' && item.uploadTask && (
                        <button
                          onClick={() => {
                            item.uploadTask?.resume();
                            setFilesToUpload(prev =>
                              prev.map(f =>
                                f.id === item.id ? { ...f, status: 'resumed' as UploadClientStatus } : f
                              )
                            );
                          }}
                          className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
                          aria-label="Resume upload"
                        >
                          <Play size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (item.uploadTask) {
                            item.uploadTask.cancel();
                            uploadTasksRef.current.delete(item.id);
                          }
                          removeFile(item.id);
                        }}
                        className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <XCircle size={18} />
                      </button>
                    </div>
                  )}
                  {item.status === 'submitting' && item.uploadTask && (
                    <button
                      onClick={() => {
                        item.uploadTask?.pause();
                        setFilesToUpload(prev =>
                          prev.map(f =>
                            f.id === item.id ? { ...f, status: 'paused' as UploadClientStatus } : f
                          )
                        );
                      }}
                      className="text-yellow-500 hover:text-yellow-700 p-1 rounded-full hover:bg-yellow-50"
                      aria-label="Pause upload"
                    >
                      <Pause size={18} />
                    </button>
                  )}
                </div>
                {(item.status === 'submitting' || item.status === 'paused' || item.status === 'retrying' || item.status === 'resumed') && item.progress < 100 && (
                  <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        item.status === 'paused' ? 'bg-yellow-500' :
                        item.status === 'retrying' ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filesToUpload.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <button
            onClick={startBatchUpload}
            disabled={pendingFileCount === 0 || isBatchProcessing}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold"
          >
            {isBatchProcessing
                ? `Submitting ${currentlySubmittingCount} file(s)...`
                : pendingFileCount > 0 ? `Submit ${pendingFileCount} Pending File${pendingFileCount > 1 ? 's' : ''} to Server` : `All Files Submitted`}
          </button>
        </div>
      )}
    </div>
  );
}
