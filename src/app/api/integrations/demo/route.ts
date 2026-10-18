import { NextResponse } from "next/server";
import { requireUser, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase.rpc("create_mock_store");
  if (error) return apiError(error);
  return NextResponse.json({ storeId: data }, { status: 201 });
}
