# Supabase Setup

Apply migrations in `supabase/migrations` to a Supabase project before using authenticated flows.

The initial migration creates:

- tenancy tables for companies, members, and projects
- document and scan tables for the MVP pipeline
- billing, jobs, and assistant tables
- RLS policies scoped to company membership
- profile auto-creation for new auth users

Required extensions:

- `pgcrypto`
- `vector`
