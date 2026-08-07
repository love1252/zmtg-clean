# BASE-B5 跨 tenant Membership／Transfer 决策独立审查

> 日期：`2026-08-07`
>
> 被审查 PR：#1052
>
> 被审查 Merge Commit：`426a320957389b248c43e2f868a8feee1f7ca07c`
>
> 状态：`independent_review_passed_with_xt09_blocker`

## 结论

```text
user_decision_confirmation_received=true

xt01_accepted=true
xt02_accepted=true
xt03_accepted=true
xt04_accepted=true
xt05_preplanning_accepted=true
xt06_preplanning_accepted=true
xt07_preplanning_accepted=true
xt08_accepted=true

xt09_technical_admission=blocked_invariant_conflict
xt10_technical_admission=blocked_by_xt09

cross_tenant_transfer_orchestration_preplanning_admitted=true
cross_tenant_transfer_implementation_authorized=false
base_b5_success_criteria_conflict=true
base_b5_execution_ready=false

eligible_for_handoff=true
```

## 审查要点

- 用户 XT01–XT10 决策确认已被正确记录；
- 没有把用户确认扩大为数据库、DML、Migration 或 remediation 授权；
- XT01–XT08 的设计／preplanning 准入与现有 Membership／Binding Owner 规则兼容；
- existing standalone Binding `rebind` 继续保持 same-tenant；
- cross-tenant transfer 仅作为 `target create + source revoke` orchestration 方向；
- single outer SERIALIZABLE transaction、transaction-bound UoW、Scope assertion、CAS、command replay、append-only evidence 可作为未来实现基础；
- formal onboarding external transaction adapter 不得被直接扩展成跨 tenant transfer 旁路。

## XT09 invariant conflict

现有 accepted Binding 规则同时要求：

1. revoked Binding identity 永久保留；
2. tenant／institution identity tuple 不可原地改写；
3. BASE-B2 不提供 DELETE；
4. B5 deterministic rebind 冻结成功条件要求 relation orphan `1→0`。

因此当前无 Schema／无 delete 的 transfer 成功后只能得到：

```text
active_orphan=0
relation_orphan=1
```

不得把“访问风险关闭”写成“BASE-B5 已完成”。

## Release 边界

XT09 未解决前：

- BASE-B5 complete=false；
- BASE-02 complete=false；
- Reader／Capability 继续关闭；
- transfer implementation/execution 未授权；
- historical orphan remediation 未授权。

本审查未连接数据库，未执行 DDL、DML、Migration、Seed、FK VALIDATE 或任何 Membership／Binding 写入。
