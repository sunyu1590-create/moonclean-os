import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./server";
import type { StoreRole } from "@/lib/model";
type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type Denied = { ok: false; error: NextResponse };
type Authorized = { ok: true; supabase: Client; user: User };
type StoreAuthorized = Authorized & { role: StoreRole };
export async function requireUser(): Promise<Denied | Authorized> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return {
      ok: false,
      error: NextResponse.json(
        { error: "未登录或会话已过期" },
        { status: 401 },
      ),
    };
  return { ok: true, supabase, user };
}
export async function requireStore(
  storeId: string,
  roles?: StoreRole[],
): Promise<Denied | StoreAuthorized> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { data, error } = await auth.supabase
    .from("store_members")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || !data)
    return {
      ok: false,
      error: NextResponse.json({ error: "无权访问此店铺" }, { status: 403 }),
    };
  const role = data.role as StoreRole;
  if (roles && !roles.includes(role))
    return {
      ok: false,
      error: NextResponse.json(
        { error: "当前角色无此操作权限" },
        { status: 403 },
      ),
    };
  return { ...auth, role };
}
export function apiError(error: unknown, fallback = "操作失败") {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}
export function rejectCrossOriginMutation(request: Request): NextResponse | null {
  const denied = () =>
    NextResponse.json({ error: "跨站请求被拒绝" }, { status: 403 });
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return denied();

  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host");
  // Reverse proxies may give Next.js an internal request URL while preserving
  // the browser-facing Host and Fetch Metadata headers (as in Codespaces).
  if (origin === url.origin || (host && origin === `${url.protocol}//${host}`))
    return null;
  if (site === "same-origin") return null;
  return denied();
}
