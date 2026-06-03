# Phase 22 HIS 标准治疗事件 mapper v1 设计

> 日期：2026-06-03
> 状态：Phase 22 Plan Mode 文档。本 PR 只做文档规划，不写代码、不改测试、不新增 API、不改数据库 schema / migration、不接真实 HIS / 企微 / AI，也不做自动触达。

## 0. 本次结论

Phase 22 建议聚焦 **HIS 标准治疗事件 mapper v1**。

它不是新的 HIS 接入实现，也不是治疗摘要自动生成能力。它的目标是承接 Phase 17 已完成的标准治疗事件 domain-only 契约，进一步规划未来 HIS / 机构系统中的治疗事件如何先转换成智美天工内部可识别、可验证、可复用的标准治疗事件结构。

本 PR 只做 Plan Mode：

- 不实现 mapper 代码。
- 不接真实 HIS。
- 不接机构系统。
- 不保存 raw HIS payload。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不自动触达客户。
- 不接 AI / RAG / Agent。
- 不新增 API。
- 不新增数据库 schema / migration。
- 不改权限、认证或租户隔离。
- 不修改 demo seed 数据。

如果后续发现必须新增代码、schema、API、权限、外部系统接入、AI 解析、身份匹配、自动摘要、自动任务或自动触达能力，必须停止当前 docs-only 范围并单独进入对应 Plan Mode。

## 1. 只读检查结论

本次按要求只读检查了：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/README.md`
- `docs/devlog/2026-05-31.md`
- `docs/superpowers/specs/2026-06-03-phase21-followup-path-analysis-v1-design.md`
- `docs/superpowers/plans/2026-06-03-phase21-followup-path-analysis-v1.md`
- `src/modules/institution/domain/treatment-summaries.ts`
- `src/modules/institution/domain/treatment-path-templates.ts`
- `src/modules/institution/domain/treatment-followup-suggestions.ts`
- `src/modules/institution/domain/followup-path-analysis.ts`

已确认的现状：

- Phase 17 已完成 HIS 接入标准模型 / 标准治疗事件 v1，包括 domain-only 标准治疗事件类型、`sourceSystem` 稳定集合、mapper 输入 / 输出契约、字段白名单、禁止字段边界和 institution 测试。
- Phase 21 随访路径运营分析 v1 已完成最小闭环，不再继续追加 Phase 21 功能。
- `docs/devlog/2026-05-31.md` 是历史滚动日志，后续不应默认继续追加；Phase 22 应使用当前日期或阶段型 devlog。
- `treatment_summaries` 已是机构端可查看、可录入、可编辑、可作废、可用于随访建议和运营分析的安全结构化摘要。
- `treatment-path-templates.ts` 使用结构化字段匹配路径模板，且所有建议必须人工确认、禁止自动触达。
- `treatment-followup-suggestions.ts` 只基于治疗摘要结构化字段生成确定性建议，拒绝完整正文、PII、外部系统 payload、AI 内容和内部敏感字段。
- `followup-path-analysis.ts` 只基于治疗摘要、模板建议、来源任务和可识别 audit 计算聚合指标，不读取客户明细、完整治疗正文、raw audit payload 或外部系统原文。

因此 Phase 22 不需要重新定义整个标准治疗事件模型，而应规划未来 HIS / 机构系统事件进入智美天工时的 mapper v1 口径、字段命名、警告语义和后续拆分。

## 2. Phase 22 定位

Phase 22 是 Plan Mode，不是功能实现。

Phase 22 需要回答：

- HIS 标准治疗事件 mapper v1 的目标是什么。
- 它如何承接 Phase 17 标准治疗事件契约。
- 它和现有治疗摘要、路径模板、随访建议、来源任务、运营分析之间是什么关系。
- 标准治疗事件建议字段如何命名和解释。
- mapper 过程中哪些信息可以保留，哪些必须丢弃或只在内存中短暂使用。
- mapper v1 后续如果进入实现，应如何拆分 PR，避免一次性进入真实 HIS 接入、身份匹配、自动摘要、自动任务、AI 解析或自动触达。

Phase 22 当前不回答：

- 如何连接某个真实 HIS。
- 如何验签、重试、同步、分页或处理 Webhook。
- 如何保存标准治疗事件。
- 如何把标准治疗事件自动转成治疗摘要。
- 如何做患者身份匹配。
- 如何创建随访任务或触达客户。
- 如何用 AI 从病历正文中抽取结构化字段。

这些问题都必须后续单独评估。

## 3. v1 目标

HIS 标准治疗事件 mapper v1 的目标是：将未来来自 HIS / 机构系统的治疗事实，先映射成智美天工内部可识别、可验证、可复用的标准治疗事件结构，为后续能力提供稳定输入。

稳定输入主要服务于：

- 治疗摘要：未来可由人工复核后从标准事件生成结构化治疗摘要。
- 路径模板：使用标准化 `treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`riskLevel` 和 `tags` 匹配路径模板。
- 随访建议：使用结构化治疗事件字段生成确定性内部建议。
- 来源任务：后续如人工确认创建任务，可保留来源治疗事件或来源摘要的追溯链路。
- 运营分析：后续可把标准事件作为治疗事实输入，但当前 Phase 21 分析仍只读现有摘要、任务和 audit 聚合。

