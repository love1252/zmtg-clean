# 下一任务

## 唯一下一任务

```text
Trial Provisioning Writer fresh residual audit + ownership classification / closure decision
```

## 当前 Business Writer 状态

```text
w2_care_complete=true
w3_knowledge_complete=true
w5_complete=true
w6a_complete=true
w6b_complete=true
w6_institution_system_complete=true

trial_provisioning_classification=separate_provisioning_review
trial_provisioning_review=pending

business_writer_phase_complete=false
```

## Trial Provisioning 下一步边界

本任务只做 fresh residual / callgraph / transaction / ownership review，先判断现有 Trial Provisioning Writer 是否：

```text
A. 已属于正确 canonical Provisioning Owner，只需治理闭环；
B. 仍需 Writer ownership migration，需要单独 Formal Admission + Runtime 授权。
```

审计必须重新计算：

```text
direct mutation calls
direct writer files
fact tables
production constructors/callers
transaction boundaries
tenant/institution scope
provisioning-only invariants
```

在 fresh review 完成前，不预设 Runtime scope，也不授权 Runtime。

继续禁止：

```text
Trial Provisioning Runtime before Formal Admission + explicit authorization
Schema
Migration
DB execution
API Route change
Reader release
Capability release
real HIS / real WeCom
production change
```
