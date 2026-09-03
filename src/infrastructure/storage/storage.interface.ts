/**
 * INDOBID — STORAGE PROVIDER INTERFACE
 * Abstraction enabling vendor-agnostic file & image storage (Database, S3, Cloudflare R2)
 */

export interface StorageUploadParams {
  userId: string;
  buffer: Buffer;
  mimeType: string;
  folder?: string;
}

export interface StorageUploadResult {
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface IStorageProvider {
  upload(params: StorageUploadParams): Promise<StorageUploadResult>;
  delete(url: string, userId: string): Promise<boolean>;
  validate(buffer: Buffer): boolean;
}
