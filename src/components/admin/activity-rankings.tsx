import Link from "next/link";
import type { AdminTopDownload, AdminTopSearch } from "@/lib/api/types";
import { routes } from "@/lib/routes";

export function ActivityRankings({
  downloads,
  searches,
  days,
}: {
  downloads: AdminTopDownload[];
  searches: AdminTopSearch[];
  days: number;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section className="min-w-0 border-2 border-border bg-card p-4 shadow-hard-sm">
        <h2 className="text-xl font-black uppercase">Most downloaded papers</h2>
        <p className="mt-1 text-xs text-muted-foreground">{days === 1 ? "Last 24 hours" : `Last ${days} days`} · PDFs served, excluding previews</p>
        {downloads.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No paper downloads recorded for this period.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {downloads.map((paper, index) => (
              <li key={paper.slug} className="flex items-start gap-3 py-3 text-sm">
                <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}.</span>
                <Link href={paper.path || routes.paper(paper.slug)} className="min-w-0 flex-1 break-words font-semibold text-link hover:underline">
                  {paper.title}
                </Link>
                <span className="shrink-0 text-right tabular-nums">
                  <strong className="block">{paper.downloads.toLocaleString("en-IN")}</strong>
                  <span className="text-xs text-muted-foreground">downloads</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="min-w-0 border-2 border-border bg-card p-4 shadow-hard-sm">
        <h2 className="text-xl font-black uppercase">Most searched terms</h2>
        <p className="mt-1 text-xs text-muted-foreground">{days === 1 ? "Last 24 hours" : `Last ${days} days`} · Matching case and spacing grouped together</p>
        {searches.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No search terms recorded for this period.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {searches.map((search, index) => (
              <li key={search.query} className="flex items-start gap-3 py-3 text-sm">
                <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <Link href={routes.search(search.query)} className="break-words font-semibold text-link hover:underline">
                    {search.query}
                  </Link>
                  {search.no_results > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {search.no_results.toLocaleString("en-IN")} returned no results
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-right tabular-nums">
                  <strong className="block">{search.count.toLocaleString("en-IN")}</strong>
                  <span className="text-xs text-muted-foreground">searches</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
