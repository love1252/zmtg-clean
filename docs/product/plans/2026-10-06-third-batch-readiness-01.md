# THIRD-BATCH-READINESS-01：第三批数据质量与 AI 开工核对

> 历史开工快照：下文“当前”“尚缺”和授权描述指开工核对当时的状态。第三批首版随后已实现；最新完成度以 [18项验收台账](2026-10-06-lingjian-18-acceptance-01.md) 和对应交付说明为准，历史计划不扩展当前授权。

## 结论与本轮范围

本轮对应原产品规划的第三批三项：**数据质量与来源、画像更新建议、经营机会及人工确认**。近期随访、工作台、导入明细的交付切片不重新定义这三个业务批次，也不能据此认定原第二批八项已全部完成。

可以先启动“数据质量与来源”中的客户来源证据只读卡；画像建议和机会确认尚不能作为完整闭环直接接线。首项的现有存储足够，不需要先完成保存筛选、自定义分群、经营分析页面或预约日周历。

- 核查日期：2026-10-06，Asia/Shanghai（CST，UTC+08:00），由本地日期命令确认。
- 任务：`THIRD-BATCH-READINESS-01`，依赖核查和开发规格，docs-only。
- 核查基线：`main = origin/main = f19a42a8dd657af758088de517fe58d3d8d7b22b`。
- 文档分支：`codex/third-batch-readiness-20261006`，启动时 HEAD 与基线相同，工作树干净；原主工作树保持不变。
- 当前授权：用户批准上轮建议的“核对三项依赖并确定首个开发任务”。本轮只交付两份 Markdown 文档，可提交、推送并创建草稿 PR。
- 本轮不实施 runtime、数据库变更、真实数据查询、模型调用、外部业务调用或部署；不自动启动第三批全部开发、正式审查或合并。
- 证据来自当前源码、测试内容和既有交付说明；未读取凭证、连接真实业务数据库或验证生产可用性。文中“已有”指代码基础，“拟议”指尚未实现的契约。

## 三项准备度

| 第三批项目 | 当前可复用基础 | 尚缺什么 | 开工判断 |
| --- | --- | --- | --- |
| 数据质量与来源 | 正式客户标识及机构范围；Excel 导入行到客户、批次的关联；批次历史与明细只读查询 | 客户级来源查询与真实界面接线；通用完整度、重复客户、逐字段来源和新鲜度规则 | **首个只读切片可开发**。仅展示可核验的 Excel 导入关联，不宣称完成通用数据质量模块 |
| 画像更新建议 | 客户受控 DTO；五项基础字段修改；并发校验和审计事务；部分标签与依据领域类型 | 客户对象的完整关联证据；建议及证据版本、前后值、接受／拒绝／过期、审批与应用记录 | **先补证据和建议生命周期契约**。当前画像页面为未开放状态，不能直接接“确认画像”按钮 |
| 经营机会及人工确认 | V1.1 生命周期候选；正式随访、预约创建与各自审计；随访完成结果和事件 | 正式候选查询契约；确认身份和来源版本；转换幂等；目标任务关联和结果回流 | **只读候选可独立整理，确认写入暂未就绪**。先限定一种候选转一种随访，再设计闭环，不启用旧接口 |

## 1. 数据质量与来源

### 已有证据

1. [客户列表仓库](../../../src/modules/customers/server/customer-list-repository.ts)在可信租户、机构范围读取客户标识、显示名、生命周期、优先级和更新时间。它没有提供技术来源、最后同步时间或质量评分；当前列表也不是“仅本人客户”的过滤模型。
2. [数据库表定义](../../../src/server/db/schema.ts)中的 `institutionExcelImportRows` 已保存 `canonicalRecordId / sheetKind / batchId / rowNumber`，批次保存 `completedAt`，行与批次有租户、机构、批次复合外键。这能支持查询某个客户是否具有 Excel 导入关联。
3. [导入历史接口](../../../src/app/api/institution/customers/import/route.ts)和[仓库](../../../src/modules/institution-import/server/institution-excel-import-repository.ts)已提供最近 20 批历史与指定批次四类 Sheet 明细。客户级来源查询应直接使用客户标识关联，不能扫描最近 20 批来判断“没有来源”。
4. [导入编排](../../../src/server/orchestration/institution-excel-import-runtime.ts)的历史与明细仍受 `development + 本地 PostgreSQL + tenant_admin / tenant_operator` 限制，并依赖客户列表和客户创建能力的授权。不能把已有代码描述为生产可用的来源服务。

