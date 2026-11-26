import Link from "next/link";
import { NoPermission } from "@/components/admin/no-permission";
import { BarChart, PageHeader, StatCard } from "@/components/admin/ui";
import { EmptyState } from "@/components/shared/empty-state";
import { authedFetch, getMe } from "@/lib/api/server";
import { enumParam } from "@/lib/search-params";
import { ActivityRankings } from "@/components/admin/activity-rankings";
import type { AdminTopDownload, AdminTopSearch } from "@/lib/api/types";

interface Analytics {
  days: number;
  totals: Record<string, number>;
  sessions: number;
  daily: { day: string; type: string; n: number }[];
  hourly?: { hour: string; type: string; n: number }[];
  top_pages: { path: string; n: number }[];
  top_sources?: { src: string; n: number }[];
  top_searches: AdminTopSearch[];
  top_papers: AdminTopDownload[];
  funnel: { step: string; n: number }[];
}

function series(a: Analytics, type: string) {
  const map = new Map(a.daily.filter((d) => d.type === type).map((d) => [d.day, d.n]));
  const out: { date: string; count: number }[] = [];
  for (let i = a.days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: day, count: map.get(day) ?? 0 });
  }
  return out;
}

/** The last 24 hours, one bar per hour, in India time (the API groups by India time too). */
function hourlySeries(a: Analytics, type: string) {
  const map = new Map((a.hourly ?? []).filter((h) => h.type === type).map((h) => [h.hour, h.n]));
  const out: { date: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const iso = new Date(Date.now() + 19_800_000 - i * 3_600_000).toISOString();
    const key = `${iso.slice(0, 10)} ${iso.slice(11, 13)}:00`;
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

function List({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: React.ReactNode; value: string }[];
  empty: string;
}) {
  return (
    <section className="border-2 border-border bg-card p-4">
      <h2 className=" mb-4 text-2xl">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" description={empty} />
      ) : (
        <ol className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  if ((await getMe())?.role !== "admin") return <NoPermission />;
  const days = Number(enumParam((await props.searchParams).days, ["1", "7", "30", "90"] as const, "30"));
  const a = await authedFetch<Analytics>(
    "/admin/analytics",
    { query: { days } },
    "/admin/analytics",
  );
  const top = Math.max(1, ...a.funnel.map((f) => f.n));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Page views, searches, resource views and the download funnel, from the site's own event log."
        actions={
          <nav aria-label="Period" className="flex gap-1 text-sm">
            {[1, 7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/admin/analytics?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 ${d === days ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
              >
                {d === 1 ? "24h" : `${d}d`}
              </Link>
            ))}
          </nav>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Page views" value={a.totals.page_view ?? 0} />
        <StatCard label="Visits (sessions)" value={a.sessions} />
        <StatCard
          label="Searches"
          value={a.totals.search ?? 0}
          hint={`${a.totals.result_click ?? 0} result clicks`}
        />
        <StatCard
          label="Downloads"
          value={a.totals.download_success ?? 0}
          hint={`${a.totals.download_attempt ?? 0} clicks`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {days === 1 ? (
          <>
            <BarChart title="Page views" unit="hours" data={hourlySeries(a, "page_view")} />
            <BarChart title="Searches" unit="hours" data={hourlySeries(a, "search")} />
            <BarChart title="Downloads" unit="hours" data={hourlySeries(a, "download_success")} />
          </>
        ) : (
          <>
            <BarChart title="Page views" data={series(a, "page_view")} />
            <BarChart title="Searches" data={series(a, "search")} />
            <BarChart title="Downloads" data={series(a, "download_success")} />
          </>
        )}
      </div>

      <section className="mt-4 border-2 border-border bg-card p-4">
        <h2 className=" mb-4 text-2xl">Download funnel</h2>
        <ul className="space-y-2 text-sm">
          {a.funnel.map((f) => (
            <li key={f.step} className="grid grid-cols-[10rem_1fr_4rem] items-center gap-3">
              <span>{f.step}</span>
              <span className="h-3 rounded bg-muted">
                <span
                  className="block h-3 rounded bg-primary"
                  style={{ width: `${(f.n / top) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums">{f.n.toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4">
        <ActivityRankings downloads={a.top_papers} searches={a.top_searches} days={days} />
      </div>
      <div className="mt-4">
        <List
          title="Where visits come from"
          rows={(a.top_sources ?? []).map((s) => {
            const total = (a.top_sources ?? []).reduce((n, x) => n + x.n, 0) || 1;
            return {
              key: s.src,
              label: s.src,
              value: `${s.n.toLocaleString("en-IN")} · ${Math.round((s.n / total) * 100)}%`,
            };
          })}
          empty="Starts filling after the next deploy: each visit records the site or link it came from. WhatsApp usually shows as direct."
        />
      </div>
      <div className="mt-4">
        <List
          title="Top pages"
          rows={a.top_pages.map((p) => ({ key: p.path, label: p.path, value: String(p.n) }))}
          empty="Browse the site and pages show up here."
        />
      </div>
    </>
  );
}
