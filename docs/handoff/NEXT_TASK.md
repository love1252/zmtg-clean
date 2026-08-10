# 下一任务

## 唯一下一任务

```text
W5 Analytics Writer symbol/callgraph audit + exact implementation allowlist admission
```

## 当前状态

```text
w2_care_complete=true
w3a_complete=true
w3b_complete=true
w3_knowledge_complete=true

w5_analytics_state=pending_symbol_callgraph_admission
w5_runtime_authorized=false

w6_institution_system=pending
trial_provisioning_classification=separate_provisioning_review
business_writer_phase_complete=false
```

## W5 当前冻结前证据

Post-W1C inventory 只有一个 W5 Analytics baseline Writer candidate：

```text
src/modules/institution/server/institution-ai-call-usage-repository.ts
```

旧清单记录 direct mutation：

```text
insert:aiCallUsageRecords
```

该证据仍属于旧 baseline，不能直接视为 Runtime admission。

W5 下一步必须先执行：

```text
1. post-W3 current-main symbol re-audit
2. direct mutation AST recompute
3. production callgraph/importer recompute
4. canonical owner / transaction boundary determination
5. exact Runtime allowlist freeze
6. test matrix freeze
7. docs-only Formal Admission PR
```

只有 Admission 合并并收到新的明确 Runtime 授权后，才能实施 W5 Runtime。

明确禁止在 W5 Admission 中执行：

```text
W5 Runtime mutation
W6 Institution System Runtime
Trial Provisioning Runtime
Schema
Migration
DB execution
Route change
Reader release
Capability release
Production change
```
