# 智美天工产品状态基线（2026-06-10）

## 1. 文档目的

本文档是智美天工当前产品状态基线，用于回答产品现在到底做到了什么程度、哪些能力已有 runtime、哪些仍停留在 mock / domain-only / test-only / docs-only、哪些关键功能还没有实现，以及当前业务闭环是否已经测试通。

本文档不是新开发计划，不是 runtime 授权，不是 Phase 24 启动文件，也不是后续任务队列。本文档中的状态判断、风险备注和后续建议，都不能被解释为自动开发许可。

任务编号：`ZMTG-PRODUCT-STATE-BASELINE-DOCS-01`。当前阶段：产品状态基线 docs-only。本文档不是 Phase 24、不是 V1 opportunity runtime、不是 dashboard aggregation、不是真实 HIS 接入、不是真实 credential 接入、不是真实客户上线准备。

## 2. 一句话产品定位

智美天工是面向医美 / 美业机构的 AI 客户运营中台，主线是治疗后客户运营闭环，不是 HIS 系统。

当前产品应围绕客户档案、预约、治疗摘要、随访建议、人工确认、内部随访任务、客户时间线、运营看板和审计追踪推进。HIS 只是未来或部分场景的数据来源之一，不是当前产品主线，也不能把 fake HIS test connection 宣称为真实 HIS 已接通。

## 3. 当前总体结论

- 产品不是空壳。
- 已有局部 demo / runtime 基础。
- 但 V1 主业务闭环尚未测试通。
- 当前只能视为内部受控 demo 雏形。
- 当前不具备可试点版本条件。
- 当前不具备真实客户上线条件。

更具体地说，仓库中已经存在 Next.js 页面、demo 登录、机构端业务页面、客户 / 预约 / 随访 / 治疗摘要 / 审计 / 平台租户只读管理 / HIS connection 元数据等 runtime 基础。但复诊、复购、沉睡客户机会的统一 opportunity runtime 尚未实现，V1 dashboard 三类机会指标也不能被视为真实聚合 runtime，真实 HIS、真实 credential provider、真实客户数据导入、外部触达和 AI provider / Agent / RAG 均不能对外宣称已实现。

## 4. 功能状态分类标准

| 分类 | 含义 | 判断口径 |
|---|---|---|
| A. 已有 runtime 实现 | 已有页面、API route、service、repository、schema 或可运行代码路径支撑 | 仍需区分 demo / fake / 内部边界，不能自动推导为可试点或可上线 |
| B. 已有 domain / service / unit 代码但未接 runtime | 有 domain、service、mapper、规则或单元测试，但未形成 API / UI / runtime 闭环 | domain-only，未接 API / UI / runtime |
| C. 仅有测试或测试计划 | 只有测试文件、测试计划或测试边界说明 | 测试文件不能证明真实业务闭环已打通 |
| D. 仅有文档 / plan | 只有产品文档、contract、plan、closeout 或设计说明 | docs-only，不是实现；plan 不是授权 |
| E. 未发现 | 未发现明确实现证据 | 未发现明确实现证据，不能对外宣称 |
| F. 状态不确定 | 证据不足或可能混合历史实现、demo、计划和未接入代码 | 必须继续只读确认后才能改变状态 |

必须遵守以下口径：

- 不得把 docs-only 当成已实现。
- 不得把 plan 当成已实现。
- 不得把 mock UI 当成业务闭环。
- 不得把测试文件当成真实业务闭环已打通。
- 不得把 domain-only 当成 runtime。
- 不得把 fake provider / fake connection 当成真实第三方系统接通。

## 5. 当前功能状态矩阵

