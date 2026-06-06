# Phase 23 HIS 连接配置凭证补偿 retry / requeue / backoff runtime 边界规划

> 日期：2026-06-07
> 状态：仅文档 Plan Mode。本文只规划 Phase 23 HIS 连接配置凭证补偿 retry / requeue / backoff runtime 的职责边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不新增 API route，不修改 service，不修改 parser / DTO，不修改 provider / storage，不修改权限，不修改 audit domain / reason / query whitelist，不修改 audit repository，不实现 retry runtime，不实现 requeue runtime，不实现 backoff 代码，不实现 dead letter runtime，不实现 manual review runtime，不调用真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS adapter，不实现 compensation audit，不新增 runner / scheduler。

## 只读盘点结论

1. 当前 worker 已具备 retry / requeue 规划入口：`executeClaimedCredentialCompensationJob` 已能识别 `retryable_failure`、`provider_unavailable`、`timeout`、`unsafe_unknown` 和 `validation_failed`，并把可重试候选先收口为 failed；但 worker 仍没有 retry policy、backoff 计算或自动 requeue。
2. 当前 job queue repository 足够支撑 retry / requeue：它已有 `requeueCredentialCompensationJob`、`retryCount`、`maxRetryCount`、`nextAttemptAt`、`claimId + claimVersion` 写回校验，以及 failed 到 queued 的受控回退。
3. 当前 operation repository 足够支撑 retry count / failed / running 状态推进：它已有 running、failed、manual review、stale running 查询和 `incrementCredentialCompensationOperationRetryCount`；但 operation repository 不负责调度，也不计算下一次尝试时间。
4. 当前 provider result 分类中，只有 `retryable_failure` 与受上限保护的 `provider_unavailable` 可进入 retry 规划；`timeout` 默认不自动 retry，除非后续能证明该路径没有外部副作用；`unsafe_unknown` 与 `validation_failed` 不进入 retry。
5. 需要 backoff 策略，否则 failed job 会在 requeue 后被立即重复领取。
6. 需要 retry exhausted 后的 dead letter / manual review 分流，否则达到上限后的 failed job 无法闭环。
7. 本轮可以先只做 Plan Mode，不改代码。
8. 本轮可以不新增 schema / migration，当前 job queue 字段已足够表达最小 retry / requeue / backoff runtime。
9. 本轮可以不接真实 provider。
10. 本轮可以不处理真实凭证。
11. 本轮可以不写 audit。
12. 本轮可以不新增 runner / scheduler。
13. retry runtime、backoff 代码、dead letter runtime、manual review runtime、compensation audit、service 接入、runner / scheduler、真实 provider、测试连接、真实 HIS adapter 和外部凭证管理接入都必须另开实现 PR。

## 背景与当前状态

Phase 23 HIS 连接配置凭证补偿链路已经完成以下基础：

- compensation operation metadata 与 operationId schema 最小边界。
- operation repository 最小边界。
- job queue schema / migration 最小边界。
- job queue repository 最小边界。
- worker claim / lock / stale recovery runtime 最小边界。
- worker test-only / no-op provider execution 最小边界。

当前 worker 已能 claim due job、推进 job running、推进 operation running，并在 provider result 返回后完成 success、failed 或 manual review 的稳定收口。`retryable_failure` 与 `provider_unavailable` 目前只会把 job 与 operation 收口为 failed，不会自动 requeue；`timeout` 与 `unsafe_unknown` 进入 manual review；`validation_failed` 不调用 provider，也不推进 job / operation。

这意味着当前系统已经具备 retry / requeue 的状态入口，但还没有将 provider result、重试次数、下一次尝试时间和 retry exhausted 分流串成 runtime。直接在当前 PR 实现 runtime 会同时牵涉 backoff、死信、人工复核、审计、runner 触发节奏和真实 provider 风险，因此本轮只做中文边界规划。

## 目标

本轮目标是为后续 retry / requeue / backoff runtime 实现 PR 明确边界：

