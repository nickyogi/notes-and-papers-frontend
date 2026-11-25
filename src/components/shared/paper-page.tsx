import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CheckCircle2, Clock, Download, ShieldCheck, Sparkles } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { FaqAccordion } from "@/components/shared/faq-accordion";
import { JsonLdScript } from "@/components/shared/json-ld";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { PaperList } from "@/components/shared/paper-list";
import { ReportDialog } from "@/components/shared/report-dialog";
import { TrackOnMount } from "@/components/shared/tracker";
import { getLatestPapers, getPaper, getPaperRedirect } from "@/lib/api/public";
import type { PaperSummary } from "@/lib/api/types";
import { kindLabel, paperContext, paperHref, routes, subjectHref } from "@/lib/routes";
import { cleanPreviewExcerpt } from "@/lib/sanitize-preview";
import { buildMetadata, faqLd, learningResourceLd, paperMeta } from "@/lib/seo";
import { getRbseSubjectBySlug, matchRbseSubject } from "@/lib/rbse-channels";

export async function paperMetadata(slug: string) {
  const p = await getPaper(slug);
  if (!p) return { title: "Paper not found", robots: { index: false } };
  const m = paperMeta(p);
  return buildMetadata({
    title: m.title,
    description: m.description,
    path: paperHref(p),
    type: "article",
    keywords: p.meta_keywords,
    // Thin pages (no extracted text and no file metadata) stay out of the index.
    // Link-only pages carry metadata, not file text, by design, so they stay indexable.
    // A page still being prepared keeps its metadata and stays indexable; only an empty shell is kept out.
    noindex: !p.content_excerpt && !p.file_available && !p.title,
  });
}

/**
 * Renders a paper. `canonical` is the URL the current route serves; when the paper belongs somewhere else
 * (exam papers live under /exams/<exam>/<slug>) the visitor gets a permanent redirect to the canonical URL.
 */