| 模块 | 当前状态分类 | 当前证据类型 | 是否已有 runtime | 是否可演示 | 是否可试点 | 备注 |
|---|---|---|---|---|---|---|
| 登录 / demo auth | A. 已有 runtime 实现 | Next.js 页面、auth route、demo auth 测试 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界；不能视为生产认证 |
| 机构工作台 | A. 已有 runtime 实现 | `src/app/hospital/page.tsx`、机构组件、client 汇总 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界 |
| 客户中心 | A. 已有 runtime 实现 | 客户 API、repository、组件、测试 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界 |
| 预约中心 | A. 已有 runtime 实现 | 预约 API、repository、组件、测试 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界 |
| 智能随访 / 随访任务 | A. 已有 runtime 实现 | followups API、domain、组件、测试 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界；不是自动触达 |
| 治疗摘要 | A. 已有 runtime 实现 | 治疗摘要创建 / 列表 / 编辑 / 作废 API、repository、组件、测试 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界 |
| 治疗摘要建议与人工确认创建内部随访任务 | A. 已有 runtime 实现 | 建议生成、人工确认 route、内部任务创建服务和测试 | 是 | 是 | 否 | 已有 runtime，但只表示内部随访任务创建，不表示统一 opportunity 闭环 |
| 客户时间线 | A. 已有 runtime 实现 | timeline API、domain、drawer 组件、测试 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界 |
| 机构审计 | A. 已有 runtime 实现 | audit_events、机构审计 API / UI / repository / tests | 是 | 是 | 否 | 已有 runtime，但仍需补充 V1 主线覆盖矩阵 |
| 平台审计 | A. 已有 runtime 实现 | open-platform audit API / UI / tests | 是 | 是 | 否 | 已有 runtime，但仍需注意平台权限和低敏边界 |
| 平台租户 / 配额 | A. 已有 runtime 实现 | 平台租户只读管理、tenant repository、quota 字段和测试 | 是 | 是 | 否 | 已有 runtime，但偏只读管理和 demo 边界 |
| HIS connection 元数据 | A. 已有 runtime 实现 | his connection schema、CRUD / status route、repository、service、UI | 是 | 是 | 否 | 已有 runtime，但只是元数据和状态管理，不等于真实 HIS 接通 |
| HIS fake test connection | A. 已有 runtime 实现 | fake provider、test connection route / service / tests | 是 | 是 | 否 | fake test connection 只能演示假连接测试，不能说成真实 HIS 已接通 |
| credential route / fake credential provider | A. 已有 runtime 实现 | credential route、input / DTO、in-memory storage、service、tests | 是 | 受控演示 | 否 | 已有 credential route / fake 或 in-memory 能力，但不是真实 credential provider / secret manager |
| dashboard 基础摘要 | A. 已有 runtime 实现 | 机构 client / view model、客户 / 预约 / 随访基础汇总 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界 |
| V1 dashboard 三类机会指标 | D. 仅有文档 / plan | contract、test plan、mock / plan 口径 | 否 | 只能 mock 说明 | 否 | mock-only / plan-only，不是 aggregation runtime |
| V1 opportunity readonly | B. 已有 domain / service / unit 代码但未接 runtime | domain readonly、guard 测试、closeout 文档 | 否 | 只能说明 domain-only | 否 | domain-only，未接 UI / API / runtime |
| 复诊提醒 | B. 已有 domain / service / unit 代码但未接 runtime | 模板、随访建议、demo seed、局部测试 | 局部 | 只能内部说明 | 否 | domain / demo-only，未形成统一机会 runtime |
| 复购机会 | B. 已有 domain / service / unit 代码但未接 runtime | lifecycle 字段、demo seed、看板支持项 | 否 | 只能 mock 说明 | 否 | domain / mock-only，未接 API / UI / runtime 闭环 |
| 沉睡客户机会 | B. 已有 domain / service / unit 代码但未接 runtime | lifecycle 字段、demo seed、静态分层 | 否 | 只能 mock 说明 | 否 | domain / mock-only，未接 API / UI / runtime 闭环 |
| 统一机会人工确认 | E. 未发现 | 未发现明确 runtime 证据 | 否 | 否 | 否 | 未发现明确实现证据 |
| tenant / RBAC | A. 已有 runtime 实现 | request context、权限 guard、API route 权限测试 | 是 | 是 | 否 | 已有 runtime，但仍需注意 demo / 内部边界和生产认证差距 |
| feature flag | D. 仅有文档 / plan | feature flag / tenant / RBAC guard plan | 否 | 否 | 否 | docs-only；未发现生产级 provider / tenant 开关实现 |
| field whitelist | C. 仅有测试或测试计划 | contract、test plan、parser / DTO 测试 | 否 | 否 | 否 | test / contract-only，不是字段白名单 enforcement runtime |
| audit trace for V1 opportunity | D. 仅有文档 / plan | audit coverage matrix / plan | 否 | 否 | 否 | docs-only，不是 opportunity audit runtime |
| 真实 HIS adapter | E. 未发现 | 只有计划和 fake / mapper 边界 | 否 | 否 | 否 | 未实现；未发现明确实现证据 |
| 真实 credential provider / secret manager | D. 仅有文档 / plan | credential / secret manager plan、fake 或 in-memory runtime | 否 | 否 | 否 | docs-only 加 fake 边界；真实 provider / secret manager 未实现 |
| 真实客户数据导入 | E. 未发现 | 未发现真实导入 runtime | 否 | 否 | 否 | 未发现明确实现证据 |
| lead 管理 | E. 未发现 | 未发现完整 lead runtime | 否 | 否 | 否 | 未发现明确实现证据 |
| 独立 patient 管理 | E. 未发现 | 客户档案可承载脱敏患者摘要，但无独立 patient runtime | 否 | 否 | 否 | 未发现完整 runtime |
| OneID / 身份匹配 | E. 未发现 | 产品事实源中仍为待确认 / 后置 | 否 | 否 | 否 | 未发现明确实现证据 |
| 企微 / 微信 / 短信 / 外呼 | E. 未发现 | 文档中标记后续增强或禁止自动触达 | 否 | 否 | 否 | 未实现，不可对外宣称已接入 |
| AI provider / Agent / RAG | E. 未发现 | 文档中标记 AI 辅助定位，未发现 provider runtime | 否 | 否 | 否 | 未实现，不可宣称真实 AI provider / Agent / RAG |
| schema / migration / SQL | A. 已有 runtime 实现 | Drizzle schema、migration 文件、schema 测试 | 是 | 不适用 | 否 | 已有 Drizzle schema 和 migration 文件；本任务没有运行 migration，也不能证明生产数据库已执行 |

