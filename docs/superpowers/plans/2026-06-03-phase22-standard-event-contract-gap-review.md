# Phase 22 Standard Event Contract Gap Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 评估 Phase 17 `StandardTreatmentEvent` 契约和 Phase 22 HIS mapper 建议字段之间的差异，明确后续是否需要调整命名、补字段或保持兼容策略。

**Architecture:** PR 2 只做 docs-only 契约差异评估，不修改 TypeScript 契约、mapper、测试、API、schema 或业务流程。评估结论优先保护 Phase 17 已落地的内部核心 DTO 命名，避免 `source*` 与 `external*` 两套同义字段并存，并把真实 HIS adapter、患者身份匹配、自动摘要和自动任务继续挡在后续独立 Plan Mode 外。PR 3A 已在独立分支按该结论补齐 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`。

**Tech Stack:** Markdown only。后续如单独批准实现，才可能涉及 TypeScript、Vitest 和现有机构领域模块。

---

## 0. PR 2 范围

新增：

- `docs/superpowers/plans/2026-06-03-phase22-standard-event-contract-gap-review.md`

轻量修改：

- `docs/superpowers/plans/2026-06-03-phase22-his-treatment-event-mapper-v1.md`
- `docs/devlog/2026-06-03.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

PR 2 不做：

- 不写代码。
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

本 PR 不需要跑 Vitest、typecheck 或 Next build，除非误改了代码或测试。

## 1. 只读检查结论

本次按要求只读检查了：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/README.md`
- `docs/devlog/2026-06-03.md`
- `docs/superpowers/specs/2026-06-03-phase22-his-treatment-event-mapper-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase22-his-treatment-event-mapper-v1.md`
- `src/modules/institution/domain/standard-treatment-event.ts`
- `src/modules/institution/server/standard-treatment-event-mapper.ts`
- `src/modules/institution/tests/StandardTreatmentEventMapper.test.ts`
- `src/modules/institution/domain/treatment-summaries.ts`
- `src/modules/institution/domain/treatment-path-templates.ts`
- `src/modules/institution/domain/treatment-followup-suggestions.ts`

实际文件路径与预期一致，无需额外搜索替代路径。

PR 2 评估时已确认的现状：

- Phase 17 已存在 domain-only `StandardTreatmentEvent`、`StandardTreatmentEventMapperInput`、字段白名单和禁止字段集合。
- `normalizeStandardTreatmentEvent(input, context)` 已要求 `tenantId`、`eventId`、`receivedAt` 来自服务端可信 context，不接受外部输入。
- PR 2 评估时输入白名单尚不包含 `tenantId`、`eventId`、`receivedAt`、`externalEventId`、`externalSource`、`customerExternalId`、`appointmentExternalId`、`recoveryStage`、`rawSourceType` 或 `mappingWarnings`；PR 3A 后仅新增 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`。
- PR 2 评估时标准事件已包含 `sourceSystem`、`sourceEventId`、`sourceCustomerId`、`appointmentRef` 等来源命名；PR 3A 继续保留这些命名，不新增 `external*` 核心 DTO 字段。
- PR 2 评估时标准事件已包含 `treatmentStatus`、`summary`、`occurredAt`、`customerMatchKey`、`customerName`、`maskedPhone`、`doctorRef`、`operatorRef`、`departmentRef`、`amount` 和 `currency` 等 Phase 22 建议字段未重点列出的既有字段。
- `treatment_summaries`、路径模板和随访建议都已经使用 `recoveryStage`；PR 3A 已将该字段补入标准治疗事件契约。
- mapper 对 raw payload、完整正文、PII、图片 / 文件原文、AI 内容、token、secret、SQL、stack 和数据库连接串已有拒绝边界；PR 3A 继续覆盖新增字段的相同安全边界。

## 2. Phase 17 现有契约字段

以 `src/modules/institution/domain/standard-treatment-event.ts` 和 `src/modules/institution/server/standard-treatment-event-mapper.ts` 为准，当前 Phase 17 契约包含：

