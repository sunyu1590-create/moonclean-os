import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localDemoEnabled, supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  if (localDemoEnabled() && !request.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.next();
  const config = supabaseConfig();
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (!config) {
    if (isApi)
      return NextResponse.json({ error: "Supabase 尚未配置" }, { status: 503 });
    const target = new URL("/login?setup=1", request.url);
    return NextResponse.redirect(target);
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
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
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/advertising/:path*",
    "/products/:path*",
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
