# Phase 23 HIS 连接配置写入 repository 边界计划

> **给自动化执行者：** 后续如果要实施本计划中的未来写入 repository，必须先重新进入对应实现 Plan Mode，并使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项推进。本文档只规划边界，不是实现计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 只做 Phase 23 HIS 连接配置写入 repository 边界 Plan Mode，明确未来 create / update / pause / resume / revoke / softDelete repository 方法、输入模型、状态流转、租户边界、审计衔接、错误返回和数据最小化如何拆分与约束。

**架构说明：** 当前 PR 不改系统架构，只新增和同步 Markdown。未来 repository 只负责可信 `tenantId` 范围内的安全元数据写入和状态机持久化；权限判断、审计决策、HTTP payload 解析、凭证管理、测试连接和真实 HIS adapter 都不属于 repository 职责。

**技术栈：** 当前 PR 只涉及 Markdown。后续如单独批准实现，才可能涉及 TypeScript、Next.js App Router、Vitest、Drizzle、现有 `his_connections` schema、`open_connection` 权限、审计 repository 和 HIS 连接配置 repository。

---

## 0. 当前 PR 范围

新增：

- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-repository-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-repository-v1.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

当前 PR 不做：

- 不写代码。
- 不改测试。
- 不新增 repository 方法。
- 不新增 API。
- 不改现有 API。
- 不改 UI。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不做凭证管理。
- 不做测试连接。
- 不接真实 HIS。
- 不接机构系统。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存或返回任何真实凭证。
- 不返回 `credentialRef` 给前端 DTO。
- 不展示凭证明文。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

验证命令：

```bash
git diff --check
git diff --cached --check
```

本 PR 不需要跑 Vitest、typecheck 或 Next build，除非误改代码、UI、测试、API、schema 或 migration。

## 1. 只读检查结论

本次按要求只读检查了：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`
- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-api-v1.md`
- `src/server/db/schema.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/audit/**`
- `src/modules/security/**`

并只读检查了现有写入 repository 风格：

- `src/modules/institution/server/treatment-summary-repository.ts`
- `src/modules/institution/server/tenant-business-repository.ts`
- `src/modules/open-platform/server/tenant-management-repository.ts`
- `src/modules/audit/server/audit-event-repository.ts`

已确认：

- 当前 main HEAD 为 `86d3a0e8e354e117e3d85c25790343d141dc879f`。
- 当前工作区开始时干净，本 PR 从 `docs/phase23-his-connection-write-repository-plan` 分支执行。
- PR #118 已完成 `his_connections` schema / migration 最小实现。
- PR #119 已完成连接配置只读 repository 最小实现。
- PR #120 已完成机构端 list / detail 只读 API。
- PR #121 已完成连接配置只读 UI / workspace 入口 Plan Mode。
- PR #122 已完成机构端 workspace「HIS 连接配置」入口和 `HisConnectionReadOnlyPanel`。
- PR #123 已完成只读 UI smoke / 文档收尾。
- PR #124 已完成 Phase 23 写入 API 与状态流转边界 Plan Mode。
- 当前 `his_connections` 状态枚举已包含 `draft`、`active`、`paused`、`revoked`、`deleted` 和 `error`。
- 当前 `his_connections` 已有 nullable `credentialRef`、`revokedAt`、`deletedAt`、`tenantId + id` 唯一约束和租户内未删除连接名唯一约束。
- 当前 HIS connection repository 只提供 `listHisConnectionsByTenant` 和 `getHisConnectionByTenant`，没有写入方法。
- 当前 repository 读取条件绑定可信 `tenantId`，详情绑定 `tenantId + connectionId`，默认过滤软删除记录。
- 当前 repository 返回安全 read model，派生 `credentialConfigured`，不返回 `credentialRef`。
- 当前 API 只有 list / detail GET，不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw HIS payload。
- 当前 API 只使用服务端 access context 的 `tenantId`，不接受 query 或 header tenantId 切换租户。
- 当前权限模型只给 `tenant_admin` `open_connection:read_own_tenant`，尚未规划或实现写入权限。
- 现有写入 repository 风格倾向于绑定 `tenantId + id`，返回 `null` 或稳定 union result 表达 not found、conflict、invalid transition 等结果。
- 现有审计记录只应包含安全元数据，不应包含 SQL、stack、token、secret、`DATABASE_URL`、连接串、完整正文或 raw payload。

