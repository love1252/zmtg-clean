# V1-FEATURE-FLAG-RBAC-GUARD-PLAN-01：V1 opportunity readonly guard 计划

## 0. 文档元信息

- 任务编号：V1-FEATURE-FLAG-RBAC-GUARD-PLAN-01。
- 日期与时区：2026-06-09 CST +0800，来自本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前基线：`main` / `origin/main` 为 `d20e4cc0af18dd833d89e5c3dfd4d903993d4ea1`。
- 最新已合并 PR：#240。
- 任务性质：docs-only / plan-only / no runtime。
- 当前阶段：V1 opportunity readonly domain slice 合并后的 UI / API / runtime 接入前置边界计划。

本文档只新增 feature flag / tenant / RBAC guard 的产品与工程边界计划，不实现代码，不修改 runtime，不接 UI，不接 API，不修改 schema / migration / SQL。

新增本文档的原因：

- `docs/product/plans/v1-runtime-minimal-slice-plan-01.md` 已有高层 feature flag、tenant / RBAC 和 rollback 候选，但它覆盖的是未来 V1 runtime minimal slice 总体规划。
- PR #240 已把 V1 opportunity readonly domain slice 合并到主线，需要一个更窄的前置计划，专门约束后续 UI、API 或 runtime 如何接入该 readonly domain slice。
- 本文档只服务后续 guard 生效点和接入顺序判断，不替代 runtime 实现任务。

## 1. 当前已具备的基线能力

PR #240 合并后，主线已有 V1 opportunity readonly domain slice。当前能力只在 domain view model 层形成低敏只读摘要，覆盖以下语义：

- 三类机会候选：
  - `revisit_reminder`
  - `repurchase`
  - `dormant_customer`
- 只读返回低敏字段，例如 `opportunityType`、`sourceType`、`sourceSummary`、`triggerReason`、`suggestedAction`、`priority`、`dueDateWindow`、`status`、`mockSeedDemoFlag`、`reasonCode`、`resultCode`。
- 支持 feature disabled 时返回安全空态。
- 支持 tenant mismatch 时拒绝读取。
- 支持 RBAC denied 时返回低敏拒绝态。
- 支持来源缺失时返回低敏异常态。
- 支持 `stale`、`already_handled`、`invalid_transition` blocked 状态。

当前能力仍不是 UI、API 或 runtime 接入。它不读取数据库，不调用外部系统，不处理真实客户数据，不写状态，不创建任务、预约或成交。

## 2. 非目标 / 明确不做

本计划不做：

- 不实现 feature flag runtime。
- 不实现 RBAC runtime。
- 不实现 tenant guard runtime。
- 不接 UI。
- 不接 API。
- 不新增 route。
- 不新增 service / repository / DTO。
- 不修改 `src/**`。
- 不修改 tests。
- 不改 schema / migration / SQL。
- 不实现 dashboard aggregation runtime。
- 不实现 audit runtime。
- 不实现字段白名单 enforcement runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不创建真实任务。
- 不创建预约。
- 不创建成交。
- 不自动营销。
- 不自动触达。
- 不运行全量测试、lint 或 typecheck。
- 不启动 dev server。

本文档中的 future、后续、候选、应当、必须等表述都是边界计划，不是开发许可。任何 UI、API、runtime、audit、字段白名单 enforcement 或 dashboard aggregation 接入前，必须另开任务并重新执行项目治理启动检查。

## 3. Guard 总原则

V1 opportunity readonly domain slice 后续接入必须遵守以下总原则：

