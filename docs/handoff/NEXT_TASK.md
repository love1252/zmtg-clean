# 智美天工唯一下一任务

## 唯一下一任务

```text
W2-P2A Appointments exact 6-file Runtime implementation explicit authorization
```

## W2-P2 Admission 已完成

```text
admission_pr=1110
admission_merge=762aa5e4cb0f22c8b296d366be51363e9bf508a5
independent_review_pr=1111
independent_review_merge=0f5afa641ce276839a45fb2c8ec440233c1c9134

w2_p2_admission=passed
w2_p2_admission_independent_review=passed
w2_p2_decomposition_frozen=true
transaction_groups=14
```

Fresh facts：

```text
residual_mutation_calls=15
residual_writer_methods=15
residual_fact_tables=6
production_caller_files=5
canonical_owner=care
```

## Runtime decomposition

### P2A Appointments

`docs/operations/base02-w2-p2a-appointments-exact-runtime-allowlist-20260809.csv`

```text
exact_file_count=6
runtime_authorized=false
7th_file_requires_stop_and_readmission=true
```

### P2B Follow-up Task / Path / Timeline

`docs/operations/base02-w2-p2b-followup-path-timeline-exact-runtime-allowlist-20260809.csv`

```text
exact_file_count=12
runtime_authorized=false
13th_file_requires_stop_and_readmission=true
```

### P2C Message Draft / Controlled Reach-out

`docs/operations/base02-w2-p2c-message-draft-exact-runtime-allowlist-20260809.csv`

```text
exact_file_count=17
runtime_authorized=false
18th_file_requires_stop_and_readmission=true
```

Aggregate unique future Runtime set：

```text
28 files
29th unique file requires stop and re-admission
```

禁止一次性实施 aggregate 28-file Runtime；必须 P2A → P2B → P2C 逐片授权。

## Trial Provisioning

```text
classification=separate_provisioning_review
w2_p2_direct_mutations=2
ordinary_business_dual_write=false
trial_provisioning_change=false
```

当前两条 provisioning mutation 为 `appointments` / `followUpTasks` insert；不得混入 P2A/P2B/P2C。

## 当前边界

```text
w2_p1_complete=true
w2_p2_runtime_authorized=false
w2_care_complete=false
business_writer_phase_complete=false

database_connection=false
runtime_change=false
ddl=false
dml=false
migration=false
seed=false
fk_validate=false
schema_change=false
route_change=false
reader_release=false
capability_release=false
audit_owner_change=false
trial_provisioning_change=false
production_change=false
```
