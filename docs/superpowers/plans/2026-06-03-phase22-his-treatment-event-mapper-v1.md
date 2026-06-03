# Phase 22 HIS 标准治疗事件 mapper v1 实施计划

> **给自动化执行者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行本计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 规划如何把未来 HIS / 机构系统中的治疗事件映射为智美天工内部可识别的标准治疗事件结构。

**架构：** PR 1 不改架构，只做 Plan Mode 文档。后续如进入实现，应承接 Phase 17 `StandardTreatmentEvent` domain-only 契约，用字段白名单、确定性 mapper 和安全告警代码隔离外部系统差异，不让 raw HIS payload、完整医疗正文或外部系统字段扩散到治疗摘要、路径模板、随访任务和运营分析。PR 3A 已按 PR 2 结论补齐 `recoveryStage`、`rawSourceType` 和 `mappingWarnings` 的 domain-only 契约，PR 3B 已补强解析器安全测试，PR 3C 已补充 mapper domain-only 最小闭环 smoke 与文档收尾。

**技术栈：** 当前 PR 只涉及 Markdown。后续实现如单独批准，才可能涉及 TypeScript、Vitest 和现有机构领域模块。

---

## 0. PR 1 范围

新增：

- `docs/superpowers/specs/2026-06-03-phase22-his-treatment-event-mapper-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase22-his-treatment-event-mapper-v1.md`
- `docs/devlog/2026-06-03.md`

轻量修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

当前 PR 不做：

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

## 1. 当前上下文

已经完成的相关阶段：

- Phase 17：HIS 接入标准模型 / 标准治疗事件 v1，已完成 domain-only 类型、mapper 契约、字段白名单和禁止字段测试。
- Phase 20：治疗项目路径模板 v1，已完成 domain-only catalog、确定性随访建议接入和人工确认边界。
- Phase 21：随访路径运营分析 v1，已完成只读聚合最小闭环并收口，不继续追加 Phase 21 功能。

当前可复用事实：

