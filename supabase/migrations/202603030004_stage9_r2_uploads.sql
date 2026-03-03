create table if not exists public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source text not null default 'vault',
  status text not null default 'created',
  file_count integer not null default 0,
  total_bytes bigint not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

alter table public.upload_batches enable row level security;

create policy "upload_batches_member_access"
on public.upload_batches
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create trigger set_upload_batches_updated_at
before update on public.upload_batches
for each row execute procedure public.set_updated_at();

alter table public.documents
  add column if not exists storage_provider text not null default 'r2',
  add column if not exists relative_path text,
  add column if not exists upload_batch_id uuid references public.upload_batches(id) on delete set null,
  add column if not exists upload_state text not null default 'created',
  add column if not exists upload_completed_at timestamptz,
  add column if not exists storage_etag text,
  add column if not exists storage_version text;

update public.documents
set
  storage_provider = coalesce(nullif(storage_provider, ''), 'supabase'),
  upload_state = case
    when parse_status in ('queued', 'parsing', 'chunking', 'embedding', 'indexed') then 'uploaded'
    else 'created'
  end
where storage_provider is null or storage_provider = 'r2';

create index if not exists idx_documents_upload_batch_id on public.documents(upload_batch_id);
create index if not exists idx_documents_upload_state_created_at on public.documents(upload_state, created_at);
create index if not exists idx_documents_project_relative_path on public.documents(project_id, relative_path);
create index if not exists idx_upload_batches_status_created_at on public.upload_batches(status, created_at);
