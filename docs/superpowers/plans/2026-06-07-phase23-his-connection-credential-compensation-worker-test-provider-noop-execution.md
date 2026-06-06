# Phase 23 HIS 连接配置凭证补偿 worker test-only provider 与 no-op execution 后续拆分计划

> 日期：2026-06-07
> 状态：docs-only Plan Mode。本文只为后续实现 PR 提供中文拆分计划，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不新增 API route，不修改 service、parser / DTO、provider / storage、权限或 audit，不实现 provider runtime，不调用真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter，不新增 runner / scheduler。

## 当前依据

本计划承接以下已完成能力：

- operation repository 已能表达 compensation pending、running、succeeded、failed 和 manual review。
- job queue repository 已能表达 queued、claimed、running、succeeded、failed、dead letter 和 manual review。
- job queue repository 已能用 `claimId + claimVersion` 拒绝旧 claim 写回。
- worker 已能 claim due job、推进 job running、推进 operation running，并对 stale 场景做保守 recovery。

当前仍缺少：

- test-only provider / no-op execution。
- provider result 稳定分类。
- provider success / failure / unsafe result 的 completion 编排。
- retry / requeue / backoff runtime。
- compensation audit integration。
- runner / scheduler。
- 真实 provider、测试连接和真实 HIS adapter 规划。

## 本轮文档产出

本轮只产出文档：

- 新增边界规划文档，覆盖 provider result 分类、completion 收口、职责边界和安全禁区。
- 新增后续拆分计划，说明哪些实现必须另开 PR。
- README、roadmap 与当天 devlog 同步本轮 Plan Mode。

本轮不产出代码、不产出 schema、不产出 API、不产出 runtime。

## 后续拆分总览

建议后续至少拆成十个独立 PR：

1. test-only provider / no-op execution 最小实现。
2. worker success completion runtime。
3. worker retryable failure completion runtime。
4. worker unsafe unknown manual review runtime。
5. provider result mapper 与输入安全校验。
6. retry / requeue / backoff runtime。
7. dead letter / manual review runtime。
8. compensation audit integration。
9. runner / scheduler。
10. 真实 provider / 测试连接 / 真实 HIS adapter Plan Mode。

拆分原则：

- 先用 no-op 验证 worker 编排，不触碰真实外部系统。
- completion 与 retry 分开，避免把失败收口和重试策略耦合。
- manual review 与 dead letter 分开，避免人工处置语义被自动失败覆盖。
- audit 单独规划，避免 repository 和 provider 承担审计职责。
- 真实 provider、真实凭证和真实 HIS adapter 必须单独规划。

## PR 一：test-only provider / no-op execution 最小实现

建议范围：

- 为 worker 增加 test-only provider / no-op execution 注入点。
- provider 只返回稳定分类。
- provider 不访问真实外部系统。
- provider 不读取或处理真实凭证。
- provider 不写 repository。
- provider 不写 audit。
- worker 在 job running 与 operation running 成功后调用 provider。
- provider 调用不在长事务内。

禁止范围：

- 不接真实 provider。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不处理真实凭证。
- 不新增 runner / scheduler。
- 不新增 schema / migration。
- 不新增 API route。

验收建议：

- `success` 可驱动后续 completion 分支。
- `retryable_failure` 可驱动后续 failure 分支。
- `unsafe_unknown` 可驱动后续 manual review 分支。
- `validation_failed` 不触发 provider execution。
- provider 不直接改 job、operation 或 audit。

## PR 二：worker success completion runtime

建议范围：

- worker 接收 `success` 后调用 job succeeded。
- job succeeded 成功后调用 operation succeeded。
- 任一步失败都返回稳定结果。
- 保留 recovery 兜底。

禁止范围：

- 不写 audit。
- 不接真实 provider。
- 不处理真实凭证。
- 不新增 runner / scheduler。

验收建议：

- job state 进入 `succeeded`。
- operation state 进入 `compensation_succeeded`。
- 旧 claim 无法写回成功。
- repository_error 不泄露内部细节。

## PR 三：worker retryable failure completion runtime

