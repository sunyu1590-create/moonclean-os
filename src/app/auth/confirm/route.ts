import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (!token_hash || !type)
    return NextResponse.redirect(
      new URL("/login?error=verification", request.url),
    );
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
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
