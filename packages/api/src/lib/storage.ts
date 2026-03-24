import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = "documents";

function getClient(): S3Client {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("MinIO environment variables are not configured");
  }

  return new S3Client({
    endpoint,
    region: "us-east-1", // required by SDK, ignored by MinIO
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // required for MinIO
  });
}

/**
 * Upload a file buffer to MinIO.
 * Returns the storage key (object path).
 */
export async function uploadFile(
  key: string,
  body: Buffer,
  mimeType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType,
    })
  );
  return key;
}

/**
 * Delete a file from MinIO by its storage key.
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Generate a presigned GET URL valid for `expiresIn` seconds (default 1 hour).
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

