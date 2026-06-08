# Phase 24 生产可用性优先级梳理

> 日期：2026-06-08
> 状态：docs-only Plan Mode。本文只做 Phase24-PLAN：生产可用性优先级梳理，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现 runtime，不读取真实凭证，不发起外部网络请求，不接真实 HIS，不新增 runner / scheduler / cron / queue / worker，不修改 provider / adapter runtime，不修改 package / lockfile，不修改 `AGENTS.md` 或 `docs/ai-agent-governance.md`。

## 背景

Phase 23 HIS 测试连接 / 健康检查主线已经 closeout。当前主线已经完成手动测试连接 fake provider 最小闭环、权限 action、route parser / DTO、健康摘要写回、测试连接 audit runtime，并把真实 credential provider、真实 HIS adapter、runner / scheduler、candidate query、scheduled audit、system actor / service actor 等后续能力冻结为 backlog。

AI-GOV-01 已合并，`AGENTS.md` 与 `docs/ai-agent-governance.md` 已进入 `main`，后续 Codex 任务必须先确认日期、阶段、任务编号、基线、工作区状态、允许文件和禁止范围。backlog、devlog、计划文档和总结里的下一步建议，都不是开发许可。

Backlog-Review-01 已合并，Phase 23 后续 backlog 已完成优先级冻结。冻结结论是：真实 credential provider、真实 HIS adapter、外部网络、真实凭证、schema / migration、runner / scheduler、lock / lease / backoff、candidate query、scheduled audit、system actor、监控 / 告警 / 失败重试和生产配置都不得自动进入 runtime。

当前进入 Phase24-PLAN，但本文档不是 Phase 24 runtime，不是实现任务，不是 backlog 开发任务。本文档只回答生产可用性优先级、风险边界和后续拆分建议，不实现任何能力。

## Phase 24 的目标定义

Phase 24 的目标不是继续把 backlog 全部实现，而是先回答以下问题：

1. 哪些能力进入生产前必须具备，并且必须先澄清风险边界。
2. 哪些能力可以继续保持人工触发、fake provider 或只读状态。
3. 哪些能力必须拆成独立 Plan Mode，避免混入一个大 runtime PR。
4. 哪些能力需要 schema / migration 前置审批。
5. 哪些能力需要真实凭证、外部网络、真实 HIS 环境前置审批。
6. 哪些能力必须延后，直到更高优先级的生产安全边界明确。

Phase 24 首轮应优先形成生产可用性门槛，而不是扩大功能面。默认原则是：Phase24-PLAN 不允许任何主题直接 runtime。

## 生产可用性维度

