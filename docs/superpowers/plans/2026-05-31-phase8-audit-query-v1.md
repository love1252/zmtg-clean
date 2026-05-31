# Phase 8 审计日志只读查询 v1 实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 建设审计日志只读查询基础版，让机构端查看本租户审计事件，让平台端按明确角色边界查看受控审计事件。

**架构方案：** Phase 8 复用现有 `audit_events` 表和 Phase 7 已完成的 `resource_id`，先在 audit 模块补齐查询 parser、repository 和 DTO，再分别接入机构端与平台端只读 API/UI。本阶段默认不新增 schema / migration，不新增 `metadata jsonb`，不存请求体或隐私正文。

**技术栈：** Next.js App Router、React client components、TypeScript、Vitest、Testing Library、Drizzle、PostgreSQL、现有 `AccessContext` / RBAC / `audit_events` / `InstitutionPageState`。

---

## 当前 PR 状态

Phase 8 已在 PR 1-5 中完成。本文件最初属于 Phase 8 PR 1；PR 5 将其更新为收尾状态记录。

PR 5 只做 smoke / 文档收尾，不做：

- 新增业务功能。
- API route。
- 数据库 schema / migration。
- 权限、认证或租户隔离修改。
- 机构端或平台端审计业务逻辑修改。
- Phase 9 实现。

## 总边界

Phase 8 做：

- 审计日志只读查询基础版。
- 机构端本租户审计查询。
- 平台端受控审计查询。
- 筛选参数白名单。
- 分页 / limit。
- DTO 脱敏。
- smoke 和文档收尾。

Phase 8 不做：

- 平台租户管理基础版实现。
- 治疗记录结构化摘要实现。
- AI provider。
- Agent。
- RAG / 知识库真实功能。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 套餐权益 enforcement。
- 完整平台商业化后台。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 自动触达客户。
- 大规模 UI 重构。
- 审计导出。
- 审计告警系统。
- 复杂风控。
- 自由 `metadata jsonb`。

## 文件职责规划

PR 1 只新增：

- `docs/superpowers/specs/2026-05-31-phase8-audit-query-v1-design.md`
  - Phase 8 目标、优先级、安全边界、API 建议、schema 决策和 PR 拆分。
- `docs/superpowers/plans/2026-05-31-phase8-audit-query-v1.md`
  - 后续 PR 执行计划、风险和验证方式。

Phase 8 后续 PR 实际涉及：

- `src/modules/audit/domain/audit-event-query.ts`
  - 定义审计查询参数、DTO、分页和可见范围类型。
- `src/modules/audit/server/audit-event-query-parser.ts`
  - 白名单解析 `from`、`to`、`resource`、`resourceId`、`action`、`result`、`reason`、`actorId`、`limit`、`cursor`。
- `src/modules/audit/server/audit-event-repository.ts`
  - 新增只读查询方法，保持写入能力不变。
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
  - 覆盖筛选白名单、非法参数、limit 和 cursor。
- `src/modules/audit/tests/AuditEventRepository.test.ts`
  - 覆盖 tenant 查询、平台可见范围和 DTO 脱敏。
- `src/app/api/institution/audit-events/route.ts`
  - PR 3 新增机构端审计查询 API。
- `src/modules/audit/client/institution-audit-events-client.ts`
  - PR 3 封装机构端审计查询 fetch。
- `src/modules/institution/components/InstitutionAuditEventsShell.tsx`
  - PR 3 新增机构端只读 UI。
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - PR 3 增加审计日志入口或轻量面板，不做大规模 UI 重构。
- `src/app/api/open-platform/audit-events/route.ts`
  - PR 4 新增平台端审计查询 API。
- `src/modules/audit/client/open-platform-audit-events-client.ts`
  - PR 4 封装平台端审计查询 fetch。
- `src/modules/open-platform/components/OpenPlatformAuditEventsPanel.tsx`
  - PR 4 新增平台端只读 UI。
- `src/modules/open-platform/tests/*`
  - PR 4 覆盖平台角色边界和敏感字段。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - PR 3/4/5 覆盖入口 smoke。
- `README.md`
  - PR 5 标记 Phase 8 完成。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - PR 5 更新路线图。
- `docs/devlog/2026-05-31.md`
  - PR 5 记录 Phase 8 结果。

## 安全规则总览

机构端：

