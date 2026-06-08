# NETWORK-PLAN-01：外部网络与真实 HIS 连接安全边界

> 日期：2026-06-08
> 状态：docs-only Plan Mode。本文只做外部网络与真实 HIS 连接安全边界复核，不实现 runtime，不实现 HTTP client，不实现外部网络安全 runtime，不接入真实 HIS，不读取真实凭证，不发起真实 HIS / 第三方业务外部网络请求，不新增 schema / migration，不修改 `src/**`、`drizzle/**`、package / lockfile、`.codex/**`、`AGENTS.md` 或 `docs/ai-agent-governance.md`。

## 启动检查结论

- 当前阶段：Phase24-PLAN 已完成，CRED-PLAN-01 已完成，HIS-ADAPTER-PLAN-01 已完成，下一步只能由人工选择一个 P0 / P1 单独 Plan 任务。
- 本次任务编号：NETWORK-PLAN-01。
- 本次任务性质：docs-only Plan Mode。
- 本次任务不是外部网络 runtime 实现，不是真实 HIS adapter 实现，不是真实 credential provider 实现，不是读取真实凭证，不是发起真实 HIS / 第三方业务外部网络请求，不是实现 runner / scheduler / cron / queue / worker，不是新增 schema / migration，不是修改应用代码或测试代码。
- 当前分支按任务建议使用 `docs/network-plan-01`。
- 当前基线来自 `main` / `origin/main` 的 `c52da4608a57af98e093a6601a46b6ee6e2044c4`。
- 开始前 working tree 干净。

## 开始前只读盘点结论

- 现有 plan 文档集中放置在 `docs/superpowers/plans/**`，近期命名采用 `YYYY-MM-DD-<任务主题>.md`。
- 当天 devlog 已存在于 `docs/devlog/2026-06-08.md`，本轮按既有习惯追加新小节。
- 未发现单独的 Phase 24 roadmap 文件；本轮不新增 roadmap，也不修改历史路线建议。
- Phase24-PLAN 已将外部网络与真实 HIS 连接列为 P0 单独边界，明确任何外部网络请求都必须单独审批。
- CRED-PLAN-01 已明确真实凭证读取、credential provider 输出、日志脱敏、audit 和环境隔离必须先决策，不能由网络层临时补齐。
- HIS-ADAPTER-PLAN-01 已明确真实 HIS adapter 不直接读取 secret，不直接写 repository / audit / DTO，不绕过 service 编排，也不在本轮触发外部网络。
- Phase 23 HIS 测试连接 / 健康检查 closeout 已明确当前只有 fake provider 最小闭环，真实外部 HIS 网络请求、真实 adapter runtime、真实凭证读取和 runner / scheduler 均未实现。
- 本轮不修改 `AGENTS.md`、`docs/ai-agent-governance.md`、`README.md` 或 `docs/roadmap/**`。

## 当前阶段定位

- Phase24-PLAN 已完成。
- CRED-PLAN-01 已完成。
- HIS-ADAPTER-PLAN-01 已完成。
- 本任务仍是 docs-only Plan Mode。
- 本任务只做外部网络与真实 HIS 连接安全边界复核。
- 本任务不授予 runtime 实现许可。
- 本任务不授予真实 HIS 接入许可。
- 本任务输出只能帮助人工判断后续拆分，不得被自动转化为代码、配置、真实凭证读取、网络探测或真实 HIS 接入。

## 本任务目标

- 明确真实 HIS 连接前需要先决策的网络安全问题。
- 明确出站网络 allowlist / denylist 边界。
- 明确真实 HIS 地址、域名、IP、端口、协议和重定向处理边界。
- 明确 SSRF、防内网探测、防本地元数据服务访问、防 DNS rebinding、防重定向绕过等安全边界。
- 明确超时、重试、backoff、熔断、响应大小、连接池、并发限制等运行边界。
- 明确本地 / 测试 / 预发 / 生产环境隔离。
- 明确与 HIS adapter、credential provider、测试连接、周期健康检查、audit、配置开关、监控告警的依赖关系。
- 明确后续任务拆分建议。
- 明确不进入 runtime 的验收口径。

## 明确非目标

- 不实现外部网络 runtime。
- 不实现 HTTP client。
- 不实现 allowlist / denylist 检查。
- 不实现 SSRF 防护。
- 不接入真实 HIS。
- 不发起外部网络请求。
- 不实现 HIS adapter。
- 不读取真实 secret。
- 不实现 credential provider。
- 不实现测试连接 runtime。
- 不实现健康检查 runtime。
- 不实现 runner / scheduler。
- 不新增 schema / migration。
- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不修改 package / lockfile。
- 不修改 `.codex/**`。
- 不修改 `AGENTS.md` 或 `docs/ai-agent-governance.md`。
- 不修改测试代码。
- 不修改 `README.md` 或 `docs/roadmap/**`。
- 不同时推进 SCHEDULER-PLAN-01、SCHEMA-REVIEW-01、AUDIT-PLAN-01、OBS-PLAN-01 或 CONFIG-PLAN-01。

