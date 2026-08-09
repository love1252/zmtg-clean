# 智美天工唯一下一任务

## 唯一下一任务

```text
W2-P1 Treatment Summary exact 6-file Runtime implementation explicit authorization
```

## W2 Care Admission 已完成

```text
w2_care_symbol_audit=passed
w2_care_callgraph_audit=passed
w2_care_admission=passed
w2_care_admission_independent_review=passed
w2_decomposition_frozen=true
```

## W2-P1 exact allowlist

`docs/operations/base02-w2-p1-treatment-summary-exact-runtime-allowlist-20260809.csv`

```text
1. src/modules/care/application/treatment-summary-command-service.ts
2. src/modules/care/server/treatment-summary-command-repository.ts
3. src/modules/care/tests/TreatmentSummaryCommandService.test.ts
4. src/modules/care/tests/TreatmentSummaryCommandRepository.test.ts
5. src/modules/institution/server/treatment-summary-repository.ts
6. src/modules/institution/tests/TreatmentSummaryRepository.test.ts
```

P1 必须强制 server-side tenantId + institutionId、customer ownership、appointment ownership、cross-institution fail-closed、legacy Writer blockade，并保持 create/update/void Routes capability-off。

## W2-P2

tenant-business 的 appointments / follow-up mixed residual Writer 保持单独待准入：

```text
w2_p2_runtime_allowlist_frozen=false
w2_p2_runtime_authorized=false
```

## 当前边界

```text
w2_p1_runtime_authorized=false
w2_p2_runtime_authorized=false
w2_care_complete=false
business_writer_phase_complete=false
database_connection=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
schema_change=false
route_change=false
reader_release=false
capability_release=false
production_change=false
```

如 P1 需要第 7 个文件或 Schema/Migration，立即停止并重新准入。
