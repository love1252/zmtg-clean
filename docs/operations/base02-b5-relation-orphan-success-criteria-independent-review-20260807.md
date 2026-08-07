# BASE-B5 relation-orphan 终态与成功标准 ADR 独立审查

> 日期：`2026-08-07`
>
> 被审查 PR：#1055
>
> 被审查 Merge Commit：`0dea160ad1267f9ddd74c7d9bba0279cd0c71616`
>
> 状态：`passed`

## 1. 审查结论

```text
relation_orphan_terminal_state_option=1
adr_decision=accepted
independent_review=passed

m09a_immutable_preserved=true
binding_no_delete_preserved=true
historical_tuple_rewrite=false

active_authorization_orphan_must_zero=true
active_scope_relation_orphan_must_zero=true
retained_revoked_historical_relation_orphan_allowed=true
retained_revoked_historical_relation_orphan_expected_count=1

xt09_technical_admission=resolved_by_adr
xt10_release_boundary_decision=execution_still_required

base_b5_success_criteria_conflict=false
base_b5_execution_ready=false
eligible_for_handoff=true
```

## 2. 一致性审查

通过：

- ADR 没有重开 M09-A；
- 没有将 revoked historical row 删除、归档或原地改写；
- active 授权完整性和历史保留事实被明确分域；
- retained historical relation 只有在 revoked + evidence complete + 不参与授权时才可被接受；
- 旧历史 matrix 未被改写，ADR 以 supersession 方式记录新语义；
- 没有把 ADR 接受扩大为 implementation/execution/DML 授权。

## 3. Release 审查

XT09 架构冲突已解除，但 BASE-B5 仍未完成。只有未来：

1. implementation admission；
2. 实现与独立审查；
3. 单独数据库 execution authorization；
4. live readonly preflight；
5. 受控执行；
6. 独立 readonly postcheck；

全部通过后，XT10 才有资格进入 BASE-B5 completion review。

## 4. 本次未发生

- 数据库连接：0；
- DDL/DML/Migration：0；
- Membership/Binding 写入：0；
- historical orphan remediation：0；
- Reader/Capability release：0。