- 明确哪些 provider result 可以进入 retry。
- 明确 worker 与 retry policy 的职责拆分。
- 明确 retry / requeue / backoff 的最小 runtime 关系。
- 明确 `retryCount`、`maxRetryCount` 与 `nextAttemptAt` 的判断口径。
- 明确 backoff 与抖动策略建议。
- 明确 retry exhausted 后 dead letter / manual review 分流。
- 明确 job state 与 operation state 的对齐方式。
- 明确 `claimId` / `claimVersion` 写回边界。
- 明确事务、一致性、审计、租户隔离、安全日志与敏感信息禁区。
- 明确测试拆分和后续 PR 拆分。

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
- 不实现 retry runtime。
- 不实现 requeue runtime。
- 不实现 backoff 代码。
- 不实现 dead letter runtime。
- 不实现 manual review runtime。
- 不调用真实 provider。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不实现 compensation audit。
- 不新增 runner / scheduler / cron。
- 不新增后台常驻进程。
- 不修改 package、lockfile、`.env` 或 `.codex`。

## 当前已完成能力

worker 已完成：

- `providerExecutor` 可选注入点。
- `executeClaimedCredentialCompensationJob` completion 编排入口。
- provider execution 前的 job running 与 operation running 校验。
- provider result 稳定分类校验。
- `success` 到 job succeeded + operation succeeded。
- `retryable_failure` 到 job failed + operation failed。
- `provider_unavailable` 到 job failed + operation failed。
- `timeout` 到 job manual review + operation manual review。
- `unsafe_unknown` 到 job manual review + operation manual review。
- `validation_failed` 不调用 provider、不推进 job / operation。
- provider executor 抛错固定映射为 `provider_unavailable`。
- completion 写回必须携带 `claimId + claimVersion`。

job queue repository 已完成：

- create / get。
- due list。
- claim / lock。
- running / succeeded / failed。
- requeue。
- dead letter。
- manual review。
- expired lock 查询。
- `retryCount`、`maxRetryCount`、`nextAttemptAt`。
- `claimId + claimVersion` 乐观写回保护。
- `retryCount >= maxRetryCount` 时拒绝 requeue。

operation repository 已完成：

- create / get。
- running / succeeded / failed / manual review。
- retry count 递增。
- pending 与 stale running 查询。
- `tenantId + connectionId + operationId` 绑定。
- 稳定 repository result。

## 当前缺口

当前缺口集中在 retry runtime：

- worker 尚未在 `retryable_failure` 或 `provider_unavailable` 后判断是否 requeue。
- 尚未定义 retry policy 输入与输出。
- 尚未定义 `nextAttemptAt` 计算。
- 尚未定义固定延迟、指数 backoff 或抖动策略。
- 尚未定义 retry exhausted 后进入 dead letter 还是 manual review。
- 尚未定义 job requeue 成功后 operation retry count 如何对齐。
- 尚未定义 retry runtime 的一致性兜底。
- 尚未接入 compensation audit。
- 尚未定义 runner / scheduler 对 `nextAttemptAt` 的触发方式。

## retry / requeue / backoff 职责边界

retry runtime 应负责：

- 只处理已经由 provider result 明确标记为可重试的 failed job。
- 读取 job 当前 `retryCount` 与 `maxRetryCount`。
- 判断是否还有重试额度。
- 计算下一次 `nextAttemptAt`。
- 调用 job queue repository 的 requeue 方法。
- 在 requeue 成功后推进 operation retry count 对齐。
- 达到上限时进入 dead letter 或 manual review 分流。
- 返回稳定 worker result。

retry runtime 不应负责：

- 不直接修改 job 的 `retryCount`。
- 不绕过 job queue repository 写回 `nextAttemptAt`。
- 不直接调用真实 provider。
- 不处理真实凭证。
- 不写 audit。
- 不新增 runner / scheduler。
- 不决定真实外部系统的副作用安全性。

backoff 策略应负责：

- 只根据安全输入计算下一次尝试时间。
- 不写数据库。
- 不调用 provider。
- 不读取凭证材料。
- 不记录敏感信息。

## worker 与 retry policy 职责边界

worker 应负责：

- 在 completion 后识别 provider result。
- 为 retry policy 提供安全上下文。
- 根据 retry policy 决策调用 requeue、dead letter 或 manual review。
- 使用 `claimId + claimVersion` 保证旧 claim 不能写回。
- 将 repository result 映射为稳定 worker result。

retry policy 应负责：

- 接收 provider result、job state、`retryCount`、`maxRetryCount` 与当前时间。
- 返回 `requeue`、`dead_letter`、`manual_review` 或 `no_retry` 这类稳定决策。
- 返回下一次尝试时间，或返回不重试原因。
- 不接触 provider。
- 不接触 repository。
- 不接触 audit。

