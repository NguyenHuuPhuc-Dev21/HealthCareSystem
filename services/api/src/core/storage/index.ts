/**
 * Core Private Object Storage Service (BE-1)
 * S3/MinIO Private Buckets with 10-Minute Presigned URLs
 * SRS §6 NFR-SEC-01
 */

export interface PresignedUrlResult {
  url: string;
  expires_in_seconds: number;
}

export class StorageService {
  private static instance: StorageService;
  private readonly defaultExpirySeconds = 600; // 10 minutes (SRS NFR-SEC-01)

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async getPresignedDownloadUrl(objectKey: string, expirySeconds = this.defaultExpirySeconds): Promise<PresignedUrlResult> {
    // Presigned URL generation stub
    return {
      url: `https://storage.internal.healthcare.local/${objectKey}?signature=mock_hmac&expires=${Date.now() + expirySeconds * 1000}`,
      expires_in_seconds: expirySeconds,
    };
  }

  public async getPresignedUploadUrl(destinationKey: string, expirySeconds = this.defaultExpirySeconds): Promise<PresignedUrlResult> {
    return {
      url: `https://storage.internal.healthcare.local/upload/${destinationKey}?signature=mock_hmac&expires=${Date.now() + expirySeconds * 1000}`,
      expires_in_seconds: expirySeconds,
    };
  }
}

export const storage = StorageService.getInstance();

