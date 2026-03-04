create table if not exists public.assistant_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  mode text not null default 'auto' check (mode in ('auto', 'draft', 'answer')),
  requested_output_type text check (requested_output_type in ('email', 'memo', 'summary', 'checklist')),
  status text not null default 'queued' check (status in ('queued', 'in_progress', 'completed', 'failed')),
  current_stage text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.assistant_thread_sources (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  source_kind text not null default 'document',
  pinned boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique(thread_id, document_id)
);

create table if not exists public.project_outputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  thread_id uuid references public.assistant_threads(id) on delete set null,
  source_run_id uuid references public.assistant_runs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  type text not null check (type in ('email', 'memo', 'summary', 'checklist')),
  title text not null,
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.project_output_versions (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.project_outputs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  version integer not null,
  title text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique(output_id, version)
);

alter table public.assistant_runs enable row level security;
alter table public.assistant_thread_sources enable row level security;
alter table public.project_outputs enable row level security;
alter table public.project_output_versions enable row level security;

create policy "assistant_runs_member_access"
on public.assistant_runs
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "assistant_thread_sources_member_access"
on public.assistant_thread_sources
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "project_outputs_member_access"
on public.project_outputs
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "project_output_versions_member_access"
on public.project_output_versions
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create trigger set_assistant_runs_updated_at
before update on public.assistant_runs
for each row execute procedure public.set_updated_at();

create trigger set_assistant_thread_sources_updated_at
before update on public.assistant_thread_sources
for each row execute procedure public.set_updated_at();

create trigger set_project_outputs_updated_at
before update on public.project_outputs
for each row execute procedure public.set_updated_at();

create index if not exists idx_assistant_runs_thread_id on public.assistant_runs(thread_id, created_at desc);
create index if not exists idx_assistant_thread_sources_thread_id on public.assistant_thread_sources(thread_id, pinned desc, created_at asc);
create index if not exists idx_project_outputs_project_id on public.project_outputs(project_id, updated_at desc);
create index if not exists idx_project_output_versions_output_id on public.project_output_versions(output_id, version desc);
