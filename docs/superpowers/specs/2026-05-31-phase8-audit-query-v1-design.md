# Phase 8 审计日志只读查询 v1 设计

> 日期：2026-05-31
> 状态：Phase 8 PR 1 规划文档。本文只定义审计日志只读查询基础版的目标、边界、API 建议、安全约束和 PR 拆分，不进入代码实现。

## 1. Phase 8 目标

Phase 8 推荐选择“审计日志只读查询基础版”，目标是在 Phase 7 已完成 `audit_events.resource_id` enrich 的基础上，让审计事件从“只写入、只能被窄场景聚合”推进到“可按权限只读查询”。

本阶段目标包括：

- 为机构端提供本租户审计事件只读查询能力。
- 为平台端提供受控的审计事件只读查询能力。
- 支持基础筛选、分页和稳定错误态。
- 复用现有 `audit_events` 表和 Phase 7 已完成的 `resource_id`。
- 严格限制可见范围、返回 DTO 和敏感字段。
- 不进入审计导出、告警、复杂风控或权限模型重构。

Phase 8 不改变前几个阶段的根原则：租户编号只能来自服务端访问上下文，前端不能通过 URL、header、body 或浏览器缓存切换租户。

## 2. 为什么优先做审计日志只读查询

审计日志只读查询是 Phase 7 的自然延伸：

- Phase 5 已完成客户、预约、随访真实 API 和受控写入。
- Phase 6 已完成机构工作台真实 API 摘要、页面状态和导航边界。
- Phase 7 已完成客户详情时间线、最小 `resource_id` enrich 和客户级安全审计摘要。
- 当前审计事件已经被写入，但还缺少通用查询 API、筛选白名单、分页和平台 / 机构可见范围定义。

优先做审计查询的价值：

- 对后续 AI、开放平台、企业微信、计费、租户管理等高风险模块提供安全治理地基。
- 能验证现有 RBAC、租户隔离、审计写入和错误脱敏是否可被平台/机构稳定使用。
- 工程准备度高，可复用现有 `audit_events` schema、审计领域模型、仓储、`resource_id` 索引和页面状态组件。
- 相比治疗记录，隐私正文风险更低；相比平台租户管理，更直接补齐系统安全闭环。

## 3. 为什么平台租户管理和治疗记录后置

平台端租户管理基础版具有更直接的商业化价值，但当前 `tenants` 表只有 `id`、`name`、`status` 和时间字段。若要展示真实套餐、配额和商业化状态，需要新增 schema / migration 或引入静态演示配置。Phase 8 不应一边做审计查询，一边引入租户套餐建模和平台商业化后台边界。

治疗记录结构化摘要 v1 对客户详情体验有价值，但涉及医疗隐私和病历相关字段。即使只做摘要，也需要单独设计字段白名单、租户复合外键、内容脱敏、API、UI、测试和医疗正文禁止边界。它应单独进入安全 Plan Mode，不应混入审计查询阶段。

因此 Phase 8 后置以下方向：

- 平台端租户管理基础版。
- 治疗记录结构化摘要 v1。
- AI / RAG / Agent。
- 企业微信 / OAuth / Webhook / 支付。
- 套餐权益 enforcement。

## 4. 审计日志只读查询 v1 范围

Phase 8 v1 包含：

- 审计查询领域类型、筛选参数 parser 和 DTO mapper。
- 审计查询 repository 方法。
- 机构端只读 API：`GET /api/institution/audit-events`。
- 平台端只读 API：优先建议 `GET /api/open-platform/audit-events`，并在 PR 4 中最终确认。
- 机构端基础 UI：列表、筛选、分页、loading、empty、error、403、503。
- 平台端基础 UI：受控只读列表或平台级事件视图，不做导出和告警。
- 测试覆盖筛选白名单、租户隔离、角色边界、敏感字段不返回、错误脱敏和分页。
- README、roadmap、devlog 和 Phase 8 文档收尾。

Phase 8 v1 不追求完整安全运营中心，只做可验证、可审计、可延展的基础只读查询。

## 5. 不纳入本阶段

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
- 复杂风控规则。
- 审计 metadata 扩展。
- 权限模型重构。

## 6. 机构端审计可见范围

机构端只能查看当前服务端访问上下文中的本租户审计事件。

