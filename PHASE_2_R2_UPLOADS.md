# Phase 2 R2 Uploads

This repo now supports direct multipart uploads from the browser to Cloudflare R2 for authenticated project document uploads.

## What Changed

- Supabase remains the source of truth for auth, projects, documents, jobs, and RLS.
- Large authenticated uploads no longer proxy file bytes through the Next.js server.
- Upload batches and upload state are stored in Postgres.
- The document worker can download source files from either Supabase Storage or R2.
- Public intake now preflights selections and requires auth for:
  - files over `25 MB`
  - multiple files
  - folder uploads

## Environment Variables

Add these before using the R2 path:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

## Database

Apply the migration:

- `supabase/migrations/202603030004_stage9_r2_uploads.sql`

This adds:

- `upload_batches`
- document upload metadata fields
- indexes for upload state and folder-relative paths

## New API Routes

- `POST /api/projects/[projectId]/uploads/session`
- `POST /api/projects/[projectId]/uploads/part`
- `POST /api/projects/[projectId]/uploads/complete`
- `GET /api/projects/[projectId]/uploads/[batchId]`
- `POST /api/intake/large-upload/start`

## Current Scope

Implemented:

- authenticated project vault uploads to R2
- multipart signed part uploads
- folder selection with relative-path capture
- upload batch metadata
- worker download support for R2
- auth gate for large public intake uploads

Still intentionally lightweight:

- anonymous intake still uses the existing small-file Supabase staging flow
- post-login large-intake resume is not yet a full direct-to-R2 intake workflow

## Verification

- `npm run typecheck`
- `npm run lint`
