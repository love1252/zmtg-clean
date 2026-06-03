# Phase 20 治疗项目路径模板 / 随访路径模板 v1 计划

> 日期：2026-06-03
> 原始状态：Phase 20 Plan Mode 文档。PR #95 只做 spec / plan，不进入实现。
> 执行状态更新：Phase 20 v1 已按 PR #95-#98 和 PR 5 拆分完成；本文件保留原始 PR 拆分计划，并补充最终 smoke / 文档收尾状态。

**目标：** 规划如何把现有治疗摘要和确定性随访建议升级为治疗项目路径模板 / 随访路径模板 v1，让首批常见项目能对应更标准的恢复阶段、随访节点和人工任务建议。

**架构：** PR #95 不改架构，只规划后续方向。后续实现已按该计划采用 domain-only 静态模板 catalog，读取现有治疗摘要安全结构化字段，生成确定性内部随访建议，并继续通过人工确认创建来源随访任务。

**技术边界：** PR #95 只新增 Markdown 文档；Phase 20 v1 后续实现和收尾仍不新增 API、不改 DTO、不改 Drizzle schema / migration、不改 RBAC / auth / tenant isolation、不接 HIS / 企微 / AI、不做自动触达。

---

## 0. 当前 PR 范围

本文档最初对应 Phase 20 PR 1：治疗项目路径模板 / 随访路径模板 v1 spec / plan。

收尾更新：

- PR #96 已完成路径模板 domain-only catalog 和保守 matcher。
- PR #97 已完成确定性随访建议接入路径模板，模板建议 key 保持稳定。
- PR #98 已完成机构端治疗摘要管理页模板建议信息轻量展示。
- PR 5 已补充 workspace smoke / 回归测试并同步 README、roadmap、devlog、Phase 20 spec / plan 状态。
- Phase 20 v1 最小闭环为：治疗摘要结构化字段 → 路径模板 catalog 匹配 → 模板驱动随访建议 → 治疗摘要管理页轻量展示 → 人工确认创建来源任务 → 重复来源任务治理 → 作废摘要阻断。
- Phase 20 v1 未新增 API，未改 DTO，未改 schema / migration，未改权限、认证或租户隔离，未接 HIS / 企微 / AI，不做自动触达，也未修改 demo seed 数据。

新增：

- `docs/superpowers/specs/2026-06-03-phase20-treatment-path-template-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase20-treatment-path-template-v1.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-05-31.md`

PR #95 不做：

- 不写代码。
- 不改 UI。
- 不改测试。
- 不新增 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接 HIS。
- 不接企业微信。
- 不接 AI / RAG / Agent。
- 不做自动触达。
- 不改 demo seed 数据。

验证命令：

```bash
git diff --check
```

如果有 staged 文件，再运行：

```bash
git diff --cached --check
```

## 1. 当前上下文

已经完成的相关阶段：

- Phase 12：治疗记录结构化摘要 v1。
- Phase 13：治疗摘要人工录入 v1。
- Phase 14：治疗摘要管理能力 v1。
- Phase 15：治疗后护理 / 随访联动 v1。
- Phase 16：随访任务来源治理增强 v1。
- Phase 17：HIS 标准治疗事件 domain-only 契约。
- Phase 18：治疗摘要编辑能力 v1。
- Phase 19：治疗摘要作废能力 v1。
- PR #89-#94：demo seed、演示 smoke、UI 打磨和内部彩排清单。

当前治疗摘要和随访联动事实：

- 治疗摘要只保存结构化安全字段。
- 当前确定性建议基于风险等级、恢复阶段、治疗阶段、下一步护理动作和治疗类别生成。
- 建议只读 API 不写数据库、不创建任务。
- 人工确认 API 才创建来源随访任务。
- 来源任务使用 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey` 做追踪和重复治理。
- 已作废摘要阻断新的随访建议和新的来源任务创建。
- 既有来源任务不会被自动取消或自动修改状态。
- 当前没有路径模板表、路径实例表、模板 API、模板 UI 或外部触达能力。

## 2. 文件职责规划

### 当前 PR 文件

- `docs/superpowers/specs/2026-06-03-phase20-treatment-path-template-v1-design.md`
  - 说明 Phase 20 目标、非目标、现状关系、首批项目类型、模板字段、HIS / 企微 / AI 边界、隐私边界和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-phase20-treatment-path-template-v1.md`
  - 说明当前 docs-only PR 范围，以及后续如果进入实现时的 PR 拆分、文件职责、验证策略和停止条件。
- `README.md`
  - 轻量同步 Phase 20 Plan Mode 文档状态。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 Phase 20 当前选择为治疗项目路径模板 / 随访路径模板 v1 Plan Mode。
