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
    queue.push({
      type,
      path: extra.path ?? window.location.pathname,
      session_id: sessionId(),
      paper_slug: extra.paper_slug,
      query: extra.query,
      meta: extra.meta,
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