### 需要区分的事实

- `customers.updatedAt` 是本系统主档更新时间；`completedAt` 是本系统导入批次记录时间。现有导入代码在事务开始前生成该值，它不是精确的事务提交完成时刻，也不是上游最后同步时间。
- `referralSource` 在导入时可能取获客来源或客户来源，不能替代技术血缘。`imp-c-` 前缀、标签和备注也不能替代行关联证据。
- 解析器能检查必填、日期、同 Sheet 外部编号重复和跨 Sheet 引用；这不等于具有跨系统重复客户识别能力。手机号摘要的普通索引也不构成唯一约束。
- 数据库有字段、界面有掩码，不等于本次已获准读取该字段。未读取、暂不可用、未填写必须分别表达，不能生成“完整度 0%”或“重复客户 0 个”。
- [Approved 客户列表脚本](../../../src/modules/institution-v11-preview/server/approved-prototype-assets.ts)的 `openCustomerRuntimeRecord` 取真实客户列表记录；旧 `openCustomerEvidence` 仍读取 `customer(id)` 和 `DATA.institution.updated`。后者不能作为真实来源或最近同步证据。

首项冻结为 [DATA-SOURCE-01：客户来源证据只读卡](2026-10-06-data-source-01-spec.md)。本次只冻结来源元数据，不扩展资料完整度评价、去重、自动修复、逐字段溯源或生产门禁。

## 2. 画像更新建议

### 可复用部分

- [客户受控 DTO](../../../src/modules/customers/application/customer-controlled-view.ts)提供客户标识、展示名、生命周期、优先级、负责人、项目意向、更新时间及操作权限。
- [客户写编排](../../../src/server/orchestration/institution-customer-controlled-write-runtime.ts)只允许 `displayName / lifecycle / priority / ownerUserId / projectInterest` 五项基础字段，可复用机构范围、`expectedUpdatedAt` 并发校验及修改与审计同事务机制。
- [客户领域投影](../../../src/modules/customer-center/domain/customer-overview.ts)已有标签、生命周期依据类型；数据库也有 `tags`。这些不是已发布的画像建议查询或应用 API。

### 硬前置

1. **客户对象关联证据。** [客户完整时间线](../../../src/app/api/institution/customers/[customerId]/timeline/route.ts)和[随访概览](../../../src/app/api/institution/customers/[customerId]/followup-overview/route.ts)仍返回 503。正式随访查询没有 `customerId` 筛选，不能从机构列表当前页拼成单客完整历史。应按第一个画像用例冻结最少必要证据，不要求一次聚合所有档案。
2. **建议生命周期。** 在本次核查的正式客户路径中未发现完整的建议 ID、字段前后值、证据版本、规则版本、接受／拒绝／过期、审批者及应用记录契约。需先确定存储和状态规则；如需 schema，单独审批。
3. **应用与追溯。** 现有客户修改审计不能代替建议和证据链接。确认时须重验来源、目标字段权限和主档版本，避免旧建议覆盖新资料；重复确认、审计失败和事务回滚需明确结果。

[正式客户详情](../../../src/modules/customer-center/components/CustomerControlledDetailShell.tsx)明确将画像、沟通洞察、经营建议及证据标为未开放。页面“AI Provider 未配置”是固定文案，本轮未检查真实 provider 配置，不能据此断言真实环境状态。[AI 会话工作台](../../../src/modules/institution/components/AiConversationWorkbenchShell.tsx)的模拟画像同样不能充当正式证据。

建议后续先以明确规则产生可解释的建议，验证证据与人工处理流程，再单独定义模型参与范围。不能仅因为有 AI 文案或标签数组就开启画像写入。

## 3. 经营机会及人工确认

### 当前状态

