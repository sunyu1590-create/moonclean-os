import { NextResponse } from "next/server";
import { getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getBuildInfo(), {
    headers: { "Cache-Control": "public, no-store, max-age=0" },
  });
}