| 字段 | 来源 | 当前语义 |
| --- | --- | --- |
| `eventId` | `StandardTreatmentEventMapperContext` | 智美天工内部标准事件 ID，由服务端可信上下文生成，不接受外部输入。 |
| `tenantId` | `StandardTreatmentEventMapperContext` | 当前租户归属，由服务端可信上下文提供，不接受 HIS payload、query、body、header 或 localStorage。 |
| `sourceSystem` | mapper input | 来源系统，当前稳定集合为 `his`、`manual`、`import`、`other`。 |
| `sourceEventId` | mapper input | 外部事件追踪 ID，可为空，用于幂等和排障辅助，不作为授权依据。 |
| `sourceCustomerId` | mapper input | 外部客户 ID，可为空，只能作为后续身份匹配辅助。 |
| `customerMatchKey` | mapper input | 身份匹配 key，可为空，不允许手机号原文、身份证号或病历号原文。 |
| `customerName` | mapper input | 可选客户姓名或安全短文本；真实身份策略后续单独评估。 |
| `maskedPhone` | mapper input | 脱敏手机号展示值，只允许形如 `138****8888`。 |
| `treatmentDate` | mapper input | 治疗时间，必须是可解析 ISO-like 时间字符串。 |
| `treatmentProject` | mapper input | 安全治疗项目短文本。 |
| `treatmentCategory` | mapper input | 标准治疗类别短文本。 |
| `treatmentStage` | mapper input | 治疗阶段短文本。 |
| `treatmentStatus` | mapper input | 标准治疗状态，当前集合为 `planned`、`performed`、`completed`、`cancelled`、`revised`。 |
| `appointmentRef` | mapper input | 预约或就诊引用，可为空，不自动关联内部预约。 |
| `doctorRef` | mapper input | 医生、治疗师或负责人引用，可为空。 |
| `operatorRef` | mapper input | 操作员、咨询师、护理人员或录入人员引用，可为空。 |
| `departmentRef` | mapper input | 科室、门店、治疗室或业务部门引用，可为空。 |
| `amount` | mapper input | 非负金额字符串或数字，可为空。 |
| `currency` | mapper input | 三位货币代码，可为空，输出会标准化为大写。 |
| `riskLevel` | mapper input | 标准风险等级，当前集合为 `normal`、`watch`、`urgent`。 |
| `summary` | mapper input | 安全结构化短摘要，当前必填，不允许完整治疗正文、完整病历正文或咨询全文。 |
| `nextCareAction` | mapper input | 安全下一步护理或人工跟进动作，当前必填。 |
| `tags` | mapper input | 安全标签数组，去重、限制数量和长度。 |
| `occurredAt` | mapper input | 业务事实发生时间，必须是可解析 ISO-like 时间字符串。 |
| `receivedAt` | `StandardTreatmentEventMapperContext` | 智美天工接收或标准化时间，由服务端可信上下文提供，不接受外部输入。 |

PR 2 评估时输入白名单为：

```text
sourceSystem
sourceEventId
sourceCustomerId
customerMatchKey
customerName
maskedPhone
treatmentDate
treatmentProject
treatmentCategory
treatmentStage
treatmentStatus
appointmentRef
doctorRef
operatorRef
departmentRef
amount
currency
riskLevel
summary
nextCareAction
tags
occurredAt
```

## 3. Phase 22 建议字段

Phase 22 HIS mapper v1 文档建议字段为：

- `externalEventId`
- `externalSource`
- `tenantId`
- `customerExternalId`
- `appointmentExternalId`
- `treatmentDate`
- `treatmentProject`
- `treatmentCategory`
- `treatmentStage`
- `recoveryStage`
- `riskLevel`
- `nextCareAction`
- `tags`
- `rawSourceType`
- `mappingWarnings`

这些字段是 Phase 22 对未来 HIS mapper 输出结构的产品 / 架构建议。PR 3A 后，`recoveryStage`、`rawSourceType` 和 `mappingWarnings` 已进入 domain-only TypeScript 契约；`externalEventId`、`externalSource`、`customerExternalId` 和 `appointmentExternalId` 仍只作为 adapter 输入层别名或文档映射，不进入内部核心 DTO，也不是数据库 schema。

## 4. 差异结论表