- [V1.1 脚本](../../../src/modules/institution-v11-preview/server/approved-prototype-assets.ts)将 `post_care / repurchase_window / silent_reactivation` 映射为复诊、复购、沉默唤醒候选。来源是客户主档生命周期，目前在浏览器分来源读取、合并排序并分页；没有持久化机会、分配和状态流转。
- [正式能力名单](../../../src/server/orchestration/institution-capability-authority.ts)没有发布正式经营机会能力；[旧机会接口](../../../src/app/api/institution/opportunities/route.ts)固定返回 410，不能恢复旧接口来绕过正式读写契约。
- [治疗随访建议规则](../../../src/modules/institution/domain/treatment-followup-suggestions.ts)保留来源字段、理由、规则键和治疗摘要标识，可作设计参考；[建议查询](../../../src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts)与[确认创建任务](../../../src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts)仍固定返回 503。
- [正式随访编排](../../../src/server/orchestration/institution-formal-follow-up-runtime.ts)有机构范围、客户引用校验、幂等、事件及审计；[预约编排](../../../src/server/orchestration/institution-appointment-controlled-write-runtime.ts)有授权、成员校验及事务审计。两者创建白名单未接受机会、确认或来源版本关联，预约创建也不能直接假设具有随访同款幂等契约。
- [随访记录与事件](../../../src/modules/care/ports/formal-follow-up-store.ts)已有完成结果、反馈与修订号，但没有对应的机会确认关联。随访完成不能据此被描述为自动关闭机会或推进客户生命周期。

### 建议拆分

1. **只读候选整理。** 后续可单独定义 `OPPORTUNITY-READ-01`，固定三类来源映射，由服务端完成统一排序、分页和总数，明确匹配依据、来源更新时间及“只读候选”身份。此项不依赖画像模型，首版仅延续现有 V1.1 客户候选入口及客户读取权限；若新增正式 analytics 入口，需另行完成该入口的能力准入。
2. **确认转随访。** 另行冻结一种候选转一种正式随访的契约：候选身份、来源版本、确认人／动作／时间、失效规则、转换幂等、目标任务标识、完成结果关联及审计归属。复用现有随访命令前必须补齐这些约束；若需持久化变更则单独审批。

原型中的确认成功提示或创建按钮，不代表这些状态已真实保存。只接按钮和现有 POST，无法满足来源变化、重复提交、事务失败和结果回流的验收。

## 依赖顺序与下一步边界

| 工作 | 真正依赖 | 不必等待 |
| --- | --- | --- |
| DATA-SOURCE-01 来源只读卡 | 可信客户标识、机构授权、现有导入行和批次关联 | 客户保存筛选、分群、经营分析、预约日周历、AI provider |
| 首个画像建议用例 | 用例所需的客户对象关联事实、证据版本、规则和建议生命周期 | 所有第二批页面全部上线；与该用例无关的数据源 |
| 生命周期只读机会候选 | 正式客户查询、固定映射、稳定服务端分页和明确来源语义 | Excel 来源卡、画像模型、完整治疗时间线 |
| 机会确认转随访 | 候选身份和来源版本、确认记录、幂等转换、随访结果关联 | 所有机会类型、预约转换、自动执行或外部触达 |

建议的第一个 runtime 任务为 DATA-SOURCE-01，具体契约和验收见配套规格。它完成后也只代表首个来源切片交付，不代表第三批完成。只读机会候选可作为独立后续任务安排；画像及确认闭环需先补其硬前置，不能把来源卡当作充分条件。

本轮交付仅为开工核对与规格。后续 runtime、数据库变更、真实环境验证、正式审查／合并和部署均按各自授权边界执行。

## 核查方式与局限

本轮通过三条并行只读核查分别检查来源、画像、机会与确认，再对照上述源码、HTTP 门禁及既有测试内容。检查两份文档的相对链接、状态语义、任务边界及 Git 差异；docs-only 不补跑无关 runtime 测试。

既有交付背景为 [随访查询](../../operations/2026-10-05-followup-query-01.md)、[正式工作台](../../operations/2026-10-05-workbench-followup-01.md)、[导入历史明细](../../operations/2026-10-05-import-history-recovery-01.md)和 [V1.1 工作台统计](../../operations/2026-10-06-v11-workbench-followup-01.md)。这些记录说明已交付的基础，不代替本轮未做的真实数据、数据库执行计划、生产环境或整批业务验收。
