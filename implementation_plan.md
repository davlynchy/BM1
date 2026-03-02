# Bidmetric Implementation Plan

## Objective

Build a production-stable Phase A MVP for Bidmetric using `TypeScript`, `Next.js`, `Supabase`, `OpenAI API`, and `Tailwind CSS`.

This plan is intended to be followed in sequence. Each stage produces a usable milestone and reduces risk in the next stage.

## Product Goal

Deliver a commercial intelligence platform for subcontractors that can:

- accept contract and project document uploads
- extract structured commercial obligations and risks
- provide a project dashboard across multiple jobs
- support document-grounded AI chat
- generate commercial action items and draft content
- convert free scans into paid subscriptions

## Ground Rules

- Use `Next.js App Router`
- Use `Supabase` for auth, database, storage, and RLS-backed tenancy
- Use `pgvector` in Supabase for embeddings and retrieval
- Use the official `OpenAI API`
- Use `Tailwind CSS` with the provided design tokens
- Keep server logic server-side; do not expose sensitive AI or storage logic in the client
- Treat all large-file ingestion and AI analysis as asynchronous jobs
- Prioritize citation accuracy and auditability over broad-but-weak AI output

## Success Criteria For Phase A

- User can upload a contract from the landing page
- User can sign up and save that upload into a project
- System can extract structured obligations and top risks with citations
- User can view a partial free summary
- User can upgrade with Stripe to unlock the full report
- User can manage projects in a dashboard
- User can upload project documents into a vault
- User can ask grounded questions against project documents
- User can upload `.eml` correspondence and receive suggested actions
- System is stable for supported inputs and does not rely on long blocking requests

## Suggested Repository Shape

```text
app/
components/
components/ui/
lib/
lib/ai/
lib/auth/
lib/billing/
lib/db/
lib/documents/
lib/emails/
lib/jobs/
lib/rag/
lib/validators/
public/
styles/
supabase/
supabase/migrations/
types/
workers/
```

## Design System Requirements

Use these tokens globally:

```css
:root{
  --bg: #F6F7F6;
  --panel: #FFFFFF;
  --text: #0B0D0C;
  --muted: #66736B;
  --border: #E6EAE7;
  --brand: #2D6205;
  --brand2: #9FE870;
  --radius: 14px;
}
```

Typography:

- Heading: `Viga`
- Body: `Inter`

UI rules:

- use `--brand` sparingly
- most surfaces should use `--panel` and `--border`
- keep the product visual language minimal and operational

## Delivery Strategy

Build the MVP in 8 execution stages:

1. Foundation
2. Auth, tenancy, and schema
3. Landing flow and free scan funnel
4. Document ingestion and processing pipeline
5. Contract scan engine and report UX
6. Dashboard and project workspace
7. Assistant, correspondence, and to-dos
8. Billing, hardening, and launch prep

---

## Stage 1: Foundation

### Goal

Bootstrap the application and establish the baseline design system and app shell.

### Deliverables

- Next.js app initialized with TypeScript and Tailwind
- base layout and route groups
- font setup for `Viga` and `Inter`
- CSS tokens and base component styles
- Supabase client/server utilities scaffolded
- environment variable contract documented
- linting, formatting, and type checking configured

### Tasks

- initialize Next.js app with App Router
- configure Tailwind and global CSS tokens
- set up font loading in the root layout
- create base route groups:
  - `(marketing)`
  - `(auth)`
  - `(app)`
- scaffold shared UI primitives:
  - button
  - input
  - textarea
  - badge
  - card
  - modal
  - table
  - tabs
  - upload dropzone
- create `lib/env.ts` to validate environment variables with `zod`
- create `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`
- add logging helper and error boundary structure

### Exit Criteria

- app boots locally
- typecheck passes
- design system tokens are applied
- route groups and shared primitives exist

### Starter Tickets

