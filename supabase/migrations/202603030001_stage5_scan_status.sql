alter table public.contract_scans
  add column if not exists processing_error text,
  add column if not exists completed_at timestamptz,
  add column if not exists prompt_version text;

create index if not exists idx_contract_scans_document_id on public.contract_scans(contract_document_id);