建议把 retry policy 做成纯决策层，worker 仍是唯一编排者。这样后续 backoff 策略可以独立测试，repository 写回仍保持在 worker 编排下。

## provider result 到 retry 决策映射

| provider result | 当前 worker 收口 | 后续 retry 决策 | 说明 |
| --- | --- | --- | --- |
| `success` | succeeded | 不 retry | 已完成，不回退 |
| `retryable_failure` | failed | 可 retry | 未达上限时 requeue，达到上限后分流 |
| `provider_unavailable` | failed | 可 retry | 视为临时不可用，但必须受上限保护 |
| `timeout` | manual review | 默认不 retry | 不能证明无副作用时不自动重复 |
| `unsafe_unknown` | manual review | 不 retry | 结果未知或自动处理不安全 |
| `validation_failed` | 不推进 | 不 retry | 由调用方修正输入或后续人工处理 |
| `repository_error` | 稳定失败 | 不由 retry policy 处理 | 等待 recovery 或后续单独规划 |

## `retryable_failure` 处理策略

推荐口径：

- provider result 为 `retryable_failure` 后，当前 worker 已能 mark job failed + operation failed。
- 后续 retry runtime 应判断 `retryCount < maxRetryCount`。
- 未达上限时计算 `nextAttemptAt` 并调用 requeue。
- 达到上限时进入 dead letter 或 manual review，具体策略需单独明确。
- 不由 worker 直接修改 `retryCount`，由 job queue repository requeue 递增。
- 不保存 provider 的内部失败细节。

## `provider_unavailable` 处理策略

推荐口径：

- 当前已收口为 failed。
- 后续可视为 retryable，但必须有最大次数限制。
- 不应无限重试。
- 不保存 provider 不可用的内部错误原文或内部定位信息。
- 达到上限后优先 dead letter；如果存在副作用未知或状态不一致，应进入 manual review。

## `timeout` 是否可重试的判断边界

默认口径：

- 当前已收口为 manual review。
- 默认不进入 retry。
- 除非后续能证明 no-op / provider 调用无副作用，否则不能自动 requeue。
- 真实 provider timeout 必须优先 manual review 或单独 Plan Mode。

后续如果要让 `timeout` 进入 retry，必须先满足：

- provider execution 可证明没有外部副作用，或已具备可验证的幂等保护。
- retry policy 有最大次数限制。
- backoff 可测试。
- manual review 兜底明确。
- 文档和测试明确覆盖该分支。

## `unsafe_unknown` 不进入 retry 的边界

`unsafe_unknown` 不进入 retry：

- 不 requeue。
- 不自动 dead letter 覆盖。
- 进入 manual review。
- 不重复执行 provider。
- 不保存外部交互原文或内部异常细节。

该分类表达的是自动流程无法判断安全性，不是普通失败。

## `validation_failed` 不进入 retry 的边界

`validation_failed` 不进入 retry：

- 不调用 provider。
- 不推进 job / operation。
- 不 requeue。
- 不写 audit。
- 由调用方修正输入或进入后续人工处理规划。
- 后续若要把该结果收敛到 manual review，需要单独实现 PR。

## `retryCount` 与 `maxRetryCount` 边界

判断口径：

- `retryCount < maxRetryCount` 时才允许 requeue。
- `retryCount >= maxRetryCount` 时不得 requeue。
- `retryCount` 只由 job queue repository 在 requeue 成功时递增。
- worker 不直接改 `retryCount`。
- operation retry count 只用于业务状态可见性与对齐，不承担调度判断。
- operation retry count 的递增应在 job requeue 成功后执行。
- job requeue 成功但 operation retry count 递增失败时，应返回稳定 repository result，并交由 recovery 或后续 manual review 策略兜底。

## `nextAttemptAt` 计算边界

`nextAttemptAt` 只表示下一次可被 due list 领取的时间：

- backoff 策略计算 `nextAttemptAt`。
- job queue repository 只保存传入的 `nextAttemptAt`。
- runner / scheduler 只依赖 due list，不直接绕过 `nextAttemptAt`。
- `nextAttemptAt` 不应早于当前 retry 决策时间。
- `nextAttemptAt` 不应包含任何敏感信息。
- backoff 计算不应依赖外部 provider 的内部错误文本。

