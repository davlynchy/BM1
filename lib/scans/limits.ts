import { createAdminClient } from "@/lib/supabase/admin";
import { hasPaidSubscription } from "@/lib/billing/entitlements";
import { recordUsageEvent } from "@/lib/usage/track";

const FREE_SCAN_LIMITS = {
  daily: 3,
  monthly: 10,
  active: 1,
} as const;

const PAID_SCAN_LIMITS = {
  daily: 100,
  monthly: 1000,
  active: 10,
} as const;

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function countUsageEvents(params: {
  companyId: string;
  eventType: string;
  from: string;
}) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { head: true, count: "exact" })
    .eq("company_id", params.companyId)
    .eq("event_type", params.eventType)
    .gte("created_at", params.from);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function countActiveScans(companyId: string) {
  const supabase = createAdminClient();
  const threshold = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("contract_scans")
    .select("id", { head: true, count: "exact" })
    .eq("company_id", companyId)
    .in("status", ["queued", "in_progress"])
    .gte("updated_at", threshold);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function enforceContractScanQuota(params: {
  companyId: string;
  userId: string | null;
  reason: "finalize" | "retry";
}) {
  const paid = await hasPaidSubscription(params.companyId);
  const limits = paid ? PAID_SCAN_LIMITS : FREE_SCAN_LIMITS;
  const now = new Date();
  const dailyThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const monthlyThreshold = getMonthStart(now).toISOString();

  const [dailyCount, monthlyCount, activeCount] = await Promise.all([
    countUsageEvents({
      companyId: params.companyId,
      eventType: "contract_scan.started",
      from: dailyThreshold,
    }),
    countUsageEvents({
      companyId: params.companyId,
      eventType: "contract_scan.started",
      from: monthlyThreshold,
    }),
    countActiveScans(params.companyId),
  ]);

  if (dailyCount >= limits.daily) {
    throw new Error("Daily contract scan limit reached for this workspace.");
  }

  if (monthlyCount >= limits.monthly) {
    throw new Error("Monthly contract scan limit reached for this workspace.");
  }

  if (activeCount >= limits.active) {
    throw new Error("Too many contract scans are already processing. Please wait for one to finish.");
  }

  await recordUsageEvent({
    companyId: params.companyId,
    userId: params.userId,
    eventType: "contract_scan.started",
    metadata: {
      reason: params.reason,
      plan: paid ? "paid" : "free",
    },
  });
}
