import { createAdminClient } from "@/lib/supabase/admin";

export async function failScanForDocument(documentId: string, message: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contract_scans")
    .update({
      status: "failed",
      processing_error: message,
    })
    .eq("contract_document_id", documentId);

  if (error) {
    throw error;
  }
}

export async function queueScanForDocument(documentId: string, message: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contract_scans")
    .update({
      status: "queued",
      processing_error: message,
    })
    .eq("contract_document_id", documentId);

  if (error) {
    throw error;
  }
}

export async function resetScanForDocument(documentId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contract_scans")
    .update({
      status: "queued",
      processing_error: null,
      completed_at: null,
    })
    .eq("contract_document_id", documentId);

  if (error) {
    throw error;
  }
}