- 只能查看 `context.tenantId` 下的审计事件。
- 不接受 `tenantId` query、header 或 body。
- 不查看平台全局事件。
- 不查看其他租户事件。
- 不返回 `tenantId` 作为可切换维度。

平台端：

- `security_auditor` 适合查看跨租户安全事件。
- `platform_admin` v1 可访问平台审计只读列表，但只返回安全 DTO，不允许查看业务正文、导出、告警、批量操作或下钻租户业务详情。
- `platform_operator` 与机构角色不可访问平台审计 API。
- 如果后续需要更细粒度跨租户安全运营能力，应由 `security_auditor` 承接并单独进入 Plan Mode。

所有端：

- 不返回请求体、metadata、SQL、stack、token、secret、`DATABASE_URL`、连接串、手机号原文、身份证号、病历号原文、治疗记录正文、完整病历正文、咨询对话全文或业务正文。

## PR 1：Phase 8 spec/plan 文档

**范围：**

- 新增 Phase 8 design spec。
- 新增 Phase 8 implementation plan。
- 只做文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证或租户隔离。
- 不进入审计查询代码开发。
- 不进入平台租户管理或治疗记录开发。

**涉及文件：**

- 新建：`docs/superpowers/specs/2026-05-31-phase8-audit-query-v1-design.md`
- 新建：`docs/superpowers/plans/2026-05-31-phase8-audit-query-v1.md`

**风险：**

- 文档边界不清，导致后续 PR 混入平台租户管理、治疗记录、AI、企微、OAuth、Webhook、支付或套餐权益。
- 平台端角色边界写得过宽，误导后续实现成租户业务详情下钻或导出能力。
- 忽略 `security_auditor` 与 `platform_admin` 的差异。

**控制：**

- 明确 Phase 8 只做审计日志只读查询基础版。
- 明确平台端租户管理和治疗记录后置。
- 明确机构端只能看本租户审计事件。
- 明确 `security_auditor` 承接跨租户安全事件。
- 明确 `platform_admin` v1 只能查看安全 DTO，不可查看业务正文、导出、告警、批量操作或下钻租户业务详情。
- 明确不新增 schema / migration、不新增 `metadata jsonb`、不存请求体。

**步骤：**

- [x] **步骤 1：从最新 main 创建文档分支**

运行：

```bash
git fetch origin main
git switch -c docs/phase8-audit-query-plan
```

预期：分支创建自最新 `main`。

- [x] **步骤 2：新增 Phase 8 设计文档**

新建：

```text
docs/superpowers/specs/2026-05-31-phase8-audit-query-v1-design.md
```

文档必须覆盖：

- Phase 8 目标。
- 为什么优先做审计日志只读查询。
- 为什么平台租户管理和治疗记录后置。
- 审计日志只读查询 v1 的范围。
- 不纳入本阶段的内容。
- 机构端审计可见范围。
- 平台端审计可见范围。
- `security_auditor` 与 `platform_admin` 的角色边界建议。
- 筛选参数白名单。
- 分页 / limit 规则。
- 返回 DTO 字段边界。
- 敏感字段禁止返回边界。
- 租户隔离边界。
- 是否新增 API。
- 是否新增 schema / migration。
- 推荐 PR 拆分。
- 每个 PR 的范围、风险和验证方式。

- [x] **步骤 3：新增 Phase 8 实施计划**

新建：

```text
docs/superpowers/plans/2026-05-31-phase8-audit-query-v1.md
```

计划必须覆盖：

- 标准计划页首。
- 当前 PR 状态。
- 总边界。
- 文件职责规划。
- 机构端 / 平台端 / 敏感字段安全规则。
- PR 1 到 PR 5 的范围、风险、控制和验证方式。

- [x] **步骤 4：验证 Markdown diff**

运行：

```bash
git diff --check
```

预期：退出码 0，无 trailing whitespace。

本 PR 只修改 Markdown，不运行完整 test/typecheck/build。原因：未修改 TypeScript、页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

- [x] **步骤 5：提交并创建 Draft PR**

运行：

```bash
git add docs/superpowers/specs/2026-05-31-phase8-audit-query-v1-design.md docs/superpowers/plans/2026-05-31-phase8-audit-query-v1.md
git commit -m "docs: 固化 Phase 8 审计查询计划"
git push -u origin docs/phase8-audit-query-plan
```

Draft PR 标题：

```text
docs: 固化 Phase 8 审计查询计划
```

