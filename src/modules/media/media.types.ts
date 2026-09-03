/**
 * INDOBID — MEDIA MODULE TYPES
 */

export interface UploadAvatarDTO {
  userId: string;
  buffer: Buffer;
  mimeType: string;
}

export interface UploadAvatarResult {
  url: string;
  sizeBytes: number;
}