- `treatment_summaries` 只保存安全结构化字段，不保存完整治疗正文、完整病历正文或咨询全文。
- 路径模板使用 `treatmentCategory`、`treatmentProject`、`treatmentStage`、`recoveryStage`、`riskLevel`、`treatmentDate` 和 `tags`。
- 随访建议使用确定性规则，不接 AI，不自动触达。
- 来源任务通过 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey` 追踪人工确认来源。
- 运营分析只读聚合治疗摘要、模板建议、来源任务和 audit，不返回客户明细或 raw payload。
- Phase 17 标准事件契约已使用 `sourceSystem`、`sourceEventId`、`sourceCustomerId`、`appointmentRef` 等命名；Phase 22 建议字段中的 `external*` 命名需要后续单独做兼容评估。

## 2. 文件职责规划

### PR 1 文件

- `docs/superpowers/specs/2026-06-03-phase22-his-treatment-event-mapper-v1-design.md`
  - 说明 Phase 22 定位、mapper v1 目标、字段建议、与现有治疗摘要 / 路径模板 / 随访建议 / 来源任务 / 运营分析的关系、非目标、安全边界和后续 PR 拆分。
- `docs/superpowers/plans/2026-06-03-phase22-his-treatment-event-mapper-v1.md`
  - 说明当前 docs-only PR 范围、文件职责、后续实现拆分、验证策略、验收清单和停止条件。
- `README.md`
  - 轻量同步 Phase 22 Plan Mode 文档状态，明确不是真实 HIS 接入或 mapper 实现。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 轻量同步 Phase 22 已进入 HIS 标准治疗事件 mapper v1 规划，后续实现仍需单独评估。
- `docs/devlog/2026-06-03.md`
  - 记录 Phase 22 Plan Mode 范围、边界和验证命令；不再追加到 `docs/devlog/2026-05-31.md`。

### 后续实现可能涉及文件

只有在用户明确进入 Phase 22 实现后，才评估以下文件：

- 可修改：`src/modules/institution/domain/standard-treatment-event.ts`
  - 评估是否新增 `recoveryStage`、`rawSourceType`、`mappingWarnings` 或 `external*` 兼容字段。
- 可修改：`src/modules/institution/server/standard-treatment-event-mapper.ts`
  - 评估是否扩展 mapper 输入 / 输出、告警代码和字段校验。
- 可修改：`src/modules/institution/tests/StandardTreatmentEventMapper.test.ts`
  - 覆盖新字段、告警代码、禁止字段、租户上下文和 raw payload 拒绝。
- 可新增：`docs/superpowers/plans/2026-06-xx-phase22-standard-event-contract-gap-review.md`
  - 如果需要先做契约差异评估，可单独用 docs-only PR 处理。

后续实现默认不涉及：

- 数据库 schema。
- migration。
- API route。
- UI。
- 权限、认证或租户隔离改动。
- 真实 HIS / 企微 / AI 集成。
- 自动摘要、自动任务或自动触达。
- demo seed。

## 3. mapper v1 字段建议

后续实现如进入 domain-only 契约评估，建议至少覆盖：

| 字段 | 推荐输入/来源 | 口径要点 |
| --- | --- | --- |
| `externalEventId` | 外部治疗事件 ID | 只用于幂等和排障，不作为授权依据；可兼容 Phase 17 `sourceEventId`。 |
| `externalSource` | 来源系统类别 | 可兼容 Phase 17 `sourceSystem`；不包含凭证或厂商 raw 配置。 |
| `tenantId` | 可信服务端上下文 | 不接受外部 payload、前端 body、query、header 或 localStorage。 |
| `customerExternalId` | 外部客户编号 | 只用于后续身份匹配辅助，不表示已匹配内部客户。 |
| `appointmentExternalId` | 外部预约或就诊引用 | 只表达引用，不自动关联内部预约。 |
| `treatmentDate` | 外部可确认治疗时间 | 必须可解析，供路径、随访和分析窗口使用。 |
| `treatmentProject` | 安全项目短文本 | 禁止完整治疗正文、完整病历正文、咨询全文或 raw payload。 |
| `treatmentCategory` | 标准类别 | 用于路径模板匹配；未知时 warning 或 fatal 策略需实现前明确。 |
| `treatmentStage` | 安全阶段短文本 | 用于疗程、复诊和恢复判断。 |
| `recoveryStage` | 标准恢复阶段或安全短文本 | 用于路径模板节点匹配；PR 3A 已补入标准事件 domain-only 契约。 |
| `riskLevel` | `normal | watch | urgent` | 复用现有随访风险等级。 |
| `nextCareAction` | 结构化下一步动作 | 只能是短文本，不做 AI 生成长文。 |
| `tags` | 安全标签数组 | 限制数量和长度，不包含 PII、raw payload、token、secret、SQL 或 stack。 |
| `rawSourceType` | 粗粒度记录类型 | 只保存类型，例如治疗记录、预约、订单或疗程进度；不保存 raw payload。 |
| `mappingWarnings` | 安全告警代码数组 | 只保存代码，不保存外部字段原文或 PII。 |

## 4. 后续 PR 拆分

### PR 1：Phase 22 spec / plan 文档

当前 PR。

完成标准：

- 新增两份 Phase 22 文档。
- README、roadmap、devlog 已轻量同步。
- 只改 Markdown。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

### PR 2：标准事件 mapper 契约差异评估

状态：

- 已进入 docs-only 契约差异评估。
- 新增 `docs/superpowers/plans/2026-06-03-phase22-standard-event-contract-gap-review.md`。
- 当前结论：v1 优先保留 Phase 17 既有 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef` 内部命名，避免再引入 `externalSource`、`externalEventId`、`customerExternalId` 和 `appointmentExternalId` 作为核心 DTO 同义字段。
- 当前结论：`external*` 命名如需兼容，应只作为 adapter 输入层别名或文档映射，不进入内部核心 DTO、普通机构端 DTO、数据库 schema 或审计 payload。
- 当前结论：PR 3A 已按该策略只补缺字段 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`，不整体重命名。
- 当前结论：`tenantId` 仍必须来自服务端可信上下文；`mappingWarnings` 必须是安全 code，不包含 raw payload、PII、完整正文、SQL、stack、token、secret 或连接串。

建议范围：

- 对比 Phase 17 现有 `StandardTreatmentEvent` 和 Phase 22 字段建议。
- 决定是否沿用 `sourceSystem` / `sourceEventId`，或新增 `externalSource` / `externalEventId` 兼容层。
- PR 3A 已决定并补齐 `recoveryStage`、`rawSourceType`、`mappingWarnings`。
- 只做 docs-only 或 domain-only 契约评估。
- 不接真实 HIS。
- 不新增 API、schema、migration 或 UI。

建议验证：

```bash
git diff --check
```

如果修改 TypeScript 契约，再补：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/StandardTreatmentEventMapper.test.ts
./node_modules/.bin/tsc --noEmit
```

