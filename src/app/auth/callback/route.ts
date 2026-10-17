import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code)
    return NextResponse.redirect(
      new URL("/login?error=missing-code", request.url),
    );
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return NextResponse.redirect(
      new URL(safeNext(url.searchParams.get("next")), request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=verification", request.url),
    );
  }
}