因此本 PR 不需要改 TypeScript、测试、API、schema、migration、权限、认证、租户隔离、UI 或 demo seed。

## 2. 文件职责规划

- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-repository-v1-design.md`
  - 说明 Phase 23 写入 repository 定位、非目标、输入分层、拟规划 repository 方法、状态流转、返回结果、数据最小化、租户边界、审计衔接、测试规划和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-repository-v1.md`
  - 说明当前 docs-only PR 的范围、只读检查结论、文件职责、执行步骤、验收清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 写入 repository 边界 Plan Mode 状态，明确仍未实现写入 repository、写入 API、凭证管理、测试连接或真实 HIS adapter。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步路线图：Phase 23 已完成写入 API 边界和写入 repository 边界规划，后续实现和凭证 / 测试 / adapter 均需独立 PR。
- `docs/devlog/2026-06-03.md`
  - 记录本 PR 分支、目标、完成项、边界和验证命令。

## 3. 当前 docs-only 执行步骤

### 任务 1：新增设计文档

**文件：**

- 新增：`docs/superpowers/specs/2026-06-03-phase23-his-connection-write-repository-v1-design.md`

- [ ] 写明本 PR 是 Phase 23 写入 repository Plan Mode，不是 repository、API、schema / migration、凭证管理、测试连接或真实 HIS adapter 实现。
- [ ] 写明不连接真实 HIS、不处理真实客户数据、不保存真实凭证、不保存 raw HIS payload。
- [ ] 区分客户端 payload、服务端 access context 和 repository command。
- [ ] 明确 repository 方法必须显式接收可信 `tenantId`，且 `tenantId` 只能来自上层服务端 access context。
- [ ] 规划未来方法：`createHisConnectionForTenant`、`updateHisConnectionForTenant`、`pauseHisConnectionForTenant`、`resumeHisConnectionForTenant`、`revokeHisConnectionForTenant` 和 `softDeleteHisConnectionForTenant`。
- [ ] 明确 detail / update / status 方法必须绑定 `tenantId + connectionId`。
- [ ] 明确跨租户目标不得可见，已软删除记录默认不可写。
- [ ] 明确 repository 不处理权限判断，只执行 tenant-scoped 数据访问。
- [ ] 明确权限判断由 API / service 层完成。
- [ ] 明确 repository 不写审计本身，推荐 API / service 层写入后调用 audit repository。
- [ ] 规划 create 只允许 `connectionName`、`sourceSystem`、`vendorType`、`systemType`、`actorUserId` 等安全元数据。
- [ ] 明确 create 服务端生成 `id`、`tenantId`、`status = draft`、`createdAt`、`updatedAt`、`createdBy` 和 `updatedBy`。
- [ ] 明确 create 不接受 `credentialRef`、`status`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、生命周期时间戳或任何凭证 / raw payload。
- [ ] 规划 update 只允许低风险元数据和 `actorUserId`，不允许修改 `status`、`credentialRef`、健康状态或生命周期字段。
- [ ] 规划 pause / resume / revoke / softDelete 状态流转表。
- [ ] 明确 `draft -> paused` v1 禁止，`draft -> active` 不通过 resume，`revoked -> active` 禁止，`deleted -> 任意状态` 禁止。
- [ ] 规划稳定返回结果：`ok`、`not_found`、`conflict`、`invalid_state_transition`、`validation_failed`。
- [ ] 明确不返回 SQL、stack、数据库异常原文、其他租户是否存在、raw payload、凭证明文或 `credentialRef` 给前端 DTO。
- [ ] 规划审计事件和安全审计元数据，明确审计禁止记录凭证、raw payload、SQL、stack、`DATABASE_URL` 或外部错误全文。
- [ ] 规划未来 repository 测试覆盖清单。
- [ ] 写明后续 PR A-J 拆分。

### 任务 2：新增计划文档

**文件：**

- 新增：`docs/superpowers/plans/2026-06-03-phase23-his-connection-write-repository-v1.md`

- [ ] 记录当前 PR 范围和非目标。
- [ ] 记录只读检查文件和结论。
- [ ] 规划文件职责。
- [ ] 列出当前 docs-only 执行步骤。
- [ ] 列出验收清单、验证命令和停止条件。
- [ ] 保持面向人读的标题、模板字段和任务结构说明中文化。

