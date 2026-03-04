alter table public.documents
  add column if not exists document_fingerprint text;

create index if not exists idx_documents_project_fingerprint
on public.documents(project_id, document_type, document_fingerprint);
