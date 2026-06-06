# Phase 23 HIS 连接配置凭证补偿 outbox 与 job queue 后续拆分计划

> 日期：2026-06-06
> 状态：docs-only Plan Mode。本文只给后续实现 PR 拆分提供中文计划，不包含代码步骤，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现 outbox / job queue，不实现 worker / claim / lock，不实现 compensation audit，不处理真实凭证，不做测试连接，不接真实 HIS adapter。

## 本轮只读结论

当前 compensation operation 表和 repository 已能承载补偿链路事实，但不能替代 outbox / job queue：

- operation 表有 `operationId`、tenant / connection、state、failure category、retryCount、manualReviewRequired、lastAttemptAt 和 completedAt。
- operation repository 有 pending query 和 stale running query。
- 但当前没有 job payload、nextAttemptAt、claimId、lockedUntil、claimVersion、worker id、deadLetterReason、manual review queue 或 job attempt 记录。
- 因此后续不能只靠 operation repository 实现 worker。

本轮满足 Plan Mode 条件：

- 可以不改 schema / migration。
- 可以不实现 runtime 代码。
- 可以只新增 / 更新文档。
- 必须把后续 schema、repository、worker、service 和 audit integration 拆成独立 PR。

## 后续拆分总览

后续建议至少拆成七个 PR：

1. outbox / job queue schema / migration 最小边界。
2. outbox / job queue repository 最小实现。
3. worker claim / lock / stale recovery 最小实现。
4. compensation audit repository / service integration。
5. service 接入 compensation operation + outbox 写入。
6. dead letter / manual review 最小闭环。
7. 后续真实 provider / secret manager / HIS adapter Plan Mode。

这些 PR 不应合并成一个大实现。原因是 schema、worker 并发、audit fail closed、provider 副作用和 manual review 权限都是独立风险面。

## PR 1：outbox / job queue schema / migration 最小边界

建议范围：

- 新增 outbox / job queue 表，或明确采用单表承载 outbox 语义和 job queue 执行语义。
- 字段至少评估 `tenantId`、`connectionId`、`operationId`、job state、operation type、failure category、retryCount、maxRetryCount、nextAttemptAt、lockedUntil、claimVersion、claimedBy、deadLetterReason、manualReviewRequired、createdAt、updatedAt。
- 建立 tenant / state / nextAttemptAt 索引。
- 建立 operationId 关联索引。
- 建立 claim / lock 相关索引。
- 补 schema / migration tests。

禁止范围：

- 不接 service。
- 不实现 worker。
- 不写 provider 调用。
- 不写 compensation audit。
- 不保存真实凭证、`credentialRef`、provider path、secret path、request body、response body、provider raw error、SQL、stack 或 `DATABASE_URL`。

完成后应能回答：

- 表结构如何表达 queued / claimed / running / succeeded / failed / dead letter / manual review。
- operation 表和 job 表如何关联。
- claim / lock 所需字段是否齐备。
- stale recovery 是否有索引支撑。

## PR 2：outbox / job queue repository 最小实现

建议范围：

- 新增 repository factory。
- create job。
- get job by tenant + operationId。
- list due queued jobs。
- claim due job。
- mark running。
- mark succeeded。
- mark failed。
- requeue retry。
- mark dead letter。
- mark manual review required。
- release expired lock 或 stale recovery 标记。

关键边界：

- 所有读写绑定 `tenantId + connectionId + operationId`。
- claim 更新条件包含当前 state、`nextAttemptAt <= now`、lock 未持有或已过期。
- worker 写回必须带 claimVersion 或 claimId。
- 旧 claim 写回必须拒绝。
- repository 不调用 provider。
- repository 不写 audit。
- repository 不读取 request / header / query / localStorage。

测试建议：

- tenant isolation。
- 并发 claim。
- lock 过期重领。
- nextAttemptAt 未到不领取。
- retry count 递增。
- dead letter transition。
- manual review transition。
- 敏感字段不落库、不返回。

## PR 3：worker claim / lock / stale recovery 最小实现

建议范围：

- 新增最小 worker runner 或 worker service。
- 从 job queue claim 到期任务。
- claim 成功后把 operation 标记 `compensation_running`。
- provider 调用先使用 test-only provider 或 no-op 安全补偿动作，真实 provider 不进入本 PR。
- 根据结果推进 operation 和 job state。
- 处理 stale running。
- 拒绝旧 claim 写回。

