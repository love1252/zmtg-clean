# V1-OPPORTUNITY-READONLY-UI-GUARD-PLAN-01：opportunity readonly UI guard 生效点计划

## 0. 文档元信息

- 任务编号：V1-OPPORTUNITY-READONLY-UI-GUARD-PLAN-01。
- 日期与时区：2026-06-09 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前阶段：V1 opportunity readonly domain slice 合并后的 UI 接入前 guard 生效点计划。
- 当前基线：`main` / `origin/main` 为 `cf732403b55b033abd34d76e7bb3aab0188abf69`。
- 最新已合并 PR：#242。
- 任务性质：docs-only / UI-plan-only / no runtime / no UI implementation / Draft PR only。

本文档只补充未来 UI 接入 opportunity readonly 视图前的 guard 生效点计划，不实现 UI，不修改组件，不新增 route，不接 API，不实现 runtime。

本文档不是 UI 开发许可，不是 API 开发许可，也不是 runtime 开发许可。后续建议、候选拆分、验收项和风险提示均不构成本轮开发授权。

## 1. 本轮范围与明确非目标

本轮只允许新增或修改 `docs/product/**` 下的计划文档。

本轮明确不做：

- 不修改 `src/**`。
- 不修改 tests。
- 不修改 schema / migration / SQL。
- 不修改 package 或 lockfile。
- 不修改配置文件。
- 不修改脚本文件。
- 不实现 UI。
- 不修改组件。
- 不新增 route。
- 不接 API。
- 不实现 feature flag runtime。
- 不实现 RBAC runtime。
- 不实现 tenant guard runtime。
- 不实现 dashboard aggregation runtime。
- 不实现 audit runtime。
- 不实现字段白名单 enforcement runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不创建任务、预约、成交、支付、合同或发票。
- 不自动营销，不自动触达，不发送消息。

如后续 UI 接入需要路由、组件、空态、错误态、下钻或按钮，必须另开单独 PR，并在新任务中重新声明允许文件、禁止文件、验证命令和回滚边界。

## 2. UI guard 总顺序

未来 UI 若接入 opportunity readonly 视图，guard 生效点必须按以下顺序收口：

1. feature flag：默认关闭，只有明确按 tenant 灰度开启后，UI 才能考虑显示 opportunity readonly 入口或低敏只读视图。
2. tenant guard：必须确认当前 UI 上下文与请求 / 数据 tenant scope 匹配。
3. RBAC guard：必须确认当前账号具备 opportunity readonly 读取权限。
4. readonly summary：只有在 feature flag、tenant、RBAC 都满足后，UI 才能展示低敏 readonly summary。
5. action guard：无论 `ready` 还是 `blocked`，本阶段 UI 都不得引入 mutation 或可执行动作。

UI 自身不能替代 feature flag、tenant guard 或 RBAC guard。未来 UI 只能消费经过 guard 后的低敏状态和低敏摘要，不得通过前端条件判断绕开后端或 domain 侧边界。

## 3. Feature flag disabled 时的 UI 行为

feature flag 必须默认关闭。默认关闭时，UI 必须满足以下任一安全行为：

- 不显示 opportunity 入口。
- 或只显示低敏不可用态，例如“该能力暂未开启”。

feature flag disabled 时，UI 不得：

- 展示 opportunity 候选列表。
- 展示候选数量。
- 展示 source summary、trigger reason 或 suggested action。
- 展示任何下钻入口。
- 展示任何可执行按钮。
- 把 mock / seed / demo opportunity 当作真实生产机会。

关闭 feature flag 后的 rollback UI 行为必须明确：入口不可见，或回到低敏不可用态；不得保留 stale 候选列表、stale 数量、历史下钻入口或任何可执行按钮。

## 4. Tenant mismatch 时的 UI 行为

tenant mismatch 是硬拒绝边界。出现 tenant mismatch 时，UI 只能显示低敏拒绝态或不可用态。

tenant mismatch 时，UI 必须：

- 不显示候选列表。
- 不显示候选数量。
- 不显示候选卡片标题。
- 不显示 source summary。
- 不显示 trigger reason。
- 不显示 suggested action。
- 不暴露跨租户对象存在性。

tenant mismatch 时，UI 不得通过空列表、数量 `0`、禁用按钮或错误文案暗示其他租户是否存在 opportunity、客户、预约、治疗摘要、随访任务或 dashboard 指标。

## 5. RBAC denied 时的 UI 行为

RBAC denied 时，UI 只能显示低敏拒绝态，例如“当前账号没有访问权限”。该拒绝态只能解释权限不足，不得泄露对象存在性或候选详情。

RBAC denied 时，UI 不得展示：

- source summary。
- trigger reason。
- suggested action。
- candidate count。
- 客户名称、客户标签或客户生命周期。
- 来源对象标题、来源对象 ID 或来源对象详情。
- 候选列表、候选卡片或候选排序。
- 下钻入口。
- 可执行按钮。

只有 dashboard read-only 权限不等于 opportunity readonly 权限。UI 不得借 dashboard 权限读取或展示 opportunity 候选详情。

## 6. Opportunity readonly 低敏展示边界

opportunity readonly 只能展示低敏 readonly summary。即使 guard 全部通过，UI 也只能展示足够内部人员理解机会类型和低敏状态的摘要，不得扩大成完整客户详情、经营结果或可执行工作流。

guard 全部通过后，可候选展示的低敏字段仅包括：

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

上述字段也必须遵守状态边界：disabled、tenant mismatch、RBAC denied、source missing 或 blocked 状态下，不得因为字段存在就直接渲染详情。

