import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getEnv } from "@/lib/env";

let cachedClient: S3Client | null = null;

function getR2Config() {
  const env = getEnv();

  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET
  ) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET are required.",
    );
  }

  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  };
}

function getR2Client() {
  if (!cachedClient) {
    const config = getR2Config();
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return cachedClient;
}

export function getR2Bucket() {
  return getR2Config().bucket;
}

export async function createMultipartUpload(params: {
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const response = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: params.key,
      ContentType: params.contentType,
      Metadata: params.metadata,
    }),
  );

  if (!response.UploadId) {
    throw new Error("Unable to create multipart upload.");
  }

  return {
    bucket,
    uploadId: response.UploadId,
  };
}

export async function createMultipartPartUrls(params: {
  key: string;
  uploadId: string;
  partNumbers: number[];
  expiresIn?: number;
}) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const expiresIn = params.expiresIn ?? 900;

  return Promise.all(
    params.partNumbers.map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket,
          Key: params.key,
          UploadId: params.uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn },
      ),
    })),
  );
}

export async function completeMultipartUpload(params: {
  key: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const response = await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: params.key,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: params.parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
      },
    }),
  );

  return {
    bucket,
    etag: response.ETag ?? null,
    version: response.VersionId ?? null,
  };
}

export async function headR2Object(key: string) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const response = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return {
    bucket,
    contentLength: response.ContentLength ?? null,
    etag: response.ETag ?? null,
    version: response.VersionId ?? null,
  };
}

export async function downloadR2Object(key: string) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("Unable to download R2 object.");
  }

  const bytes = await response.Body.transformToByteArray();
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Blob([arrayBuffer], {
    type: response.ContentType ?? "application/octet-stream",
  });
}

export async function putR2Object(params: {
  key: string;
  body: Buffer;
  contentType?: string | null;
}) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType ?? undefined,
    }),
  );

  return {
    bucket,
  };
}