## 外部网络安全边界

- 当前只能做边界复核，不能定义真实 runtime 实现。
- 当前不能新增真实 HIS vendor、hospital、院区、endpoint、协议、账号、密钥、连接串或请求样例。
- 当前不能新增真实 IP、域名、端口、路径、VPN、专线、代理、网关或防火墙配置。
- 当前不能新增真实认证材料样例，也不能给出真实环境变量名和值的组合示例。
- 如需描述外部系统，只能使用抽象占位说明，例如“后续单独审批的外部 HIS 系统”或“受控测试环境”，不得出现看似真实的地址、路径、账号或密钥。
- 所有真实外部网络能力都必须后续单独审批。
- 任何真实 HIS 连接都必须同时满足 adapter contract、credential provider、配置开关、audit、环境隔离、错误归一和监控边界。
- 出站网络能力必须默认关闭，后续如需启用，也应由服务端可信配置、环境边界、租户边界和连接边界共同约束。
- 任何客户端输入都不应直接决定外部目标、协议、端口、请求头、认证材料、重定向策略、超时、重试或并发参数。

## runtime 前置问题清单

| 问题 | 复核口径 | 本轮结论 |
| --- | --- | --- |
| 出站请求触发入口 | 哪些服务端入口未来允许触发真实外部请求，是否禁止 route、前端 body、query、header 或 cookie 直接传入目标 | 后续必须单独定义 contract，本轮不实现 |
| allowlist 维度 | 是否按环境、租户、连接、vendor、system、域名、IP、端口、协议组合约束 | 后续必须先形成策略，本轮不新增配置 |
| denylist 维度 | 是否默认拒绝 localhost、loopback、link-local、内网地址、metadata service、保留地址、广播地址和未知协议 | 后续必须先定义安全拒绝口径，本轮不写检查代码 |
| DNS 解析 | 是否需要固定解析时机、解析结果校验、缓存策略和解析失败行为 | 后续必须单独评审，本轮不解析任何目标 |
| DNS rebinding 防护 | 是否在连接建立前后重复校验目标，是否禁止解析结果从允许范围漂移到拒绝范围 | 后续必须单独设计，本轮不实现 |
| 重定向处理 | 是否默认禁止重定向，或只允许同一 allowlist 范围内的有限跳转 | 后续必须先做策略，本轮不发起请求 |
| HTTP / HTTPS 协议边界 | 是否允许明文协议，是否只允许受控协议和受控方法 | 后续必须单独审批，本轮不实现 HTTP client |
| TLS 校验 | 是否强制证书校验、主机名校验、证书链策略和证书异常处理 | 后续必须单独定义，本轮不接真实证书 |
| 代理、VPN、专线和网关 | 是否允许经代理、VPN、专线或网关访问，边界由谁批准和审计 | 后续必须由配置与安全边界任务确认，本轮不新增网络配置 |
| 请求超时 | 连接超时、读取超时、总超时是否分开设置，默认值是否必须保守 | 后续必须单独定义，本轮不实现 |
| 重试与 backoff | 哪些错误允许重试，最大次数、退避、抖动和停止条件如何约束 | 后续必须单独评审，本轮不实现 retry |
| 熔断与失败放大控制 | 是否按租户、vendor、system、连接维度限制失败放大 | 后续必须结合监控和 scheduler 计划，本轮不实现 |
| 响应大小限制 | 是否限制响应字节数、压缩展开大小、解析时间和异常 payload | 后续必须单独定义，本轮不接响应 |
| 响应类型限制 | 是否只允许受控响应类型，如何处理非预期内容 | 后续必须先定义错误归一，本轮不实现解析 |
| 请求敏感信息边界 | 请求头、认证头、cookie、body 和连接参数是否全部禁止进入日志、audit、DTO、devlog 和 PR 描述 | 默认禁止，本轮不新增敏感信息 |
| 外部响应保存 | 是否允许保存外部响应原文、header、body、错误原文或排障片段 | 默认不允许；任何例外必须单独审批 |
| 错误分类与错误归一 | 网络不可达、超时、认证失败、限流、服务不可用、响应不安全、配置拒绝如何映射为稳定错误码 | 后续必须只暴露稳定分类，本轮不接真实错误 |
| 日志脱敏 | 是否默认拒绝 endpoint、账号、token、password、API key、连接串、header、raw payload、SQL 和 stack | 后续必须有固定 denylist，本轮不新增日志 |
| audit 语义 | 外部网络尝试、配置拒绝、安全拒绝、超时、失败归一和结果来源如何审计 | 后续必须由 audit 计划确认，本轮不改 audit runtime |
| 环境隔离 | 本地、测试、预发、生产是否必须使用不同开关、凭证后端、allowlist 和 fake 禁用策略 | 后续必须先做环境隔离计划，本轮不新增配置 |
| 与 HIS adapter 的关系 | adapter 是否只能通过受控网络层触发外部请求，是否禁止自行拼接目标和读取 secret | 后续必须由 adapter contract 承接，本轮不实现 |
| 与 credential provider 的关系 | 网络层是否只消费已脱敏的连接上下文和短生命周期材料，不保存或展示真实凭证 | 后续必须由 provider contract 承接，本轮不读取凭证 |
| 与手动测试连接的关系 | 手动测试连接是否必须保留人工 actor、权限、audit 和服务端编排 | 后续集成前必须复核，本轮不改现有 fake provider |
| 与周期健康检查的关系 | 周期健康检查是否必须等 candidate、system actor、lock、backoff、audit 和网络边界明确后才能触发 | 后续必须单独审批，本轮不实现 runner |
| 与 runner / scheduler 的关系 | 多实例执行、批次、并发、停止条件、运行窗口和失败恢复如何避免重复外部请求 | 后续必须由 scheduler 计划确认，本轮不实现 |
| 与 lock / lease / backoff 的关系 | 是否需要 durable lock、lease、run 记录、失败计数或 backoff 到期字段 | 高概率需单独 schema 评审，本轮不新增 schema |
| 与 schema / migration 的关系 | 网络策略、运行记录、熔断状态、失败计数或观测数据是否需要字段、索引、枚举或表 | 任何 schema / migration 均需 SCHEMA-REVIEW-01 |
| 与监控 / 告警的关系 | 成功率、拒绝率、超时率、熔断、限流、响应大小和错误分布是否进入观测指标 | 后续必须由 OBS-PLAN-01 复核 |
| mock / fake 外部网络 | 是否允许 fake 网络层，生产是否必须显式禁用 | 后续必须由环境隔离和配置开关确认 |
| 真实网络灰度 | 是否允许按环境、租户、vendor、system 或连接灰度启用 | 后续必须单独审批，本轮不启用 |
| 多 vendor / 多院区 / 多租户 | 网络策略是否按租户、连接、vendor、system、院区维度隔离，避免跨租户探测 | 后续必须先定义扩展边界 |
| 原始错误透传 | 是否允许外部网络原始错误进入前端、日志、audit 或 devlog | 默认不允许 |

