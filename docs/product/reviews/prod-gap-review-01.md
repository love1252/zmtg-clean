# PROD-GAP-REVIEW-01：智美天工 1.0 系统缺口审查

## 1. 审查背景

本次审查任务编号为 PROD-GAP-REVIEW-01，任务性质为 docs-only / read-only review。审查日期来自本地命令 `date "+%Y-%m-%d %Z %z"`，结果为 2026-06-08 CST +0800。

本次审查以智美天工 1.0 产品事实源为准：智美天工是面向医美 / 美业机构的 AI 客户运营中台，不是 HIS 系统；1.0 主线是治疗后客户运营闭环，不以真实 HIS 接入、真实 credential、真实外网、scheduler、worker、schema 扩张或 Phase 23 / Phase 24 HIS 风险治理线作为系统主线。

当前任务只回答“当前仓库实现与智美天工 1.0 主线之间还有哪些缺口”。本报告中的后续建议不是开发许可，后续进入 runtime 前必须由用户另行明确批准。

启动基线：

- 当前分支：`main`。
- 当前 `HEAD`：`a5a0c82 Merge pull request #216 from love1252/docs/v1-scope-lock-01`。
- `main`：`a5a0c82 Merge pull request #216 from love1252/docs/v1-scope-lock-01`。
- `origin/main`：`a5a0c82 Merge pull request #216 from love1252/docs/v1-scope-lock-01`。
- `origin/main..HEAD` 与 `HEAD..origin/main` 均为空。
- 启动前 `git status --short` 为空。
- 已确认包含 PR #216 V1-SCOPE-LOCK-01 合并后的内容。

## 2. 审查范围

本次优先只读了以下 5 个产品事实源，并以它们作为当前产品事实源：

- `docs/product/zhimeitiangong-product-source-of-truth.md`
- `docs/product/zhimeitiangong-module-map.md`
- `docs/product/zhimeitiangong-v1-scope.md`
- `docs/product/zhimeitiangong-feature-addendum.md`
- `docs/product/zhimeitiangong-decision-log.md`

只读检查过的主要目录和文件：

- `docs/**`
- `src/**`
- `drizzle/**`
- `scripts/**`
- `README.md`
- `package.json`
- `pnpm-lock.yaml` 存在但本次未读取内容、未修改

仓库中未发现顶层 `app/`、`components/`、`lib/`、`packages/`、`tests/` 目录；当前实现集中在 `src/app/**`、`src/modules/**`、`src/server/**`、`src/test/**`、`drizzle/**`。

## 3. 非目标 / 明确不做

本 PR 不做 runtime、不改 `src/**`、不改 `app/**`、不改 `components/**`、不改 `lib/**`、不改 `packages/**`、不改 `drizzle/**`、不改 schema、不新增 migration、不改 `package.json`、不改 lockfile、不新增依赖。

本 PR 不启动 app，不启动 dev server，不运行 scheduler / cron / queue / worker，不执行数据库 migration，不连接真实 HIS，不读取真实 credential，不实现真实 credential provider runtime，不实现真实 HIS adapter runtime，不发起外部网络请求，不修复发现的问题。

本任务不是 CONFIG-PLAN-01、SCHEDULER-PLAN-01、AUDIT-PLAN-01、OBS-PLAN-01、SCHEMA-REVIEW-01，也不继续推进 Phase 23 / Phase 24 HIS 风险治理线。

## 4. V1 主线覆盖矩阵

