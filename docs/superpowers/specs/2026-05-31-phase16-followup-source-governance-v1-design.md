# Phase 16 随访任务来源治理增强 v1 设计

> 日期：2026-05-31
> 状态：Phase 16 PR 1 规划文档。当前阶段默认选择“随访任务创建后的治理增强 v1”，本 PR 只固化 spec / plan，不修改业务代码、API、schema、权限、页面或测试。

## 1. Phase 16 目标

Phase 16 默认选择“随访任务创建后的治理增强 v1”。目标是在 Phase 15 已完成治疗摘要到随访任务的人工确认创建链路后，补齐创建后的治理能力：

- 机构端能看清随访任务是否来自治疗摘要。
- 机构端能按来源筛选随访任务。
- 机构端能按 `sourceTreatmentSummaryId` 定位某条治疗摘要创建出的随访任务。
- 治疗摘要管理页能对同一来源建议展示只读重复任务提示。
- 服务端继续从 access context 推导 `tenantId`。
- 前端不得传入或切换 `tenantId`。
- 查询结果只能来自当前租户。
- DTO 不返回完整治疗摘要正文、完整治疗记录正文、完整病历正文、咨询全文、图片 / 文件原文或新增 PII。
- Phase 16 v1 默认不新增 schema / migration，复用 Phase 15 已完成的 `follow_up_tasks` 来源字段。

Phase 16 v1 是治理增强，不是新触达系统，也不是治疗摘要生命周期管理。本阶段不自动创建任务、不自动触达客户、不接外部渠道、不做治疗摘要编辑或作废。

## 2. 为什么优先做随访任务创建后的治理增强

Phase 15 已完成：

- 基于结构化治疗摘要生成确定性随访建议。
- 机构人员人工确认后创建 `follow_up_tasks`。
- 为来源任务写入 `sourceTreatmentSummaryId` 和 `sourceSuggestionKey`。
- 同一来源建议的活跃任务去重 / 幂等。
- 治疗摘要管理 UI 可查看建议并人工确认创建任务。

当前缺口在“创建后如何治理”：

- 普通随访列表尚未形成来源筛选能力。
- 机构人员在随访列表中无法明确区分普通随访任务与治疗摘要来源任务。
- 治疗摘要管理页的重复任务感知主要来自确认创建时的冲突结果，缺少确认前的只读提示。
- Phase 15 已经保存来源字段，如果 Phase 16 不做治理展示，这些字段的运营价值没有充分释放。

优先做本方向的理由：

- 承接 Phase 15 最直接：不改变治疗摘要内容，只把已创建任务的来源关系用起来。
- 技术风险最低：复用现有 API、repository、DTO、UI 和 Phase 15 来源字段。
- schema 风险最低：v1 默认不改数据结构。
- 隐私风险较低：只展示来源关系，不扩大到医疗正文、病历正文、咨询全文或文件原文。
- 业务闭环更完整：机构人员能从“创建任务”走到“查看来源、筛选来源、避免重复操作”。

## 3. 为什么治疗摘要编辑、治疗摘要作废、RAG 后置

### 3.1 治疗摘要编辑能力后置

治疗摘要编辑能力业务价值高，但会修改医疗敏感结构化记录，需要单独设计：

- 可编辑字段白名单。
- 字段级校验与敏感内容拒绝。
- 修改前后值的审计边界。
- 编辑后是否重新生成随访建议。
- 编辑后是否影响已创建随访任务。
- 并发编辑、过期数据、冲突提示和 UI 交互。

Phase 16 先做来源治理，可以避免在同一阶段混入“修改医疗摘要”和“治理已创建随访任务”两个不同风险面。编辑能力建议作为 Phase 17 强候选单独进入 Plan Mode。

### 3.2 治疗摘要作废能力后置

治疗摘要作废能力适合保留历史可追溯，但它会引入生命周期语义：

