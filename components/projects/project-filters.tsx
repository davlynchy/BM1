import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProjectFiltersForm({
  action,
  filters,
}: {
  action: string;
  filters: {
    q: string;
    status: string;
    scan: string;
    risk: string;
    sort: string;
  };
}) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-6">
      <input name="page" type="hidden" value="1" />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="q">Search</Label>
        <Input defaultValue={filters.q} id="q" name="q" placeholder="Project, claim method, variation process" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          className="flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none"
          defaultValue={filters.status}
          id="status"
          name="status"
        >
          <option value="all">All</option>
          <option value="tender">Tender</option>
          <option value="pre-construction">Pre-construction</option>
          <option value="construction">Construction</option>
          <option value="post-construction">Post-construction</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scan">Scan</Label>
        <select
          className="flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none"
          defaultValue={filters.scan}
          id="scan"
          name="scan"
        >
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In progress</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
          <option value="none">No scan</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="risk">Risk</Label>
        <select
          className="flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none"
          defaultValue={filters.risk}
          id="risk"
          name="risk"
        >
          <option value="all">All</option>
          <option value="high">High risks only</option>
          <option value="clear">No high risks</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sort">Sort</Label>
        <select
          className="flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none"
          defaultValue={filters.sort}
          id="sort"
          name="sort"
        >
          <option value="updated_desc">Newest</option>
          <option value="name_asc">Name</option>
          <option value="contract_desc">Contract value</option>
          <option value="risk_desc">High risk count</option>
          <option value="site_asc">Site date</option>
        </select>
      </div>
      <div className="md:col-span-6 flex gap-3">
        <Button type="submit">Apply filters</Button>
        <Button asChild type="button" variant="secondary">
          <a href={action}>Reset</a>
        </Button>
      </div>
    </form>
  );
}
