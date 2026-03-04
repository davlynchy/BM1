import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCanonicalStoragePath,
  getBucketForDocumentType,
} from "@/lib/documents/storage";
import {
  AUTHENTICATED_FILE_SIZE_LIMIT,
  MULTIPART_PART_SIZE,
} from "@/lib/documents/upload-policy";
import {
  completeMultipartUpload,
  createMultipartPartUrls,
  createMultipartUpload,
  headR2Object,
} from "@/lib/storage/r2";
import type {
  IntakeCompletedPart,
  IntakeSession,
  IntakeUploadDescriptor,
  IntakeUploadState,
} from "@/types/intake";

type IntakeUploadMetadata = {
  clientKey?: string;
  uploadId?: string;
  partSize?: number;
  uploadState?: IntakeUploadState;
  uploadStartedAt?: string;
  uploadCompletedAt?: string;
};

function getUploadMetadata(session: IntakeSession): IntakeUploadMetadata {
  const metadata = session.metadata;

  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  return {
    clientKey: typeof metadata.clientKey === "string" ? metadata.clientKey : undefined,
    uploadId: typeof metadata.uploadId === "string" ? metadata.uploadId : undefined,
    partSize:
      typeof metadata.partSize === "number" && metadata.partSize > 0
        ? metadata.partSize
        : undefined,
    uploadState:
      metadata.uploadState === "created" ||
      metadata.uploadState === "uploading" ||
      metadata.uploadState === "uploaded" ||
      metadata.uploadState === "failed"
        ? metadata.uploadState
        : undefined,
    uploadStartedAt:
      typeof metadata.uploadStartedAt === "string" ? metadata.uploadStartedAt : undefined,
    uploadCompletedAt:
      typeof metadata.uploadCompletedAt === "string" ? metadata.uploadCompletedAt : undefined,
  };
}

async function updateSessionMetadata(sessionId: string, metadata: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("intake_sessions")
    .update({ metadata })
    .eq("id", sessionId);

  if (error) {
    throw error;
  }
}

async function resolveProjectId(params: {
  session: IntakeSession;
  userId: string;
  companyId: string;
}) {
  const supabase = createAdminClient();
  const projectId = params.session.project_id;

  if (params.session.project_selection_mode === "existing") {
    if (!projectId) {
      throw new Error("Choose an existing project.");
    }

    const { data: project, error } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("company_id", params.companyId)
      .maybeSingle();

    if (error || !project) {
      throw error ?? new Error("Choose a valid project.");
    }

    return project.id;
  }

  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("company_id", params.companyId)
      .maybeSingle();

    if (project) {
      return project.id;
    }
  }

  const projectName = String(params.session.new_project_name ?? "").trim();
  if (!projectName) {
    throw new Error("Enter a project name to continue.");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      company_id: params.companyId,
      name: projectName,
      status: "pre-construction",
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    throw projectError ?? new Error("Unable to create project.");
  }

  const { error: updateError } = await supabase
    .from("intake_sessions")
    .update({ project_id: project.id })
    .eq("id", params.session.id);

  if (updateError) {
    throw updateError;
  }

  return project.id;
}

async function ensureDocumentForUpload(params: {
  session: IntakeSession;
  userId: string;
  companyId: string;
  projectId: string;
}) {
  const supabase = createAdminClient();
  const bucket = getBucketForDocumentType("contract", "r2");
  let documentId = params.session.document_id;
  let storagePath: string | null = null;

  if (documentId) {
    const { data: document, error } = await supabase
      .from("documents")
      .select("id, storage_provider, storage_bucket, storage_path")
      .eq("id", documentId)
      .eq("project_id", params.projectId)
      .eq("company_id", params.companyId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (document) {
      storagePath = document.storage_path || null;
    } else {
      documentId = null;
    }
  }

  if (!documentId) {
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        company_id: params.companyId,
        project_id: params.projectId,
        name: params.session.file_name,
        source_filename: params.session.file_name,
        document_type: "contract",
        storage_provider: "r2",
        storage_bucket: bucket,
        storage_path: "",
        mime_type: params.session.mime_type,
        file_size: params.session.file_size,
        parse_status: "uploaded",
        uploaded_by: params.userId,
        upload_state: "created",
      })
      .select("id")
      .single();

    if (documentError || !document) {
      throw documentError ?? new Error("Unable to register document.");
    }

    documentId = document.id;
  }

  if (!documentId) {
    throw new Error("Unable to register document.");
  }

  const resolvedDocumentId = documentId;

  if (!storagePath) {
    storagePath = buildCanonicalStoragePath({
      companyId: params.companyId,
      projectId: params.projectId,
      documentId: resolvedDocumentId,
      documentType: "contract",
      fileName: params.session.file_name,
    });

    const { error: documentUpdateError } = await supabase
      .from("documents")
      .update({
        storage_provider: "r2",
        storage_bucket: bucket,
        storage_path: storagePath,
      })
      .eq("id", resolvedDocumentId);

    if (documentUpdateError) {
      throw documentUpdateError;
    }
  }

  if (!storagePath) {
    throw new Error("Unable to determine contract storage path.");
  }

  const resolvedStoragePath = storagePath;

  const { error: sessionUpdateError } = await supabase
    .from("intake_sessions")
    .update({
      project_id: params.projectId,
      document_id: resolvedDocumentId,
    })
    .eq("id", params.session.id);

  if (sessionUpdateError) {
    throw sessionUpdateError;
  }

  return {
    bucket,
    documentId: resolvedDocumentId,
    storagePath: resolvedStoragePath,
  };
}

