-- BM1 vector strategy: use 1536-dim embeddings so ANN indexing is available.
-- This restores fast retrieval while keeping good quality for v1.

update public.document_chunks
set embedding = null
where embedding is not null;

alter table public.document_chunks
  alter column embedding type vector(1536);

drop index if exists public.idx_document_chunks_embedding_hnsw;
drop index if exists public.idx_document_chunks_embedding_ivfflat;

create index if not exists idx_document_chunks_embedding_hnsw
on public.document_chunks
using hnsw (embedding vector_cosine_ops)
where embedding is not null;

create or replace function public.match_document_chunks(
  p_company_id uuid,
  p_project_id uuid,
  p_query_embedding vector(1536),
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