### PR 3A：标准事件缺口字段 domain-only 契约

状态：

- 已进入本次 domain-only 契约补齐。
- 只补 Phase 22 PR 2 确认的缺口字段：`recoveryStage`、`rawSourceType`、`mappingWarnings`。
- 继续保留 Phase 17 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef` 命名。
- 不新增 `externalEventId`、`externalSource`、`customerExternalId` 或 `appointmentExternalId` 核心 DTO 字段。

范围：

- 扩展 `StandardTreatmentEvent` domain 类型。
- 扩展 `normalizeStandardTreatmentEvent` parser / mapper 契约。
- 补充 `StandardTreatmentEventMapper.test.ts`。
- 覆盖 `recoveryStage`、`rawSourceType`、`mappingWarnings` 的合法、缺省、非法和敏感内容边界。
- 覆盖 `tenantId`、`eventId`、`receivedAt` 继续只来自 context。
- 覆盖 `external*` 同义字段继续被拒绝。
- 不写数据库。
- 不新增 API。
- 不改 schema / migration。
- 不改权限、认证或租户隔离。
- 不接真实 HIS。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/StandardTreatmentEventMapper.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
```

### PR 3B：mapper 解析器与安全测试收尾

状态：

- 已完成解析器安全边界回归测试收尾。
- 新增测试直接通过，说明 PR 3A 的解析器 / domain 契约无需修正。
- 本 PR 不进入类别 alias、状态降级、人工复核 warning 策略或真实 adapter 输入层别名。

范围：

- 补强 `recoveryStage` 空字符串、手机号、身份证号、病历号原文、raw payload、完整正文、图片 / 文件原文、SQL、stack、token、secret、`DATABASE_URL` 和连接串拒绝测试。
- 补强 `rawSourceType` 全安全集合、缺省 / 空字符串、非法来源、外部表名、接口路径、请求体、响应体、字段原文和 raw payload 线索拒绝测试。
- 补强 `mappingWarnings` 全安全 code、缺省、去重、数量限制、长度限制、非字符串、空字符串、未知 code、raw payload、PII、完整正文、SQL、stack、token、secret、`DATABASE_URL` 和连接串拒绝测试。
- 补强源码扫描，确认 mapper 不调用 HIS / 企微 / AI / RAG / Agent / fetch / axios / Webhook，不写数据库，不创建治疗摘要或随访任务。
- 不写数据库。
- 不新增 API。
- 不接真实 HIS。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达。

### PR 3C：文档 / smoke 收尾

状态：

- 已完成本次文档 / smoke 收尾。
- 补充 mapper domain-only 最小闭环 smoke。
- README、roadmap、devlog、spec 和 plan 轻量同步 Phase 22 PR 3C 收口状态。

范围：

