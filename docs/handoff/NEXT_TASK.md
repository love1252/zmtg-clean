# 下一任务

## 唯一下一任务

```text
Post-W2 Care business-writer fresh residual recompute / next-slice admission
```

## W2 Care 已完成

```text
w2_p1_complete=true
w2_p2a_complete=true
w2_p2b_complete=true
w2_p2c_complete=true
w2_p2_complete=true
w2_care_complete=true

p2c_implementation_pr=1119
p2c_implementation_head=94b86756b5e1db2515aec2de22082678422ed1d9
p2c_implementation_merge=9ee6413b0b302d89cb1eaec9a9209373afb7697f
p2c_independent_review_pr=1120
p2c_independent_review_head=eb46fd5a41608f76ad37018f2e0eaf7e7e59f3d1
p2c_independent_review_merge=2e7f0dd5f44c957d6aca204290852f254256f9e6

p2c_runtime_file_count=17
p2c_legacy_writer_methods_blocked=6
w2_care_ordinary_business_direct_mutation_residual=0
```

## 仍未完成

```text
business_writer_phase_complete=false
trial_provisioning_classification=separate_provisioning_review
trial_provisioning_review_pending=true
ordinary_business_dual_write=false
p2b_aq004_exception_retained=true
```

## 下一任务边界

下一任务只做 fresh residual / caller / owner / attribution / bypass / Trial Provisioning 分类复算和下一切片准入。

默认禁止：

```text
runtime_change
database_connection
ddl
dml
migration
seed
fk_validate
schema_change
route_change
reader_release
capability_release
audit_owner_change
trial_provisioning_runtime_change
real_wecom_send
production_change
```

不得直接复用 `base02-post-closure-business-writer-slice-matrix-20260808.csv` 作为当前事实；必须从 `2e7f0dd5f44c957d6aca204290852f254256f9e6` 基线 fresh recompute 后再决定下一 Runtime slice。
