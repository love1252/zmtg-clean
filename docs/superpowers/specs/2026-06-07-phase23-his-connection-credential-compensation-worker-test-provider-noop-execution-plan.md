# Phase 23 HIS 连接配置凭证补偿 worker test-only provider 与 no-op execution 边界规划

> 日期：2026-06-07
> 状态：docs-only Plan Mode。本文只规划 Phase 23 HIS 连接配置凭证补偿 worker test-only provider / no-op execution 职责边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不新增 API route，不修改 service，不修改 parser / DTO，不修改 provider / storage，不修改权限，不修改 audit domain / reason / query whitelist，不修改 audit repository，不实现 provider runtime，不调用真实 provider，不接真实 HIS adapter，不做测试连接，不处理真实凭证，不实现 compensation audit，不新增 runner / scheduler。

## 只读盘点结论

1. 当前 worker 已足够支撑后续 provider execution 编排入口：它已能按可信 `tenantId` 读取 due job、claim、写入 job running、推进 operation running，并提供 expired lock 与 stale running operation 的保守 recovery 入口。
2. 当前 operation repository 足够支撑 provider success / failure / manual review 收口：它已有 running、succeeded、failed、manual review、retry count 与 stale running 查询。
3. 当前 job queue repository 足够支撑 provider success / failure / manual review 收口：它已有 claimed、running、succeeded、failed、requeue、dead letter、manual review，以及 `claimId + claimVersion` 写回保护。
4. 可以先只做 test-only provider / no-op execution Plan Mode。
5. 可以不实现 provider runtime。
6. 可以不接真实 provider。
7. 可以不处理真实凭证。
8. 可以不写 audit。
9. 可以不新增 runner / scheduler。
10. 必须另开实现 PR：test-only provider / no-op runtime、completion runtime、retry / backoff runtime、compensation audit integration、service 接入、runner / scheduler、observability、真实 provider、真实 HIS adapter、外部密钥管理系统与测试连接。

## 背景与当前状态

Phase 23 HIS 连接配置凭证补偿链路已经完成以下基础：

- compensation operation metadata 与 operationId schema 最小边界。
- operation repository 最小边界。
- job queue schema / migration 最小边界。
- job queue repository 最小边界。
- worker claim / lock / stale recovery runtime 最小边界。

当前 worker 已经可以把 due job 安全推进到 running，但仍没有 provider execution。下一步若直接接真实 provider，会同时引入外部副作用、凭证处理、测试连接、审计和重试策略，风险过大。因此后续应先用 test-only provider / no-op execution 验证 worker completion 编排，不接触真实外部系统，也不处理真实凭证。

## 目标

本轮目标是为后续 test-only provider / no-op execution 实现 PR 规定职责边界：

- 明确 test-only provider / no-op execution 只验证 worker completion 编排。
- 明确 provider result 的稳定分类。
- 明确 success、retryable failure、unsafe unknown、validation failed、provider unavailable、timeout 与 repository error 的收口策略。
- 明确 job state 与 operation state 的对齐方式。
- 明确 `claimId` / `claimVersion` 写回边界。
- 明确 transaction / consistency 边界，尤其是 provider 调用不得在长事务内。
- 明确 audit、tenant isolation、敏感信息禁区和 observability 边界。
- 明确测试拆分建议与后续 PR 拆分建议。

## 非目标

本轮明确不做：

- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不新增 schema / migration。
- 不新增 API route。
- 不修改 service。
- 不修改 parser / DTO。
- 不修改 provider / storage。
- 不修改权限。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不实现 provider runtime。
- 不调用真实 provider。
- 不接真实 HIS adapter。
- 不实现测试连接。
- 不处理真实凭证。
- 不接外部密钥管理系统。
- 不实现 compensation audit。
- 不新增 runner / scheduler / cron。
- 不新增后台常驻进程。
- 不修改 package、lockfile、`.env` 或 `.codex`。

## 当前已完成能力

worker 编排层已完成：