PR 描述必须说明：

- 本次只做 Phase 8 PR 1。
- 只新增 spec/plan 文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不进入审计查询代码开发。
- 不进入平台租户管理或治疗记录开发。

## PR 2：审计查询 domain/repository/query parser/API DTO

**范围：**

- 新增审计查询 domain 类型。
- 新增筛选参数 parser。
- 新增 DTO mapper。
- 新增审计查询 repository 方法。
- 补测试。
- 不做 API route。
- 不做 UI。
- 不新增 schema / migration。

**建议涉及文件：**

- 新建：`src/modules/audit/domain/audit-event-query.ts`
- 新建：`src/modules/audit/server/audit-event-query-parser.ts`
- 修改：`src/modules/audit/server/audit-event-repository.ts`
- 新建：`src/modules/audit/tests/AuditEventQueryParser.test.ts`
- 修改：`src/modules/audit/tests/AuditEventRepository.test.ts`

**实现要求：**

- Parser 只接受 `from`、`to`、`resource`、`resourceId`、`action`、`result`、`reason`、`actorId`、`limit`、`cursor`。
- `resource` 必须属于 `ACCESS_RESOURCES`。
- `action` 必须属于 `ACCESS_ACTIONS`。
- `result` 必须属于 `allowed`、`denied`、`transitioned`。
- `reason` 必须属于已知 `AuditReason`。
- `limit` 默认 50，最大 100。
- `cursor` 使用 opaque 字符串。
- repository 不接受任意 SQL 字符串。
- DTO mapper 只输出允许字段。

**风险：**

- 查询 parser 接受任意字段或任意排序。
- repository 查询未带 tenant 边界。
- DTO 泄露 metadata、请求体、SQL、stack、token 或 secret。
- 分页 cursor 设计不稳定，导致重复或漏数据。

**控制：**

- 先写 parser 测试，覆盖非法字段、非法枚举、非法 limit、非法 cursor。
- repository 测试覆盖机构范围、平台范围、排序和 DTO 脱敏。
- 使用 Drizzle 条件构造，不拼接 SQL 字符串。
- 查询排序固定为 `occurred_at desc, event_id asc`。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 3：机构端审计只读 API 与基础 UI

**范围：**

- 新增 `GET /api/institution/audit-events`。
- 机构端页面展示本租户审计事件。
- 基础筛选。
- 分页。
- loading / empty / error / 403 / 503。
- 不展示敏感字段。
- 不允许机构端切换租户。

**建议涉及文件：**

- 新建：`src/app/api/institution/audit-events/route.ts`
- 新建：`src/modules/audit/client/institution-audit-events-client.ts`
- 新建：`src/modules/institution/components/InstitutionAuditEventsShell.tsx`
- 修改：`src/modules/workspace/domain/institution-dashboard.ts`
- 修改：`src/modules/workspace/components/InstitutionWorkspace.tsx`
- 新建或修改：`src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
- 新建或修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**实现要求：**

- API 从 `getDemoAccessContextFromRequest(request)` 获取访问上下文。
- 未登录返回 401。
- 无权限返回 403。
- 缺少 tenant 返回 403。
- 查询只使用 `context.tenantId`。
- URL、query、header、body 中的 `tenantId` 不参与查询。
- 返回机构端 DTO 时省略 `tenantId`。
- UI 不展示平台全局事件。
- UI 不展示业务正文或敏感字段。

**风险：**

- 机构端通过 query/header/body 传入 `tenantId` 查看其他租户。
- UI 把 `tenantId` 做成可切换筛选。
- 页面显示请求体、SQL、stack 或凭证明文。
- 错误态泄露数据库连接信息。

**控制：**

- Route 测试覆盖恶意 `tenantId` query/header/body。
- Route 测试覆盖跨租户事件不会返回。
- UI 测试覆盖不展示 `tenantId`、metadata、requestBody、SQL、stack、token、secret、手机号原文、身份证号、病历号原文、治疗记录正文、咨询全文。
- 复用 `InstitutionPageState` 展示稳定错误态。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests src/modules/institution/tests src/modules/workspace/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 4：平台端审计 API 与平台 UI

**范围：**

- 新增平台端审计查询 API。
- 使用 `GET /api/open-platform/audit-events`。
- 明确 `security_auditor` / `platform_admin` 可见范围。
- 平台 UI 只读展示。
- 不做导出。
- 不做告警。
- 不做复杂风控。
- 不做租户业务详情下钻。

**建议涉及文件：**

- 新建：`src/app/api/open-platform/audit-events/route.ts`
- 新建：`src/modules/audit/client/open-platform-audit-events-client.ts`
- 新建：`src/modules/open-platform/components/OpenPlatformAuditEventsPanel.tsx`
- 修改：`src/modules/workspace/components/PlatformConsole.tsx`
- 新建或修改：`src/modules/audit/tests/OpenPlatformAuditEventsApiRoute.test.ts`
- 新建或修改：`src/modules/open-platform/tests/OpenPlatformAuditEventsPanel.test.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**实现要求：**

