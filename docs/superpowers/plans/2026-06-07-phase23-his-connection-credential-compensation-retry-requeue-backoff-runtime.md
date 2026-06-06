# Phase 23 HIS 连接配置凭证补偿 retry / requeue / backoff runtime 后续拆分计划

> 日期：2026-06-07
> 状态：仅文档 Plan Mode。本文只为后续实现 PR 提供中文拆分计划，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不新增 API route，不修改 service、parser / DTO、provider / storage、权限或 audit，不实现 retry / requeue / backoff、dead letter、manual review、compensation audit、runner / scheduler，不调用真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

## 当前依据

本计划承接以下已完成能力：

- worker 已支持 `providerExecutor` 注入点与 `executeClaimedCredentialCompensationJob`。
- worker 已支持 `success`、`retryable_failure`、`unsafe_unknown`、`provider_unavailable`、`timeout` 和 `validation_failed` 的稳定 completion 收口。
- job queue repository 已支持 `requeueCredentialCompensationJob`、`retryCount`、`maxRetryCount`、`nextAttemptAt` 和 `claimId + claimVersion` 写回保护。
- operation repository 已支持 running、failed、manual review 和 retry count 递增。

当前仍缺少：

- retry policy 纯决策层。
- worker retry / requeue runtime。
- backoff 计算。
- 抖动计算。
- retry exhausted dead letter / manual review 分流。
- operation retry count 对齐编排。
- compensation audit integration。
- runner / scheduler。
- 真实 provider、测试连接和真实 HIS adapter 规划。

## 本轮文档产出

本轮只产出文档：

- 新增 retry / requeue / backoff runtime 边界规划文档。
- 新增后续拆分计划文档。
- README、roadmap 与当天 devlog 同步本轮 Plan Mode。

本轮不产出代码、不产出 schema、不产出 API、不产出 runtime。

## 后续拆分总览

建议后续至少拆成十个独立 PR：

1. retry policy 纯决策 helper 最小实现。
2. worker retry / requeue runtime 最小实现。
3. operation retry count 对齐最小实现。
4. retry exhausted dead letter runtime。
5. retry exhausted manual review runtime。
6. backoff 指数策略增强。
7. 抖动策略增强。
8. compensation audit integration。
9. runner / scheduler Plan Mode 与最小实现。
10. 真实 provider / 测试连接 / 真实 HIS adapter Plan Mode。

拆分原则：

- retry policy 与 worker 编排分开。
- backoff 与 runner / scheduler 分开。
- dead letter 与 manual review 分开。
- compensation audit 单独规划。
- 真实 provider、真实凭证和真实 HIS adapter 必须单独规划。

## PR 一：retry policy 纯决策 helper 最小实现

建议范围：

- 新增纯决策 helper。
- 输入只包含 provider result、job state、`retryCount`、`maxRetryCount`、当前时间和配置。
- 输出稳定决策：requeue、dead letter、manual review 或 no retry。
- `retryable_failure` 未达上限时返回 requeue。
- `provider_unavailable` 未达上限时返回 requeue。
- `timeout` 默认返回 manual review。
- `unsafe_unknown` 返回 manual review。
- `validation_failed` 返回 no retry。

禁止范围：

- 不写 repository。
- 不调用 provider。
- 不写 audit。
- 不处理真实凭证。
- 不新增 runner / scheduler。

验收建议：

- 覆盖 `retryCount < maxRetryCount`。
- 覆盖 `retryCount >= maxRetryCount`。
- 覆盖每个 provider result 分类。
- 决策层可在无数据库环境中测试。

## PR 二：worker retry / requeue runtime 最小实现

建议范围：

- 在 `retryable_failure` 与 `provider_unavailable` 的 failed completion 后调用 retry policy。
- 未达上限时计算 `nextAttemptAt`。
- 调用 job queue repository 的 requeue 方法。
- requeue 写回必须携带 `claimId + claimVersion`。
- repository result 映射为稳定 worker result。

禁止范围：

- 不直接修改 `retryCount`。
- 不绕过 job queue repository。
- 不接真实 provider。
- 不写 audit。
- 不新增 runner / scheduler。

