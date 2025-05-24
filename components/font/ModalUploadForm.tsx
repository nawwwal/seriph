'use client';

import { useState, useCallback, ChangeEvent, DragEvent, useEffect } from 'react';
import { UploadCloud, FileText, XCircle } from 'lucide-react'; // Icons

interface UploadableFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100 for upload progress
  error?: string;
  serverData?: any; // Response from server for this file
}

interface ModalUploadFormProps {
  onUploadComplete?: () => void; // Callback for when all uploads are done
}

const MAX_CONCURRENT_UPLOADS = 3;

export default function ModalUploadForm({ onUploadComplete }: ModalUploadFormProps) {
  const [filesToUpload, setFilesToUpload] = useState<UploadableFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [activeUploadCount, setActiveUploadCount] = useState(0);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFilesToList(Array.from(event.target.files));
      event.target.value = ''; // Reset file input
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
    setGlobalMessage(null); // Clear previous messages
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
    // You can add visual cues here if needed
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
    setFilesToUpload(prev => prev.filter(f => f.id !== fileId && f.status === 'pending')); // Only allow removing pending files
  };

  const processFile = async (fileToProcess: UploadableFile) => {
    setFilesToUpload(prev =>
      prev.map(f =>
        f.id === fileToProcess.id ? { ...f, status: 'uploading', progress: 0 } : f
      )
    );

    const formData = new FormData();
    formData.append('fonts', fileToProcess.file);
    let success = false;

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

        xhr.onloadstart = () => {
          setFilesToUpload(prev =>
              prev.map(f =>
                f.id === fileToProcess.id ? { ...f, progress: 0 } : f
              )
            );
        };

        xhr.onload = async () => {
          setFilesToUpload(prev =>
            prev.map(f =>
              f.id === fileToProcess.id ? { ...f, status: 'processing', progress: 100 } : f
            )
          );
          await new Promise(r => setTimeout(r, 100));

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.results && data.results.length > 0) {
                const fileResult = data.results[0];
                if (fileResult.success) {
                  setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'completed', serverData: fileResult.data } : f));
                  success = true;
                } else {
                  setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: fileResult.error || 'Unknown server error' } : f));
                }
              } else if (data.error) {
                  setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: data.error } : f));
              } else if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                  const specificError = data.errors.find((err: { file: string }) => err.file === fileToProcess.file.name);
                  setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: specificError?.error || data.message || 'Server processing error' } : f));
              } else {
                setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: data.message || 'An unknown error occurred processing the response.' } : f));
              }
            } catch (parseError: any) {
              console.error("Error parsing server response:", parseError);
              setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: 'Error parsing server response' } : f));
            }
          } else {
            let errorMsg = `Server error: ${xhr.status}`;
            try {
                const errorData = JSON.parse(xhr.responseText);
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) { /* Ignore */ }
            setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: errorMsg } : f));
          }
          resolve();
        };

        xhr.onerror = () => {
          setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: 'Upload failed (network error)' } : f));
          reject(new Error('Upload failed (network error)'));
        };

        xhr.ontimeout = () => {
          setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: 'Upload timed out' } : f));
          reject(new Error('Upload timed out'));
        };
        xhr.send(formData);
      });
    } catch (error: any) {
      console.error('Upload error for file:', fileToProcess.file.name, error);
      if (!filesToUpload.find(f => f.id === fileToProcess.id && f.status === 'error')) {
           setFilesToUpload(prev => prev.map(f => f.id === fileToProcess.id ? { ...f, status: 'error', error: error.message || 'Client-side error before XHR' } : f));
      }
    }
    return success; // Return whether this specific file was successful
  };

  // Main function to manage the queue and concurrency
  const manageUploadQueue = useCallback(async () => {
    const currentlyPending = filesToUpload.filter(f => f.status === 'pending');
    const canStartMore = MAX_CONCURRENT_UPLOADS - activeUploadCount;

    for (let i = 0; i < Math.min(currentlyPending.length, canStartMore); i++) {
      const fileToProcess = currentlyPending[i];
      setActiveUploadCount(prev => prev + 1);
      // No await here, we want them to run concurrently
      processFile(fileToProcess).finally(() => {
        setActiveUploadCount(prev => prev - 1);
        // After one finishes, try to process more from the queue
        // This will be called recursively until queue is empty or all active slots are busy
      });
    }
  }, [filesToUpload, activeUploadCount]); // Dependencies

  // Effect to trigger queue management when filesToUpload or activeUploadCount changes
  useEffect(() => {
    if (isUploadingBatch && filesToUpload.some(f => f.status === 'pending')) {
      manageUploadQueue();
    }

    // Check for batch completion
    if (isUploadingBatch && activeUploadCount === 0 && !filesToUpload.some(f => f.status === 'pending' || f.status === 'uploading' || f.status === 'processing')) {
      setIsUploadingBatch(false);
      const errorsInBatch = filesToUpload.filter(f => f.status === 'error').length;
      if (errorsInBatch === 0) {
        setGlobalMessage(`Successfully uploaded ${filesToUpload.length} file(s).`);
        if (onUploadComplete) {
          setTimeout(() => {
            onUploadComplete();
            setFilesToUpload([]);
            setGlobalMessage(null);
          }, 1500);
        }
      } else {
        setGlobalMessage(`Batch finished. ${filesToUpload.length - errorsInBatch} succeeded, ${errorsInBatch} failed.`);
      }
    }
  }, [filesToUpload, activeUploadCount, isUploadingBatch, manageUploadQueue, onUploadComplete]);

  const startUpload = () => { // Simplified startUpload, just kicks off the process
    const filesToQueue = filesToUpload.filter(f => f.status === 'pending');
    if (filesToQueue.length === 0) {
      setGlobalMessage("No new files to upload or all files are already processed.");
      return;
    }
    setIsUploadingBatch(true);
    setGlobalMessage(`Queueing ${filesToQueue.length} file(s) for upload...`);
    // The useEffect hook watching isUploadingBatch and filesToUpload will trigger manageUploadQueue
  };

  const pendingFileCount = filesToUpload.filter(f => f.status === 'pending').length;
  const uploadingOrProcessingCount = filesToUpload.filter(f => f.status === 'uploading' || f.status === 'processing').length;

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
          Drag & drop your font files here (TTF, OTF, WOFF, WOFF2, EOT, ZIP)
        </p>
        <p className="text-sm text-gray-500 mb-3">or</p>
        <input
          type="file"
          id="modal-font-upload"
          multiple
          onChange={handleFileChange}
          accept=".ttf,.otf,.woff,.woff2,.eot,.zip"
          className="hidden"
        />
        <label
          htmlFor="modal-font-upload"
          className="cursor-pointer px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Choose Files
        </label>
        {isDragging && <p className="mt-3 text-blue-500 font-semibold">Release to drop files</p>}
      </div>

      {globalMessage && (
          <p className={`mb-4 text-sm text-center ${globalMessage.includes('finished') && !globalMessage.toLowerCase().includes('error') ? 'text-green-600' : globalMessage.toLowerCase().includes('error') ? 'text-red-600' : 'text-gray-700'}`}>
              {globalMessage}
          </p>
      )}

      {filesToUpload.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Upload Queue ({filesToUpload.length})</h3>
          {filesToUpload.map(item => (
            <div key={item.id} className="p-3 border rounded-md bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center min-w-0">
                  <FileText className="text-gray-500 mr-3 shrink-0" size={20} />
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate" title={item.file.name}>{item.file.name}</p>
                    <p className="text-xs text-gray-500">
                      ({(item.file.size / 1024).toFixed(1)} KB) -
                      <span className={
                          `font-medium ml-1
                          ${item.status === 'completed' ? 'text-green-600' :
                            item.status === 'error' ? 'text-red-600' :
                            item.status === 'uploading' || item.status === 'processing' ? 'text-blue-600' : 'text-gray-500'}`
                      }>
                        {item.status === 'error' ? item.error?.substring(0, 50)+'...' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
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
              {(item.status === 'uploading' || item.status === 'processing') && item.progress > 0 && (
                <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.status === 'processing' ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500'}`}
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filesToUpload.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <button
            onClick={startUpload}
            disabled={pendingFileCount === 0 || isUploadingBatch}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold"
          >
            {isUploadingBatch
                ? `Uploading ${uploadingOrProcessingCount} file(s)...`
                : pendingFileCount > 0 ? `Upload ${pendingFileCount} Pending File${pendingFileCount > 1 ? 's' : ''}` : `All Files Processed`}
          </button>
        </div>
      )}
    </div>
  );
}
