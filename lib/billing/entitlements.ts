import { createClient } from "@/lib/supabase/server";
import { getCompanyBillingState } from "@/lib/billing/store";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function hasPaidSubscription(companyId: string) {
  const { subscription } = await getCompanyBillingState(companyId);
  return subscription ? ACTIVE_STATUSES.has(String(subscription.status)) : false;
}

export async function canAccessFullReport(companyId: string, isFreePreview: boolean) {
  if (!isFreePreview) {
    return true;
  }

  return hasPaidSubscription(companyId);
}

export async function canStartFreeScan(companyId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("contract_scans")
    .select("id", { head: true, count: "exact" })
    .eq("company_id", companyId);

  if (error) {
    throw error;
  }

  return (count ?? 0) === 0;
}