验收建议：

- `retryable_failure` 可 requeue。
- `provider_unavailable` 可 requeue。
- 旧 claim requeue 返回 conflict。
- requeue 成功后 job 回到 queued。
- requeue 成功后 `nextAttemptAt` 更新。

## PR 三：operation retry count 对齐最小实现

建议范围：

- job requeue 成功后调用 operation repository 递增 retry count。
- operation retry count 仅作为业务状态对齐，不承担调度判断。
- operation 递增失败时返回稳定结果。
- recovery 或后续 manual review 兜底短暂不一致。

禁止范围：

- 不让 operation repository 计算 backoff。
- 不让 operation repository 调 job queue repository。
- 不把 operation retry count 作为唯一调度依据。

验收建议：

- requeue 成功后 operation retry count 递增。
- operation 状态不允许递增时返回稳定失败。
- job requeue 成功但 operation 对齐失败时不泄露内部细节。

## PR 四：retry exhausted dead letter runtime

建议范围：

- `retryable_failure` 达到上限后进入 dead letter。
- `provider_unavailable` 达到上限后进入 dead letter。
- dead letter 只保存稳定 reason。
- dead letter 写回必须携带 `claimId + claimVersion`。

禁止范围：

- 不保存 provider 内部错误原文。
- 不自动恢复 queued。
- 不新增人工处置 API。
- 不接真实 provider。

验收建议：

- `retryCount >= maxRetryCount` 不 requeue。
- job state 进入 `dead_lettered`。
- old claim 无法写回 dead letter。
- dead letter 不等于人工复核完成。

## PR 五：retry exhausted manual review runtime

建议范围：

- 状态不一致、旧 claim 冲突、operation 无法对齐或副作用未知时进入 manual review。
- `timeout` 默认进入 manual review。
- `unsafe_unknown` 继续进入 manual review。
- manual review 只保存安全摘要。

禁止范围：

- 不自动重复 provider 动作。
- 不自动 dead letter 覆盖 manual review。
- 不新增人工处置 UI。
- 不展示真实凭证。

验收建议：

- job state 进入 `manual_review_required`。
- operation state 进入 `manual_review_required`。
- manual review 不自动回退 queued。
- manual review read model 不含敏感材料。

## PR 六：backoff 指数策略增强

建议范围：

- 在固定延迟策略稳定后引入指数 backoff。
- 设置最大延迟上限。
- 输入只包含 retry count、当前时间和配置。
- 输出只影响 `nextAttemptAt`。

禁止范围：

- 不根据 provider 内部错误文本调整延迟。
- 不新增定时器。
- 不新增 runner / scheduler。
- 不接真实 provider。

验收建议：

- 每个 retry count 对应可预测延迟。
- 延迟不超过上限。
- `nextAttemptAt` 不早于当前时间。

## PR 七：抖动策略增强

建议范围：

- 在指数 backoff 稳定后引入小范围抖动。
- 抖动来源可注入，便于测试。
- 抖动只影响 `nextAttemptAt`。
- 抖动不得改变 retry 上限判断。

禁止范围：

- 不让抖动影响 `retryCount`。
- 不让抖动绕过 `maxRetryCount`。
- 不新增后台常驻进程。

验收建议：

- 固定随机来源下结果可复现。
- 抖动范围受配置限制。
- 大批量 job 不会同一时刻全部再次到期。

## PR 八：compensation audit integration

建议范围：

- 在 worker 或 compensation domain/service 的状态推进处写 audit。
- 明确 requeue、dead letter、manual review 和 retry exhausted 的审计语义。
- 明确 audit 写入失败后的策略。
- 保证 repository、provider 与 retry policy 不承担审计职责。

禁止范围：

- 不由 operation repository 写 audit。
- 不由 job queue repository 写 audit。
- 不由 provider 写 audit。
- 不临时新增未经评审的 audit action / reason / result。

验收建议：

- audit 与状态推进关系清晰。
- audit 失败不会泄露内部细节。
- audit 失败后的分流策略可测试。

