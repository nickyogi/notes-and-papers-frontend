import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/session";
import { API_URL } from "@/lib/env";

/** How many papers a visitor may download before the site asks them to log in. */
const FREE_DOWNLOADS = 2;
const FREE_COOKIE = "np_free";

/**
 * GET /api/download/<slug>
 * Binary PDF streaming endpoint. Signed-in visitors download without limit. A signed-out visitor gets FREE_DOWNLOADS papers
 * first (counted in a cookie; clearing it resets the count, which is accepted), then is sent to the login page.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const token = await getAccessToken();

  let used = 0;
  if (!token) {
    const store = await cookies();
    used = Number.parseInt(store.get(FREE_COOKIE)?.value ?? "0", 10) || 0;
    if (used >= FREE_DOWNLOADS) return toLogin(req, slug);
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (process.env.REVALIDATE_SECRET) headers["X-Free-Download"] = process.env.REVALIDATE_SECRET;
  else return toLogin(req, slug); // no shared secret configured: free downloads are off

  const upstream = await fetch(`${API_URL}/papers/${encodeURIComponent(slug)}/download`, {
    headers,
    redirect: "manual",
    cache: "no-store",
  }).catch(() => null);

  // A signed-out visitor's count only goes up when a file is really sent.
  const free = token ? null : { used: used + 1 };

  if (upstream?.status === 200 && upstream.body) return pdf(upstream.body, slug, free);

  const target = upstream?.headers.get("location");
  if (upstream && upstream.status >= 300 && upstream.status < 400 && target) {
    const file = await fetch(target, { cache: "no-store" }).catch(() => null);
    if (file?.ok && file.body) return pdf(file.body, slug, free);
    return unavailable();
  }
  if (upstream?.status === 404) {
    return new NextResponse("This PDF is still being prepared. Please try again later.", {
      status: 404,
    });
  }
  if (upstream?.status === 401) return toLogin(req, slug);
  return unavailable();
}

function toLogin(req: Request, slug: string) {
  const login = new URL("/login", req.url);
  login.searchParams.set("next", `/papers/${slug}/download`);
  return NextResponse.redirect(login);
}

function unavailable() {
  return new NextResponse("The file is temporarily unavailable. Please try again.", {
    status: 502,
  });
}

function pdf(body: ReadableStream<Uint8Array>, slug: string, free: { used: number } | null) {
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${slug}.pdf"`,
    "Cache-Control": "no-store",
  });
  if (free) {
    headers.set("X-Free-Downloads-Left", String(Math.max(0, FREE_DOWNLOADS - free.used)));
    headers.append(
      "Set-Cookie",
      `${FREE_COOKIE}=${free.used}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; SameSite=Lax; Secure`,
    );
  }
  return new Response(body, { headers });
}
