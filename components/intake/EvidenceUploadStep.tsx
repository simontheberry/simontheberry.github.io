'use client';

import { useState, useCallback } from 'react';
import { Upload, X, FileIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  uploadedFileIds: string[];
  onFileIdsChange: (ids: string[]) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export function EvidenceUploadStep({ uploadedFileIds, onFileIdsChange }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      if (files.length >= MAX_FILES) {
        setUploadError(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      const filesToProcess = Array.from(fileList).slice(0, MAX_FILES - files.length);
      const errors: string[] = [];

      for (const file of filesToProcess) {
        // Validate file inline to avoid dependency issues
        let error: string | null = null;
        if (file.size > MAX_FILE_SIZE) {
          error = `File is too large (max ${formatFileSize(MAX_FILE_SIZE)})`;
        } else if (!ALLOWED_TYPES.includes(file.type)) {
          error = 'File type not supported';
        }

        if (error) {
          errors.push(`${file.name}: ${error}`);
        }
      }

      if (errors.length > 0) {
        setUploadError(errors.join('; '));
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        for (const file of filesToProcess) {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/v1/evidence/upload', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          if (data.success) {
            setFiles((prev) => [
              ...prev,
              {
                id: data.data.id,
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date(),
              },
            ]);
            onFileIdsChange([...uploadedFileIds, data.data.id]);
          } else {
            setUploadError(`Failed to upload ${file.name}`);
          }
        }
      } catch {
        setUploadError('Upload failed. Please check your connection and try again.');
      } finally {
        setIsUploading(false);
      }
    },
    [files, uploadedFileIds, onFileIdsChange]
  );

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      onFileIdsChange(uploadedFileIds.filter((fid) => fid !== id));
    },
    [uploadedFileIds, onFileIdsChange]
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div>
      <p className="text-sm text-gov-grey-500 mb-6">
        Upload supporting documents like emails, receipts, screenshots, or correspondence with the business.
      </p>

      <div className="space-y-4">
        {/* Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-gov-blue-500 bg-gov-blue-50'
              : 'border-gov-grey-300 bg-gov-grey-50 hover:border-gov-blue-400'
          }`}
        >
          <input
            type="file"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isUploading || files.length >= MAX_FILES}
            accept={ALLOWED_TYPES.join(',')}
          />
          <Upload className="h-8 w-8 text-gov-grey-400 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-gov-grey-900">
            Drag and drop files here or click to select
          </p>
          <p className="text-xs text-gov-grey-500 mt-1">
            Supported: PDF, images (JPEG, PNG), Word, text • Max {formatFileSize(MAX_FILE_SIZE)} per file
          </p>
        </div>

        {/* Error Message */}
        {uploadError && (
          <div className="rounded-md bg-gov-red/5 border border-gov-red/20 p-3 flex gap-3">
            <AlertCircle className="h-5 w-5 text-gov-red flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-gov-red">{uploadError}</p>
          </div>
        )}

        {/* Uploaded Files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gov-grey-500 uppercase tracking-wide">
              Uploaded files ({files.length}/{MAX_FILES})
            </p>
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 rounded-md border border-gov-grey-200 bg-gov-grey-50">
                <FileIcon className="h-5 w-5 text-gov-grey-400 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gov-grey-900 truncate">{file.name}</p>
                  <p className="text-xs text-gov-grey-500">{formatFileSize(file.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-gov-green flex-shrink-0" aria-hidden="true" />
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 text-gov-grey-500 hover:text-gov-red"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Uploading State */}
        {isUploading && (
          <div className="rounded-md bg-gov-blue-50/50 border border-gov-blue-100 p-3 flex gap-2 items-center">
            <Loader2 className="h-5 w-5 text-gov-blue-500 animate-spin flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-gov-blue-700">Uploading files...</p>
          </div>
        )}

        {/* Help text */}
        <div className="rounded-md bg-gov-grey-50 border border-gov-grey-100 p-4 text-xs text-gov-grey-600 space-y-1">
          <p className="font-medium text-gov-grey-700">Good evidence includes:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Emails or messages with the business</li>
            <li>Screenshots of website or advertising claims</li>
            <li>Transaction receipts or invoices</li>
            <li>Photos of products or damage</li>
            <li>Correspondence with the business</li>
          </ul>
        </div>

        {/* Privacy Note */}
        <p className="text-xs text-gov-grey-500">
          Only upload files you&apos;re comfortable sharing with the business if needed for investigation. Do not include sensitive personal information of others.
        </p>
      </div>
    </div>
  );
}
