import path from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Bucket, putR2Object, downloadR2Object } from "@/lib/storage/r2";
import type { DocumentStorageProvider } from "@/types/uploads";

const SUPABASE_BUCKETS = {
  contract: "contracts",
  project_document: "project-documents",
  email: "emails",
  generated: "generated-artifacts",
} as const;

const BUCKET_CONFIG: Array<{
  name: string;
  fileSizeLimit: number | string;
  allowedMimeTypes?: string[];
}> = [
  {
    name: SUPABASE_BUCKETS.contract,
    fileSizeLimit: "200MiB",
  },
  {
    name: SUPABASE_BUCKETS.project_document,
    fileSizeLimit: "200MiB",
  },
  {
    name: SUPABASE_BUCKETS.email,
    fileSizeLimit: "50MiB",
  },
  {
    name: SUPABASE_BUCKETS.generated,
    fileSizeLimit: "100MiB",
  },
];

export function sanitizeFilename(fileName: string) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  const sanitizedBase = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";
  const sanitizedExt = ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);

  return `${sanitizedBase}${sanitizedExt}`;
}

export function getBucketForDocumentType(
  documentType: string,
  provider: DocumentStorageProvider = "r2",
) {
  if (provider === "r2") {
    return getR2Bucket();
  }

  if (documentType === "contract") {
    return SUPABASE_BUCKETS.contract;
  }

  if (documentType === "email") {
    return SUPABASE_BUCKETS.email;
  }

  return SUPABASE_BUCKETS.project_document;
}

export function buildCanonicalStoragePath(params: {
  companyId: string;
  projectId: string;
  documentId: string;
  documentType: string;
  fileName: string;
}) {
  const safeName = sanitizeFilename(params.fileName);

  if (params.documentType === "contract") {
    return `company/${params.companyId}/project/${params.projectId}/contract/${params.documentId}/original/${safeName}`;
  }

  if (params.documentType === "email") {
    return `company/${params.companyId}/project/${params.projectId}/email/${params.documentId}/original/${safeName}`;
  }

  return `company/${params.companyId}/project/${params.projectId}/document/${params.documentId}/original/${safeName}`;
}

export function buildGeneratedArtifactPath(params: {
  companyId: string;
  projectId: string;
  documentId: string;
  fileName: string;
}) {
  return `company/${params.companyId}/project/${params.projectId}/document/${params.documentId}/artifacts/${sanitizeFilename(params.fileName)}`;
}

export async function ensurePrivateBuckets() {
  const supabase = createAdminClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    throw error;
  }

  for (const config of BUCKET_CONFIG) {
    const exists = buckets.some((bucket) => bucket.name === config.name);

    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(config.name, {
        public: false,
        fileSizeLimit: config.fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes,
      });

      if (createError) {
        throw createError;
      }
    }
  }
}

export async function moveStoredFile(params: {
  sourceProvider?: DocumentStorageProvider;
  sourceBucket: string;
  sourcePath: string;
  destinationProvider?: DocumentStorageProvider;
  destinationBucket: string;
  destinationPath: string;
}) {
  const sourceProvider = params.sourceProvider ?? "supabase";
  const destinationProvider = params.destinationProvider ?? "r2";
  const data = await downloadStoredFile({
    provider: sourceProvider,
    bucket: params.sourceBucket,
    storagePath: params.sourcePath,
  });
  const uploadBuffer = Buffer.from(await data.arrayBuffer());

  if (destinationProvider === "r2") {
    await putR2Object({
      key: params.destinationPath,
      body: uploadBuffer,
      contentType: data.type || undefined,
    });
  } else {
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from(params.destinationBucket)
      .upload(params.destinationPath, uploadBuffer, {
        upsert: true,
        contentType: data.type || undefined,
      });

    if (uploadError) {
      throw uploadError;
    }
  }

  if (
    sourceProvider !== destinationProvider ||
    params.sourceBucket !== params.destinationBucket ||
    params.sourcePath !== params.destinationPath
  ) {
    if (sourceProvider === "supabase") {
      const supabase = createAdminClient();
      const { error: removeError } = await supabase.storage
        .from(params.sourceBucket)
        .remove([params.sourcePath]);

      if (removeError) {
        throw removeError;
      }
    }
  }
}

export async function uploadProjectFile(params: {
  provider?: DocumentStorageProvider;
  bucket: string;
  storagePath: string;
  file: File;
}) {
  const fileBuffer = Buffer.from(await params.file.arrayBuffer());
  const provider = params.provider ?? "supabase";

  if (provider === "r2") {
    await putR2Object({
      key: params.storagePath,
      body: fileBuffer,
      contentType: params.file.type,
    });
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(params.bucket).upload(params.storagePath, fileBuffer, {
    upsert: false,
    contentType: params.file.type,
  });

  if (error) {
    throw error;
  }
}

export async function downloadStoredFile(params: {
  provider?: DocumentStorageProvider;
  bucket: string;
  storagePath: string;
}) {
  if ((params.provider ?? "supabase") === "r2") {
    return downloadR2Object(params.storagePath);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(params.bucket)
    .download(params.storagePath);

  if (error || !data) {
    throw error ?? new Error("Unable to download file.");
  }

  return data;
}
