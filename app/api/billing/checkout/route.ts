import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { getRequestIp } from "@/lib/api/request";
import { getStripeClient } from "@/lib/billing/stripe";
import { getCompanyBillingState, upsertBillingCustomer } from "@/lib/billing/store";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const workspace = await getActiveWorkspace();

    if (!workspace?.company?.id) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 400 });
    }

    await enforceRateLimit({
      scope: "billing_checkout",
      key: String(user.id),
      limit: 10,
      windowMinutes: 15,
      companyId: workspace.company.id,
      userId: user.id,
      metadata: {
        ip: getRequestIp(request),
      },
    });

    const env = getEnv();

    if (!env.STRIPE_PRICE_ID) {
      return NextResponse.json({ error: "STRIPE_PRICE_ID is not configured." }, { status: 500 });
    }

    const stripe = getStripeClient();
    const billingState = await getCompanyBillingState(workspace.company.id);
    let customerId = billingState.customer?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: workspace.profile?.email ?? user.email ?? undefined,
        name: workspace.company.name,
        metadata: {
          companyId: workspace.company.id,
        },
      });

      customerId = customer.id;
      await upsertBillingCustomer({
        companyId: workspace.company.id,
        stripeCustomerId: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/app/settings?billing=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/app/settings?billing=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          companyId: workspace.company.id,
        },
      },
      metadata: {
        companyId: workspace.company.id,
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create checkout session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
