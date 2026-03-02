import { createAdminClient } from "@/lib/supabase/admin";

export async function getCompanyBillingState(companyId: string) {
  const supabase = createAdminClient();
  const [{ data: customer, error: customerError }, { data: subscription, error: subscriptionError }] =
    await Promise.all([
      supabase
        .from("billing_customers")
        .select("id, stripe_customer_id")
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("billing_subscriptions")
        .select("id, stripe_subscription_id, stripe_price_id, status, current_period_end")
        .eq("company_id", companyId)
        .maybeSingle(),
    ]);

  if (customerError) {
    throw customerError;
  }

  if (subscriptionError) {
    throw subscriptionError;
  }

  return {
    customer,
    subscription,
  };
}

export async function findCompanyIdByStripeCustomerId(stripeCustomerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("billing_customers")
    .select("company_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.company_id ?? null;
}

export async function upsertBillingCustomer(params: {
  companyId: string;
  stripeCustomerId: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("billing_customers").upsert(
    {
      company_id: params.companyId,
      stripe_customer_id: params.stripeCustomerId,
    },
    {
      onConflict: "company_id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function upsertBillingSubscription(params: {
  companyId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  status: string;
  currentPeriodEnd: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("billing_subscriptions").upsert(
    {
      company_id: params.companyId,
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_price_id: params.stripePriceId,
      status: params.status,
      current_period_end: params.currentPeriodEnd,
    },
    {
      onConflict: "company_id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function markCompanySubscriptionInactive(params: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const supabase = createAdminClient();

  if (params.stripeSubscriptionId) {
    const { error } = await supabase
      .from("billing_subscriptions")
      .update({
        status: "inactive",
        current_period_end: null,
      })
      .eq("stripe_subscription_id", params.stripeSubscriptionId);

    if (error) {
      throw error;
    }

    return;
  }

  if (params.stripeCustomerId) {
    const { data: customer, error: customerError } = await supabase
      .from("billing_customers")
      .select("company_id")
      .eq("stripe_customer_id", params.stripeCustomerId)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    if (!customer?.company_id) {
      return;
    }

    const { error } = await supabase
      .from("billing_subscriptions")
      .update({
        status: "inactive",
        current_period_end: null,
      })
      .eq("company_id", customer.company_id);

    if (error) {
      throw error;
    }
  }
}
