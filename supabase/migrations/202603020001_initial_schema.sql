create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  default_company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (company_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'tender',
  contract_value numeric(14,2),
  site_due_date date,
  claim_cycle text,
  claim_submission_method text,
  variation_process text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  document_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  parse_status text not null default 'uploaded',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  page_number integer not null,
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (document_id, page_number)
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  page_id uuid references public.document_pages(id) on delete set null,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (document_id, chunk_index)
);

create table if not exists public.contract_scans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  contract_document_id uuid references public.documents(id) on delete set null,
  status text not null default 'queued',
  is_free_preview boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.contract_scan_findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.contract_scans(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  severity text not null check (severity in ('low', 'medium', 'high')),
  title text not null,
  summary text not null,
  implication text,
  recommended_action text,
  citation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.contract_obligations (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.contract_scans(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  category text not null,
  title text not null,
  due_rule text,
  submission_path text,
  notice_period_days integer,
  citation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.project_todos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  source_type text not null,
  title text not null,
  summary text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'dismissed')),
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.project_correspondence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  subject text not null default '',
  sender text not null default '',
  received_at timestamptz,
  body_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null default 'New thread',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.document_chunks enable row level security;
alter table public.contract_scans enable row level security;
alter table public.contract_scan_findings enable row level security;
alter table public.contract_obligations enable row level security;
alter table public.project_todos enable row level security;
alter table public.project_correspondence enable row level security;
alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.jobs enable row level security;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  );
$$;

create policy "profiles_select_self"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "company_members_select_member"
on public.company_members
for select
using (public.is_company_member(company_id));

create policy "company_members_insert_owner"
on public.company_members
for insert
with check (
  auth.uid() = user_id
  and (
    exists (
      select 1
      from public.companies c
      where c.id = company_id
        and c.created_by = auth.uid()
    )
    or public.is_company_owner(company_id)
  )
);

create policy "companies_select_member"
on public.companies
for select
using (public.is_company_member(id));

create policy "companies_insert_creator"
on public.companies
for insert
with check (auth.uid() = created_by);

create policy "companies_update_owner"
on public.companies
for update
using (public.is_company_owner(id))
with check (public.is_company_owner(id));

create policy "projects_member_access"
on public.projects
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "documents_member_access"
on public.documents
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "document_pages_member_access"
on public.document_pages
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "document_chunks_member_access"
on public.document_chunks
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "contract_scans_member_access"
on public.contract_scans
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "contract_scan_findings_member_access"
on public.contract_scan_findings
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "contract_obligations_member_access"
on public.contract_obligations
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "project_todos_member_access"
on public.project_todos
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "project_correspondence_member_access"
on public.project_correspondence
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "assistant_threads_member_access"
on public.assistant_threads
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "assistant_messages_member_access"
on public.assistant_messages
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "billing_customers_member_access"
on public.billing_customers
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "billing_subscriptions_member_access"
on public.billing_subscriptions
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "usage_events_member_access"
on public.usage_events
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "jobs_member_access"
on public.jobs
for all
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create trigger set_companies_updated_at
before update on public.companies
for each row execute procedure public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_company_members_updated_at
before update on public.company_members
for each row execute procedure public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute procedure public.set_updated_at();

create trigger set_documents_updated_at
before update on public.documents
for each row execute procedure public.set_updated_at();

create trigger set_document_pages_updated_at
before update on public.document_pages
for each row execute procedure public.set_updated_at();

create trigger set_document_chunks_updated_at
before update on public.document_chunks
for each row execute procedure public.set_updated_at();

create trigger set_contract_scans_updated_at
before update on public.contract_scans
for each row execute procedure public.set_updated_at();

create trigger set_contract_scan_findings_updated_at
before update on public.contract_scan_findings
for each row execute procedure public.set_updated_at();

create trigger set_contract_obligations_updated_at
before update on public.contract_obligations
for each row execute procedure public.set_updated_at();

create trigger set_project_todos_updated_at
before update on public.project_todos
for each row execute procedure public.set_updated_at();

create trigger set_project_correspondence_updated_at
before update on public.project_correspondence
for each row execute procedure public.set_updated_at();

create trigger set_assistant_threads_updated_at
before update on public.assistant_threads
for each row execute procedure public.set_updated_at();

create trigger set_assistant_messages_updated_at
before update on public.assistant_messages
for each row execute procedure public.set_updated_at();

create trigger set_billing_customers_updated_at
before update on public.billing_customers
for each row execute procedure public.set_updated_at();

create trigger set_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row execute procedure public.set_updated_at();

create trigger set_usage_events_updated_at
before update on public.usage_events
for each row execute procedure public.set_updated_at();

create trigger set_jobs_updated_at
before update on public.jobs
for each row execute procedure public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create index if not exists idx_company_members_user_id on public.company_members(user_id);
create index if not exists idx_projects_company_id on public.projects(company_id);
create index if not exists idx_documents_company_id on public.documents(company_id);
create index if not exists idx_documents_project_id on public.documents(project_id);
create index if not exists idx_contract_scans_company_id on public.contract_scans(company_id);
create index if not exists idx_contract_scan_findings_scan_id on public.contract_scan_findings(scan_id);
create index if not exists idx_contract_obligations_scan_id on public.contract_obligations(scan_id);
create index if not exists idx_project_todos_project_id on public.project_todos(project_id);
create index if not exists idx_project_correspondence_project_id on public.project_correspondence(project_id);
create index if not exists idx_assistant_threads_project_id on public.assistant_threads(project_id);
create index if not exists idx_jobs_status on public.jobs(status);