机构端允许：

- 查看 `tenant_id = context.tenantId` 的审计事件。
- 通过白名单参数筛选本租户内事件。
- 查看基础审计字段：事件编号、资源、目标资源编号、动作、结果、原因、操作者、角色和发生时间。
- 使用分页读取事件。

机构端禁止：

- 传入 `tenantId` 切换租户。
- 查询其他租户事件。
- 查看平台全局事件。
- 查看 `tenant_id is null` 的平台级事件。
- 查看请求体、SQL、stack、token、secret、连接串。
- 查看任何业务正文。
- 查看手机号原文、身份证号、病历号原文、治疗记录正文或咨询对话全文。

`GET /api/institution/audit-events` 必须从 session 推导 tenant，不接受 query、header 或 body 中的 `tenantId`。如果请求包含 `tenantId`，v1 建议直接忽略并用测试证明没有参与查询；如果后续希望更强约束，可返回 400，但需要保持与现有机构 API 的租户推导风格一致。

## 7. 平台端审计可见范围

平台端可见范围必须谨慎，不能因为平台端是管理后台就默认放开所有租户明细。

平台端 v1 推荐分为两类视图：

- `security_auditor`：适合查看跨租户安全事件明细，包括安全拒绝、权限边界、平台级审计、租户边界事件和高风险资源的只读审计摘要。
- `platform_admin`：v1 默认只看平台级事件、平台聚合或受控安全摘要，不默认放开全部租户审计明细。

平台端即使允许跨租户查看，也只能返回审计 DTO，不返回租户客户、预约、随访、治疗记录或业务正文。

如果当前演示环境没有可用的 `security_auditor` 登录入口，Phase 8 v1 应先限定为平台管理员的受控只读范围：

- 可查看平台级事件。
- 可查看不包含租户业务正文的安全摘要。
- 不默认展示全部 `tenant_id` 明细。
- 在文档和 UI 中明确“跨租户明细建议由 security_auditor 承接”。

平台端 API 不应允许前端用 `tenantId` 任意切换到某个机构看业务审计。后续若确实需要平台按租户 drill-down，必须单独评审角色、审批流、审计二次留痕和敏感字段范围。

## 8. `security_auditor` 与 `platform_admin` 角色边界建议

`security_auditor`：

- 资源：`audit_log`。
- 动作：`read_detail`，后续可扩展 `review`，本阶段不做 `export_report`。
- 可见范围：跨租户安全事件和平台级审计事件。
- 不允许：修改租户状态、修改权限策略、轮换凭证、导出报告、查看业务正文。

`platform_admin`：

- 资源：平台治理相关资源。
- 动作：v1 可查看平台级事件或聚合摘要。
- 默认不允许：查看所有租户审计明细。
- 如因没有 `security_auditor` 演示账号而临时开放受控只读范围，必须限制 DTO 字段，不显示业务正文，不允许按任意租户深挖客户/预约/随访明细，并在 PR 描述中记录风险。

此边界应尽量复用现有 `canAccessResource` 和 `audit_log` 资源语义。若发现现有 RBAC 无法表达 Phase 8 v1 所需边界，先在文档和测试中明确缺口，不在普通 UI PR 中顺手做权限模型重构。

## 9. API 方案评估

### 9.1 机构端 API

推荐：

```text
GET /api/institution/audit-events
```

要求：

- 机构端使用。
- 强制从 session 推导 `context.tenantId`。
- 不接受 `tenantId`。
- 只查询当前租户事件。
- 支持白名单筛选和分页。
- 返回稳定 DTO。
- 401 返回登录失效。
- 403 返回无权限。
- 400 返回筛选参数非法。
- 503 返回稳定数据服务不可用文案，不泄露数据库、SQL、连接串或密钥。

### 9.2 平台端 API

候选：

```text
GET /api/platform/audit-events
GET /api/open-platform/audit-events
```

建议优先选择：

```text
GET /api/open-platform/audit-events
```

原因：

- 当前平台页面入口是 `/open-platform`。
- 当前开放平台治理模块位于 `src/modules/open-platform`。
- 与现有平台治理语义更一致。

如果后续平台 API 统一采用 `/api/platform/*` 命名，可在 Phase 8 PR 4 中改为 `/api/platform/audit-events`，但必须在文档和测试中保持一致。

