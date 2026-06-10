# V1-OPPORTUNITY-READONLY-API-GUARD-PLAN-01：opportunity readonly API guard 计划

## 0. 文档元信息

- 任务编号：V1-OPPORTUNITY-READONLY-API-GUARD-PLAN-01。
- 日期与时区：2026-06-10 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前阶段：V1 opportunity readonly domain slice 合并后的 API 接入前 guard 计划。
- 当前基线：`main` / `origin/main` 为 `7f3b96c30f5b93e45b92fe413d3837f0ee5ab593`。
- 最新已合并 PR：#243。
- 任务性质：docs-only / API-plan-only / no runtime / no API implementation / Draft PR only。

本文档只补充未来 API 接入 opportunity readonly 视图前的 guard 计划，不实现 API，不新增 route，不修改 service / repository / DTO，不实现 runtime。

本文档不是 API 开发许可，不是 UI 开发许可，也不是 runtime 开发许可。后续建议、候选拆分、验收项和风险提示均不构成本轮开发授权。

## 1. 本轮范围与明确非目标

本轮只允许新增或修改 `docs/product/**` 下的计划文档。

本轮明确不做：

- 不修改 `src/**`。
- 不修改 tests。
- 不修改 schema / migration / SQL。
- 不修改 package 或 lockfile。
- 不修改配置文件。
- 不修改脚本文件。
- 不实现 API。
- 不新增 route。
- 不修改 service / repository / DTO。
- 不实现 runtime。
- 不实现 feature flag runtime。
- 不实现 RBAC runtime。
- 不实现 tenant guard runtime。
- 不实现 dashboard aggregation runtime。
- 不实现 audit runtime。
- 不实现字段白名单 enforcement runtime。
- 不接 UI。
- 不修改组件。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不自动营销，不自动触达，不发送消息。

如后续 API 接入需要 route、service、repository、DTO、schema、migration、SQL、字段白名单 enforcement、audit 或 dashboard aggregation，必须另开单独 PR，并在新任务中重新声明允许文件、禁止文件、验证命令和回滚边界。

## 2. API guard 总顺序

未来 API 若接入 opportunity readonly 视图，guard 生效点必须按以下顺序收口：

1. feature flag：默认关闭。只有明确按 tenant 灰度开启后，API 才能返回 opportunity readonly 低敏摘要。
2. tenant guard：必须确认请求上下文、当前 tenant 和候选来源 tenant scope 匹配。
3. RBAC guard：必须确认当前 actor 具备 opportunity readonly 读取权限。
4. response whitelist：只允许返回低敏 readonly summary 字段。
5. action guard：无论 `ready` 还是 `blocked`，本阶段 API 都不得返回 mutation 指令或可执行动作。

API guard 不能依赖 UI 隐藏入口来成立。任何 route、service、repository 或 DTO 后续实现，都必须在服务端完成 feature flag、tenant、RBAC 和 response whitelist 判断。

## 3. Feature flag disabled 响应边界

feature flag 必须默认关闭。feature flag disabled 时，API 必须回到低敏不可用态或安全空态。

feature flag disabled 时，API 可以候选返回：

- `status: "disabled"`
- `reasonCode: "feature_flag_disabled"`
- `resultCode: "skipped"`
- 低敏 `emptyCopy` 或等价不可用文案。
- `opportunities: []`

feature flag disabled 时，API 不得返回：

- opportunity 候选详情。
- 候选数量。
- source summary。
- trigger reason。
- suggested action。
- 来源对象信息。
- 下钻 URL。
- 可执行 mutation 指令。
- dashboard 真实指标。

关闭 feature flag 后的 rollback API 行为必须明确：回到不可用 / 空态 / 低敏拒绝态，不返回候选详情，不保留 stale 候选、不返回历史数量、不降级暴露 mock / seed / demo 明细。

## 4. Tenant mismatch 响应边界

tenant mismatch 是 API 的硬拒绝边界。出现 tenant mismatch 时，API 必须拒绝读取，并只返回低敏拒绝态。

tenant mismatch 时，API 可以候选返回：

- `status: "denied"`
- `reasonCode: "tenant_scope_mismatch"`
- `resultCode: "denied"`
- 低敏 `exceptionCopy` 或等价拒绝文案。
- `opportunities: []`

tenant mismatch 时，API 不得返回：

- 候选列表。
- 候选数量。
- source summary。
- trigger reason。
- suggested action。
- 来源对象 ID。
- 来源对象详情。
- 客户对象详情。
- 当前 tenant 之外对象是否存在。
- dashboard 下钻信息。

tenant mismatch 不得被表达为普通空列表、普通 `0` 数量或可重试错误，以免暗示跨租户对象存在性。

## 5. RBAC denied 响应边界

RBAC denied 时，API 只能返回低敏拒绝态，不得泄露候选详情、候选数量或来源对象信息。

RBAC denied 时，API 可以候选返回：

