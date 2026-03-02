import path from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKETS = {
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
    name: BUCKETS.contract,
    fileSizeLimit: "200MiB",
  },
  {
    name: BUCKETS.project_document,
    fileSizeLimit: "200MiB",
  },
  {
    name: BUCKETS.email,
    fileSizeLimit: "50MiB",
  },
  {
    name: BUCKETS.generated,
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

export function getBucketForDocumentType(documentType: string) {
  if (documentType === "contract") {
    return BUCKETS.contract;
  }

  if (documentType === "email") {
    return BUCKETS.email;
  }

  return BUCKETS.project_document;
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
  sourceBucket: string;
  sourcePath: string;
  destinationBucket: string;
  destinationPath: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(params.sourceBucket)
    .download(params.sourcePath);

  if (error || !data) {
    throw error ?? new Error("Unable to download source file.");
  }

  const uploadBuffer = Buffer.from(await data.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(params.destinationBucket)
    .upload(params.destinationPath, uploadBuffer, {
      upsert: true,
      contentType: data.type || undefined,
    });

  if (uploadError) {
    throw uploadError;
  }

  if (
    params.sourceBucket !== params.destinationBucket ||
    params.sourcePath !== params.destinationPath
  ) {
    const { error: removeError } = await supabase.storage
      .from(params.sourceBucket)
      .remove([params.sourcePath]);

    if (removeError) {
      throw removeError;
    }
  }
}

export async function uploadProjectFile(params: {
  bucket: string;
  storagePath: string;
  file: File;
}) {
  const supabase = createAdminClient();
  const fileBuffer = Buffer.from(await params.file.arrayBuffer());
  const { error } = await supabase.storage
    .from(params.bucket)
    .upload(params.storagePath, fileBuffer, {
      upsert: false,
      contentType: params.file.type,
    });

  if (error) {
    throw error;
  }
}

export async function downloadStoredFile(params: { bucket: string; storagePath: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(params.bucket)
    .download(params.storagePath);

  if (error || !data) {
    throw error ?? new Error("Unable to download file.");
  }

  return data;
}
