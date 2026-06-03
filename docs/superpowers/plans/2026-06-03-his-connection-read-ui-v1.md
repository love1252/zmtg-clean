# HIS 连接配置只读 UI / workspace 入口 v1 实施计划

> **给执行 agent 的说明：** 实施本计划时需使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项推进。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 只做 HIS 连接配置只读 UI / workspace 入口 Plan Mode，规划未来机构端如何安全展示连接配置列表与详情状态。

**架构说明：** 当前 PR 不改系统架构，只新增和同步 Markdown。未来 UI 只能消费现有 list / detail 只读 API，继续由服务端 access context 决定租户边界，前端只展示安全 DTO 字段和稳定状态文案。

**技术栈：** 当前 PR 只涉及 Markdown。后续如单独批准 UI 实现，才可能涉及 Next.js App Router、React、TypeScript、lucide-react、现有 workspace shell、InstitutionPageState、InstitutionSectionHeader 和 workspace smoke 测试。

---

## 0. 当前 PR 范围

新增：

- `docs/superpowers/specs/2026-06-03-his-connection-read-ui-v1-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-read-ui-v1.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`

当前 PR 不做：

- 不写代码。
- 不改 UI。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接真实 HIS。
- 不接机构系统。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存任何真实凭证。
- 不返回 `credentialRef`。
- 不返回凭证明文。
- 不保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。
- 不做测试连接实现。

验证命令：

```bash
git diff --check
git diff --cached --check
```

本 PR 不需要跑 Vitest、typecheck 或 Next build，除非误改了代码、测试、API、schema、migration 或 UI 文件。

## 1. 只读检查结论