## backoff 策略建议

最小策略建议：

- 第一版从固定延迟开始，例如统一延迟到未来一个短窗口。
- 固定延迟只计算 `nextAttemptAt`。
- 不新增定时器。
- 不新增 runner / scheduler。
- 不新增 cron。
- 不新增后台常驻进程。

后续增强策略：

- 可在独立 PR 引入指数 backoff。
- 指数 backoff 应有最大延迟上限。
- 指数 backoff 输入只包含 retry count、当前时间和配置值。
- 不根据 provider 内部错误文本调整延迟。

## 抖动策略建议

抖动策略可以后置：

- 最小实现可不加抖动，先保证稳定可测。
- 若同一租户大量 job 同时失败，再引入小范围抖动。
- 抖动只影响 `nextAttemptAt`。
- 抖动必须有确定性测试方式，例如注入随机数来源或固定序列。
- 抖动不得改变 `retryCount` 与 `maxRetryCount` 判断。

## retry exhausted 后 dead letter / manual review 分流

达到上限后需要闭环：

- `retryable_failure` 达上限后，默认进入 dead letter。
- `provider_unavailable` 达上限后，默认进入 dead letter。
- 如果存在状态不一致、旧 claim 冲突、operation 无法对齐或副作用未知，则进入 manual review。
- dead letter 只保存稳定 reason。
- manual review 只保存安全摘要。
- 该分流必须另开实现 PR，不能混入当前 Plan Mode。

## job state 与 operation state 对齐

推荐对齐关系：

| 阶段 | job state | operation state |
| --- | --- | --- |
| provider 可重试失败完成后 | `failed` | `compensation_failed` |
| retry 未达上限并 requeue 成功后 | `queued` | 保持 `compensation_failed`，并递增 operation retry count |
| 下一次 claim 成功后 | `running` | `compensation_running` |
| retry 达上限后 | `dead_lettered` 或 `manual_review_required` | `manual_review_required` 或保持 failed 后由后续策略收口 |
| unsafe unknown | `manual_review_required` | `manual_review_required` |
| timeout 默认路径 | `manual_review_required` | `manual_review_required` |

对齐约束：

- job 是调度事实表。
- operation 是补偿业务状态事实表。
- job requeue 不代表 operation 已成功。
- job dead letter 或 manual review 与 operation 最终状态的关系需要在 dead letter / manual review runtime PR 中明确。
- 不允许 provider 直接修改 job 或 operation。

## `claimId` 与 `claimVersion` 写回边界

retry runtime 写回要求：

- requeue 必须携带当前 running / failed job 的 `claimId + claimVersion`。
- 旧 claim 或迟到 completion 不能覆盖新 claim。
- requeue 成功后清理 claim 元数据由 job queue repository 负责。
- dead letter 与 manual review 写回也必须携带同一组 claim 信息。
- operation repository 不持有 claim 信息。
- worker 必须用同一组 `tenantId + connectionId + operationId` 绑定 job 与 operation。

## transaction 与 consistency 边界

一致性建议：

- provider 调用不得在数据库长事务内执行。
- job failed 写回与 operation failed 写回应保持当前短事务顺序。
- requeue 应在 job failed 成功后发生。
- operation retry count 递增应在 job requeue 成功后发生。
- dead letter / manual review 分流应在 retry exhausted 判断后发生。
- 任一步失败都返回稳定结果，不补写敏感细节。
- recovery 负责处理短暂不一致。

不得做：

- 不用单次长事务包住 provider execution、failed completion、requeue 和 operation retry count。
- 不让 retry policy 写 repository。
- 不让 repository 调 provider。
- 不让 route 直接执行 retry runtime。

## audit 边界

本轮不实现 compensation audit。

后续 audit integration 应遵守：

- audit 写入职责放在 worker 或 compensation domain/service 的状态推进处。
- operation repository 不写 audit。
- job queue repository 不写 audit。
- provider 不写 audit。
- retry policy 不写 audit。
- audit 写入失败后的 fail closed / best effort 取舍必须单独规划。
- 不新增未经评审的 audit action / reason / result。

## 租户隔离

租户隔离要求：

