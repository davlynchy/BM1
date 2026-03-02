import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { getStripeClient } from "@/lib/billing/stripe";
import {
  findCompanyIdByStripeCustomerId,
  markCompanySubscriptionInactive,
  upsertBillingCustomer,
  upsertBillingSubscription,
} from "@/lib/billing/store";

function extractPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

function extractCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd =
    "current_period_end" in subscription &&
    typeof subscription.current_period_end === "number"
      ? subscription.current_period_end
      : null;

  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

export async function POST(request: Request) {
  const env = getEnv();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });
  }

  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId =
          typeof session.metadata?.companyId === "string" ? session.metadata.companyId : null;

        if (companyId && typeof session.customer === "string") {
          await upsertBillingCustomer({
            companyId,
            stripeCustomerId: session.customer,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const metadataCompanyId =
          typeof subscription.metadata?.companyId === "string"
            ? subscription.metadata.companyId
            : null;
        const customerCompanyId =
          typeof subscription.customer === "string"
            ? await findCompanyIdByStripeCustomerId(subscription.customer)
            : null;
        const companyId = metadataCompanyId ?? customerCompanyId;

        if (companyId) {
          if (typeof subscription.customer === "string") {
            await upsertBillingCustomer({
              companyId,
              stripeCustomerId: subscription.customer,
            });
          }

          await upsertBillingSubscription({
            companyId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: extractPriceId(subscription),
            status: subscription.status,
            currentPeriodEnd: extractCurrentPeriodEnd(subscription),
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await markCompanySubscriptionInactive({
          stripeCustomerId:
            typeof subscription.customer === "string" ? subscription.customer : null,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }
      default:
        break;
    }

    log("info", "Processed Stripe webhook", {
      eventType: event.type,
      eventId: event.id,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook handling failed.";
    log("error", "Stripe webhook failed", {
      eventType: event.type,
      eventId: event.id,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