| V1 链路 | 产品事实源依据 | 当前仓库证据 | 当前状态 | 缺口 | 风险等级 | 后续建议 |
|---|---|---|---|---|---|---|
| 客户档案 / 患者信息 | `zhimeitiangong-v1-scope.md` 将客户中心、客户时间线列为必须；`module-map` 说明系统主线使用客户档案，医疗语境可显示患者信息 | `src/server/db/schema.ts` 有 `customers`；`src/app/api/institution/customers/route.ts` 支持 list/create/update；`src/modules/institution/domain/customer-records.ts` 有 lifecycle、priority、脱敏手机号、脱敏病历号；`CustomerCenterShell` 与 workspace smoke 覆盖客户中心与时间线 | Covered | 患者信息目前按客户档案脱敏摘要处理，符合 V1 简化口径；仍缺独立的 V1 隐私字段白名单 / DTO contract 文档 | P2 | contract-only：补客户档案 / 患者信息字段白名单和可见范围；禁止扩 schema、导入真实患者数据 |
| 预约 / 到院 | `v1-scope` 将预约 / 到院基础记录列为必须；`module-map` 要求支撑客户旅程、到院状态和经营分析 | `src/server/db/schema.ts` 有 `appointments` 与 `appointment_status`，包含 `arrived`、`completed`；`src/app/api/institution/appointments/route.ts` 支持 list/create/update；`AppointmentCenterShell` 与 smoke 覆盖预约中心、待确认、已确认、已到院 / 已完成 | Covered | 到院目前主要是预约状态，没有独立到院时间、签到人、到院确认原因口径；V1 可接受基础状态，但指标解释需收口 | P2 | contract-only 或 UI-only：收口到院状态与看板口径；禁止新增 migration、真实 HIS 到院同步 |
| 项目 / 治疗记录 | `v1-scope` 要求项目 / 治疗记录的结构化摘要，明确不做完整病历；`module-map` 说明必须但以摘要形式简化 | `src/server/db/schema.ts` 有 `treatment_summaries`，字段含 `treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`；`treatment-summary-write-input.ts` 有字段白名单；`standard-treatment-event.ts` 是 domain-only 标准事件 | Partial | 已有治疗摘要承载项目 / 治疗事实，但没有独立项目目录、项目周期规则或治疗记录与项目字典 contract；复诊 / 复购规则依赖这些字段时口径不稳 | P1 | contract-only：补项目 / 治疗字段字典和周期规则草案；禁止新增项目表、migration、HIS mapper runtime |
| 治疗后摘要 | `v1-scope` 将治疗后摘要列为必须；`product-source-of-truth` 将其置于随访建议前置节点 | `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts` 支持人工录入；`src/app/api/institution/treatment-summaries/route.ts` 支持列表；`[summaryId]/route.ts` 支持编辑；`[summaryId]/void/route.ts` 支持作废；`TreatmentSummaryManagementShell` 与 seed/smoke 覆盖展示、编辑、作废、时间线 | Covered | 结构化摘要较完整；缺口主要是字段字典、作废与后续机会阻断在产品层的验收矩阵尚未单独固化 | P2 | test-only / contract-only：补摘要字段与作废验收矩阵；禁止改 runtime |
| 随访任务 | `v1-scope` 将随访任务列为必须；`module-map` 说明它是治疗后运营闭环核心执行对象 | `src/server/db/schema.ts` 有 `follow_up_tasks`；`src/app/api/institution/followups/route.ts` 支持 list 与状态流转；`treatment-followup-confirmation.ts` 从摘要建议人工确认创建来源任务；来源字段和去重索引已存在 | Covered | 来源随访任务闭环存在；普通随访任务创建入口、随访配额 enforcement 和完整任务运营策略仍未系统化 | P2 | contract-only / test-only：补随访任务创建边界与状态验收；禁止新增 scheduler、自动触达、worker |
| 复诊提醒 | `v1-scope` 将复诊提醒列为必须，且先做内部提醒、不做自动触达；`feature-addendum` 后置真实触达 | `treatment-path-templates.ts` 有 `revisit_before`、`D7 复诊前状态确认` 等节点；`treatment-followup-suggestions.ts` 有注射类治疗复诊提醒；seed 中有复诊预约、复诊摘要和来源随访任务 | Partial | 复诊提醒目前嵌在模板 / 随访建议和演示数据中，没有独立“复诊提醒”口径、筛选、看板指标或人工确认验收路径 | P1 | contract-only 优先：定义复诊提醒 DTO / UI 口径 / 验收；后续 UI-only 展示；禁止真实微信 / HIS 自动同步 |
| 复购机会 | `v1-scope` 将复购机会轻量提示列为必须；`module-map` 说明不做自动营销 | `customer_lifecycle` 有 `repurchase_window`；`buildInstitutionDashboardSummary` 有 `repurchase_window` supporting stat；seed 有复购窗口客户、TS-004、完成的复购来源随访任务；静态 `customers.ts` 有复购窗口期分层 | Partial | 复购机会仍是生命周期 / demo / 看板计数，没有明确规则来源、机会状态、人工确认动作、转随访或转预约的验收口径 | P1 | contract-only：定义轻量复购机会规则与确认口径；后续 mock-only / UI-only，不扩 schema |
| 沉睡客户机会 | `v1-scope` 将沉睡客户机会轻量提示列为必须；`module-map` 标记阈值待人工确认，不自动唤醒 | `customer_lifecycle` 有 `silent_reactivation`；`customer-records.ts` 与 seed 有沉睡客户；`customers.ts` 静态分层有“沉默待激活” | Partial | 目前缺沉睡客户阈值、看板指标、行动队列优先级、人工确认路径；已有证据偏演示和字段层 | P1 | docs-only / contract-only：确认沉睡阈值与轻量机会识别；禁止自动唤醒、外部触达、schema 扩张 |
| 人工确认 | `product-source-of-truth` 锁定 AI 只做辅助且必须人工确认；`module-map` 要求随访任务需要人工确认 | `POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks` 只接受 `suggestionKey`，服务端重算建议；`TreatmentSummaryManagementShell` smoke 覆盖“人工确认后创建内部随访任务”；模板节点均 `requiresHumanConfirmation` 且 `forbidAutoReachOut` | Covered | 人工确认在治疗摘要详情里成立，但没有统一确认队列 / 待确认中心；复诊、复购、沉睡机会如何统一进入确认仍不清楚 | P1 | contract-only：定义统一人工确认对象与页面口径；禁止直接实现队列、worker、自动执行 |
| 基础运营看板 | `v1-scope` 将基础工作台 / 看板列为必须；`module-map` 要求展示随访完成、复诊复购机会和机构运营指标 | `buildInstitutionDashboardSummary` 聚合客户、预约、随访；`followup-path-analysis.ts` 聚合模板建议、人工确认任务、完成、超时、作废阻断、重复冲突；workspace smoke 覆盖只读聚合与敏感字段边界 | Partial | 当前看板偏演示数据 + 模板路径指标；复诊、复购、沉睡机会指标口径不足，且“当前演示客户”等标签需要 V1 试运行口径替换 | P1 | contract-only：先定义 V1 看板指标字典；后续 UI-only/mock-only；禁止完整 BI、导出、真实外部同步 |
| 审计追踪 | `v1-scope` 将登录 / 租户 / RBAC / 审计列为必须；`decision-log` 锁定人工确认和治理边界 | `audit_events` 表、`audit-events.ts` domain、`audit-event-repository.ts` 查询；机构 / 平台审计 API/UI；客户、预约、治疗摘要、随访确认、作废、拒绝路径写 audit；workspace smoke 覆盖审计入口和敏感字段不展示 | Covered | 审计能力较强，但缺 V1 主线动作级 audit coverage matrix；客户 timeline 读取等部分 read 路径不一定写审计；HIS 相关 audit reason 过多会稀释 V1 主线 | P1 | docs-only / test-only：补 V1 审计覆盖矩阵与最小回归；禁止继续扩 HIS audit / compensation |

