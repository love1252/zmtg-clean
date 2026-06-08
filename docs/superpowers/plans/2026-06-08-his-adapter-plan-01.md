# HIS-ADAPTER-PLAN-01：真实 HIS adapter 接入边界复核

> 日期：2026-06-08
> 状态：docs-only Plan Mode。本文只做真实 HIS adapter 接入前置边界复核，不实现 runtime，不接入真实 HIS，不读取真实凭证，不发起外部网络请求，不新增 schema / migration，不修改 `src/**`、`drizzle/**`、package / lockfile、`.codex/**`、`AGENTS.md` 或 `docs/ai-agent-governance.md`。

## 启动检查结论

- 当前阶段：Phase24-PLAN 已完成，CRED-PLAN-01 已完成，下一步只能由人工选择一个 P0 / P1 单独 Plan 任务。
- 本次任务编号：HIS-ADAPTER-PLAN-01。
- 本次任务性质：docs-only Plan Mode。
- 本次任务不是真实 HIS adapter runtime 实现，不是接入真实 HIS，不是外部网络调用，不是读取真实凭证，不是实现 credential provider，不是 runner / scheduler / cron / queue / worker，不是新增 schema / migration，不是修改应用代码或测试代码。
- 当前分支按任务建议使用 `docs/his-adapter-plan-01`。
- 当前基线来自 `main` / `origin/main` 的 `82254ae01e4738d78a1f0cda24412f095400c8e0`。
- 开始前 working tree 干净。

## 开始前只读盘点结论

- 现有 plan 文档集中放置在 `docs/superpowers/plans/**`，近期命名采用 `YYYY-MM-DD-<任务主题>.md`。
- 当天 devlog 已存在于 `docs/devlog/2026-06-08.md`，本轮按既有习惯追加新小节。
- 未发现单独的 Phase 24 roadmap 文件；本轮不新增 roadmap，也不修改历史路线建议。
- Phase24-PLAN 已将真实 HIS adapter、外部网络、真实凭证、schema / migration、runner / scheduler、audit、监控和配置开关列为单独审批边界。
- CRED-PLAN-01 已明确 credential provider 只负责凭证材料获取边界，adapter 不应承担凭证读取职责。
- Phase 23 HIS 测试连接 / 健康检查 closeout 已明确当前只有 fake provider 最小闭环，真实 HIS adapter runtime、外部 HIS 网络请求和真实凭证读取均未实现。
- Phase 23 真实 adapter 测试连接边界规划已明确 route 不直接调用 adapter，adapter 不写 repository、不写 audit、不生成 DTO，adapter 结果必须由 service 归一化后写健康摘要和 audit。
- 本轮不修改 `AGENTS.md`、`docs/ai-agent-governance.md`、`README.md` 或 `docs/roadmap/**`。

## 当前阶段定位

- Phase24-PLAN 已完成。
- CRED-PLAN-01 已完成。
- 本任务仍是 docs-only Plan Mode。
- 本任务只做真实 HIS adapter 接入前置边界复核。
- 本任务不授予 runtime 实现许可。
- 本任务输出只能帮助人工判断后续拆分，不得被自动转化为代码、配置、网络调用或真实 HIS 接入。

## 本任务目标

- 明确真实 HIS adapter 接入前需要先决策的问题。
- 明确 adapter 与 credential provider 的依赖边界。
- 明确 adapter 与测试连接、健康检查、audit、错误归一、外部网络、配置开关之间的边界。
- 明确多租户、多院区、多 HIS vendor 扩展前的安全前置条件。
- 明确后续任务拆分建议，并要求每个候选项单独 PR。
- 明确本轮不进入 runtime 的验收口径。

## 明确非目标

- 不实现 HIS adapter。
- 不接入真实 HIS。
- 不发起外部网络请求。
- 不读取真实 secret。
- 不实现 credential provider。
- 不实现测试连接 runtime。
- 不实现健康检查 runtime。
- 不实现 runner / scheduler。
- 不实现 cron / queue / worker。
- 不实现 candidate query runtime。
- 不实现 scheduled audit runtime。
- 不实现 system actor / service actor runtime。
- 不新增 lock / lease / backoff runtime。
- 不新增 schema / migration。
- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不修改 package / lockfile。
- 不修改 `.codex/**`。
- 不修改 `AGENTS.md` 或 `docs/ai-agent-governance.md`。
- 不修改测试代码。
- 不修改 `README.md` 或 `docs/roadmap/**`。
- 不同时推进 SCHEDULER-PLAN-01、SCHEMA-REVIEW-01、AUDIT-PLAN-01、NETWORK-PLAN-01、OBS-PLAN-01 或 CONFIG-PLAN-01。

## HIS adapter 来源与职责边界

