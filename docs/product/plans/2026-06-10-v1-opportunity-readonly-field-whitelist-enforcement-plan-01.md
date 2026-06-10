# V1-OPPORTUNITY-READONLY-FIELD-WHITELIST-ENFORCEMENT-PLAN-01：opportunity readonly 字段白名单 enforcement 前置计划

## 0. 文档元信息

- 任务编号：V1-OPPORTUNITY-READONLY-FIELD-WHITELIST-ENFORCEMENT-PLAN-01。
- 日期与时区：2026-06-10 CST +0800，来自本轮本地命令 `date "+%Y-%m-%d"` 与 `date "+%Z %z"`。
- 当前阶段：V1 opportunity readonly domain slice 合并后的字段白名单 enforcement 前置计划。
- 当前基线：`main` / `origin/main` 为 `e3b3a7c8234a7d62139bb8389d82a0475709ac3e`。
- 最新已合并 PR：#244。
- 任务性质：docs-only / field-whitelist-plan-only / no runtime / no enforcement implementation / Draft PR only。

本文档只补充未来字段白名单 enforcement runtime 的前置计划，不实现字段白名单 enforcement runtime，不实现 parser / mask / redact / sanitizer，不实现 middleware，不新增 route，不修改 service / repository / DTO，不接 API，不接 UI，不接 dashboard，不接 audit runtime。

本文档不是 enforcement runtime 开发许可，不是 API 开发许可，不是 UI 开发许可，也不是 dashboard / audit / runtime 开发许可。后续建议、候选拆分、验收项和风险提示均不构成本轮开发授权。

## 1. 本轮范围与明确非目标

本轮只允许新增或修改 `docs/product/**` 下的计划文档。

本轮明确不做：

- 不修改 `src/**`。
- 不修改 tests。
- 不修改 schema / migration / SQL。
- 不修改 package 或 lockfile。
- 不修改配置文件。
- 不修改脚本文件。
- 不实现字段白名单 enforcement runtime。
- 不实现 parser / mask / redact / sanitizer。
- 不实现 middleware。
- 不新增 route。
- 不修改 service / repository / DTO。
- 不实现 API。
- 不接 UI。
- 不修改组件。
- 不实现 runtime。
- 不实现 feature flag runtime。
- 不实现 RBAC runtime。
- 不实现 tenant guard runtime。
- 不实现 dashboard aggregation runtime。
- 不实现 audit runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。
- 不自动营销，不自动触达，不发送消息。

如后续需要字段白名单 enforcement runtime，必须另开 PR，并先写测试边界；不得与 UI、API、dashboard aggregation 或 audit runtime 混在同一个 PR。

## 2. Enforcement 目标与收口原则

字段白名单 enforcement 未来只能保护 V1 opportunity readonly 的低敏只读输出，不得扩大为通用数据清洗系统。

本计划的目标是为以下内容提前收口：

- 允许字段候选。
- 禁止字段候选。
- 候选 guard 位置。
- disabled / tenant mismatch / RBAC denied / empty / source missing / blocked / ready 状态下的字段收窄规则。
- 字段白名单错误响应。
- 低敏 audit input。
- rollback 策略。
- 后续 runtime PR 的拆分边界。

enforcement 未来即使被批准，也只能作为“禁止越界字段进入 opportunity readonly 输出”的保护层，不应替代 feature flag、tenant guard、RBAC guard、业务状态判断或人工确认边界。

## 3. 允许字段候选

允许字段候选必须限定为低敏 readonly summary。未来对象级白名单可在以下字段中继续收窄，不得默认全量返回。

summary 级允许字段候选：

- `status`
- `reasonCode`
- `resultCode`
- `emptyCopy`
- `exceptionCopy`
- `opportunities`

`opportunities[]` 级允许字段候选：

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

说明：

- `mockSeedDemoFlag` 必须保留明确标记，不得冒充生产数据。
- `sourceSummary`、`triggerReason`、`suggestedAction` 只能是低敏摘要，不得透传 raw source、病历正文、外部系统响应或营销话术全文。
- `opportunities` 在 disabled、tenant mismatch、RBAC denied、empty、source missing 等状态下必须为空或等价安全空集合。
- 即使字段名在允许列表中，也必须先通过状态边界判断，不能因为字段名允许就返回候选详情。