## 5. 关键缺口清单

### P0

未发现 P0 级“完全无法启动 V1 评估”的缺口。当前客户、预约、治疗摘要、来源随访任务、人工确认、工作台和审计已有可见实现。

### P1

#### 复诊提醒缺少独立产品口径

- 缺口描述：复诊提醒存在于模板节点、治疗阶段、复诊预约和随访建议中，但没有独立的 V1 口径、筛选、指标或验收路径。
- 影响的 V1 链路：复诊提醒、随访任务、基础运营看板、人工确认。
- 当前证据：`treatment-path-templates.ts`、`treatment-followup-suggestions.ts`、`seed-demo-data.ts`、workspace smoke。
- 为什么影响 1.0：复诊提醒是 V1 必需项，如果只埋在模板和示例中，试运行时难以判断“该提醒是否应该出现、何时出现、谁确认、是否完成”。
- 推荐后续 PR：contract-only，小 PR 定义复诊提醒的字段、来源、UI 展示、确认动作和验收样例。
- 禁止在该 PR 中提前做的事项：不得新增 schema / migration，不得接真实 HIS，不得做自动微信 / 企微 / 短信触达，不得新增 scheduler / worker。

#### 复购机会仍停留在生命周期 / 演示层

- 缺口描述：`repurchase_window`、复购客户 seed、复购来源任务和看板计数已经存在，但缺少规则来源、机会状态和人工确认后的去向。
- 影响的 V1 链路：复购机会、人工确认、基础运营看板、随访任务。
- 当前证据：`customer_lifecycle`、`buildInstitutionDashboardSummary`、`TS-004`、`demo-fu-cheng-repurchase-done`、静态 `customerSegments`。
- 为什么影响 1.0：复购机会是 V1 必需轻量提示，若规则和状态不清，运营人员无法区分“演示标签”和“可处理机会”。
- 推荐后续 PR：contract-only，定义轻量复购机会规则和确认口径；后续再做 UI-only / mock-only。
- 禁止在该 PR 中提前做的事项：不得新增 opportunity 表，不得实现营销自动化，不得接企微 / 微信，不得扩 schema。