- `FE-001` Bootstrap Next.js, Tailwind, and App Router
- `FE-002` Implement global theme tokens and fonts
- `PLAT-001` Create env validation and Supabase client utilities
- `FE-003` Build foundational UI primitives

---

## Stage 2: Auth, Tenancy, and Schema

### Goal

Establish secure multi-project workspace foundations using Supabase auth, Postgres, and RLS.

### Deliverables

- Supabase auth flow
- company/workspace tenancy model
- core schema migrations
- RLS policies
- authenticated app shell

### Core Tables

- `companies`
- `profiles`
- `company_members`
- `projects`
- `documents`
- `document_pages`
- `document_chunks`
- `contract_scans`
- `contract_scan_findings`
- `contract_obligations`
- `project_todos`
- `project_correspondence`
- `assistant_threads`
- `assistant_messages`
- `billing_customers`
- `billing_subscriptions`
- `usage_events`
- `jobs`

### Tasks

- define all primary tables and foreign keys
- enable `pgvector`
- add `created_at`, `updated_at`, and ownership columns consistently
- implement RLS on every tenant-owned table
- add helper SQL functions for current company membership checks
- build signup, login, logout, password reset
- build post-auth workspace bootstrap:
  - create company
  - create profile
  - assign owner membership
- create initial authenticated sidebar shell

### Exit Criteria

- users can sign up and log in
- user is assigned to a company
- user can access only their company data
- migrations can be replayed from scratch

### Starter Tickets

- `DB-001` Create initial Supabase schema migration
- `DB-002` Add RLS policies for tenant isolation
- `AUTH-001` Build signup and login flows
- `AUTH-002` Build company bootstrap on first login
- `APP-001` Create authenticated app shell

---

## Stage 3: Landing Flow and Free Scan Funnel

### Goal

Ship the public acquisition flow that converts contract uploads into authenticated leads and paid opportunities.

### Deliverables

- marketing landing page
- upload CTA flow
- pre-auth upload capture
- login/signup interstitial
- project naming modal
- partial report preview screen with locked content

### Pages

- `/`
- `/login`
- `/signup`
- `/upload`
- `/scan/[scanId]`

### Tasks

- implement landing page from the provided specification
- build primary CTA and upload entry
- support anonymous pre-auth upload session handoff
- after auth, prompt for project name and company association
- persist initial uploaded file into a project and scan record
- build “first scan free” gating logic
- implement blurred locked sections and upgrade prompts

### Exit Criteria

- anonymous user can start upload
- user must authenticate to see/save results
- user sees partial scan output with clear upgrade path

### Starter Tickets

- `MKT-001` Build landing page and CTAs
- `MKT-002` Build upload funnel entry screen
- `AUTH-003` Implement pre-auth upload handoff after signup/login
- `PAYWALL-001` Build locked scan preview state

---

## Stage 4: Document Ingestion and Processing Pipeline

### Goal

Create a reliable ingestion system for contracts and project documents, including large files and folder uploads.

### Deliverables

- storage bucket strategy
- upload API
- async processing jobs
- extraction pipeline
- chunking and embedding pipeline
- ingestion progress tracking

### Buckets

- `contracts`
- `project-documents`
- `emails`
- `generated-artifacts`

### Supported Initial File Types

- `.pdf`
- `.docx`
- `.xlsx`
- `.txt`
- `.eml`

### Tasks

- define upload metadata model
- build secure signed upload flow
- validate size, type, and tenant access
- create `jobs` table and worker polling/execution model
- implement file extraction pipeline:
  - pdf text extraction
  - docx extraction
  - xlsx extraction
  - eml parsing
- store normalized page/section text
- implement chunking strategy by heading/clause boundary
- generate embeddings asynchronously
- surface ingestion state in UI:
  - uploaded
  - queued
  - parsing
  - chunking
  - indexed
  - failed

### Exit Criteria

