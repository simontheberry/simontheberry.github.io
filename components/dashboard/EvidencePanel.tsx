'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Loader2,
  AlertCircle,
  Paperclip,
  X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../providers/AuthProvider';

interface EvidenceItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  description: string | null;
  uploadedAt: string;
}

interface Props {
  complaintId: string;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'text/plain',
];

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff,.txt';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMG';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('word')) return 'DOC';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLS';
  return 'FILE';
}

export function EvidencePanel({ complaintId }: Props) {
  const { token } = useAuth();
  const { data: evidence, isLoading, error, refetch } = useApi<EvidenceItem[]>(
    `/api/v1/evidence/${complaintId}`
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: File[]) => {
    // Validate files
    const invalidFiles = files.filter(
      f => !ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|tif|tiff|txt)$/i)
    );
    if (invalidFiles.length > 0) {
      setUploadError(`Unsupported file type: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setUploadError(`File too large (max 50MB): ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    if (files.length > 5) {
      setUploadError('Maximum 5 files per upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const xhr = new XMLHttpRequest();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const result = JSON.parse(xhr.responseText);
              reject(new Error(result.error?.message || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed. Check your connection.')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));

        xhr.open('POST', `/api/v1/evidence/${complaintId}/upload`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });

      setUploadProgress(100);
      refetch();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [complaintId, token, refetch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  }, [uploadFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [uploadFiles]);

  const handleDelete = useCallback(async (evidenceId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/evidence/${evidenceId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json();
      if (result.success) {
        setDeleteConfirmId(null);
        refetch();
      } else {
        setUploadError(result.error?.message || 'Delete failed');
      }
    } catch {
      setUploadError('Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  }, [token, refetch]);

  const items = evidence ?? [];

  return (
    <div className="card">
      <div className="p-4 border-b border-gov-grey-100 flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-gov-grey-500" aria-hidden="true" />
        <h2 className="font-medium text-gov-grey-900">Evidence & Attachments</h2>
        <span className="ml-auto text-xs text-gov-grey-400">
          {items.length} {items.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragOver
              ? 'border-gov-blue-400 bg-gov-blue-50/50'
              : 'border-gov-grey-200 hover:border-gov-grey-300'
          }`}
          role="region"
          aria-label="File upload area"
        >
          {isUploading ? (
            <div className="space-y-2">
              <Loader2 className="h-6 w-6 text-gov-blue-500 mx-auto animate-spin" aria-hidden="true" />
              <p className="text-sm text-gov-grey-600">Uploading... {uploadProgress}%</p>
              <div className="mx-auto max-w-xs h-2 rounded-full bg-gov-grey-200">
                <div
                  className="h-2 rounded-full bg-gov-blue-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                />
              </div>
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 text-gov-grey-400 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm text-gov-grey-600">
                Drag and drop files here, or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gov-blue-500 hover:text-gov-blue-700 font-medium underline"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-xs text-gov-grey-400">
                PDF, DOC, XLS, JPG, PNG, TIF up to 50MB. Max 5 files per upload.
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS}
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Select files to upload"
          />
        </div>

        {/* Upload Error */}
        {uploadError && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{uploadError}</p>
              <button
                onClick={() => setUploadError(null)}
                className="mt-1 text-xs text-red-600 underline hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-4 text-center text-sm text-gov-grey-400" aria-busy="true">
            Loading attachments...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div role="alert" className="text-center text-sm text-red-600 py-4">
            {error}
          </div>
        )}

        {/* File List */}
        {!isLoading && items.length > 0 && (
          <ul className="divide-y divide-gov-grey-100" aria-label="Uploaded files">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gov-grey-100 text-xs font-bold text-gov-grey-500" aria-hidden="true">
                  {fileIcon(item.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gov-grey-900 truncate">
                    {item.filename}
                  </p>
                  <p className="text-xs text-gov-grey-400">
                    {formatFileSize(item.size)} &middot; {new Date(item.uploadedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={`/api/v1/evidence/${complaintId}/${item.id}`}
                    className="p-1.5 rounded hover:bg-gov-grey-100 text-gov-grey-500 hover:text-gov-grey-700 transition-colors"
                    aria-label={`Download ${item.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </a>

                  {deleteConfirmId === item.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        aria-label={`Confirm delete ${item.filename}`}
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-1 rounded hover:bg-gov-grey-100 text-gov-grey-400"
                        aria-label="Cancel delete"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gov-grey-400 hover:text-red-500 transition-colors"
                      aria-label={`Delete ${item.filename}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Empty State */}
        {!isLoading && !error && items.length === 0 && (
          <p className="text-center text-sm text-gov-grey-400 py-2">
            No attachments yet.
          </p>
        )}
      </div>
    </div>
  );
}
