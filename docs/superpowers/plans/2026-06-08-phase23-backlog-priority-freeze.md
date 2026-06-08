# Phase 23 后续 backlog 优先级冻结

> 日期：2026-06-08  
> 状态：docs-only Plan Mode。本文只做 Phase 23 后续 backlog 优先级冻结与任务边界整理，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现 runtime，不读取真实凭证，不发起外部网络请求，不接真实 HIS，不新增 runner / scheduler / cron / queue / worker，不修改 package / lockfile，不修改治理规则。

## 背景

Phase 23 HIS 测试连接 / 健康检查主线已经 closeout。当前主线已从权限、fake provider route、DTO / parser、健康写回和 audit 收口到明确的后续 backlog，不再继续自动拆分 TC-12C / TC-12D / TC-12E。

AI-GOV-01 已合并，`AGENTS.md` 与 `docs/ai-agent-governance.md` 已进入 `main`。因此后续任务必须先确认日期、阶段、任务编号、基线、工作区状态和禁止范围；backlog、devlog 与计划文档中的后续建议都不是开发许可。

本文档不是 Phase 24 runtime，不是实现真实 credential provider、真实 HIS adapter、runner、scheduler、lock、lease、backoff 或外部网络连接。本文档只冻结 Phase 23 后续 backlog 的优先级、风险和审批边界，帮助后续人工选择下一步。

## Phase 23 已完成能力摘要

Phase 23 已完成以下主线能力或边界规划：

1. 测试连接权限 action：已建立 `open_connection:test_connection` 权限动作。
2. fake provider route：已形成手动测试连接 fake provider 最小闭环。
3. DTO / parser 边界：route 只接受 path `connectionId` 与空 JSON body，输出安全 DTO。
4. 健康写回：已完成健康摘要 repository 写回，写回绑定 `tenantId + connectionId`。
5. 测试连接 audit：已补齐测试连接专用 action、reason 与 audit 写入。
6. 真实 credential provider Plan：已完成服务端内部凭证读取边界规划。
7. 真实 HIS adapter Plan：已完成真实 adapter 测试连接边界规划。
8. runner / scheduler Plan：已完成周期健康检查 runner / scheduler 边界规划。
9. candidate query / scheduled audit Plan：已完成候选查询与 scheduled audit action / reason 边界规划。
10. system actor / service actor audit context Plan：已完成后台系统主体审计上下文边界规划。
11. Phase 23 closeout：已冻结继续拆分，后续进入 backlog 管理。

## backlog 项清单

以下候选项全部冻结为 backlog，不自动执行：

1. 真实 credential provider runtime。
2. 真实 HIS adapter runtime。
3. candidate query runtime。
4. scheduled audit runtime。
5. system actor / service actor runtime 相关落地。
6. runner / scheduler / cron / worker。
7. lock / lease / backoff。
8. schema / migration。
9. 外部网络请求 / 真实 HIS 连接。
10. 真实凭证读取。
11. 生产配置。
12. 监控 / 告警 / 失败重试策略。

冻结原则：

- 不允许任何 backlog 直接 runtime。
- backlog 只表达未来可能方向，不代表下一 PR。
- backlog 不得被 Codex 自动转化为分支、commit 或 PR。
- 任何真实凭证、真实 adapter、外部网络、schema / migration、runner / scheduler 都必须单独审批。

## 优先级分层

