# MoonClean OS · 第二阶段

在第一阶段 Next.js 项目上增加 Supabase Authentication、PostgreSQL、RLS、多店铺、团队角色、跨设备同步及本地数据迁移。原有经营总览、推广、商品、财务、数据中心和统一十进制财务计算继续使用。已授权设备读取同一店铺数据，并在窗口重新获得焦点或每 60 秒自动刷新。

## 配置与启动

1. 在 Supabase 创建项目，并开启 **Email / Password** 登录与邮箱验证。
2. 将 `supabase/migrations/` 内的迁移按文件名顺序应用到项目。推荐使用 Supabase CLI 的 `supabase link` 和 `supabase db push`。先在测试项目验证，再应用生产项目。
3. 在 Supabase Authentication 的 URL Configuration 中设置 Site URL 和 Redirect URLs：`http://localhost:3000/auth/callback`、`http://localhost:3000/auth/confirm`，部署时再加入正式域名的相同路径。密码重置经 `/auth/callback?next=/reset-password` 返回。
4. 复制 `.env.example` 为 `.env.local`，填写项目 URL 和 Publishable Key。**不要在浏览器或仓库中使用 service_role key。**
5. 运行：

```bash
npm install
npm run dev
```

首次登录后创建店铺。店铺所有者可通过已注册并验证邮箱的账号添加成员。团队角色：Owner 管理所有权限并可明确转移所有权；Admin 管理运营设置和普通成员；Editor 编辑商品与经营数据；Viewer 只读。重要写入经过 API 身份校验和数据库 RLS，审计日志由数据库触发器写入。

若要在开发环境继续体验第一阶段本地演示，可设置 `NEXT_PUBLIC_DATA_MODE=local`。生产构建始终使用云端模式；缺少 Supabase 配置时会显示错误，**不会静默回退到 localStorage**。

## 数据迁移

登录后访问 `/migrate`。向导读取当前浏览器保留的第一阶段数据，展示商品、每日经营与推广记录数量，检查目标店铺相同日期及同名商品，然后由用户确认。确认时会下载原始本地 JSON 备份，之后逐条导入。迁移记录按店铺、来源类型和来源 ID 去重；已有经营或推广日期不会被覆盖。结果逐条显示成功、跳过或失败，本地数据不会被删除。迁移前请先复核重复项及商品销售分配。

## 财务与历史成本

`daily_metrics` 的手动汇总成本用于第一阶段数据。在数据中心录入 SKU 日销量，并与当日全店销售额核对。`cost_source='sku'` 的日期使用 `sku_daily_metrics` 数量与当日生效的 `sku_costs` 计算；这两种来源不会叠加。成本版本只追加、不覆盖。缺少可靠版本时界面提示“数据不完整”，盈亏平衡 ROAS 不计算。广告 ROAS 始终使用广告归因成交额和广告消耗。

时间戳以 `timestamptz` 存储，经营日期按店铺时区计算。切换货币单位仅改变符号，不执行汇率换算。

## 测试

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

`npm run test` 会用 PGlite 运行所有迁移（除其不支持的 `pgcrypto` 扩展声明），并执行数据库约束与 RLS 越权脚本。`supabase/tests/constraints.sql` 与 `supabase/tests/rls.sql` 也可在隔离的 Supabase 本地数据库中用 `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ...` 复验。不要对生产数据库执行。真实登录、退出和跨店铺 Playwright 测试需要测试项目与 `E2E_EMAIL`、`E2E_PASSWORD`、`E2E_OTHER_STORE_ID`，未提供时测试会标记为跳过。

## Vercel 部署前

- 在 Vercel 配置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`，不配置本地演示模式。
- 先应用迁移并完成数据库与 RLS 测试；在 Supabase Auth 添加正式站点 URL 和回调 URL。
- 使用独立的测试项目验证注册邮件、重置邮件、角色权限与跨店铺隔离，再部署生产。
- 为生产数据库配置备份和迁移回滚计划。`localStorage` 原始数据仅存在用户当前浏览器，需由用户主动迁移。

## 当前限制

尚未接入拼多多或抖音自动同步，也没有对未注册邮箱自动发送团队邀请。成员需先自行注册并验证邮箱。第一阶段本地数据只存当前浏览器；迁移需在保存该数据的浏览器中执行。云端并发更改以数据库唯一约束、事务函数与最近写入为准，尚无字段级冲突合并界面。