1. feature flag 默认关闭。
2. feature flag 只能按 tenant 灰度开启。
3. 未开启时，UI、API、runtime 都不得暴露机会视图。
4. tenant mismatch 时必须拒绝读取。
5. RBAC denied 时必须返回低敏拒绝态，不暴露候选详情，也不暴露对象存在性。
6. 机会候选只能来自低敏只读摘要。
7. blocked 状态必须覆盖 `stale`、`already_handled`、`invalid_transition`。
8. 当前阶段不创建真实任务、不创建预约、不创建成交、不自动营销、不自动触达。
9. runtime 接入前必须另开任务，不得在本 PR 实现。
10. 关闭 feature flag 后应回到不可见 / 不可用状态。
11. audit、字段白名单 enforcement、dashboard aggregation 均为后续任务，不在本 PR 实现。
12. UI 接入前仍需单独 PR 明确 guard 生效点。
13. API 接入前仍需单独 PR 明确权限校验与低敏响应。
14. 不允许引入真实 HIS、credential 或真实客户数据。

## 4. Feature flag 计划

future feature flag candidate：

| feature flag candidate | 控制范围 | 默认状态 | 开启方式 | 关闭后行为 |
| --- | --- | --- | --- | --- |
| `v1OpportunityReadonlyEnabled` | V1 opportunity readonly 视图、低敏候选摘要和后续 UI / API 接入入口。 | 默认关闭。 | 只能按 tenant 灰度开启。 | 回到不可见 / 不可用状态，不暴露机会视图。 |

feature flag 规则：

- 默认关闭，不允许全量默认开启。
- 只能按 tenant 灰度开启，不允许跨 tenant 共享开启状态。
- feature flag 不能替代 tenant scope 校验。
- feature flag 不能替代 RBAC 校验。
- feature flag 不能触发任何外部系统动作。
- feature flag 不能读取真实 HIS credential。
- feature flag 不能把 mock / seed / demo 数据混入真实 tenant。
- feature flag disabled 时，UI 不显示入口，API 不返回候选，runtime 不构造真实候选。
- feature flag disabled 时，可以返回低敏不可用态，但不得返回候选详情。

当前不新增配置，不新增环境变量，不新增 feature flag provider，不实现 flag 读取。

## 5. Tenant guard 计划

tenant guard 是 opportunity readonly 接入前的硬门槛。

| 场景 | 必须行为 | 禁止行为 |
| --- | --- | --- |
| tenant scope matched | 只有在 feature flag enabled 且 RBAC 通过后，才允许继续读取低敏候选摘要。 | 不得跳过 RBAC。 |
| tenant mismatch | 返回低敏拒绝态，例如 `tenant_scope_mismatch`。 | 不返回候选详情，不返回跨租户对象存在性，不回退到 mock 明细。 |
| tenant missing | 返回低敏拒绝态或未授权态。 | 不猜测 tenant，不使用默认 tenant，不返回全局候选。 |
| demo / mock tenant | 必须显式保留 `mockSeedDemoFlag` 或等价演示标记。 | 不冒充生产数据，不混入真实 tenant。 |

tenant guard 输出边界：

- 可以返回低敏 reason code。
- 可以返回低敏 denied copy。
- 不返回 `tenantId`、机构明细、客户明细、来源对象详情或候选列表。
- 不暴露跨租户对象是否存在。

当前不实现 tenant guard runtime，不修改 access-control，不修改 service / repository。

## 6. RBAC guard 计划

RBAC guard 必须晚于 feature flag 与 tenant guard 同时成立，且不能被 UI 状态替代。

| 场景 | 必须行为 | 禁止行为 |
| --- | --- | --- |
| 有机会只读权限 | 仅允许读取低敏 readonly summary。 | 不允许确认、转换、导出高敏明细或触发外部动作。 |
| 无机会只读权限 | 返回低敏拒绝态，例如 `permission_denied`。 | 不返回候选详情，不返回候选数量，不暴露对象存在性。 |
| 仅有 dashboard read-only 权限 | 后续只能查看允许的低敏指标或空态，不能下钻到机会详情。 | 不允许借 dashboard 权限读取机会候选详情。 |
| manual confirm 权限缺失 | 后续即使能读机会，也不得执行确认动作。 | 不允许把 readonly 接入扩大成 mutation。 |

