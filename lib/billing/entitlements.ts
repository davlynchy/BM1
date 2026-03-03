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

export async function shouldCreatePreviewScan(companyId: string) {
  return !(await hasPaidSubscription(companyId));
}
