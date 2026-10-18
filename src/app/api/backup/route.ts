import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import packageInfo from "../../../../package.json";
import { BACKUP_STORE_TABLES } from "@/lib/backup-manifest";
import { requireUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BackupClient = SupabaseClient;

async function loadStoreTable(
  supabase: BackupClient,
  table: (typeof BACKUP_STORE_TABLES)[number],
  storeId: string,
) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("store_id", storeId)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`备份 ${table} 失败：${error.message}`);
    rows.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;

  const { data: ownedMemberships, error: membershipError } = await auth.supabase
    .from("store_members")
    .select("store_id")
    .eq("user_id", auth.user.id)
    .eq("role", "owner");
  if (membershipError)
    return NextResponse.json(
      { error: `读取店铺列表失败：${membershipError.message}` },
      { status: 500 },
    );

  const storeIds = [...new Set((ownedMemberships || []).map((row) => row.store_id))];
  if (!storeIds.length)
    return NextResponse.json(
      { error: "完整备份仅限店铺 Owner 操作；当前账号没有可备份的店铺。" },
      { status: 403 },
    );

  try {
    const [{ data: stores, error: storesError }, { data: profile, error: profileError }] =
      await Promise.all([
        auth.supabase.from("stores").select("*").in("id", storeIds),
        auth.supabase
          .from("profiles")
          .select("id,display_name,avatar_url,created_at,updated_at")
          .eq("id", auth.user.id)
          .maybeSingle(),
      ]);
    if (storesError) throw new Error(`读取店铺资料失败：${storesError.message}`);
    if (profileError) throw new Error(`读取账号资料失败：${profileError.message}`);

    const storeData = await Promise.all(
      (stores || []).map(async (store) => {
        const [membersResult, tableRows] = await Promise.all([
          auth.supabase
            .from("store_members")
            .select("id,store_id,user_id,role,created_at")
            .eq("store_id", store.id)
            .order("id", { ascending: true }),
          Promise.all(
            BACKUP_STORE_TABLES.map((table) =>
              loadStoreTable(auth.supabase, table, store.id),
            ),
          ),
        ]);
        if (membersResult.error)
          throw new Error(`备份成员记录失败：${membersResult.error.message}`);
        return {
          store,
          members: membersResult.data || [],
          tables: Object.fromEntries(
            BACKUP_STORE_TABLES.map((table, index) => [table, tableRows[index]]),
          ),
        };
      }),
    );

    const rowCounts: Record<string, number> = {
      profiles: profile ? 1 : 0,
      stores: storeData.length,
    };
    for (const item of storeData) {
      rowCounts.store_members = (rowCounts.store_members || 0) + item.members.length;
      for (const table of BACKUP_STORE_TABLES) {
        rowCounts[table] =
          (rowCounts[table] || 0) + item.tables[table].length;
      }
    }

    const backup = {
      format: "moonclean-os-full-backup",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      applicationVersion: packageInfo.version,
      account: { id: auth.user.id },
      profile,
      stores: storeData,
      rowCounts,
      excluded: [
        "Supabase Authentication 密码与会话；迁移到新认证服务时需重新邀请用户或重设密码。",
        "私有 schema 中的平台 API 密钥、访问令牌和刷新令牌；出于安全考虑不导出，迁移后需重新配置。",
      ],
    };
    const filename = `moonclean-full-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成完整备份失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