下表保留 PR 2 评估时的差异结论；PR 3A 已按该结论只补齐 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`。

| Phase 22 建议字段 | Phase 17 现有字段 | 当前是否已有 | 差异 | 建议 |
| --- | --- | --- | --- | --- |
| `externalEventId` | `sourceEventId` | 语义已有 | 命名不同，语义都是外部事件追踪 ID。 | v1 内部核心 DTO 继续使用 `sourceEventId`；`externalEventId` 只作为 adapter 输入层别名或文档映射，不进入核心 DTO。 |
| `externalSource` | `sourceSystem` | 语义已有 | 命名不同；Phase 22 示例包含 `institution_system`，Phase 17 当前集合为 `his`、`manual`、`import`、`other`。 | v1 内部核心 DTO 继续使用 `sourceSystem`；真实来源枚举是否增加 `institution_system` 应后续单独评估，当前不新增。 |
| `tenantId` | `tenantId` | 输出已有，输入无 | Phase 17 已由 context 提供；Phase 22 明确可信上下文。 | 保持现状，`tenantId` 必须来自服务端可信上下文，不进入 mapper input 白名单。 |
| `customerExternalId` | `sourceCustomerId` | 语义已有 | 命名不同，语义都是外部客户 ID。 | v1 内部核心 DTO 继续使用 `sourceCustomerId`；`customerExternalId` 只作为 adapter 输入层别名或文档映射。 |
| `appointmentExternalId` | `appointmentRef` | 部分已有 | `appointmentRef` 更宽，可表达外部预约号、内部预约引用或安全映射引用。 | v1 继续使用 `appointmentRef`；真实 adapter 可把外部预约号映射为 `appointmentRef`，不新增同义字段。 |
| `treatmentDate` | `treatmentDate` | 已有 | 无字段差异。 | 保持现状。 |
| `treatmentProject` | `treatmentProject` | 已有 | 无字段差异。 | 保持现状，继续做安全短文本校验。 |
| `treatmentCategory` | `treatmentCategory` | 已有 | 无字段差异。 | 保持现状，后续可单独补类别 alias / warning 策略。 |
| `treatmentStage` | `treatmentStage` | 已有 | 无字段差异。 | 保持现状。 |
| `recoveryStage` | 无 | 缺失 | 治疗摘要、路径模板和随访建议已使用该字段，但标准事件缺失。 | 建议 PR 3A 补为标准事件字段，优先作为安全短文本或受控恢复阶段值，不与外部 raw 字段绑定。 |
| `riskLevel` | `riskLevel` | 已有 | 无字段差异。 | 保持现状，继续复用 `normal | watch | urgent`。 |
| `nextCareAction` | `nextCareAction` | 已有 | 无字段差异。 | 保持现状。 |
| `tags` | `tags` | 已有 | 无字段差异。 | 保持现状，继续限制数量、长度和敏感内容。 |
| `rawSourceType` | 无 | 缺失 | Phase 17 只有 `sourceSystem`，不能表达外部记录粗类型；但 raw payload 仍禁止保存。 | 可在 PR 3A 评估补一个安全 code 字段，例如 `treatment_record | appointment | order | course_progress | manual_review | other`，不得保存外部原文。 |
| `mappingWarnings` | 无 | 缺失 | 当前 mapper 只返回 fatal error 或标准事件，没有 warning code 输出。 | 可在 PR 3A/3B 评估补安全 warning code 数组；建议由 mapper 生成，不接受外部输入。 |

补充差异：

| Phase 17 现有字段 | Phase 22 是否列出 | 差异 | 建议 |
| --- | --- | --- | --- |
| `eventId` | 未列出 | Phase 17 内部事件 ID 由 context 生成。 | 保留，不接受外部输入。 |
| `receivedAt` | 未列出 | Phase 17 接收 / 标准化时间由 context 生成。 | 保留，不接受外部输入。 |
| `occurredAt` | 未列出 | Phase 17 必填业务事实发生时间。 | 保留；后续文档应避免只用 `treatmentDate` 覆盖事件发生时间语义。 |
| `treatmentStatus` | 未列出 | Phase 17 必填标准治疗状态。 | 保留；真实 HIS 状态映射应单独评估 warning / fatal 策略。 |
| `summary` | 未列出 | Phase 17 必填安全短摘要。 | 保留；后续如 HIS 输入缺摘要，应单独评估 fallback 或人工复核，不自动用完整正文填充。 |
| `customerMatchKey` / `customerName` / `maskedPhone` | 未列出 | Phase 17 已预留身份辅助字段。 | 保留最小字段；不做患者身份自动匹配。 |
| `doctorRef` / `operatorRef` / `departmentRef` | 未列出 | Phase 17 已预留安全人员 / 部门引用。 | 保留；真实外部引用映射后续单独评估。 |
| `amount` / `currency` | 未列出 | Phase 17 已定义金额语义。 | 保留语义，不进入支付、合同、发票或收入归因。 |

## 5. 建议策略

本次评估建议：

1. v1 优先保留 Phase 17 既有内部命名。
   - 内部核心 DTO 继续使用 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef`。
   - 不把 Phase 22 文档中的 `externalEventId`、`externalSource`、`customerExternalId`、`appointmentExternalId` 直接复制进核心 DTO。