- 作废字段或状态需要 schema / migration。
- 作废后是否允许查看建议。
- 作废后是否允许继续确认创建任务。
- 已有来源随访任务是否展示“来源已作废”。
- 列表、时间线、详情和审计如何展示作废状态。
- 是否允许恢复、是否需要作废原因、作废原因是否可能含 PII。

Phase 16 v1 不改治疗摘要生命周期。作废能力建议在来源治理稳定后独立规划。

### 3.3 知识库 / RAG 后置

知识库 / RAG 长期价值高，但它是当前候选中隐私风险最高的方向。即使只做基础准备，也容易滑向：

- 文件上传。
- 文件解析。
- 正文保存。
- 医疗隐私内容分块。
- embedding。
- 检索命中。
- AI provider 调用。
- Agent 或自动问答。
- 跨租户知识泄漏和提示词注入。

Phase 16 不进入真实 RAG、AI provider、Agent、知识库问答或文件正文保存。若后续要做知识库，只能先单独做安全 Plan / Spec，并明确不保存医疗隐私正文。

## 4. 随访任务来源治理 v1 范围

Phase 16 v1 可以做：

- 扩展 `GET /api/institution/followups` 查询白名单。
- 支持 `source=treatment_summary` 来源筛选。
- 支持 `sourceTreatmentSummaryId` 筛选。
- 返回安全来源字段。
- 随访列表展示来源标签。
- 治疗摘要管理页展示同来源活跃随访任务的只读重复提示。
- 补充 API、client、repository、UI 和 workspace smoke / entry 测试。
- 更新 README、roadmap、devlog 和 Phase 16 文档收尾。

Phase 16 v1 不做：

- 新增独立 follow-up 创建能力。
- 改变 Phase 15 人工确认创建 API。
- 改变 follow-up 状态机。
- 自动创建随访任务。
- 自动触达客户。
- 外部渠道集成。
- 治疗摘要编辑。
- 治疗摘要作废。
- 删除或批量操作。

## 5. 不纳入本阶段

Phase 16 不做：

- 治疗摘要编辑能力。
- 治疗摘要作废能力。
- AI provider。
- AI 生成护理建议。
- Agent。
- RAG / 知识库真实能力。
- 企业微信。
- 短信。
- 电话外呼。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 自动触达客户。
- 自动发微信。
- 自动发短信。
- 自动电话外呼。
- 自动企微触达。
- 自动推送客户消息。
- 删除随访任务。
- 批量操作。
- 大规模 UI 重构。

如果后续 PR 执行时发现必须进入上述能力，应停止实现并重新进入 Plan Mode，不能在 Phase 16 顺手扩大范围。

## 6. follow-up 来源筛选设计

优先复用并扩展现有：

- `GET /api/institution/followups`

v1 新增或评估以下查询参数：

| 参数 | 规则 | 说明 |
| --- | --- | --- |
| `source` | 只允许 `treatment_summary` | 只返回治疗摘要来源的随访任务 |
| `sourceTreatmentSummaryId` | 字符集 `A-Za-z0-9_:-`，长度 1-96 | 只返回当前租户内该治疗摘要来源的随访任务 |

查询规则：

- 未传 `source` 和 `sourceTreatmentSummaryId` 时，保持返回当前租户全部随访任务。
- `source=treatment_summary` 时，返回 `sourceTreatmentSummaryId` 与 `sourceSuggestionKey` 均非空的任务。
- 传入 `sourceTreatmentSummaryId` 时，隐含来源为治疗摘要来源。
- `sourceTreatmentSummaryId` 不能作为授权依据，只能作为当前租户数据范围内的筛选条件。
- 不接受 `tenantId` 查询参数。
- 不接受 `customerId`、`customerName`、`phoneNumber`、`medicalRecordNo`、`include`、`fields`、`metadata` 等非白名单参数。
- 未知参数返回 `400`，避免静默忽略敏感或误拼参数。
- 重复参数返回 `400`，例如 `source=a&source=b`。
- 跨租户或不存在的 `sourceTreatmentSummaryId` 统一返回空列表，不通过 `404` 或错误文案泄漏治疗摘要是否存在。

