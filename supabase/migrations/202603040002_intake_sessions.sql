create table if not exists public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null check (
    status in (
      'awaiting_auth',
      'awaiting_project',
      'awaiting_upload',
      'processing',
      'completed',
      'expired',
      'cancelled'
    )
  ),
  source_mode text not null default 'public_intake',
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  selected_files jsonb not null default '[]'::jsonb,
  project_selection_mode text check (project_selection_mode in ('create_new', 'existing')),
  project_id uuid references public.projects(id) on delete set null,
  new_project_name text,
  document_id uuid references public.documents(id) on delete set null,
  scan_id uuid references public.contract_scans(id) on delete set null,
  storage_provider text,
  storage_bucket text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.intake_sessions enable row level security;

create policy "intake_sessions_insert_public"
on public.intake_sessions
for insert
to anon, authenticated
with check (
  source_mode = 'public_intake'
  and (user_id is null or auth.uid() = user_id)
);

create policy "intake_sessions_select_owner"
on public.intake_sessions
for select
using (auth.uid() = user_id);

create policy "intake_sessions_update_owner"
on public.intake_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger set_intake_sessions_updated_at
before update on public.intake_sessions
for each row execute procedure public.set_updated_at();

create index if not exists idx_intake_sessions_user_id on public.intake_sessions(user_id);
create index if not exists idx_intake_sessions_company_id on public.intake_sessions(company_id);
create index if not exists idx_intake_sessions_status_expires_at on public.intake_sessions(status, expires_at);