关键边界：

- worker 可以跨 tenant 扫描 due job，但每条 job 执行必须带 tenant scope。
- provider 调用不在长数据库事务内。
- stale recovery 不盲目重复不可幂等 provider 动作。
- 不能处理真实凭证。
- 不能做测试连接。
- 不能接真实 HIS adapter。

测试建议：

- claim 后 operation running。
- claim conflict。
- stale job recovery。
- stale operation recovery。
- retryable failure 重新排队。
- unsafe failure 进入 manual review。
- retry exhausted 进入 dead letter。

## PR 4：compensation audit repository / service integration

建议范围：

- 新增 compensation audit helper 或 service。
- 复用 `open_connection` resource。
- 复用 `manage_credentials` action。
- 复用既有 compensation reason。
- 明确 `compensation_succeeded` 使用 `allowed`，其他 compensation 状态使用 `denied`。
- 保证同一 operationId + state transition 不重复写 audit。
- 明确 audit 写入失败后的 fail closed / retry / manual review 口径。

关键边界：

- route 不写 compensation audit。
- provider 不写 compensation audit。
- operation repository 不写 compensation audit。
- job queue repository 不决定 audit reason。
- 若需要 audit metadata，必须先另开 schema / migration 与 audit repository PR。

测试建议：

- audit reason / result 映射。
- 幂等去重。
- audit failure 收口。
- 不泄露 operation 内部禁区。
- provider failure audit 现有行为不回归。

## PR 5：service 接入 compensation operation + outbox 写入

建议范围：

- credential service 在 provider / repository / audit 不一致风险出现时创建 compensation operation。
- service 在同一 transaction 内创建 operation + outbox / job。
- service 返回稳定错误，不暴露内部 job 或 provider 细节。
- service 不直接执行后台补偿。
- service 不把 operationId 默认返回前端。

关键边界：

- operationId 只由 server 生成。
- 不接受 request 传入 operationId。
- 不保存真实凭证。
- 不新增 API route。
- 不做测试连接。
- 不接真实 HIS adapter。

测试建议：

- provider store 后 repository 失败创建 operation + job。
- audit after provider failed 创建 operation + job。
- operation + job 同事务。
- job 创建失败时返回稳定 service_unavailable。
- allowed audit / provider failure audit 现有行为不回归。

## PR 6：dead letter / manual review 最小闭环

建议范围：

- deadLetterReason 稳定枚举。
- retry exhausted 后进入 dead letter。
- unsafe failure 后进入 manual review。
- manual review 安全 read model。
- 后续人工处理权限与 API 只做 Plan Mode，除非已另行批准。

关键边界：

- manual review 不展示真实凭证。
- manual review 不展示 provider path、secret path、`credentialRef`、idempotencyKey、request body、response body、provider raw error、SQL、stack。
- 普通机构用户默认不可见。
- 平台安全治理角色的权限、API、UI 必须另开评估。

测试建议：

- dead letter 只保存安全摘要。
- manual review 只返回安全摘要。
- retry exhausted 分流。
- unsafe provider result 分流。
- stale recovery 不确定时分流。

## PR 7：真实 provider / secret manager / HIS adapter Plan Mode

建议范围：

- 只做 Plan Mode。
- 规划真实 KMS / Vault / secret manager。
- 规划真实 HIS adapter。
- 规划测试连接。
- 规划真实凭证一次性材料 parser / service。
- 规划 provider cleanup 幂等。

明确仍不在前六个 PR 中进入：

- 不接真实 KMS / Vault / secret manager。
- 不保存真实凭证。
- 不做测试连接。
- 不接真实 HIS adapter。
- 不导入真实客户数据。
- 不保存 raw HIS payload。
- 不做自动摘要、自动任务或自动触达。

## 横向验收口径

每个后续实现 PR 都应单独验证：

- 禁止范围未越界。
- tenant isolation 成立。
- 幂等边界成立。
- 不泄露敏感字段。
- 不保存真实凭证。
- 不接真实 HIS。
- 不做测试连接。
- audit / provider / repository / worker 职责没有混用。

后续实现 PR 的验证命令应按实际改动选择；本轮 docs-only 不运行 runtime 测试。