v1 mapper 的核心价值不是“多接一个系统”，而是让不同 HIS / 机构系统的字段差异停在 adapter / mapper 边界内，不污染内部治疗摘要、路径模板、随访任务和运营分析口径。

## 4. 和现有能力的关系

### 4.1 和 Phase 17 标准治疗事件的关系

Phase 17 已完成 `StandardTreatmentEvent` 和 `normalizeStandardTreatmentEvent` 的 domain-only 契约，字段包括 `sourceSystem`、`sourceEventId`、`sourceCustomerId`、`appointmentRef`、`treatmentDate`、`treatmentProject`、`treatmentCategory`、`treatmentStage`、`treatmentStatus`、`riskLevel`、`summary`、`nextCareAction`、`tags`、`occurredAt` 和 `receivedAt`。

Phase 22 不推翻 Phase 17，而是在文档中规划面向未来 HIS mapper 的字段语义：

| Phase 22 建议字段 | Phase 17 现有语义关系 |
| --- | --- |
| `externalEventId` | 对应或兼容 `sourceEventId`，用于外部事件追踪和幂等，不作为授权依据。 |
| `externalSource` | 对应或兼容 `sourceSystem`，用于表达来源系统类别。 |
| `customerExternalId` | 对应或兼容 `sourceCustomerId`，只用于后续身份匹配辅助。 |
| `appointmentExternalId` | 可映射到 `appointmentRef`，只表达外部预约引用。 |
| `recoveryStage` | 当前治疗摘要和路径模板已有该字段，后续标准事件 mapper 可评估纳入。 |
| `rawSourceType` | Phase 17 未单列，Phase 22 建议只保存粗粒度来源类型，不保存 raw payload。 |
| `mappingWarnings` | Phase 17 未单列，Phase 22 建议用于安全 warning code，不保存外部原文。 |

后续如要修改 TypeScript 契约，应单独实现并测试，不在本 docs-only PR 中改代码。

### 4.2 和治疗摘要的关系

治疗摘要是机构端可查看和运营使用的结构化对象。未来标准治疗事件可以成为治疗摘要的来源之一，但 v1 当前不自动创建治疗摘要。

建议关系：

- mapper 输出的标准事件可以被后续“人工复核 / 预览 / 摘要创建”流程读取。
- 创建治疗摘要必须后续单独设计人工确认、字段白名单、同租户 customer / appointment 校验和审计。
- 当前不写 `treatment_summaries`。
- 当前不修改治疗摘要创建、编辑、作废、列表或 timeline 逻辑。

### 4.3 和路径模板的关系

路径模板依赖稳定结构化字段，而不是 HIS 原始字段。