export async function createIntakeUploadDescriptor(params: {
  session: IntakeSession;
  userId: string;
  companyId: string;
  clientKey: string;
}) {
  if (params.session.file_size > AUTHENTICATED_FILE_SIZE_LIMIT) {
    throw new Error("This contract exceeds the 2GB size limit.");
  }

  const projectId = await resolveProjectId({
    session: params.session,
    userId: params.userId,
    companyId: params.companyId,
  });
  const document = await ensureDocumentForUpload({
    session: params.session,
    userId: params.userId,
    companyId: params.companyId,
    projectId,
  });
  const uploadMetadata = getUploadMetadata(params.session);
  const upload =
    uploadMetadata.uploadId && uploadMetadata.uploadState !== "uploaded"
      ? {
          bucket: document.bucket,
          uploadId: uploadMetadata.uploadId,
        }
      : await createMultipartUpload({
          key: document.storagePath,
          contentType: params.session.mime_type,
          metadata: {
            documentId: document.documentId,
            companyId: params.companyId,
            projectId,
          },
        });

  await updateSessionMetadata(params.session.id, {
    ...(params.session.metadata ?? {}),
    clientKey: params.clientKey,
    partSize: MULTIPART_PART_SIZE,
    requiresReattach: false,
    uploadId: upload.uploadId,
    uploadState: "uploading",
    uploadStartedAt: uploadMetadata.uploadStartedAt ?? new Date().toISOString(),
  });

  return {
    clientKey: params.clientKey,
    documentId: document.documentId,
    uploadId: upload.uploadId,
    bucket: upload.bucket,
    storagePath: document.storagePath,
    mimeType: params.session.mime_type,
    relativePath: null,
    partSize: MULTIPART_PART_SIZE,
    partCount: Math.max(1, Math.ceil(params.session.file_size / MULTIPART_PART_SIZE)),
  } satisfies IntakeUploadDescriptor;
}

export async function createIntakePartUrls(params: {
  session: IntakeSession;
  documentId: string;
  uploadId: string;
  partNumbers: number[];
}) {
  if (params.session.document_id !== params.documentId) {
    throw new Error("Upload session is out of date. Refresh and try again.");
  }

  const uploadMetadata = getUploadMetadata(params.session);
  if (!uploadMetadata.uploadId || uploadMetadata.uploadId !== params.uploadId) {
    throw new Error("Upload session is out of date. Refresh and try again.");
  }

  const supabase = createAdminClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, storage_provider, storage_path")
    .eq("id", params.documentId)
    .maybeSingle();

  if (error || !document) {
    throw error ?? new Error("Document not found.");
  }

  if (document.storage_provider !== "r2" || !document.storage_path) {
    throw new Error("Document is not configured for R2 upload.");
  }

  return createMultipartPartUrls({
    key: document.storage_path,
    uploadId: params.uploadId,
    partNumbers: params.partNumbers,
  });
}

export async function completeIntakeUpload(params: {
  session: IntakeSession;
  documentId: string;
  uploadId: string;
  parts: IntakeCompletedPart[];
}) {
  if (params.session.document_id !== params.documentId) {
    throw new Error("Upload session is out of date. Refresh and try again.");
  }

  const uploadMetadata = getUploadMetadata(params.session);
  if (!uploadMetadata.uploadId || uploadMetadata.uploadId !== params.uploadId) {
    throw new Error("Upload session is out of date. Refresh and try again.");
  }

  const supabase = createAdminClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, project_id, storage_provider, storage_bucket, storage_path, file_size, name")
    .eq("id", params.documentId)
    .maybeSingle();

  if (error || !document) {
    throw error ?? new Error("Uploaded document not found.");
  }

  if (document.storage_provider !== "r2" || !document.storage_path) {
    throw new Error("Document is not configured for R2 completion.");
  }

  const completeResult = await completeMultipartUpload({
    key: document.storage_path,
    uploadId: params.uploadId,
    parts: params.parts,
  });
  const head = await headR2Object(document.storage_path);

  if (document.file_size && head.contentLength && Number(document.file_size) !== head.contentLength) {
    throw new Error(`Uploaded file size mismatch for ${document.name}.`);
  }

  const uploadedAt = new Date().toISOString();
  const { error: documentUpdateError } = await supabase
    .from("documents")
    .update({
      parse_status: "uploaded",
      upload_state: "uploaded",
      upload_completed_at: uploadedAt,
      storage_etag: completeResult.etag ?? head.etag,
      storage_version: completeResult.version ?? head.version,
    })
    .eq("id", document.id);

  if (documentUpdateError) {
    throw documentUpdateError;
  }

  const { error: sessionUpdateError } = await supabase
    .from("intake_sessions")
    .update({
      project_id: document.project_id,
      document_id: document.id,
      storage_provider: "r2",
      storage_bucket: document.storage_bucket,
      storage_path: document.storage_path,
      metadata: {
        ...(params.session.metadata ?? {}),
        requiresReattach: false,
        uploadId: params.uploadId,
        partSize: uploadMetadata.partSize ?? MULTIPART_PART_SIZE,
        uploadState: "uploaded",
        uploadStartedAt: uploadMetadata.uploadStartedAt ?? uploadedAt,
        uploadCompletedAt: uploadedAt,
      },
    })
    .eq("id", params.session.id);

  if (sessionUpdateError) {
    throw sessionUpdateError;
  }

  return {
    documentId: document.id,
  };
}
