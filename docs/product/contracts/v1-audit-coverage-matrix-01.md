# V1-AUDIT-COVERAGE-MATRIX-01：V1 主线审计覆盖矩阵

## 1. 背景与目标

本契约任务编号为 V1-AUDIT-COVERAGE-MATRIX-01，任务性质为 docs-only / contract-only。任务日期来自本地命令 `date "+%Y-%m-%d %Z %z"`，结果为 2026-06-09 CST +0800。

本契约基于以下产品事实源和已完成契约：

- `docs/product/zhimeitiangong-product-source-of-truth.md`
- `docs/product/zhimeitiangong-module-map.md`
- `docs/product/zhimeitiangong-v1-scope.md`
- `docs/product/zhimeitiangong-feature-addendum.md`
- `docs/product/zhimeitiangong-decision-log.md`
- `docs/product/reviews/prod-gap-review-01.md`
- `docs/product/contracts/v1-opportunity-contract-01.md`
- `docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `docs/product/contracts/v1-manual-confirm-contract-01.md`

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，1.0 主线是治疗后客户运营闭环。HIS 只是数据来源之一，不是系统主线，不阻塞 1.0。

本矩阵只定义 V1 主线动作的审计覆盖语义，帮助后续 UI-only、mock-only、test-only 或 runtime-later 小 PR 判断哪些动作必须审计、哪些动作建议审计、哪些动作暂不纳入 V1。它不是 AUDIT-PLAN-01，不实现审计 runtime、API、route、repository、schema、metadata、migration、worker、scheduler、queue 或 HIS compensation runtime。

## 2. 非目标 / 明确不做

本 PR 只新增本契约文档，不修复问题，不实现功能。

本 PR 明确不做：

- 不做 runtime。
- 不做 API。
- 不做 route。
- 不做 repository。
- 不做 service。
- 不做 schema。
- 不做 migration。
- 不新增 audit metadata。
- 不新增 audit action / reason / result enum。
- 不写 SQL。
- 不做 worker。
- 不做 scheduler。
- 不做 queue。
- 不做 HIS compensation audit runtime。
- 不接真实 HIS。
- 不读取真实 credential。
- 不实现真实 credential provider runtime。
- 不实现真实 HIS adapter runtime。
- 不发起真实外部业务网络调用。
- 不做自动触达。
- 不做自动营销。
- 不做 AI Agent 自动执行。
- 不做完整日志平台。
- 不做 observability / monitoring。
- 不新增测试。
- 不修复当前发现的问题。
- 不修改产品事实源原文件。
- 不修改 V1-OPPORTUNITY-CONTRACT-01 原契约。
- 不修改 V1-DASHBOARD-METRICS-CONTRACT-01 原契约。
- 不修改 V1-MANUAL-CONFIRM-CONTRACT-01 原契约。

本契约不继续推进 CONFIG-PLAN-01、SCHEDULER-PLAN-01、AUDIT-PLAN-01、OBS-PLAN-01、SCHEMA-REVIEW-01，也不继续推进 Phase 23 / Phase 24 HIS 风险治理线。

## 3. 审计覆盖设计原则

1. 审计覆盖服务治疗后客户运营闭环，不以 HIS 连接治理为系统主线。
2. 人工确认相关动作必须优先进入审计覆盖。
3. 复诊提醒、复购机会、沉睡客户机会三类机会必须具备审计语义。
4. 审计记录应使用低敏摘要，不记录高敏个人信息、完整病历、真实凭证或外部系统 raw payload。
5. 审计不代表自动触达。
6. 审计不代表真实预约。
7. 审计不代表交易或成交。
8. 审计不代表医疗效果判断。
9. 审计覆盖独立于真实 HIS 接入；真实 HIS 不阻塞 1.0。
10. 本矩阵不要求新增 schema。
11. 本矩阵不要求新增 migration。
12. 本矩阵不新增 audit enum。
13. 后续任何实现都必须单独授权，不能把本矩阵解释为 runtime 开发许可。

## 4. 术语定义

以下术语是产品审计覆盖语义，不是数据库 schema、不是 TypeScript interface、不是 SQL、不是 audit enum。

| 术语 | 辅助英文名 | 定义 | 边界 |
| --- | --- | --- | --- |
| 审计覆盖 | audit coverage | 某个 V1 主线动作是否应在后续实现中留下可追踪记录的产品判断。 | 不是当前 PR 的代码实现。 |
| 审计动作 | audit action | 需要被追踪的业务动作语义，例如进入待确认、人工确认、忽略、转内部随访。 | 不是代码枚举，不新增 action。 |
| 审计资源 | audit resource | 被操作或被追踪的产品对象，例如客户档案、治疗摘要、机会、人工确认对象、看板指标。 | 不是数据库资源枚举。 |
| 审计原因 | audit reason | 为什么发生该审计动作的低敏产品原因。 | 不是代码 reason 白名单。 |
| 低敏摘要 | low-sensitive summary | 只保留足够理解动作的低敏信息，例如对象类型、内部 ID、状态变化、来源类型和时间窗口。 | 不含完整手机号、身份证号、完整病历、凭证或 raw payload。 |
| 禁止字段 | forbidden fields | 审计中不得记录的高敏字段或高风险内容。 | 包括凭证、API Key、Token、HIS raw payload、外部错误全文等。 |
| 人工确认 | manual confirmation | 内部人员对建议、提醒或机会做出的确认、忽略、观察、完成、过期、转内部任务或预约意向判断。 | 不代表自动执行或客户已被触达。 |
| 内部随访任务 | internal follow-up task | 机构内部人员处理的随访 / 客户运营工作项。 | 不等于外部消息发送。 |
| 预约意向 | appointment intent | 人工确认后形成的内部预约方向。 | 不是真实预约，不同步 HIS。 |
| 复诊提醒 | revisit reminder | 治疗后复诊 / 复查 / 状态确认相关内部提醒。 | 不自动约诊，不做医疗诊断。 |
| 复购机会 | repurchase opportunity | 基于项目周期、生命周期、治疗摘要或随访反馈形成的轻量复购提示。 | 不代表成交，不自动营销。 |
| 沉睡客户机会 | dormant customer opportunity | 面向长期未预约、未到院、未随访或未互动客户的轻量激活提示。 | 不自动唤醒，不自动触达。 |
| 看板指标 | dashboard metric | 基础运营看板用于观察内部运营状态的统计口径。 | 不是 dashboard runtime、SQL 或聚合函数。 |
| HIS 补偿审计 | HIS compensation audit | Phase 23 / Phase 24 风险治理线中的 HIS 凭证或补偿相关审计方向。 | 暂不纳入本 V1 主线矩阵。 |

## 5. V1 主线动作清单

| V1 链路 | 主线动作 | 必须审计 | 当前仓库证据 | 缺口 | 后续建议 |
| --- | --- | --- | --- | --- | --- |
| 客户档案 / 患者信息 | 查看、创建、编辑客户档案，进入客户时间线 | 创建 / 编辑必须；查看建议 | `src/app/api/institution/customers/route.ts` 读写使用 tenant business audit；客户时间线读取审计摘要 | 查看动作不一定全部写入；低敏摘要白名单仍需收口 | test-only 或 contract-only，小范围锁定客户字段白名单与读取审计边界 |
| 预约 / 到院 | 创建、编辑预约，状态变更，到院 / 完成状态沉淀 | 创建 / 编辑 / 状态变更必须 | `src/app/api/institution/appointments/route.ts` 读写使用 tenant business audit；预约状态含待确认、到院、完成 | 到院作为预约状态存在，但没有独立到院确认原因审计口径 | UI-only / test-only 后续验证预约状态变化审计 |
| 项目 / 治疗记录 | 以治疗摘要承载项目、阶段、恢复和风险摘要 | 创建 / 编辑必须；查看建议 | `treatment_summaries` schema 与治疗摘要 route 有读写审计 | 独立项目目录和项目周期规则未锁定，影响复诊 / 复购原因解释 | contract-only 后续定义项目 / 治疗字段白名单 |
| 治疗后摘要 | 创建、编辑、作废、进入客户时间线、产出随访建议 | 必须 | 治疗摘要创建 / 编辑 / 作废 route 写 audit；作废 reason 已存在 | 随访建议“产出”自身更偏建议展示，是否写审计需明确 | test-only 后续锁定摘要创建 / 编辑 / 作废 / 建议边界 |
| 随访任务 | 查看任务、状态流转、人工确认后创建来源任务、完成 / 取消 / 过期 | 状态变更和人工确认创建必须；查看建议 | `src/app/api/institution/followups/route.ts`、`follow-up-tasks` route 写 audit；去重冲突 reason 已存在 | 普通任务创建入口和取消 / 过期口径未系统化 | test-only 或 contract-only 后续收口随访任务状态审计 |
| 复诊提醒 | 进入待确认、确认、忽略、转内部随访、转预约意向、完成、过期 | 必须 | 契约层已定义三类机会与看板指标；运行时代码中复诊主要散落在模板 / seed / 摘要 / 随访 | 缺少复诊提醒对象级审计覆盖实现和测试 | UI-only / mock-only 先验证卡片和空态，runtime-later 单独授权 |
| 复购机会 | 进入待确认、确认、忽略、转内部随访、转预约意向、继续观察、完成、过期 | 必须 | `repurchase_window` 生命周期、看板 supporting stat、机会契约和人工确认契约 | 缺少复购机会对象级审计覆盖实现和测试 | UI-only / mock-only 先验证轻量列表，runtime-later 单独授权 |
| 沉睡客户机会 | 进入待确认、确认、忽略、继续观察、转内部随访、完成、过期 | 必须 | `silent_reactivation` 生命周期和机会契约定义阈值待产品确认 | 阈值、对象、状态和审计覆盖均未 runtime 落地 | contract-only / UI-only 后续锁定阈值展示和确认动作 |
| 人工确认 | 进入待确认、确认、忽略、继续观察、完成、过期、改优先级、低敏备注变化 | 必须 | V1-MANUAL-CONFIRM-CONTRACT-01 已定义统一确认对象和动作；治疗摘要随访确认 route 已局部落地 | 复诊 / 复购 / 沉睡机会没有统一确认 runtime 或审计测试 | test-only 或 UI-only 后续锁定确认入口和审计期望 |
| 基础运营看板 | 指标口径变更、指标下钻、mock / seed / demo 提示文案变化 | 口径变更必须；查看建议 | V1-DASHBOARD-METRICS-CONTRACT-01 已定义指标字典；现有工作台聚合客户、预约、随访和复购窗口 | 看板指标目前无 V1 机会对象级审计输入；指标语义变更无审计记录 | docs-only / UI-only 后续锁定指标口径提示和下钻入口 |
| 审计追踪 | 登录 / 租户 / 权限拒绝、跨租户拒绝、审计日志查看、平台 / 机构审计入口 | 必须 | `audit_events` 表、审计 domain / repository / query、机构 / 平台审计 API / UI 已存在 | V1 主线动作级 coverage matrix 缺失；HIS reason 过多易稀释主线 | 本文档先收口；后续 test-only 锁定最小覆盖 |

## 6. 审计覆盖矩阵

| V1 链路 | 主线动作 | 动作说明 | 建议审计等级 | 建议审计资源 | 建议审计动作口径 | 建议审计原因口径 | 低敏摘要建议 | 禁止记录内容 | 当前仓库证据 | 当前状态 | 后续建议 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 客户档案 / 患者信息 | 客户创建 | 新增客户档案作为运营闭环基础对象 | 必须 | 客户档案 | 创建客户档案 | 内部人员创建或导入轻量客户资料 | 客户内部 ID、来源类型、操作者角色 | 完整手机号、身份证号、详细病历、外部 raw payload | `customers/route.ts` 写入成功审计 | Covered | 后续 test-only 锁定低敏字段 |
| 客户档案 / 患者信息 | 客户编辑 | 调整客户生命周期、优先级、标签或基础资料 | 必须 | 客户档案 | 更新客户档案 | 内部人员更新运营字段 | 客户内部 ID、变更字段类别、前后状态摘要 | 完整联系方式、身份证、私密备注全文 | `customers/route.ts` PATCH 写审计 | Covered | 后续字段白名单契约补充 |
| 客户档案 / 患者信息 | 客户查看 / 时间线查看 | 查看客户档案或客户时间线 | 建议 | 客户档案 / 客户时间线 | 查看客户运营信息 | 内部运营查看或审计复盘 | 客户内部 ID、查看入口、操作者角色 | 完整时间线高敏正文、完整医疗记录 | 时间线 route 读取客户相关审计摘要 | Partial | 后续 test-only 明确哪些查看要写审计 |
| 预约 / 到院 | 预约创建 | 为客户创建内部预约记录 | 必须 | 预约 | 创建预约 | 内部人员登记预约 | 预约内部 ID、客户内部 ID、项目摘要、时间窗口 | 完整联系方式、外部系统 raw payload | `appointments/route.ts` POST 写审计 | Covered | 后续锁定预约低敏摘要 |
| 预约 / 到院 | 预约编辑 / 到院状态变化 | 更新预约状态、改约、到院或完成 | 必须 | 预约 | 更新预约状态 | 状态变更或到院确认 | 预约内部 ID、状态前后、时间窗口 | 详细诊疗内容、外部系统错误全文 | `appointments/route.ts` PATCH 写审计 | Partial | 后续明确到院状态原因口径 |
| 项目 / 治疗记录 | 项目 / 治疗摘要字段创建 | 以治疗摘要记录项目、阶段、恢复和风险摘要 | 必须 | 治疗摘要 | 创建治疗摘要 | 治疗后服务记录进入运营闭环 | 摘要内部 ID、客户内部 ID、项目 / 阶段摘要 | 完整病历、诊断细节、影像、敏感医疗正文 | 治疗摘要创建 route 写审计 | Covered | 后续字段白名单契约 |
| 治疗后摘要 | 摘要编辑 | 修正治疗摘要、下一步建议或低敏标签 | 必须 | 治疗摘要 | 更新治疗摘要 | 内部人员编辑结构化摘要 | 摘要内部 ID、字段类别、状态摘要 | 请求体全文、完整病历、PII | `treatment-summaries/[summaryId]/route.ts` 写审计 | Covered | 后续 test-only 锁定不带请求体 |
| 治疗后摘要 | 摘要作废 | 作废重复、错误或不适用摘要 | 必须 | 治疗摘要 | 作废治疗摘要 | 重复摘要、错误摘要或不再适用 | 摘要内部 ID、作废原因短码、低敏短说明 | 敏感作废原因全文、病历正文、身份信息 | `void/route.ts` 写 `treatment_summary_voided` 相关审计 | Covered | 后续 test-only 锁定敏感原因过滤 |
| 治疗后摘要 | 随访建议产出 | 根据摘要字段产出内部随访建议 | 必须 | 治疗摘要 / 随访建议 | 产出内部建议 | 治疗后摘要命中路径或规则建议 | 摘要内部 ID、规则来源、建议类型 | AI prompt 全文、医疗诊断、客户隐私 | 建议 route 与确认 route 存在，但建议产出审计不统一 | Partial | 后续 contract-only / test-only 定义建议产出是否写审计 |
| 随访任务 | 人工确认后创建内部随访 | 人工确认随访建议并创建内部任务 | 必须 | 内部随访任务 | 转内部随访任务 | 人工确认来源建议 | 任务内部 ID、来源摘要 ID、建议 key、状态 | 客户联系方式、完整建议正文、外部消息内容 | `follow-up-tasks/route.ts` 成功写 `follow_up` 审计 | Covered | 后续映射到统一人工确认对象 |
| 随访任务 | 随访任务状态变化 | 任务进入处理中、完成、取消、过期或冲突 | 必须 | 内部随访任务 | 更新任务状态 | 内部人员处理任务或状态冲突 | 任务内部 ID、前后状态、操作者角色 | 外部沟通全文、电话录音、微信内容 | `followups/route.ts` PATCH 写 audit；冲突 reason 已存在 | Partial | 后续补取消 / 过期语义 |
| 随访任务 | 作废摘要阻断随访 | 作废摘要不允许继续创建来源随访 | 必须 | 内部随访任务 / 治疗摘要 | 阻断无效来源任务 | 来源摘要已作废 | 摘要内部 ID、阻断原因短语 | 作废原因敏感全文、病历正文 | `voided_treatment_summary_follow_up_blocked` 已存在 | Covered | 后续纳入测试计划 |
| 随访任务 | 重复来源任务冲突 | 同一来源建议已有活跃任务 | 必须 | 内部随访任务 | 拒绝重复来源任务 | 活跃来源随访已存在 | 任务内部 ID、来源摘要 ID、冲突类型 | SQL、堆栈、请求体全文 | `active_source_follow_up_exists` 已存在 | Covered | 后续纳入 V1 审计测试 |
| 复诊提醒 | 进入待确认 | 复诊提醒进入人工处理范围 | 必须 | 复诊提醒 | 进入待确认 | 治疗阶段、复诊窗口或随访结果触发 | 机会类型、客户内部 ID、来源类型、dueDate 窗口 | 真实手机号、完整病历、诊疗结论 | 机会契约和看板契约已定义；runtime 未统一 | Missing | UI-only / mock-only 先验证 |
| 复诊提醒 | 确认 / 忽略 / 转内部随访 / 转预约意向 | 内部人员处理复诊提醒 | 必须 | 复诊提醒 / 人工确认对象 | 人工确认动作 | 人工选择继续处理或忽略 | 状态前后、选中动作、操作者角色 | 外部消息内容、真实预约号、HIS payload | 人工确认契约已定义；现有仅治疗摘要随访确认局部落地 | Partial | test-only / runtime-later 单独授权 |
| 复购机会 | 进入待确认 | 复购机会进入人工确认 | 必须 | 复购机会 | 进入待确认 | 生命周期、项目周期或随访反馈触发 | 机会类型、客户内部 ID、来源摘要、优先级 | 成交预测、金额、支付信息、营销话术全文 | `repurchase_window` 和契约存在；对象级审计未落地 | Missing | UI-only / mock-only 后续 |
| 复购机会 | 确认 / 忽略 / 转随访 / 转预约意向 / 继续观察 | 内部人员处理复购机会 | 必须 | 复购机会 / 人工确认对象 | 人工确认动作 | 内部人员选择运营处理方向 | 状态前后、动作、低敏备注摘要 | 真实交易金额、支付记录、外部触达内容 | 契约存在；runtime 未统一 | Missing | runtime-later 需单独授权 |
| 沉睡客户机会 | 进入待确认 | 沉睡客户机会进入人工确认 | 必须 | 沉睡客户机会 | 进入待确认 | 长时间未互动或试运行阈值触发 | 客户内部 ID、阈值层级、最后互动类型 | 完整联系方式、外呼内容、外部系统 raw payload | 契约定义阈值待确认；runtime 未落地 | Missing | contract-only / UI-only 后续 |
| 沉睡客户机会 | 确认 / 忽略 / 继续观察 / 转随访 / 过期 | 内部人员处理沉睡机会 | 必须 | 沉睡客户机会 / 人工确认对象 | 人工确认动作 | 内部人员决定是否继续观察或跟进 | 状态前后、阈值层级、选中动作 | 自动唤醒内容、外呼录音、营销内容 | 契约存在；runtime 未统一 | Missing | mock-only 先验证 |
| 人工确认 | 进入待确认 | 建议、机会或看板项进入待确认入口 | 必须 | 人工确认对象 | 进入待确认 | AI / 规则 / 模板 / 看板提示需人工判断 | 对象类型、来源类型、状态前后 | AI prompt 全文、病历全文、高敏备注 | 人工确认契约存在；治疗摘要随访确认局部落地 | Partial | test-only 先锁定对象范围 |
| 人工确认 | 确认 / 忽略 / 继续观察 / 完成 / 过期 | 内部人员显式选择处理结果 | 必须 | 人工确认对象 | 人工确认动作 | 内部人员选择处理方向 | 选中动作、状态前后、操作者角色 | 外部消息内容、真实预约、成交记录 | 契约存在；统一 runtime 未落地 | Missing | UI-only / mock-only 后续 |
| 人工确认 | 修改优先级 / 低敏备注变化 | 内部人员调整优先级或补充备注 | 建议 | 人工确认对象 | 更新优先级或备注摘要 | 内部复盘或排序需要 | 优先级前后、备注低敏摘要 | 完整备注、手机号、身份证、敏感病情 | 契约定义但 runtime 未落地 | Missing | 字段白名单契约优先 |
| 基础运营看板 | 指标语义变更 | 指标字典、状态口径或空态文案变化 | 必须 | 看板指标 | 更新指标口径 | 指标定义调整或试运行口径变化 | 指标 key、口径版本、变更摘要 | 客户明细、SQL、完整 BI 导出 | 看板指标契约存在；无审计实现 | Missing | docs-only 继续收口 |
| 基础运营看板 | 指标查看 / 下钻到确认对象 | 运营人员从指标进入待确认对象 | 建议 | 看板指标 / 人工确认对象 | 查看指标或下钻 | 内部运营复盘 | 指标 key、下钻类型、操作者角色 | 客户完整列表、联系方式、敏感明细 | 现有工作台有指标和导航；无 V1 机会下钻审计 | Partial | UI-only 后续验证 |
| 基础运营看板 | mock / seed / demo 提示文案变化 | 防止演示口径被误读为真实生产结果 | 必须 | 看板指标 / 演示数据说明 | 更新演示提示 | mock / seed / demo 口径变化 | 文案类型、影响指标、低敏说明 | 真实客户数据、真实机构名称 | 当前 seed 和 UI 有 demo 提示；无审计语义 | Partial | docs-only / UI-only 后续 |
| 审计追踪 | 登录成功 / 失败 | 用户登录或认证失败 | 必须 | 登录 / 账号上下文 | 登录结果 | 登录成功、失败或会话缺失 | 用户内部 ID 或角色、来源类型、结果 | 密码、Token、cookie、会话密钥 | 当前 access context 和 route 401 存在；未见统一登录审计 | Missing | runtime-later 单独授权 |
| 审计追踪 | 租户切换 / 上下文确认 | 操作上下文绑定租户或切换租户 | 必须 | 租户上下文 | 确认租户上下文 | 多租户隔离需要 | 租户内部 ID、角色、来源 | 生产凭证、外部租户 secret | `tenantId` 进入 audit_events；跨租户拒绝 reason 存在 | Partial | test-only 后续 |
| 审计追踪 | 权限拒绝 / 跨租户拒绝 | 权限不足或跨租户访问被拒绝 | 必须 | 权限 / 租户上下文 | 拒绝访问 | 角色不足、缺失租户、跨租户或敏感详情拒绝 | 资源类型、动作、拒绝原因、角色 | 请求体、SQL、堆栈、高敏资源内容 | access-control reason 与多个 route denied audit 已存在 | Covered | 纳入 V1 审计测试 |
| 审计追踪 | 真实 HIS / credential / 外部系统动作 | 真实 HIS、真实凭证、外部调用或补偿任务 | 暂不纳入 | HIS / credential / 外部系统 | 暂不纳入 V1 | 后置集成能力，不是 V1 主线 | 不记录 | 凭证、Token、raw payload、外部错误全文 | 仓库已有 Phase 23 HIS 审计内容，但本矩阵不推进 | Not Applicable | 暂停，除非单独批准 |

## 7. 必须审计动作清单

以下是 V1 审计覆盖语义清单，不是实现清单，不新增 audit enum、schema 或 runtime。

治疗后摘要必须审计：

- 创建治疗摘要。
- 编辑治疗摘要。
- 作废治疗摘要。
- 治疗摘要进入客户时间线的关键关联。
- 治疗摘要产出随访建议或复诊相关内部建议的语义变化。

随访任务必须审计：

- 人工确认后创建内部随访任务。
- 随访任务状态变化。
- 随访任务完成。
- 随访任务忽略 / 取消 / 过期。
- 来源任务去重或冲突。
- 作废治疗摘要阻断来源随访任务。

复诊提醒必须审计：

- 复诊提醒进入 `pending_confirmation`。
- 复诊提醒被人工确认。
- 复诊提醒被人工忽略。
- 复诊提醒转为内部随访任务。
- 复诊提醒转为预约意向。

复购机会必须审计：

- 复购机会进入 `pending_confirmation`。
- 复购机会被人工确认。
- 复购机会被人工忽略。
- 复购机会转为内部随访任务。
- 复购机会转为预约意向。

沉睡客户机会必须审计：

- 沉睡客户机会进入 `pending_confirmation`。
- 沉睡客户机会被人工确认。
- 沉睡客户机会被人工忽略。
- 沉睡客户机会转为内部随访任务。
- 沉睡客户机会被标记继续观察。
- 沉睡客户机会过期。

人工确认必须审计：

- 对象进入待确认。
- 人工确认。
- 人工忽略。
- 继续观察。
- 标记完成。
- 标记过期。
- 优先级变化。
- 低敏备注变化。

基础运营看板必须审计：

- 指标语义变化。
- 指标下钻进入人工确认对象。
- mock / seed / demo 提示文案变化。

登录 / 租户 / 权限必须审计：

- 登录成功。
- 登录失败。
- 租户切换或上下文确认。
- 权限拒绝。
- 跨租户拒绝。

## 8. 建议审计动作清单

以下动作建议审计，可由后续 test-only 或 UI-only 任务先验证语义，不构成当前实现许可：

- 客户档案查看。
- 客户档案创建。
- 客户档案编辑。
- 预约创建。
- 预约编辑。
- 到院状态变化。
- 项目 / 治疗摘要查看。
- 基础运营看板指标查看。
- 机会来源缺失。
- `dueDate` 缺失。
- 优先级缺失。
- 沉睡阈值试运行。
- mock / seed / demo 数据展示。
- 确认对象已被其他人处理。

建议审计动作仍需遵守低敏摘要和禁止记录内容边界。后续如果进入测试或 UI 验证，应优先用 mock、seed 或受控 demo 数据，不得接真实 HIS、真实 credential 或外部业务系统。

## 9. 暂不纳入 V1 的审计动作

| 暂不纳入动作 | 暂不纳入原因 |
| --- | --- |
| 真实 HIS 审计扩展 | 真实 HIS 是后续集成方向，不阻塞 V1 客户运营闭环。 |
| 真实 credential provider 审计扩展 | 涉及真实凭证和 provider runtime，当前继续暂停。 |
| 外部网络调用审计 | 依赖真实外部业务系统和网络调用，当前不做。 |
| 自动触达审计 | 1.0 不做微信、企微、短信、电话或外呼自动触达。 |
| 微信 / 企微 / 短信 / 电话发送审计 | 真实发送渠道后置，当前只允许内部提示。 |
| 支付 / 交易金额审计 | 依赖支付、财务或交易系统，不属于 V1 轻量客户运营闭环。 |
| 医疗效果审计 | 涉及医疗效果判断，不属于运营中台 V1 审计目标。 |
| 完整 BI 导出审计 | 依赖完整 BI 和导出能力，当前不纳入。 |
| AI Agent 自动执行审计 | 1.0 不做 AI Agent 自动执行。 |
| HIS compensation audit runtime 扩展 | 属于 Phase 23 / Phase 24 风险治理线，当前暂停。 |

## 10. 禁止记录内容

以下内容不得写入 V1 审计记录、审计摘要、备注或审计提示：

- 完整手机号。
- 身份证号。
- 完整病历正文。
- 敏感医疗记录。
- 真实 credential。
- API Key。
- Token。
- HIS raw payload。
- 外部系统完整错误。
- 真实支付信息。
- 真实外部消息内容。
- 未脱敏隐私信息。
- 医生个人敏感信息。
- 生产密钥。
- 生产环境变量。
- OAuth secret。
- Webhook secret。
- 数据库连接串。
- SQL 或服务端堆栈。

## 11. 低敏摘要建议

审计低敏摘要可以记录以下类型的信息：

- 客户低敏 ID，例如内部客户编号或脱敏展示 ID。
- 资源类型，例如客户档案、预约、治疗摘要、内部随访任务、复诊提醒、复购机会、沉睡客户机会或看板指标。
- 来源类型，例如治疗摘要、预约、随访任务、生命周期、路径模板、看板指标或人工录入。
- 来源摘要，例如“治疗后 D7 复诊窗口”“复购窗口期”“60 天未互动试运行阈值”。
- 操作者角色，例如机构管理员、客服、咨询师、医助、运营负责人或安全审计员。
- 人工确认结果，例如确认、忽略、继续观察、转内部随访、转预约意向、完成或过期。
- 状态前后，例如从待确认到已确认、从已确认到转内部随访。
- 机会类型，例如复诊提醒、复购机会、沉睡客户机会。
- 时间窗口，例如今日、本周、试运行窗口、逾期窗口。
- 低敏备注摘要，例如“内部人员判断暂不处理”“来源不完整待补充”。
- mock / seed / demo 标记，例如“受控 demo 数据”“试运行口径”。

低敏摘要示例：

- “客户内部 ID CUST-DEMO-001 的复诊提醒进入待确认，来源为治疗摘要，处理窗口为今日。”
- “复购机会被人工忽略，原因摘要为内部人员判断暂不处理，未触发外部触达。”
- “沉睡客户机会被标记继续观察，阈值为试运行分层，未生成外部消息。”
- “看板指标口径更新为 V1 试运行解释，影响待处理机会总数。”

上述示例均为虚构示例，不含真实电话、身份证、完整病历、机构真实名称、医院真实名称、HIS 名称、凭证、SQL 或外部系统 payload。

## 12. 与人工确认契约的关系

V1-MANUAL-CONFIRM-CONTRACT-01 定义了统一人工确认对象、入口、动作和状态解释。本矩阵为该契约提供审计覆盖关系。

人工确认相关审计覆盖应支持：

- 进入待确认。
- 人工确认。
- 人工忽略。
- 转换为内部随访任务。
- 转换为预约意向。
- 继续观察。
- 标记完成。
- 标记过期。
- 优先级变化。
- 低敏备注变化。

审计覆盖不触发动作，不替代人工确认，不代表客户已被触达，不代表真实预约，不代表交易，不代表医疗判断完成。

## 13. 与看板指标契约的关系

V1-DASHBOARD-METRICS-CONTRACT-01 定义了复诊提醒、复购机会和沉睡客户机会进入基础运营看板的指标口径。本矩阵只定义审计与看板指标的输入关系，不实现 dashboard runtime、SQL 或聚合函数。

审计覆盖应支持以下看板相关口径：

- 待处理机会总数。
- 已确认机会数。
- 已忽略机会数。
- 已转内部随访任务数。
- 转预约意向数。
- 逾期未处理机会数。
- 指标语义变化。
- mock / seed / demo 提示文案变化。
- 指标下钻进入人工确认对象。

看板审计不代表完整 BI，不代表客户已被触达，不代表成交，不代表医疗效果，不代表真实 HIS 同步。

## 14. 与现有审计实现的只读证据

本节是只读证据盘点，不实现功能、不运行测试、不修改 runtime。

| 检查项 | 只读证据 | 判断 |
| --- | --- | --- |
| `audit_events` 表或等价表是否存在 | `src/server/db/schema.ts` 定义 `audit_events`，包含 actor、tenant、resource、resourceId、action、result、reason、occurredAt、source | 存在 |
| audit domain / repository / API / UI 是否存在 | `src/modules/audit/domain/audit-events.ts`、`src/modules/audit/server/audit-event-repository.ts`、`src/app/api/institution/audit-events/route.ts`、`src/app/api/open-platform/audit-events/route.ts`、机构 / 平台审计面板存在 | 存在 |
| 治疗摘要动作是否有审计证据 | 治疗摘要 list / create、edit、void route 有 allowed / denied audit；作废使用 `treatment_summary_voided` 等 reason | 存在 |
| 随访人工确认动作是否有审计证据 | `treatment-summaries/[summaryId]/follow-up-tasks/route.ts` 在人工确认创建来源随访、作废阻断、建议无效、重复冲突时写 audit | 局部存在 |
| 作废 / 忽略 / 冲突提示是否有审计证据 | 作废摘要、作废阻断随访、重复来源随访冲突已有 reason；统一机会忽略尚未落地 | Partial |
| 平台 / 机构审计入口是否存在 | 机构导航包含审计日志；平台权限与审计面板展示平台审计日志；API 有权限边界 | 存在 |
| V1 动作级审计覆盖矩阵是否存在 | 合并前未见 V1 主线动作级 coverage matrix；当前新增本文档 | 原先缺失，本文档补齐语义 |
| 三类机会对象级审计是否存在 | 契约层定义三类机会和看板指标；代码侧主要是生命周期、seed、模板和随访建议，未见统一 opportunity audit runtime | Missing |
| 人工确认统一审计是否存在 | 治疗摘要随访确认局部有审计；统一确认对象和三类机会动作未 runtime 落地 | Partial |
| 看板指标语义变更审计是否存在 | 现有工作台有客户、预约、随访和复购窗口聚合；无看板指标语义变更审计 runtime | Missing |

## 15. 缺口与风险

### P1

- 三类机会审计语义尚未完全落地：复诊提醒、复购机会、沉睡客户机会已经在契约层定义，但没有统一对象级审计实现或测试。影响 V1 人工确认和看板闭环验收。
- 人工确认审计覆盖尚未统一：治疗摘要随访确认局部可追踪，但复诊 / 复购 / 沉睡机会的进入待确认、确认、忽略、转内部随访、转预约意向等动作还没有统一覆盖。
- 看板指标语义变化缺少审计记录风险：V1 看板指标字典已定义，但指标口径变更、下钻进入人工确认、demo 提示变化目前没有统一审计语义或测试保护。

### P2

- 低敏摘要边界存在隐私风险：现有审计 domain 已避免携带额外字段，但后续机会和人工确认备注若不先定义字段白名单，容易夹带手机号、完整病历、HIS raw payload 或外部错误全文。
- HIS 审计 / compensation 内容稀释 V1 主线风险：仓库已有大量 Phase 23 HIS 审计 reason 和补偿方向，后续若继续沿 HIS 风险治理线扩张，会偏离治疗后客户运营闭环。
- UI-only / mock-only PR 不知道哪些动作必须审计：没有本文档前，后续 UI 或 mock 任务容易只做展示，不声明哪些后续动作必须保留审计输入。

### P3

- 客户查看、看板查看等 read 动作审计粒度不清：部分读取动作已经有审计或审计摘要，但并非所有查看都必须写入，后续需要测试计划区分必须和建议。
- 到院状态和预约意向审计语义仍需细化：预约状态已存在，但到院确认原因、预约意向与真实预约的边界需要后续小 PR 收口。

## 16. 后续 PR 拆分建议

| PR 编号建议 | 标题 | 类型 | 目标 | 允许范围 | 禁止范围 | V1 阻塞 | 依赖关系 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1-FIELD-WHITELIST-CONTRACT-01 | 定义 V1 低敏字段白名单与禁止字段 | contract-only | 收口机会、人工确认、审计摘要、看板提示可记录字段 | `docs/product/contracts/**` | `src/**`、`drizzle/**`、schema、migration、runtime、测试 | 是 | 依赖本文档和人工确认契约 |
| V1-AUDIT-TEST-PLAN-01 | 定义 V1 审计最小测试计划 | docs-only / test-only | 列出后续测试应覆盖的摘要、随访、机会、人工确认、权限拒绝动作 | docs-only；后续若单独批准可限 tests | 修改生产 runtime、扩 audit enum、schema、migration | 是 | 依赖本文档 |
| V1-REVISIT-UI-MOCK-01 | 复诊提醒 UI mock 验证 | UI-only / mock-only | 展示复诊提醒待确认、确认、忽略、转内部随访、空态 | 后续单独批准的 UI/mock 文件 | 真实 HIS、真实预约、外部触达、schema、migration | 是 | 依赖机会契约、人工确认契约、本文档 |
| V1-REPURCHASE-DORMANT-UI-MOCK-01 | 复购 / 沉睡机会 UI mock 验证 | UI-only / mock-only | 展示复购和沉睡机会列表、状态、确认动作和低敏摘要 | 后续单独批准的 UI/mock 文件 | 新表、scheduler、自动营销、外部消息、schema、migration | 是 | 依赖机会契约、看板契约、本文档 |
| V1-DASHBOARD-EMPTY-STATE-COPY-01 | 看板空态和 demo 提示文案收口 | UI-only / docs-only | 明确指标空态、异常态、demo / seed 标记，避免误读为生产结果 | docs 或后续授权 UI 文案 | dashboard SQL、聚合函数、完整 BI、外部同步 | 否 | 依赖看板指标契约 |
| V1-OPPORTUNITY-TEST-PLAN-01 | 三类机会验收测试计划 | docs-only / test-only | 定义复诊、复购、沉睡机会状态、人工确认和看板输入验收样例 | docs-only；后续单独批准 tests | runtime、schema、migration、真实 HIS、自动触达 | 是 | 依赖机会契约、看板契约、人工确认契约 |
| V1-MANUAL-CONFIRM-UI-MOCK-01 | 统一人工确认入口 mock | UI-only / mock-only | 展示统一确认对象、动作、低敏备注和状态解释 | 后续单独批准的 UI/mock 文件 | queue、worker、状态机 runtime、API、schema | 是 | 依赖人工确认契约和本文档 |
| V1-AUDIT-RUNTIME-LATER-PLAN-01 | 审计 runtime-later 评审计划 | runtime-later / docs-only | 在单独授权前评估是否需要新增 audit reason、测试和迁移边界 | docs-only | 直接实现 audit metadata、enum、schema、migration | 否 | 依赖字段白名单和测试计划 |

以上建议不得被解释为当前实现许可。不得直接进入真实 HIS runtime、真实 credential runtime、schema / migration、自动触达、完整 BI、dashboard SQL、audit metadata schema 或 HIS compensation runtime。

## 17. 验收标准

- 本文档明确说明智美天工不是 HIS 系统。
- 本文档明确说明智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台。
- 本文档明确说明 HIS 只是数据来源之一，不阻塞 1.0。
- 本文档明确说明本矩阵不是 AUDIT-PLAN-01。
- 本文档明确说明本 PR 不做 runtime、API、route、repository、service、schema、migration、SQL、worker、scheduler、queue、HIS compensation audit runtime 或真实外部系统能力。
- 本文档包含 V1 主线动作清单。
- 本文档包含审计覆盖矩阵，且审计等级只使用 `必须 / 建议 / 暂不纳入`。
- 本文档包含必须审计动作、建议审计动作和暂不纳入 V1 的审计动作。
- 本文档包含禁止记录内容和低敏摘要建议。
- 本文档说明与人工确认契约、看板指标契约的关系。
- 本文档只读引用当前仓库审计实现证据。
- 本文档不包含本地临时附件路径或任务粘贴文件名。
- 本 PR 只新增 `docs/product/contracts/v1-audit-coverage-matrix-01.md`。
- 本 PR 不修改 `src/**`、`app/**`、`components/**`、`lib/**`、`packages/**`、`drizzle/**`、`package.json`、lockfile、schema、migration 或测试文件。

## 18. 验证记录

本次只读审查和文档新增使用了以下命令。未运行 app、dev server、migration、scheduler、cron、queue、worker，也未连接真实 HIS、真实 credential 或外部业务系统。

- `date "+%Y-%m-%d %Z %z"`
- `git status --short`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git rev-parse main`
- `git rev-parse origin/main`
- `git log --oneline -n 5`
- `git switch -c docs/v1-audit-coverage-matrix-01`
- `find docs/product -maxdepth 2 -type d`
- `find docs/product/contracts -maxdepth 1 -type f`
- `find src/app/api/institution -maxdepth 4 -type f`
- `rg --files docs src drizzle | rg "audit|Audit|treatment-summary|followup|customer|appointment|workspace|dashboard|seed-demo|schema"`
- `rg -n "audit_events|auditEvents|AuditEvent|writeAudit|recordAudit|audit event|审计|allowed_by_policy|voided|follow_up|follow-up|duplicate|conflict|denied|resourceId|reason" src drizzle docs README.md package.json`
- `rg -n "审计追踪|审计|人工确认|HIS|客户运营|治疗后客户运营闭环|不是 HIS|AI 客户运营中台|V1 主线" docs/product/zhimeitiangong-product-source-of-truth.md docs/product/zhimeitiangong-module-map.md docs/product/zhimeitiangong-v1-scope.md docs/product/zhimeitiangong-feature-addendum.md docs/product/zhimeitiangong-decision-log.md`
- `sed -n '1,220p' docs/product/zhimeitiangong-product-source-of-truth.md`
- `sed -n '1,140p' docs/product/zhimeitiangong-module-map.md`
- `sed -n '1,180p' docs/product/zhimeitiangong-v1-scope.md`
- `sed -n '1,120p' docs/product/zhimeitiangong-feature-addendum.md`
- `sed -n '1,140p' docs/product/zhimeitiangong-decision-log.md`
- `sed -n '1,320p' docs/product/reviews/prod-gap-review-01.md`
- `sed -n '1,460p' docs/product/contracts/v1-opportunity-contract-01.md`
- `sed -n '1,430p' docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `sed -n '1,540p' docs/product/contracts/v1-manual-confirm-contract-01.md`
- `sed -n '586,614p' src/server/db/schema.ts`
- `sed -n '1,140p' src/modules/audit/domain/audit-events.ts`
- `sed -n '1,120p' src/modules/audit/domain/audit-event-query.ts`
- `sed -n '150,232p' src/modules/audit/server/audit-event-repository.ts`
- `sed -n '1,110p' src/app/api/institution/audit-events/route.ts`
- `sed -n '1,120p' src/app/api/open-platform/audit-events/route.ts`
- `sed -n '1,180p' src/modules/security/domain/access-control.ts`
- `sed -n '1,145p' src/app/api/institution/customers/route.ts`
- `sed -n '1,190p' src/app/api/institution/appointments/route.ts`
- `sed -n '1,145p' src/app/api/institution/treatment-summaries/route.ts`
- `sed -n '1,235p' 'src/app/api/institution/treatment-summaries/[summaryId]/route.ts'`
- `sed -n '1,235p' 'src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts'`
- `sed -n '1,230p' 'src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts'`
- `sed -n '1,115p' src/app/api/institution/followups/route.ts`
- `sed -n '1,200p' src/modules/institution/server/treatment-followup-confirmation.ts`
- `sed -n '1,210p' src/modules/institution/domain/followup-path-analysis.ts`
- `sed -n '1,220p' src/modules/institution/components/InstitutionAuditEventsShell.tsx`
- `sed -n '1,240p' src/modules/open-platform/components/OpenPlatformAuditEventsPanel.tsx`
- `sed -n '1,220p' src/modules/workspace/domain/institution-dashboard-view-models.ts`
