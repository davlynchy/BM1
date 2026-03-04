import { createClient } from "@/lib/supabase/server";

export async function getRecentProjectForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("projects")
    .select("id, name, company_id, created_at")
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
