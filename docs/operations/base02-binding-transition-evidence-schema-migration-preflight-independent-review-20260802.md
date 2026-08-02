# BASE-02 Binding transition evidence Schema／Migration 前置预检独立审查

> 状态：`current evidence + independent review`
>
> 审查日期：`2026-08-02`
>
> 冻结对象：PR #917 Head `97c02f1250f5f5fbff468b17953074db5b67eb4c`
>
> PR #917 Merge Commit：`77a626ed182230f91b6d27daeaa4b0f297b377d9`
>
> Required Check Run：`30750704426`

## 1. 审查结论

```text
binding_transition_evidence_preflight_review=passed
binding_transition_evidence_preflight=passed
binding_transition_evidence_current_owner=Access_Control
binding_transition_evidence_is_second_current=false
binding_physical_model_decision_required=false
eligible_for_binding_schema_migration_implementation_handoff=true
eligible_for_binding_schema_migration_implementation=false
base_b2_complete=false
eligible_for_base_b3=false
```

## 2. 范围与事实核对

- PR #917 为单提交、单文件 docs-only 前置预检；
- 未修改 Schema、Migration、journal、snapshot、Runtime、scripts、tests、CI、package 或 lock；
- 未创建 Migration Lease、未分配编号、未执行 DDL／DML／Migration／Seed；
- 固定 localhost-only 探针为 `REPEATABLE READ + READ ONLY`，前后均未分配事务 ID；
- 当前 Binding canonical current 继续是 `auth_account_institution_bindings`；
- transition evidence 只保存不可变历史，不回答 current，不参与授权判断；
- Access Control 继续是唯一 Owner，没有形成第二套 Binding current。

## 3. 物理模型复核

预检冻结的唯一物理方向与 M09-A accepted decision 一致：

- 独立表 `auth_account_institution_binding_transitions`；
- 原／replacement Binding 复合关系；
- command replay 唯一性；
- Binding／目标 version 唯一性；
- create／rebind／revoke／expire／legacy_calibration Shape；
- evidence append-only；
- Binding current identity／tuple／assignment provenance 不可变；
- current 与 evidence 同事务、expected version CAS、affected rows 精确为 1；
- AQ008 扩展为 Binding current 与 evidence 的 Owner 写入门禁。

未发现需要新增一轮 physical model accepted decision 的未冻结选项。

## 4. 持续阻断

- Schema／Migration 实施必须等待本审查与 handoff 合并；
- Migration 编号、Lease、恢复点和 local_acceptance 执行仍须实时冻结；
- historical orphan 保持原值；
- A2-P2 Scope FK 继续 `NOT VALID`；
- BASE-B3～B6、项目级 Writer、Audit／模板、MIG-01B／C 和业务 Reader未启动。

## 5. 最终判断

PR #917 的证据、结论、物理 Shape、串行切片与停止条件一致且无范围漂移，可以进入独立 handoff。该判断不直接启动或执行 Schema／Migration。