服务端实现边界：

- `tenantId` 必须来自 access context。
- repository 查询必须始终带 `follow_up_tasks.tenant_id = context.tenantId`。
- source filter 不能绕过现有 RBAC。
- read audit 继续按 `follow_up/read_own_tenant` 记录。
- 查询失败统一返回现有数据服务错误，不暴露 SQL、schema、索引或外部连接信息。

## 7. source 字段 API 白名单设计

请求 query 白名单只允许：

- `source`
- `sourceTreatmentSummaryId`

响应 DTO 中与来源相关的白名单字段建议为：

- `sourceType`
- `sourceTreatmentSummaryId`
- `sourceSuggestionKey`

字段语义：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sourceType` | `'treatment_summary' \| null` | 当任务来自治疗摘要时为 `treatment_summary`，普通任务为 `null` |
| `sourceTreatmentSummaryId` | `string \| null` | 来源治疗摘要 ID；普通任务为 `null` |
| `sourceSuggestionKey` | `string \| null` | Phase 15 确定性建议 key；普通任务为 `null` |

不建议在随访列表 DTO 中新增：

- `tenantId`
- 治疗摘要 `summary`
- 治疗摘要 `nextCareAction`
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 客户手机号、身份证号、病历号原文。
- 任意外部系统 payload。
- AI prompt、AI completion、embedding 或 provider 响应。

如果实现阶段发现当前 follow-up DTO 已有历史字段暴露，应避免在 Phase 16 中扩大暴露面。新增来源字段必须保持最小、安全、可测试。

## 8. 治疗摘要来源标签展示设计

机构端随访列表中，来源标签用于帮助运营人员识别任务来源。

展示建议：

- 普通任务：不显示来源标签，或显示轻量文案“普通随访”。
- 治疗摘要来源任务：显示“来自治疗摘要”。
- 如果需要辅助定位，可显示 `sourceTreatmentSummaryId` 的短 ID，但不显示治疗摘要正文。
- 鼠标悬停或辅助信息可以说明“由治疗摘要随访建议人工确认创建”。

UI 边界：

- 标签只读。
- 标签不触发自动创建。
- 标签不触发自动触达。
- 标签不展示完整摘要、病历正文、咨询全文、图片或文件。
- 标签不提供编辑治疗摘要或作废治疗摘要入口。
- 标签不引入复杂工作流或跨页面大规模重构。

## 9. 治疗摘要管理页重复任务提示设计

治疗摘要管理页在展示 Phase 15 随访建议时，应能基于当前建议来源查询是否已存在同来源任务，并给出只读提示。

推荐流程：

1. 机构人员打开某条治疗摘要详情。
2. UI 加载治疗摘要随访建议。
3. UI 使用 `sourceTreatmentSummaryId` 查询当前租户下同来源随访任务。
4. UI 将返回任务按 `sourceSuggestionKey` 与当前建议匹配。
5. 若存在活跃任务，展示只读提示。
6. 提示不自动创建任务，不自动触达客户。

提示文案示例：

- “该建议已有进行中的随访任务。”
- “该治疗摘要已创建过同来源随访任务。”
- “已有同来源随访任务，请在智能随访中继续处理。”

提示展示建议：

- 活跃任务提示应靠近确认创建按钮或建议卡片。
- 如果当前建议已有活跃任务，确认创建按钮可禁用，或保留点击后仍由服务端返回 `409 Conflict`；无论 UI 如何处理，服务端幂等必须继续兜底。
- 已完成 / 已取消任务可以作为历史信息展示，但不应被视为阻断重复创建的活跃任务。

## 10. duplicate hint 的定义

`duplicate hint` 是治疗摘要管理页中的只读提示，用于告知机构人员同一来源建议已经存在随访任务。

判断 key：

- `tenantId`：来自 access context。
- `sourceTreatmentSummaryId`：当前治疗摘要 ID。
- `sourceSuggestionKey`：当前建议 key。

算作“活跃任务”的状态：

- `scheduled`
- `due`
- `in_progress`
- `escalated`

不算重复阻断的终态：

- `completed`
- `cancelled`

规则：

- 同一 `tenantId + sourceTreatmentSummaryId + sourceSuggestionKey` 如果存在活跃任务，显示 duplicate hint。
- 同一来源只有 `completed` 或 `cancelled` 任务时，不算活跃重复；v1 可显示较弱历史提示，但不能阻断服务端允许的重新创建策略。
- duplicate hint 只读，不自动创建任务。
- duplicate hint 不自动触达客户。
- duplicate hint 不能替代服务端幂等校验；POST 人工确认 API 仍必须保留 Phase 15 的冲突兜底。
- duplicate hint 不能通过错误文案泄漏跨租户治疗摘要是否存在。

## 11. DTO 不返回字段边界

Phase 16 v1 的 DTO 不应新增返回：

- `tenantId`。
- `sourceTenantId`。
- 完整治疗摘要正文。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件原文。
- 文件路径、对象存储 key、下载 URL。
- 客户手机号原文。
- 身份证号原文。
- 病历号原文。
- 外部系统 payload。
- AI prompt。
- AI completion。
- embedding。
- API Key、OAuth token、Webhook secret 或其他 secret。
- SQL、堆栈、数据库连接信息。

允许继续返回现有随访任务运营字段：

- `id`
- `customerId`
- `customerDisplayName`
- `journeyId`
- `stage`
- `status`
- `dueAt`
- `suggestedAction`
- `riskLevel`
- `updatedBy`
- `updatedAt`

新增来源字段仅限第 7 节白名单。若实现时需要调整既有 DTO，应以测试锁定“没有新增医疗正文 / PII 暴露”为优先。

## 12. 租户隔离设计

租户隔离原则：

- 机构端 `tenantId` 只能来自服务端 access context。
- 前端不能通过 URL、query、header、body、localStorage 或浏览器状态切换租户。
- `GET /api/institution/followups` 不接受 `tenantId`。
- 所有查询必须带当前 `tenantId`。
- `sourceTreatmentSummaryId` 只作为当前租户内筛选条件，不能作为授权依据。
- 不存在或跨租户的 `sourceTreatmentSummaryId` 返回空结果，不返回可区分的 `404`。
- audit 事件中的 `tenantId` 继续来自 access context。
- UI 不缓存或拼接跨租户来源查询。

必须测试：

- `tenantId` 查询参数返回 `400`。
- 未登录返回 `401`。
- 无权限返回 `403`。
- 当前租户只能读到自己的随访任务。
- `sourceTreatmentSummaryId` 指向其他租户治疗摘要时返回空列表。
- DTO 不包含跨租户来源信息。

## 13. 医疗隐私与 PII 边界

Phase 16 v1 只处理来源关系，不扩大医疗内容处理范围。

允许使用：

- 随访任务现有运营字段。
- `sourceTreatmentSummaryId`。
- `sourceSuggestionKey`。
- `sourceType = treatment_summary`。

禁止引入：

- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 图片 / 文件原文。
- 医疗文件上传。
- 文件解析。
- RAG chunk。
- embedding。
- AI prompt / completion。
- 客户手机号原文。
- 身份证号原文。
- 病历号原文。
- 外部系统原始 payload。

展示原则：

- 随访列表中的来源标签只说明来源类型，不展示治疗摘要正文。
- 治疗摘要管理页的 duplicate hint 只说明任务存在状态，不复制任务正文或客户 PII。
- 错误信息不包含 SQL、stack、schema、secret、token 或外部系统信息。

## 14. 是否新增 API

Phase 16 v1 优先不新增新的 route。

推荐扩展现有：

- `GET /api/institution/followups`

扩展内容：

- 新增 query parser。
- 增加 `source` / `sourceTreatmentSummaryId` 白名单筛选。
- 返回安全来源字段。
- 保持现有 `PATCH /api/institution/followups` 状态流转不变。
- 保持 Phase 15 的 `GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions` 不变。
- 保持 Phase 15 的 `POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks` 不变。

只有在实现阶段证明现有 route 无法安全承载来源查询时，才允许重新进入 Plan Mode 评估新 API。PR 1 不新增 API。

## 15. 是否新增 schema / migration

Phase 16 v1 默认不新增 schema / migration。

理由：

- Phase 15 已在 `follow_up_tasks` 中完成 `source_treatment_summary_id`。
- Phase 15 已在 `follow_up_tasks` 中完成 `source_suggestion_key`。
- Phase 15 已完成来源索引和活跃来源唯一约束。
- Phase 16 目标是读取和展示来源关系，不需要新表或新字段。

执行边界：

- PR 1 不修改数据结构。
- PR 2 / PR 3 默认不修改数据结构。
- 如果后续发现索引不足，只记录为后续性能优化，不在 PR 1 中实现。
- 如果后续需要新增 `sourceType` 持久化字段，应停止并重新进入 Plan Mode，因为这会改变 v1 的“只复用 Phase 15 来源字段”前提。

## 16. 推荐 PR 拆分

### PR 1：Phase 16 spec / plan 文档

范围：

- 新增 Phase 16 design spec。
- 新增 Phase 16 implementation plan。
- 不改业务代码。
- 不改 API route。
- 不改页面。
- 不改测试。
- 不改数据库 schema / migration。
- 不改权限、认证、租户隔离。

风险：

- 低。主要风险是文档边界不清导致后续 PR 扩 scope。

验证：

- `git diff --check`
- 人工确认 diff 只包含两份 Markdown 文档。

### PR 2：后端 follow-up 来源筛选、DTO、安全查询、API 测试

范围：

- 扩展 `GET /api/institution/followups`。
- 增加 `source` / `sourceTreatmentSummaryId` 查询白名单。
- repository 支持当前租户内来源筛选。
- 返回安全来源字段。
- 补 API、parser、repository、client 测试。
- 不做 UI。

风险：

- 中低。主要风险是 query parser 与现有列表 handler 的兼容，以及 DTO 是否需要收敛历史字段。

验证：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TenantBusinessRepository.test.ts`
- 如新增独立 parser 测试，加入对应测试文件。
- `./node_modules/.bin/tsc --noEmit`