- user can upload supported documents
- files are stored privately
- text is extracted and chunked
- embeddings are stored
- failures are recoverable and visible

### Starter Tickets

- `DOC-001` Create document metadata schema and storage helpers
- `DOC-002` Build secure upload API and signed upload flow
- `JOB-001` Create async jobs framework
- `PARSE-001` Implement PDF, DOCX, TXT extraction
- `PARSE-002` Implement XLSX and EML extraction
- `RAG-001` Implement chunking and embeddings pipeline
- `DOC-003` Build ingestion status UI

---

## Stage 5: Contract Scan Engine and Report UX

### Goal

Turn contract content into structured commercial intelligence with traceable citations.

### Deliverables

- contract extraction schemas
- structured commercial obligations extraction
- risk analysis engine
- findings model with severity
- scan results UI with citations and document viewer

### Extraction Categories

- payment claims
- variations
- extension of time
- notice windows
- time bars
- liquidated damages
- indemnities
- insurance
- defects and warranties
- suspension/termination
- dispute resolution
- security/retention
- submission methods and timelines

### Tasks

- define JSON schemas for structured extraction outputs
- implement extraction prompts and validation pipeline
- implement second-pass risk scoring and recommendation generation
- store findings and obligations separately
- attach citation metadata down to page/chunk level
- build report UI:
  - executive summary
  - obligations table
  - top risks
  - recommendation blocks
  - citation hover snippet
  - click-through document viewer
- implement free summary vs paid full report gating

### Exit Criteria

- uploaded contract produces structured obligations
- top risks are generated with citations
- user can inspect source evidence
- report is stable for supported contract formats

### Starter Tickets

- `AI-001` Define structured extraction schemas
- `AI-002` Build obligation extraction pipeline
- `AI-003` Build risk scoring and recommendation pipeline
- `SCAN-001` Persist contract scan outputs
- `SCAN-002` Build report page with citation UX
- `PAYWALL-002` Gate full report by billing state

---

## Stage 6: Dashboard and Project Workspace

### Goal

Provide a commercial control center that surfaces project status, obligations, and key actions.

### Deliverables

- portfolio dashboard
- project CRUD
- project overview page
- vault UI
- settings pages

### Dashboard Summary Requirements

- project contract value
- program dates
- next progress claim due
- variation summary
- to-do summary
- risk status

### Tasks

- build project CRUD
- build dashboard list/grid views
- compute project summary cards from structured data
- build project overview page
- build vault page with categories:
  - contract
  - specifications
  - finishes schedule
  - quotes
  - supplier quotes
  - general documents
- build company vault page
- build settings:
  - company details
  - user details
  - billing placeholder/integration point

### Exit Criteria

- user can create and manage projects
- dashboard shows useful commercial summaries
- project vault is usable and secure

### Starter Tickets

- `PROJ-001` Build project CRUD flows
- `DASH-001` Build dashboard overview and project cards
- `PROJ-002` Build project overview page
- `VAULT-001` Build project vault UI
- `VAULT-002` Build company vault UI
- `SET-001` Build settings pages

---

## Stage 7: Assistant, Correspondence, and To-Dos

### Goal

Add grounded intelligence workflows that turn documents and emails into actions.

### Deliverables

- project-scoped assistant
- citations in answers
- `.eml` correspondence ingestion
- AI-suggested actions and draft responses
- to-do engine

### Tasks

- build project-scoped assistant thread model
- implement retrieval pipeline:
  - semantic search
  - metadata filters
  - reranking
- constrain answers to retrieved evidence
- render answer citations and linked snippets
- parse uploaded `.eml` files and store sender/date/body/attachments metadata
- build correspondence UI list and detail view
- implement action detection from correspondence:
  - potential variation
  - upcoming claim action
  - notice requirement
  - risk follow-up
- create to-dos from:
  - contract findings
  - correspondence analysis
  - program dates
- generate editable draft notices/emails

### Exit Criteria