mapper v1 应为后续路径模板提供：

- `treatmentProject`
- `treatmentCategory`
- `treatmentStage`
- `recoveryStage`
- `riskLevel`
- `treatmentDate`
- `tags`

如果 HIS 项目名称无法稳定归类，mapper 应输出安全的 `mappingWarnings`，例如 `unknown_treatment_category`，而不是把外部自由文本直接扩散到路径模板规则。

### 4.4 和随访建议的关系

现有随访建议只基于结构化治疗摘要字段生成，且必须人工确认后才创建任务。未来标准治疗事件可作为建议输入的上游来源，但当前不自动生成随访建议。

后续如要从标准事件生成建议，应复用确定性规则和人工确认边界：

- 不调用 AI。
- 不自动触达客户。
- 不自动创建任务。
- 不把 `mappingWarnings` 当成客户可见文案。
- 不把 raw HIS payload 或完整正文传入建议规则。

### 4.5 和来源任务的关系

来源任务当前通过 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey` 追踪“治疗摘要 -> 建议 -> 人工确认任务”的链路。

未来如要支持“标准治疗事件 -> 摘要 -> 建议 -> 任务”或“标准治疗事件 -> 建议 -> 任务”，必须单独设计来源字段和幂等口径。Phase 22 当前只规划：

- `externalEventId` 可作为外部事件追踪辅助。
- `tenantId + externalSource + externalEventId` 可作为未来幂等设计候选。
- 当前不新增来源任务字段。
- 当前不修改现有重复来源任务治理。

### 4.6 和运营分析的关系

Phase 21 已完成随访路径运营分析 v1，只读聚合治疗摘要、模板建议、来源任务和 audit。标准治疗事件未来可以补充更稳定的治疗事实输入，但当前不进入运营分析实现。

后续如要把标准治疗事件纳入运营分析，应单独评估：

- 是否需要标准事件落库。
- 是否需要事件到治疗摘要的来源关系。
- 是否需要历史快照或报表 API。
- 是否影响 Phase 21 六个聚合指标。
- 是否会引入客户明细、完整治疗正文或 raw payload 风险。

## 5. 标准治疗事件建议字段

以下字段是 Phase 22 对 HIS mapper v1 输出结构的建议，不是当前数据库 schema，也不是本 PR 的 TypeScript 变更。

| 字段 | 类型建议 | 来源与边界 | 用途 |
| --- | --- | --- | --- |
| `externalEventId` | `string | null` | 外部治疗事件 ID。可用于幂等和排障，不作为授权依据，不进入普通机构端 DTO。 | 未来追踪外部事件来源。 |
| `externalSource` | `his | institution_system | import | manual | other` | 来源系统类别。真实厂商、连接配置和凭证不在本阶段实现。 | 区分来源语义，兼容 Phase 17 `sourceSystem`。 |
| `tenantId` | `string` | 只能来自服务端可信上下文或绑定租户的未来同步上下文。不得来自 HIS payload、前端 body、query、header 或 localStorage。 | 租户隔离和后续查询边界。 |
| `customerExternalId` | `string | null` | 外部客户编号。只用于后续身份匹配辅助，不代表已匹配内部客户。 | 身份匹配候选输入。 |
| `appointmentExternalId` | `string | null` | 外部预约号或外部就诊引用。只表达引用，不自动关联内部预约。 | 后续预约关联候选输入。 |
| `treatmentDate` | ISO datetime string | 治疗发生时间或外部系统中可确认的治疗时间。必须可解析。 | 路径节点、随访建议、分析窗口。 |
| `treatmentProject` | `string` | 安全短文本。禁止完整治疗正文、病历正文、咨询全文或 raw payload。 | 展示和项目归类辅助。 |
| `treatmentCategory` | `string` | 标准治疗类别，例如 `laser_repair`、`injection_review`、`skin_repair`、`skin_check`。未知时应 warning，不应自由扩散。 | 路径模板和随访规则匹配。 |
| `treatmentStage` | `string` | 安全阶段短文本，例如初治、复诊、疗程第 N 次、D7 复查。 | 路径模板和恢复阶段判断。 |
| `recoveryStage` | `string | null` | 恢复阶段标准值或安全短文本，例如 `D1`、`D3`、`D7`、`D14`、`stable`。 | 路径模板节点匹配。 |
| `riskLevel` | `normal | watch | urgent` | 标准风险等级。未知时默认策略必须后续明确，不能直接使用外部未知状态。 | 随访优先级和路径风险判断。 |
| `nextCareAction` | `string` | 结构化下一步护理或人工跟进动作。禁止完整医嘱正文、咨询全文或 AI 生成长文。 | 后续确定性随访建议输入。 |
| `tags` | `string[]` | 安全标签，数量和长度应限制。不得包含 PII、raw payload、完整正文、token、secret、SQL 或 stack。 | 路径模板和运营解释辅助。 |
| `rawSourceType` | `treatment_record | appointment | order | course_progress | manual_review | other` | 粗粒度外部记录类型。只能保存类别，不保存 raw payload、原始响应体或字段原文。 | 解释 mapper 来源，不泄露外部 payload。 |
| `mappingWarnings` | `string[]` | 安全 warning code，例如 `unknown_treatment_category`、`missing_recovery_stage`、`external_tenant_ignored`、`manual_review_required`。不得包含外部字段原文或 PII。 | 后续人工复核、降级和排障。 |

## 6. mapper v1 建议流程

未来实现时，建议链路为：

```text
可信租户上下文
+ 外部系统事件瞬时输入
↓
adapter 特定字段读取
↓
字段白名单映射
↓
标准治疗事件候选
↓
确定性校验和 mappingWarnings
↓
后续人工复核 / 治疗摘要 / 路径模板 / 随访建议
```

关键原则：

- raw HIS payload 可以在未来 adapter 内短暂读取，但当前和后续默认都不保存 raw payload。
- adapter 输出必须是标准字段白名单。
- 未知字段必须被拒绝或丢弃，不进入内部 DTO。
- `tenantId` 必须来自可信上下文。
- 患者身份匹配必须是后续独立流程，不能由 mapper 自行认定。
- mapper warning 必须是稳定 code，不能包含客户姓名、手机号、病历号、外部原文或完整正文。
- mapper 不应直接写数据库、创建摘要、创建随访任务或触达客户。

## 7. v1 错误和 warning 语义

建议后续实现时区分 fatal error 和 warning。

fatal error 示例：

- 缺少可信 `tenantId`。
- `treatmentDate` 无法解析。
- `treatmentProject` 缺失或包含敏感内容。
- `treatmentCategory` 缺失且无法安全归类。
- `riskLevel` 不是允许集合。
- 输入包含 raw payload、手机号原文、身份证号、病历号原文、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、AI prompt / completion、token、secret、SQL、stack 或数据库连接串。

warning 示例：

- `unknown_treatment_category`
- `missing_recovery_stage`
- `external_event_id_missing`
- `appointment_external_id_missing`
- `customer_external_id_missing`
- `manual_review_required`
- `external_status_mapped_to_default`
- `category_mapped_by_alias`

warning 只能用于内部复核和排障，不应作为客户可见文案。

## 8. v1 不做什么

Phase 22 v1 当前不做：

- 不写代码。
- 不改测试。
- 不新增 API。
- 不改现有 API。
- 不改数据库 schema。
- 不新增 migration。
- 不改权限、认证或租户隔离。
- 不接真实 HIS。
- 不接机构系统。
- 不接 Webhook。
- 不接企微、个人微信、短信或电话。
- 不接 AI / RAG / Agent。
- 不做 AI 解析。
- 不做自动触达。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不保存完整治疗正文。
- 不保存完整病历正文。
- 不保存咨询全文。
- 不上传或保存图片 / 文件原文。
- 不做患者身份匹配。
- 不自动创建治疗摘要。
- 不自动创建随访任务。
- 不修改 demo seed 数据。
- 不做经营智能中心、图表或导出。

## 9. 后续 PR 拆分建议

### PR 1：Phase 22 spec / plan 文档

当前 PR。

范围：

- 新增 Phase 22 设计文档。
- 新增 Phase 22 计划文档。
- 轻量同步 README、roadmap 和当前日期 devlog。
- 明确当前只是 Plan Mode，不进入实现。

### PR 2：标准事件 mapper 契约差异评估

仅在用户明确要求进入 Phase 22 实现后进行。

建议范围：

- 对比 Phase 17 `StandardTreatmentEvent` 和 Phase 22 字段建议。
- 评估是否需要新增 `recoveryStage`、`rawSourceType`、`mappingWarnings`。
- 评估是否沿用 `sourceEventId` / `sourceSystem` 命名，还是新增 `externalEventId` / `externalSource` 兼容层。
- 只做 domain-only 类型 / parser / 测试，不新增 API、schema、migration 或真实 HIS。

### PR 3：确定性 mapper v1 domain-only 实现

仅在契约差异评估通过后进行。

建议范围：

- 新增或调整纯函数 mapper。
- 覆盖治疗项目、类别、阶段、恢复阶段、风险等级、下一步护理动作和标签的白名单校验。
- 输出稳定 `mappingWarnings`。
- 不保存 raw payload。
- 不接真实 HIS。
- 不创建摘要、任务或触达。

### PR 4：人工复核 / 预览流程 Plan Mode

仅当需要让机构人员查看标准事件候选并确认是否生成摘要时单独规划。

建议范围：

- 只规划预览 DTO、人工确认、拒绝原因、审计和敏感字段边界。
- 不自动创建治疗摘要。
- 不做患者身份匹配。
- 不新增真实 HIS adapter。

### PR 5：患者身份匹配 Plan Mode

仅当需要把外部客户 ID / match key 关联到内部客户时单独规划。

建议范围：

- 定义 match key、置信度、人工确认和跨租户隔离。
- 不保存手机号原文、身份证号或病历号原文。
- 不把 `customerExternalId` 作为授权依据。

### PR 6：治疗摘要创建来源治理 Plan Mode

仅当需要从标准事件生成治疗摘要时单独规划。

建议范围：

- 人工确认后创建摘要。
- 摘要与标准事件来源关系。
- 幂等和重复治理。
- 编辑 / 作废后的来源追溯。
- 不自动创建随访任务。

### PR 7：真实 HIS adapter Plan Mode

仅当产品和安全边界确认后单独规划。

建议范围：

- 外部连接配置。
- 凭证安全。
- Webhook / 同步 / 重试 / 幂等。
- raw payload 不入库策略。
- 租户绑定。
- 审计。
- 错误降级。

真实 HIS adapter 不应和 mapper domain-only 实现混在同一个 PR。

## 10. 验收标准

当前 docs-only PR 的验收标准：

- 文档明确 Phase 22 只是 Plan Mode，不是功能实现。
- 文档说明 HIS 标准治疗事件 mapper v1 的目标。
- 文档说明与现有治疗摘要、路径模板、随访建议、来源任务和运营分析的关系。
- 文档覆盖 `externalEventId`、`externalSource`、`tenantId`、`customerExternalId`、`appointmentExternalId`、`treatmentDate`、`treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`riskLevel`、`nextCareAction`、`tags`、`rawSourceType` 和 `mappingWarnings`。
- 文档明确当前不保存 raw HIS payload。
- 文档明确当前不做患者身份匹配。
- 文档明确当前不自动创建治疗摘要。
- 文档明确当前不自动创建随访任务。
- 文档明确当前不自动触达。
- 文档明确当前不做 AI 解析。
- 文档给出后续 PR 拆分建议。
- 只改 Markdown。
- `git diff --check` 和 `git diff --cached --check` 通过。

## 11. 停止条件

当前 PR 或后续执行中出现以下任一情况，应停止并回报：

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
