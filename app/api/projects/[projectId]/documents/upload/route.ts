import { NextResponse } from "next/server";

import { upsertProjectCorrespondenceFromEmail } from "@/lib/correspondence/store";
import { parseDocumentByMimeType } from "@/lib/documents/parsers";
import { buildCanonicalStoragePath, getBucketForDocumentType, uploadProjectFile } from "@/lib/documents/storage";
import { ALLOWED_DOCUMENT_TYPE_SET } from "@/lib/documents/upload-policy";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { getRequestIp } from "@/lib/api/request";
import { requireProjectAccess } from "@/lib/projects/access";
import { enforceRateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 200 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { supabase, user, project } = await requireProjectAccess(projectId);
    await enforceRateLimit({
      scope: "project_upload",
      key: String(user.id),
      limit: 25,
      windowMinutes: 30,
      companyId: String(project.company_id),
      userId: String(user.id),
      metadata: {
        ip: getRequestIp(request),
        projectId,
      },
    });
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    const requestedType = String(formData.get("documentType") ?? "").trim();

    if (!files.length) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }

    const uploadedDocuments = [];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const inferredMimeType = lowerName.endsWith(".eml")
        ? "message/rfc822"
        : (file.type || "");

      if (!ALLOWED_DOCUMENT_TYPE_SET.has(inferredMimeType as never)) {
        return NextResponse.json({ error: `Unsupported file type for ${file.name}.` }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `${file.name} exceeds the 200MB size limit.` }, { status: 400 });
      }

      const documentType = requestedType || (inferredMimeType === "message/rfc822" ? "email" : "project_document");
      const bucket = getBucketForDocumentType(documentType, "r2");
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .insert({
          company_id: project.company_id,
          project_id: project.id,
          name: file.name,
          source_filename: file.name,
          document_type: documentType,
          storage_provider: "r2",
          storage_bucket: bucket,
          storage_path: "",
          mime_type: inferredMimeType,
          file_size: file.size,
          parse_status: "uploaded",
          uploaded_by: user.id,
          upload_state: "uploaded",
          upload_completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (documentError || !document) {
        throw documentError ?? new Error("Unable to create document record.");
      }

      const storagePath = buildCanonicalStoragePath({
        companyId: project.company_id,
        projectId: project.id,
        documentId: document.id,
        documentType,
        fileName: file.name,
      });

      await uploadProjectFile({
        provider: "r2",
        bucket,
        storagePath,
        file,
      });

      const { error: updateError } = await supabase
        .from("documents")
        .update({
          storage_path: storagePath,
          parse_status: "queued",
        })
        .eq("id", document.id);

      if (updateError) {
        throw updateError;
      }

      await enqueueDocumentJob({
        companyId: project.company_id,
        projectId: project.id,
        documentId: document.id,
        jobType: "document.parse",
        jobKey: `${document.id}:document.parse`,
        payload: {
          documentId: document.id,
          companyId: project.company_id,
          projectId: project.id,
          bucket,
          storagePath,
          storageProvider: "r2",
          mimeType: inferredMimeType,
          documentType,
          fileName: file.name,
        },
      });

      if (documentType === "email") {
        try {
          const parsed = await parseDocumentByMimeType({
            mimeType: inferredMimeType,
            buffer: Buffer.from(await file.arrayBuffer()),
          });
          const emailMetadata =
            parsed.metadata && typeof parsed.metadata.correspondence === "object"
              ? (parsed.metadata.correspondence as Record<string, unknown>)
              : null;

          if (emailMetadata) {
            await upsertProjectCorrespondenceFromEmail({
              companyId: String(project.company_id),
              projectId: String(project.id),
              documentId: String(document.id),
              metadata: {
                subject: typeof emailMetadata.subject === "string" ? emailMetadata.subject : "",
                sender: typeof emailMetadata.sender === "string" ? emailMetadata.sender : "",
                to: typeof emailMetadata.to === "string" ? emailMetadata.to : "",
                cc: typeof emailMetadata.cc === "string" ? emailMetadata.cc : "",
                receivedAt: typeof emailMetadata.receivedAt === "string" ? emailMetadata.receivedAt : undefined,
                bodyText: typeof emailMetadata.bodyText === "string" ? emailMetadata.bodyText : "",
                attachments: Array.isArray(emailMetadata.attachments)
                  ? (emailMetadata.attachments as Array<Record<string, unknown>>)
                  : [],
              },
            });
          }
        } catch {
          // keep upload successful even if extraction preview fails; background jobs will retry parsing/analyze
        }
      }

      uploadedDocuments.push({
        id: document.id,
        name: file.name,
        documentType,
        parseStatus: "queued",
      });
    }

    return NextResponse.json({ documents: uploadedDocuments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload documents.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
