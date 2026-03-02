import { createAdminClient } from "@/lib/supabase/admin";
import { syncScanTodos } from "@/lib/todos/sync";
import { buildContractScanContext } from "@/lib/scans/context";
import { extractContractScan } from "@/lib/scans/extract";
import { replaceContractScanOutputs, updateContractScanStatus } from "@/lib/scans/persist";
import type { DocumentJobPayload } from "@/types/ingestion";

export async function handleScanExtractJob(payload: DocumentJobPayload) {
  const supabase = createAdminClient();
  const { data: scan, error: scanError } = await supabase
    .from("contract_scans")
    .select("id, company_id, project_id")
    .eq("contract_document_id", payload.documentId)
    .maybeSingle();

  if (scanError) {
    throw scanError;
  }

  if (!scan) {
    return;
  }

  await updateContractScanStatus({
    scanId: scan.id,
    status: "in_progress",
    processingError: null,
  });

  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, content, metadata")
    .eq("document_id", payload.documentId)
    .order("chunk_index", { ascending: true });

  if (chunksError) {
    throw chunksError;
  }

  if (!chunks?.length) {
    throw new Error("No indexed contract chunks found for scan extraction.");
  }

  const context = buildContractScanContext(
    chunks.map((chunk) => ({
      id: String(chunk.id),
      chunk_index: Number(chunk.chunk_index),
      content: String(chunk.content),
      metadata: (chunk.metadata ?? {}) as Record<string, unknown>,
    })),
  );

  const { extraction, promptVersion } = await extractContractScan(context);

  await replaceContractScanOutputs({
    scanId: scan.id,
    companyId: scan.company_id,
    extraction,
  });

  await syncScanTodos({
    companyId: String(scan.company_id),
    projectId: scan.project_id ? String(scan.project_id) : null,
    scanId: String(scan.id),
    extraction,
  });

  await updateContractScanStatus({
    scanId: scan.id,
    status: "completed",
    summary: extraction.summary,
    processingError: null,
    promptVersion,
  });
}
