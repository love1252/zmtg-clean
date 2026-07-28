# 智美天工开发架构

- 文档状态：`current + target + proposed`
- 任务：`V2-ARCH-DOCS-03`
- 基线：`27ff132dd850dba790bc1d7c2e6776b882722b5d`
- 更新日期：2026-07-28

## 1. 文档定位

本文是架构 V2 的开发视图，说明智美天工如何在受控边界内完成任务设计、代码实现、验证、PR 审查、合并与发布判定。它与业务、应用、数据、软件和部署视图共同构成六类架构视图，不替代总体架构、代码事实或任务授权。

本文使用以下状态词：

- `current（当前事实）`：能够在当前仓库、Git 记录或已合并治理文档中直接核验的状态；
- `target（目标约束）`：已经接受、但不等于已经全部实施的开发边界；
- `proposed（建议方案）`：仍需后续任务或用户确认才能成为实施规则的建议；
- `待核验`：仓库内证据不足，不能写成已经存在、已经运行或已经发布；
- `historical（历史记录）`：只用于解释来路，不作为当前实现或授权；
- `planned（计划项）`：已排入候选顺序，但尚未获得启动授权。

状态词不传递授权：文档、计划、Backlog、模型输出和后续建议都不能替代用户对当前任务的明确授权。

## 2. 事实源与权威关系

### 2.1 Agent 治理与任务授权顺序

Agent 治理与任务授权必须与 [`AGENTS.md`](../../AGENTS.md) 使用同一权威顺序：

1. 用户对当前任务的明确授权；
2. [`AGENTS.md`](../../AGENTS.md)；
3. [`docs/ai-agent-governance.md`](../ai-agent-governance.md)；
4. [`docs/agent-guardrails/**`](../agent-guardrails/)；
5. `CLAUDE.md` 与 `.claude/skills/**`，仅在用户明确启用 Claude Code 时作为兼容规则；
6. 历史计划、验证报告、devlog、旧对话和模型输出。

低级规则必须服从高级规则。架构文档、handoff、计划和模型输出不能扩大当前任务授权；`zmtg-pr-gatekeeper.md` 等单个门禁文件属于 `docs/agent-guardrails/**` 规则层，不能与治理主文件并列为一套完整权威层。

### 2.2 实现事实与架构事实来源

- 当前 `main` 的代码、测试、Schema、Migration、配置和 [`package.json`](../../package.json) 命令决定 `current` 事实；
- [`architecture-v2.md`](./architecture-v2.md) 与[已接受 ADR](../decisions/architecture-v2-decisions.md)决定最高级 `target` 约束；
- [`architecture-v2-module-map.md`](./architecture-v2-module-map.md)和业务、应用、数据、软件、部署、开发六类架构视图负责展开同一架构；
- [架构证据审计](./architecture-v2-evidence-audit-20260728.md)、[七线重启基线](./institution-seven-stream-restart-baseline.md)和 handoff 提供核验、状态与历史证据；
- 当前实现与目标架构冲突时，记录差距，不得静默覆盖任一事实层。

Agent 权威顺序与实现／架构事实来源服务于不同判断；事实本身不因任务授权而改变，基于事实采取的行动仍受当前任务授权限制。本文不建立第二套 Agent 权威顺序或第二套架构事实源。模型负责分析和执行，不是架构、发布、环境或业务事实源。

## 3. 当前开发现状

### 3.1 仓库与软件形态

`current`：

- 仓库是 Next.js App Router、React、TypeScript、Drizzle ORM 与 PostgreSQL 组成的模块化单体；
- `src/app/**` 承担页面与 Route Handler，`src/modules/**` 承担业务模块，`src/server/db/**` 与 `drizzle/**` 承担数据库 Schema 和 Migration 资产；
- SaaS 控制平面与机构业务数据平面是逻辑边界，不是已拆分的两个部署单元；
- 新的七线模块、版本化机构契约与旧 `institution`、`open-platform` 聚合模块并存；
- 目标四层尚未在所有模块中统一落地；Repository、Service、Provider 和 Adapter 仍主要混合在模块的 `server` 目录，源码中仍可见跨层及旧聚合模块之间的引用；
- 当前测试以 `src/modules/**/tests/**` 等模块共置测试为主，根目录没有完整的独立 Architecture Test 套件；
- 仓库没有可证明完整 Architecture CI 的 Workflow；仓库外 CI 状态为“待核验”；
- 七条机构业务线的正式发布仍为 `0/7`。

### 3.2 当前协作治理

`current`：