- `claimDueCredentialCompensationJobs` 按可信 `tenantId` 读取 due job。
- claim 成功后使用 repository 返回的 `claimId + claimVersion` 写回 job running。
- job running 成功后推进 operation running。
- expired claimed job 保守 skipped，不自动重复执行。
- expired running job 进入 manual review 分流。
- stale running operation 找不到 job 或无法安全判断时进入 manual review 分流。
- worker result 只返回稳定状态。

operation repository 已完成：

- create / get。
- running / succeeded / failed / manual review 状态流转。
- retry count 递增。
- pending 与 stale running 查询。
- 可信 `tenantId + connectionId + operationId` 绑定。
- 稳定 repository result。

job queue repository 已完成：

- create / get。
- due list。
- claim / lock。
- running / succeeded / failed。
- requeue。
- dead letter。
- manual review。
- expired lock 查询。
- `claimId + claimVersion` 乐观写回保护。
- 稳定 repository result。

## 当前缺口

当前缺口集中在 provider execution 与 completion：

- 没有 provider execution 抽象接入 worker。
- 没有 test-only provider / no-op execution。
- 没有 provider result 稳定分类 mapper。
- 没有 success 后 job + operation 双写收口。
- 没有 retryable failure 后 failed 收口与 retry runtime 拆分。
- 没有 unsafe unknown 后 manual review 收口。
- 没有 validation failed 的 provider 前置阻断。
- 没有 timeout 与 provider unavailable 的稳定处理。
- 没有 compensation audit integration。
- 没有 runner / scheduler。
- 没有 observability / safe logging 实现。

## test-only provider 与 no-op execution 职责

test-only provider / no-op execution 应负责：

- 只在测试或受控开发路径中返回稳定 provider result。
- 不访问真实外部系统。
- 不读取或处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不保存外部系统交互内容。
- 用稳定分类驱动 worker completion 分支。
- 允许测试覆盖 success、retryable_failure、unsafe_unknown、validation_failed、provider_unavailable、timeout 和 repository_error。

test-only provider / no-op execution 不应负责：

- 不生成真实连接。
- 不验证真实连接可用性。
- 不执行真实清理、撤销、轮换或同步动作。
- 不写 job queue。
- 不写 operation。
- 不写 audit。
- 不决定 runner / scheduler 节奏。
- 不做 backoff 计算。

## worker 与 provider execution 职责边界

worker 应负责：

- 从 job queue claim due job。
- 把 job 与 operation 推进到 running。
- 在 provider 调用完成后，根据稳定 provider result 推进 job 与 operation。
- 对旧 claim 写回返回稳定失败。
- 对不可安全自动处理的结果进入 manual review。
- 保证 provider 调用不在长事务内。
- 只记录安全摘要。

provider execution 应负责：

- 接收 worker 提供的安全上下文。
- 返回稳定 provider result。
- 不直接写 repository。
- 不直接写 audit。
- 不记录或返回外部系统交互内容。
- 不暴露内部定位细节。

## provider result 稳定分类

建议后续实现只接受以下稳定分类：

| 分类 | 含义 | worker 收口 |
| --- | --- | --- |
| `success` | no-op 或 test-only provider 明确完成 | job succeeded，operation succeeded |
| `retryable_failure` | 可重试失败 | job failed，operation failed；retry / requeue 另开 PR |
| `unsafe_unknown` | 结果未知或自动处理不安全 | job manual review，operation manual review |
| `validation_failed` | provider 前置输入不满足安全要求 | 返回稳定结果，不调用 provider，不写 audit |
| `provider_unavailable` | provider 执行入口不可用 | job failed，operation failed；是否 requeue 另开 PR |
| `timeout` | provider 执行超时 | 优先 manual review，除非后续 PR 证明可安全重试 |
| `repository_error` | repository 写回失败 | 返回稳定 repository failure，由 recovery 兜底 |

分类约束：

- 不允许 provider 返回任意字符串。
- 不允许把外部系统原始信息塞进分类。
- 不允许把内部异常细节塞进分类。
- 不允许把分类直接映射为真实 provider 行为。

## success 收口策略

`success` 的推荐收口：