#### 沉睡客户机会缺少阈值、看板和确认路径

- 缺口描述：已有 `silent_reactivation` 字段和 seed，但没有沉睡阈值、看板指标、行动队列排序或人工确认路径。
- 影响的 V1 链路：沉睡客户机会、人工确认、基础运营看板。
- 当前证据：`customer-records.ts`、`customers.ts`、`seed-demo-data.ts`。
- 为什么影响 1.0：沉睡客户机会是 V1 主线必需项；仅有 lifecycle 不能证明系统能提示运营人员处理沉睡客户。
- 推荐后续 PR：docs-only / contract-only，先确认沉睡阈值和轻量识别口径。
- 禁止在该 PR 中提前做的事项：不得自动唤醒，不得真实触达，不得新增任务调度，不得接外部消息系统。

#### 看板指标口径未覆盖全部 V1 必需机会

- 缺口描述：工作台已有客户、预约、随访和模板路径分析，但没有明确覆盖复诊、复购、沉睡机会的 V1 指标字典。
- 影响的 V1 链路：基础运营看板、复诊提醒、复购机会、沉睡客户机会。
- 当前证据：`institution-dashboard-view-models.ts`、`followup-path-analysis.ts`、workspace smoke。
- 为什么影响 1.0：看板是闭环的管理出口，如果指标仍混合 demo、模板路径和局部聚合，试运行无法判断 V1 是否跑通。
- 推荐后续 PR：contract-only，输出 V1 看板指标字典、来源字段和空态 / 错误态。
- 禁止在该 PR 中提前做的事项：不得做完整 BI，不得新增导出，不得读取客户明细到平台端，不得扩 schema。

#### 审计追踪缺少 V1 主线覆盖矩阵

- 缺口描述：审计底座已覆盖很多动作，但缺少一张 V1 主线动作到 audit resource/action/reason 的覆盖矩阵。
- 影响的 V1 链路：审计追踪、人工确认、治疗后摘要、随访任务。
- 当前证据：`audit-events.ts`、`audit-event-repository.ts`、各 route 写 audit，workspace smoke 显示审计日志。
- 为什么影响 1.0：没有覆盖矩阵会导致后续小 PR 无法判断某个 V1 动作是否必须写 audit，尤其人工确认、作废阻断、机会确认。
- 推荐后续 PR：docs-only 或 test-only，先做 coverage matrix，再补最小回归测试。
- 禁止在该 PR 中提前做的事项：不得扩 HIS compensation audit，不得新增 audit metadata schema，不得新增 migration。

### P2

#### 项目 / 治疗字段字典不足