| 角色 | 默认职责 | 明确边界 |
|---|---|---|
| Codex | 默认主开发和仓库执行者；检查基线、修改范围、验证、提交及经授权的 GitHub 操作 | 只能执行当前明确授权的任务，不得从计划自动启动后续任务 |
| ChatGPT 网页版 | 任务设计、架构讨论、范围控制、风险分析及 PR／回报审查 | 讨论和建议不等于开发、Ready、Merge 或发布授权 |
| Claude Code | 默认不参与 | 只有用户在当前任务中明确点名时，才可临时执行或独立复核 |
| 用户 | 架构、高风险任务、Migration、真实外部系统、正式审查、合并和发布决策 | 授权必须对应明确任务与范围 |

同一工作树、分支和 Git 索引只能有一个写入 Agent。允许并行只读审计，但写入者切换前必须交接分支、HEAD、工作树、暂存区、远端和 PR 状态。

### 3.3 当前命令与质量能力

[`package.json`](../../package.json) 当前提供：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preflight
```

其中 `pnpm preflight` 当前精确执行 `typecheck → test → build`，不包含 `lint`、E2E 或 Architecture Gate。`tsconfig.json` 启用 TypeScript 严格检查；`vitest.config.ts` 使用 Vitest；`eslint.config.mjs` 提供现有静态检查配置。测试、Build 或 CI 通过都只证明对应门禁通过，不证明已经部署或正式发布。

### 3.4 当前架构证据

| 证据 | 当前能证明的内容 | 不能据此推断的内容 |
|---|---|---|
| `src/modules/institution-contracts/v1/**` | 已有部分版本化机构契约与契约测试 | 七线 Contract 已全部闭环 |
| `src/modules/security/**` | 已有机构授权、安全开关和低敏输出等代码与测试 | 平台正式服务端授权已完成 |
| `src/app/hospital/**`、`src/app/open-platform/**` | 页面／路由入口存在 | 权威 Reader、真实数据与发布验收已完成 |
| `src/modules/**/tests/**` | 多个模块已有共置测试 | 存在覆盖全仓依赖方向的 Architecture CI |
| `src/server/db/schema.ts`、`drizzle/**` | 当前 Schema 与 Migration 仓库资产 | 任一环境数据库已执行到对应版本 |
| `scripts/**`、运维文档 | 仓库内脚本、Runbook 和建议流程存在 | 测试服务器、生产拓扑或演练结果已经核验 |

## 4. 目标开发方式

### 4.1 单任务、单写入者、单主题

`target`：

- 每次工作必须先冻结任务编号、基线、允许路径、禁止路径、验证和停止条件；
- 为高风险或可回退任务创建 `backup/*` 本地回退分支，并保留既有所有 `backup/*`；
- 一个工作分支只承载一个明确主题，最终保持一个可审查的同主题提交；
- docs-only 与 runtime 严格分离；Schema／Migration、配置、外部连接和部署均独立授权；
- 涉及 GitHub 同步时，在实质修改前通过 `.git` 临时探针的创建／删除、远端 fetch 和等价 push 预检，实际验证本地元数据与远端访问能力；
- 发现工作树越界改动、远端 Head 漂移、进行中的 Git 操作或授权不足时立即停止，不自动 stash、reset、restore、覆盖或绕过保护。

### 4.2 分层开发顺序

`target` 的默认业务开发顺序为：

```text
Domain 不变量
→ 版本化 Contract
→ Application Service／Port
→ Repository／Adapter
→ API
→ UI
→ 分层验证
→ 发布门禁
```

- Domain 定义业务不变量、状态转换和错误语义，不依赖页面、Route 或数据库实现；
- Contract 提供稳定、版本化的跨边界输入输出，不暴露模块内部 DTO；
- Application Service 编排用例，Port 描述所需能力；
- Repository／Adapter 实现持久化或外部集成，保持单一业务所有者；
- API 只做认证、解析、调用、错误映射和低敏响应；
- UI 消费正式 API／Provider，不越层读取数据库或临时 Mock；
- 验证按 Domain、Contract、Repository／Adapter、API、UI、安全、兼容顺序分层；
- 发布门禁独立核验权限、持久化、审计、监控、回滚和业务验收。

这与目标依赖方向一致：

```text
Page／Route
→ Application Service
→ Port／Provider
→ Repository／Adapter
```

旧 Route 只允许逐路由薄兼容，并且必须有唯一业务所有者。`institution` 与 `open-platform` 旧聚合模块继续冻结，不接受新的业务事实所有权。

### 4.3 Migration 独立序列

Migration 不嵌入普通功能实现，目标流程是：

```text
需求与事实所有权
→ 独立设计和影响审计
→ 用户明确授权
→ Expand
→ 兼容 Writer／Guard
→ 确定性回填与追赶
→ Enforce
→ 空库、升级与回退／前向修复验证
→ Reader／API／UI 放行
```

当前既定主序列不得改变：

```text
MIG-01A1（仅 Expand，已存在）
→ MIG-01A2
→ BASE-02B／BASE-02 锚点、revision、Guard 与全部 Writer 双写
→ 审计兼容 Writer／模板保护
→ MIG-01B 确定性回填、追赶与冲突清零
→ MIG-01C 非空、外键、归因与 shape enforce
→ Reader 在最新 main 重新验收
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
```

MIG-02、MIG-06 等共享 Migration 是受控 Schema／Migration 单元和串行编排，不代表共享 Repository、内部 DTO 或事实所有权。每个 Migration 都需要独立设计与影响审计、用户授权、提交／PR、备份、停止条件、恢复或前向修复方案，以及空库、升级和回退验证。

`current`：[`drizzle/meta/_journal.json`](../../drizzle/meta/_journal.json) 已登记到 `0038`，最新 snapshot 资产仍为 [`0026_snapshot.json`](../../drizzle/meta/0026_snapshot.json)，存在已记录的 journal／snapshot 漂移。在 baseline 治理关闭前，不运行 `db:generate`，也不依据 snapshot 差异新增生产 Migration。

`proposed`：把校准后的 snapshot、journal、空库升级、既有库升级、备份恢复和前向修复验证扩展为所有新 V2 Migration 的统一硬门禁。该建议仍待确认，不能写成当前 CI 已实施。

## 5. 建议任务与 PR 流程

`proposed` 的标准生命周期如下：

```text
任务编号、基线和范围
→ backup/* 回退分支
→ 单任务工作分支
→ 范围内实现与验证
→ 一个同主题提交
→ 推送工作分支
→ 草稿 PR（Draft PR）
→ 审查与阻断关闭
→ 经授权进入正式审查（Ready）
→ 经授权合并（Merge）
→ 同步本地 main
→ 验证后清理已合并工作分支
```

各状态必须独立判断：

| 状态 | 含义 | 不代表 |
|---|---|---|
| 技术上可合并（mergeable） | GitHub 当前未发现阻止合并的结构性冲突 | 已获 Ready 或 Merge 授权 |
| 获得 Ready 授权 | 用户允许 PR 进入正式审查 | 已获合并授权 |
| 获得 Merge 授权 | 用户允许按指定方式合并当前冻结 Head | 已部署或已发布 |
| 已合并 | 代码已经进入目标分支 | 环境已经更新 |
| 已部署 | 指定制品或提交进入指定环境且有证据 | 业务已正式发布 |
| 正式发布 | 权限、数据、审计、监控、回滚和业务验收均满足发布尺度 | 其他业务线也已发布 |

默认只创建草稿 PR。Ready、Merge、真实部署和正式发布必须分别获得明确授权。合并后先核验 PR 状态、冻结 Head、merge commit、`main` 与 `origin/main`，再删除已合并的本地及远端工作分支；`backup/*` 不自动清理。

普通 `--force` 始终禁用；只有任务精确授权改写同一工作分支时，才可用冻结旧远端 Head 的显式 `--force-with-lease`。不得用 `--admin` 绕过保护。

## 6. 测试与质量职责

### 6.1 分层职责

| 层级 | 主要验证职责 |
|---|---|
| Domain | 不变量、状态转换、边界值、确定性和失败语义 |
| Contract | Schema、版本兼容、枚举、必填字段和跨模块边界 |
| Application Service／Port | 用例编排、权限前置、幂等、事务边界和依赖替身 |
| Repository／Adapter | 机构隔离、查询与写入语义、失败映射、外部协议和重试边界 |
| API | 认证、请求解析、状态码、低敏响应、兼容路由和错误契约 |
| UI | 加载、空态、失败态、权限态、交互和正式数据来源 |
| 安全 | 双键上下文、拒绝路径、越权、Secret 边界、审计和安全开关 |
| 兼容 | 旧 Route 薄兼容、版本化 Contract、旧数据升级和 Writer／Reader 切换 |

### 6.2 当前门禁与缺口

`current`：可以按任务风险选择执行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 和 `pnpm preflight`；本轮 DOCS-03 只做 Markdown 校验，不运行这些全量命令。

`target`：关键垂直切片应具备分层测试、依赖方向检查、禁止越界导入和发布证据。

`proposed`：在独立任务中建立最小 Architecture／Quality CI，至少检查模块依赖方向、公共 Contract、旧聚合模块冻结、Route 兼容白名单、Schema／Migration 范围、文档／runtime 分离及明确的失败策略。当前没有完整仓库内 Architecture CI，因此不能将该建议写成已实施。

DOCS-03 不创建 Workflow、测试、脚本、空目录、空模块或占位 Port／Provider。

## 7. Secret、数据库和外部系统边界

默认禁止：

- 读取 `.env.local`、`DATABASE_URL` 或任何 Secret、Token、私钥、Webhook 签名和业务凭证的值；
- 未经独立授权执行 Migration、Seed、Smoke、数据修复、回填或数据库连接；
- 未经独立授权连接真实 HIS、企业微信、AI 厂商、对象存储、测试服务器或生产环境；
- 将 `.env.example` 的变量名、代码 Adapter、部署脚本或 Runbook 当成环境已配置、服务已连通或发布已完成的证据；
- 在报告、日志、PR 或截图中暴露高敏信息。

Git／GitHub 开发协作只授权仓库同步，不等于业务外部系统授权。高风险任务必须提前写明停止条件、最小回退／前向修复方式、责任人和低敏报告字段。

## 8. 完成定义

以下状态不得互相替代：

| 完成层级 | 必须回答的问题 |
|---|---|
| 文件或代码存在 | 目标文件、类型、函数或路由是否真实存在 |
| Domain 完成 | 不变量、状态和错误语义是否闭环 |
| Contract 完成 | 版本、Schema 和兼容责任是否闭环 |
| Repository／Adapter 完成 | 权威持久化或外部协议是否实现并隔离 |
| API 完成 | 认证、解析、调用、响应和错误契约是否闭环 |
| UI 完成 | 正式数据、权限态、交互与异常态是否闭环 |
| 测试通过 | 指定测试与静态门禁是否在冻结 Head 通过 |
| Capability／Mock／Demo／Seed 可用 | 受限能力或演示路径是否可用 |
| 已合并 | 冻结 Head 是否通过指定方式进入 main |
| 已部署 | 指定提交是否有目标环境部署证据 |
| 运行与验收完成 | 权限、持久化、审计、监控、回滚和业务验收是否齐备 |
| 正式发布 | 全部发布门禁是否由有权角色确认 |

代码存在、测试、Build、CI、Capability、Mock、Demo、Seed、合并或部署脚本都不能单独证明正式发布。七条机构业务线正式发布继续为 `0/7`。

一个可验收的任务 DoD 必须同时核对：文件与提交范围、事实所有权、依赖方向、对应层级的测试证据、权限与拒绝路径、数据迁移状态、审计证据、部署／发布证据以及停止和回滚／前向修复条件。与任务无关或尚未授权的项目必须明确标记“不适用”或“待核验”，不能用省略表示已经完成。

## 9. 当前与目标差距

| 差距 | 影响 |
|---|---|
| 新七线模块与旧 `institution`／`open-platform` 聚合模块并存 | 所有权、依赖方向和兼容责任仍可能漂移 |
| 版本化与非版本化 Route 并存 | 兼容层可能继续承载新业务逻辑 |
| 完整 Architecture CI 尚不存在 | 越层依赖和冻结模块新增所有权主要依赖人工审查 |
| MIG-01 仅 A1 Expand 已存在 | 双键 Writer、回填、Enforce 与正式 Reader 尚未闭环 |
| 平台正式服务端授权仍是独立缺口 | 平台代码或客户端门禁不能证明正式授权成立 |
| 仓库内脚本和 Runbook 与环境证据分离 | 不能从仓库推断测试、预发布或生产现状 |
| 架构索引仍将开发视图列为 `planned` | 本任务禁止修改该索引；文档创建后会保留一处待后续授权同步的导航状态漂移 |

## 10. 风险与影响

- 若把计划或模型输出当授权，可能越过用户对 Migration、外部系统、Ready、Merge 和发布的控制；
- 若多个 Agent 写同一工作树，可能造成暂存区污染、范围漂移和错误推送；
- 若跳过 Domain／Contract 直接实现 Route 或 UI，旧聚合模块会继续吸收所有权；
- 若将共享 Migration 等同于共享 Repository，会破坏七线事实所有权；
- 若把测试或 Build 通过写成正式发布，会掩盖权限、持久化、审计和环境验收缺口；
- 若读取或回报真实凭证，会扩大安全与合规影响；
- 若在未核验环境中执行 Migration 或外部 Smoke，可能造成不可逆数据或业务影响。

## 11. 需要的后续改造

以下均不是本任务授权：

1. `planned`：`V2-02B-MIG01-CLOSURE-PREFLIGHT` 仅作为候选后续阶段，重新审计 MIG-01 关闭条件；
2. `target`：`V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT` 是 V2-02B 之后的方向，不是当前候选任务，未来需独立 handoff 和授权；
3. `proposed`：建立最小 Architecture／Quality CI；
4. `target`：按既定 MIG-01～MIG-06 顺序完成数据库演进；
5. `target`：按 Customers、Care、Knowledge、Conversations、Analytics、Institution System、Workbench 的依赖门禁推进垂直切片；
6. `proposed`：在单独 docs-only 任务中同步架构索引的开发视图状态。

## 12. 实施顺序

当前唯一候选后续阶段是 `V2-02B-MIG01-CLOSURE-PREFLIGHT`。完成独立 handoff、重新冻结基线并获得用户授权前，不得启动。

现有架构索引记录的后续方向参考为：

```text
V2-02B-MIG01-CLOSURE-PREFLIGHT（当前唯一候选）
→ V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT（后续方向）
→ 最小 Architecture／Quality CI（proposed，具体位置待重新确认）
→ MIG-01 关闭
→ MIG-02
→ MIG-03
→ MIG-04
→ MIG-05
→ MIG-06
→ 七线垂直切片
→ Workbench 最后接线
```

Customers 与 Institution System 的正式 Reader 等待 MIG-01C；Care 等待 MIG-02；Knowledge 等待 MIG-03；Conversations 等待 MIG-04；Analytics Facts 等待 MIG-05；Analytics Snapshot、正式 Provider 与五页 UI 等待 MIG-06 + AN-03C；Workbench 最后只消费正式 Provider。

只有 MIG-01～MIG-06 的相对顺序和各业务门禁属于固定约束；Architecture／Quality CI 的实际插入点仍需后续任务确认。方向参考不是自动启动授权。

## 13. 已确认决策

- 采用模块化单体、SaaS 控制平面与机构业务数据平面、四层结构和七条机构业务线；
- Codex 是默认主开发，ChatGPT 网页版负责设计与审查，Claude Code 默认不参与；
- 一个工作树、分支和 Git 索引只有一个写入 Agent；
- 默认创建草稿 PR，Ready 与 Merge 分别由用户授权；
- Domain → Contract → Application Service／Port → Repository／Adapter → API → UI；
- 新实现默认使用版本化 Contract；旧 Route 只允许逐路由薄兼容；
- Migration 独立设计、独立授权并保持 MIG-01～MIG-06 顺序；
- Capability、Mock、Demo、Seed、测试、Build、合并或部署不等于正式发布；
- 平台正式服务端授权仍是独立缺口，七线正式发布仍为 `0/7`。

## 14. 待确认决策

- 最小 Architecture／Quality CI 的首批规则、执行位置和阻断级别；
- `V2-02B` 必须另建 handoff 并获得用户明确授权；待确认的是该 handoff 的冻结基线、审计范围与停止条件；
- 每个 Migration 的恢复策略采用回退还是前向修复，以及对应验证证据；
- 架构索引中开发视图状态的后续同步任务；
- 仓库外 CI、Test、Staging、Production 的责任人和证据回填方式。

## 15. 待核验事项

- 仓库外 CI/CD、制品、审批链和分支保护的实际配置；
- Test、Staging、Production 是否存在及其身份、隔离、当前 SHA 和运行状态；
- 各环境数据库实际 Migration 执行状态／journal、备份、恢复和演练结果；
- 对象存储、Job、Queue、Secret Manager、监控、告警和 On-call 的实际状态；
- HIS、企业微信、AI 厂商等正式 Adapter 的端点、身份、网络和发布证据；
- 七线在目标环境中的权限、持久化、审计、回滚与业务验收结果。

## 16. 禁止范围

本文不能被解释为：

- 已启动 `V2-02B`、`V2-02C`、MIG-01 或任何 runtime；
- 已授权 Schema、Migration、Seed、部署、数据修复或真实外部连接；
- 已建立 Architecture CI、完整四层目录或全部 Port／Provider；
- 已确认测试服务器、数据库、监控或生产拓扑；
- 已获得 Ready、Merge、部署或正式发布授权；
- 可以创建空目录、空模块、占位实现或第二套事实源；
- 可以改变 MIG-01～MIG-06、七线门禁或 Workbench 最后接线顺序；
- DOCS-03 完成代表七线正式发布。
