import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const migrations = [
  "202610170001_core.sql",
  "202610170002_security_and_api.sql",
  "202610170003_mutations.sql",
  "202610170004_hardening.sql",
  "202610170005_trigger_permissions.sql",
  "202610180001_mock_sync.sql",
  "202610180002_refund_guard.sql",
  "202610180003_operations.sql",
  "20261018134430_recommendation_task_tracking.sql",
  "202610190001_image_import.sql",
  "20261019001234_operations_workbench.sql",
  "20261022150000_account_avatar_member_lookup.sql",
  "20261023110000_user_device_sessions.sql",
  "20261023111500_restrict_revoked_device_sessions.sql",
  "20261024055552_note_center.sql",
  "20261024055642_note_center_query_tuning.sql",
  "20261025030729_pdd_oauth_credentials.sql",
  "20261025114815_stabilize_device_sessions.sql",
  "20261025115811_secure_device_session_updates.sql",
  "20261025122433_enforce_remembered_session_deadline.sql",
  "20261026132311_moonclean_load_test_bucket.sql",
  "20261029070331_cloud_load_test_account_allowlist.sql",
];
const repeatableMigrations = migrations.filter((name) => ![
  "20261023110000_user_device_sessions.sql",
  "20261023111500_restrict_revoked_device_sessions.sql",
  "20261026132311_moonclean_load_test_bucket.sql",
].includes(name));
const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create schema storage; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}'::jsonb,raw_user_meta_data jsonb default '{}'::jsonb);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema storage to authenticated,anon; grant select,insert,delete on storage.objects to authenticated; grant select,insert,update on storage.buckets to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; grant execute on function auth.jwt() to authenticated,anon;`);
  for (const name of migrations)
    await db.exec(
      file(`supabase/migrations/${name}`).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
}, 30_000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL 迁移与权限", () => {
  it("迁移可重复执行", async () => {
    for (const name of repeatableMigrations)
      await db.exec(
        file(`supabase/migrations/${name}`).replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
    const result = await db.query<{ count: string }>(
      "select count(*)::text as count from pg_tables where schemaname='public' and tablename in ('stores','store_members','products','skus','sku_costs','daily_metrics','ad_metrics','sku_daily_metrics','audit_logs')",
    );
    expect(result.rows[0].count).toBe("9");
  }, 30_000);
  it("金额、重复日期和历史成本约束成立", async () => {
    await db.exec(file("supabase/tests/constraints.sql"));
  }, 15_000);
  it("跨店铺、Viewer、Editor、Admin 越权均被拒绝", async () => {
    await db.exec(file("supabase/tests/rls.sql"));
  }, 15_000);
  it("模拟同步幂等、并发保护、租户隔离和 Viewer 限权", async () => {
    await db.exec(file("supabase/tests/mock_sync.sql"));
  }, 15_000);
  it("库存和待办保持租户隔离与权限约束", async () => {
    await db.exec(file("supabase/tests/operations.sql"));
  }, 15_000);
  it("拼多多 OAuth 凭据函数仅允许服务端角色调用", async () => {
    const result = await db.query<{ anon_exec: boolean; authenticated_exec: boolean; service_exec: boolean }>(
      `select has_function_privilege('anon','public.save_pdd_oauth_credentials(uuid,uuid,bytea,bytea,bytea,bytea,timestamptz)','EXECUTE') as anon_exec,
        has_function_privilege('authenticated','public.save_pdd_oauth_credentials(uuid,uuid,bytea,bytea,bytea,bytea,timestamptz)','EXECUTE') as authenticated_exec,
        has_function_privilege('service_role','public.save_pdd_oauth_credentials(uuid,uuid,bytea,bytea,bytea,bytea,timestamptz)','EXECUTE') as service_exec`,
    );
    expect(result.rows[0]).toEqual({ anon_exec: false, authenticated_exec: false, service_exec: true });
  }, 15_000);
  it("新增工作台保持店铺隔离、Viewer 只读、身份不可伪造及历史不可覆盖", async () => {
    await db.exec(file("supabase/tests/workspace.sql"));
  }, 15_000);
  it("设备会话只允许已登录用户执行登记与撤销", async () => {
    const result = await db.query<{ device_id_nullable: boolean; remember_until_nullable: boolean; active_definer: boolean; active_anon: boolean; active_authenticated: boolean; register_anon: boolean; register_authenticated: boolean; register_definer: boolean; revoke_anon: boolean; revoke_authenticated: boolean; revoke_definer: boolean }>(
      `select (select is_nullable = 'YES' from information_schema.columns where table_schema='public' and table_name='user_device_sessions' and column_name='device_id') as device_id_nullable,
        (select is_nullable = 'YES' from information_schema.columns where table_schema='public' and table_name='user_device_sessions' and column_name='remember_until') as remember_until_nullable,
        (select prosecdef from pg_proc where oid='public.current_device_session_active()'::regprocedure) as active_definer,
        has_function_privilege('anon','public.current_device_session_active()','EXECUTE') as active_anon,
        has_function_privilege('authenticated','public.current_device_session_active()','EXECUTE') as active_authenticated,
        has_function_privilege('anon','public.register_current_device_session_for_device(uuid,text,text)','EXECUTE') as register_anon,
        has_function_privilege('authenticated','public.register_current_device_session_for_device(uuid,text,text)','EXECUTE') as register_authenticated,
        (select prosecdef from pg_proc where oid='public.register_current_device_session_for_device(uuid,text,text)'::regprocedure) as register_definer,
        has_function_privilege('anon','public.revoke_device_sessions_for_device(uuid)','EXECUTE') as revoke_anon,
        has_function_privilege('authenticated','public.revoke_device_sessions_for_device(uuid)','EXECUTE') as revoke_authenticated,
        (select prosecdef from pg_proc where oid='public.revoke_device_sessions_for_device(uuid)'::regprocedure) as revoke_definer`,
    );
    expect(result.rows[0]).toEqual({ device_id_nullable: true, remember_until_nullable: true, active_definer: false, active_anon: false, active_authenticated: true, register_anon: false, register_authenticated: true, register_definer: false, revoke_anon: false, revoke_authenticated: true, revoke_definer: false });
  }, 15_000);
  it("设备 RPC 在调用用户身份下登记，并只撤销同设备的其他会话", async () => {
    const userId = "10000000-0000-4000-8000-000000000001";
    const deviceId = "20000000-0000-4000-8000-000000000001";
    const oldSessionId = "30000000-0000-4000-8000-000000000001";
    const currentSessionId = "30000000-0000-4000-8000-000000000002";
    await db.query("insert into auth.users(id,email) values($1,'device-test@example.com') on conflict(id) do nothing", [userId]);
    await db.exec("set role authenticated");
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ session_id: oldSessionId })]);
      await db.query("select public.register_current_device_session_for_device($1,'Edge · Android','test-agent')", [deviceId]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ session_id: currentSessionId })]);
      await db.query("select public.register_current_device_session_for_device($1,'Edge · Android','test-agent')", [deviceId]);
      await db.query("select public.revoke_device_sessions_for_device($1)", [deviceId]);
      const sessions = await db.query<{ session_id: string; revoked: boolean }>(
        "select session_id, revoked_at is not null as revoked from public.user_device_sessions where user_id=$1 order by session_id",
        [userId],
      );
      expect(sessions.rows).toEqual([
        { session_id: oldSessionId, revoked: true },
        { session_id: currentSessionId, revoked: false },
      ]);
    } finally {
      await db.exec("reset role");
    }
  }, 15_000);
  it("记住登录期限由设备会话数据限制为最多 30 天，并由 RLS 执行", async () => {
    const userId = "10000000-0000-4000-8000-000000000002";
    const deviceId = "20000000-0000-4000-8000-000000000002";
    const sessionId = "30000000-0000-4000-8000-000000000003";
    await db.query("insert into auth.users(id,email) values($1,'remember-test@example.com') on conflict(id) do nothing", [userId]);
    await db.exec("set role authenticated");
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ session_id: sessionId })]);
      await db.query("select public.register_current_device_session_for_device($1,'Edge · Android','test-agent')", [deviceId]);
      await db.query(`update public.user_device_sessions
        set remember_until = created_at + interval '30 days'
        where session_id = $1`, [sessionId]);
      const active = await db.query<{ current: boolean }>("select public.current_device_session_active() as current");
      expect(active.rows[0].current).toBe(true);
      await expect(db.query(`update public.user_device_sessions
        set remember_until = created_at + interval '30 days 1 second'
        where session_id = $1`, [sessionId])).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
    await db.query("update public.user_device_sessions set remember_until = null, created_at = now() - interval '31 days' where session_id = $1", [sessionId]);
    await db.exec("set role authenticated");
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ session_id: sessionId })]);
      await db.query(`update public.user_device_sessions
        set remember_until = created_at + interval '30 days'
        where session_id = $1`, [sessionId]);
      const active = await db.query<{ current: boolean }>("select public.current_device_session_active() as current");
      expect(active.rows[0].current).toBe(false);
    } finally {
      await db.exec("reset role");
    }
  }, 15_000);
  it("200 MB 云端加载测试仅允许白名单账号读写", async () => {
    await db.exec(file("supabase/tests/cloud_load_test_access.sql"));
  }, 15_000);
});