- 缺口描述：治疗摘要字段存在，但项目类别、治疗阶段、恢复阶段、周期规则主要散落在模板和 seed 中。
- 影响的 V1 链路：项目 / 治疗记录、治疗后摘要、复诊提醒、复购机会。
- 当前证据：`treatment_summaries`、`treatment-path-templates.ts`、`treatment-followup-suggestions.ts`。
- 为什么影响 1.0：复诊和复购机会需要稳定的项目周期口径，否则后续 UI 和测试会反复改。
- 推荐后续 PR：contract-only，定义最小项目 / 阶段 / 周期字典。
- 禁止在该 PR 中提前做的事项：不得新增项目管理 runtime，不得接真实 HIS 项目字典。

#### 人工确认没有统一队列

- 缺口描述：治疗摘要详情里可人工确认创建随访任务，但复诊、复购、沉睡机会还没有统一“待人工确认”队列定义。
- 影响的 V1 链路：人工确认、随访任务、复诊提醒、复购机会、沉睡客户机会。
- 当前证据：`treatment-followup-confirmation.ts`、workspace smoke 中的确认按钮和冲突提示。
- 为什么影响 1.0：V1 要保留人工确认，若入口分散，运营人员容易漏处理。
- 推荐后续 PR：contract-only，定义确认对象、状态和页面入口；后续 UI-only。
- 禁止在该 PR 中提前做的事项：不得实现 queue / worker，不得自动执行确认。

### P3

#### 产品文案与事实源存在轻微张力

- 缺口描述：营销页和旧 README 中仍有“AI 智能体”“增长操作系统”等表达，事实源已锁定“AI 客户运营中台”，且 1.0 不做真实 AI Agent 自动执行。
- 影响的 V1 链路：产品主线认知、AI 辅助边界、人工确认。
- 当前证据：`src/modules/marketing/components/MarketingHome.tsx`、`README.md` 历史 Phase 描述。
- 为什么影响 1.0：不影响核心运行，但可能导致评审误认为 V1 已有真实 AI provider、Agent 或自动触达。
- 推荐后续 PR：docs-only / UI-only，收口面向用户的定位文案。
- 禁止在该 PR 中提前做的事项：不得接 OpenAI provider，不得实现 AI Agent，不得新增外部网络调用。

## 6. 风险清单

- 产品主线偏移风险：README 和历史计划中 Phase 23 / HIS connection / credential compensation 篇幅很大，容易让后续任务误把 HIS 治理当成 1.0 主线。
- HIS 误主线化风险：机构导航已有“HIS 连接配置”入口，schema 和 API 也已有较多 HIS connection 能力；事实源要求 HIS 只是数据来源之一，不阻塞 1.0。
- runtime 提前实现风险：仓库已有 HIS credential service、test connection service、compensation worker 等 runtime 形态代码，后续任务若继续顺手推进，容易越过当前暂停边界。
- schema / migration 扩张风险：`drizzle/0006` 到 `0008` 已围绕 HIS connection / credential compensation 扩表；后续若为机会、看板或审计直接扩 schema，需单独审批。
- 任务过大导致 Codex 越界风险：V1 主线覆盖 11 个链路，后续必须拆成 contract-only / UI-only / mock-only / test-only 小 PR，不能一次性实现。
- 审计追踪缺口风险：审计底座已存在，但缺少 V1 动作级覆盖矩阵；没有矩阵会造成后续 route 是否写 audit 的判断不稳定。
- 人工确认缺口风险：人工确认已经在治疗摘要随访建议中落地，但复诊、复购、沉睡客户机会没有统一确认入口和状态定义。
- 看板指标口径不清风险：当前看板混合客户、预约、随访和模板路径分析，复诊 / 复购 / 沉睡机会指标尚未形成 V1 字典。
- AI / 自动触达误解风险：事实源要求 AI 只做建议、草稿和辅助，不做自动医疗决策；后续文案和 UI 必须避免“已自动触达”“已接 AI Agent”等误导。

## 7. 后续小 PR 拆分建议

