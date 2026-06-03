# Phase 23 HIS 连接配置写入 API 与状态流转边界计划

> **给自动化执行者：** 后续如果要实施本计划中的未来写入能力，必须先重新进入对应 Plan Mode，并使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项推进。本文档只规划边界，不是实现计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 只做 Phase 23 HIS 连接配置写入 API 与状态流转边界 Plan Mode，明确未来 create / update / pause / resume / revoke / delete API、写入 repository、权限、审计、状态流转、错误态和数据最小化如何拆分与约束。

**架构说明：** 当前 PR 不改系统架构，只新增和同步 Markdown。未来写入 API 只能处理安全元数据，必须继续从服务端 access context 获取 `tenantId`，并把凭证管理、测试连接和真实 HIS adapter 拆到独立 Plan Mode。

**技术栈：** 当前 PR 只涉及 Markdown。后续如单独批准实现，才可能涉及 TypeScript、Next.js App Router、Vitest、Drizzle、现有 `open_connection` 权限、审计 repository、HIS 连接配置 repository 和状态流转测试。

---

## 0. 当前 PR 范围

新增：

- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-api-v1.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

当前 PR 不做：

- 不写代码。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不做写入 repository。
- 不改 UI。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接真实 HIS。
- 不接机构系统。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做测试连接。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存或返回任何真实凭证。
- 不返回 `credentialRef`。
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
- `docs/superpowers/specs/2026-06-03-his-connection-schema-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-schema-api-v1.md`
- `docs/superpowers/plans/2026-06-03-his-connection-read-ui-v1.md`
- `src/server/db/schema.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`

并只读检查了现有写入 API / 审计 / 权限风格：