- 确认 `StandardTreatmentEvent` 输出包含 `recoveryStage`、`rawSourceType`、`mappingWarnings`。
- 确认 `sourceSystem`、`sourceEventId`、`sourceCustomerId`、`appointmentRef` 命名仍保留。
- 确认 `externalEventId`、`externalSource`、`customerExternalId`、`appointmentExternalId` 仍不进入核心 DTO。
- 确认 `tenantId`、`eventId`、`receivedAt` 仍只来自 context。
- 确认 `mappingWarnings` 仍为安全告警代码数组。
- 沿用 PR 3B 源码扫描测试，确认 mapper 不调用 HIS / 企微 / AI / RAG / Agent，不写数据库，不创建治疗摘要或随访任务。
- 不新增 API。
- 不改 schema / migration。
- 不接真实 HIS。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不自动触达。

建议验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/StandardTreatmentEventMapper.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
```

### PR 4：人工复核 / 预览流程 Plan Mode

状态：

- 未开始。
- 只有当产品需要机构人员查看标准事件候选时才进入。

建议范围：

- 规划预览 DTO。
- 规划人工确认、拒绝、忽略和审计。
- 规划敏感字段展示边界。
- 不自动创建治疗摘要。
- 不做患者身份匹配。
- 不接真实 HIS。

### PR 5：患者身份匹配 Plan Mode

状态：

- 未开始。

建议范围：

- 规划 `customerExternalId`、match key、置信度和人工确认。
- 规划跨租户隔离和审计。
- 不保存手机号原文、身份证号或病历号原文。
- 不把外部客户 ID 当作授权依据。

### PR 6：治疗摘要创建来源治理 Plan Mode

状态：

- 未开始。

建议范围：

- 规划标准事件到治疗摘要的人工确认创建流程。
- 规划摘要来源字段、幂等、重复治理和审计。
- 规划摘要编辑 / 作废后的来源追溯。
- 不自动创建随访任务。
- 不自动触达。

### PR 7：真实 HIS adapter Plan Mode

状态：

- 未开始。

建议范围：

- 规划真实 HIS 连接配置、凭证、租户绑定、同步方式、Webhook、重试、幂等和审计。
- 明确 raw payload 不入库策略。
- 明确外部系统错误降级和人工复核。
- 不和 domain-only mapper 实现混在同一个 PR。

## 5. 单独评估门槛

以下能力不能混入 Phase 22 当前 docs-only PR，必须单独评估：

- 标准事件需要落库。
- 需要新增 mapper API、预览 API 或导入 API。
- 需要接真实 HIS、Webhook、文件导入或外部系统同步。
- 需要保存任何 raw payload、原始响应体、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 需要患者身份匹配。
- 需要自动创建治疗摘要。
- 需要自动创建随访任务。
- 需要企微、短信、电话或自动触达。
- 需要 AI 解析、RAG 或 Agent。
- 需要经营智能中心、图表、导出或归因分析。

## 6. 验收清单

当前 docs-only PR 验收：

- 设计文档说明 Phase 22 只是 Plan Mode。
- 设计文档说明 HIS 标准治疗事件 mapper v1 目标。
- 设计文档说明与现有治疗摘要、路径模板、随访建议、来源任务、运营分析的关系。
- 设计文档覆盖建议字段：`externalEventId`、`externalSource`、`tenantId`、`customerExternalId`、`appointmentExternalId`、`treatmentDate`、`treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`riskLevel`、`nextCareAction`、`tags`、`rawSourceType`、`mappingWarnings`。
- 设计文档明确 v1 只做 mapper 规划，不接真实 HIS。
- 设计文档明确当前不保存 raw HIS payload。
- 设计文档明确当前不做患者身份匹配。
- 设计文档明确当前不自动创建治疗摘要。
- 设计文档明确当前不自动创建随访任务。
- 设计文档明确当前不自动触达。
- 设计文档明确当前不做 AI 解析。
- 计划文档给出后续 PR 拆分建议。
- README、roadmap、devlog 只做轻量状态同步。
- 没有代码、测试、API、schema、migration、权限、认证、租户隔离或 demo seed 变更。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。

## 7. 停止条件

当前 PR 或后续执行中出现以下情况，必须停止并回报：

- 必须写代码才能完成当前 docs-only PR。
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
- 必须修改 demo seed 数据。
- 必须做经营智能中心、图表或导出。