RBAC denied 低敏响应要求：

- `status` 可为 `denied`。
- `reasonCode` 可为 `permission_denied`。
- `resultCode` 可为 `denied`。
- `opportunities` 必须为空。
- copy 必须是低敏拒绝文案。
- 响应不得包含 source summary、trigger reason、suggested action、候选数量、客户或来源对象明细。

当前不实现 RBAC runtime，不新增 permission enum，不修改角色模型，不接 access-control。

## 7. Opportunity readonly 输入与输出边界

机会候选只能来自低敏只读摘要，不得直接使用真实 HIS raw payload、完整客户资料、完整病历正文、支付、合同、发票、外部消息或真实经营数据。

允许输出的低敏字段候选：

- `opportunityType`
- `sourceType`
- `sourceSummary`
- `triggerReason`
- `suggestedAction`
- `priority`
- `dueDateWindow`
- `status`
- `mockSeedDemoFlag`
- `reasonCode`
- `resultCode`

必须禁止输出：

- 完整手机号。
- 完整联系方式。
- 身份证号。
- 完整病历号。
- 完整病历正文。
- 诊断正文。
- 治疗原文。
- 咨询记录全文。
- 地址。
- 成交金额。
- 销售额。
- ROI。
- 支付 / 合同 / 发票 / 回款数据。
- HIS credential。
- API Key、Token、OAuth secret、Webhook secret。
- 数据库连接串。
- HIS raw payload。
- 外部系统请求 / 响应正文。
- SQL。
- stack。
- AI prompt / completion 全文。

blocked 状态必须低敏：

| blocked source status | reasonCode | resultCode | 输出要求 |
| --- | --- | --- | --- |
| `stale` | `state_stale` | `blocked` | 不提供可执行动作，只提示刷新后重新判断。 |
| `already_handled` | `already_handled` | `blocked` | 不重复确认，不重复计数，不静默成功。 |
| `invalid_transition` | `invalid_transition` | `blocked` | 不临时放行，不覆盖状态。 |

当前不新增 parser、sanitizer、mask、redact 或字段白名单 enforcement 代码。

## 8. UI 接入前置要求

UI 接入前必须另开单独 PR 明确 guard 生效点。

UI-only future PR 至少需要说明：

- feature flag disabled 时，机会入口不可见或显示低敏不可用态。
- tenant mismatch 时，不显示机会候选列表。
- RBAC denied 时，只显示低敏拒绝态。
- blocked 状态只显示不可执行提示，不展示 action button。
- UI 不得把 readonly summary 误写成可确认、可转任务、可建预约或可成交。
- UI 不得直接使用 mock / seed / demo 数值冒充生产统计。
- UI 不得展示高敏字段或完整客户明细。

当前不接 UI，不修改组件，不启动 dev server。

## 9. API 接入前置要求

API 接入前必须另开单独 PR 明确权限校验与低敏响应。

API future PR 至少需要说明：

- route 层如何读取 feature flag。
- route 层如何取得当前 tenant context。
- route 层如何处理 tenant mismatch。
- route 层如何处理 RBAC denied。
- 输出 DTO 的字段白名单。
- denied / disabled / source missing / blocked 的低敏响应格式。
- 是否需要分页、筛选或下钻；如果需要，必须另行收口低敏下钻边界。
- API 不得返回高敏来源对象、raw payload、SQL、stack、credential 或完整客户明细。

当前不新增 API、route、service、repository、DTO，不实现 runtime 权限校验。

## 10. Runtime 接入前置要求

runtime 接入前必须另开任务，不得在本 PR 实现。

future runtime PR 至少需要先满足：

- 用户明确授权 runtime 范围。
- 明确允许修改的文件列表。
- feature flag 默认关闭并可按 tenant 灰度。
- tenant guard 与 RBAC guard 断言先行。
- 字段白名单断言先行。
- disabled、denied、empty、exception、blocked 的低敏响应断言先行。
- rollback 路径明确。
- audit input 命名已收口或明确暂不写 audit。
- 不与 dashboard aggregation、audit runtime、schema / migration 混在同一个 PR。

