# 智美天工 / zmtg-clean

智美天工是面向医疗机构业务与 SaaS 平台治理的模块化单体。根 README 只提供项目入口、当前边界和常用导航；阶段历史统一保存在 [`docs/handoff/RELEASE_HISTORY.md`](docs/handoff/RELEASE_HISTORY.md)。

## 项目定位

当前仓库同时承载：

- SaaS 控制平面：租户、机构、套餐、授权和平台治理；
- 机构业务数据平面：围绕客户、诊疗、会话、知识、分析、机构系统与工作台的业务能力；
- 公共基础设施：认证、访问控制、安全、消息、审计、数据库和外部集成边界。

项目采用模块化单体，不把逻辑上的两个平面描述为已经拆分的部署单元。七条机构业务线为 Customers、Care、Conversations、Knowledge、Analytics、Institution System 和 Workbench；当前正式发布仍为 `0/7`。

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript 5
- Tailwind CSS 4
- Drizzle ORM
- PostgreSQL
- Vitest、Testing Library 与 ESLint
- pnpm 9

精确依赖版本和脚本以 [`package.json`](package.json) 为准。

## 当前边界

- `current（当前事实）`：当前代码、Schema、Migration、测试和已合并文档能够直接证明的状态；
- `target（目标状态）`：已经接受的模块边界、分层方向和发布门禁，不表示已经全部实施；
- `proposed（建议方案）`：仍需后续任务或用户确认的改造建议；
- `待核验`：仓库外 CI、环境数据库状态、Test／Staging／Production 拓扑、监控、备份和外部系统连通性。

目标状态是在同一模块化单体内落实两平面、四层依赖方向、七线单一事实所有权、版本化 Contract 和受控 Migration／发布门禁；这些目标不能写成当前已完成事实。

代码、Contract、Capability、Mock、Demo、Seed、测试或 Build 存在，都不能单独证明已经部署或正式发布。当前架构与发布尺度详见[架构文档索引](docs/architecture/README.md)和[当前项目状态](docs/handoff/CURRENT_STATUS.md)。

## 本地开发

前提：

- Node.js `>= 20.0.0`
- pnpm `>= 9.0.0`
- 需要持久化能力时使用 PostgreSQL，并通过环境变量名 `DATABASE_URL` 配置连接；本文不提供任何值

开发服务器默认监听 Web 端口 `5010`。

### package 命令

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm build` | 生成生产构建 |
| `pnpm start` | 在默认端口启动已构建应用 |
| `pnpm lint` | 执行 ESLint |
| `pnpm typecheck` | 执行 TypeScript 类型检查 |
| `pnpm test` | 单次运行 Vitest |
| `pnpm test:watch` | 以监听模式运行 Vitest |
| `pnpm preflight` | 按 `typecheck → test → build` 执行现有预检 |

`preflight` 当前不包含 `lint`、浏览器 E2E 或完整 Architecture Gate。数据库、Seed 和部署脚本属于高风险或环境相关入口，不作为根 README 的默认快捷流程。

更多本地说明见 [`docs/operations/local-development.md`](docs/operations/local-development.md)。

## 文档导航

### 架构

- [架构文档索引](docs/architecture/README.md)
- [总体架构 V2](docs/architecture/architecture-v2.md)
- [业务架构](docs/architecture/business-architecture.md)
- [应用架构](docs/architecture/application-architecture.md)
- [数据架构](docs/architecture/data-architecture.md)
- [软件架构](docs/architecture/software-architecture.md)
- [部署架构](docs/architecture/deployment-architecture.md)
- [开发架构](docs/architecture/development-architecture.md)
- [架构决策](docs/decisions/architecture-v2-decisions.md)

### 开发治理与 Agent 规则

- [项目 Agent 入口规则](AGENTS.md)
- [AI Agent 项目治理](docs/ai-agent-governance.md)
- [PR 门禁规则](docs/agent-guardrails/zmtg-pr-gatekeeper.md)
- [Claude Code 项目入口](CLAUDE.md)

Codex 是默认主开发和仓库执行者；ChatGPT 网页版负责任务设计、架构讨论、范围控制和审查；Claude Code 只有在用户明确点名时临时启用。架构、高风险任务、Migration、真实外部系统、进入正式审查（Ready）、合并（Merge）和正式发布均由用户授权。

### 运维与数据库

- [本地开发](docs/operations/local-development.md)
- [部署架构与待核验边界](docs/architecture/deployment-architecture.md)
- [生产 Migration Runbook](docs/operations/production-migration-runbook.md)
- [数据与存储边界](docs/architecture/data-and-storage-boundaries.md)
- [脚本说明](scripts/README.md)

仓库中的脚本、Runbook 或配置样例只证明相关资产存在，不证明测试服务器、生产环境、数据库、备份、监控或外部 Adapter 已配置或可用。

### 状态、任务与历史

- [当前项目状态](docs/handoff/CURRENT_STATUS.md)
- [唯一下一任务定义](docs/handoff/NEXT_TASK.md)
- [发布与阶段历史](docs/handoff/RELEASE_HISTORY.md)

状态文档或候选后续阶段不构成自动开发授权。

## 安全边界

- 不读取、输出或提交 `.env.local`、`DATABASE_URL` 的值、Secret、Token、私钥或业务凭证；
- Migration、Seed、Smoke、真实数据库和真实外部连接必须分别获得明确授权；
- Git／GitHub 仓库协作不等于 HIS、企业微信、AI 厂商、对象存储、测试服务器或生产环境授权；
- 不把 Demo、Mock、Capability、Seed、测试、Build、合并或部署脚本写成正式发布证据；
- DOCS-03 只完成文档建设，不代表七条机构业务线正式上线。