## 6. 当前已有 runtime 能力

当前可以认为已有 runtime 的能力包括：

- Next.js 页面与 demo 登录。
- 机构工作台。
- 客户中心。
- 预约中心。
- 智能随访。
- 治疗摘要创建 / 列表 / 编辑 / 作废。
- 治疗摘要生成确定性随访建议并人工确认创建内部随访任务。
- 客户时间线。
- 机构 / 平台审计查询。
- 平台租户与配额只读管理。
- 客户 / 预约创建配额 enforcement。
- HIS connection 元数据 CRUD / 状态 / credential route / fake test connection。
- Drizzle schema 和 migration。

这些能力说明产品不是空壳，但它们仍主要构成内部受控 demo 和局部 runtime 基础。已有 runtime 不自动等于可试点，不自动等于真实客户上线，也不自动等于 V1 主业务闭环已经端到端打通。

## 7. 当前不是 runtime 的重点能力

以下能力当前不能视为 runtime：

- V1 opportunity readonly：domain-only，未接 UI / API / runtime。
- V1 dashboard 三类机会指标：mock-only / plan-only，不是 aggregation runtime。
- 复诊 / 复购 / 沉睡机会统一 runtime：未实现。
- 统一机会人工确认：未实现。
- feature flag runtime：未发现生产级 provider / tenant 开关实现。
- 真实 HIS adapter：未实现。
- 真实 credential provider / secret manager：未实现。
- 真实客户数据导入：未实现。
- lead / 独立 patient / OneID：未发现完整 runtime。
- 企微 / 微信 / 短信 / 外呼：未实现。
- AI provider / Agent / RAG：未实现。

因此，当前不能把机会相关 mock、domain-only readonly、contract、test plan 或 dashboard 指标计划包装成已实现业务闭环。

## 8. 业务闭环判断

| 链路 | 当前判断 | 说明 |
|---|---|---|
| 1. 租户 / workspace | 局部具备 | 已有租户、机构 workspace、平台租户只读管理和配额基础 |
| 2. 用户权限 / RBAC | 局部具备 | 已有 demo auth / RBAC guard / route 权限测试，但不是生产认证完整闭环 |
| 3. HIS 连接配置 | 局部具备 | 已有 HIS connection 元数据 CRUD / 状态 runtime |
| 4. HIS 测试连接 | 仅 fake 具备 | fake test connection 可演示，但不能说明真实 HIS 已接通 |
| 5. 数据进入系统路径 | 局部具备 | 客户、预约、治疗摘要可通过内部 API / demo 数据进入；真实客户数据导入未实现 |
| 6. 客户 / 患者 / 线索数据 | 客户局部具备，患者 / lead 不完整 | 客户中心已有 runtime；独立 patient、lead、OneID 未发现完整 runtime |
| 7. 低敏经营洞察 | 局部具备 | 基础 dashboard 摘要和随访路径分析存在；V1 三类机会聚合未实现 |
| 8. 机会列表或机会摘要 | 未形成 runtime | V1 opportunity readonly 仍是 domain-only，复诊 / 复购 / 沉睡统一机会 runtime 未实现 |
| 9. 机会只读展示 | 未接 runtime | 未接 UI / API / route，不可对外宣称已实现 |
| 10. 任务 / 回访 / 复购 / 预约执行链路 | 随访局部具备，统一机会链路未具备 | 内部随访任务和治疗摘要建议转任务已存在；复购、沉睡、复诊机会到统一人工确认和执行链路未打通 |
| 11. audit / 风险记录 | 局部具备 | 机构 / 平台审计已有 runtime；V1 opportunity audit trace 仍是文档 / plan 口径 |
| 12. 测试是否证明端到端打通 | 否 | 单点测试较多，但没有证明完整业务闭环端到端跑通 |

