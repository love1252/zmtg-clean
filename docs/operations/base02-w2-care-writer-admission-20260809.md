# W2 Care Writer Symbol / Callgraph Admission

> 日期：`2026-08-09`
>
> 状态：`admission_passed`
>
> Runtime：`not_authorized`

## 分解

```text
W2-P1 Treatment Summary
W2-P2 Appointments / Follow-up residual
```

### W2-P1

```text
treatment_summary_mutation_calls=3
production_writer_callers=0
caller_detection=repository_member_call_aware
previous_bare_name_false_positive_excluded=true
owner=care
exact_runtime_allowlist_file_count=6
runtime_authorized=false
```

Writer methods：

```text
createTreatmentSummary
updateTreatmentSummaryByTenant
voidTreatmentSummaryByTenant
```

create/update/void 三个正式 Route 均继续 `capability_disabled`，因此 P1 可先建立 Care canonical Writer 并关闭 legacy direct Writer，不需要本切片修改 Route。

P1 command 必须使用 server-side `tenantId + institutionId`；canonical repository 必须通过 customer ownership 验证机构归属，appointment reference 还必须绑定同一 tenant / institution / customer。跨机构、空归属或不匹配必须 fail-closed。

Exact allowlist：

`docs/operations/base02-w2-p1-treatment-summary-exact-runtime-allowlist-20260809.csv`

如实现需要第 7 个文件或 Schema/Migration，停止并重新准入。

### W2-P2

```text
residual_mutation_calls=15
residual_writer_methods=15
production_callers=5
fact_tables=6
runtime_allowlist_frozen=false
runtime_authorized=false
```

Residual facts 覆盖 appointments、follow-up tasks、path enrollments/stages、message drafts、customer timeline。P2 需要单独冻结 transaction、timeline evidence Owner、institution attribution、production caller rewire 与 exact allowlist，不得混入 P1。

## 当前状态

```text
w1c_complete=true
w2_care_admission=passed
w2_decomposition_frozen=true
w2_p1_exact_runtime_allowlist=frozen
w2_p1_exact_runtime_allowlist_file_count=6
w2_p1_runtime_authorized=false
w2_p2_runtime_allowlist_frozen=false
w2_p2_runtime_authorized=false
w2_care_complete=false
business_writer_phase_complete=false
```

下一任务：

`W2-P1 Treatment Summary exact 6-file Runtime implementation explicit authorization`