| PR 编号建议 | 标题 | 类型 | 目标 | 允许修改范围 | 禁止范围 | 依赖关系 | 是否阻塞 V1 |
|---|---|---|---|---|---|---|---|
| V1-OPPORTUNITY-CONTRACT-01 | 定义复诊 / 复购 / 沉睡机会轻量契约 | contract-only | 明确三类机会的来源、字段、状态、人工确认和验收样例 | `docs/product/**` 或 `docs/superpowers/specs/**` | `src/**`、`drizzle/**`、schema、migration、真实 HIS、真实触达 | 依赖本报告 | 是 |
| V1-DASHBOARD-METRICS-CONTRACT-01 | 定义 1.0 基础看板指标字典 | contract-only | 收口客户、预约、随访、复诊、复购、沉睡、审计指标口径 | `docs/product/**` | runtime、完整 BI、导出、平台下钻客户明细 | 依赖 V1-OPPORTUNITY-CONTRACT-01 | 是 |
| V1-MANUAL-CONFIRM-CONTRACT-01 | 定义统一人工确认对象和入口 | contract-only | 明确哪些建议 / 机会必须人工确认、确认后生成什么内部动作 | `docs/product/**` | queue、worker、自动执行、自动触达 | 依赖 V1-OPPORTUNITY-CONTRACT-01 | 是 |
| V1-AUDIT-COVERAGE-MATRIX-01 | 输出 V1 主线审计覆盖矩阵 | docs-only | 映射 V1 动作到 audit resource/action/reason | `docs/product/**` | audit metadata schema、HIS compensation audit、migration | 可并行 | 是 |
| V1-FIELD-WHITELIST-CONTRACT-01 | 收口客户 / 预约 / 治疗摘要隐私字段白名单 | contract-only | 固化 V1 可展示字段、禁止字段和 DTO 边界 | `docs/product/**` | 导入真实患者数据、读取真实 credential | 可并行 | 否 |
| V1-REVISIT-UI-MOCK-01 | 复诊提醒 UI mock-only 验证 | UI-only / mock-only | 在不扩 schema 的前提下展示现有复诊提醒样例和空态 | 后续批准后限 `src/modules/institution/components/**`、`src/modules/workspace/tests/**` | schema、migration、HIS 同步、自动触达 | 依赖复诊契约 | 是 |
| V1-REPURCHASE-DORMANT-UI-MOCK-01 | 复购 / 沉睡机会 UI mock-only 验证 | UI-only / mock-only | 使用现有 lifecycle / seed / mock 展示轻量机会列表 | 后续批准后限 UI、mock fixtures、tests | 新表、调度、营销自动化、外部消息 | 依赖机会契约和看板指标 | 是 |
| V1-AUDIT-TEST-01 | V1 审计最小回归测试 | test-only | 用测试锁定治疗摘要、人工确认、作废阻断、机会确认审计 | 后续批准后限 `src/modules/**/tests/**` | 修改生产 runtime、扩 audit reason、migration | 依赖审计矩阵 | 否 |
| V1-HIS-DEEMPHASIS-DOCS-01 | 收口 HIS 非主线说明和 README 导航 | docs-only | 降低 HIS 在 1.0 叙述中的优先级，避免误主线化 | `README.md`、`docs/product/**` | 修改 HIS runtime、删除既有代码、继续 Phase 23 / 24 | 可并行 | 否 |

## 8. 推荐优先级

### 立即做

- V1-OPPORTUNITY-CONTRACT-01：复诊 / 复购 / 沉睡机会契约。
- V1-DASHBOARD-METRICS-CONTRACT-01：V1 基础看板指标字典。
- V1-MANUAL-CONFIRM-CONTRACT-01：统一人工确认对象和入口。
- V1-AUDIT-COVERAGE-MATRIX-01：V1 主线审计覆盖矩阵。

### 稍后做

- V1-FIELD-WHITELIST-CONTRACT-01：客户 / 预约 / 治疗摘要字段白名单。
- V1-REVISIT-UI-MOCK-01：复诊提醒 UI mock-only 验证。
- V1-REPURCHASE-DORMANT-UI-MOCK-01：复购 / 沉睡机会 UI mock-only 验证。
- V1-AUDIT-TEST-01：V1 审计最小回归测试。

### 暂停

- CONFIG-PLAN-01。
- SCHEDULER-PLAN-01。
- AUDIT-PLAN-01，除非后续只做 V1 audit matrix docs-only / test-only。
- OBS-PLAN-01。
- SCHEMA-REVIEW-01。
- 真实 credential provider runtime。
- 真实 HIS adapter runtime。
- 外部网络 runtime。
- runner / scheduler / cron / queue / worker。
- schema / migration 扩张。

