import { createClient } from "@/lib/supabase/server";

export async function requireProjectAccess(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, company_id, name")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    throw new Error("Project not found.");
  }

  return {
    supabase,
    user,
    project,
  };
}