| 维度 | 当前状态 | 主要生产风险 | Phase24-PLAN 判断 |
| --- | --- | --- | --- |
| 租户隔离 | 手动测试连接、健康写回和连接读取均强调 `tenantId + connectionId`；周期候选查询尚未实现 | candidate query、runner 或 adapter 若绕过可信 tenant 来源，会造成跨租户探测或写回 | P0 澄清。后续任何 query / runner / provider / adapter 都必须保留可信 tenant 绑定 |
| 权限边界 | 手动测试连接已有 `open_connection:test_connection`；后台 scheduled 语义尚未落地 | 复用人工权限会混淆手动与系统任务；新增后台 action 可能污染权限模型 | P0 澄清。scheduled action 与人工 access action 是否共用模型需单独评审 |
| audit 完整性 | 手动测试连接 audit 已补齐；scheduled audit、system actor 仍只在 Plan 中 | 后台任务若冒充人工用户或缺少 reason，会导致审计不可解释 | P0 澄清。先复核 actor、action、reason、source 和 query whitelist，再允许 runtime |
| 凭证安全 | 当前仍是 fake / test-only provider，不读取真实凭证 | 明文泄露、secret path 泄露、错误日志泄露、凭证撤销与轮换不可控 | P0 澄清。真实凭证读取必须单独审批，且不得进入 DTO、audit、日志或 devlog |
| 外部网络安全 | 当前 fake provider 不访问网络；真实 HIS adapter 只完成边界规划 | SSRF、不可信重定向、内网访问、无限超时、厂商错误透传、生产系统误触达 | P0 澄清。出站 allowlist、denylist、超时、响应大小和脱敏必须先规划 |
| HIS adapter 错误映射与脱敏 | 已有真实 adapter 测试连接边界规划，尚未 runtime | raw HIS payload、厂商认证响应、endpoint、header、SQL 或 stack 进入用户响应、audit 或日志 | P0 澄清。只允许稳定内部错误码、健康状态和脱敏 provider code |
| 健康检查 runner / scheduler 风险 | 已有 runner / scheduler 边界规划，尚未 runtime | 多实例重复执行、无限循环、运行窗口失控、生产资源消耗、外部系统被打满 | P1 单独 Plan Mode。首期即使 runtime 也只能在明确批准后小步落地 |
| candidate query 范围与跨租户风险 | 已有 candidate query 边界规划，尚未 runtime | 跨租户候选、误选 revoked / paused / deleted 连接、忽略 backoff、返回敏感字段 | P1 单独 Plan Mode。候选输出必须最小化，并与 runner 解耦 |
| lock / lease / backoff | 当前字段不足以证明生产级多实例互斥和失败退避 | 重复探测、失败风暴、旧 run 覆盖新 run、无法恢复 stuck task | P0 / P1 之间。是否需要 schema / migration 必须先做 `SCHEMA-REVIEW-01` |
| schema / migration 风险 | 当前未授权新增 schema / migration；已有历史 operation / queue 概念不可直接复用 | 迁移不可逆、字段语义污染、回滚困难、把 scheduler 需求塞入错误表 | P0 澄清。任何字段、索引、约束、枚举或任务表都必须单独审批 |
| 监控 / 告警 / 失败重试 | 尚未形成生产策略 | 告警噪音、重试风暴、失败不可追踪、人工复核缺位 | P1 单独 Plan Mode。先定义观测指标和失败分级，再讨论 runtime |
| 生产配置与开关 | 当前没有生产级开关策略 | 误开启真实外部探测、环境漂移、租户灰度不可控、回滚不清晰 | P1 单独 Plan Mode。需要全局、租户、source / vendor / system 维度开关 |
| 回滚策略 | 当前 docs-only 任务无需回滚 runtime；后续 runtime 尚无统一回滚策略 | 已写入健康状态、audit、lock 或外部调用后难以恢复 | P1 单独 Plan Mode。每个 runtime PR 必须写清数据回滚和开关回滚 |
| 测试策略 | 当前仅要求 docs-only 验证；后续 runtime 测试尚未拆分 | 无法证明脱敏、租户隔离、错误映射、多实例边界和失败重试安全 | P1 单独 Plan Mode。后续 runtime 必须按风险增加单元、集成和脱敏回归 |

## 优先级分层

分层定义：

- P0：生产前必须澄清，禁止直接 runtime。
- P1：优先单独 Plan Mode。
- P2：可在明确批准后小步 runtime。
- P3：暂缓。

默认原则：Phase24-PLAN 不允许任何主题直接 runtime。