- retry runtime 每次处理都必须绑定可信 `tenantId`。
- job 与 operation 查询必须绑定 `tenantId + connectionId + operationId`。
- requeue、dead letter、manual review 都不能跨租户写回。
- provider result 不能携带可切换租户的输入。
- runner / scheduler 后续只能按可信 tenant scope 调 worker。
- 日志不得扩大 tenant 数据可见性。

## 敏感信息禁区

Plan、Spec、README、roadmap、devlog、PR 描述、日志、audit metadata、job read model、operation read model、dead letter 和 manual review 中都不得新增或展示：

- 真实认证材料。
- 可直接访问外部系统的访问材料。
- 外部系统交互原文。
- 外部系统错误原文。
- 内部凭证定位细节。
- 内部数据库连接细节。
- 内部异常调用细节。
- 可用于重放外部动作的材料。
- 未经白名单审查的载荷。

## 可观测性与安全日志

建议记录：

- worker run id。
- tenant scope。
- operationId。
- job state。
- operation state。
- claimVersion。
- provider result 稳定分类。
- retry 决策。
- retryCount 与 maxRetryCount。
- nextAttemptAt。
- dead letter 或 manual review 分流数量。
- repository result 稳定分类。

禁止记录：

- 真实认证材料。
- 外部系统交互原文。
- 外部系统错误原文。
- 内部凭证定位细节。
- 内部数据库连接细节。
- 内部异常调用细节。
- provider 内部定位细节。

## 测试拆分建议

retry / requeue / backoff runtime 实现 PR 建议覆盖：

- `retryable_failure` failed completion 后，`retryCount < maxRetryCount` 时 requeue。
- `provider_unavailable` failed completion 后，`retryCount < maxRetryCount` 时 requeue。
- `retryCount >= maxRetryCount` 时不 requeue。
- requeue 成功后 job state 回到 `queued`。
- requeue 成功后 job queue repository 递增 `retryCount`。
- requeue 成功后写入未来 `nextAttemptAt`。
- requeue 成功后清理 claim 元数据。
- requeue 成功后 operation retry count 递增。
- 旧 claim requeue 返回 conflict。
- `timeout` 默认不 requeue。
- `unsafe_unknown` 不 requeue。
- `validation_failed` 不 requeue。
- backoff 固定延迟可预测。
- 抖动策略若实现，必须可注入、可复现。
- 达到上限后进入 dead letter 或 manual review 的分流由独立 PR 覆盖。

## 后续 PR 拆分建议

建议拆分为以下独立 PR：

1. retry / requeue / backoff runtime Plan Mode：本 PR。
2. retry policy 纯决策 helper 最小实现。
3. worker retry / requeue runtime 最小实现。
4. operation retry count 对齐最小实现。
5. retry exhausted dead letter runtime。
6. retry exhausted manual review runtime。
7. compensation audit integration。
8. runner / scheduler 触发 `nextAttemptAt` Plan Mode。
9. runner / scheduler 最小实现。
10. 真实 provider / 测试连接 / 真实 HIS adapter Plan Mode。

## 必须另开实现 PR 的内容

以下内容不得在本轮实现：

- retry runtime。
- requeue runtime。
- backoff 代码。
- 抖动代码。
- dead letter runtime。
- manual review runtime。
- compensation audit。
- service 接入。
- runner / scheduler / cron。
- 后台常驻进程。
- 真实 provider。
- 测试连接。
- 真实 HIS adapter。
- 真实凭证处理。
- 外部凭证管理接入。
- 权限、audit domain、audit reason、query whitelist 或 audit repository 修改。

## 当前 Plan Mode 结论

本轮可以只做 Plan Mode：

- 当前 worker 已有 retry / requeue 规划入口，但没有 retry policy。
- 当前 job queue repository 已足够支撑 requeue、retry count、max retry count 与 next attempt。
- 当前 operation repository 已足够支撑 running、failed 与 retry count 对齐。
- 可重试候选应先限于 `retryable_failure` 与受上限保护的 `provider_unavailable`。
- `timeout` 默认不 retry。
- `unsafe_unknown` 与 `validation_failed` 不 retry。
- 需要 backoff 策略。
- 需要 retry exhausted 后的 dead letter / manual review 分流。
- 当前无需新增 schema / migration。
- 当前无需接真实 provider。
- 当前无需处理真实凭证。
- 当前无需新增 runner / scheduler。
