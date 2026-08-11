# 下一任务

## 唯一下一任务

```text
W6A HIS Connection Core exact 16-file Runtime implementation explicit authorization
```

## W6 Admission 状态

```text
w5_complete=true

w6_symbol_callgraph_audit=passed
w6_transaction_audit=passed
w6_decomposition_frozen=true
w6_canonical_owner=institution-system

w6a_his_connection_core_admission=passed
w6a_exact_runtime_file_count=16
w6a_runtime_authorized=false

w6b_compensation_audit=passed
w6b_runtime_allowlist_frozen=false
w6b_runtime_authorized=false
w6b_blocked_pending_domain_port_ownership_admission=true

business_writer_phase_complete=false
```

W6A 冻结清单：

`docs/operations/base02-w6a-his-connection-core-exact-runtime-allowlist-20260811.csv`

W6A 只迁移 `hisConnections` Writer ownership，保留现有 Reader、Audit transaction、synthetic credential provider、fake test-connection 和 API Route 契约。

第 17 个 Runtime 文件必须 `STOP / re-admit`。

W6B compensation 不包含在 W6A 授权中。W6A 完成并 Handoff 后，再单独完成 W6B domain/port ownership Admission。

必须收到明确 Runtime 授权后才可实施 W6A。