## 风险清单

- SSRF 访问内网、localhost、metadata service 或保留地址：如果外部目标可由客户端或低信任配置控制，可能绕过租户和网络边界。
- DNS rebinding 绕过 allowlist：目标初始校验通过后，解析结果可能漂移到拒绝范围。
- 重定向绕过 allowlist：外部响应若能重定向到未批准目标，会绕过初始目标校验。
- 测试环境误连真实 HIS：本地、测试或预发若共享生产网络配置，可能触达真实第三方系统。
- 生产环境误用测试 / fake 网络配置：fake 成功结果可能被误读为真实 HIS 可用。
- 真实 HIS endpoint、IP、域名、账号、token、password、API key 或连接串泄露：任何真实地址或认证材料都不得进入文档、日志、audit、DTO、测试快照或 PR 描述。
- 外部 HIS 原始响应进入日志、audit、DTO、devlog 或 PR 描述：厂商响应可能包含敏感业务数据、认证细节或内部结构。
- 外部网络错误过度透传：网络库错误、证书错误、代理错误、stack 或内部路径若暴露，会扩大攻击面。
- retry / backoff 未定义导致外部请求放大：无上限重试、多实例重复执行或失败风暴会打满外部系统。
- 多实例 runner 造成重复外部请求：缺少 lock / lease / run 记录时，多个实例可能同时探测同一连接。
- 手动测试连接与周期健康检查共享错误语义导致审计混乱：人工 actor 与 system actor 必须可区分。
- 代理、VPN、网关、专线边界不清导致不可控出站：网络路径若不受审计和配置边界约束，会绕过应用层策略。
- TLS 校验策略不清导致中间人风险：证书、主机名或链路校验放宽必须单独审批。
- 响应体过大或异常压缩导致资源消耗：外部响应大小和解析时间必须受控。
- 多租户 / 多院区配置边界不清导致跨租户探测：网络策略必须绑定可信 `tenantId + connectionId`。
- 将本 plan 误解为 runtime 批准：本文档只复核边界，不批准 HTTP client、allowlist runtime、SSRF 防护 runtime、真实 HIS 接入、真实凭证读取、schema 或 scheduler 实现。

