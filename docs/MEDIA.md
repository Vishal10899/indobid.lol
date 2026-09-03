# INDOBID — MEDIA & STORAGE SPECIFICATION

---

## 1. Storage Abstraction Layer
* **Interface**: [`src/infrastructure/storage/storage.interface.ts`](file:///D:/indobid.lol/src/infrastructure/storage/storage.interface.ts) (`IStorageProvider`)
* **Active Implementation**: [`src/infrastructure/storage/database.storage.ts`](file:///D:/indobid.lol/src/infrastructure/storage/database.storage.ts) (`DatabaseStorageProvider`)
* **Portability**: Code calls `IStorageProvider.upload()`, allowing seamless migration to AWS S3 or Cloudflare R2 without business logic changes.

---

## 2. Magic Byte Image Validation
* **Module**: [`src/infrastructure/storage/magic-bytes.ts`](file:///D:/indobid.lol/src/infrastructure/storage/magic-bytes.ts)
* **Rule**: Inspects the first 12 binary header bytes to verify true file formats (JPEG, PNG, GIF, WebP). Renamed `.exe` or `.sh` files are rejected before processing.
* **Max Avatar Size**: 2MB
