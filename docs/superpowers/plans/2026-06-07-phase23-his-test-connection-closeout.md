# Phase 23 HIS 测试连接 / 健康检查主线收口与 backlog 冻结

> 日期：2026-06-07
> 状态：docs-only 收口文档。本文用于冻结 Phase 23 HIS 测试连接 / 健康检查主线边界，不继续自动拆分 TC-12C / TC-12D / TC-12E，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现任何 runtime，不读取真实凭证，不接真实 HIS adapter，不发起外部网络请求，不新增 route / service / provider / adapter runtime，不回到 compensation / recovery runtime，不修改 package / lockfile。

## 收口结论

Phase 23 不再继续追加 TC-12C / TC-12D / TC-12E 等铺路型任务。

收口理由：

1. 当前测试连接主线已具备 fake provider 最小闭环。
2. 权限、DTO、健康写回、audit 已形成基础链路。
3. 真实 provider / adapter / runner / scheduler 都属于下一阶段能力。
4. 继续拆分会导致 PR 数过多，降低项目收口效率。
5. 后续必须转入 backlog 管理，不再自动执行。

## Phase 23 已完成能力总览

1. Phase23-TC-01 到 Phase23-TC-05：完成测试连接边界、权限、audit、route parser、DTO 规划，并完成 `open_connection:test_connection` 权限 action 最小实现。
2. Phase23-TC-06：完成健康状态 repository 写回边界规划。
3. Phase23-TC-07：完成 fake provider service 边界规划。
4. Phase23-TC-07A：完成健康状态 repository 写回最小 runtime。
5. Phase23-TC-08：完成 fake provider route runtime 最小实现，形成手动测试连接 fake provider 闭环。
6. Phase23-TC-09：完成测试连接 audit runtime，补齐测试连接专用 action、reason 与 audit 写入。
7. Phase23-TC-10：完成真实 credential provider 读取边界规划。
8. Phase23-TC-11：完成真实 HIS adapter 测试连接边界规划。
9. Phase23-TC-12：完成周期健康检查 runner / scheduler 边界规划。
10. Phase23-TC-12A：完成周期健康检查 candidate query 与 audit action / reason 边界规划。
11. Phase23-TC-12B：完成 system actor / service actor 审计上下文边界规划。

## 当前已经可用的能力边界

当前已具备的实际 runtime 能力：

1. 已有 `open_connection:test_connection` 权限 action。
2. 已有 `POST /api/institution/his-connections/[connectionId]/test-connection` fake provider route runtime。
3. 已有 route parser / DTO 安全边界：route 只接受 path `connectionId` 与空 JSON body，不接受前端传入 provider result、健康状态、凭证或 endpoint。
4. 已有健康状态 repository 写回：写回绑定 `tenantId + connectionId`，只写健康摘要字段。
5. 已有测试连接 audit runtime：记录请求、provider result、非 active、not found、repository write failed 和 completed 等稳定 reason。
6. 已有健康状态枚举：
   - `unknown`
   - `healthy`
   - `degraded`
   - `failed`
7. 已有安全 DTO 字段：
   - `ok`
   - `code`
   - `error`
   - `healthStatus`
   - `checkedAt`

当前 fake provider 闭环的安全边界：

1. fake provider 输入由服务端 service 构造。
2. fake provider 只读取非敏感连接摘要与 `credentialConfigured` 布尔值。
3. fake provider 不读取真实凭证。
4. fake provider 不读取环境变量。
5. fake provider 不访问网络。
6. fake provider 不接 secret manager / KMS / Vault。
7. fake provider 输出只包含安全 provider code、健康状态、错误码和检查时间。
8. route 输出不包含 credentialRef、endpoint、header、token、raw HIS payload、SQL 或 stack。

## 当前明确没有实现的能力

以下能力没有实现，且不属于 Phase 23 继续执行范围：

1. 真实 credential provider runtime。
2. 真实凭证读取。
3. secret manager / KMS / Vault 接入。
4. 真实 HIS adapter runtime。
5. 外部 HIS 网络请求。
6. 周期健康检查 candidate query runtime。
7. `scheduled_health_check` audit action runtime。
8. system actor runtime。
9. durable lock / lease / backoff schema。
10. runner runtime。
11. scheduler runtime。
12. cron / queue / worker。
13. Webhook / 同步任务。
14. 患者 / 预约 / 病历 / 收费数据同步。
15. compensation / recovery 扩展 runtime。

## Phase 24 / 后续 backlog 冻结

以下内容列为 backlog，不自动执行：

1. 真实 credential provider interface runtime。
2. server-only credential handle resolver runtime。
3. secret manager / KMS / Vault adapter 规划。
4. real HIS adapter interface runtime。
5. 单厂商 real adapter 最小 runtime。
6. 真实 adapter route / service 切换规划。
7. `scheduled_health_check` audit action / reason runtime。
8. system actor / service actor runtime。
9. candidate query runtime。
10. durable lock / lease / backoff schema。
11. 单实例 runner runtime。
12. scheduler trigger 规划。
13. scheduler trigger runtime。
14. 多实例 runner / scheduler observability。
15. HIS 数据同步相关任务。

这些 backlog 不自动执行，必须经人工确认后单独开任务。

冻结说明：

1. backlog 只表达未来可能方向，不代表下一 PR。
2. backlog 不等于授权实现。
3. backlog 不得被 Codex 自动转化为分支、commit 或 PR。
4. 真实凭证、真实 adapter、外部网络、schema / migration、runner / scheduler 必须单独审批。
5. 若人工未确认具体任务编号和边界，默认不进入开发。

## 后续 PR 数量控制建议

1. 后续不再按 Plan 自动衍生任务。
2. 每个后续任务必须先人工确认。
3. docs-only PR 原则上最多 2-3 个文档文件。
4. runtime PR 原则上最多 3-5 个核心文件。
5. 超过范围必须停止并回报。
6. PR #220 左右如需阶段性结束，应优先选择高价值生产可用性任务，不再做铺路型 Plan 链。

## AI 过度开发防护规则

1. Codex 不得自动执行 devlog 中的下一步建议。
2. Codex 不得因为 Plan 中出现某能力就顺手实现该能力。
3. 每个 PR 只能完成当前任务。
4. 任何 schema / migration 必须单独审批。
5. 任何真实凭证读取必须单独审批。
6. 任何外部网络请求必须单独审批。
7. 任何 runner / scheduler / worker 必须单独审批。
8. 任何新增 provider / adapter runtime 必须单独审批。
9. 如果任务需要超过范围，应停止并回报。
10. 若下一步不清楚，默认不要开发，只回报判断。

## 冻结后的执行规则

1. 不继续 Phase23-TC-12C。
2. 不继续 Phase23-TC-12D。
3. 不继续 Phase23-TC-12E。
4. 不以“前置能力尚未完成”为理由继续拆 docs-only PR。
5. 不以“Plan 已经写了”为理由自动进入 runtime。
6. 不把真实 credential provider、真实 HIS adapter、runner 或 scheduler 混入一个 PR。
7. 不把 schema / migration 与 runtime 混入同一个未经确认的 PR。
8. 不从前端请求、devlog 或 Plan 文本推断真实凭证读取授权。
9. 不发起外部 HIS 网络请求。
10. 不回到 compensation / recovery runtime 链路。

## 下一步建议

1. 先暂停 Phase 23 继续拆分。
2. 后续进入 Phase 24 / 生产可用性优先级梳理。
3. 可单独新增 AI Agent Governance / AGENTS.md，用于固化 Codex 防过度开发规则。