| 优先级 | 主题 | 当前状态 | 生产风险 | 是否需要 schema / migration | 是否需要真实凭证 | 是否需要外部网络 | 是否允许直接 runtime | 推荐下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | 租户隔离与 candidate 范围 | 已有连接读取与健康写回 tenant guard；candidate query 未实现 | 跨租户查询、跨租户写回、后台任务越权 | 可能，取决于 lock / run 记录 | 否 | 否 | 否 | 在 `SCHEDULER-PLAN-01` 或独立 candidate query Plan 中先定义 tenant 来源 |
| P0 | 权限边界与 scheduled action | 手动 action 已有；scheduled action 未落地 | 把后台系统动作放进人工权限模型，或用人工用户冒充系统任务 | 否或很小，先评审类型边界 | 否 | 否 | 否 | `AUDIT-PLAN-01` 复核 action、reason、source 与 query whitelist |
| P0 | audit 完整性与 system actor | 已有 system actor / service actor 规划，runtime 未实现 | audit 无法解释后台执行主体，查询结果误导 | 可能，若 audit event shape 需要扩展 | 否 | 否 | 否 | `AUDIT-PLAN-01` 单独复核 actor 语义和降级方案 |
| P0 | 真实 credential provider | 已有读取边界规划，runtime 未实现 | 凭证泄露、secret path 泄露、provider 错误透传、撤销不可控 | 可能，取决于 credential handle 与 provider 状态记录 | 是 | 可能，若接 secret manager | 否 | `CRED-PLAN-01` 先复核 provider interface、脱敏、错误码、审计和回滚 |
| P0 | 真实凭证读取 | 当前未授权，fake provider 不读取真实凭证 | 明文、token、api key、OAuth、private key 或连接串泄露 | 可能 | 是 | 可能 | 否 | 单独凭证读取审批，明确凭证材料生命周期和禁止落点 |
| P0 | 真实 HIS adapter | 已有测试连接边界规划，runtime 未实现 | 外部调用、厂商错误透传、raw payload 泄露、错误健康写回 | 可能，取决于 adapter 配置和状态记录 | 是 | 是 | 否 | `HIS-ADAPTER-PLAN-01` 复核 allowlist、超时、错误映射、脱敏测试 |
| P0 | 外部网络与真实 HIS 连接 | 当前未授权，fake provider 不访问网络 | SSRF、内网访问、不可信重定向、生产 HIS 误触达 | 视 adapter 与网络策略而定 | 通常是 | 是 | 否 | `NETWORK-PLAN-01` 单独定义出站策略、测试环境和审批条件 |
| P0 | schema / migration | 当前未授权；lock / lease / backoff 可能需要字段 | 迁移不可逆、字段语义错误、回滚困难 | 是 | 否 | 否 | 否 | `SCHEMA-REVIEW-01` 单独评审字段、索引、约束、枚举和回滚 |
| P1 | runner / scheduler / cron / worker | 已有边界规划，runtime 未实现 | 多实例重复执行、无限循环、任务堆积、生产资源消耗 | 可能 | 未来可能 | 未来可能 | 否 | `SCHEDULER-PLAN-01` 复核运行窗口、批次、并发、停止条件 |
| P1 | lock / lease / backoff | 当前字段不足，历史 compensation 概念不可直接复用 | 失败风暴、重复探测、旧 run 覆盖、stuck task 无法恢复 | 高概率需要 | 否 | 否 | 否 | `SCHEMA-REVIEW-01` 与 scheduler 风险一起评审 |
| P1 | candidate query runtime | 已有边界规划，runtime 未实现 | 候选集过大、跨租户、返回敏感字段、误选禁用连接 | 可能，若需要 running / backoff 字段 | 否 | 否 | 否 | 单独 Plan Mode，先确认是否允许 best-effort 单实例 |
| P1 | scheduled audit runtime | 已有边界规划，runtime 未实现 | reason 不完整、query whitelist 不一致、manual / scheduled 混淆 | 否或很小 | 否 | 否 | 否 | `AUDIT-PLAN-01` 先定义稳定 action、reason 和查询行为 |
| P1 | 监控 / 告警 / 失败重试 | 尚未形成策略 | 告警噪音、失败不可追踪、无限重试、人工复核缺位 | 可能 | 否 | 可能 | 否 | `OBS-PLAN-01` 单独定义指标、告警级别、重试和人工处理 |
| P1 | 生产配置与开关 | 尚未形成策略 | 误开启真实探测、租户灰度不可控、环境漂移 | 可能 | 可能 | 可能 | 否 | `CONFIG-PLAN-01` 定义全局、租户和厂商维度开关 |
| P1 | 回滚策略 | 尚未形成 runtime 级回滚口径 | 健康写回、audit、lock、外部调用后的恢复路径不清 | 可能 | 取决于能力 | 取决于能力 | 否 | 每个后续 Plan 必须先写回滚策略，再谈 runtime |
| P1 | 测试策略 | 当前只做 docs-only 验证 | 脱敏、租户隔离、多实例、网络安全和错误映射缺少证明 | 否或随功能决定 | 取决于能力 | 取决于能力 | 否 | 后续每个 P0 / P1 Plan 单独列测试矩阵 |
| P2 | 继续保留手动 fake provider 测试连接 | 已有 runtime 闭环，且不读取真实凭证、不访问网络 | 若误称为真实 HIS 健康状态，会误导生产判断 | 否 | 否 | 否 | 否，本轮不 runtime | 维持现状，只在后续文档中明确“fake / manual”标签 |
| P2 | 只读生产可用性文档收口 | 当前可继续 docs-only | 文档过多但未形成执行入口，可能降低审查效率 | 否 | 否 | 否 | 否，本轮只允许本文档与 devlog | 本 PR 完成后由人工选择一个 P0 / P1 单独任务 |
| P3 | HIS 数据同步、患者 / 预约 / 病历 / 收费拉取 | 不属于当前测试连接主线 | 范围巨大、隐私数据、外部系统、审计和合规风险 | 高概率需要 | 是 | 是 | 否 | 暂缓，等真实 adapter 与网络安全边界完成后再评审 |
| P3 | 多厂商 adapter 批量接入 | 当前尚无首个真实 adapter | 厂商差异、错误映射、测试环境和脱敏矩阵爆炸 | 可能 | 是 | 是 | 否 | 暂缓，先评审单一 adapter 的最小生产边界 |