- 当前只能做接入边界复核，不能定义真实 adapter 实现。
- 当前不能新增真实 HIS vendor、hospital、院区、endpoint、协议、账号、密钥、连接串或请求样例。
- 当前不能新增真实认证材料样例，也不能给出真实环境变量名和值的组合示例。
- 如需描述外部系统，只能使用抽象占位说明，例如“后续单独审批的外部 HIS 系统”或“受控测试环境”，不得出现看似真实的地址、路径、账号或密钥。
- adapter 只应负责与外部 HIS 协议交互、响应解析、错误归一和结果归档边界。
- credential provider 只应负责凭证材料获取边界，不应承担外部 HIS 协议行为。
- adapter 不应直接读取 secret，也不应从环境变量、HTTP 请求、前端表单或连接配置明文字段拼接凭证。
- 测试连接 / 健康检查只应调用 adapter 的稳定抽象，不应绕过 adapter 直接访问外部 HIS。
- route 不应直接调用 adapter；service 应是读取连接快照、读取凭证材料、选择 adapter、处理结果、写健康摘要和写 audit 的唯一编排层。
- adapter 不写 repository，不写 audit，不生成 DTO，不决定权限，不调度任务，不执行 HIS 数据同步。

## runtime 前置问题清单

| 问题 | 复核口径 | 本轮结论 |
| --- | --- | --- |
| adapter 输入边界 | 输入是否只来自服务端可信连接快照、credential provider 输出和服务端配置白名单 | 后续必须先定义 contract，本轮不写代码 |
| adapter 输出边界 | 输出是否只包含内部稳定 provider code、健康状态建议、耗时区间和安全错误分类 | 后续必须先定义脱敏结果，本轮不定义真实响应结构 |
| provider 依赖方向 | adapter 是否只消费 credential provider 的短生命周期材料，且不反向调用 provider 后端细节 | 必须单向依赖，本轮不实现 |
| 直接读取 secret | adapter 是否允许直接读取 secret、环境变量、凭证引用或 secret manager path | 默认不允许，除非后续明确审批并重做边界 |
| 外部响应持久化 | 是否允许保存外部响应、认证响应、headers、请求体或排障片段 | 默认不允许；任何例外必须单独审批脱敏、保留期、权限和删除策略 |
| 外部网络触发条件 | 哪些入口能触发真实外部请求，是否必须有全局、环境、租户和厂商开关 | 后续必须先做网络与配置计划，本轮不触发网络 |
| 超时、失败、重试、熔断 | 是否有固定超时、最大重试、退避、熔断和停止条件 | 后续必须单独定义，本轮不设计执行策略 |
| 错误分类与错误归一 | 厂商认证失败、超时、不可达、限流、服务不可用、响应不安全和未支持厂商如何映射 | 只允许稳定内部错误码，禁止透传原文 |
| 日志脱敏 | 日志是否拒绝 endpoint、header、账号、token、password、API key、连接串、raw payload、SQL 和 stack | 后续必须形成 denylist，本轮不新增日志 |
| audit 语义 | audit 记录 adapter 尝试、结果归一、稳定 reason、actor 和来源，不记录敏感材料 | 后续必须单独确认，本轮不改 audit runtime |
| 环境隔离 | 本地、测试、预发、生产是否使用不同 adapter、凭证后端、网络开关和 allowlist | 后续必须先定义环境隔离，本轮不新增配置 |
| 手动测试连接关系 | 手动测试连接是否只通过 service 调用 adapter 稳定抽象，并继续保留人工 actor 语义 | 后续集成前必须复核，本轮不改测试连接 runtime |
| 周期健康检查关系 | scheduled health check 是否复用 adapter 抽象，但使用 system actor / service actor 和 scheduled audit | 后续必须由独立任务确认，本轮不实现周期健康检查 |
| runner / scheduler 关系 | runner 是否只能在 candidate、lock、backoff、audit、provider、adapter 都明确后调用 adapter | 后续必须先做 scheduler 计划，本轮不实现 |
| system actor 关系 | 后台任务调用 adapter 时 actor 语义是否可追溯，是否禁止冒充人工用户 | 后续必须由 audit 语义任务确认 |
| lock / lease / backoff 关系 | 多实例或失败重试是否需要 durable lock、lease、backoff、run 记录或 schema | 高概率需单独评审，本轮不新增 schema |
| schema / migration 关系 | adapter 配置、运行记录、错误状态或观测数据是否需要字段、索引、枚举或表 | 任何 schema / migration 均需 SCHEMA-REVIEW-01 |
| 监控 / 告警 / 失败重试 | adapter 成功率、超时率、错误分布、外部限流和熔断是否进入观测指标 | 后续必须由 OBS-PLAN-01 复核 |
| mock / fake 共存 | fake adapter 是否只允许本地 / 测试，生产是否必须显式禁用 | 后续必须由环境隔离和配置开关确认 |
| 多 vendor / 多院区 / 多租户 | adapter 是否能按 tenant、connection、vendor、system、院区边界隔离配置和错误 | 后续必须先定义扩展边界 |
| 原始错误透传 | 是否允许 HIS 原始错误进入前端、日志、audit、devlog 或 PR 描述 | 默认不允许 |

## 风险清单

