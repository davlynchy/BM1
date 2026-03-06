create table if not exists public.outlook_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  microsoft_tenant_id text,
  microsoft_user_id text,
  email_address text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (company_id, user_id)
);

create table if not exists public.outlook_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null references public.outlook_accounts(id) on delete cascade,
  cursor_type text not null default 'delta',
  cursor_value text,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (account_id, cursor_type)
);

create table if not exists public.outlook_messages_raw (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null references public.outlook_accounts(id) on delete cascade,
  microsoft_message_id text not null,
  internet_message_id text,
  conversation_id text,
  sender text,
  recipients text[] not null default '{}'::text[],
  subject text not null default '',
  body_preview text not null default '',
  received_at timestamptz,
  has_attachments boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (account_id, microsoft_message_id)
);

alter table public.project_correspondence
  add column if not exists source text not null default 'manual' check (source in ('outlook_sync', 'eml_upload', 'manual')),
  add column if not exists routing_status text not null default 'manual_assigned' check (routing_status in ('auto_assigned', 'needs_review', 'manual_assigned')),
  add column if not exists routing_confidence numeric(5,4),
  add column if not exists routing_reasons jsonb not null default '[]'::jsonb,
  add column if not exists assigned_project_id uuid references public.projects(id) on delete set null,
  add column if not exists internet_message_id text,
  add column if not exists conversation_id text;

create table if not exists public.email_routing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  correspondence_id uuid not null references public.project_correspondence(id) on delete cascade,
  predicted_project_id uuid references public.projects(id) on delete set null,
  confidence numeric(5,4),
  routing_status text not null,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.email_routing_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  correspondence_id uuid not null references public.project_correspondence(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  from_project_id uuid references public.projects(id) on delete set null,
  to_project_id uuid references public.projects(id) on delete set null,
  feedback_type text not null default 'manual_reassign',
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.outlook_accounts enable row level security;
alter table public.outlook_sync_cursors enable row level security;
alter table public.outlook_messages_raw enable row level security;
alter table public.email_routing_events enable row level security;
alter table public.email_routing_feedback enable row level security;

create policy "outlook_accounts_member_access"
on public.outlook_accounts
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "outlook_sync_cursors_member_access"
on public.outlook_sync_cursors
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "outlook_messages_raw_member_access"
on public.outlook_messages_raw
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "email_routing_events_member_access"
on public.email_routing_events
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "email_routing_feedback_member_access"
on public.email_routing_feedback
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create trigger set_outlook_accounts_updated_at
before update on public.outlook_accounts
for each row execute procedure public.set_updated_at();

create trigger set_outlook_sync_cursors_updated_at
before update on public.outlook_sync_cursors
for each row execute procedure public.set_updated_at();

create trigger set_outlook_messages_raw_updated_at
before update on public.outlook_messages_raw
for each row execute procedure public.set_updated_at();

create index if not exists idx_outlook_accounts_company_id on public.outlook_accounts(company_id);
create index if not exists idx_outlook_messages_raw_company_received_at on public.outlook_messages_raw(company_id, received_at desc);
create index if not exists idx_project_correspondence_routing on public.project_correspondence(company_id, routing_status, routing_confidence desc);
create index if not exists idx_project_correspondence_internet_message_id on public.project_correspondence(internet_message_id);
create index if not exists idx_email_routing_events_correspondence on public.email_routing_events(correspondence_id, created_at desc);
