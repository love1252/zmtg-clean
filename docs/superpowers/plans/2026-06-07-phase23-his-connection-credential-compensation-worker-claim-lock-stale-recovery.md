# Phase 23 HIS 连接配置凭证补偿 worker claim lock 与 stale recovery 后续拆分计划

> 日期：2026-06-07
> 状态：docs-only Plan Mode。本文只给后续实现 PR 提供中文拆分计划，不包含代码步骤，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现 worker runtime，不实现 provider 调用，不实现 stale recovery runtime，不实现 retry runtime，不实现 dead letter / manual review runtime，不实现 compensation audit，不接 service，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

## 本轮只读结论

当前已具备 worker 规划所需的 repository 基础：

- operation repository 已能表达补偿事实状态，并支持 running / succeeded / failed / manual review、retry count 和 stale running 查询。
- job queue schema 已具备 queued / claimed / running / succeeded / failed / dead_lettered / manual_review_required / cancelled、claim / lock、retry、dead letter 和 manual review 字段。
- job queue repository 已能 create、get、list due、claim due、mark running、mark succeeded、mark failed、requeue、mark dead letter、mark manual review 和 list expired locked jobs。
- 当前缺失的是 worker 编排、runner / scheduler、provider 安全执行、stale recovery runtime、retry runtime、audit integration 和 service 接入。

本轮满足 Plan Mode 条件：

- 可以不改 schema / migration。
- 可以不实现 runtime 代码。
- 可以只新增 / 更新文档。
- 后续 worker、service、audit、provider、dead letter / manual review 均应独立拆 PR。

## 后续拆分总览

建议后续至少拆成七个 PR：

1. worker claim / lock / stale recovery runtime 最小实现。
2. worker test-only provider / no-op execution 最小实现。
3. compensation audit integration。
4. service 接入 operation + job queue 创建。
5. retry / dead letter / manual review runtime 最小闭环。
6. observability / safe logging。
7. 真实 provider / secret manager / HIS adapter Plan Mode。

拆分原则：

- claim / lock 先独立闭环，避免与 provider 和 audit 同时引入并发风险。
- provider 执行先使用 test-only provider 或 no-op provider，真实 provider 单独规划。
- audit integration 单独处理 fail closed 与幂等。
- service 接入单独处理事务和返回错误映射。
- dead letter / manual review 单独处理人工处置风险。

## PR 1：worker claim / lock / stale recovery runtime 最小实现

建议范围：

- 新增最小 worker runner 或 worker service。
- 按 tenant scope 调用 `listDueCredentialCompensationJobs`。
- 对 due job 调用 `claimDueCredentialCompensationJob`。
- claim 成功后调用 `markCredentialCompensationJobRunning`。
- job running 成功后调用 `markCredentialCompensationOperationRunning`。
- 对 `conflict`、`invalid_state_transition`、`not_found` 返回稳定处理结果。
- 调用 `listExpiredLockedCredentialCompensationJobs` 发现 stale locked job。
- 调用 `listStaleRunningCredentialCompensationOperations` 发现 stale running operation。
- stale 场景只做安全分流，不重复 provider 动作。

禁止范围：

- 不接真实 provider。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不写 compensation audit。
- 不接 service。
- 不新增 API route。
- 不新增 schema / migration。

关键验收：

- worker 只有 claim 成功后才推进 operation running。
- 旧 claim 写回被 repository 拒绝。
- active lock 不被抢占。
- expired lock 可以被重新 claim。
- stale running 且副作用未知时进入 manual review 路径规划，不自动重复执行。

## PR 2：worker test-only provider / no-op execution 最小实现

建议范围：

- 为 worker 接入 test-only provider 或 no-op provider。
- provider 返回稳定分类结果：success、retryable failure、unknown / unsafe。
- provider 调用不在长事务内。
- success 后 job succeeded + operation succeeded。
- retryable failure 后 job failed + operation failed。
- unknown / unsafe 后 job manual review + operation manual review。

禁止范围：

- 不接真实 provider。
- 不接真实 secret manager。
- 不接真实 HIS adapter。
- 不做测试连接。
- 不处理真实凭证。
- 不保存外部系统原始交互内容。

关键验收：

- provider success 收口为 succeeded。
- retryable failure 收口为 failed。
- unknown / unsafe 收口为 manual review。
- provider 不直接写 job、operation 或 audit。

## PR 3：compensation audit integration

