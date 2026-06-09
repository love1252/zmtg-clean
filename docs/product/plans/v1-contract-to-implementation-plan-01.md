# V1 主链路 contract-to-implementation plan 01

## 0. 文档元信息

- 任务编号：V1-CONTRACT-TO-IMPLEMENTATION-PLAN-01。
- 任务性质：docs-only / plan-only / no runtime / no API / no schema / no SQL / no audit runtime。
- 日期与时区：2026-06-09 CST +0800，来自本地命令 `date "+%Y-%m-%d %Z %z"`。
- 当前阶段：V1 UI mock 受限阶段后的 plan-only 阶段。
- 当前分支：`docs/v1-contract-to-implementation-plan-01`。
- 当前基线：`HEAD` 与 `origin/main` 均为 `015846e17dcee69b92ea37756dd1b13f8af0330a`。
- 本文档只新增计划，不修改产品事实源、契约、测试计划、copy 文档、UI mock 或 runtime。

本任务不是 runtime 实现，不是 API 设计实现，不是 schema / migration 设计实现，不是 dashboard aggregation 实现，不是 audit runtime 实现，也不是真实 HIS、真实 credential、真实客户数据、自动营销、自动触达或医疗诊断能力建设。

## 1. 背景与当前状态

智美天工 1.0 当前已经完成 V1 三类机会 UI mock、人工确认 UI mock、看板指标 UI mock、审计追踪 UI mock，并且端到端只读验收 passed。现有 UI mock 已经在机构工作台中把复诊提醒、复购机会、沉睡客户机会、统一人工确认、基础运营看板指标和审计追踪样例串成只读展示链路。

这些已完成内容仍然是受控演示 / seed / mock 口径：不调用 API，不写 SQL，不做 dashboard aggregation，不读取真实数据，不写入状态，不创建真实任务、真实预约或真实成交，不写入审计 runtime，不新增 audit metadata / enum，不连接真实 HIS，不读取真实 credential，不处理真实客户数据。

智美天工不是 HIS 系统。智美天工 1.0 是面向医美 / 美业机构的 AI 客户运营中台，主线是治疗后客户运营闭环。HIS 是数据来源之一，不是 V1 主链路，不阻塞 1.0。

当前需要的是从已完成的契约和 UI mock 走向未来实现前的 plan-only 总控文档，先把实现前置条件、阶段拆分、禁止范围、风险和 Ready 条件说清楚，避免从 UI mock 直接跳进 runtime。

## 2. V1 主链路目标

V1 完整主链路是：

`客户档案 / 患者信息 -> 预约 / 到院 -> 项目 / 治疗记录 -> 治疗后摘要 -> 随访任务 -> 复诊提醒 -> 复购机会 -> 沉睡客户机会 -> 人工确认 -> 基础运营看板 -> 审计追踪`

这条链路的产品目标是把治疗后客户运营闭环跑通：客户和患者语境信息作为运营对象基础，预约 / 到院和项目 / 治疗记录提供服务事实，治疗后摘要沉淀低敏结构化输入，随访任务承接内部处理，复诊提醒、复购机会和沉睡客户机会形成轻量内部运营提示，人工确认作为硬边界，基础运营看板提供低敏运营视图，审计追踪保留动作可追踪语义。

本文档只覆盖后半段的 contract-to-implementation 计划：

`治疗后摘要 / 随访任务 -> 三类机会 -> 人工确认 -> 基础运营看板 -> 审计追踪`

本文档不重新定义客户档案、预约、项目 / 治疗记录的 runtime，也不把 HIS 接入、真实 credential、外部系统同步、生产数据处理或自动触达纳入本轮计划。

## 3. 当前事实源与依据

本计划以以下 5 个产品事实源为依据：

- `docs/product/zhimeitiangong-product-source-of-truth.md`
- `docs/product/zhimeitiangong-v1-scope.md`
- `docs/product/zhimeitiangong-module-map.md`
- `docs/product/zhimeitiangong-decision-log.md`
- `docs/product/zhimeitiangong-feature-addendum.md`

本计划参考以下 8 个已完成 V1 文档：

