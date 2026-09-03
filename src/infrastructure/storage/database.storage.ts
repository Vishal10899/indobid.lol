/**
 * INDOBID — DATABASE-BACKED STORAGE PROVIDER
 * Stores Base64 Data URIs in PostgreSQL with magic byte verification.
 */

import { IStorageProvider, StorageUploadParams, StorageUploadResult } from './storage.interface';
import { validateImageMagicBytes } from './magic-bytes';
import { prisma } from '../database/prisma';
import { ValidationError } from '../../lib/errors';

export class DatabaseStorageProvider implements IStorageProvider {
  validate(buffer: Buffer): boolean {
    return validateImageMagicBytes(buffer);
  }

  async upload(params: StorageUploadParams): Promise<StorageUploadResult> {
    const { userId, buffer, mimeType } = params;

    if (!this.validate(buffer)) {
      throw new ValidationError('Invalid image format. Supported formats: JPEG, PNG, GIF, WebP');
    }

    const base64Data = buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: dataUri },
    });

    return {
      url: dataUri,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  async delete(url: string, userId: string): Promise<boolean> {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
    return true;
  }
}

export const databaseStorageProvider = new DatabaseStorageProvider();