## 4. 禁止字段候选

以下字段或内容不得进入 V1 opportunity readonly output、API response、UI 渲染输入、dashboard aggregation 输入、audit input、错误响应或低敏摘要字段：

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
- 回款 / 结算明细。
- HIS raw payload。
- credential。
- token。
- API Key。
- OAuth secret。
- Webhook secret。
- 数据库连接串。
- SQL。
- stack。
- request body 全文。
- response body 全文。
- AI prompt / completion 全文。
- 外部系统请求 / 响应原文。
- 外部消息原文。
- mutation action。
- confirm token。
- message payload。
- 任意自由 JSON metadata。
- repository row 原始对象。
- domain raw object。
- third-party raw object。

禁止字段不得通过别名、嵌套对象、数组、字符串拼接、低敏字段伪装、错误响应、audit metadata 或 dashboard drilldown 绕过。

## 5. 候选 guard 位置计划

enforcement guard 位置只能作为未来候选计划描述，本 PR 不实现任何代码。

未来候选 guard 位置至少包括：

| 候选 guard 位置 | 计划职责 | 本计划是否实现 |
| --- | --- | --- |
| domain readonly output 出口 | 在 `buildV1OpportunityReadonlySummary` 或等价 presenter 输出后，确认 summary key 与 item key 只包含低敏 readonly 白名单。 | 不实现 |
| API response DTO 出口 | 在 API 返回前确认 DTO 不含 forbidden key、raw payload、SQL、stack、credential 或 mutation 指令。 | 不实现 |
| UI 渲染前低敏字段检查 | 在 UI 消费 readonly summary 前确认 disabled / denied / blocked 状态不会渲染候选详情或动作。 | 不实现 |
| dashboard aggregation 前置低敏边界 | 在任何 dashboard aggregation 读取 opportunity readonly 候选前，确认仅使用低敏 summary，不把 candidate 当真实经营指标。 | 不实现 |
| audit input 低敏边界 | 在 audit input 生成前，只保留低敏 reasonCode / resultCode / guard outcome / mockSeedDemoFlag 等。 | 不实现 |

候选 guard 不得成为一个宽泛清洗器。未来若需要多个层级，应按 domain output、API DTO、UI render、dashboard aggregation、audit input 分 PR 实现，并分别写测试。

## 6. 状态收窄规则

disabled / tenant mismatch / RBAC denied / empty / source missing / blocked 状态下，字段白名单必须更严格，不得因为字段存在就返回候选详情。

| 状态 | 必须允许的低敏响应 | 必须禁止的内容 |
| --- | --- | --- |
| disabled | `status`、`reasonCode`、`resultCode`、低敏 `emptyCopy`、空 `opportunities`。 | 候选详情、候选数量、source summary、trigger reason、suggested action、下钻、mutation。 |
| tenant mismatch | 低敏 denied 状态、`tenant_scope_mismatch`、空 `opportunities`。 | 候选列表、候选数量、跨租户对象存在性、来源对象详情、客户详情。 |
| RBAC denied | 低敏 denied 状态、`permission_denied`、空 `opportunities`。 | 候选详情、候选数量、source summary、trigger reason、suggested action、来源对象信息。 |
| empty | 稳定空态和空 `opportunities`。 | 暗示历史任务全部完成、真实统计、dashboard 真实指标。 |
| source missing | 低敏异常态和空 `opportunities`。 | raw source、HIS raw payload、SQL、stack、外部错误全文、猜测来源对象。 |
| blocked | 低敏 blocked item、blocked reasonCode、blocked resultCode、不可执行提示。 | mutation action、confirm token、message payload、敏感下钻、强制执行入口。 |
| ready | readonly summary 低敏字段。 | mutation、确认、转任务、建预约、成交、发送消息、外部系统触发。 |

## 7. Blocked 与 ready 规则

