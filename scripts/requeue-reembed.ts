import { createAdminClient } from "@/lib/supabase/admin";
import { readFileSync, existsSync } from "node:fs";

type CandidateDocument = {
  id: string;
  company_id: string;
  project_id: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  document_type: string;
  name: string;
};

async function main() {
  if (existsSync(".env.local")) {
    const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith("#")) {
        continue;
      }
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1);
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  }

  const apply = process.argv.includes("--apply");
  const supabase = createAdminClient();

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, company_id, project_id, storage_bucket, storage_path, mime_type, document_type, name")
    .eq("parse_status", "indexed");

  if (documentsError) {
    throw documentsError;
  }

  if (!documents?.length) {
    console.log(JSON.stringify({ ok: true, reason: "no-indexed-documents" }));
    return;
  }

  const documentIds = documents.map((document) => String(document.id));
  const [{ data: chunks, error: chunksError }, { data: activeJobs, error: jobsError }] = await Promise.all([
    supabase
      .from("document_chunks")
      .select("document_id")
      .in("document_id", documentIds)
      .is("embedding", null),
    supabase
      .from("jobs")
      .select("document_id")
      .eq("job_type", "document.embed")
      .in("status", ["queued", "in_progress"])
      .in("document_id", documentIds),
  ]);

  if (chunksError) {
    throw chunksError;
  }

  if (jobsError) {
    throw jobsError;
  }

  const docsMissingEmbedding = new Set((chunks ?? []).map((row) => String(row.document_id)));
  const docsWithActiveEmbedJob = new Set((activeJobs ?? []).map((row) => String(row.document_id)));

  const candidates = (documents as CandidateDocument[]).filter(
    (document) => docsMissingEmbedding.has(String(document.id)) && !docsWithActiveEmbedJob.has(String(document.id)),
  );

  if (!apply) {
    console.log(
      JSON.stringify({
        ok: true,
        mode: "dry-run",
        indexedDocuments: documents.length,
        missingEmbeddingDocuments: docsMissingEmbedding.size,
        alreadyQueuedOrInProgress: docsWithActiveEmbedJob.size,
        toQueue: candidates.length,
      }),
    );
    return;
  }

  let queued = 0;
  let failed = 0;

  for (const document of candidates) {
    const { error } = await supabase.from("jobs").insert({
      company_id: document.company_id,
      project_id: document.project_id,
      document_id: document.id,
      job_type: "document.embed",
      status: "queued",
      job_key: `reembed:${document.id}:202603050003`,
      payload: {
        documentId: document.id,
        companyId: document.company_id,
        projectId: document.project_id,
        bucket: document.storage_bucket,
        storagePath: document.storage_path,
        storageProvider: "r2",
        mimeType: document.mime_type,
        documentType: document.document_type,
        fileName: document.name,
      },
    });

    if (error) {
      failed += 1;
    } else {
      queued += 1;
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      mode: "apply",
      queued,
      failed,
      attempted: candidates.length,
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  process.exit(1);
});
