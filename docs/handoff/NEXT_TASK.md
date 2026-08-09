# 智美天工唯一下一任务

## 唯一下一任务

```text
W2-P2C Message Draft / Controlled Reach-out exact 17-file Runtime implementation explicit authorization
```

## W2-P2B 已完成

```text
implementation_pr=1116
runtime_head=36a1c4744dadd9b5d888d7fbafa08f9cabc37cef
implementation_head=022b3ae2a831e8f912d4cbc0144d63450411945b
implementation_merge=615793eb4e5e741490553461e0accc23ef74b174
independent_review_pr=1117
independent_review_merge=01730361655939aa741c73e57ff5b770fba20407

w2_p2b_runtime_implementation=passed
w2_p2b_aq004_governance_recovery=passed
w2_p2b_runtime_independent_review=passed
w2_p2b_runtime_authorization_consumed=true
w2_p2b_complete=true
```

## Scope

```text
runtime_file_count=12
governance_exception_file_count=1
total_changed_file_count=13
thirteenth_runtime_file_change=false
```

唯一 governance exception：

```text
ruleId=AQ004_FROZEN_INSTITUTION_MODULE_NEW_FILE
taskId=W2-P2B
owner=care
path=src/modules/institution/server/followup-path-enrollment-transaction.ts
review_condition=legacy Institution compatibility delegate 退出时删除
```

## P2B 后 residual

```text
residual_mutation_calls=6
residual_writer_methods=6
residual_fact_tables=1
remaining_fact=followUpMessageDrafts
```

## P2C

`docs/operations/base02-w2-p2c-message-draft-exact-runtime-allowlist-20260809.csv`

```text
exact_file_count=17
runtime_authorized=false
18th_file_requires_stop_and_readmission=true
```

## Trial Provisioning

```text
classification=separate_provisioning_review
follow_up_tasks_insert_review_pending=true
ordinary_business_dual_write=false
trial_provisioning_change=false
```

## 当前边界

```text
w2_p2a_complete=true
w2_p2b_complete=true
w2_p2c_runtime_authorized=false
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