blocked 状态包括：

- `stale`
- `already_handled`
- `invalid_transition`

blocked 状态仍不得返回：

- mutation action。
- confirm token。
- message payload。
- selected action code。
- executable action。
- allowed actions。
- 下钻敏感信息。
- 外部系统请求参数。
- 任务、预约、成交、消息发送相关 payload。

`ready` 状态也只能通过 readonly 字段白名单，不得引入 mutation。未来如需确认、转任务、建预约、成交或发送消息，必须另开 API / runtime PR，并先定义权限、状态流转、审计和回滚边界。

## 8. Mock / seed / demo 边界

mock / seed / demo 字段必须保留明确标记，不得冒充生产数据。

未来 enforcement 需要确认：

- `mockSeedDemoFlag` 只能是 `mock`、`seed` 或 `demo` 等受控标记。
- mock / seed / demo 数据不得与真实 tenant 的生产候选混排。
- mock / seed / demo 不能写成真实经营结论、真实客户触达结果、真实成交、支付、合同、发票或回款结果。
- dashboard aggregation 不得把 readonly opportunity 或 demo 候选当成生产 BI。

本计划不实现 mock / seed / demo runtime 校验。

## 9. 字段白名单错误响应计划

字段白名单错误响应必须低敏，不得返回被拦截字段名以外的敏感值，不得返回 raw payload、SQL、stack。

未来候选错误响应只应包含：

- 稳定低敏 `status`。
- 稳定低敏 `reasonCode`，例如 `field_whitelist_violation`。
- 稳定低敏 `resultCode`，例如 `blocked` 或 `unavailable`。
- 低敏中文 copy。
- 可选的被拦截字段名列表，但只能是字段名，不包含字段值。

错误响应禁止包含：

- rejected value 原文。
- request body 全文。
- response body 全文。
- HIS raw payload。
- 外部系统错误全文。
- SQL。
- stack。
- credential。
- token。
- API Key、OAuth secret、Webhook secret。
- 客户明细。
- 病历正文。

如果字段名本身可能泄露业务对象存在性，未来 PR 必须进一步收窄为通用 reasonCode，不返回字段名列表。

## 10. Audit input 边界计划

audit input 只能记录低敏 reasonCode / resultCode / guard outcome / mockSeedDemoFlag 等，不记录 request body、response body、raw payload、token、credential、SQL、stack、客户明细。

未来 audit input 候选字段：

- `resourceType`：例如 `opportunity_readonly` 或等价低敏资源名。
- `action`：例如 `field_whitelist_checked`、`field_whitelist_blocked`、`opportunity_readonly_viewed` 等后续命名候选。
- `reasonCode`。
- `resultCode`。
- `guardOutcome`：例如 `passed`、`blocked`、`denied`、`skipped`。
- `mockSeedDemoFlag`。
- `opportunityType`。
- `sourceType`。
- `operatorRole` 或低敏 actor role。

audit input 禁止记录：

- request body。
- response body。
- raw payload。
- token。
- credential。
- SQL。
- stack。
- 客户明细。
- 完整手机号。
- 身份证号。
- 完整病历号。
- 病历正文。
- 诊断正文。
- HIS response。
- 外部消息原文。
- AI prompt / completion 全文。

本计划不实现 audit runtime，不新增 audit enum，不新增 audit metadata。

## 11. Rollback 策略

如果未来 enforcement runtime 出现问题，rollback 策略必须是关闭对应 feature flag，或回到不可用 / 空态 / 低敏拒绝态。

rollback 后必须：

- 不返回 opportunity 候选详情。
- 不返回候选数量。
- 不返回 source summary、trigger reason、suggested action。
- 不触发 mutation。
- 不触发 audit runtime。
- 不触发 dashboard aggregation runtime。
- 不接真实 HIS。
- 不读取 credential。
- 不处理真实客户数据。

rollback 禁止项：

- 不删除真实数据。
- 不执行 migration rollback。
- 不批量清洗客户数据。
- 不触发外部系统补偿。
- 不发送消息。
- 不创建任务、预约或成交。
- 不修改支付、合同、发票或回款数据。

