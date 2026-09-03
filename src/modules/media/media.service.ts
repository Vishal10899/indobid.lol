/**
 * INDOBID — MEDIA SERVICE
 */

import { databaseStorageProvider } from '../../infrastructure/storage/database.storage';
import { appConfig } from '../../config/app';
import { ValidationError } from '../../lib/errors';
import { UploadAvatarDTO, UploadAvatarResult } from './media.types';

export class MediaService {
  async uploadAvatar(dto: UploadAvatarDTO): Promise<UploadAvatarResult> {
    if (dto.buffer.length > appConfig.media.MAX_AVATAR_SIZE_BYTES) {
      throw new ValidationError('Avatar image must not exceed 2MB');
    }

    if (!appConfig.media.ALLOWED_IMAGE_TYPES.includes(dto.mimeType as any)) {
      throw new ValidationError('Invalid image type. Supported: JPEG, PNG, GIF, WebP');
    }

    const result = await databaseStorageProvider.upload({
      userId: dto.userId,
      buffer: dto.buffer,
      mimeType: dto.mimeType,
      folder: 'avatars',
    });

    return {
      url: result.url,
      sizeBytes: result.sizeBytes,
    };
  }

  async removeAvatar(userId: string): Promise<boolean> {
    return databaseStorageProvider.delete('', userId);
  }
}

export const mediaService = new MediaService();
