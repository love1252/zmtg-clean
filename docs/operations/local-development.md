# Local Development

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer

## Start

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:5010
```

## 本地数据库

第三阶段使用 PostgreSQL + Drizzle。需要在本地 shell 中设置 `DATABASE_URL`，不要把真实连接串提交到仓库。

常用命令：

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

如果本机没有把裸 `pnpm` 放进 PATH，也可以使用本机的完整 `pnpm` 路径执行等价命令。

如果没有配置 `DATABASE_URL`，应用中的真实落库 API 会返回稳定错误，不应泄露连接串。

### 写入 API 验证

设置 `DATABASE_URL` 并完成迁移、种子后，可以用 demo 账号登录，再验证写入 API：

```bash
curl -i -X POST http://localhost:5010/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

curl -i -X POST http://localhost:5010/api/institution/customers \
  -H 'content-type: application/json' \
  -H 'cookie: zmtg_demo_session=<从登录响应复制 cookie 值>' \
  -d '{"displayName":"测试客户","lifecycle":"consulting","priority":"observe","ownerUserId":"demo-user-admin","projectInterest":"皮肤管理","maskedPhone":"masked-demo","maskedMedicalRecordNo":"DEMO-MR-WRITE","lastTouchSummary":"本地写入验证","nextAction":"继续跟进","tags":["本地验证"]}'
```

不要把真实 `DATABASE_URL`、cookie 或业务数据写入文档、提交记录或截图。

## 路线图

当前 clean 项目的已完成阶段、旧项目功能取舍和 Phase 5 建议范围记录在：

```text
docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md
```

## Demo Accounts

本地 demo auth 默认在 `development` 和 `test` 环境启用：

```text
机构端：admin / admin123
平台端：platform / admin123
```

生产环境默认禁用 demo auth。若仅用于临时演示，需要显式设置：

```text
ZMTG_ENABLE_DEMO_AUTH=true
```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Rules

- Do not store business data in localStorage.
- Do not add production fallback accounts.
- Do not trust tenant IDs sent from the browser.
- Keep mock providers limited to development and tests.