export async function PaperPage({
  slug,
  canonical,
}: {
  slug: string;
  canonical: "paper" | { exam: string };
}) {
  const p = await getPaper(slug);
  if (!p) {
    const moved = await getPaperRedirect(slug);
    if (moved) permanentRedirect(routes.paper(moved.new_slug));
    notFound();
  }
  const here = canonical === "paper" ? routes.paper(slug) : routes.examPaper(canonical.exam, slug);
  if (paperHref(p) !== here) permanentRedirect(paperHref(p));
  const selfPath = paperHref(p);
  const m = paperMeta(p);
  const ready = p.file_available;

  const isCourse = Boolean(p.course_slug && p.term_slug);
  const uniName = p.university_name ?? "";
  const uniSlug = p.university_slug ?? "";
  const topic = p.subject_name ?? p.title;
  const cleanedExcerpt = cleanPreviewExcerpt(p.content_excerpt);

  const hasRelated = p.other_years.length > 0 || p.related.length > 0;
  let fallbackPapers: PaperSummary[] = [];
  if (!hasRelated) {
    try {
      const latest = await getLatestPapers(8);
      fallbackPapers = (latest.items ?? []).filter((item) => item.slug !== slug).slice(0, 6);
    } catch {
      fallbackPapers = [];
    }
  }
  // One plain sentence that states what this page is. It is shown above the fold and reused in the FAQ data, because search
  // snippets and AI answers quote exactly this kind of direct statement. Only facts we actually hold are used.
  const where = isCourse
    ? ` for ${p.course_name} ${m.label}${uniName ? ` of ${uniName}` : ""}`
    : p.exam_name && !p.title.includes(p.exam_name)
      ? ` from ${p.exam_name}`
      : "";
  const quickAnswer = [
    `${m.h1} is a ${kindLabel(p.kind).toLowerCase()}${where}${p.year ? `, ${p.year}` : ""}${p.session ? ` (${p.session})` : ""}.`,
    p.paper_code ? `Paper code: ${p.paper_code}.` : "",
    p.language ? `Language: ${p.language}.` : "",
    p.pages ? `The PDF has ${p.pages} pages.` : "",
    "It is free to download with a free account.",
  ]
    .filter(Boolean)
    .join(" ");
  const updatedOn = new Date(p.updated_at);
  const faqs = [
    {
      q: `What is the ${m.h1}?`,
      a: quickAnswer,
    },
    {
      q: `Where can I download the ${m.h1}?`,
      a: `Log in and use the download button on this page to get the ${topic} ${p.year ?? ""} PDF.`.replace(
        /\s+/g,
        " ",
      ),
    },
    {
      q: `Which exam is this paper from?`,
      a: isCourse
        ? `It is a ${kindLabel(p.kind).toLowerCase()} for ${p.course_name} ${m.label} of ${uniName}${p.session ? `, ${p.session} session` : ""}.`
        : `It is a ${kindLabel(p.kind).toLowerCase()} listed under ${p.exam_name ?? "its exam"}${p.year ? `, ${p.year}` : ""}.`,
    },
    ...(p.paper_code
      ? [{ q: `What is the paper code of the ${m.h1}?`, a: `The paper code is ${p.paper_code}.` }]
      : []),
    ...(p.pages
      ? [{ q: `How many pages is the ${m.h1} PDF?`, a: `The PDF has ${p.pages} pages.` }]
      : []),
    ...(p.language
      ? [{ q: `Which language is this paper in?`, a: `This paper is in ${p.language}.` }]
      : []),
    {
      q: `Is this paper free?`,
      a: `Yes. Reading this page is free, and downloading the PDF needs only a free account.`,
    },
  ];
  // For RBSE Board papers, detect nested Class & Subject for rich breadcrumbs
  let rbseClassSlug: string | null = null;
  let rbseClassTitle: string | null = null;
  if (p.exam_slug === "uni-rajasthanboard") {
    const scan = `${p.section ?? ""} ${p.title}`;
    if (/class\s*10/i.test(scan)) {
      rbseClassSlug = "class-10";
      rbseClassTitle = "Class 10th Secondary";
    } else if (/class\s*12/i.test(scan)) {
      rbseClassSlug = "class-12";
      rbseClassTitle = "Class 12th Sr. Secondary";
    } else if (/class\s*11/i.test(scan)) {
      rbseClassSlug = "class-11";
      rbseClassTitle = "Class 11th";
    } else if (/class\s*9/i.test(scan)) {
      rbseClassSlug = "class-9";
      rbseClassTitle = "Class 9th";
    }
  }
  const rbseSubj = rbseClassSlug
    ? getRbseSubjectBySlug(matchRbseSubject(p.title, p.paper_code ?? undefined))
    : null;

  const crumbs = isCourse
    ? [
        { name: "Home", path: "/" },
        {
          name: uniName || "Universities",
          path: uniSlug ? routes.university(uniSlug) : routes.universities,
        },
        { name: p.course_name!, path: routes.course(uniSlug, p.course_slug!) },
        { name: m.label, path: routes.term(uniSlug, p.course_slug!, p.term_slug!) },
        { name: p.subject_name ?? "Paper", path: subjectHref(p) },
        { name: p.year ? String(p.year) : "Paper", path: selfPath },
      ]
    : p.exam_slug === "uni-rajasthanboard" && rbseClassSlug && rbseSubj
      ? [
          { name: "Home", path: "/" },
          { name: "Rajasthan Board (RBSE)", path: routes.exam(p.exam_slug) },
          { name: rbseClassTitle!, path: `/rajasthanboard/${rbseClassSlug}` },
          {
            name: rbseSubj.name,
            path: `/rajasthanboard/${rbseClassSlug}/${rbseSubj.slug}`,
          },
          { name: p.title, path: selfPath },
        ]
      : [
          { name: "Home", path: "/" },
          { name: "Exams", path: routes.exams },
          ...(p.exam_slug
            ? [{ name: p.exam_name ?? p.exam_slug, path: routes.exam(p.exam_slug) }]
            : []),
          { name: p.title, path: selfPath },
        ];

  const metadataDetails = (
    <dl className="grid grid-cols-2 border-2 border-border bg-card shadow-hard sm:grid-cols-3 lg:grid-cols-5 [&>div]:border-b-2 [&>div]:border-r-2 [&>div]:border-border [&>div]:p-3.5 sm:[&>div]:p-5">
      {[
        ["Year", p.year ? String(p.year) : null],
        ["Session", p.session],
        ["Paper code", p.paper_code],
        ["Language", p.language],
        ["Type", kindLabel(p.kind)],
        ["Pages", p.pages ? String(p.pages) : null],
      ]
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <dt className="eyebrow text-muted-foreground">{k}</dt>
            <dd className="mt-1 break-words text-base font-bold sm:mt-2 sm:font-display sm:text-3xl sm:font-normal sm:uppercase sm:leading-[1.2]">
              {v}
            </dd>
          </div>
        ))}
    </dl>
  );

  return (
    <article className="space-y-8 sm:space-y-20">
      <TrackOnMount type="resource_view" paperSlug={slug} />
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-5 sm:gap-8">
        <div className="space-y-3 sm:space-y-4">
          <p className="eyebrow inline-block bg-accent px-2 py-0.5 text-accent-foreground">
            {kindLabel(p.kind)}
            {p.year ? ` · ${p.year}` : ""}
          </p>
          <h1 className="max-w-6xl text-2xl sm:text-5xl lg:text-7xl break-words leading-tight">
            {m.h1}
          </h1>
          <p className="text-sm sm:text-xl text-muted-foreground">
            {paperContext(p)}
            {isCourse && uniName ? ` · ${uniName}` : ""}
          </p>
        </div>

        <div className="order-3 hidden sm:order-2 sm:block">{metadataDetails}</div>
        <details className="order-3 border border-border bg-card p-3 sm:hidden">
          <summary className="cursor-pointer py-2 text-sm font-bold">Paper details</summary>
          {metadataDetails}
        </details>

        {/* PREMIUM HIGH-IMPACT DOWNLOAD ACTION HERO */}
        <section
          aria-label="Download paper"
          className="order-2 overflow-hidden border border-border bg-card shadow-hard-sm sm:order-3 sm:border-2 sm:shadow-hard-lg"
        >
          {/* TOP CONTRAST HEADER RIBBON */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border bg-muted/60 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 border-2 border-border bg-primary px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-hard-sm">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Verified Vault Copy
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 border border-border/80 bg-background px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-foreground">
                <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
                Clean &amp; Watermark-Free
              </span>
            </div>

            <div className="flex items-center gap-2">
              <BookmarkButton slug={slug} size="sm" />
              <ReportDialog slug={slug} variant="outline" size="sm" />
            </div>
          </div>

          {/* MAIN ACTION BODY */}
          <div className="grid gap-4 p-4 sm:gap-6 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-8">
            <div className="hidden space-y-4 sm:block">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-2xl uppercase leading-none tracking-wider sm:text-3xl text-foreground">
                    {ready ? "Instant PDF Download" : "PDF In Preparation"}
                  </h2>
                  {p.pages && (
                    <span className="border-2 border-border bg-accent px-2 py-0.5 text-xs font-bold uppercase text-accent-foreground shadow-hard-sm">
                      {p.pages} Pages
                    </span>
                  )}
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {ready
                    ? "Complete official question paper. Cleaned, formatted and optimized for fast mobile reading or high-quality printing."
                    : "We are currently formatting this official question paper with our clean cover pages. It will be ready shortly."}
                </p>
              </div>

              {/* TRUST HIGHLIGHTS ROW */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs font-bold uppercase tracking-wide text-foreground">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  Fast Direct CDN
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  Print-Ready Vector
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  100% Free
                </span>
              </div>
            </div>

            {/* ACTION BUTTON GROUP */}
            <div className="flex flex-col gap-2.5 sm:min-w-[240px]">
              {ready ? (
                <Link
                  href={routes.download(slug)}
                  prefetch={false}
                  className="inline-flex h-13 sm:h-14 w-full items-center justify-center gap-3 border-2 border-border bg-primary px-7 text-sm sm:text-base font-bold uppercase tracking-wider text-primary-foreground shadow-hard transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg hover:bg-primary/95 active:translate-x-0.5 active:translate-y-0.5"
                >
                  <Download className="size-5 shrink-0" aria-hidden="true" />
                  <span>Download PDF</span>
                </Link>
              ) : (
                <div className="inline-flex h-13 sm:h-14 w-full items-center justify-center gap-2.5 border-2 border-border bg-muted px-7 text-xs sm:text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <Clock className="size-4.5 shrink-0" aria-hidden="true" />
                  <span>PDF Coming Soon</span>
                </div>
              )}

              <p className="hidden text-center font-mono text-[11px] font-medium text-muted-foreground sm:block">
                ⚡ Direct link · Free account
              </p>
            </div>
          </div>
        </section>
      </header>

      <section aria-label="Quick answer" className="max-w-5xl space-y-1.5">
        <p className="text-base font-medium leading-relaxed sm:text-xl">{quickAnswer}</p>
        <p className="font-mono text-xs text-muted-foreground">
          Last updated{" "}
          <time dateTime={updatedOn.toISOString().slice(0, 10)}>
            {updatedOn.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </time>
        </p>
      </section>

      <details className="max-w-5xl border-b border-border pb-4">
        <summary className="cursor-pointer py-2">
          <h2 id="about-heading" className="inline text-lg sm:text-2xl">
            About this paper
          </h2>
        </summary>
        <p className="mt-3 text-sm sm:text-lg leading-relaxed text-muted-foreground">
          This is the {p.year ? `${p.year} ` : ""}
          {topic} {kindLabel(p.kind).toLowerCase()}
          {isCourse
            ? ` for ${p.course_name} ${m.label}${uniName ? ` of ${uniName}` : ""}`
            : p.exam_name
              ? ` (${p.exam_name})`
              : ""}
          . Practise with it to understand the exam pattern, the marking scheme and the questions
          that are asked again and again.{" "}
          <Link href={subjectHref(p)} className="text-link underline">
            {isCourse ? `See all ${topic} papers` : `More ${p.exam_name ?? "exam"} papers`}
          </Link>
          .
        </p>
      </details>

      {cleanedExcerpt && (
        <details className="max-w-5xl border-b border-border pb-4">
          <summary className="cursor-pointer py-2">
            <h2 id="excerpt-heading" className="inline text-lg sm:text-2xl">
              Paper preview
            </h2>
          </summary>
          <blockquote
            lang={/[ऀ-ॿ]/.test(cleanedExcerpt) ? "hi" : undefined}
            className="whitespace-pre-line border-2 border-border bg-card p-5 shadow-hard-sm text-sm leading-relaxed"
          >
            {cleanedExcerpt}
          </blockquote>
        </details>
      )}

      {p.other_years.length > 0 && (
        <section aria-labelledby="years-heading" className="space-y-6">
          <h2 id="years-heading" className="text-3xl sm:text-4xl">
            Other years of {topic}
          </h2>
          <PaperList papers={p.other_years} />
        </section>
      )}

      {p.related.length > 0 && (
        <section aria-labelledby="related-heading" className="space-y-6">
          <h2 id="related-heading" className="text-3xl sm:text-4xl">
            Related papers
          </h2>
          <PaperList papers={p.related} />
        </section>
      )}

      {!hasRelated && fallbackPapers.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="hidden eyebrow bg-primary px-2.5 py-1 text-primary-foreground font-bold tracking-wider shadow-hard-sm sm:inline-block">
                Keep Practicing
              </span>
              <h2
                id="recent-heading"
                className="text-3xl sm:text-4xl font-display uppercase tracking-wider"
              >
                Recent Question Papers
              </h2>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 border-2 border-border bg-card px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-foreground shadow-hard-sm hover:bg-primary hover:shadow-hard transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              Browse All Papers →
            </Link>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Explore recent question papers added across university courses and exam categories.
          </p>
          <PaperList papers={fallbackPapers} />
        </section>
      )}

      <details className="max-w-5xl border-b border-border pb-4">
        <summary className="cursor-pointer py-2">
          <h2 id="faq-heading" className="inline text-lg sm:text-2xl">
            Questions
          </h2>
        </summary>
        <FaqAccordion faqs={faqs} />
      </details>

      {/* SUGGESTIONS & NEXT STEPS */}
      <section className="space-y-4 border-t border-border pt-5 sm:space-y-5 sm:border-t-2 sm:pt-10">
        <div className="space-y-1">
          <span className="hidden eyebrow bg-primary px-2.5 py-1 text-primary-foreground font-bold tracking-wider shadow-hard-sm sm:inline-block">
            Keep Practicing
          </span>
          <h2 className="text-2xl sm:text-3xl font-display uppercase tracking-wider">
            More papers
          </h2>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Explore more question papers, syllabus streams, and exam collections.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={subjectHref(p)}
            className="inline-flex items-center gap-2 border-2 border-border bg-card px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground shadow-hard-sm transition-all hover:bg-primary hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5"
          >
            {isCourse ? `All ${topic} question papers →` : `All ${p.exam_name ?? "exam"} papers →`}
          </Link>
          {isCourse && p.university_slug && p.course_slug && (
            <Link
              href={routes.course(p.university_slug, p.course_slug)}
              className="inline-flex items-center gap-2 border-2 border-border bg-card px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground shadow-hard-sm transition-all hover:bg-primary hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5"
            >
              All Semesters of {p.course_name} →
            </Link>
          )}
          <Link
            href="/search"
            className="inline-flex items-center gap-2 border-2 border-border bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-hard-sm transition-all hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5"
          >
            Search More Papers →
          </Link>
        </div>
      </section>

      <JsonLdScript data={[learningResourceLd(p, m.title, m.description), faqLd(faqs)]} />
    </article>
  );
}
