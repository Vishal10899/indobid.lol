# INDOBID — MEDIA & FILE STORAGE ARCHITECTURE

**Document Version:** 2.0.0  
**Status:** Authoritative Media Reference  
**Modules:** `src/modules/media/`, `src/infrastructure/storage/`  

---

## 1. Storage Philosophy & Strategy

IndoBid is designed to operate seamlessly across development, single-node hosting, and enterprise cloud infrastructure without coupling business logic to specific file storage providers.

All media uploads (creator profile avatars, debate attachments) pass through:
1. **Magic-Byte Inspection:** Enforces strict binary signature verification (rejection of polyglots, HTML payloads, or executable scripts disguised as images).
2. **Payload Size Capping:** Strict 2MB ceiling enforced before decoding.
3. **Storage Provider Interface (`IStorageProvider`):** Decouples media storage from external APIs.

---

## 2. Storage Provider Interface (`IStorageProvider`)

All storage adapters implement the canonical contract:

```typescript
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
```

---

## 3. Storage Adapters

### 3.1 `DatabaseStorageAdapter` (`database.storage.ts`)
* **Default Mode:** Encodes verified image buffers into optimized data URIs or base64 database representations.
* **Benefits:** Zero external cloud dependencies, instant portability, transactions guarantee image removal on account purge.

### 3.2 `LocalStorageAdapter` (`local-storage.adapter.ts`)
* **On-Premise / Persistent Disk Mode:** Writes uploads directly to `/public/uploads/avatars/` with unique non-colliding filenames (`{userId}_{timestamp}.{ext}`).
* **Static Serving:** Served directly via Next.js static asset routing.

### 3.3 `S3StorageAdapter` (`s3-storage.adapter.ts`)
* **Cloud Scale Mode:** Compatible with AWS S3, Cloudflare R2, MinIO, or Google Cloud Storage via standard S3 API signatures.
* **CDN Acceleration:** Supports public CDN fronting (Cloudflare / Fastly).

---

## 4. Magic-Byte Image Security Validation

To prevent malicious executable uploads (e.g. SVG XSS attacks, PHP shells disguised as `.jpg`), IndoBid analyzes the first 16 bytes of the binary buffer:

* **PNG:** `89 50 4E 47 0D 0A 1A 0A`
* **JPEG:** `FF D8 FF`
* **GIF:** `47 49 46 38 37 61` or `47 49 46 38 39 61`
* **WEBP:** `52 49 46 46` ... `57 45 42 50`

Files without matching binary headers are rejected with an HTTP 400 Validation Error before hitting any storage layer.
