# 智美天工 Clean

智美天工 Clean 是一套重新搭建的 AI 驱动医美智能运营中台。它以旧项目为功能参考，但不直接继承旧项目的临时代码、mock fallback、巨型页面和混乱数据源。

## Current Scope

当前已经完成：

- 官网首页
- 机构登录页与本地 demo 登录
- 平台登录页与本地 demo 登录
- 机构工作台首屏
- 平台管理后台首屏
- 租户隔离与 RBAC 权限底座
- 客户、预约、随访和审计领域模型
- PostgreSQL + Drizzle 真实落库基础
- 客户、预约、随访只读和受控写入 API
- 开放平台基础治理基线

后续阶段会依次加入：

- 机构业务页面接入真实 API
- 客户详情时间线
- 治疗记录与客服会话
- AI 与知识库
- 企业微信、开放平台凭证、计费和审计查询

路线图参考：

```text
docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md
```

## Development

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:5010
```

本地 demo 账号：

```text
机构端：admin / admin123
平台端：platform / admin123
```

demo auth 默认只在非生产环境启用。生产环境如需临时演示，必须显式设置：

```text
ZMTG_ENABLE_DEMO_AUTH=true
```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Architecture

See:

```text
docs/architecture/zmtg-new-project-architecture-design.md
```

## Autonomous Workflow

Codex 按仓库内的自主执行规则推进分支、测试、PR、开发日志和风险升级：

```text
docs/operations/codex-autonomous-workflow.md
```

开发日志记录在：

```text
docs/devlog/
```

## Engineering Rules

- Do not trust tenant IDs from browser localStorage or arbitrary request headers.
- Do not add production fallback accounts.
- Do not store business data in localStorage.
- Do not hide TypeScript build errors.
- Keep mock providers limited to development and tests.
