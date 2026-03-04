alter table public.assistant_threads
  add column if not exists thread_type text not null default 'project_assistant',
  add column if not exists scan_id uuid references public.contract_scans(id) on delete cascade;

alter table public.assistant_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_assistant_threads_project_thread_type
on public.assistant_threads(project_id, thread_type, updated_at desc);

create index if not exists idx_assistant_threads_scan_id
on public.assistant_threads(scan_id);