| 优先级 | backlog 名称 | 当前状态 | 风险 | 是否需要 schema / migration | 是否需要外部网络 | 是否需要真实凭证 | 是否允许直接 runtime | 推荐下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | 真实 credential provider runtime | 已有读取边界规划，尚未实现 | 凭证泄露、错误日志、越权读取、provider 不可用 | 可能，需要先评估 credential handle 与存储边界 | 否，除非接真实 secret manager | 是 | 否 | `CRED-PLAN-01` 先复核 provider interface、脱敏、错误码和审计边界 |
| P0 | 真实 HIS adapter runtime | 已有测试连接边界规划，尚未实现 | 出站网络、SSRF、厂商错误透传、raw payload 泄露 | 可能，需要确认连接元数据是否足够 | 是 | 是 | 否 | `HIS-ADAPTER-PLAN-01` 先复核 allowlist、超时、错误映射和脱敏测试 |
| P0 | 外部网络请求 / 真实 HIS 连接 | 仅规划，未授权 runtime | 触达真实第三方系统、网络安全、生产影响、审计不足 | 视 adapter 与连接配置而定 | 是 | 通常是 | 否 | 先做出站策略与真实测试环境审批 |
| P0 | 真实凭证读取 | 仅规划，未授权读取 | 凭证明文、token、secret path、密钥轮换和撤销风险 | 可能 | 取决于 secret manager | 是 | 否 | 先做凭证读取审批与 secret manager 选择评审 |
| P0 | schema / migration | 已识别 lock / lease / backoff 等可能需要字段 | 数据结构不可逆、生产迁移、回滚复杂 | 是 | 否 | 否 | 否 | `SCHEMA-REVIEW-01` 单独评审字段、索引、约束和回滚 |
| P1 | runner / scheduler / cron / worker | 已有 runner / scheduler 边界规划，未实现 | 后台任务失控、重复执行、多实例竞争、生产资源消耗 | 可能，需要 lock / lease / run 记录 | 未来可能 | 未来可能 | 否 | `SCHEDULER-PLAN-01` 先复核单实例、批次、并发、停止条件 |
| P1 | lock / lease / backoff | 已在 TC-12 / TC-12A 中列为生产级缺口 | 多实例重复探测、失败风暴、无法恢复或无法回滚 | 是，概率高 | 否 | 否 | 否 | `SCHEMA-REVIEW-01` 与 runner 风险一起评审 |
| P1 | system actor / service actor runtime 相关落地 | 已有审计上下文规划，当前类型不支持一等 system actor | 冒充人工用户、权限模型污染、audit 查询混淆 | 可能，需要看 audit 事件形状是否扩展 | 否 | 否 | 否 | 单独 Plan Mode 评审 actor 类型、source、action 与 query whitelist |
| P1 | scheduled audit runtime | 已有 action / reason 边界规划，尚未修改 audit runtime | audit action 污染权限模型、reason 白名单不完整、查询误导 | 否或很小，先按现有 audit 模型评估 | 否 | 否 | 否 | 单独 Plan Mode 复核 action、reason、query whitelist 和测试范围 |
| P1 | candidate query runtime | 已有候选查询边界规划，尚未实现 | 跨租户候选、过度筛选、忽略 backoff、返回敏感字段 | 可能，生产级需要 lock / backoff 字段 | 否 | 否 | 否 | 单独 Plan Mode 明确首期是否只允许 best-effort 单实例 |
| P2 | 监控 / 告警 / 失败重试策略 | 仅作为生产可用性候选，未规划细节 | 噪音告警、重试风暴、失败不可追踪 | 可能，需要运行记录或告警状态 | 可能 | 否 | 否 | 放入 `Phase24-PLAN` 做生产可用性优先级梳理 |
| P3 | 生产配置 | 当前没有具体配置方案 | 误开关、环境漂移、生产行为不透明 | 可能 | 可能 | 可能 | 否 | 暂缓，等 credential、adapter、runner 边界明确后再评审 |

优先级含义：

- P0：必须先澄清，不允许直接开发。
- P1：可单独 Plan Mode。
- P2：可在明确批准后 runtime，但当前仍需前置边界。
- P3：暂缓，等待更高优先级结论。

## 推荐下一步

推荐顺序如下：

1. `Phase24-PLAN`：生产可用性优先级梳理。
2. `CRED-PLAN-01`：真实 credential provider runtime 前置边界复核。
3. `HIS-ADAPTER-PLAN-01`：真实 HIS adapter 接入边界复核。
4. `SCHEDULER-PLAN-01`：周期健康检查 runner / scheduler 风险复核。
5. `SCHEMA-REVIEW-01`：lock / lease / backoff 是否需要 schema 的单独评审。

推荐顺序不是开发许可。必须由用户人工确认后，单独开任务、单独确认边界、单独确认允许文件和停止条件。

## 明确禁止

1. backlog 不自动执行。
2. devlog 下一步建议不自动执行。
3. Plan 中出现能力名称不代表允许实现。
4. schema / migration 必须单独审批。
5. 真实凭证必须单独审批。
6. 外部网络请求必须单独审批。
7. runner / scheduler 必须单独审批。
8. provider / adapter runtime 必须单独审批。
9. Phase 24 不得由 Codex 自动开始。
10. 不得把多个 P0 / P1 backlog 混成一个 runtime PR。

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
- 未创建 runner、scheduler、cron、queue 或 worker。

## 验证口径

本轮只做 docs-only 验证：

- 确认 diff 只包含本文档与当天 devlog。
- 确认禁止范围检查无命中。
- 确认本轮新增文档无英文模板残留。
- 允许全目录固定检查命中历史旧文档，但不得把历史清理混入本 PR。