### 任务 3：轻量同步项目文档

**文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-06-03.md`

- [ ] README 增加 Phase 23 写入 repository 边界 Plan Mode 状态。
- [ ] roadmap 增加 Phase 23 repository 边界规划完成状态，并保留写入实现、API 实现、凭证管理、测试连接和真实 adapter 未实现的边界。
- [ ] devlog 记录分支、目标、完成项、边界和验证命令。

### 任务 4：验证 docs-only diff

**命令：**

```bash
git diff --check
git diff --cached --check
```

预期：

- 两个命令均退出码为 0。
- 没有 whitespace error。
- diff 仅包含 Markdown 文档。

## 4. PR D：repository 写入闭环收尾记录

Phase 23 PR B 和 PR C 已完成 HIS 连接配置 repository 写入闭环的最小实现。PR D 只做 docs-only 收尾，不新增测试、不新增 repository 方法、不修改生产 repository、不新增 API、不改 schema / migration、不改权限 / 认证 / 租户隔离。

### 4.1 当前已完成 repository 方法

当前 `createHisConnectionRepository(database)` 已提供：

- `createHisConnectionForTenant`
- `updateHisConnectionForTenant`
- `pauseHisConnectionForTenant`
- `resumeHisConnectionForTenant`
- `revokeHisConnectionForTenant`
- `softDeleteHisConnectionForTenant`

这些方法的共同边界是：

- repository command 显式接收可信 `tenantId`。
- detail / update / status 方法绑定 `tenantId + connectionId`。
- 状态方法先按 `tenantId + connectionId + deletedAt is null` 查当前行。
- 跨租户、不存在和已软删除目标统一返回 `not_found`。
- 软删除记录默认从 list / detail 中不可见。
- 成功结果复用安全 read model，派生 `credentialConfigured`，不返回 `credentialRef` 给前端 DTO。

### 4.2 写入与状态边界

当前 repository 写入闭环保持以下数据最小化和状态边界：

- create 固定写入 `status = draft`、`healthStatus = unknown`、`createdBy`、`updatedBy`、`createdAt` 和 `updatedAt`。
- create / update 只写 `connectionName`、`sourceSystem`、`vendorType`、`systemType` 等安全元数据。
- update 不修改 `status`、`credentialRef`、健康检查字段或生命周期字段。
- pause 允许 `active / error -> paused`，`draft -> paused` 返回 `invalid_state_transition`，重复 pause 返回 `conflict`。
- resume 只允许 `paused -> active`，不表示测试连接成功，不调用真实 HIS，不刷新 `healthStatus`。
- revoke 允许 `draft / active / paused / error -> revoked`，写入 `revokedAt`、`updatedAt` 和 `updatedBy`，重复 revoke 返回 `conflict`。
- softDelete 允许未删除状态进入 `deleted`，写入 `deletedAt`、`updatedAt` 和 `updatedBy`，删除后 list / detail 默认不可见。
- 状态流转只修改状态、必要生命周期时间戳和 actor 字段，不保存 `reasonCode`、外部错误全文、raw payload 或凭证材料。

当前 repository 仍明确不做：

- 不新增 API。
- 不解析 HTTP payload。
- 不判断权限。
- 不写审计。
- 不处理凭证。
- 不做测试连接。
- 不调用真实 HIS。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达。
- 不修改 demo seed。

### 4.3 测试覆盖确认

现有 `src/modules/institution/tests/HisConnectionRepository.test.ts` 已由 PR #126 和 PR #127 覆盖以下边界，本 PR 不重复新增测试：

- create 默认 `draft / unknown`。
- create / update 只 pick 白名单字段。
- create / update 唯一约束冲突返回稳定 `conflict`。
- create / update 输入非法返回 `validation_failed`。
- update 跨租户、不存在或已软删除返回 `not_found`。
- update 不修改 `status`、`credentialRef`、健康状态、检查字段和生命周期字段。
- pause / resume / revoke / softDelete 状态流转。
- `draft -> paused` 禁止。
- 重复 pause 返回 `conflict`。
- `paused -> active` 允许。
- `draft / error / revoked -> active` 禁止。
- `draft / active / paused / error -> revoked` 允许。
- 重复 revoke 返回 `conflict`。
- softDelete 写入 `status = deleted` 和 `deletedAt`。
- 状态方法跨租户、不存在或已软删除统一 `not_found`。
- 状态方法输入非法返回 `validation_failed` 且不读写数据库。
- softDelete 后 list / detail 默认不可见。
- 返回模型和写入字段不包含 `credentialRef`、raw payload、真实凭证、SQL、stack、`DATABASE_URL` 或连接串。
- repository 不调用外部系统。
- repository 不创建治疗摘要。
- repository 不创建随访任务。
- repository 不自动触达。
- demo seed 不写入 `hisConnections`、`his_connections`、`credentialRef` 或 `credential_ref`。

### 4.4 API / service 接入前置边界

下一步如进入 API / service 实现，必须单独处理并测试：

- HTTP payload parser。
- 权限判断。
- API 错误映射。
- 审计写入。
- service 层事务边界。
- DTO 数据最小化。
- create / update API。
- pause / resume / revoke / delete API。

下一步仍不得混入：

- 凭证管理。
- 测试连接。
- 真实 HIS adapter。
- Webhook / 同步任务。
- 患者身份匹配。
- 自动治疗摘要。
- 自动随访任务。
- 自动触达。

## 5. 后续 PR 拆分建议

建议后续拆分为：

- PR A：写入 repository Plan Mode（当前 PR）。
- PR B：create / update repository 实现（已由 `codex/phase23-his-connection-create-update-repository` 完成最小实现）。
- PR C：状态流转 repository 实现（已由 `codex/phase23-his-connection-status-repository` 完成最小实现）。
- PR D：repository 写入闭环收尾（当前 docs-only PR）。
- PR E：create / update API 实现。
- PR F：pause / resume / revoke / delete API 实现。
- PR G：审计补强。
- PR H：凭证管理 Plan Mode。
- PR I：测试连接 Plan Mode。
- PR J：真实 HIS adapter Plan Mode。

凭证录入、加密、轮换、撤销、测试连接、健康检查、真实 HIS adapter、Webhook / 同步、患者身份匹配、自动摘要、自动任务和自动触达都不得混入当前 Phase 23 docs-only PR。

## 6. 验收清单

- 设计文档明确当前 PR 是 Phase 23 写入 repository Plan Mode，不是 repository、API、schema / migration、凭证管理、测试连接或真实 HIS adapter。
- 设计文档明确不写代码、不改测试、不新增 repository 方法、不新增 API、不改 schema / migration、不改权限、认证或租户隔离。
- 设计文档覆盖客户端 payload、服务端 access context 和 repository command 的输入分层。
- 设计文档覆盖拟规划 repository 方法 create、update、pause、resume、revoke 和 softDelete。
- 设计文档明确所有方法显式接收可信 `tenantId`，且 `tenantId` 只能来自服务端 access context。
- 设计文档明确 update / status 方法绑定 `tenantId + connectionId`，跨租户和已软删除目标不可见。
- 设计文档明确 repository 不处理权限判断、不直接写审计、不处理凭证、不调用真实 HIS。
- 设计文档明确 create / update 只允许安全元数据和 actor。
- 设计文档明确禁止输入字段和敏感内容。
- 设计文档覆盖 `draft`、`active`、`paused`、`revoked`、`deleted`、`error` 状态流转边界。
- 设计文档明确 `revoked` 不普通恢复、`deleted` 是软删除 / 归档、状态方法不代表测试连接成功。
- 设计文档覆盖稳定 repository 结果和错误响应禁止项。
- 设计文档覆盖审计事件、允许记录项和禁止记录项。
- 设计文档列出未来 repository 测试清单。
- 设计文档列出后续 PR A-J 拆分。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、测试、API、schema、migration、权限、认证、租户隔离、UI 或 demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 7. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须写代码才能完成当前 docs-only PR。
- 必须改测试。
- 必须新增 repository 方法。
- 必须新增 API 或修改现有 API。
- 必须改数据库 schema 或新增 migration。
- 必须改权限、认证或租户隔离。
- 必须改 UI。
- 必须接真实 HIS、机构系统、企微或其他外部系统。
- 必须接 AI / RAG / Agent。
- 必须做 AI 解析。
- 必须做测试连接。
- 必须自动触达客户。
- 必须导入真实客户数据。
- 必须保存 raw HIS payload。
- 必须保存或返回任何真实凭证。
- 必须返回 `credentialRef`。
- 必须展示凭证明文。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要。
- 必须自动创建随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