- `docs/devlog/2026-05-31.md`
  - 追加 Phase 20 Plan Mode 记录。

### 后续实现可能涉及文件

只有在后续明确进入实现后，才评估以下文件：

- 可新增：`src/modules/institution/domain/treatment-path-templates.ts`
  - 承载 domain-only 静态模板 catalog、项目类型、恢复阶段、节点和建议角色类型。
- 可新增：`src/modules/institution/tests/TreatmentPathTemplates.test.ts`
  - 覆盖模板 catalog、匹配规则、敏感字段边界、首批项目类型和稳定输出。
- 可修改：`src/modules/institution/domain/treatment-followup-suggestions.ts`
  - 将现有确定性建议接入模板或与模板合并。
- 可修改：`src/modules/institution/tests/TreatmentFollowUpSuggestions.test.ts`
  - 覆盖路径模板驱动建议、`suggestionKey` 稳定性和不调用外部能力。
- 可修改：`src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts`
  - 确认建议 API / 人工确认 API 保持现有边界。
- 可修改：`src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
  - 如需 UI 轻量展示模板名称或建议角色，必须单独 PR 评估。

后续实现默认不涉及：

- 数据库 schema。
- migration。
- 新 API route。
- 权限 / 认证 / 租户隔离。
- HIS / 企微 / AI 集成。
- 自动触达。

## 3. 模板 v1 建议模型

后续实现如采用 domain-only 模型，建议以静态模板 catalog 表达：

| 字段 | 说明 |
| --- | --- |
| `templateKey` | 稳定内部 key，例如 `photoelectric_care`。 |
| `projectType` | 项目类型中文展示，例如光子 / 光电治疗。 |
| `categoryKeys` | 可匹配的 `treatmentCategory` 白名单。 |
| `recoveryStages` | 模板支持的恢复阶段集合。 |
| `riskLevels` | 支持 `normal`、`watch`、`urgent`。 |
| `nodes` | 建议随访节点列表。 |
| `nodeKey` | 节点稳定 key，例如 `d3_care_check`。 |
| `offsetDays` | 从治疗时间起算的建议节点。 |
| `taskTitle` | 建议任务标题。 |
| `handlerRole` | 建议处理角色。 |
| `requiresHumanConfirmation` | v1 永远为 `true`。 |
| `forbidAutoReachOut` | v1 永远为 `true`。 |

首批项目类型：

- `photoelectric_care`：光子 / 光电治疗。
- `hydro_injection_care`：水光 / 注射护理。
- `post_surgery_repair`：术后修复。
- `skin_management`：皮肤管理。

建议处理角色可先使用中文展示或稳定内部 key，但必须与现有权限、用户和任务分配能力保持松耦合。v1 不新增员工角色权限模型。

## 4. 后续 PR 拆分

### PR 1：Phase 20 spec / plan 文档

PR #95。

完成标准：

- 两份 Phase 20 文档已新增。
- README、roadmap、devlog 已轻量同步。
- 只改 Markdown。
- `git diff --check` 通过。

### PR 2：路径模板 domain-only catalog

前提：

- 用户明确要求进入 Phase 20 实现。
- 确认 v1 不落库、不新增 API、不改 UI。

建议范围：

- 新增静态模板 catalog。
- 定义项目类型、恢复阶段、节点、处理角色和模板字段类型。
- 定义从治疗摘要结构化字段到项目类型的保守 matcher。
- 不改现有 API。
- 不改现有 UI。
- 不改数据库。

建议测试：

- 光子 / 光电治疗能匹配 `photoelectric_care`。
- 水光 / 注射护理能匹配 `hydro_injection_care`。
- 术后修复能匹配 `post_surgery_repair`。
- 皮肤管理能匹配 `skin_management`。
- `riskLevel=urgent` 会选择更高优先级或更短节点。
- ambiguous 输入回落到轻量建议，不猜测项目。
- 输入不读取或输出完整正文、PII、图片 / 文件原文、SQL、stack、token、secret、`DATABASE_URL`。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentPathTemplates.test.ts
```

### PR 3：确定性随访建议接入路径模板

前提：

- PR 2 domain-only 模板测试通过。
- 已确认 `suggestionKey` 兼容策略。

建议范围：

- 将路径模板节点转换为现有 `TreatmentFollowUpSuggestion` DTO。
- 保留风险规则、恢复早期规则、`nextCareAction` 规则和轻量 fallback 的兼容行为，或明确替换顺序。
- 保持建议 API 只读。
- 保持人工确认创建来源任务。
- 保持作废摘要阻断。
- 保持不调用 AI / RAG / Agent / 外部触达。

重点风险：

