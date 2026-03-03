alter table public.usage_events
  alter column company_id drop not null;

create index if not exists idx_usage_events_event_type_created_at
  on public.usage_events(event_type, created_at desc);
