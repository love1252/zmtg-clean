# 下一任务

## 唯一下一任务

```text
Full-repo Business Writer fresh residual recompute + phase completion decision
```

## Current state

```text
w2_care_complete=true
w3_knowledge_complete=true
w5_complete=true
w6_institution_system_complete=true
trial_provisioning_complete=true

business_writer_final_recompute=pending
business_writer_phase_complete=false
```

Trial Provisioning 已完成：

```text
runtime_pr=1144
runtime_merge=d1e56026be4f5fc7cea210a3b36860a4535ecd6c
runtime_file_count=2
runtime_new_file_count=0

independent_review_pr=1145
review_evidence_repair_pr=1146
review_evidence_repaired=true

direct_mutation_calls=0
direct_writer_files=0
db_access=0
production_callers=0
route_callers=0
legacy_service_blocked=true
dynamic_blockade_test_embedded=true
architecture_exception_added=false
```

下一轮必须从当前 main 全仓重新计算 Business Writer residual。

不得因为 W2 / W3 / W5 / W6 / Trial Provisioning 均分别 complete 就直接推导：

```text
business_writer_phase_complete=true
```

只有 full-repo fresh residual recompute 同时证明：

```text
unclassified_business_writer_residual=0
legacy_cross_owner_direct_writer_residual=0
unexpected_production_writer_residual=0
```

并完成对应 closure review / handoff 后，才允许标记 Business Writer phase complete。

若 fresh recompute 发现任何新的未分类 Writer、production caller、Route、Schema/DB 或 ownership drift，必须 fail-closed 并单独 re-admit。
