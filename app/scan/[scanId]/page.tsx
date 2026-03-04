import { notFound, redirect } from "next/navigation";

import { getContractReviewThread } from "@/lib/scans/review-thread";
import { createClient } from "@/lib/supabase/server";

export default async function ScanRedirectPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?message=Login+to+open+the+review+workspace.");
  }

  const { data: scan } = await supabase
    .from("contract_scans")
    .select("id, project_id")
    .eq("id", scanId)
    .maybeSingle();

  if (!scan?.project_id) {
    notFound();
  }

  const thread = await getContractReviewThread(scanId);

  if (!thread?.id) {
    redirect(`/app/projects/${scan.project_id}/assistant`);
  }

  redirect(`/app/projects/${scan.project_id}/assistant?threadId=${thread.id}`);
}