## PR 九：runner / scheduler Plan Mode 与最小实现

建议范围：

- 先做 Plan Mode，再做最小实现。
- 定义 worker 触发节奏。
- 定义 tenant scope 扫描方式。
- 定义批大小、锁时长、stale 阈值和停止边界。
- runner 只调用 worker，不绕过 repository。

禁止范围：

- 不在 retry runtime PR 中新增 runner / scheduler。
- 不接真实 provider。
- 不处理真实凭证。
- 不做测试连接。

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
- 规划外部凭证管理系统。
- 规划回滚、人工复核和安全日志。

禁止范围：

- 不在 retry / requeue / backoff runtime PR 中接真实外部系统。
- 不在 retry / requeue / backoff runtime PR 中处理真实凭证。
- 不在 retry / requeue / backoff runtime PR 中做测试连接。
- 不在 retry / requeue / backoff runtime PR 中保存外部系统交互内容。

验收建议：

- 真实外部系统接入前已有单独边界文档。
- 凭证、测试连接和 HIS adapter 不与 retry runtime 混在同一 PR。

## provider result 到后续 PR 的映射

后续实现应保持以下映射：

- `success`：不进入 retry。
- `retryable_failure`：进入 retry policy。
- `provider_unavailable`：进入 retry policy，但必须受上限保护。
- `timeout`：默认进入 manual review。
- `unsafe_unknown`：进入 manual review。
- `validation_failed`：不调用 provider、不 requeue。
- `repository_error`：不由 retry policy 处理，等待 recovery 或后续单独规划。

## job 与 operation 对齐策略

对齐要求：

- failed completion 后，job failed 与 operation failed 先保持一致。
- requeue 成功后，job 回到 queued。
- requeue 成功后，operation 保持 failed 并递增 retry count。
- 下一次 claim 成功后，operation 再进入 running。
- retry exhausted 后，job 与 operation 的最终对齐由 dead letter / manual review PR 明确。
- 不允许 provider 直接修复不一致。

## claim 写回策略

写回要求：

- retry runtime 必须使用当前 claim。
- requeue、dead letter 和 manual review 都必须携带 `claimId + claimVersion`。
- 旧 claim 写回必须被拒绝。
- requeue 成功后 claim 清理由 job queue repository 完成。
- operation 写回必须绑定同一组 `tenantId + connectionId + operationId`。

## 事务与一致性策略

建议：

- provider 调用在事务外完成。
- job failed、operation failed、job requeue、operation retry count 递增均使用短事务。
- job 与 operation 可以顺序写回。
- 任一步失败返回稳定结果。
- recovery 兜底处理短暂不一致。
- audit integration 单独决定审计与状态推进的组合方式。

禁止：

- 不用长事务包住 provider execution、failed completion 和 requeue。
- 不让 provider 写 repository。
- 不让 repository 调 provider。
- 不让 HTTP route 直接执行 retry runtime。

## 敏感信息禁区

所有后续实现和文档均不得新增或展示：

- 真实认证材料。
- 可直接访问外部系统的访问材料。
- 外部系统交互原文。
- 外部系统错误原文。
- 内部凭证定位细节。
- 内部数据库连接细节。
- 内部异常调用细节。
- 可用于重放外部动作的材料。
- 未经白名单审查的载荷。

## 当前 Plan Mode 结论

本轮可以只做 retry / requeue / backoff runtime Plan Mode：

- worker 已有 retry / requeue 规划入口。
- job queue repository 已足够支撑 retry / requeue。
- operation repository 已足够支撑 retry count、failed 与 running 状态推进。
- `retryable_failure` 与受上限保护的 `provider_unavailable` 可进入 retry。
- `timeout` 默认不进入 retry。
- `unsafe_unknown` 与 `validation_failed` 不进入 retry。
- 需要 backoff 策略。
- 需要 dead letter / manual review 策略。
- 可以不新增 schema / migration。
- 可以不接真实 provider。
- 可以不处理真实凭证。
- 可以不写 audit。
- 可以不新增 runner / scheduler。
