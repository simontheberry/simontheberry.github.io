// ============================================================================
// Storage Service -- File storage abstraction (local/S3)
// ============================================================================

import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('storage-service');

export interface StorageFile {
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

interface StoredFile {
  storageKey: string;
  url: string;
}

class StorageService {
  private provider: 'local' | 's3';

  constructor() {
    this.provider = (config.STORAGE_PROVIDER as 'local' | 's3') || 'local';
  }

  async upload(file: StorageFile, prefix: string): Promise<StoredFile> {
    if (this.provider === 's3') {
      return this.uploadS3(file, prefix);
    }
    return this.uploadLocal(file, prefix);
  }

  private async uploadLocal(file: StorageFile, prefix: string): Promise<StoredFile> {
    const uploadDir = path.join(process.cwd(), 'uploads', prefix);
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${file.filename}`;
    const filepath = path.join(uploadDir, filename);
    const storageKey = `${prefix}/${filename}`;

    await fs.writeFile(filepath, file.buffer);
    logger.info('File uploaded to local storage', { storageKey, size: file.size });

    return {
      storageKey,
      url: `/uploads/${storageKey}`,
    };
  }

  private async uploadS3(file: StorageFile, prefix: string): Promise<StoredFile> {
    // S3 implementation for Phase 5+
    // For now, fall back to local
    logger.warn('S3 storage not yet implemented, using local storage');
    return this.uploadLocal(file, prefix);
  }

  async delete(storageKey: string): Promise<void> {
    if (this.provider === 'local') {
      const filepath = path.join(process.cwd(), 'uploads', storageKey);
      try {
        await fs.unlink(filepath);
        logger.info('File deleted from local storage', { storageKey });
      } catch (err) {
        logger.warn('File not found during deletion', { storageKey });
      }
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    if (this.provider === 'local') {
      const filepath = path.join(process.cwd(), 'uploads', storageKey);
      return fs.readFile(filepath);
    }
    throw new Error('S3 read not implemented');
  }
}

let storageService: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new StorageService();
  }
  return storageService;
}