### 不建议做

- 直接进入真实 HIS runtime。
- 直接进入真实 credential runtime。
- 为复诊 / 复购 / 沉睡机会直接扩表。
- 直接做完整 BI、导出、开放 API、Webhook、OAuth、插件化。
- 直接接企业微信 / 微信 / 短信 / 电话自动触达。
- 直接实现 AI Agent 自动执行或自动医疗建议。

## 9. 验证

本次只读审查执行过的主要命令：

- `date "+%Y-%m-%d %Z %z"`
- `git status --short`
- `git branch --show-current`
- `git log --oneline -n 8`
- `git log --oneline -n 1 HEAD`
- `git log --oneline -n 1 main`
- `git log --oneline -n 1 origin/main`
- `git log --oneline origin/main..HEAD`
- `git log --oneline HEAD..origin/main`
- `sed -n '1,320p' docs/product/zhimeitiangong-product-source-of-truth.md`
- `sed -n '1,320p' docs/product/zhimeitiangong-module-map.md`
- `sed -n '1,320p' docs/product/zhimeitiangong-v1-scope.md`
- `sed -n '1,320p' docs/product/zhimeitiangong-feature-addendum.md`
- `sed -n '1,320p' docs/product/zhimeitiangong-decision-log.md`
- `ls`
- `rg --files docs`
- `rg --files src`
- `rg --files app components lib packages tests drizzle scripts`，其中顶层 `app/components/lib/packages/tests` 不存在，命令只读失败并未修改文件
- `rg -n "客户|患者|customer|patient" src docs README.md package.json drizzle`
- `rg -n "预约|到院|appointment|visit|arrival" src docs README.md package.json drizzle`
- `rg -n "治疗|项目|treatment|procedure|summary|摘要" src docs README.md package.json drizzle`
- `rg -n "随访|follow|followup|follow-up|复诊|复购|沉睡|dormant|repurchase|revisit" src docs README.md package.json drizzle`
- `rg -n "人工确认|确认|confirm|approval|review|manual" src docs README.md package.json drizzle`
- `rg -n "看板|工作台|dashboard|workspace|audit|审计|timeline|时间线" src docs README.md package.json drizzle`
- `sed` 只读检查了客户、预约、治疗摘要、随访、路径模板、看板、审计、schema、repository、route、seed 和 workspace smoke 相关文件
- `find docs/product -maxdepth 2 -type d`
- `find docs/product/reviews -maxdepth 1 -type f`，目录当时不存在，命令只读失败并未修改文件

本次未运行 runtime，未启动服务，未连接外部网络，未执行 migration，未运行 scheduler / cron / queue / worker，未进行任何修复。

## 10. 结论

当前系统与智美天工 1.0 主线是部分对齐的：客户档案、预约 / 到院基础记录、治疗后结构化摘要、随访任务、人工确认、基础工作台和审计追踪已有可见实现，且测试中反复强调不自动触达、不接真实 HIS、不接 AI Agent。

仍存在阻塞 V1 产品闭环验收的 P1 缺口：复诊提醒、复购机会、沉睡客户机会目前主要散落在生命周期字段、模板建议、seed 和 demo UI 中，没有统一契约、指标口径和人工确认路径；基础运营看板还没有覆盖这些 V1 必需机会的稳定指标字典；审计追踪缺少 V1 主线动作级覆盖矩阵。

下一步最小安全 PR 应该是 contract-only 的 V1-OPPORTUNITY-CONTRACT-01：只定义复诊 / 复购 / 沉睡机会轻量契约、人工确认关系和看板输入口径，不改 runtime、不改 schema、不接真实 HIS、不做自动触达。

必须继续暂停：真实 HIS adapter、真实 credential provider、外部网络 runtime、runner / scheduler / cron / queue / worker、schema / migration 扩张、CONFIG-PLAN-01、SCHEDULER-PLAN-01、OBS-PLAN-01、SCHEMA-REVIEW-01，以及 Phase 24 后续 HIS 生产风险治理任务。