- `docs/product/reviews/prod-gap-review-01.md`
- `docs/product/contracts/v1-opportunity-contract-01.md`
- `docs/product/contracts/v1-dashboard-metrics-contract-01.md`
- `docs/product/contracts/v1-manual-confirm-contract-01.md`
- `docs/product/contracts/v1-audit-coverage-matrix-01.md`
- `docs/product/contracts/v1-field-whitelist-contract-01.md`
- `docs/product/test-plans/v1-opportunity-test-plan-01.md`
- `docs/product/copy/v1-dashboard-empty-state-copy-01.md`

本计划参考以下 UI mock / workspace 文件：

- `src/modules/workspace/components/InstitutionWorkspace.tsx`
- `src/modules/workspace/components/RepurchaseDormantOpportunityMockSection.tsx`
- `src/modules/workspace/components/ManualConfirmMockSection.tsx`
- `src/modules/workspace/components/DashboardMetricsMockSection.tsx`
- `src/modules/workspace/components/AuditTraceMockSection.tsx`
- `src/modules/workspace/domain/institution-dashboard-view-models.ts`

这些文件和文档只作为事实依据，本 PR 不修改它们。当前工作台顺序已经包含复诊提醒、复购 / 沉睡机会、统一人工确认、基础运营看板指标和审计追踪 mock 区块；现有 dashboard view model 仍以客户、预约、随访和基础旅程统计为主，不代表三类机会的真实聚合实现。

## 4. 不进入 runtime 的原因

虽然 UI mock 闭环已经完成，但不能直接进入 runtime。原因是后续实现会触碰多条高风险边界：

- 统一 opportunity object：三类机会需要稳定来源、状态、去重、低敏字段和人工确认对象语义，直接落代码容易提前固化错误模型。
- 人工确认 state writes：确认、忽略、继续观察、转内部随访、预约意向、完成、过期等状态写入需要状态方向、并发和审计边界先确认。
- dashboard metrics aggregation：待处理、已确认、已忽略、转内部随访、预约意向等指标如果直接聚合，可能被误读为真实统计或真实经营结果。
- audit writes：机会进入待确认、人工确认、看板来源和状态变化都需要审计语义，但现阶段不能扩 audit metadata / enum 或写审计 runtime。
- field whitelist enforcement：客户摘要、治疗摘要、机会卡片、人工确认、看板和审计摘要都需要低敏字段边界，不能先写实现再补隐私口径。
- state machine boundaries：`suggested`、`pending_confirmation`、`confirmed`、`dismissed`、`converted_to_followup`、`converted_to_appointment_intent`、`completed`、`expired` 需要产品状态方向先收口。
- test protection：测试计划目前仍是 plan-only，进入 runtime 前必须明确哪些测试先保护字段、状态、看板输入和审计输入。
- real data safety：真实客户数据、真实患者信息、完整病历、完整联系方式、支付、成交、真实 HIS raw payload 和外部消息内容都不能被 mock 逻辑误带入实现。
- API / schema / SQL / audit runtime 风险：后续任何 route、service、repository、DTO、schema / migration、SQL、dashboard aggregation 或 audit runtime 都必须另行审批。

因此，下一步应先做只读审查、契约对齐和 plan-only 拆分，而不是直接提交 runtime PR。

## 5. 后续实现前置条件

后续任何 runtime 候选前，至少需要完成以下前置条件。它们都是未来计划，不在本 PR 实现：

1. schema impact review：审查是否需要新表、新字段、索引、状态枚举或 migration，并明确不扩 schema 的可行替代方案。
2. API boundary review：审查是否需要新增 route、请求 / 响应 DTO、权限边界、租户边界和错误口径。
3. repository / service boundary review：审查 opportunity、manual confirmation、dashboard metrics、audit input 的职责归属，避免跨模块耦合。
4. field whitelist enforcement review：审查低敏字段、需脱敏字段、禁止字段和 mock / seed / demo 标记如何被测试保护。
5. audit event naming review：审查 V1 主线动作的审计资源、动作、原因和低敏摘要命名，避免扩散 audit metadata / enum。
6. dashboard aggregation plan：定义指标来源、状态纳入 / 排除、去重、时间窗口、空态和异常态，不写 SQL 或聚合函数。
7. test plan update：把已完成测试计划更新为可执行小 PR 序列，明确先测哪些字段、状态、边界和 UI mock。
8. rollback / feature flag plan：明确未来最小 runtime slice 如何关闭、回滚、隐藏入口和隔离试运行数据。
9. seed / demo data strategy：明确 demo / seed / mock 数据来源、标记、虚构身份和禁止使用真实客户数据的策略。
10. runtime safety checklist：在任何实现前确认 no true HIS、no credential、no true customer data、no auto reachout、no external message send、no medical diagnosis。

