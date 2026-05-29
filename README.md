# 智美天工 Clean

智美天工 Clean 是一套重新搭建的 AI 驱动医美智能运营中台。它以旧项目为功能参考，但不直接继承旧项目的临时代码、mock fallback、巨型页面和混乱数据源。

## Current Scope

当前阶段只包含：

- 官网首页
- 机构登录页壳
- 平台登录页壳
- 品牌素材
- 工程规范
- 架构文档
- 基础测试

后续阶段会依次加入：

- 认证与 session
- 租户与 RBAC
- 客户、预约、治疗、随访核心闭环
- AI 与知识库
- 企业微信、开放平台、计费和审计

## Development

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:5010
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