- provider 不在长事务内执行。
- provider 返回 `success` 后，worker 调用 job succeeded 写回。
- job succeeded 成功后，worker 调用 operation succeeded 写回。
- 任一步 repository 返回 conflict、not_found、invalid_state_transition、validation_failed 或 repository_error 时，worker 返回稳定结果，由后续 recovery 或 manual review 兜底。
- 本阶段不写 audit。
- 本阶段不接真实 provider。

## retryable failure 收口策略

`retryable_failure` 的推荐收口：

- worker 调用 job failed。
- job failed 成功后，worker 调用 operation failed。
- retry / requeue runtime 另开 PR。
- 本 PR 不实现 backoff。
- 本 PR 不自动 dead letter。
- 本 PR 不保存外部系统交互内容。

## unsafe unknown 收口策略

`unsafe_unknown` 的推荐收口：

- worker 调用 job manual review。
- job manual review 成功后，worker 调用 operation manual review。
- 不重试。
- 不自动 dead letter。
- 不保存外部系统交互内容。
- 不在自动流程中重复 provider 动作。

## validation failed 收口策略

`validation_failed` 的推荐收口：

- 在 provider 调用前返回稳定结果。
- 不调用 provider。
- 不写 audit。
- 不修改 job 与 operation，除非后续实现 PR 明确要把该结果收敛到 manual review。
- 不保存外部输入细节。

## provider unavailable 与 timeout 收口策略

`provider_unavailable` 的推荐收口：

- 先收敛为 job failed 与 operation failed。
- 是否 requeue 由 retry runtime PR 处理。
- 不把 provider 不可用细节写入持久化记录。

`timeout` 的推荐收口：

- 若无法证明 provider 未产生副作用，进入 manual review。
- 若后续 test-only provider 能证明 no-op 无副作用，可在实现 PR 中把 timeout 作为可重试失败处理，但必须有测试覆盖。
- 不自动重复执行。

## job state 与 operation state 对齐

推荐对齐关系：

| provider result | job state | operation state |
| --- | --- | --- |
| `success` | `succeeded` | `compensation_succeeded` |
| `retryable_failure` | `failed` | `compensation_failed` |
| `unsafe_unknown` | `manual_review_required` | `manual_review_required` |
| `validation_failed` | 不自动推进 | 不自动推进 |
| `provider_unavailable` | `failed` | `compensation_failed` |
| `timeout` | `manual_review_required` 或 `failed` | `manual_review_required` 或 `compensation_failed` |
| `repository_error` | 保持 repository 实际状态 | 保持 repository 实际状态 |

对齐约束：

- job 与 operation 双写不能假设原子完成。
- 任一步失败都必须返回稳定结果。
- recovery 负责处理 job 与 operation 之间的暂时不一致。
- 不允许 provider 直接推进 job 或 operation。

## claimId 与 claimVersion 写回边界

写回要求：

- provider execution 只能在 claim 成功且 job running 成功后发生。
- worker 必须使用 repository 返回的 `claimId + claimVersion` 写回 job completion。
- 旧 claim 的迟到写回必须返回 conflict 或稳定失败。
- operation repository 不持有 claim 信息。
- worker 必须用同一组 `tenantId + connectionId + operationId` 绑定 job 与 operation。
- requeue、dead letter、manual review 等后续 runtime 仍必须携带 claim 信息。

## transaction 与 consistency 边界

一致性建议：

- claim 是短事务。
- job running 写回是短事务。
- operation running 写回是短事务。
- provider 调用不得在长事务内。
- completion 阶段的 job 写回与 operation 写回可以顺序执行，由 recovery 兜底。
- audit integration 另开 PR 后再决定是否与状态推进组合。

不得做：

- 不在 repository 内调用 provider。
- 不在 provider 内写 repository。
- 不把外部动作放进数据库长事务。
- 不用单次长事务包住 claim、running、provider execution 与 completion。

## audit 边界

本轮不实现 compensation audit。

后续 audit integration 应遵守：

- audit 写入职责放在 worker 或 compensation domain/service 的状态推进处。
- operation repository 不写 audit。
- job queue repository 不写 audit。
- provider 不写 audit。
- HTTP route 不写 worker completion audit。
- audit 写入失败后的处理策略必须单独规划。
- 不新增未经评审的 audit action / reason / result。

