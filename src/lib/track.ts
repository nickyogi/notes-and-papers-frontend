"use client";

/** Fire-and-forget analytics. Never throws and never blocks the UI; failures are silently dropped. */
export type TrackType =
  "page_view" | "search" | "result_click" | "resource_view" | "download_attempt" | "login_required";

const SID_KEY = "np_sid";

function sessionId(): string | undefined {
  try {
    let id = sessionStorage.getItem(SID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

const LANDED_KEY = "np_landed";
const SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\./, "yahoo"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "chatgpt"],
  [/perplexity\.ai$/, "perplexity"],
  [/(^|\.)(t\.me|telegram\.(me|org))$/, "telegram"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
  [/instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "x"],
  [/reddit\.com$/, "reddit"],
  [/(^|\.)quora\.com$/, "quora"],
];

/** Where this visit came from: an explicit ?utm_source=, else the referring site, else "direct". Only the site name is kept. */
function visitSource(): string {
  try {
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    const raw = utm
      ? utm.toLowerCase()
      : document.referrer
        ? new URL(document.referrer).hostname.toLowerCase()
        : "";
    if (!raw) return "direct";
    if (raw === window.location.hostname) return "internal";
    for (const [re, name] of SOURCES) if (re.test(raw)) return name;
    return raw.replace(/^www\./, "").slice(0, 60);
  } catch {
    return "direct";
  }
}

type QueuedEvent = {
  type: TrackType;
  path: string;
  session_id: string | undefined;
  paper_slug?: string;
  query?: string;
  meta?: Record<string, unknown>;
};

// Events are collected and sent together: one request every few seconds (or when the visitor leaves the page, or after a
// handful of events) instead of one request per event. This cut ~100,000 requests a day on a busy day.
const FLUSH_AFTER_MS = 5000;
const FLUSH_AT = 10;
let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function send(path: string, payload: unknown) {
  return fetch(path, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function flush() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (queue.length === 0) return;
  const events = queue.slice(0, 50);
  queue = queue.slice(50);
  void send("/api/backend/events/batch", { events })
    .then((res) => {
      // An older API without the batch route: send them one by one so nothing is lost.
      if (res.status === 404) for (const e of events) void send("/api/backend/events", e).catch(() => undefined);
    })
    .catch(() => undefined);
  if (queue.length > 0) flush();
}

export function track(
  type: TrackType,
  extra: {
    path?: string;
    paper_slug?: string;
    query?: string;
    meta?: Record<string, unknown>;
  } = {},
) {
  try {
    let meta = extra.meta;
    // The first page view of a visit also records where the visitor came from.
    if (type === "page_view" && !sessionStorage.getItem(LANDED_KEY)) {
      sessionStorage.setItem(LANDED_KEY, "1");
      meta = { ...meta, src: visitSource() };
    }
    queue.push({
      type,
      path: extra.path ?? window.location.pathname,
      session_id: sessionId(),
      paper_slug: extra.paper_slug,
      query: extra.query,
      meta,
    });
    if (!listening) {
      listening = true;
      // Leaving the tab or page: send what is waiting now, it may not get another chance.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flush();
      });
      window.addEventListener("pagehide", flush);
    }
    if (queue.length >= FLUSH_AT) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_AFTER_MS);
  } catch {
    /* analytics must never break the page */
  }
}
