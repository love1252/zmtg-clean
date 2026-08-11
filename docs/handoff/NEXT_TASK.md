# 下一任务

## 唯一下一任务

```text
POST-V2-R1A Institution Capability Authority Foundation Preflight + exact Runtime admission decision
```

## R1 conclusion

```text
post_v2_r1_readiness_audit=passed
post_v2_r1_complete=true

page_capability_count=26
eligible_page_count=0
blocked_page_count=26

workbench_capability_off_count=1
catch_all_capability_off_count=25

authority_bearing_evaluator_exists=false
authority_bearing_reader_exists=false

common_authority_foundation_required=true

reader_release=false
capability_release=false
runtime_authorized=false
```

Evidence:

- `docs/operations/post-v2-r1-institution-readonly-release-readiness-audit-20260811.md`
- `docs/operations/post-v2-r1-institution-readonly-release-readiness-matrix-20260811.csv`

## R1A objective

R1A 必须先冻结统一 Capability Authority Foundation，不能逐页实现 26 个 Reader。

至少审计并决定：

```text
authority owner
authoritative owner facts contract
formal provenance input
fresh active membership input
active institution anchor input
trusted server clock
diagnostic route guard
capability revision
authority-bearing decision contract
failure semantics
exact Runtime allowlist
targeted tests
architecture constraints
rollback / fail-closed
```

R1A 是 preflight/admission。

它不得直接：

```text
修改 Runtime
打开 Reader
打开 Capability
放行 3 个 controlled-create action
连接 DB / Migration
调用真实外部系统
发布生产
```

若最终需要 Runtime，必须在 R1A 完成后取得新的显式 Runtime 授权。