## 6. 推荐阶段拆分

| 阶段 | 名称 | 允许范围 | 禁止范围 | 交付物 |
| --- | --- | --- | --- | --- |
| Stage 0 | read-only implementation readiness review | read-only / review-only；只读事实源、契约、UI mock、现有 domain 和测试计划 | 修改文件、实现 runtime、创建 API、schema / migration、SQL、测试实现 | 实现准备度审查报告 |
| Stage 1 | contract alignment docs | docs-only；对齐 opportunity、manual confirmation、dashboard、audit、field whitelist 的术语和边界 | `src/**`、`drizzle/**`、route、service、repository、DTO、runtime | 契约对齐文档或补充说明 |
| Stage 2 | test-plan refinement | docs-only / test-plan-only；细化字段、状态、人工确认、看板输入、审计输入的测试顺序 | 测试代码、runtime 修复、dev server、CI 改动 | 更新后的测试计划 |
| Stage 3 | schema impact plan | plan-only；评估是否需要 schema / migration、如何避免提前扩表、哪些方案需单独审批 | 真实 schema、migration、SQL、索引、生产数据处理 | schema impact plan |
| Stage 4 | API / service boundary plan | plan-only；定义 API、service、repository、DTO 的候选边界和权限风险 | route 实现、service 实现、repository 实现、DTO 代码 | API / service boundary plan |
| Stage 5 | minimal runtime candidate plan | plan-only；只描述未来最小 runtime 候选切片、feature flag、回滚和验收 | 任何 runtime 代码、状态写入、dashboard aggregation、audit runtime | minimal runtime candidate plan |
| Stage 6 | implementation PR sequencing | plan-only；把未来 runtime 拆成可审查小 PR 顺序和验收门槛 | 直接实现 PR、合并上线判断、真实外部系统动作 | implementation PR sequencing 文档 |

每个阶段都必须保留“后续建议不是开发许可”的边界。只有用户在当前任务中明确批准 runtime，才可进入实现。

## 7. 推荐未来 PR 顺序

以下顺序仅为建议，不是执行授权，不包含直接 runtime implementation PR：

1. V1-IMPLEMENTATION-READINESS-REVIEW-01（read-only / review-only）
2. V1-SCHEMA-IMPACT-PLAN-01（plan-only / docs-only）
3. V1-API-BOUNDARY-PLAN-01（plan-only / docs-only）
4. V1-FIELD-WHITELIST-ENFORCEMENT-PLAN-01（plan-only / docs-only）
5. V1-AUDIT-EVENT-NAMING-PLAN-01（plan-only / docs-only）
6. V1-DASHBOARD-AGGREGATION-PLAN-01（plan-only / docs-only）
7. V1-RUNTIME-MINIMAL-SLICE-PLAN-01（plan-only / docs-only）

不建议下一步直接开 runtime PR。未来若要进入 runtime，必须先完成 readiness、schema impact、API boundary、field whitelist、audit naming、dashboard aggregation、test plan 和 rollback / feature flag 计划，并由用户单独批准。

## 8. 全局禁止范围

除非后续用户在当前任务中明确批准，否则以下范围全部禁止：

- runtime。
- API。
- route。
- service。
- repository。
- DTO。
- schema / migration。
- SQL。
- dashboard aggregation。
- audit runtime。
- audit metadata / enum。
- true HIS / credential。
- true customer data。
- auto marketing / reachout。
- external message send。
- true appointment / deal。
- medical diagnosis。

也不得新增或修改 runner、scheduler、worker、cron、queue、真实外部系统、真实支付、真实合同、真实发票、真实消息渠道、真实预约占号、真实成交记录或生产配置。

## 9. 风险清单