- `status: "denied"`
- `reasonCode: "permission_denied"`
- `resultCode: "denied"`
- 低敏 `exceptionCopy` 或等价拒绝文案。
- `opportunities: []`

RBAC denied 时，API 不得返回：

- source summary。
- trigger reason。
- suggested action。
- candidate count。
- 客户名称、客户标签或客户生命周期。
- 来源对象标题、来源对象 ID 或来源对象详情。
- 候选排序、优先级或时间窗口。
- 下钻 URL。
- 可执行 mutation 指令。

只有 dashboard read-only 权限不等于 opportunity readonly 权限。API 不得借 dashboard 权限返回 opportunity 候选详情。

## 6. API response 低敏字段白名单计划

未来 API response 只能包含低敏 readonly summary 字段。字段白名单必须在 API 接入前计划清楚，但本 PR 不实现字段白名单 enforcement runtime。

guard 全部通过后，可候选返回的 summary 字段：

- `status`
- `reasonCode`
- `resultCode`
- `emptyCopy`
- `exceptionCopy`
- `opportunities`

guard 全部通过后，`opportunities[]` 可候选返回的低敏字段：

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

上述字段也必须受状态约束。disabled、tenant mismatch、RBAC denied、source missing、empty 或 blocked 状态下，不得因为字段存在于候选 DTO 中就直接返回详情。

## 7. API 禁止返回的高敏或越界内容

未来 API 接入 opportunity readonly 时，不得返回以下内容：

- 完整手机号。
- 完整联系方式。
- 身份证号。
- 完整病历号。
- 病历正文。
- 诊断正文。
- 治疗记录原文。
- 咨询记录全文。
- 地址。
- 成交金额。
- 支付信息。
- 合同信息。
- 发票信息。
- 回款或结算明细。
- HIS raw payload。
- credential。
- token。
- API Key、OAuth secret、Webhook secret。
- 数据库连接串。
- SQL。
- stack。
- 外部系统请求 / 响应原文。
- request body 全文。
- response body 全文。
- AI prompt / completion 全文。

如果未来 API 需要 mask、redact、sanitizer 或 response whitelist enforcement，必须另开 runtime PR；本计划不实现字段白名单 enforcement runtime。

## 8. Blocked 状态响应边界

blocked 状态至少包括：

- `stale`
- `already_handled`
- `invalid_transition`

blocked 状态下，API 只能返回低敏 readonly 结果，例如：

- `status: "blocked"` 或 opportunity item 的 `status: "blocked"`。
- `reasonCode: "state_stale"`、`"already_handled"` 或 `"invalid_transition"`。
- `resultCode: "blocked"`。
- 低敏 `suggestedAction`，例如“当前状态不可执行，请刷新后重新判断”。

blocked 状态下，API 不得返回可执行 mutation 指令，不得允许或暗示以下动作：

- 确认。
- 转任务。
- 建预约。
- 成交。
- 发送消息。
- 外呼。
- 忽略。
- 重新触发。
- 同步 HIS。

blocked 状态不得通过 query parameter、force flag、二次确认 token、隐藏 action code 或 dashboard 下钻绕过。

## 9. Ready 状态响应边界

`ready` 状态也只能返回 readonly 结果。本阶段不得因为状态为 `ready` 就引入 mutation。

`ready` 状态下 API 可以在低敏范围内返回 readonly summary，但不得：

- 创建任务。
- 创建预约。
- 创建成交。
- 修改 opportunity 状态。
- 提交人工确认。
- 返回 mutation action code。
- 返回 confirm token。
- 返回 message send payload。
- 触发外部系统。
- 写 audit runtime。
- 写 dashboard aggregation runtime。

任何“确认”“转任务”“建预约”“成交”“发送消息”等动作，都必须等待单独 API / runtime PR 明确批准。

## 10. Empty / source missing / disabled / denied / blocked 错误态边界

未来 API 至少需要为以下状态保持低敏响应边界：

| 状态 | 候选 reasonCode | 候选 resultCode | API 响应边界 |
| --- | --- | --- | --- |
| feature flag disabled | `feature_flag_disabled` | `skipped` | 返回不可用态或安全空态，不返回候选详情。 |
| tenant mismatch | `tenant_scope_mismatch` | `denied` | 返回低敏拒绝态，不暴露对象存在性。 |
| RBAC denied | `permission_denied` | `denied` | 返回低敏拒绝态，不返回候选数量或来源对象信息。 |
| empty | `no_candidate_opportunities` | `empty` | 返回稳定空态，不误导为历史任务全部完成。 |
| source missing | `source_missing` | `unavailable` | 返回低敏异常态，不猜测 raw source，不返回 SQL / stack / raw payload。 |
| blocked stale | `state_stale` | `blocked` | 返回不可执行提示，不返回 mutation 指令。 |
| blocked already handled | `already_handled` | `blocked` | 不重复确认，不静默成功，不返回执行入口。 |
| blocked invalid transition | `invalid_transition` | `blocked` | 不临时放行，不覆盖状态，不返回强制执行入口。 |

