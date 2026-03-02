import { createAdminClient } from "@/lib/supabase/admin";

export async function recordUsageEvent(params: {
  companyId?: string | null;
  userId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("usage_events").insert({
    company_id: params.companyId ?? null,
    user_id: params.userId ?? null,
    event_type: params.eventType,
    metadata: params.metadata ?? {},
  });

  if (error) {
    throw error;
  }
}
