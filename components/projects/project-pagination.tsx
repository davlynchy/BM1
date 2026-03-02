import { buildProjectQuery, type ProjectFilters } from "@/lib/projects/filters";

export function ProjectPagination({
  basePath,
  filters,
  currentPage,
  totalPages,
}: {
  basePath: string;
  filters: ProjectFilters;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previousHref = `${basePath}${buildProjectQuery({ ...filters, page: Math.max(1, currentPage - 1) })}`;
  const nextHref = `${basePath}${buildProjectQuery({ ...filters, page: Math.min(totalPages, currentPage + 1) })}`;

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted">
      <a
        className={`rounded-xl border border-border px-3 py-2 ${currentPage === 1 ? "pointer-events-none opacity-50" : "hover:bg-panel"}`}
        href={previousHref}
      >
        Previous
      </a>
      <span>
        Page {currentPage} of {totalPages}
      </span>
      <a
        className={`rounded-xl border border-border px-3 py-2 ${currentPage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-panel"}`}
        href={nextHref}
      >
        Next
      </a>
    </div>
  );
}
