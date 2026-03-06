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

alter table public.assistant_thread_sources enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_thread_sources'
      and policyname = 'assistant_thread_sources_member_access'
  ) then
    execute $policy$
      create policy "assistant_thread_sources_member_access"
      on public.assistant_thread_sources
      for all
      using (public.is_company_member(company_id))
      with check (public.is_company_member(company_id))
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_assistant_thread_sources_updated_at'
  ) then
    create trigger set_assistant_thread_sources_updated_at
    before update on public.assistant_thread_sources
    for each row execute procedure public.set_updated_at();
  end if;
end
$$;

create index if not exists idx_assistant_thread_sources_thread_id
on public.assistant_thread_sources(thread_id, pinned desc, created_at asc);
