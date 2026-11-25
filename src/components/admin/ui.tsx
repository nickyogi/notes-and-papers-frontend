import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Select as UiSelect } from "@/components/ui/select";
import { Search } from "lucide-react";
import Link from "next/link";

export { InstantSyncButton } from "@/components/admin/instant-sync-button";

const TONES: Record<string, string> = {
  published: "bg-success/15 text-success",
  succeeded: "bg-success/15 text-success",
  resolved: "bg-success/15 text-success",
  pending_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  queued: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  running: "bg-primary/15 text-link",
  open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
  unpublished: "bg-muted text-muted-foreground",
  dismissed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("whitespace-nowrap font-bold", TONES[status])}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "warn" | "bad" | "good";
  href?: string;
}) {
  const content = (
    <Card className={cn("p-4 transition-all hover:shadow-hard min-w-0 overflow-hidden h-full flex flex-col justify-between", href && "group hover:border-foreground/80")}>
      <div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">{label}</p>
          {href && <span className="text-xs font-black text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>}
        </div>
        <p
          className={cn(
            "mt-2 text-2xl sm:text-3xl font-extrabold tabular-nums tracking-normal break-words leading-tight",
            tone === "good" && "text-emerald-600 dark:text-emerald-400",
            tone === "warn" && "text-amber-600 dark:text-amber-400",
            tone === "bad" && "text-destructive",
          )}
        >
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </p>
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{hint}</p>}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

/** Tiny dependency-free bar chart with a text summary for screen readers. */
export function BarChart({
  title,
  data,
  unit = "days",
}: {
  title: string;
  data: { date: string; count: number }[];
  unit?: "days" | "hours";
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, d) => a + d.count, 0);
  const w = 100 / Math.max(1, data.length);
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {total.toLocaleString("en-IN")} in {data.length} {unit}
        </span>
      </div>
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${title}: ${total} in the last ${data.length} ${unit}`}
        className="mt-3 h-24 w-full"
      >
        {data.map((d, i) => {
          const h = (d.count / max) * 30;
          return (
            <rect
              key={d.date}
              x={i * w + w * 0.15}
              y={31 - h}
              width={w * 0.7}
              height={Math.max(h, d.count ? 0.8 : 0.3)}
              rx={0.4}
              className="fill-primary/80"
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 min-w-0 max-w-full">
      <div className="space-y-1.5 min-w-0 max-w-full">
        <h1 className="text-2xl sm:text-3xl font-display font-black uppercase tracking-wide break-words leading-tight">{title}</h1>
        {description && (
          <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export function SearchForm({
  action,
  q,
  placeholder = "Search...",
  hidden = {},
  children,
}: {
  action: string;
  q?: string;
  placeholder?: string;
  hidden?: Record<string, string | undefined>;
  children?: React.ReactNode;
}) {
  const effectivePlaceholder = placeholder.trim() || "Search...";
  return (
    <form
      action={action}
      role="search"
      className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 min-w-0 max-w-full"
    >
      {Object.entries(hidden).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <div className="relative flex-1 min-w-0 sm:min-w-64">
        <label htmlFor="admin-q" className="sr-only">
          {effectivePlaceholder}
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="admin-q"
          name="q"
          defaultValue={q}
          placeholder={effectivePlaceholder}
          maxLength={120}
          className="h-11 w-full border-2 border-border bg-card pl-10 pr-3.5 text-sm font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none focus-visible:shadow-hard-sm transition-shadow"
        />
      </div>
      {children}
      <button
        type="submit"
        className="h-11 w-full sm:w-auto shrink-0 border-2 border-border bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-hard-sm hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
      >
        <span>Apply</span>
      </button>
    </form>
  );
}

export function Select({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="w-full sm:w-auto sm:min-w-48 shrink-0">
      <label htmlFor={`f-${name}`} className="sr-only">
        {label}
      </label>
      <UiSelect
        id={`f-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className="w-full"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </UiSelect>
    </div>
  );
}

export function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