建议范围：

- 在 worker 或 compensation domain/service 的状态推进处写 audit。
- 明确 running、succeeded、failed、dead letter、manual review 的 reason / result 映射。
- 明确 audit 写入失败时 fail closed、retry、dead letter 或 manual review 的策略。
- 保证同一 operation 状态推进不重复写 audit。

禁止范围：

- 不由 operation repository 写 audit。
- 不由 job queue repository 写 audit。
- 不由 provider 写 audit。
- 不由 HTTP route 写 worker 状态推进 audit。
- 不在本 PR 临时新增未经评审的 audit reason / action。

关键验收：

- audit 写入职责集中在编排层。
- audit 失败不会泄露内部错误。
- repository 仍保持纯持久化职责。

## PR 4：service 接入 operation + job queue 创建

建议范围：

- credential service 在需要异步补偿时创建 operation。
- 同一事务内创建 operation + job queue 记录。
- service 返回稳定错误。
- service 不直接执行 worker。
- service 不把内部 operation 细节默认返回前端。

禁止范围：

- 不新增 API route。
- 不处理真实凭证。
- 不接真实 provider。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不把 provider 原始交互内容写入 operation 或 job。

关键验收：

- operation + job queue 创建具备事务一致性。
- job 创建失败时不会误报已排队。
- service 不执行后台补偿动作。

## PR 5：retry / dead letter / manual review runtime 最小闭环

建议范围：

- worker 根据 failure category 与 provider 稳定结果判断 retry。
- retry 未达上限时计算下一次 `nextAttemptAt` 并 requeue。
- retry 达上限时进入 dead letter。
- provider 结果未知或自动处理不安全时进入 manual review。
- stale recovery 无法证明安全时进入 manual review。

禁止范围：

- 不新增人工处置 API。
- 不新增人工处置 UI。
- 不展示真实凭证。
- 不展示外部系统原始交互内容。
- 不接真实 HIS adapter。

关键验收：

- `retryCount >= maxRetryCount` 不再 requeue。
- dead letter 只保存安全 reason。
- manual review 只保存安全摘要。
- failed job 不会被无限重试。

## PR 6：observability / safe logging

建议范围：

- 定义 worker run id。
- 记录 job state、operation state、operationId、claimVersion、failure category、retryCount、maxRetryCount 和稳定 result。
- 记录批处理数量、成功数量、失败数量、manual review 数量和 dead letter 数量。
- 记录 repository_error 的安全摘要。

禁止范围：

- 不记录真实认证材料。
- 不记录外部系统原始交互内容。
- 不记录外部错误原文。
- 不记录内部密钥定位信息。
- 不记录数据库连接材料、内部语句或异常调用细节。
- 不记录不可公开的 provider 内部路径。

关键验收：

- 日志可用于排查状态机问题。
- 日志不可用于还原敏感材料。
- 日志不扩大 tenant 数据可见性。

## PR 7：真实 provider / secret manager / HIS adapter Plan Mode

建议范围：

- 只做 Plan Mode。
- 规划真实 provider。
- 规划真实 secret manager。
- 规划真实 HIS adapter。
- 规划测试连接。
- 规划凭证生命周期与回滚边界。
- 规划 provider cleanup 的幂等证明。

明确仍不在前六个实现 PR 中进入：

- 不处理真实凭证。
- 不接真实 HIS adapter。
- 不做测试连接。
- 不保存外部系统原始交互内容。
- 不做自动摘要。
- 不做自动任务。
- 不做自动触达。

## 横向验收口径

每个后续实现 PR 都应单独确认：

- 是否保持 tenant isolation。
- 是否绑定 `tenantId + connectionId + operationId`。
- 是否保留 `claimId` / `claimVersion` 写回校验。
- 是否避免 provider 长事务。
- 是否避免 repository 调用 provider。
- 是否避免 provider 写 audit。
- 是否避免 route 写 worker 状态推进 audit。
- 是否不处理真实凭证。
- 是否不做测试连接。
- 是否不接真实 HIS adapter。
- 是否不保存外部系统原始交互内容。

## 本轮完成口径

本轮只完成文档规划：

- 新增 worker claim / lock / stale recovery spec。
- 新增后续拆分 plan。
- README、roadmap、devlog 同步当前阶段。
- 创建 Draft PR。

本轮不运行 runtime 测试；完成前只执行 git diff 和禁止范围检查。
