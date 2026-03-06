import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function ProjectEntryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const [{ count: indexedDocs }, { count: emailCount }] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("parse_status", "indexed"),
    supabase
      .from("project_correspondence")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  if ((indexedDocs ?? 0) > 0 || (emailCount ?? 0) > 0) {
    redirect(`/app/projects/${projectId}/assistant`);
  }

  redirect(`/app/projects/${projectId}/vault`);
}