平台端 API 要求：

- 角色边界明确。
- 默认不泄露租户业务正文。
- 不默认允许 `platform_admin` 查看全部租户明细。
- `security_auditor` 可以承接跨租户安全事件查询。
- 如果无 `security_auditor` 可用，先使用平台管理员受控只读范围，并记录风险。

## 10. 筛选参数白名单

Phase 8 v1 建议只支持以下 query 参数：

- `from`：ISO 时间或日期字符串，转换为 `occurred_at >= from`。
- `to`：ISO 时间或日期字符串，转换为 `occurred_at <= to`。
- `resource`：必须属于 `ACCESS_RESOURCES`。
- `resourceId`：固定长度和字符集校验，建议只允许字母、数字、下划线、短横线和冒号，最大 96 字符。
- `action`：必须属于 `ACCESS_ACTIONS`。
- `result`：必须属于 `allowed`、`denied`、`transitioned`。
- `reason`：必须属于已知 `AuditReason`。
- `actorId`：固定长度和字符集校验，最大 96 字符。
- `limit`：正整数，默认 50，最大 100。
- `cursor`：推荐使用 opaque cursor，编码上一页最后一条的 `occurredAt` 和 `eventId`。

不推荐 v1 使用自由 `page` 参数。若为了实现简单选择 `page`，必须约束为正整数、固定排序和最大页深，并记录后续改为 cursor 的计划。

所有筛选参数必须白名单解析。禁止：

- 任意 SQL 拼接。
- 任意排序字段。
- 任意字段投影。
- 任意搜索表达式。
- 通过 query、header、body 传入 `tenantId` 切换范围。

## 11. 分页 / limit 规则

推荐排序：

```text
occurred_at desc, event_id asc
```

推荐分页：

- 默认 `limit = 50`。
- 最大 `limit = 100`。
- 小于 1 或大于最大值返回 400。
- `cursor` 为 opaque 字符串，不让前端依赖内部格式。
- 响应包含 `nextCursor` 和 `hasMore`。

建议响应结构：

```ts
type AuditEventListResponse = {
  records: AuditEventListItem[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
    limit: number;
  };
};
```

实现时可以通过查询 `limit + 1` 条判断 `hasMore`，再只返回 `limit` 条。

## 12. 返回 DTO 字段边界

建议 DTO：

```ts
type AuditEventListItem = {
  id: string;
  tenantId?: string | null;
  resource: ProtectedResource;
  resourceId: string | null;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  actorId: string;
  actorRole: AccessRole;
  occurredAt: string;
};
```

字段规则：

- `id` 来自 `event_id`。
- `tenantId` 仅平台端可选返回；机构端不建议展示，也不应作为授权依据。
- `resourceId` 可用于定位资源，但不能反查业务正文。
- `actorId` 和 `actorRole` 可用于审计追踪。
- `occurredAt` 使用 ISO 字符串。

机构端响应建议省略 `tenantId`，因为它只能看到当前租户，展示 `tenantId` 容易诱导前端把租户当作可切换维度。

平台端响应如返回 `tenantId`，必须由角色边界控制，并只用于审计归属展示，不得据此读取业务详情。

## 13. 敏感字段禁止返回边界

Phase 8 v1 禁止返回：

- 请求体。
- `metadata`。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 连接串。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 客服消息全文。
- 外部凭证。
- API Key。
- OAuth token。
- Webhook secret。
- 任意业务正文。

如果后续需要更多审计上下文，不应直接增加 `metadata jsonb`。必须单独进入安全 Plan Mode，定义字段白名单、脱敏、保留周期、查询权限和测试。

## 14. 租户隔离边界

Phase 8 必须延续现有规则：

- 租户编号只能来自服务端 `AccessContext`。
- 机构端 API 不接受客户端传入的 `tenantId`。
- 机构端查询必须强制 `tenant_id = context.tenantId`。
- 平台端 API 必须按角色和 scope 判定可见范围。
- 平台端不能默认读取机构客户、预约、随访或治疗记录明细。
- 403、404、400 和 503 文案不能泄露其他租户是否存在目标事件。
- 所有 query parser 和 repository 方法必须通过测试证明不会使用任意 SQL 拼接。