- `sourceSuggestionKey` 已用于来源任务去重，不能随意破坏历史来源治理。
- 如果需要改变 key 格式，应提供兼容策略或限定只影响新建议。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentFollowUpSuggestions.test.ts src/modules/institution/tests/TreatmentFollowUpSuggestionInput.test.ts src/modules/institution/tests/TreatmentFollowUpLinkApiRoutes.test.ts
```

### PR 4：机构端模板信息轻量展示

前提：

- PR 3 已稳定输出模板化建议。
- 产品确认 UI 展示有必要。

建议范围：

- 治疗摘要详情随访建议中展示路径类型、建议处理角色和人工确认边界。
- 不新增路径编辑器。
- 不新增路径配置后台。
- 不新增自动触达入口。
- 不新增 API。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx src/modules/workspace/tests
```

### PR 5：smoke / 文档收尾

建议范围：

- workspace smoke 覆盖首批 4 类项目中的代表路径。
- 覆盖人工确认创建来源任务。
- 覆盖作废摘要阻断。
- 覆盖重复来源任务提示。
- 覆盖敏感字段不展示。
- 更新 README、roadmap、devlog 和 Phase 20 spec / plan 最终状态。

完成状态：

- workspace smoke 已覆盖模板驱动建议展示、四类路径类型、建议处理角色、人工确认、禁止自动触达客户、不自动回复客户和不接 AI。
- workspace smoke 已覆盖模板建议通过既有人工确认操作创建来源任务，请求 body 只包含 `suggestionKey`。
- workspace smoke 已覆盖模板建议重复确认时仍走来源任务去重治理。
- 既有 institution / workspace 测试继续覆盖作废摘要阻断、旧规则建议展示、来源任务提示和敏感字段不展示。
- README、roadmap、devlog 和 Phase 20 spec 已同步 Phase 20 v1 最终状态。
- 本收尾不新增 API route，不改 DTO，不改 schema / migration，不改权限 / 认证 / 租户隔离，不接 HIS / 企微 / AI / 自动触达，不修改 demo seed 数据。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
```

如触及构建相关 UI，再补：

```bash
node scripts/run-next.mjs build --webpack
```

## 5. 单独评估门槛

以下能力不能混入 Phase 20 v1 最小实现，必须单独评估：

### 5.1 schema / API

出现以下需求时，必须新增单独 schema / API 评估文档：

- 机构可编辑路径模板。
- 平台可配置模板。
- 模板需要版本、启停、审批或审计。
- 客户需要进入路径实例状态。
- 需要查询路径列表、路径详情或路径效果。
- 需要对外暴露模板 API。

### 5.2 HIS

出现以下需求时，必须单独进入 HIS / 标准治疗事件规划：

- 从真实 HIS 读取治疗项目。
- 接 Webhook。
- 文件导入。
- 外部系统同步。
- 保存或解析外部 raw payload。
- 客户身份匹配。

### 5.3 企业微信 / 自动触达

出现以下需求时，必须单独进入触达 Plan Mode：

- 自动发企业微信。
- 自动发个人微信。
- 自动发短信。
- 电话外呼。
- 消息模板。
- 触达频控。
- 客户授权、退订或黑名单。
- 触达结果回写。

### 5.4 AI / RAG / Agent

出现以下需求时，必须单独进入 AI Plan Mode：

- AI 生成护理建议。
- AI 生成客户消息。
- RAG 检索机构 SOP。
- Agent 自动决策。
- AI 回复客户。

## 6. 验收清单

当前 docs-only PR 验收：

- 设计文档说明 Phase 20 只是 Plan Mode。
- 设计文档说明治疗项目路径模板 v1 目标。
- 设计文档说明与治疗摘要、确定性建议、来源任务的关系。
- 设计文档覆盖光子 / 光电治疗、水光 / 注射护理、术后修复、皮肤管理。
- 设计文档列出路径模板建议字段。
- 设计文档明确当前只规划、不落库。
- 设计文档明确后续 schema / API 必须单独评估。
- 设计文档明确 HIS / 企微 / AI 边界。
- 计划文档给出后续 PR 拆分。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、UI、测试、schema、migration、demo seed 变更。
- `git diff --check` 通过。

## 7. 停止条件

后续执行中出现以下情况，必须停止并回报：

- 必须改代码才能完成当前 docs-only PR。
- 必须新增 API。
- 必须改数据库 schema 或 migration。
- 必须改权限、认证或租户隔离。
- 必须接 HIS、企微、短信、电话或其他外部系统。
- 必须接 AI / RAG / Agent。
- 必须自动触达客户。
- 必须导入真实客户数据。
- 必须保存完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 必须修改 demo seed 数据。
- 必须做支付、合同、发票或经营智能中心。

当前 PR 如触发任一停止条件，应保持未实现状态并回报，不继续扩范围。