本次按要求只读检查了：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-06-03.md`
- `docs/superpowers/specs/2026-06-03-his-connection-schema-api-v1-design.md`
- `docs/superpowers/plans/2026-06-03-his-connection-schema-api-v1.md`
- `src/app/api/institution/his-connections/route.ts`
- `src/app/api/institution/his-connections/[connectionId]/route.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionApiRoutes.test.ts`

并只读检查了现有 workspace / institution UI 风格：

- `src/modules/workspace/components/InstitutionWorkspace.tsx`
- `src/modules/workspace/domain/institution-dashboard.ts`
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- `src/modules/institution/components/InstitutionPageState.tsx`
- `src/modules/institution/components/InstitutionSectionHeader.tsx`
- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
- `src/modules/institution/components/InstitutionAuditEventsShell.tsx`
- `src/modules/institution/components/**`
- `src/modules/institution/tests/**`

已确认：

- 当前 main HEAD 为 `3fad0b2bfc1c30de0c778d533e09973e1af581ef`。
- 当前工作区开始时干净，本 PR 从 `docs/his-connection-read-ui-plan` 分支执行。
- PR #118 已完成 `his_connections` schema / migration 最小实现。
- PR #119 已完成只读 repository 最小实现。
- PR #120 已完成机构端 list / detail 只读 API 最小实现。
- 现有 API 只返回安全 DTO：`connectionId`、`connectionName`、`sourceSystem`、`vendorType`、`systemType`、`status`、`credentialConfigured`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`createdAt`、`updatedAt`、`revokedAt`。
- 现有 API 不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw HIS payload。
- 现有 API 使用服务端 access context 的 `tenantId`，不接受 query 或 header tenantId 切换租户。
- 详情 API 对跨租户、不存在、空 ID 或已软删除统一返回稳定 `not_found`。
- 现有 UI 风格使用机构端导航、`InstitutionPageState`、`InstitutionSectionHeader`、卡片列表、安全详情和只读边界说明。

因此本 PR 不需要改 TypeScript、测试、API、schema、migration、权限、认证、租户隔离或 demo seed。

## 2. 文件职责规划

- `docs/superpowers/specs/2026-06-03-his-connection-read-ui-v1-design.md`
  - 说明本 PR 定位、非目标、未来 workspace 入口、列表卡片、详情区、状态文案、允许展示字段、禁止展示字段、错误态、空态、API 关系、安全边界和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-his-connection-read-ui-v1.md`
  - 说明当前 docs-only PR 的范围、只读检查结论、文件职责、执行步骤、后续 UI 实现拆分建议、验收清单、验证命令和停止条件。
- `README.md`
  - 轻量同步只读 UI / workspace 入口 Plan Mode 状态，明确仍未进入 UI 实现、写入 API、凭证管理、测试连接或真实 HIS adapter。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步路线图：只读 UI / workspace 入口已完成规划，但 UI 实现、smoke、写入 API、凭证管理、测试连接和真实 adapter 仍需单独 PR。
- `docs/devlog/2026-06-03.md`
  - 记录本 PR 范围、完成项、边界和验证命令。

## 3. 当前 docs-only 执行步骤

### 任务 1：新增设计文档

**文件：**

- 新增：`docs/superpowers/specs/2026-06-03-his-connection-read-ui-v1-design.md`

- [ ] 写明本 PR 是 HIS 连接配置只读 UI / workspace 入口 Plan Mode，不是 UI、API、写入能力、凭证管理、测试连接或 HIS adapter 实现。
- [ ] 写明不连接真实 HIS、不处理真实客户数据、不保存真实凭证、不保存 raw HIS payload。
- [ ] 规划未来 workspace 入口、列表卡片、详情区、只读状态说明和后续操作占位。
- [ ] 明确 UI 只能调用 `GET /api/institution/his-connections` 和 `GET /api/institution/his-connections/[connectionId]`。
- [ ] 明确 UI 不传可信 `tenantId`，不拼接 query / header tenantId，不直接访问 repository，不读 `credentialRef`，不读 raw payload。
- [ ] 明确允许展示字段：`connectionId`、`connectionName`、`sourceSystem`、`vendorType`、`systemType`、`status`、`credentialConfigured`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`createdAt`、`updatedAt`、`revokedAt`。
- [ ] 明确禁止展示 `tenantId`、`deletedAt`、`credentialRef`、凭证明文、token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串、raw HIS payload、完整请求体、完整响应体、外部系统错误响应全文、SQL、stack、`DATABASE_URL`、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文和客户业务明细。
- [ ] 规划连接状态文案：`draft` 草稿、`active` 已启用、`paused` 已暂停、`revoked` 已撤销、`deleted` 已归档、`error` 异常。
- [ ] 规划健康状态文案：`unknown` 未检查、`healthy` 正常、`degraded` 降级、`failed` 失败。
- [ ] 明确这些状态文案不代表测试连接或真实 HIS 调用已实现。
- [ ] 规划无连接空态、API 加载失败、无权限 / 未登录和详情 `not_found` 的稳定展示边界。
- [ ] 写明后续 PR A-G 拆分，且只读 UI 实现不得混入写入 API、凭证管理或测试连接。

### 任务 2：新增计划文档

**文件：**

- 新增：`docs/superpowers/plans/2026-06-03-his-connection-read-ui-v1.md`

- [ ] 记录当前 PR 范围和非目标。
- [ ] 记录只读检查文件和结论。
- [ ] 规划文件职责。
- [ ] 列出当前 docs-only 执行步骤。
- [ ] 列出后续 UI 实现拆分建议、验收清单和停止条件。
- [ ] 明确 docs-only 验证命令。

### 任务 3：轻量同步项目文档

**文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-06-03.md`

- [ ] README 增加 HIS 连接配置只读 UI / workspace 入口 Plan Mode 状态。
- [ ] roadmap 增加只读 UI / workspace 入口规划完成状态，并保留 UI 实现、smoke、写入 API、凭证管理、测试连接和真实 adapter 未实现的边界。
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

- PR A：只读 UI Plan Mode（当前 PR）。
- PR B：workspace 入口轻量 UI 实现。
- PR C：只读 UI smoke / 文档收尾。
- PR D：create / update API Plan Mode。
- PR E：凭证管理 Plan Mode。
- PR F：测试连接 Plan Mode。
- PR G：真实 HIS adapter Plan Mode。

只读 UI 实现不得混入写入 API、凭证管理、测试连接、真实 HIS adapter、患者身份匹配、自动摘要、自动任务或自动触达。

## 5. 后续 UI 实现最小验收建议

后续 PR B 如进入 UI 实现，最小验收应包括：

- workspace 有清晰的 HIS 连接配置只读入口。
- UI 只调用 `GET /api/institution/his-connections` 和 `GET /api/institution/his-connections/[connectionId]`。
- UI 请求不带 query / header / body `tenantId`。
- 列表展示安全摘要字段，不展示 `tenantId`、`deletedAt`、`credentialRef`、凭证明文或 raw payload。
- 详情展示安全摘要字段，并在 `not_found` 时不泄露跨租户目标是否存在。
- 空态、loading、401、403、404、503 和通用失败态均为稳定文案。
- 页面明确只读边界：配置凭证、测试连接、启停连接需后续单独实现。
- 不新增 create / update / pause / resume / revoke / delete 请求。
- 不保存 raw HIS payload，不处理真实凭证，不接真实 HIS。

后续 PR C 如进入 smoke / 文档收尾，最小验收应包括：

- workspace smoke 覆盖入口、列表、详情、安全字段、空态、失败态和 `tenantId` 不拼接。
- smoke 覆盖敏感字段不展示：`tenantId`、`deletedAt`、`credentialRef`、token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串、raw payload、SQL、stack、`DATABASE_URL`、外部错误全文、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- README、roadmap、devlog 同步 UI 最小实现或 smoke 收尾状态。

## 6. 验收清单

- 设计文档明确当前 PR 是只读 UI / workspace 入口 Plan Mode，不是 UI 实现、API 实现、写入能力、凭证管理、测试连接或 HIS adapter。
- 设计文档明确不连接真实 HIS、不处理真实客户数据、不保存真实凭证、不保存 raw HIS payload。
- 设计文档明确不新增 API、不改 schema / migration、不改权限、认证或租户隔离。
- 设计文档覆盖 workspace 入口、列表卡片、详情区、状态说明、只读边界和后续操作占位。
- 设计文档覆盖允许展示字段和禁止展示字段。
- 设计文档覆盖连接状态和健康状态中文文案，并说明不代表测试连接或真实 HIS 调用已实现。
- 设计文档覆盖无连接空态、API 加载失败、无权限 / 未登录和详情 `not_found` 边界。
- 设计文档明确 UI 只能调用已有只读 API，不能传可信 `tenantId`，不能直接访问 repository，不能读 `credentialRef` 或 raw payload。
- 设计文档列出后续 PR A-G 拆分。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、UI、测试、API、schema、migration、权限、认证、租户隔离或 demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 7. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须写代码才能完成当前 docs-only PR。
- 必须改 UI。
- 必须改测试。
- 必须新增 API 或修改现有 API。
- 必须改数据库 schema 或新增 migration。
- 必须改权限、认证或租户隔离。
- 必须接真实 HIS、机构系统、企微或其他外部系统。
- 必须接 AI / RAG / Agent。
- 必须自动触达客户。
- 必须导入真实客户数据。
- 必须保存 raw HIS payload。
- 必须保存任何真实凭证。
- 必须返回 `credentialRef`。
- 必须返回凭证明文。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要。
- 必须自动创建随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
