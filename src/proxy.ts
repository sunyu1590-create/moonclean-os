import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localDemoEnabled, supabaseConfig } from "@/lib/supabase/config";
import { shouldBypassAuthForLocalWorkspace } from "@/lib/local-workspace";
import { getSupabaseAuthCookieOptions, SESSION_POLICY_COOKIE } from "@/lib/auth-session-policy";

export async function proxy(request: NextRequest) {
  if (shouldBypassAuthForLocalWorkspace(
    request.nextUrl.pathname,
    request.cookies.get("moonclean-data-mode")?.value,
    localDemoEnabled(),
  ))
    return NextResponse.next();
  const config = supabaseConfig();
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (!config) {
    if (isApi)
      return NextResponse.json({ error: "Supabase 尚未配置" }, { status: 503 });
    const target = new URL("/login?setup=1", request.url);
    return NextResponse.redirect(target);
  }
  // API routes authenticate themselves through requireUser/requireStore. Avoid
  // a second concurrent getUser() refresh in middleware for every API request.
  if (isApi) return NextResponse.next();
  let response = NextResponse.next({ request });
  const sessionPolicy = request.cookies.get(SESSION_POLICY_COOKIE)?.value;
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: getSupabaseAuthCookieOptions(sessionPolicy, process.env.NODE_ENV === "production"),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items, headers) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    if (isApi)
      return NextResponse.json(
        { error: "登录已过期，请重新登录" },
        { status: 401 },
      );
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const { data: claimsData } = await supabase.auth.getClaims();
  const sessionId = typeof claimsData?.claims?.session_id === "string" ? claimsData.claims.session_id : null;
  if (sessionId) {
    const { data: deviceSession, error: sessionError } = await supabase.from("user_device_sessions")
      .select("revoked_at,remember_until")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (sessionError) {
      await supabase.auth.signOut({ scope: "local" });
      const login = new URL("/login?error=session-check", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      const redirect = NextResponse.redirect(login);
      response.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
      redirect.cookies.set(SESSION_POLICY_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
      return redirect;
    }
    const revoked = Boolean(deviceSession?.revoked_at);
    const expired = Boolean(deviceSession?.remember_until && Date.parse(deviceSession.remember_until) <= Date.now());
    if (revoked || expired) {
      if (expired && !revoked)
        await supabase.from("user_device_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", user.id).eq("session_id", sessionId);
      await supabase.auth.signOut({ scope: "local" });
      const login = new URL(revoked ? "/login?error=session-revoked" : "/login?error=session-expired", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      const redirect = NextResponse.redirect(login);
      response.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
      redirect.cookies.set(SESSION_POLICY_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
      return redirect;
    }
  }
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/advertising/:path*",
    "/products/:path*",
    "/orders/:path*",
    "/inventory/:path*",
    "/tasks/:path*",
    "/notes/:path*",
    "/ai-chat/:path*",
    "/ai-settings/:path*",
    "/copilot/:path*",
    "/competitors/:path*",
    "/experiments/:path*",
    "/motion/:path*",
    "/service/:path*",
    "/product-insights/:path*",
    "/pricing/:path*",
    "/after-sales/:path*",
    "/reports/:path*",
    "/finance/:path*",
    "/data/:path*",
    "/settings/:path*",
    "/account/:path*",
    "/migrate/:path*",
    "/integrations/:path*",
    "/sync-center/:path*",
    "/api/integrations/:path*",
    "/api/stores/:path*",
    "/api/account/:path*",
  ],
};
