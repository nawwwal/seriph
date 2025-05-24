'use client';

import { useState, useCallback, ChangeEvent, DragEvent, useEffect } from 'react';
import { UploadCloud, FileText, XCircle, CheckCircle2, AlertTriangle, Hourglass } from 'lucide-react';

// Simplified UploadableFile status for client-side XHR tracking
type UploadClientStatus =
  | 'pending'          // Waiting in client queue to be submitted by XHR
  | 'submitting'       // XHR to /api/upload in progress
  | 'processed_by_api' // API route confirmed successful submission to unprocessed_fonts/
  | 'error';           // Error during XHR submission or API reported failure for this file

interface UploadableFile {
  id: string;
  file: File;
  status: UploadClientStatus;
  progress: number; // 0-100 for XHR upload progress
  error?: string; // Error message from XHR or API response for this file
  apiResponseMessage?: string; // Success message from API for this file
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFilesToList(Array.from(event.target.files));
      event.target.value = '';
    }
  };

  const addFilesToList = (newFiles: File[]) => {
    const newUploadableFiles: UploadableFile[] = newFiles
      .filter(file => !filesToUpload.some(existing => existing.file.name === file.name && existing.file.size === file.size))
      .map(file => ({
        id: `${file.name}-${file.size}-${Date.now()}`,
        file,
        status: 'pending',
        progress: 0,
      }));
    setFilesToUpload(prev => [...prev, ...newUploadableFiles]);
    setGlobalMessage(null);
  };

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
    setFilesToUpload(prev => prev.filter(f => f.id !== fileId && f.status === 'pending'));
  };

  const uploadSingleFileViaXHR = async (fileToProcess: UploadableFile) => {
    setFilesToUpload(prev =>
      prev.map(f =>
        f.id === fileToProcess.id ? { ...f, status: 'submitting', progress: 0, error: undefined, apiResponseMessage: undefined } : f
      )
    );

    const formData = new FormData();
    formData.append('fonts', fileToProcess.file);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === fileToProcess.id ? { ...f, progress: percentage } : f
              )
            );
          }
        };

        xhr.onload = () => {
          setFilesToUpload(prev =>
            prev.map(f =>
              f.id === fileToProcess.id ? { ...f, progress: 100 } : f
            )
          );

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const apiResponse = JSON.parse(xhr.responseText);
              // The API returns an array of results. Find the one for this file.
              const fileResult = apiResponse.results?.find((r: any) => r.originalName === fileToProcess.file.name);

              if (fileResult && fileResult.success) {
                setFilesToUpload(prev =>
                  prev.map(f =>
                    f.id === fileToProcess.id ? {
                        ...f,
                        status: 'processed_by_api',
                        apiResponseMessage: fileResult.message || 'Submitted for server processing.'
                    } : f
                  )
                );
              } else {
                setFilesToUpload(prev =>
                  prev.map(f =>
                    f.id === fileToProcess.id ? {
                        ...f,
                        status: 'error',
                        error: fileResult?.error || apiResponse.message || 'API reported an error for this file.'
                    } : f
                  )
                );
              }
            } catch (parseError: any) {
              setFilesToUpload(prev =>
                prev.map(f =>
                  f.id === fileToProcess.id ? { ...f, status: 'error', error: 'Error parsing API response.' } : f
                )
              );
            }
          } else {
            let errorMsg = `Upload failed: ${xhr.status}`;
            try {
                const errorData = JSON.parse(xhr.responseText);
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) { /* Ignore */ }
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === fileToProcess.id ? { ...f, status: 'error', error: errorMsg } : f
              )
            );
          }
          resolve();
        };

        xhr.onerror = () => {
          setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: 'Upload failed (network error).' } : f));
          reject(new Error('Upload failed (network error).'));
        };
        xhr.send(formData);
      });
    } catch (error: any) {
      setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: error.message || 'Client-side error before upload.' } : f));
    }
  };

  const manageUploadQueue = useCallback(async () => {
    const filesCurrentlyPendingClient = filesToUpload.filter(f => f.status === 'pending');
    const canStartMore = MAX_CONCURRENT_UPLOADS - activeUploadCount;

    for (let i = 0; i < Math.min(filesCurrentlyPendingClient.length, canStartMore); i++) {
      const fileToSubmit = filesCurrentlyPendingClient[i];
      setActiveUploadCount(prev => prev + 1);
      uploadSingleFileViaXHR(fileToSubmit).finally(() => {
        setActiveUploadCount(prev => prev - 1);
      });
    }
  }, [filesToUpload, activeUploadCount]);

  useEffect(() => {
    if (isBatchProcessing && filesToUpload.some(f => f.status === 'pending')) {
      manageUploadQueue();
    }

    const nonFinalStates: UploadClientStatus[] = ['pending', 'submitting'];
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
                    statusText = item.error || 'An unknown error occurred';
                    break;
                case 'submitting':
                    statusIcon = <Hourglass className="text-blue-500 mr-3 shrink-0 animate-spin" size={20} />;
                    statusColor = 'text-blue-600';
                    statusText = `Submitting... ${item.progress}%`;
                    break;
                case 'pending':
                default:
                    statusIcon = <FileText className="text-gray-500 mr-3 shrink-0" size={20} />;
                    statusColor = 'text-gray-500';
                    statusText = 'Pending submission';
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
                  {item.status === 'pending' && (
                      <button onClick={() => removeFile(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50">
                          <XCircle size={18} />
                      </button>
                  )}
                </div>
                {item.status === 'submitting' && item.progress < 100 && (
                  <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-150"
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