2. 只补缺字段，不整体重命名。
   - PR 3A 已按该策略补齐 `recoveryStage`、`rawSourceType`、`mappingWarnings`。
   - 不改已有 `source*` 字段名，避免影响现有 mapper、测试和文档语义。

3. 避免同时存在两套同义字段。
   - 不应在内部核心 DTO 中同时存在 `sourceEventId` 和 `externalEventId`。
   - 不应同时存在 `sourceSystem` 和 `externalSource`。
   - 不应同时存在 `sourceCustomerId` 和 `customerExternalId`。
   - 不应同时存在 `appointmentRef` 和 `appointmentExternalId`。

4. `external*` 命名只作为 adapter 输入层别名或文档映射。
   - 真实 HIS adapter 可以读取外部 payload 或 adapter DTO 中的 `externalEventId`。
   - adapter 输出进入核心 mapper 前，应映射为 `sourceEventId` 等 Phase 17 内部命名。
   - adapter 输入层别名不得进入普通机构端 DTO、数据库 schema 或审计 payload。

5. `tenantId` 必须继续来自可信上下文。
   - 不接受 HIS payload 中的 `tenantId`。
   - 不接受前端 query、body、header 或 localStorage 传入 `tenantId`。
   - 后续真实连接配置必须绑定单一租户，由服务端同步上下文提供 `tenantId`。

6. `mappingWarnings` 必须是安全 code。
   - 推荐由 mapper 生成，不接受外部系统原样传入。
   - warning code 示例：`unknown_treatment_category`、`missing_recovery_stage`、`external_event_id_missing`、`manual_review_required`、`category_mapped_by_alias`。
   - 不得包含 raw payload、PII、手机号原文、身份证号、病历号原文、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、SQL、stack、token、secret、`DATABASE_URL` 或连接串。

7. `recoveryStage` 是优先级最高的补缺字段。
   - 治疗摘要、路径模板和随访建议都已经依赖 `recoveryStage`。
   - 标准事件如果缺少 `recoveryStage`，后续从 HIS 标准事件直接进入路径模板时会丢失关键恢复阶段信号。
   - PR 3A 已先补该字段，并覆盖 mapper parser / 单元测试。

8. `rawSourceType` 可以补，但必须保持粗粒度。
   - 它只能表达来源记录类型，例如 `treatment_record`、`appointment`、`order`、`course_progress`、`manual_review`、`other`。
   - 它不能保存外部表名、接口路径、请求体、响应体、完整字段原文或 raw payload。

## 6. 后续 PR 建议

### PR 3A：只补标准事件缺口字段 domain-only 契约

状态：

- 已进入本次 domain-only 契约补齐。
- 仅新增 `recoveryStage`、`rawSourceType` 和 `mappingWarnings` 三个缺口字段。
- 不新增 `externalEventId`、`externalSource`、`customerExternalId` 或 `appointmentExternalId` 核心 DTO 字段。

范围：

