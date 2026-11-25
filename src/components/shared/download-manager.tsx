"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck, Loader2, RefreshCw, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PdfPreview } from "@/components/shared/pdf-preview";
import { PaperList } from "@/components/shared/paper-list";
import { Button } from "@/components/ui/button";
import type { PaperDetail, PaperSummary } from "@/lib/api/types";
import { rememberDownload } from "@/lib/local-downloads";
import { paperContext, paperHref, routes } from "@/lib/routes";
import { track } from "@/lib/track";

export function DownloadManager({
  paper,
  suggestedPapers = [],
}: {
  paper: PaperDetail;
  suggestedPapers?: PaperSummary[];
}) {
  const [progress, setProgress] = useState(15);
  const [statusMessage, setStatusMessage] = useState("Connecting to academic vault...");
  const [downloaded, setDownloaded] = useState(false);
  const [downloadedBlobUrl, setDownloadedBlobUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (downloadedBlobUrl) {
        URL.revokeObjectURL(downloadedBlobUrl);
      }
    };
  }, [downloadedBlobUrl]);

  // Trigger download flow
  const triggerFileDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError(null);
    track("download_attempt", { paper_slug: paper.slug });

    try {
      const res = await fetch(`/api/download/${paper.slug}`, {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (res.redirected && new URL(res.url).pathname.startsWith("/login")) {
        track("login_required", { paper_slug: paper.slug });
        window.location.assign(res.url);
        return;
      }

      if (res.status === 404) {
        throw new Error("This PDF is still being prepared. Please try again later.");
      }

      const isPdf = (res.headers.get("content-type") ?? "").includes("pdf");
      if (!res.ok || !isPdf) {
        throw new Error("Could not download the PDF at this moment. Please try again.");
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setDownloadedBlobUrl(blobUrl);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${paper.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Remember it in this browser (not on the server) so the visitor can find it again under "My downloads".
      rememberDownload({ slug: paper.slug, title: paper.title, href: paperHref(paper) });

      setDownloaded(true);
      setProgress(100);
      setStatusMessage("Verified copy saved to your device!");
      const left = res.headers.get("x-free-downloads-left");
      toast.success(
        left === null
          ? "Download started"
          : left === "0"
            ? "Download started. That was your last free download. Log in to keep downloading."
            : `Download started. ${left} free download left. Log in for unlimited downloads.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed. Please try again.";
      setDownloadError(message);
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  }, [paper]);

  // Animated preparation loader
  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;

    if (!downloaded) {
      timer1 = setTimeout(() => {
        setProgress(45);
        setStatusMessage("Securing watermark-free academic copy...");
      }, 700);

      timer2 = setTimeout(() => {
        setProgress(80);
        setStatusMessage("Compiling verification metadata...");
      }, 1500);

      timer3 = setTimeout(() => {
        setProgress(100);
        setStatusMessage("Starting file transfer...");
        void triggerFileDownload();
      }, 2300);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [paper.slug, downloaded, triggerFileDownload]);

  function copyShareLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.origin + paperHref(paper));
      toast.success("Paper link copied to clipboard!");
    }
  }

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* HEADER / STATUS CARD */}
      <section className="border border-border bg-card p-4 sm:border-2 sm:p-10 sm:shadow-hard">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-4">
            <span className="eyebrow flex items-center gap-2 border-2 border-border bg-primary px-3 py-1 font-bold shadow-hard-sm">
              <FileCheck className="size-4" aria-hidden="true" />
              {downloaded ? "Download started" : "Preparing PDF"}
            </span>
            <span className="hidden text-xs font-bold uppercase tracking-wider text-muted-foreground sm:inline">
              Official Vault Repository
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-display uppercase tracking-wider sm:text-5xl lg:text-6xl break-words leading-tight">
              {paper.title}
            </h1>
            <p className="text-sm sm:text-lg text-muted-foreground">
              {paperContext(paper)}
              {paper.university_name ? ` · ${paper.university_name}` : ""}
            </p>
          </div>

          {/* Paper Metadata Badges */}
          <div className="hidden gap-3 sm:grid sm:grid-cols-4 pt-2">
            <div className="border-2 border-border bg-background p-3">
              <span className="eyebrow block text-muted-foreground">Year</span>
              <span className="font-display text-2xl uppercase">{paper.year ?? "N/A"}</span>
            </div>
            {paper.session && (
              <div className="border-2 border-border bg-background p-3">
                <span className="eyebrow block text-muted-foreground">Session</span>
                <span className="font-display text-2xl uppercase">{paper.session}</span>
              </div>
            )}
            {paper.paper_code && (
              <div className="border-2 border-border bg-background p-3">
                <span className="eyebrow block text-muted-foreground">Paper Code</span>
                <span className="font-display text-2xl uppercase">{paper.paper_code}</span>
              </div>
            )}
            <div className="border-2 border-border bg-background p-3">
              <span className="eyebrow block text-muted-foreground">Format</span>
              <span className="font-display text-2xl uppercase">
                {paper.pages ? `${paper.pages} Pages PDF` : "Clean PDF"}
              </span>
            </div>
          </div>

          {/* ANIMATED PROGRESS LOADER */}
          {!downloaded && !downloadError && (
            <div
              role="status"
              className="space-y-3 border border-border bg-muted/40 p-4 sm:border-2 sm:p-6 sm:shadow-hard-sm"
            >
              <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-foreground" />
                  <span className="sm:hidden">Preparing download…</span>
                  <span className="hidden sm:inline">{statusMessage}</span>
                </span>
                <span className="hidden font-display text-lg sm:inline">{progress}%</span>
              </div>
              <div className="h-5 w-full overflow-hidden border-2 border-border bg-card p-0.5 shadow-inner">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Your PDF is being streamed from our high-speed vault. If prompted, please allow
                downloads in your browser.
              </p>
            </div>
          )}

          {downloadError && (
            <div role="alert" className="space-y-3 border border-destructive p-4">
              <p className="text-sm text-destructive">{downloadError}</p>
              <Button onClick={() => void triggerFileDownload()} disabled={isDownloading}>
                Retry download
              </Button>
            </div>
          )}
          {/* COOL CELEBRATORY MESSAGE WHEN DOWNLOADED */}
          {downloaded && (
            <div className="space-y-4 border-2 border-border bg-primary p-6 text-primary-foreground shadow-hard sm:p-8">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center border-2 border-border bg-card text-foreground shadow-hard-sm">
                  <Sparkles className="size-7 text-primary" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase tracking-wide sm:text-3xl">
                    Download started
                  </h2>
                  <p className="text-sm font-medium opacity-90 sm:text-base">
                    Check your browser downloads.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:flex-wrap">
                <Button
                  onClick={() => void triggerFileDownload()}
                  disabled={isDownloading}
                  className="border-2 border-border bg-card text-foreground font-bold uppercase tracking-wider shadow-hard-sm hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5"
                >
                  <RefreshCw className={`mr-2 size-4 ${isDownloading ? "animate-spin" : ""}`} />
                  Download again
                </Button>
                <Link
                  href={routes.paper(paper.slug)}
                  className="inline-flex h-11 items-center gap-2 border-2 border-border bg-background px-5 text-sm font-bold uppercase tracking-wider text-foreground shadow-hard-sm hover:bg-card active:translate-x-0.5 active:translate-y-0.5"
                >
                  <ArrowLeft className="size-4" />
                  Back to paper
                </Link>
                <Button
                  variant="outline"
                  onClick={copyShareLink}
                  className="border-2 border-border bg-card text-foreground font-bold uppercase tracking-wider shadow-hard-sm hover:shadow-hard"
                >
                  <Share2 className="mr-2 size-4" />
                  Share paper
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* LIVE PREVIEW SECTION */}
      {paper.file_available && (
        <section aria-labelledby="live-preview-heading" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-3">
            <div className="space-y-1">
              <p className="hidden eyebrow bg-accent px-2 py-0.5 text-accent-foreground font-bold tracking-wider shadow-hard-sm sm:inline-block">
                Document Viewer
              </p>
              <h2
                id="live-preview-heading"
                className="text-3xl sm:text-4xl font-display uppercase tracking-wider"
              >
                Preview
              </h2>
            </div>
            <p className="hidden text-sm text-muted-foreground font-medium sm:block">
              Read or solve questions directly in your browser without leaving this page.
            </p>
          </div>

          <PdfPreview
            slug={paper.slug}
            title={paper.title}
            blobUrl={downloadedBlobUrl}
            defaultOpen={false}
            autoOpenBlob={false}
            pages={paper.pages}
          />
        </section>
      )}

      {/* SUGGESTIONS & RELATED EXPLORATION */}
      <section className="space-y-5 border-t-2 border-border pt-10">
        <div className="space-y-1">
          <span className="hidden eyebrow bg-primary px-2.5 py-1 text-primary-foreground font-bold tracking-wider shadow-hard-sm sm:inline-block">
            Keep Practicing
          </span>
          <h2 className="text-2xl sm:text-3xl font-display uppercase tracking-wider">
            More papers
          </h2>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Download adjacent exam years or explore syllabus-related subjects.
          </p>
        </div>

        {suggestedPapers && suggestedPapers.length > 0 && (
          <div className="pt-2">
            <PaperList papers={suggestedPapers} mobilePreview />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {paper.subject_name && (
            <Link
              href={`/search?q=${encodeURIComponent(paper.subject_name)}`}
              className="inline-flex items-center gap-2 border-2 border-border bg-card px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground shadow-hard-sm transition-all hover:bg-primary hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5"
            >
              All years of {paper.subject_name} →
            </Link>
          )}
          {paper.course_name && paper.university_slug && paper.course_slug && (
            <Link
              href={routes.course(paper.university_slug, paper.course_slug)}
              className="inline-flex items-center gap-2 border-2 border-border bg-card px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground shadow-hard-sm transition-all hover:bg-primary hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5"
            >
              All semesters of {paper.course_name} →
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
    </div>
  );
}