- user can ask grounded questions about project documents
- `.eml` uploads produce analyzable correspondence records
- AI can suggest actionable next steps and drafts
- to-dos are generated from scan and correspondence signals

### Starter Tickets

- `RAG-002` Build project-scoped retrieval and answer generation
- `CHAT-001` Build assistant UI with citations
- `EMAIL-001` Build EML ingestion and parser mapping
- `EMAIL-002` Build correspondence views
- `TODO-001` Create to-do rules and schema wiring
- `AI-004` Generate editable draft notices and email replies

---

## Stage 8: Billing, Hardening, and Launch Prep

### Goal

Make the MVP production-safe and commercially usable.

### Deliverables

- Stripe subscriptions
- free-vs-paid entitlement enforcement
- monitoring/logging
- retry and failure handling
- test coverage for critical paths
- deployment readiness

### Tasks

- integrate Stripe checkout and customer portal
- sync subscription state via webhooks
- implement usage gating for:
  - first free scan
  - full report unlock
  - premium assistant access if needed
- add monitoring and structured logs
- add job retries and dead-letter states
- add rate limits to upload, scan, and chat endpoints
- add test coverage for:
  - auth and RLS assumptions
  - ingestion pipeline
  - scan persistence
  - retrieval grounding
  - billing gates
- prepare deployment configs and secrets checklist

### Exit Criteria

- user can upgrade and unlock features
- critical flows are observable and test-covered
- app is ready for production deployment

### Starter Tickets

- `BILL-001` Integrate Stripe checkout and webhook sync
- `BILL-002` Enforce entitlement and usage rules
- `OPS-001` Add monitoring, logging, and alerts
- `OPS-002` Add retry/dead-letter handling for jobs
- `QA-001` Add integration coverage for critical paths
- `DEPLOY-001` Finalize deployment and production checklist

---

## Cross-Cutting Technical Standards

### Backend Standards

- validate all inputs with `zod`
- keep OpenAI calls in server-only modules
- use structured outputs whenever possible
- avoid long synchronous requests for ingestion or scanning
- make jobs idempotent where practical

### Frontend Standards

- prefer server components for data loading
- keep client state minimal
- use optimistic UX only where rollback is safe
- show explicit processing statuses for long-running actions

### AI Standards

- never answer without evidence when in grounded modes
- store citations with every extracted finding
- separate extraction, scoring, and drafting into distinct prompt paths
- keep prompts versioned in code

### Security Standards

- all storage private by default
- all data access checked against company membership
- do not expose raw storage paths publicly
- use signed URLs for authorized file access
- redact sensitive values from logs

---

## Initial Build Order Recommendation

This is the exact order I recommend for starting the build:

1. initialize app and design system
2. set up Supabase, schema, and RLS
3. build auth and workspace bootstrap
4. build landing page and upload entry
5. implement document upload and jobs
6. implement contract extraction and risk report
7. add free scan paywall and Stripe
8. build dashboard and project pages
9. add vault and document viewer
10. add grounded assistant
11. add `.eml` correspondence and to-dos
12. harden, test, and deploy

## MVP Release Cut

If timeline pressure appears, release with this smallest credible slice:

- landing page
- auth
- contract upload
- project creation
- structured contract scan
- top risk findings with citations
- partial free report
- Stripe upgrade
- full report unlock
- dashboard with saved projects
- project assistant against contract documents only

Then add:

- broader vault support
- `.eml` correspondence
- automated to-dos

## Definition Of Done

A stage is complete only when:

- code is merged and type-safe
- the feature is usable in UI
- error states are handled
- auth and tenancy are enforced
- the feature has at least basic automated verification
- the feature is documented if it introduces operational setup

## Immediate Next Step

Start with Stage 1 and Stage 2 together:

- scaffold the app
- wire Supabase
- define schema and RLS
- build auth shell

That creates the base required for every later feature.
