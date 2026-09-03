/**
 * INDOBID — LOCAL DISK STORAGE ADAPTER
 * Implements IStorageProvider for local file storage and development environments.
 */

import fs from 'fs';
import path from 'path';
import { IStorageProvider, StorageUploadParams, StorageUploadResult } from './storage.interface';
import { isValidImageMagicBytes } from './magic-bytes';

export class LocalStorageAdapter implements IStorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'public', 'uploads');
  }

  validate(buffer: Buffer): boolean {
    return isValidImageMagicBytes(buffer);
  }

  async upload(params: StorageUploadParams): Promise<StorageUploadResult> {
    if (!this.validate(params.buffer)) {
      throw new Error('Invalid file type detected by magic bytes');
    }

    const folder = params.folder || 'avatars';
    const uploadPath = path.join(this.baseDir, folder);
    await fs.promises.mkdir(uploadPath, { recursive: true });

    const ext = params.mimeType.split('/')[1] || 'png';
    const filename = `${params.userId}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadPath, filename);

    await fs.promises.writeFile(filePath, params.buffer);

    return {
      url: `/uploads/${folder}/${filename}`,
      sizeBytes: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  async delete(url: string, userId: string): Promise<boolean> {
    try {
      const relative = url.replace(/^\/uploads\//, '');
      const fullPath = path.join(this.baseDir, relative);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const localStorageAdapter = new LocalStorageAdapter();
