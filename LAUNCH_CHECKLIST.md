# Bidmetric Launch Checklist

## Environment

- Set `NEXT_PUBLIC_SUPABASE_URL`
- Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Set `SUPABASE_SERVICE_ROLE_KEY`
- Set `OPENAI_API_KEY`
- Set `STRIPE_SECRET_KEY`
- Set `STRIPE_WEBHOOK_SECRET`
- Set `STRIPE_PRICE_ID`
- Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Set `NEXT_PUBLIC_APP_URL`

## Supabase

- Apply all migrations in `supabase/migrations/`
- Confirm private buckets exist:
  - `contracts`
  - `project-documents`
  - `emails`
  - `generated-artifacts`
- Verify RLS is enabled in production
- Verify service role key is only used server-side

## Stripe

- Create the production product and recurring price
- Set `STRIPE_PRICE_ID`
- Configure webhook endpoint:
  - `/api/stripe/webhook`
- Subscribe webhook events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

## Runtime

- Run the web app
- Run the document worker with `npm run worker:documents`
- Verify `/api/health` returns `status: ok`
- Verify worker can recover stale `in_progress` jobs

## Smoke Tests

- Upload first contract from landing page and verify free preview
- Upgrade through Stripe checkout
- Re-open scan and verify full report unlocks
- Upload a readable project PDF and verify indexing
- Upload a `.eml` file and verify correspondence summary and to-do creation
- Ask the assistant a grounded project question
- Fail one job intentionally and confirm retry/recovery behavior

## Observability

- Watch server logs for:
  - Stripe webhook processing
  - worker recovery warnings
  - API rate limit errors
- Verify no secrets are printed in logs