- 在 `StandardTreatmentEvent` 中新增 `recoveryStage`。
- 新增 `rawSourceType` 安全集合。
- 新增 `mappingWarnings` 安全 code 集合。
- `mappingWarnings` 可作为 mapper 输入契约中的安全 code 数组进入标准事件输出，但必须去重、限制数量和长度，不接受 raw payload、PII、完整正文、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- 不新增 API。
- 不改 schema / migration。
- 不接真实 HIS。
- 不做患者身份匹配、自动摘要、自动任务或自动触达。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/StandardTreatmentEventMapper.test.ts
./node_modules/.bin/tsc --noEmit
```

### PR 3B：mapper parser 与安全测试收尾

状态：

- 已进入本次 parser 安全测试收尾。
- 仅补充回归测试和轻量文档同步。
- 新增测试直接通过，parser / domain 无需改动。

范围：

- 测试 `recoveryStage` 合法、缺省、空字符串、超长、PII、raw payload、完整正文、图片 / 文件原文、SQL、stack、token、secret、`DATABASE_URL` 和连接串边界。
- 测试 `rawSourceType` 全安全集合、缺省 / 空字符串、非法值、外部表名、接口路径、请求体、响应体、字段原文和 raw payload 线索拒绝。
- 测试 `mappingWarnings` 合法 code、缺省、去重、数量限制、长度限制、非字符串、空字符串、未知 code、raw payload、PII、完整正文、SQL、stack、token、secret、`DATABASE_URL` 和连接串拒绝。
- 测试 `tenantId`、`eventId`、`receivedAt` 仍只来自 context。
- 测试 `externalEventId`、`externalSource`、`customerExternalId`、`appointmentExternalId` 仍不进入核心 DTO。
- 源码扫描确认不调用 HIS / 企微 / AI / RAG / Agent / fetch / axios / 外部系统，不写数据库，不创建治疗摘要或随访任务。
- 不接真实 HIS。
- 不新增 API、schema、migration 或 UI。

### PR 3C：补文档 / smoke 收尾

建议范围：

- 更新 Phase 22 spec / plan，标记 PR 3A / 3B 的 domain-only 契约实现状态。
- README、roadmap、devlog 轻量同步。
- 不新增功能。
- 不接真实 HIS、企微、AI 或自动触达。

### 后续真实 HIS adapter Plan Mode

真实 HIS adapter 仍必须单独进入 Plan Mode。

不得和 PR 3A / PR 3B 混在一起的能力：

- 外部连接配置。
- 凭证管理。
- Webhook。
- OAuth。
- 同步任务。
- 重试 / 幂等表。
- raw payload 保留策略。
- 患者身份匹配。
- 自动创建治疗摘要。
- 自动创建随访任务。
- 自动触达客户。
- AI 解析。

## 7. 验收清单

PR 2 docs-only PR 验收：

- 已列出现有 Phase 17 `StandardTreatmentEvent` / mapper 契约字段。
- 已对比 Phase 22 建议字段。
- 已给出差异结论表。
- 已明确 `externalEventId` 建议沿用 `sourceEventId`。
- 已明确 `externalSource` 建议沿用 `sourceSystem`。
- 已明确 `customerExternalId` 建议沿用 `sourceCustomerId`。
- 已明确 `appointmentExternalId` 建议沿用 `appointmentRef`。
- 已明确建议后续补 `recoveryStage`。
- 已明确建议后续评估补 `rawSourceType`。
- 已明确建议后续评估补 `mappingWarnings`。
- 已明确 v1 优先保留 Phase 17 命名，避免重复造 external 命名。
- 已明确 `external*` 命名只作为 adapter 输入层别名或文档映射，不进入内部核心 DTO。
- 已明确 `tenantId` 必须来自可信上下文。
- 已明确 `mappingWarnings` 必须是安全 code。
- 已给出后续 PR 拆分建议。
- 没有代码、测试、API、schema、migration、权限、认证、租户隔离或 demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 8. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须改 TypeScript 契约才能完成当前评估。
- 必须写代码。
- 必须改测试。
- 必须新增 API 或修改现有 API。
- 必须改数据库 schema 或新增 migration。
- 必须改权限、认证或租户隔离。
- 必须接真实 HIS、机构系统、企微或其他外部系统。
- 必须接 AI / RAG / Agent。
- 必须自动触达客户。
- 必须导入真实客户数据。
- 必须保存 raw HIS payload。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须做患者身份匹配。
- 必须自动创建治疗摘要。
- 必须自动创建随访任务。
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
