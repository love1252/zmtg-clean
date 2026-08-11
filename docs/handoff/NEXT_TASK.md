# 下一任务

## 唯一下一任务

```text
W6 Institution System Writer symbol/callgraph audit + exact implementation allowlist admission
```

## 当前状态

```text
w2_care_complete=true
w3_knowledge_complete=true
w5_complete=true

w6_institution_system_state=pending_symbol_callgraph_admission
w6_runtime_authorized=false

trial_provisioning_classification=separate_provisioning_review
business_writer_phase_complete=false
```

## W6 当前冻结前证据

旧 post-W1C inventory 有 5 个 W6 baseline candidate，其中 4 个带 direct mutation、1 个无 direct mutation UI candidate。

这些旧证据不构成 Runtime Admission。W6 必须先重新完成 current-main symbol audit、direct mutation AST、production callgraph、Owner/transaction boundary、exact allowlist 和 test matrix，再走 docs-only Formal Admission。

在新的明确 Runtime 授权前，禁止 W6 Runtime、Trial Provisioning Runtime、Schema、Migration、DB execution、Route change、Reader/Capability release、真实 HIS 和 production change。
