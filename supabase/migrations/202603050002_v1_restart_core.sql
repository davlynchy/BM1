-- Bidmetric v1 restart baseline primitives (additive/idempotent)

-- Keep document chunks directly filterable by project for fast retrieval.
alter table public.document_chunks
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

update public.document_chunks dc
set project_id = d.project_id
from public.documents d
where dc.document_id = d.id
  and dc.project_id is distinct from d.project_id;

create index if not exists idx_document_chunks_project_document
on public.document_chunks(project_id, document_id);

create index if not exists idx_jobs_status_created_at
on public.jobs(status, created_at);

create index if not exists idx_jobs_job_type_status_created_at
on public.jobs(job_type, status, created_at);

-- Move embeddings to text-embedding-3-large dimensionality.
update public.document_chunks
set embedding = null
where embedding is not null;

alter table public.document_chunks
  alter column embedding type vector(3072);

-- Vector index for cosine similarity search.
-- BM1 pgvector runtime cannot index vectors above 2000 dims, so skip index for vector(3072).
do $$
declare
  embedding_type text;
  embedding_dims integer;
begin
  select pg_catalog.format_type(a.atttypid, a.atttypmod)
  into embedding_type
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'document_chunks'
    and a.attname = 'embedding'
    and a.attnum > 0
    and not a.attisdropped;

  if embedding_type is null then
    raise notice 'Skipping vector index: embedding column not found.';
    return;
  end if;

  embedding_dims := nullif(regexp_replace(embedding_type, '^vector\((\d+)\)$', '\1'), embedding_type)::integer;

  if embedding_dims is not null and embedding_dims > 2000 then
    raise notice 'Skipping vector index for document_chunks.embedding (>2000 dims on this pgvector runtime).';
  else
    execute 'create index if not exists idx_document_chunks_embedding_hnsw on public.document_chunks using hnsw (embedding vector_cosine_ops) where embedding is not null';
  end if;
end
$$;

-- Atomic batch job claim for multi-worker throughput.
create or replace function public.claim_jobs_batch(
  p_worker_id text,
  p_batch_size integer default 5,
  p_job_types text[] default null
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
begin
  return query
  with candidate as (
    select j.id
    from public.jobs j
    where j.status = 'queued'
      and (p_job_types is null or j.job_type = any(p_job_types))
    order by j.created_at asc
    limit greatest(1, least(coalesce(p_batch_size, 5), 50))
    for update skip locked
  )
  update public.jobs j
  set
    status = 'in_progress',
    locked_at = timezone('utc'::text, now()),
    locked_by = p_worker_id,
    started_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  from candidate
  where j.id = candidate.id
  returning j.*;
end;
$$;

grant execute on function public.claim_jobs_batch(text, integer, text[]) to authenticated, service_role;

-- Project-scoped vector retrieval with optional document filter.
create or replace function public.match_document_chunks(
  p_company_id uuid,
  p_project_id uuid,
  p_query_embedding vector(3072),
  p_limit integer default 40,
  p_document_ids uuid[] default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
set search_path = public
as $$
  select
    dc.id as chunk_id,
    dc.document_id,
    d.name as document_name,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> p_query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where dc.company_id = p_company_id
    and d.company_id = p_company_id
    and dc.project_id = p_project_id
    and dc.embedding is not null
    and (p_document_ids is null or dc.document_id = any(p_document_ids))
  order by dc.embedding <=> p_query_embedding
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;

grant execute on function public.match_document_chunks(uuid, uuid, vector, integer, uuid[]) to authenticated, service_role;
