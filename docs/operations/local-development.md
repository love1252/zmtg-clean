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
