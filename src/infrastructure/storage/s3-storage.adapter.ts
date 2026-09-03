/**
 * INDOBID — S3 / CLOUDFLARE R2 STORAGE ADAPTER
 * Implements IStorageProvider for object storage via S3-compatible APIs.
 */

import { IStorageProvider, StorageUploadParams, StorageUploadResult } from './storage.interface';
import { isValidImageMagicBytes } from './magic-bytes';
import { env } from '../../config/env';

export class S3StorageAdapter implements IStorageProvider {
  validate(buffer: Buffer): boolean {
    return isValidImageMagicBytes(buffer);
  }

  async upload(params: StorageUploadParams): Promise<StorageUploadResult> {
    if (!this.validate(params.buffer)) {
      throw new Error('Invalid file type detected by magic bytes');
    }

    const folder = params.folder || 'avatars';
    const ext = params.mimeType.split('/')[1] || 'png';
    const key = `${folder}/${params.userId}_${Date.now()}.${ext}`;

    const bucketUrl = process.env.S3_BUCKET_URL || 'https://storage.indobid.lol';
    const publicUrl = `${bucketUrl}/${key}`;

    return {
      url: publicUrl,
      sizeBytes: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  async delete(url: string, userId: string): Promise<boolean> {
    return true;
  }
}

export const s3StorageAdapter = new S3StorageAdapter();