| 风险 | 描述 | 缓解方式 |
| --- | --- | --- |
| schema premature expansion risk | 为机会、确认、指标或审计直接新增表 / 字段，会把尚未确认的状态和来源模型固化。 | 先做 schema impact plan 和 review-only 审查；未批准前不写 schema / migration。 |
| API boundary exposure risk | 过早开放 route / DTO 可能暴露高敏字段或绕过租户 / 权限边界。 | 先做 API boundary plan 和字段白名单审查；只产出 docs / plan。 |
| dashboard aggregation misleading true stats | mock 指标如果直接聚合，可能被理解成真实经营数据、真实成交或真实触达结果。 | 先做 dashboard aggregation plan、copy 审查和测试计划更新；不写 SQL。 |
| audit metadata / enum expansion | 为 V1 动作直接扩 audit metadata / enum，可能污染现有审计语义。 | 先做 audit event naming review；只对齐命名，不实现 audit runtime。 |
| real customer data leak | 机会、人工确认、看板和审计摘要可能误带完整手机号、病历、支付或外部 payload。 | 先做 field whitelist enforcement review 和 test-plan refinement；只用低敏 / demo 口径。 |
| auto reachout misfire | 人工确认动作可能被误实现成外部消息发送、自动营销或自动唤醒。 | 在每个 plan 中保留 no auto reachout / no external message send 条件，并用测试计划覆盖文案边界。 |
| HIS mistaken mainline | 历史 HIS 相关内容容易让后续任务误把 HIS 接入当成 V1 主线。 | 在 plan / docs 中持续声明 HIS 是数据来源之一，不是 V1 主链路，不阻塞 1.0。 |
| UI mock mistaken production feature | 已完成 UI mock 可能被误读为真实 API、真实状态写入或生产审计记录。 | 通过 copy、验收说明和 review-only 报告明确 mock / seed / demo 标记。 |
| test plan / runtime inconsistency | 测试计划仍是文档，如果直接实现，代码行为可能和计划不一致。 | 先做 test-plan refinement，再按小范围 test-only PR 逐项保护。 |
| rollback difficulty | 没有 feature flag / rollback 计划时，未来 runtime slice 难以关闭或隔离试运行数据。 | 先做 rollback / feature flag plan 和 minimal runtime candidate plan。 |

上述缓解方式只允许 review、plan、docs 或 test-plan 层动作，不包含 runtime 实现。

## 10. Ready 条件

未来进入 runtime 候选前，必须同时满足以下条件：

- schema impact plan 完成，并明确是否需要单独审批 schema / migration。
- API boundary plan 完成，并明确 route、DTO、权限、租户和错误边界。
- field whitelist enforcement plan 完成，并覆盖低敏字段、需脱敏字段、禁止字段和 demo 标记。
- audit event naming plan 完成，并明确资源、动作、原因和低敏摘要命名。
- dashboard aggregation plan 完成，并明确指标来源、状态、去重、时间窗口、空态和异常态。
- test plan 已更新，并能覆盖三类机会、人工确认、看板输入、审计输入和低敏字段边界。
- feature flag / rollback plan 完成，并能说明未来最小切片如何关闭、隐藏和回退。
- 明确 no true HIS；真实 HIS 不进入 V1 主链路，也不阻塞 1.0。
- 明确 no auto reachout；不做自动营销、自动触达、外部消息发送或自动唤醒。
- 明确 no true customer data；不使用真实客户、真实患者、真实凭证、真实 HIS raw payload 或生产数据做验证。
- audit write 和 dashboard aggregation 必须分阶段进入，不能和机会状态写入、人工确认状态写入一次性混在同一个实现 PR。

未满足这些条件前，任何 runtime、API、schema / migration、SQL、audit runtime 或真实外部系统动作都不是 Ready。

## 11. 本文档自身边界

本文档只是 plan-only 文档，用于把已完成契约和 UI mock 到未来实现之间的前置步骤写清楚。本文档不授权 runtime、API、route、service、repository、DTO、schema、migration、SQL、dashboard aggregation、audit runtime、audit metadata / enum、真实 HIS、真实 credential、真实客户数据、自动营销、自动触达、外部消息发送、真实预约、真实成交或医疗诊断。

本文档中的阶段拆分、PR 顺序、Ready 条件和风险缓解都不是开发许可。后续如需进入任何实现，必须由用户在新的当前任务中明确授权，并重新执行项目治理启动检查。