建议范围：

- worker 接收 `retryable_failure` 后调用 job failed。
- job failed 成功后调用 operation failed。
- 本 PR 只做 failed 收口，不做 requeue。
- retry / backoff 单独拆 PR。

禁止范围：

- 不实现 backoff。
- 不自动 dead letter。
- 不接真实 provider。
- 不保存外部系统交互内容。

验收建议：

- job state 进入 `failed`。
- operation state 进入 `compensation_failed`。
- retryCount 不在本 PR 中由 worker 直接修改。
- failed 后是否 requeue 交给后续 PR。

## PR 四：worker unsafe unknown manual review runtime

建议范围：

- worker 接收 `unsafe_unknown` 后调用 job manual review。
- job manual review 成功后调用 operation manual review。
- timeout 无法证明安全时同样进入 manual review。
- 不自动重复 provider 动作。

禁止范围：

- 不重试 unsafe unknown。
- 不自动 dead letter。
- 不新增人工处置 API。
- 不新增人工处置 UI。
- 不保存外部系统交互内容。

验收建议：

- job state 进入 `manual_review_required`。
- operation state 进入 `manual_review_required`。
- manual review read model 仅包含安全摘要。
- stale 场景不会重复执行 provider。

## PR 五：provider result mapper 与输入安全校验

建议范围：

- 固定 provider result 稳定分类。
- 拒绝未知分类。
- `validation_failed` 不调用 provider execution。
- `provider_unavailable` 稳定收口到 failed 或 manual review，具体取舍需在实现 PR 中说明。
- `repository_error` 只表达 repository 写回失败。

禁止范围：

- 不接受任意 provider 字符串。
- 不保存外部系统交互内容。
- 不保存内部异常细节。
- 不把 provider result 映射为真实外部调用。

验收建议：

- 覆盖 `success`、`retryable_failure`、`unsafe_unknown`、`validation_failed`、`provider_unavailable`、`timeout` 和 `repository_error`。
- 未知分类返回稳定失败。
- 分类不包含敏感材料。

## PR 六：retry / requeue / backoff runtime

建议范围：

- 只对明确可重试的失败进入 requeue。
- worker 计算下一次可领取时间。
- job queue repository 负责递增 retryCount。
- 达到上限后进入 dead letter 或 manual review，具体策略单独说明。

禁止范围：

- 不无限重试。
- 不对 unsafe unknown 重试。
- 不把 timeout 默认视为可重试。
- 不接真实 provider。

验收建议：

- `retryCount < maxRetryCount` 时允许 requeue。
- `retryCount >= maxRetryCount` 时不再 requeue。
- backoff 结果稳定可测。
- 旧 claim 写回失败。

## PR 七：dead letter 与 manual review runtime

建议范围：

- retry 达上限进入 dead letter。
- unsafe unknown、stale running、状态不一致进入 manual review。
- dead letter 只保存稳定 reason。
- manual review 只保存安全摘要。

禁止范围：

- 不新增人工处置 API。
- 不新增人工处置 UI。
- 不展示真实凭证。
- 不展示外部系统交互内容。

验收建议：

- failed job 达上限后不再 requeue。
- manual review 不自动回退 queued。
- dead letter 不等于人工复核完成。

## PR 八：compensation audit integration

建议范围：

- 在 worker 或 compensation domain/service 的状态推进处写 audit。
- 明确 running、succeeded、failed、manual review 和 dead letter 的审计策略。
- 明确 audit 写入失败后的处理。
- 保证 repository 和 provider 不承担审计职责。

禁止范围：

- 不由 operation repository 写 audit。
- 不由 job queue repository 写 audit。
- 不由 provider 写 audit。
- 不临时新增未经评审的 audit action / reason / result。

验收建议：

- audit 与状态推进关系清晰。
- audit 失败不会泄露内部细节。
- audit 失败后的分流策略可测试。

## PR 九：runner / scheduler

建议范围：

- 定义 worker 触发节奏。
- 定义 tenant scope 扫描方式。
- 定义批大小、锁时长和 stale 阈值配置。
- 定义停止、重入和并发边界。