## 推荐任务拆分

以下任务池只是后续候选，不自动执行。每个任务都必须由人工单独确认任务编号、范围、允许文件、禁止范围和停止条件。

1. `CRED-PLAN-01`：真实 credential provider runtime 前置边界复核。
2. `HIS-ADAPTER-PLAN-01`：真实 HIS adapter 接入边界复核。
3. `SCHEDULER-PLAN-01`：周期健康检查 runner / scheduler 风险复核。
4. `SCHEMA-REVIEW-01`：lock / lease / backoff 是否需要 schema 的单独评审。
5. `AUDIT-PLAN-01`：scheduled audit / system actor 审计语义复核。
6. `NETWORK-PLAN-01`：外部网络与真实 HIS 连接安全边界。
7. `OBS-PLAN-01`：监控 / 告警 / 失败重试策略。
8. `CONFIG-PLAN-01`：生产配置与开关策略。

建议优先顺序：

1. 先做 `CRED-PLAN-01` 与 `HIS-ADAPTER-PLAN-01`，确认真实凭证和真实外部探测的最小安全边界。
2. 再做 `NETWORK-PLAN-01`，把出站网络、真实测试环境、SSRF 防护和错误脱敏作为独立审批。
3. 然后做 `AUDIT-PLAN-01` 与 `SCHEMA-REVIEW-01`，避免 scheduled audit、system actor、lock / lease / backoff 在 runtime 中临时补洞。
4. 最后再评估 `SCHEDULER-PLAN-01`、`OBS-PLAN-01`、`CONFIG-PLAN-01` 是否具备进入小步 runtime 的条件。

上述顺序不是开发许可。任何后续任务都不得因为出现在本文档中而自动创建分支、commit、PR 或 runtime 实现。

## 明确禁止

1. Phase24-PLAN 不自动进入 runtime。
2. devlog 下一步建议不自动执行。
3. Plan 中出现能力名称不代表允许实现。
4. schema / migration 必须单独审批。
5. 真实凭证必须单独审批。
6. 外部网络请求必须单独审批。
7. runner / scheduler 必须单独审批。
8. provider / adapter runtime 必须单独审批。
9. 不得把多个 P0 / P1 主题混成一个 runtime PR。
10. 不得修改 `src/**`、`drizzle/**`、`AGENTS.md`、`docs/ai-agent-governance.md`、`docs/superpowers/specs/**`、`docs/roadmap/**`、`README.md`、package 或 lockfile。
11. 不得读取真实凭证、环境变量密钥、API Key、OAuth token 或 Webhook 签名。
12. 不得发起外部网络请求或真实 HIS 对接。
13. 不得新增 runner、scheduler、cron、queue、worker 或后台常驻进程。
14. 不得把 fake provider 当前健康结果描述为真实 HIS 生产探测。

## 本轮未做

本轮未做以下事项：

- 未修改 `src/**`。
- 未修改 `drizzle/**`。
- 未修改 `AGENTS.md`。
- 未修改 `docs/ai-agent-governance.md`。
- 未修改 `docs/superpowers/specs/**`。
- 未修改 `docs/roadmap/**` 或 `README.md`。
- 未修改 package 或 lockfile。
- 未新增 schema / migration。
- 未实现任何 runtime。
- 未读取真实凭证。
- 未发起外部网络请求。
- 未接真实 HIS adapter。
- 未新增 runner、scheduler、cron、queue 或 worker。
- 未自动执行后续候选任务。

## 验证口径

本轮只做 docs-only 验证：

- 确认 diff 只包含本文档与当天 devlog。
- 确认禁止范围检查无命中。
- 确认本轮新增 / 修改文档无英文模板残留。
- 允许全目录固定检查命中历史旧文档，但不得把历史清理混入本 PR。
- 不运行完整 build、tests 或 typecheck。
