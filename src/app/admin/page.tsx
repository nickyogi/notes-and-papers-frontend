import { redirect } from "next/navigation";
import { BarChart, PageHeader, StatCard, StatusBadge, fmtDate } from "@/components/admin/ui";
import { NoPermission } from "@/components/admin/no-permission";
import { authedFetch, getMe } from "@/lib/api/server";
import type { AdminOverview } from "@/lib/api/types";
import Link from "next/link";
import { ActivityRankings } from "@/components/admin/activity-rankings";
import { enumParam } from "@/lib/search-params";

export default async function AdminOverviewPage(props: PageProps<"/admin">) {
  const me = await getMe();
  if (me?.role === "moderator") redirect("/admin/review");
  if (me?.role !== "admin") return <NoPermission />;
  const days = Number(enumParam((await props.searchParams).days, ["1", "7", "30", "90"] as const, "30"));
  const o = await authedFetch<AdminOverview>("/admin/overview", { query: { days } }, "/admin");
  const k = o.kpis;

  const totalDownloads = k.downloads_total ?? k.downloads_7d ?? 0;
  const totalSearches = k.searches_total ?? k.searches_7d ?? 0;
  const unreadChats = k.chats_unread ?? 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Key performance indicators, repository status, and student usage trends."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1.5 border-2 border-border bg-card px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider shadow-hard-xs hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Support Chat {unreadChats > 0 && <span className="bg-destructive text-destructive-foreground px-1.5 py-0.2 rounded-full text-[10px]">{unreadChats}</span>}
            </Link>
            <Link
              href="/admin/imports"
              className="inline-flex items-center gap-1.5 border-2 border-border bg-primary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-hard-sm hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Crawl hub →
            </Link>
          </div>
        }
      />

      {/* Student Engagement & Activity KPIs */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Student Activity & Engagement
          </h2>
          <Link
            href="/admin/analytics"
            className="text-xs font-bold uppercase tracking-wider text-link hover:underline"
          >
            Analytics details →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Paper Downloads"
            value={totalDownloads}
            hint={`+${(k.downloads_7d ?? 0).toLocaleString("en-IN")} past 7 days · +${(k.downloads_today ?? 0).toLocaleString("en-IN")} today`}
            tone="good"
            href="/admin/analytics"
          />
          <StatCard
            label="Student Searches"
            value={totalSearches}
            hint={`+${(k.searches_7d ?? 0).toLocaleString("en-IN")} searches this week`}
            href="/admin/insights"
          />
          <StatCard
            label="Registered Users"
            value={k.users_total ?? 0}
            hint="Active student & moderator accounts"
            href="/admin/users"
          />
          <StatCard
            label="Support Queries"
            value={unreadChats > 0 ? `${unreadChats} Unread` : "All read"}
            hint={`${(k.chats_open ?? 0).toLocaleString("en-IN")} conversations`}
            tone={unreadChats > 0 ? "warn" : undefined}
            href="/admin/reports"
          />
        </div>
      </section>

      <section className="mt-5 space-y-3" aria-labelledby="popular-activity">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="popular-activity" className="text-xs font-black uppercase tracking-wider text-muted-foreground">Popular activity</h2>
          <nav aria-label="Activity period" className="flex gap-1 text-sm">
            {[1, 7, 30, 90].map((period) => (
              <Link key={period} href={`/admin?days=${period}`} aria-current={period === days ? "page" : undefined}
                className={`inline-flex min-h-10 items-center border-2 border-border px-3 font-bold ${period === days ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                {period === 1 ? "24 hours" : `${period} days`}
              </Link>
            ))}
          </nav>
        </div>
        <ActivityRankings downloads={o.top_downloads ?? []} searches={o.top_searches ?? []} days={days} />
        <Link href={`/admin/insights?days=${days}`} className="inline-block text-xs font-bold text-link hover:underline">View search gaps and more rankings →</Link>
      </section>

      {/* Content Repository & Operations KPIs */}
      <section className="mt-5 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Repository & System Status
          </h2>
          <Link
            href="/admin/papers"
            className="text-xs font-bold uppercase tracking-wider text-link hover:underline"
          >
            Paper inventory →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Published Papers"
            value={k.papers_published ?? 0}
            hint={`+${(k.papers_new_week ?? 0).toLocaleString("en-IN")} this week · ${(k.papers_total ?? 0).toLocaleString("en-IN")} total`}
            href="/admin/papers"
          />
          <StatCard
            label="Review Queue"
            value={k.review_queue ?? 0}
            hint={`${(k.notes_pending ?? 0).toLocaleString("en-IN")} community notes pending`}
            tone={(k.review_queue ?? 0) > 0 ? "warn" : undefined}
            href="/admin/review"
          />
          <StatCard
            label="Open Reports"
            value={k.open_reports ?? 0}
            hint="Missing papers & error reports"
            tone={(k.open_reports ?? 0) > 0 ? "warn" : undefined}
            href="/admin/reports"
          />
          <StatCard
            label="Crawler Health (24h)"
            value={(k.failed_runs_24h ?? 0) > 0 ? `${k.failed_runs_24h} Failed` : "Healthy"}
            hint="Automated daily sync & branding jobs"
            tone={(k.failed_runs_24h ?? 0) > 0 ? "bad" : undefined}
            href="/admin/runs"
          />
        </div>
      </section>

      {/* SEO & Search Engine Indexing Status */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-2 border-border bg-card px-4 py-3 text-xs shadow-hard-xs">
        <div className="flex items-center gap-3">
          <span className="font-black uppercase tracking-wider">Search Engine SEO:</span>
          <span className="font-bold text-foreground">
            {(k.tracked_pages ?? 0).toLocaleString("en-IN")}
          </span>
          <span className="text-muted-foreground">URLs tracked in sitemaps</span>
          {k.indexed_pages !== undefined && k.indexed_pages > 0 && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
              {k.indexed_pages.toLocaleString("en-IN")} verified indexed
            </span>
          )}
        </div>
        <Link href="/admin/seo" className="font-bold uppercase tracking-wider text-link hover:underline">
          Manage SEO & IndexNow →
        </Link>
      </div>

      <section
        aria-labelledby="last-run"
        className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-2 border-border bg-card px-4 py-3 text-sm shadow-hard-sm"
      >
        <h2 id="last-run" className="text-xs font-black uppercase tracking-wider">
          Last crawl
        </h2>
        {o.last_run ? (
          <>
            <StatusBadge status={o.last_run.status} />
            <span className="font-bold">{o.last_run.source_name}</span>
            <span className="text-muted-foreground">
              {o.last_run.new_count} new · {o.last_run.failed_count} failed ·{" "}
              {fmtDate(o.last_run.finished_at ?? o.last_run.created_at)}
            </span>
            <Link href={`/admin/runs/${o.last_run.id}`} className="text-link underline font-medium">
              Details
            </Link>
          </>
        ) : (
          <span className="text-muted-foreground">No run yet. The sync runs nightly.</span>
        )}
        <Link
          href="/admin/runs"
          className="ml-auto text-xs font-bold uppercase tracking-wider text-link hover:underline"
        >
          All runs →
        </Link>
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <BarChart title="New papers" data={o.charts.new_papers} />
        <BarChart title="Searches" data={o.charts.searches} />
        <BarChart title="Downloads" data={o.charts.downloads} />
      </div>
    </>
  );
}
