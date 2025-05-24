'use client';

import { useState, useCallback, ChangeEvent, DragEvent } from 'react';
import { UploadCloud, FileText, XCircle } from 'lucide-react'; // Icons

interface UploadableFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100 for upload progress
  error?: string;
  serverData?: any; // Response from server for this file
}

export default function ModalUploadForm() {
  const [filesToUpload, setFilesToUpload] = useState<UploadableFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

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
    setFilesToUpload(prev => prev.filter(f => f.id !== fileId));
  };

  const startUpload = async () => {
    if (filesToUpload.filter(f => f.status === 'pending').length === 0) {
        setGlobalMessage("No new files to upload or all files are already processed.");
        return;
    }
    setGlobalMessage("Starting upload process...");

    const filesToProcess = filesToUpload.filter(f => f.status === 'pending');
    let filesProcessedSuccessfully = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const currentFile = filesToProcess[i];

      setFilesToUpload(prev =>
        prev.map(f =>
          f.id === currentFile.id ? { ...f, status: 'uploading', progress: 0 } : f
        )
      );

      const formData = new FormData();
      formData.append('fonts', currentFile.file);

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/upload', true);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentage = Math.round((event.loaded / event.total) * 100);
              setFilesToUpload(prev =>
                prev.map(f =>
                  f.id === currentFile.id ? { ...f, progress: percentage } : f
                )
              );
            }
          };

          xhr.onloadstart = () => {
            // Can set a specific sub-status like 'upload_started' if needed
            setFilesToUpload(prev =>
                prev.map(f =>
                  f.id === currentFile.id ? { ...f, progress: 0 } : f // Ensure progress starts at 0
                )
              );
          };

          xhr.onload = () => {
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === currentFile.id ? { ...f, status: 'processing', progress: 100 } : f
              )
            );
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.results && data.results.length > 0) {
                  const fileResult = data.results[0];
                  if (fileResult.success) {
                    setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'completed', serverData: fileResult.data } : f));
                    filesProcessedSuccessfully++;
                  } else {
                    setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: fileResult.error || 'Unknown server error' } : f));
                  }
                } else if (data.error) {
                    setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: data.error } : f));
                } else if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                    const specificError = data.errors.find((err: { file: string }) => err.file === currentFile.file.name);
                    setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: specificError?.error || data.message || 'Server processing error' } : f));
                } else {
                  setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: data.message || 'An unknown error occurred processing the response.' } : f));
                }
              } catch (parseError: any) {
                console.error("Error parsing server response:", parseError);
                setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: 'Error parsing server response' } : f));
              }
            } else {
              // Handle HTTP errors (e.g., 400, 500)
              let errorMsg = `Server error: ${xhr.status}`;
              try {
                  const errorData = JSON.parse(xhr.responseText);
                  errorMsg = errorData.error || errorData.message || errorMsg;
              } catch (e) { /* Ignore parse error for error response */ }
              setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: errorMsg } : f));
            }
            resolve();
          };

          xhr.onerror = () => {
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === currentFile.id ? { ...f, status: 'error', error: 'Upload failed (network error)' } : f
              )
            );
            reject(new Error('Upload failed (network error)'));
          };

          xhr.ontimeout = () => {
            setFilesToUpload(prev =>
              prev.map(f =>
                f.id === currentFile.id ? { ...f, status: 'error', error: 'Upload timed out' } : f
              )
            );
            reject(new Error('Upload timed out'));
          };

          xhr.send(formData);
        });

      } catch (error: any) {
        console.error('Upload error for file:', currentFile.file.name, error);
        // This catch is for the Promise rejection (onerror, ontimeout)
        // The status is already set in xhr.onerror/ontimeout, so no need to setFilesToUpload here unless for a generic fallback.
        // If it wasn't an XHR error but something else in the try block before the promise:
        if (!filesToUpload.find(f => f.id === currentFile.id && f.status === 'error')) {
             setFilesToUpload(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'error', error: error.message || 'Client-side error before XHR' } : f));
        }
      }
      setOverallProgress(Math.round(((i + 1) / filesToProcess.length) * 100));
    }
    setGlobalMessage(`Upload finished. ${filesProcessedSuccessfully} of ${filesToProcess.length} files processed successfully.`);
    // Potentially call a onSuccess prop to notify parent (e.g., to refresh catalog)
  };

  const pendingFileCount = filesToUpload.filter(f => f.status === 'pending').length;

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
                    className={`h-full rounded-full transition-all duration-150 ease-linear ${item.status === 'processing' ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500'}`}
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
            disabled={pendingFileCount === 0 || filesToUpload.some(f => f.status === 'uploading' || f.status === 'processing')}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold"
          >
            {filesToUpload.some(f => f.status === 'uploading' || f.status === 'processing')
                ? `Uploading... (${overallProgress}%)`
                : pendingFileCount > 0 ? `Upload ${pendingFileCount} Pending File${pendingFileCount > 1 ? 's' : ''}` : `All Files Processed`}
          </button>
        </div>
      )}
    </div>
  );
}