对于平台端跨租户安全事件，建议 v1 只返回审计 DTO。任何从审计事件跳转到客户、预约、随访、治疗记录或租户完整详情的能力都不进入 Phase 8。

## 15. 是否新增 API

Phase 8 需要新增 API：

- `GET /api/institution/audit-events`
- `GET /api/open-platform/audit-events` 或 `GET /api/platform/audit-events`

PR 3 先实现机构端 API。PR 4 再实现平台端 API，并最终确认平台 API 命名。

## 16. 是否新增 schema / migration

Phase 8 v1 默认不新增 schema / migration。

决策：

- 复用现有 `audit_events`。
- 复用 Phase 7 已完成的 `resource_id`。
- 复用现有索引：
  - `audit_events_tenant_occurred_idx`
  - `audit_events_actor_occurred_idx`
  - `audit_events_tenant_resource_id_occurred_idx`
- 性能不足时后续再单独加索引。
- 本阶段不新增 `metadata jsonb`。
- 不存请求体。
- 不存自由文本隐私内容。

如果 PR 2 在实现查询时发现现有索引无法覆盖必要查询，先在 PR 描述中记录性能风险，不在 Phase 8 v1 顺手扩 schema。索引扩展应单独评估。

## 17. 推荐 PR 拆分

### PR 1：Phase 8 spec/plan 文档

范围：

- 新增 Phase 8 design spec。
- 新增 Phase 8 implementation plan。
- 只做文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证或租户隔离。

风险：

- 文档范围不清，导致后续 PR 混入平台租户管理、治疗记录、AI、开放连接或计费。

验证：

```bash
git diff --check
```

### PR 2：审计查询 domain/repository/query parser/API DTO

范围：

- 新增审计查询领域类型。
- 新增筛选参数 parser。
- 新增 DTO mapper。
- 扩展审计 repository 查询方法。
- 补 domain、parser、repository 测试。
- 不新增 API route。
- 不做 UI。

风险：

- parser 接受未白名单字段。
- repository 使用不受控 SQL 或未带租户边界。
- DTO 泄露 `metadata`、请求体、SQL、stack 或凭证。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 3：机构端审计只读 API 与基础 UI

范围：

- 新增 `GET /api/institution/audit-events`。
- 机构端页面展示本租户审计事件。
- 支持基础筛选和分页。
- 覆盖 loading / empty / error / 403 / 503。
- 不展示敏感字段。
- 不允许前端传入 `tenantId` 切换租户。

风险：

- 机构端越权查看其他租户事件。
- UI 展示 tenantId 并诱导切换租户。
- 错误态泄露数据库、SQL、连接串或密钥。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests src/modules/institution/tests src/modules/workspace/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 4：平台端审计 API 与平台 UI

范围：

- 新增平台端审计查询 API。
- 明确 `security_auditor` / `platform_admin` 可见范围。
- 平台 UI 只读展示。
- 不做导出。
- 不做告警。
- 不做复杂风控。
- 不默认泄露租户业务正文。

风险：

- `platform_admin` 默认获得全部租户审计明细。
- 平台端可通过 tenantId 任意下钻租户业务。
- 当前演示登录没有 `security_auditor` 时边界被临时放大。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/audit/tests src/modules/open-platform/tests src/modules/workspace/tests src/modules/security/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 5：Phase 8 smoke / 文档收尾

范围：

- 补 workspace / audit query smoke 测试。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 标记 Phase 8 完成。
- 不进入平台租户管理或治疗记录实现。

风险：

- 收尾文档宣称未完成能力，例如导出、告警、完整平台审计中心、平台租户管理或治疗记录。
- smoke 只覆盖成功态，遗漏敏感字段和租户隔离。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 18. Phase 8 完成标准

Phase 8 完成时应满足：

- 机构端可按白名单筛选当前租户审计事件。
- 平台端可按明确角色边界查看受控审计事件。
- API 不接受客户端 tenantId 切换租户。
- 返回 DTO 不包含请求体、metadata、SQL、stack、token、secret、连接串或业务正文。
- `resource_id` 可用于审计目标资源筛选。
- 分页、limit、错误态和空态稳定。
- README、roadmap、devlog 和 Phase 8 spec / plan 与实际完成范围一致。