## 租户隔离

租户隔离要求：

- worker 每次扫描都必须绑定可信 `tenantId`。
- 每条 job 与 operation 写回都必须绑定 `tenantId + connectionId + operationId`。
- provider execution 只能接收 worker 已验证的安全上下文。
- 不接受外部输入切换 tenant scope。
- cross tenant 或 cross connection 写回应返回稳定失败。
- 日志不得扩大 tenant 数据可见性。

## 敏感信息禁区

文档、日志、audit metadata、job、operation、manual review read model 中不得新增或展示：

- 真实认证材料。
- 可直接访问外部系统的密钥类材料。
- 外部系统交互原文。
- 外部系统错误原文。
- 内部密钥定位信息。
- 内部数据库连接细节。
- 内部异常调用细节。
- 可用于重放外部动作的材料。
- 未经白名单审查的载荷。

## observability 与 safe logging

建议记录：

- worker run id。
- tenant scope。
- operationId。
- job state。
- operation state。
- claimVersion。
- provider result 稳定分类。
- repository result 稳定分类。
- retryCount 与 maxRetryCount。
- manual review 或 dead letter 分流数量。

禁止记录：

- 真实认证材料。
- 外部系统交互原文。
- 外部系统错误原文。
- 内部密钥定位信息。
- 内部数据库连接细节。
- 内部异常调用细节。
- provider 内部定位细节。

## 测试拆分建议

test-only provider / no-op execution 实现 PR 建议覆盖：

- provider 返回 `success` 后 job succeeded + operation succeeded。
- provider 返回 `retryable_failure` 后 job failed + operation failed。
- provider 返回 `unsafe_unknown` 后 job manual review + operation manual review。
- provider 返回 `validation_failed` 时不调用 provider runtime，不推进 job / operation。
- provider 返回 `provider_unavailable` 后稳定 failed 收口。
- provider 返回 `timeout` 后进入 manual review 或稳定 failed，取决于实现 PR 的安全证明。
- repository 写回 conflict 时返回稳定结果。
- repository_error 时不泄露内部细节。
- 旧 claim 写回被拒绝。
- provider 调用不在长事务内。

## 后续 PR 拆分建议

建议后续拆分：

1. test-only provider / no-op execution 最小实现。
2. completion runtime 测试补强。
3. retry / requeue / backoff runtime。
4. dead letter / manual review runtime。
5. compensation audit integration。
6. service 接入 operation + job queue 创建。
7. runner / scheduler。
8. observability / safe logging。
9. 真实 provider / 真实 HIS adapter / 测试连接 Plan Mode。
10. 外部密钥管理系统 Plan Mode。

## 必须另开实现 PR 的内容

必须另开实现 PR：

- provider runtime。
- test-only provider / no-op execution runtime。
- success completion runtime。
- retryable failure completion runtime。
- unsafe unknown manual review runtime。
- retry / requeue / backoff runtime。
- dead letter runtime。
- compensation audit integration。
- service 接入 operation + job queue 创建。
- runner / scheduler / cron。
- observability / safe logging 实现。

必须另开 Plan Mode 或独立实现 PR：

- 真实 provider。
- 真实 HIS adapter。
- 测试连接。
- 外部密钥管理系统。
- 真实凭证处理。
- 人工处置 API。
- 人工处置 UI。
- 新 schema / migration。
- 新权限。
- 新 audit action / reason / result。

## Plan Mode 判定

本轮满足 Plan Mode 条件：

- 已完成 worker、operation repository 与 job queue repository 只读盘点。
- 现有 worker 已足够进入 provider execution 边界规划。
- 现有 operation repository 与 job queue repository 已足够支撑 success / failure / manual review 收口规划。
- 可以只新增 / 更新中文文档。
- 可以不修改 `src/**`。
- 可以不修改 `drizzle/**`。
- 可以不实现 provider runtime。
- 可以不调用真实 provider。
- 可以不处理真实凭证。
- 可以不写 audit。
- 可以不新增 runner / scheduler。
