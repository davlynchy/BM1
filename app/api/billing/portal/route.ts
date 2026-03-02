import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { getRequestIp } from "@/lib/api/request";
import { getStripeClient } from "@/lib/billing/stripe";
import { getCompanyBillingState } from "@/lib/billing/store";
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
      scope: "billing_portal",
      key: String(user.id),
      limit: 20,
      windowMinutes: 15,
      companyId: workspace.company.id,
      userId: user.id,
      metadata: {
        ip: getRequestIp(request),
      },
    });

    const billingState = await getCompanyBillingState(workspace.company.id);

    if (!billingState.customer?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer exists for this workspace yet." }, { status: 400 });
    }

    const stripe = getStripeClient();
    const env = getEnv();
    const session = await stripe.billingPortal.sessions.create({
      customer: billingState.customer.stripe_customer_id,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/app/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create billing portal session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
