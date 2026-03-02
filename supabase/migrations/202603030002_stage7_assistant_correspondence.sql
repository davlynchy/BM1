alter table public.project_todos
  add column if not exists source_ref text;

alter table public.project_correspondence
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists processing_error text,
  add column if not exists ai_summary text,
  add column if not exists draft_reply text,
  add column if not exists action_required boolean not null default false,
  add column if not exists analyzed_at timestamptz;

create index if not exists idx_project_todos_source_ref on public.project_todos(source_ref);
create index if not exists idx_project_correspondence_document_id on public.project_correspondence(document_id);
create index if not exists idx_project_correspondence_analysis_status on public.project_correspondence(analysis_status);