结论：当前业务闭环没有测试通。

原因：

- 文档链路完整。
- 单点代码链路不少。
- 单点测试覆盖较多。
- 但 runtime 链路和真实数据链路没有被端到端测试证明。
- opportunity readonly 仍未接 UI / API / runtime。
- 复购 / 沉睡 / 复诊机会没有统一 runtime 闭环。

## 9. 当前可演示口径

可以演示：

- demo 登录。
- 机构工作台基础页面。
- 客户。
- 预约。
- 随访。
- 治疗摘要。
- 治疗摘要建议到内部随访任务。
- 审计查询。
- 平台租户 / 配额。
- HIS connection 元数据和 fake test connection。

必须说明：

- 机会相关演示只能说 mock / domain-only。
- fake HIS test connection 不能说成真实 HIS 已接通。
- dashboard V1 三类机会指标不能说成真实聚合已实现。
- 当前不能对外说业务模式已跑通。

## 10. 当前不可宣称内容

- 不可宣称真实 HIS 已打通。
- 不可宣称真实客户数据链路已打通。
- 不可宣称 V1 opportunity runtime 已实现。
- 不可宣称复诊 / 复购 / 沉睡机会闭环已实现。
- 不可宣称 dashboard V1 指标真实聚合已实现。
- 不可宣称 feature flag runtime 已实现。
- 不可宣称已具备试点版本。
- 不可宣称已具备真实客户上线条件。

## 11. 当前测试证明与未证明

### 当前测试证明了什么

基于测试文件，只能说测试代码覆盖了：

- domain 规则。
- parser / DTO 白名单。
- repository 行为。
- API route 权限 / 错误态。
- 组件 smoke。
- 敏感字段不展示。
- demo auth。
- RBAC。
- Drizzle schema。
- fake HIS test connection。
- in-memory credential storage。
- V1 opportunity readonly domain guard。

本任务没有运行测试，因此不能写“当前测试全部通过”。

### 当前测试没有证明什么

- 没有证明真实 HIS 接通。
- 没有证明真实 credential 安全存储。
- 没有证明生产数据库 migration 已执行。
- 没有证明 dev server 可用。
- 没有证明真实客户数据流入。
- 没有证明 V1 opportunity API / UI / runtime。
- 没有证明 feature flag runtime。
- 没有证明完整业务闭环端到端跑通。
- 没有证明对外试点可用。

## 12. 当前产品阶段判断

- 内部受控 demo 雏形：是。
- 完整 V1 业务闭环演示版：否。
- 可试点版本：否。
- 真实客户上线条件：否。

## 13. 后续最小安全动作

建议后续最小安全动作如下：

1. 暂停 runtime 开发。
2. 以本文档作为后续判断基线。
3. 若继续，优先做 test-only 闭环定义。
4. 其次才考虑单独授权、默认关闭、test-first、低敏 readonly 的 runtime minimal slice。

不得直接进入完整 runtime。任何 runtime、API、UI、dashboard aggregation、schema / migration、真实 HIS、真实 credential、真实客户数据、外部触达、AI provider / Agent / RAG 都必须在后续任务中单独明确授权。

## 14. 后续严格禁止事项

- 不得把 plan 当授权。
- 不得把 mock 当实现。
- 不得把 domain-only 当 runtime。
- 不得把 ready 当 mutation action。
- 不得混入 UI / API / schema / SQL / dashboard aggregation / audit runtime / field whitelist enforcement runtime。
- 不得连接真实 HIS。
- 不得使用真实 credential。
- 不得处理真实客户数据。
- 不得实现自动营销 / 自动触达。
- 不得实现任务 / 预约 / 成交 / 支付 / 合同 / 发票扩展能力，除非后续单独明确授权。