错误态响应不得包含完整客户明细、来源对象明细、HIS raw payload、credential、token、SQL、stack 或外部系统错误全文。

## 11. Mock / seed / demo 数据 API 边界

mock / seed / demo 数据必须有明确标记，不得冒充生产数据。

API 返回 mock / seed / demo 数据时必须满足：

- 保留 `mockSeedDemoFlag` 或等价低敏标记。
- 不与真实 tenant 的生产候选混排。
- 不写成真实经营结论。
- 不写成真实客户触达结果。
- 不写成真实成交、支付、合同、发票或回款结果。

API 不得把 readonly opportunity 当成 dashboard 真实经营指标。readonly summary 只能作为内部只读提示，不代表真实待处理机会总量、真实转化率、真实成交金额或真实运营绩效。

## 12. Route / service / repository / DTO 非目标

以下内容均不在本计划实现：

- route。
- service。
- repository。
- DTO。
- schema。
- migration。
- SQL。
- API handler。
- API client。
- middleware。
- access-control 修改。
- permission enum 修改。
- feature flag provider。

后续如果需要 route、service、repository 或 DTO，必须另开 PR，并在对应任务中明确输入、输出、权限校验、字段白名单、错误态、回滚和人工审查边界。

## 13. Audit / dashboard / UI / runtime 非目标

以下内容均不在本计划实现：

- audit runtime。
- audit enum。
- audit metadata。
- dashboard aggregation。
- dashboard metrics API。
- dashboard drilldown API。
- UI 接入。
- 组件修改。
- runtime guard。
- 字段白名单 enforcement runtime。
- 真实 HIS。
- credential 读取。
- 真实客户数据处理。
- 自动营销。
- 自动触达。

后续如果需要 audit runtime，必须另开 PR 明确低敏 audit input，不记录 request body、response body、SQL、stack、token、secret、credential、HIS raw payload 或完整客户信息。

## 14. Rollback API 行为

关闭 feature flag 后，API rollback 行为必须是：

- 回到不可用态、安全空态或低敏拒绝态。
- `opportunities` 返回空数组或等价安全空集合。
- 不返回候选详情。
- 不返回候选数量。
- 不返回 source summary。
- 不返回 trigger reason。
- 不返回 suggested action。
- 不返回 dashboard 真实指标。
- 不触发 audit runtime。
- 不触发外部系统。

rollback 禁止项：

- 不执行 migration rollback。
- 不删除真实数据。
- 不批量清洗客户数据。
- 不触发外部系统补偿。
- 不发送消息。
- 不创建任务、预约或成交。

## 15. 后续 PR 拆分建议不是开发许可

后续可能拆分为：

- API-only boundary PR：只定义 route 层请求 / 响应边界、错误态和低敏 DTO 候选，不接 runtime。
- Runtime guard PR：只在明确授权后实现 feature flag、tenant、RBAC guard runtime。
- Field whitelist enforcement PR：只在明确授权后实现 response whitelist、mask、redact 或 sanitizer enforcement。
- Audit PR：只在明确授权后实现低敏 audit runtime。
- Dashboard PR：只在明确授权后处理 readonly opportunity 与 dashboard 指标 / 下钻的关系。
- UI PR：只在明确授权后接入入口、空态、错误态和 readonly 卡片。

以上只是拆分建议，不是开发许可。任何后续 PR 都必须重新经过启动检查、范围确认和人工授权。

## 16. API 接入前验收检查

未来 API PR 在进入人工审查前，至少需要逐项回答：

- feature flag 是否默认关闭。
- disabled 时是否不返回 opportunity 候选详情，只返回低敏不可用态或安全空态。
- tenant mismatch 时是否拒绝读取，且不返回候选列表、候选数量或跨租户对象存在性。
- RBAC denied 时是否只返回低敏拒绝态，不返回候选详情、候选数量或来源对象信息。
- API response 是否只包含低敏 readonly summary 字段。
- 是否禁止完整手机号、联系方式、身份证号、病历正文、诊断正文、成交金额、支付、合同、发票、HIS raw payload、credential、token、SQL、stack。
- `stale`、`already_handled`、`invalid_transition` 是否都进入 blocked 响应。
- blocked 状态是否没有 mutation 指令或可执行动作。
- ready 状态是否仍然没有 mutation。
- source missing / empty / disabled / denied / blocked 是否都有低敏响应边界。
- 字段白名单是否已计划清楚，且没有在未授权任务中实现 enforcement runtime。
- 是否未实现 route、service、repository、DTO、schema、migration、SQL。
- 是否未实现 audit runtime、dashboard aggregation、UI 接入、真实 HIS、credential 或真实客户数据处理。

任一项无法回答或需要 runtime 才能成立时，API PR 必须停止并拆分。