- `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
- `src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts`
- `src/app/api/institution/**/route.ts`
- `src/modules/audit/**`
- `src/modules/security/**`
- `src/modules/institution/tests/*ApiRoutes.test.ts`

已确认：

- 当前 main HEAD 为 `33113033a0a90d7227418e474ad14c2e547895aa`。
- 当前工作区开始时干净，本 PR 从 `docs/phase23-his-connection-write-api-plan` 分支执行。
- PR #118 已完成 `his_connections` schema / migration 最小实现。
- PR #119 已完成连接配置只读 repository 最小实现。
- PR #120 已完成机构端 list / detail 只读 API。
- PR #121 已完成连接配置只读 UI / workspace 入口 Plan Mode。
- PR #122 已完成机构端 workspace「HIS 连接配置」入口和 `HisConnectionReadOnlyPanel`。
- PR #123 已完成只读 UI smoke / 文档收尾。
- 当前 `his_connections` 状态枚举已包含 `draft`、`active`、`paused`、`revoked`、`deleted` 和 `error`。
- 当前 repository 只提供 `listHisConnectionsByTenant` 和 `getHisConnectionByTenant`，没有写入方法。
- 当前 API 只有 list / detail GET，不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw HIS payload。
- 当前 API 只使用服务端 access context 的 `tenantId`，不接受 query 或 header tenantId 切换租户。
- 当前权限模型只给 `tenant_admin` `open_connection:read_own_tenant`，尚未规划或实现写入权限。
- 现有写入 API 风格使用服务端 access context、payload 白名单、tenant-scoped repository、稳定错误态和安全审计。
- 现有审计记录只应包含安全元数据，不应包含 SQL、stack、token、secret、`DATABASE_URL`、连接串、完整正文或 raw payload。

因此本 PR 不需要改 TypeScript、测试、API、schema、migration、权限、认证、租户隔离、UI 或 demo seed。

## 2. 文件职责规划

- `docs/superpowers/specs/2026-06-03-phase23-his-connection-write-api-v1-design.md`
  - 说明 Phase 23 定位、非目标、拟规划 API、输入字段边界、租户与权限边界、状态流转、审计规划、错误态、数据最小化结论和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-phase23-his-connection-write-api-v1.md`
  - 说明当前 docs-only PR 的范围、只读检查结论、文件职责、执行步骤、验收清单、验证命令和停止条件。
- `README.md`
  - 轻量同步 Phase 23 Plan Mode 状态，明确仍未实现写入 API、写入 repository、凭证管理、测试连接或真实 HIS adapter。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步路线图：Phase 23 只规划写入 API 与状态流转边界，后续实现和凭证 / 测试 / adapter 均需独立 PR。
- `docs/devlog/2026-06-03.md`
  - 记录本 PR 分支、目标、完成项、边界和验证命令。

## 3. 当前 docs-only 执行步骤

### 任务 1：新增设计文档

**文件：**

- 新增：`docs/superpowers/specs/2026-06-03-phase23-his-connection-write-api-v1-design.md`

- [ ] 写明本 PR 是 Phase 23 Plan Mode，不是写入 API、repository、schema / migration、凭证管理、测试连接或真实 HIS adapter 实现。
- [ ] 写明不连接真实 HIS、不处理真实客户数据、不保存真实凭证、不保存 raw HIS payload。
- [ ] 规划未来 API：`POST /api/institution/his-connections`、`PATCH /api/institution/his-connections/[connectionId]`、pause、resume、revoke 和 delete。
- [ ] 明确 create / update / status API 不处理凭证明文，不返回 `credentialRef`，不做测试连接，不调用真实 HIS。
- [ ] 明确 `credentialRef` v1 暂不允许写入，只作为后续凭证管理集成点规划。
- [ ] 明确 create / update 只允许 `connectionName`、`sourceSystem`、`vendorType` 和 `systemType` 等安全元数据。
- [ ] 明确严禁输入 `tenantId`、`id`、审计字段、生命周期时间戳、凭证明文、token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串、raw HIS payload、完整请求 / 响应体、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、SQL、stack 和 `DATABASE_URL`。
- [ ] 规划 `tenantId` 只来自服务端 access context，不接受 body / query / header / localStorage。
- [ ] 规划机构管理员、普通机构人员和平台代管边界，明确不改现有权限模型，除非后续独立 Plan Mode。
- [ ] 规划状态 `draft`、`active`、`paused`、`revoked`、`deleted`、`error` 的语义和流转边界。
- [ ] 明确 `revoked` 不应普通恢复为 `active`，`deleted` 是软删除 / 归档，`error` 不保存外部错误全文。
- [ ] 明确 pause / resume / revoke / delete 必须审计，状态流转不代表测试连接或真实 HIS 调用已实现。
- [ ] 规划审计事件 `his_connection:create`、`his_connection:update`、`his_connection:pause`、`his_connection:resume`、`his_connection:revoke` 和 `his_connection:delete`。
- [ ] 明确审计只记录安全元数据，禁止记录凭证、raw HIS payload、SQL、stack、`DATABASE_URL` 或外部系统错误响应全文。
- [ ] 规划稳定错误码：`unauthorized`、`forbidden`、`not_found`、`validation_failed`、`conflict`、`invalid_state_transition` 和 `service_unavailable`。
- [ ] 写明后续 PR A-I 拆分。

### 任务 2：新增计划文档

**文件：**

- 新增：`docs/superpowers/plans/2026-06-03-phase23-his-connection-write-api-v1.md`

- [ ] 记录当前 PR 范围和非目标。
- [ ] 记录只读检查文件和结论。
- [ ] 规划文件职责。
- [ ] 列出当前 docs-only 执行步骤。
- [ ] 列出验收清单、验证命令和停止条件。

### 任务 3：轻量同步项目文档

**文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-06-03.md`

- [ ] README 增加 Phase 23 写入 API 与状态流转边界 Plan Mode 状态。
- [ ] roadmap 增加 Phase 23 规划完成状态，并保留写入 repository、API 实现、凭证管理、测试连接和真实 adapter 未实现的边界。
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

## 4. 后续 PR 拆分建议

建议后续拆分为：

- PR A：Phase 23 写入 API Plan Mode（当前 PR）。
- PR B：写入 repository Plan Mode。
- PR C：create / update repository 实现。
- PR D：create / update API 实现。
- PR E：pause / resume / revoke / delete 状态 API。
- PR F：审计补强。
- PR G：凭证管理 Plan Mode。
- PR H：测试连接 Plan Mode。
- PR I：真实 HIS adapter Plan Mode。

凭证录入、加密、轮换、撤销、测试连接、健康检查、真实 HIS adapter、Webhook / 同步、患者身份匹配、自动摘要、自动任务和自动触达都不得混入当前 Phase 23 docs-only PR。

## 5. 验收清单

- 设计文档明确当前 PR 是 Phase 23 Plan Mode，不是写入 API、写入 repository、schema / migration、凭证管理、测试连接或真实 HIS adapter。
- 设计文档明确不写代码、不改测试、不新增 API、不改 schema / migration、不改权限、认证或租户隔离。
- 设计文档覆盖拟规划 API：create、update、pause、resume、revoke 和 delete。
- 设计文档明确 create / update / status API 不处理凭证明文，不返回 `credentialRef`，不做测试连接，不调用真实 HIS。
- 设计文档明确 create / update 只允许安全元数据字段。
- 设计文档明确禁止输入字段和敏感内容。
- 设计文档明确 `tenantId` 只来自服务端 access context，跨租户目标不可见。
- 设计文档覆盖机构管理员、普通机构人员和平台代管权限边界，明确不改现有权限模型。
- 设计文档覆盖 `draft`、`active`、`paused`、`revoked`、`deleted`、`error` 状态语义和流转边界。
- 设计文档明确 `revoked` 不普通恢复、`deleted` 是软删除 / 归档、`error` 只保存安全错误码。
- 设计文档覆盖审计事件、允许记录项和禁止记录项。
- 设计文档覆盖稳定错误码和错误响应禁止项。
- 设计文档列出后续 PR A-I 拆分。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、测试、API、schema、migration、权限、认证、租户隔离、UI 或 demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 6. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须写代码才能完成当前 docs-only PR。
- 必须改测试。
- 必须新增 API 或修改现有 API。
- 必须做写入 repository。
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