## 7. UI 禁止展示的高敏或越界内容

未来 UI 接入 opportunity readonly 时，不得展示以下内容：

- 完整手机号。
- 完整联系方式。
- 身份证号。
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

如果未来 UI 需要字段白名单、mask、redact 或 sanitizer enforcement，必须另开 runtime 或 UI PR；本计划不实现字段白名单 enforcement runtime。

## 8. Blocked 状态的 UI 行为

blocked 状态至少包括：

- `stale`
- `already_handled`
- `invalid_transition`

blocked 状态下，UI 只能展示低敏 readonly 提示，例如“当前状态不可执行，请刷新后重新判断”。blocked 状态下 UI 不得展示或启用以下可执行按钮：

- “确认”
- “转任务”
- “建预约”
- “成交”
- “发送消息”
- “外呼”
- “忽略”
- “重新触发”
- “同步 HIS”

blocked 状态也不得被 UI 临时放行，不得通过二次确认弹窗、隐藏参数、快捷入口或下钻页面绕过。

## 9. Ready 状态的 UI 行为

`ready` 状态也只能是 readonly 展示。本阶段不得因为状态为 `ready` 就引入 mutation。

`ready` 状态下 UI 可以在低敏范围内展示 readonly summary，但不得：

- 创建任务。
- 创建预约。
- 创建成交。
- 修改 opportunity 状态。
- 提交人工确认。
- 发送消息。
- 触发外部系统。
- 写 audit runtime。
- 写 dashboard aggregation runtime。

任何“确认”“转任务”“建预约”“成交”“发送消息”等按钮或菜单，都必须等待单独 UI / API / runtime PR 明确批准。

## 10. Mock / seed / demo 数据展示边界

mock / seed / demo 数据必须有明确标记，不得冒充生产数据。

UI 展示 mock / seed / demo 数据时必须满足：

- 页面、卡片或状态中保留 `mockSeedDemoFlag` 或等价低敏标记。
- 不与真实 tenant 的生产候选混排。
- 不写成真实经营结论。
- 不写成真实客户触达结果。
- 不写成真实成交、支付、合同、发票或回款结果。

UI 不得把 readonly opportunity 当成 dashboard 真实经营指标。readonly summary 只能作为内部只读提示，不代表真实待处理机会总量、真实转化率、真实成交金额或真实运营绩效。

## 11. Dashboard 与下钻边界

未来 dashboard 如需出现 opportunity readonly 相关入口，必须另开单独 PR 明确：

- 入口是否受同一个 feature flag 控制。
- 入口在 disabled、tenant mismatch、RBAC denied 时如何隐藏或降级。
- 指标卡是否只是低敏不可用态，还是允许只读摘要入口。
- 是否允许下钻；如果允许，必须明确下钻只能展示低敏 readonly summary。
- 下钻是否需要独立 RBAC；如果需要，必须先定义权限边界。

本计划不实现 dashboard aggregation runtime，不实现 dashboard 指标，不实现下钻，不实现 UI route，不修改组件。

## 12. API、runtime、audit 与字段白名单非目标

以下内容均不在本计划实现：

- API。
- route。
- service。
- repository。
- DTO。
- feature flag runtime。
- tenant guard runtime。
- RBAC runtime。
- dashboard aggregation runtime。
- audit runtime。
- 字段白名单 enforcement。
- parser、mask、redact、sanitizer。
- schema / migration / SQL。
- 真实 HIS 对接。
- credential 读取。
- 真实客户数据处理。

后续如果需要 API、runtime、dashboard aggregation、audit runtime 或字段白名单 enforcement，必须另开 PR，并在对应任务中明确测试、回滚和人工审查边界。

## 13. 后续 PR 拆分建议不是开发许可

后续可能拆分为：

- UI-only PR：只做入口、空态、错误态、低敏 readonly 卡片和按钮禁用规则。
- API-boundary PR：只定义低敏响应、disabled / denied / blocked 状态和字段白名单。
- runtime guard PR：只在明确授权后实现 feature flag、tenant、RBAC guard runtime。
- dashboard PR：只在明确授权后处理 readonly opportunity 与 dashboard 的关系。
- audit / whitelist PR：只在明确授权后处理 audit runtime 或字段白名单 enforcement。

以上只是拆分建议，不是开发许可。任何后续 PR 都必须重新经过启动检查、范围确认和人工授权。

## 14. UI 接入前验收检查

未来 UI PR 在进入人工审查前，至少需要逐项回答：

- feature flag 是否默认关闭。
- disabled 时入口是否不可见或回到低敏不可用态。
- tenant mismatch 时是否不显示候选列表、候选数量和跨租户对象存在性。
- RBAC denied 时是否不展示 source summary、trigger reason、suggested action、candidate count。
- readonly summary 是否只展示低敏字段。
- 是否禁止完整手机号、联系方式、身份证号、病历正文、诊断正文、成交金额、支付、合同、发票、HIS raw payload、credential、token、SQL、stack。
- `stale`、`already_handled`、`invalid_transition` 是否都进入 blocked 展示。
- blocked 状态是否没有“确认”“转任务”“建预约”“成交”“发送消息”等可执行按钮。
- ready 状态是否仍然没有 mutation。
- mock / seed / demo 数据是否明确标记且没有冒充生产数据。
- readonly opportunity 是否没有被当成 dashboard 真实经营指标。
- 是否未实现 API、runtime、dashboard aggregation、audit runtime 或字段白名单 enforcement。

任一项无法回答或需要 runtime 才能成立时，UI PR 必须停止并拆分。