runtime 即使被单独批准，第一步也不应做：

- 不创建真实任务。
- 不创建预约。
- 不创建成交。
- 不自动营销。
- 不自动触达。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户高敏数据。
- 不写 dashboard aggregation runtime。
- 不写 audit runtime。
- 不写字段白名单 enforcement runtime，除非该 PR 被明确授权为 enforcement runtime。

## 11. Rollback 策略

rollback 的最小策略是关闭 feature flag。

关闭 `v1OpportunityReadonlyEnabled` 后必须：

- UI 回到机会入口不可见或低敏不可用态。
- API 不返回机会候选详情。
- runtime 不构造或暴露真实候选。
- dashboard 不把 opportunity readonly 候选计入真实指标。
- audit 不写入未授权的 opportunity readonly 事件。
- manual confirm 入口保持不可用。

rollback 禁止项：

- 不删除真实数据。
- 不执行 migration rollback。
- 不批量清洗客户数据。
- 不触发外部系统补偿。
- 不发送消息。
- 不创建任务、预约或成交。

## 12. 与 audit / 字段白名单 / dashboard aggregation 的关系

本 PR 不实现以下内容：

- audit runtime。
- audit enum。
- audit metadata。
- 字段白名单 enforcement runtime。
- dashboard aggregation runtime。
- dashboard metrics API。
- dashboard drilldown API。

后续关系：

- audit：只能在 audit event naming 和低敏 audit input 明确后另开 PR，不记录 request body、response body、SQL、stack、token、secret、credential、HIS raw payload 或完整客户信息。
- 字段白名单 enforcement：必须另开 PR 明确 guard 位置、允许字段、禁止字段、错误响应和 audit input，不得夹带 UI/API/runtime 扩张。
- dashboard aggregation：必须另开 PR 明确指标口径、时间窗口、去重、空态 / 异常态和低敏下钻，不得直接把 readonly candidate 或 UI mock 数值当成生产 BI。

## 13. 推荐后续最小任务

以下只是建议，不构成开发许可：

1. V1-OPPORTUNITY-READONLY-DOMAIN-TEST-FOLLOWUP-01：test-only，补充 readonly domain 的边界断言。
2. V1-OPPORTUNITY-READONLY-UI-GUARD-PLAN-01：docs-only / UI-plan-only，明确 UI guard 生效点。
3. V1-OPPORTUNITY-READONLY-API-GUARD-PLAN-01：docs-only / API-plan-only，明确 API 权限校验与低敏响应。
4. V1-FIELD-WHITELIST-RUNTIME-GUARD-PLAN-01：plan-only，规划字段白名单 enforcement 的最小 runtime guard。
5. V1-RUNTIME-SLICE-1B-OPPORTUNITY-READONLY-LATER-01：仅在用户明确授权后，才考虑最小 runtime 接入。

任何 runtime、UI、API、schema、migration、SQL、service、repository、DTO、audit、dashboard aggregation、真实 HIS、credential、真实客户数据、自动营销或自动触达任务，都必须单独授权。

## 14. 本文档边界

本文档只新增 V1 opportunity readonly guard 计划。

本文档不修改：

- `src/**`
- `tests/**`
- `drizzle/**`
- schema / migration / SQL
- service / repository / DTO
- package 或 lockfile

本文档不实现：

- feature flag runtime
- tenant guard runtime
- RBAC runtime
- UI
- API
- dashboard aggregation runtime
- audit runtime
- 字段白名单 enforcement runtime
- 真实 HIS 接入
- credential 读取
- 真实客户数据处理
- 自动营销 / 自动触达

本文档停留在 docs-only / plan-only，可作为后续人工审查 UI / API / runtime 接入任务是否越界的前置依据。
