create policy "companies_select_creator"
on public.companies
for select
using (created_by = auth.uid());