## 12. 后续 runtime PR 拆分边界

后续若实现字段白名单 enforcement runtime，必须另开 PR，并先写测试边界，不得与 UI/API/dashboard/audit 混在一个 PR。

推荐拆分：

- Domain output whitelist PR：只保护 readonly summary 输出 key 与 forbidden field 缺席。
- API response whitelist PR：只保护 API DTO 输出，不接 UI，不接 dashboard。
- UI render guard PR：只保护 UI 渲染前低敏字段，不接 API runtime。
- Dashboard pre-aggregation guard PR：只保护 dashboard aggregation 前的低敏输入，不实现新指标。
- Audit input guard PR：只保护 audit input 低敏字段，不新增自由 metadata。

每个 runtime PR 都必须：

- 先写测试边界。
- 明确允许修改的文件列表。
- 明确禁止字段矩阵。
- 明确 disabled / denied / blocked / source missing 的低敏响应。
- 明确 rollback。
- 保持小范围、单主题、可审查。

## 13. 本计划不实现的内容

本计划不实现：

- parser。
- mask。
- redact。
- sanitizer。
- middleware。
- DTO。
- route。
- service。
- repository。
- schema。
- migration。
- SQL。
- API。
- UI。
- dashboard aggregation。
- audit runtime。
- feature flag runtime。
- RBAC runtime。
- tenant guard runtime。
- 真实 HIS。
- credential 读取。
- 真实客户数据处理。
- 自动营销。
- 自动触达。

本计划也不修改现有测试或新增测试代码；测试实现必须另开任务。

## 14. 后续建议不是开发许可

后续可能候选：

- V1-OPPORTUNITY-READONLY-FIELD-WHITELIST-TEST-PLAN-01：docs-only / test-plan-only，细化字段白名单测试矩阵。
- V1-OPPORTUNITY-READONLY-DOMAIN-WHITELIST-RUNTIME-01：runtime-only，只有在明确授权后保护 domain readonly output。
- V1-OPPORTUNITY-READONLY-API-WHITELIST-RUNTIME-01：runtime-only，只有在明确授权后保护 API response DTO。
- V1-OPPORTUNITY-READONLY-AUDIT-INPUT-GUARD-PLAN-01：docs-only / plan-only，继续收口 audit input 命名与低敏字段。

以上只是候选建议，不是开发许可。任何 runtime、UI、API、dashboard、audit、schema、migration、SQL、真实 HIS、credential、真实客户数据、自动营销或自动触达任务，都必须单独授权。

## 15. Enforcement 前置验收检查

未来进入 enforcement runtime PR 前，至少需要逐项回答：

- 是否仍只保护 V1 opportunity readonly 低敏只读输出。
- 是否没有扩大成通用数据清洗系统。
- 允许字段是否限定为 readonly summary 和 `opportunities[]` 低敏字段。
- 禁止字段是否覆盖完整手机号、联系方式、身份证号、完整病历号、病历正文、诊断正文、治疗记录原文、咨询记录全文、地址、成交金额、支付、合同、发票、回款 / 结算、HIS raw payload、credential、token、API Key、OAuth secret、Webhook secret、数据库连接串、SQL、stack、request body、response body、AI prompt / completion。
- disabled / tenant mismatch / RBAC denied / empty / source missing / blocked 状态是否更严格。
- blocked 是否覆盖 `stale`、`already_handled`、`invalid_transition`，且无 mutation action、confirm token、message payload 或敏感下钻。
- ready 状态是否仍无 mutation。
- mock / seed / demo 是否明确标记且不冒充生产数据。
- 字段白名单错误响应是否低敏且不回显敏感值。
- audit input 是否只记录低敏 reasonCode / resultCode / guard outcome / mockSeedDemoFlag 等。
- rollback 是否只回到不可用 / 空态 / 低敏拒绝态，不删除真实数据、不触发外部系统。
- 是否未与 UI/API/dashboard/audit 混在一个 PR。

任一项无法回答或需要越界实现时，runtime PR 必须停止并拆分。
