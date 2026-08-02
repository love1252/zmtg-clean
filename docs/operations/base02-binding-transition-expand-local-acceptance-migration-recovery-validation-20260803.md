# BASE-02 Binding transition evidence Expand `0044` 本地执行恢复核验

## 1. 结论

```text
base02_binding_transition_expand_local_acceptance_recovery_validation=passed
migration=0044_base02_binding_transition_expand
guarded_command_invocations=1
automatic_retry_count=0
migration_outcome=success
environment_journal_before=44
environment_journal_after=45
catalog_before=all_missing
catalog_after=all_exact
transition_evidence_rows=0
business_dml=0
sequence_advance=0
initial_text_hash_gate=false_positive
text_gate_classification=non_authoritative_text_serialization
deterministic_table_fingerprint_equal=true
deterministic_sequence_fingerprint_equal=true
post_execution_backup_restore=passed
execution_authority_consumed=true
active_execution_lease=0
eligible_for_0044_execution_independent_review=true
eligible_for_binding_runtime_writer=false
base_b2_complete=false
eligible_for_base_b3=false
```

## 2. 事件说明

固定 localhost-only `local_acceptance` 已唯一执行一次 guarded `0044`，命令成功退出。首次编排器随后使用原始 `pg_dump --data-only` 文本哈希进行业务数据守恒核验，因文本序列化并非稳定事实指纹而触发停止。

本恢复任务没有再次运行 Migration。它使用执行前 custom-format 恢复点在隔离数据库重建 pre-state，并与当前目标数据库执行逐表、逐序列的确定性事实比较。全部既有 public 表和序列一致，因此首次文本哈希差异被归类为非权威后置门禁误报，而不是业务数据漂移。

## 3. 冻结链路

- 执行／恢复 Base：`a15fb7fd8df7c72d4f81a319b7686ed2594e7f42`
- 实施 PR：#920，Merge Commit `a4b99e6a6384bdc1ee43047be5ebef644eeff90a`
- 实施独立审查 PR：#921，Merge Commit `a15fb7fd8df7c72d4f81a319b7686ed2594e7f42`
- 仓库 journal／latest：`45／0044`
- 环境执行前 journal／latest：`44／0043`
- 环境执行后 journal／latest：`45／0044`
- snapshot：继续保持 `0026`

## 4. 唯一执行事实

首次终端记录精确包含：

```text
guarded_command_invocations=1
automatic_retry=0
migration guard passed for local 0044
```

恢复核验没有调用 `pnpm db:migrate`，没有直接执行 Migration SQL，也没有第二次数据库目标调用。

## 5. Catalog 终态

| 项目 | 结果 |
|---|---:|
| transition enum | exact |
| transition table | exact |
| transition constraints | `10` |
| transition append-only triggers | `2` |
| Binding current protection triggers | `3` |
| Binding tenant/id UNIQUE | `1` |
| transition evidence rows | `0` |
| Scope FK validated | `false` |

## 6. 数据与序列守恒

执行前恢复点与当前目标分别计算：

- 相同 pre-existing public 表集合；
- 每表稳定排序后的 row JSON 聚合指纹；
- 全部 public sequence 的 `last_value／is_called`；
- Binding total／active／revoked；
- Membership orphan；
- Scope relation orphan。

结果：

```text
deterministic_table_fingerprint_equal=true
deterministic_sequence_fingerprint_equal=true
business_dml=0
sequence_advance=0
```

Binding 聚合前后均为 `1|1|0`；Membership orphan 为 `0`；Scope relation orphan 为 `1`，均未变化。

## 7. 恢复点

- 执行前恢复点：archive parse 通过，并恢复到随机隔离数据库验证 journal `44／0043`、0044 对象缺失；
- 恢复后补建执行后恢复点：archive parse 通过，并恢复到随机隔离数据库验证 journal `45／0044`、Catalog exact、transition rows `0`；
- 隔离数据库全部删除；
- 原目标 Restore 为 `0`；
- 恢复点路径、容器、连接参数、角色、摘要和原始数据不进入 Git 或 PR。

## 8. Lease 与清理

首次执行权已经由唯一 guarded 调用消费。原编排器在停止时完成临时 Lease 清理；当前活动 Execution Lease 为 `0`。本恢复任务建立不可覆盖低敏 terminal record，但不补造第二次执行或第二份 Migration 结果。

## 9. 持续阻断

- `0044` 已被固定本地验收环境消费，不得改写或重跑；
- 本证据 PR 不连接数据库、不执行 Migration；
- Binding Runtime Writer 尚未启动；
- legacy calibration 尚未执行；
- historical orphan 保持原值；
- A2-P2 Scope FK 继续 `NOT VALID`；
- BASE-B3～B6、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader继续阻断。
