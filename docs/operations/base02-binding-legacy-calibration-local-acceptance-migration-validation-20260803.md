# BASE-02 Binding legacy calibration `0045` 本地验收 Migration 执行证据

> 状态：`current low-sensitive execution evidence`
>
> 日期：`2026-08-03`
>
> 执行 Base：`f43cffaf6d0f399a5be793add8827d56e540584b`

## 1. 结论

```text
base02_binding_legacy_calibration_local_acceptance_migration_validation=passed
migration=0045_base02_binding_legacy_calibration
guarded_command_invocations=1
automatic_retry_count=0
planned=1
created=1
reused=0
conflict=0
unexpected=0
environment_journal_before=45/0044
environment_journal_after=46/0045
binding_current_before_after=1/1
binding_transition_before_after=0/1
exact_legacy_evidence=1
membership_before_after=1/1
scope_before_after=1/1
context_version_before_after=1/1
context_head_before_after=1/1
historical_orphan_before_after=1/1
scope_relation_orphan_before_after=1/1
scope_fk_validated=false
unauthorized_business_mutation=0
direct_sql_execution=false
pre_recovery_point=passed
post_recovery_point=passed
post_isolated_restore=passed
target_restore=0
lease_claim_consume_renew_release_active=1/1/0/1/0
execution_authority_consumed=true
active_execution_lease=0
eligible_for_0045_execution_independent_review=true
base_b2_complete=false
eligible_for_base_b3=false
```

## 2. 冻结交付链

- 实施 PR #940：Head `17d1bf2c3bb9e0b62ed1802fb12b58ccb6db4b12`，Merge Commit `b18c4fb111ed4f1828e6846b3811be0e32020fac`；
- 实施独立审查 PR #941：Merge Commit `855d1147e45b0015515aeec0d8cde3f8fcb79d0b`；
- 实施 handoff PR #942／执行 Base：Merge Commit `f43cffaf6d0f399a5be793add8827d56e540584b`；
- 仓库 journal：`46／0045`；
- 执行前环境 journal：`45／0044`；
- 执行后环境 journal：`46／0045`；
- snapshot 未修改，Runtime、Schema、package、lock 未在执行中变化。

## 3. 执行前停止事件

在唯一目标调用前存在两个 fail-closed 运维事件：

1. 首次执行编排在比较两种不同序列化公式形成的数据库指纹时停止；Lease 未消费，Migration target call 为 `0`，数据库变化为 `0`。
2. 短剩余时间 Lease 的重准备路径没有保留可用 Lease；随后执行入口在 `execution_lease_missing` 门禁停止，Migration target call 为 `0`，数据库变化为 `0`。

最终执行链重新完成只读冻结、恢复点、隔离恢复和全新不可续期 Lease，并使用与准备阶段一致的指纹公式。上述事件不构成目标 Migration 调用，也不构成自动重试。

## 4. 唯一受控执行

唯一执行入口：

```text
pnpm db:migrate
```

- guarded target call：`1`；
- automatic retry：`0`；
- direct SQL：`0`；
- 命令成功退出；
- 0045 在单一 Migration 事务内追加一条 deterministic `legacy_calibration` evidence；
- 未执行第二次目标调用。

## 5. 数据终态

| 项目 | 执行前 | 执行后 |
|---|---:|---:|
| Environment journal | 45／0044 | 46／0045 |
| Binding current | 1 | 1 |
| Binding transition evidence | 0 | 1 |
| 未校准候选 | 1 | 0 |
| exact legacy evidence | 0 | 1 |
| Membership | 1 | 1 |
| Scope | 1 | 1 |
| Context Version | 1 | 1 |
| Context Head | 1 | 1 |
| historical orphan | 1 | 1 |
| Scope relation orphan | 1 | 1 |
| Scope FK validated | false | false |

```text
planned=created=1
reused=conflict=unexpected=0
unauthorized_business_mutation=0
```

Binding current、Membership、Scope、Context、tenants 与 auth_users 的执行前后稳定指纹保持一致；唯一业务变化是新增一条 exact Binding legacy transition evidence。

## 6. exact evidence

执行后唯一 evidence 满足：

- transition type／provenance source：`legacy_calibration`；
- assignment source：精确继承 Binding current；
- actor／occurredAt／fromStatus／fromVersion／scopeRevision：`NULL`；
- reason：`legacy_unknown`；
- toStatus／toVersion：精确匹配未修改的 Binding current；
- Membership revision：精确匹配 canonical Membership；
- replacement Binding：`NULL`；
- command／evidence identity：按冻结 SHA-256 命名域确定性派生。

## 7. 恢复、Lease 与清理

- 执行前恢复点：archive 非空、hash 与 parse 通过；
- 执行后恢复点：archive 非空、hash 与 parse 通过；
- 执行后恢复点再次恢复到随机隔离数据库，journal、数据 Shape 与稳定指纹精确一致；
- 隔离数据库已删除；
- 原目标 Restore：`0`；
- Lease claim／consume／renew／release／active：`1／1／0／1／0`；
- 活动 Lease、执行锁与临时恢复资产：`0`；
- 私有路径、数据库标识、连接参数、指纹、Lease nonce 和原始行值不进入 Git 或 PR。

## 8. 持续阻断

- 0045 已被固定 local_acceptance 环境消费，不得改写或重跑；
- 本证据任务只读复核原目标，不执行新的 Migration 或 DML；
- historical orphan 保持原值；
- Scope FK 继续 `NOT VALID`；
- 仍须完成 0045 执行独立审查；
- 随后必须完成高水位／冲突／Owner Writer 清零复核；
- BASE-B2 尚未完成，BASE-B3～B6 继续阻断。