- `security_auditor` 可查看跨租户安全事件和平台级审计事件。
- `platform_admin` v1 可访问平台审计只读列表，但只返回安全 DTO。
- 当前演示环境没有新增 `security_auditor` 登录入口，也不重构权限模型。
- 平台端返回 `tenantId` 必须由角色边界控制。
- 平台 UI 不提供按任意租户读取业务详情的能力。

**风险：**

- 平台端审计列表被误扩展成租户业务详情下钻。
- 平台 UI 泄露租户业务正文。
- 没有 `security_auditor` 登录时为了演示方便扩大权限。
- 平台 API 通过 `tenantId` query 变成任意租户下钻接口。

**控制：**

- 角色测试覆盖 `security_auditor`、`platform_admin`、`platform_operator`、`tenant_admin`。
- 平台 API 测试覆盖不返回业务正文和敏感字段。
- PR 描述明确本阶段不做导出、告警、复杂风控或租户业务详情下钻。
- 如果需要补演示账号，必须单独说明 auth 变化范围，不能顺手扩大 RBAC。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests src/modules/open-platform/tests src/modules/security/tests src/modules/workspace/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 5：Phase 8 smoke / 文档收尾

**范围：**

- 补 smoke 测试。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 标记 Phase 8 完成。
- 不进入平台租户管理。
- 不进入治疗记录。
- 不进入 AI、RAG、Agent、企微、OAuth、Webhook、支付或套餐权益。

**建议涉及文件：**

- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase8-audit-query-v1-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase8-audit-query-v1.md`

**实现要求：**

- smoke 覆盖机构入口进入审计日志页面。
- smoke 覆盖机构端只请求本租户审计 API，不发送 mutation，不携带 `tenantId`，页面不展示租户 ID。
- smoke 覆盖平台端审计页面入口、平台 `tenantId` 筛选和受控角色边界。
- smoke 覆盖请求体、metadata、SQL、stack、token、secret、DATABASE_URL、连接串、手机号原文、身份证号、病历号原文、治疗记录正文、咨询对话全文和业务正文不展示。
- 文档明确 Phase 8 完成范围，不宣称审计导出、告警、复杂风控、平台租户管理或治疗记录完成。

**风险：**

- 文档收尾时把后置能力写成已完成。
- smoke 只覆盖成功态，遗漏权限和敏感字段。
- README 或 roadmap 暗示平台端可查看租户业务详情。

**控制：**

- README 只标记“审计日志只读查询基础版”。
- roadmap 保持平台租户管理、治疗记录、AI、企微、支付后置。
- devlog 明确 Phase 8 未新增 schema / migration，除非后续 PR 真实改变该决策。
- smoke 测试检查 token、secret、DATABASE_URL、SQL、stack、手机号原文、身份证号、病历号原文、治疗记录正文、咨询全文不展示。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests src/modules/institution/tests src/modules/open-platform/tests src/modules/workspace/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
node scripts/run-vitest.mjs run
```

## Phase 8 完成交接标准

Phase 8 PR 5 收尾时必须满足：

- 机构端只能查看当前租户审计事件。
- 平台端可见范围符合 `security_auditor` / `platform_admin` 边界。
- 筛选参数全部白名单解析。
- 分页和 limit 行为稳定。
- API 不接受客户端 `tenantId` 切换租户。
- DTO 不返回敏感字段。
- README、roadmap、devlog、Phase 8 spec / plan 标记 Phase 8 完成，并明确未做导出、告警、复杂风控、平台租户管理、治疗记录、AI / RAG / Agent、企微、OAuth、Webhook 或支付。
- 全量验证通过：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests src/modules/institution/tests src/modules/open-platform/tests src/modules/workspace/tests
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```
