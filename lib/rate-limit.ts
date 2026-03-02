import { createAdminClient } from "@/lib/supabase/admin";
import { recordUsageEvent } from "@/lib/usage/track";

export async function enforceRateLimit(params: {
  scope: string;
  key: string;
  limit: number;
  windowMinutes: number;
  companyId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const eventType = `rate_limit:${params.scope}:${params.key}`;
  const threshold = new Date(Date.now() - params.windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { head: true, count: "exact" })
    .eq("event_type", eventType)
    .gte("created_at", threshold);

  if (error) {
    throw error;
  }

  if ((count ?? 0) >= params.limit) {
    throw new Error(`Rate limit exceeded for ${params.scope}. Please wait and retry.`);
  }

  await recordUsageEvent({
    companyId: params.companyId,
    userId: params.userId,
    eventType,
    metadata: params.metadata,
  });
}
