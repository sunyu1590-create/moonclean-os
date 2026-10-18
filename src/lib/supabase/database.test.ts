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
];
const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
    create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}'::jsonb,raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const name of migrations)
    await db.exec(
      file(`supabase/migrations/${name}`).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
}, 15_000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL 迁移与权限", () => {
  it("迁移可重复执行", async () => {
    for (const name of migrations)
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
  }, 15_000);
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
});
