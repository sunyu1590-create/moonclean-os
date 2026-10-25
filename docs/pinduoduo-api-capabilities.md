# 拼多多官方 API 能力清单

当前正式商品、订单和退款 API 仍未联调。拼多多店铺 OAuth 回调及服务端 Token 兑换流程已实现，但尚无开放平台应用凭据，因此真实店铺授权未验证。本项目不把模拟连接标记为官方授权。

| 待申请能力 | 业务用途 | 官方文档链接 | 当前权限 | 真实联调 |
| --- | --- | --- | --- | --- |
| 应用创建与 OAuth 授权 | 获取店铺授权和有效期 | [拼多多开放平台](https://open.pinduoduo.com/application/document/api?id=pdd.pop.auth.token.create) | 待配置 Client ID/Secret | 回调已实现，未完成真实联调 |
| 订单列表与订单详情 | 历史回填、状态增量更新 | 待核实 | 未申请 | 未完成 |
| 商品与 SKU 查询 | 建立平台 SKU 对应关系 | 待核实 | 未申请 | 未完成 |
| 退款与售后查询 | 对应订单的部分及全额退款 | 待核实 | 未申请 | 未完成 |
| 授权续期或令牌刷新 | 无人值守调度 | 待核实 | 未申请 | 未完成 |

回调地址：`https://moonclean.cloud/api/pdd/callback`。在 Vercel 服务端配置 `PDD_CLIENT_ID`、`PDD_CLIENT_SECRET`、`PDD_OAUTH_STATE_SECRET`（至少 32 字节）及 `PDD_TOKEN_ENCRYPTION_KEY`（32 字节 Base64）。授权状态签名及 HttpOnly state cookie 用于阻止伪造/跨站回调；Token 使用 AES-256-GCM 加密后写入预留的私有凭据表。授权取消、state 过期、授权失败和 Token 到期都会显示为非成功状态，并可从平台连接中心重新授权。

获得开放平台开发者权限和凭据后，需先用测试店铺真实授权核对应用权限、Token 返回时长与授权撤销行为，再继续实现 `OfficialPinduoduoAdapter`。订单、商品和退款同步仍为模拟数据，不会因 OAuth 回调接通而自动变为真实数据。

正式凭据预留在数据库的 `private.platform_credentials` 表中。该表不向浏览器角色开放；未来需要实现服务端加密、密钥轮换和 OAuth 回调校验后才会写入凭据。当前页面不收集密钥。不要把 Client Secret、Access Token 或 Refresh Token 写入前端、公开环境变量或 Git 仓库。