禁止范围：

- 不接真实 provider。
- 不处理真实凭证。
- 不做测试连接。
- 不新增未评审的后台常驻进程。

验收建议：

- runner 不绕过 worker。
- scheduler 不绕过 tenant scope。
- 并发 worker 由 claimVersion 保护。

## PR 十：真实 provider / 测试连接 / 真实 HIS adapter Plan Mode

建议范围：

- 只做 Plan Mode。
- 规划真实 provider。
- 规划真实 HIS adapter。
- 规划测试连接。
- 规划真实凭证处理。
- 规划外部密钥管理系统。
- 规划回滚、人工复核和安全日志。

禁止范围：

- 不在前九个 PR 中接真实外部系统。
- 不在前九个 PR 中处理真实凭证。
- 不在前九个 PR 中做测试连接。
- 不在前九个 PR 中保存外部系统交互内容。

验收建议：

- 真实外部系统接入前已有单独边界文档。
- 凭证、测试连接和 HIS adapter 不与 no-op worker 混在同一 PR。

## provider result 稳定分类

后续实现应只接受以下分类：

- `success`。
- `retryable_failure`。
- `unsafe_unknown`。
- `validation_failed`。
- `provider_unavailable`。
- `timeout`。
- `repository_error`。

分类用途：

- `success`：推进 succeeded。
- `retryable_failure`：推进 failed，retry 另开 PR。
- `unsafe_unknown`：推进 manual review。
- `validation_failed`：不调用 provider。
- `provider_unavailable`：推进 failed 或 manual review，取舍需测试覆盖。
- `timeout`：优先 manual review，除非后续 PR 证明可安全重试。
- `repository_error`：返回稳定 repository failure，由 recovery 兜底。

## job 与 operation 对齐策略

对齐要求：

- success：job succeeded，operation succeeded。
- retryable failure：job failed，operation failed。
- unsafe unknown：job manual review，operation manual review。
- validation failed：不自动推进。
- repository error：保持实际状态，等待 recovery。

不一致处理：

- job 已写回但 operation 写回失败，由 stale running operation recovery 或 manual review 兜底。
- operation 已写回但 job 写回失败，由 expired lock 或 job lookup recovery 兜底。
- 不允许 provider 直接修复不一致。

## claim 写回策略

写回要求：

- provider execution 必须发生在 claim 成功、job running 成功、operation running 成功之后。
- completion 写回必须携带同一组 `claimId + claimVersion`。
- 旧 claim 写回必须被拒绝。
- operation 写回必须绑定同一组 `tenantId + connectionId + operationId`。
- stale recovery 不能绕过 claim。

## 事务与一致性策略

建议：

- claim、job running、operation running、job completion、operation completion 都使用短事务。
- provider 调用在事务外完成。
- job 与 operation completion 可顺序写回。
- recovery 兜底处理短暂不一致。
- audit integration 单独决定审计与状态推进的组合方式。

禁止：

- 不用长事务包住 provider 调用。
- 不让 provider 写 repository。
- 不让 repository 调 provider。
- 不让 HTTP route 直接执行 worker completion。

## 敏感信息禁区

所有后续实现和文档均不得新增或展示：

- 真实认证材料。
- 可直接访问外部系统的密钥类材料。
- 外部系统交互原文。
- 外部系统错误原文。
- 内部密钥定位信息。
- 内部数据库连接细节。
- 内部异常调用细节。
- 可用于重放外部动作的材料。
- 未经白名单审查的载荷。

## 当前 Plan Mode 结论

本轮可以只做 test-only provider / no-op execution Plan Mode：

- worker 已提供 provider execution 前置编排入口。
- operation repository 已提供 succeeded / failed / manual review 收口能力。
- job queue repository 已提供 succeeded / failed / manual review 与 claim 写回保护。
- 后续实现可以先接 no-op，而不接真实 provider。
- 后续实现可以不处理真实凭证。
- 后续实现可以先不写 audit。
- runner / scheduler 必须另开 PR。
