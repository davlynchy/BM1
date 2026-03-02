alter table public.documents
  add column if not exists processing_error text,
  add column if not exists indexed_at timestamptz,
  add column if not exists page_count integer,
  add column if not exists chunk_count integer,
  add column if not exists source_filename text,
  add column if not exists parser_version text,
  add column if not exists artifacts jsonb not null default '{}'::jsonb;

alter table public.jobs
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists job_key text;

create unique index if not exists idx_jobs_job_key on public.jobs(job_key) where job_key is not null;
create index if not exists idx_jobs_status_created_at on public.jobs(status, created_at);
create index if not exists idx_documents_parse_status on public.documents(parse_status);
