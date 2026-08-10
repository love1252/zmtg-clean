# 下一任务

## 唯一下一任务

```text
W3B Knowledge Quota Usage exact 13-file Runtime implementation explicit authorization
```

## 当前状态

```text
w2_care_complete=true
w3_knowledge_admission=passed
w3_decomposition_frozen=true

w3a_runtime_implementation=passed
w3a_runtime_independent_review=passed
w3a_complete=true

w3b_exact_runtime_file_count=13
w3b_runtime_authorized=false

w3_knowledge_complete=false
business_writer_phase_complete=false
```

## W3B 边界

W3B 仅处理 `knowledgeQuotaUsageRecords` 的 canonical Knowledge Writer、显式 tenant-level / institution-level scope、三个 production caller rewire，以及 legacy Institution quota Writer blockade。

冻结 exact Runtime allowlist：

`docs/operations/base02-w3b-knowledge-quota-exact-runtime-allowlist-20260810.csv`

```text
exact_runtime_file_count=13
14th_runtime_file_requires_stop_and_readmission=true
```

Quota scope：

```text
InstitutionQuotaScope = tenantId + non-null institutionId
TenantQuotaScope      = tenantId + explicit tenant scope; persisted institutionId = null
```

明确禁止：

```text
W3A Runtime change
W5 Analytics
W6 Institution System
Trial Provisioning Runtime
Schema
Migration
DB execution
Route change
Reader release
Capability release
Production change
```

W3B Runtime 当前仍未授权；必须收到明确授权后才可实施。