- adapter 直接读取凭证导致职责混乱：adapter 若读取 secret、credentialRef 或 secret manager path，会绕开 credential provider 的生命周期、脱敏和审计边界。
- adapter 与 credential provider 耦合过深：若 adapter 依赖 provider 后端路径、密钥命名或存储实现，后续会难以替换、测试和回滚。
- 真实 HIS endpoint、账号、token、password、API key 或连接串泄露：任何真实地址或认证材料都不得进入文档、日志、audit、DTO、测试快照或 PR 描述。
- 外部 HIS 原始响应进入日志、audit、DTO、devlog 或 PR 描述：厂商认证响应、错误原文、headers、请求体和响应体可能包含敏感业务数据或内部结构。
- 生产环境误用 fake adapter：fake 结果若被生产标记为真实探测，会误导健康状态和运营判断。
- 测试环境误连真实 HIS：测试或本地环境若缺少隔离开关，可能触达真实第三方系统。
- 手动测试连接绕过统一 adapter 边界：route 或 UI 若直接构造请求，会绕过权限、凭证、脱敏、audit 和错误归一。
- scheduled health check 与手动测试连接语义混淆：后台任务若复用人工 actor、人工 action 或手动 reason，会导致审计不可解释。
- retry / fallback / backoff 未定义导致外部请求放大：无上限重试、错误 fallback 或多实例重复执行会打满外部 HIS 或放大失败。
- adapter 错误过度透传导致内部结构暴露：厂商错误、SDK exception、网络错误和 stack 不应进入用户可见响应。
- 多租户 / 多院区配置边界不清：adapter 若不绑定可信 `tenantId + connectionId`，可能跨租户探测或写回错误健康状态。
- system actor / service actor 审计语义不清：后台调用若冒充人工用户，会污染追责和查询语义。
- 将本 plan 误解为 runtime 批准：本文档只复核边界，不批准真实 adapter、外部网络、真实凭证、schema 或 scheduler 实现。

## 后续拆分建议

以下仅为候选项，不自动执行。每个候选项都需要单独 PR、单独任务编号、单独允许文件、单独禁止范围和单独验收口径。任何 runtime 任务都必须在后续获得明确批准后才能进入。

| 候选项 | 目标 | 边界 |
| --- | --- | --- |
| HIS adapter contract plan | 定义 adapter 输入、输出、稳定 provider code、错误分类和调用方责任 | 只写 contract 边界，不写实现代码，不发起外部网络请求 |
| adapter / credential provider dependency boundary plan | 定义 provider 与 adapter 的单向依赖、材料传递范围和凭证生命周期 | 不读取真实凭证，不定义真实 provider 后端 |
| external network safety plan | 定义出站网络 allowlist、denylist、超时、重定向、响应大小、SSRF 防护和真实测试环境审批 | 不新增 HTTP client，不访问任何外部系统 |
| HIS error normalization plan | 定义外部认证失败、超时、不可达、限流、服务不可用、响应不安全和未知异常的内部错误映射 | 不保存或透传厂商原始错误 |
| adapter audit semantics plan | 定义手动测试连接和 scheduled health check 下的 adapter audit action、reason、actor、source 和查询口径 | 不修改 audit runtime，不新增 schema / migration |
| manual test connection integration plan | 定义手动测试连接如何从 fake provider 切换到真实 adapter 抽象 | 不实现 route / service runtime，不接真实 HIS |
| scheduled health check integration plan | 定义周期健康检查如何依赖 adapter、candidate、system actor、lock / lease / backoff 和 scheduled audit | 不实现 runner / scheduler / cron / queue / worker |
| adapter environment isolation plan | 定义本地、测试、预发、生产的 adapter 启用开关、fake 禁用策略、租户灰度和回滚口径 | 不新增配置文件或环境变量文件 |

建议顺序：

1. 先做 HIS adapter contract plan 与 adapter / credential provider dependency boundary plan，明确输入输出和单向依赖。
2. 再做 external network safety plan 与 adapter environment isolation plan，避免真实外部请求在未审批环境中发生。
3. 然后做 HIS error normalization plan 与 adapter audit semantics plan，锁定错误归一和审计语义。
4. 最后再评估 manual test connection integration plan 与 scheduled health check integration plan 是否具备进入 runtime 的条件。

上述顺序不是开发许可，不得自动创建后续分支、commit、PR 或 runtime 实现。

## 验收标准

- 本 PR 只新增 / 修改文档。
- 无 runtime。
- 无 schema。
- 无真实 HIS 接入。
- 无真实凭证。
- 无外部网络请求。
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
- 需要真实凭证才能继续。
- 需要发起外部网络请求才能继续。
- 需要修改 `src/**` 才能继续。
- 需要修改 `drizzle/**` 才能继续。
- 需要新增 schema / migration 才能继续。
- 需要实现 runtime 才能继续。
- 发现现有文档与本任务边界冲突。
- 无法确认目录或命名规范。
- 需要同时推进其他 Phase 24 后续任务才能继续。
- 发现真实 secret、token、password、API key、连接串或真实 HIS 地址风险。
- 无法完成中文化残留检查。