### PR 3：机构端随访列表来源展示、治疗摘要页重复任务提示、前端测试

范围：

- 智能随访列表增加来源筛选控件。
- 智能随访列表展示“来自治疗摘要”来源标签。
- 治疗摘要管理页根据来源查询展示 duplicate hint。
- 前端请求只发送白名单 query。
- 不做自动触达。
- 不做复杂工作流。

风险：

- 中。主要风险是 UI 状态组合增多、重复提示和确认创建按钮状态需要清晰。

验证：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx src/modules/institution/tests/TenantBusinessClient.test.ts`
- 必要时补 `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx` 局部运行。
- `./node_modules/.bin/tsc --noEmit`

### PR 4：smoke / 文档收尾

范围：

- 补 workspace smoke / entry 测试。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 16 spec / plan 完成状态。
- 给出 Phase 17 建议。

风险：

- 低到中。主要风险是 smoke 覆盖不足或文档宣称超过实际完成范围。

验证：

- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`

## 17. PR 范围、风险和验证汇总

| PR | 范围 | 风险 | 验证 |
| --- | --- | --- | --- |
| PR 1 | spec / plan 文档 | 低 | `git diff --check` |
| PR 2 | 后端来源筛选、DTO、API 测试 | 中低 | API / parser / repository / client tests，`tsc --noEmit` |
| PR 3 | 随访来源标签、duplicate hint、前端测试 | 中 | UI tests，client tests，`tsc --noEmit` |
| PR 4 | smoke / README / roadmap / devlog 收尾 | 低到中 | full vitest，typecheck，Next build |

Phase 16 完成后，建议 Phase 17 重新评估治疗摘要编辑能力 v1；治疗摘要作废能力和知识库 / RAG 继续后置，并分别进入独立 Plan Mode。
