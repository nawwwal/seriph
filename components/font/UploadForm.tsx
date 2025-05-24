'use client';

import { useState, FormEvent } from 'react';

export default function UploadForm() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(event.target.files);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!files || files.length === 0) {
      setMessage('Please select at least one file.');
      return;
    }

    setIsLoading(true);
    setMessage('');
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('fonts', files[i]);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Upload successful! Files: ${data.filenames?.join(', ') || 'N/A'}. Server message: ${data.message}`);
      } else {
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map((err: {file: string, error: string}) => `${err.file}: ${err.error}`).join('\n');
          setMessage(`Upload failed:\n${data.message}\n${errorMessages}`);
        } else {
          setMessage(`Upload failed: ${data.error || data.message || 'Unknown server error'}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage(`Upload failed: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setIsLoading(false);
      setFiles(null); // Clear the file input
      const fileInput = document.getElementById('font-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Fonts</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="font-upload" className="block text-sm font-medium text-gray-700">
            Select font files (TTF, OTF, WOFF, WOFF2, EOT, ZIP)
          </label>
          <input
            id="font-upload"
            type="file"
            multiple
            onChange={handleFileChange}
            accept=".ttf,.otf,.woff,.woff2,.eot,.zip"
            className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !files || files.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {message && (
        <p className={`mt-4 text-sm ${message.startsWith('Upload failed') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