## 后续拆分建议

以下仅为候选项，不自动执行。每个候选项都需要单独 PR、单独任务编号、单独允许文件、单独禁止范围和单独验收口径。任何 runtime、真实 HIS 连接、真实凭证读取、外部网络请求、schema / migration 或 runner / scheduler 任务都必须在后续获得明确批准后才能进入。

| 候选项 | 目标 | 边界 |
| --- | --- | --- |
| external network contract plan | 定义受控网络层输入、输出、调用方责任和安全失败口径 | 只写 contract 边界，不写 HTTP client，不发起请求 |
| allowlist / denylist policy plan | 定义环境、租户、连接、vendor、system、域名、IP、端口、协议的允许与拒绝策略 | 不新增配置文件，不新增 runtime 检查 |
| SSRF and redirect safety plan | 定义 SSRF、DNS rebinding、重定向、本地元数据服务和未知协议防护边界 | 不实现防护代码，不探测任何目标 |
| timeout / retry / backoff plan | 定义连接超时、读取超时、总超时、重试、退避、熔断和停止条件 | 不实现 retry runtime，不修改 runner / scheduler |
| network error normalization plan | 定义外部网络错误、安全拒绝、超时、限流、服务不可用和响应不安全的稳定内部错误码 | 不保存或透传外部原始错误 |
| network audit semantics plan | 定义外部网络尝试、配置拒绝、安全拒绝、成功 / 失败归一的 audit 语义 | 不修改 audit runtime，不新增 schema / migration |
| environment isolation and gate plan | 定义本地、测试、预发、生产的开关、fake 禁用、灰度、回滚和审批口径 | 不新增配置文件或环境变量文件 |
| real HIS connectivity approval plan | 定义真实 HIS 连接前的人工审批材料、验收口径和停止条件 | 不接真实 HIS，不读取真实凭证，不写真实目标 |
| monitoring and alerting integration plan | 定义网络成功率、拒绝率、超时率、熔断、限流、响应大小和错误分布的观测边界 | 不接监控 runtime，不新增告警配置 |

建议顺序：

1. 先做 external network contract plan，避免后续实现直接散落在 adapter 或 service 中。
2. 再做 allowlist / denylist policy plan 与 SSRF and redirect safety plan，先锁定目标选择和绕过防护。
3. 然后做 timeout / retry / backoff plan 与 network error normalization plan，约束失败放大和错误暴露。
4. 再做 network audit semantics plan 与 environment isolation and gate plan，确认审计和环境开关。
5. 最后按需要评审 real HIS connectivity approval plan 与 monitoring and alerting integration plan。

上述顺序不是开发许可，不得自动创建后续分支、commit、PR 或 runtime 实现。

## 验收标准

- 本 PR 只新增 / 修改文档。
- 无 runtime。
- 无 HTTP client。
- 无 allowlist / denylist runtime。
- 无 SSRF 防护 runtime。
- 无 schema。
- 无真实 HIS 接入。
- 无真实凭证。
- 无真实 HIS / 第三方业务外部网络请求。
- 未修改 `src/**`。
- 未修改 `drizzle/**`。
- 未修改 package / lockfile。
- 未修改 `.codex/**`。
- 未修改 `AGENTS.md` 或 `docs/ai-agent-governance.md`。
- 未修改测试代码。
- 未修改 `README.md` 或 `docs/roadmap/**`。
- 中文化残留检查通过，或仅命中历史旧文档且本次修改文件无命中。
- 后续候选任务只作为候选，不自动执行。

## 停止条件

- 需要真实 HIS endpoint 才能继续。
- 需要真实 IP、域名、端口、VPN、代理、网关或专线信息才能继续。
- 需要真实凭证才能继续。
- 需要发起外部网络请求才能继续。
- 需要修改 `src/**` 才能继续。
- 需要修改 `drizzle/**` 才能继续。
- 需要新增 schema / migration 才能继续。
- 需要实现 runtime 才能继续。
- 发现现有文档与本任务边界冲突。
- 无法确认目录或命名规范。
- 需要同时推进其他 Phase 24 后续任务才能继续。
- 发现真实 secret、token、password、API key、连接串、真实 HIS 地址、真实 IP、真实域名、真实端口或真实请求示例风险。
- 无法完成中文化残留检查。
