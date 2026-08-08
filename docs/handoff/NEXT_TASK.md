# 智美天工唯一下一任务

## 唯一下一任务

```text
W2 Care Writer symbol/callgraph audit + exact implementation allowlist admission
```

## W1 Customers / Messaging 已完成

```text
w1a_complete=true
w1b_complete=true
w1c_p1_complete=true
w1c_p2_complete=true
w1c_complete=true
w1_customers_messaging_complete=true
```

W1C-P2 已完成：

- Messaging canonical reach-out persistence port / Writer；
- customerChannelFrequencyStates single direct Writer；
- Audit canonical Owner；
- Real-send operation + frequency completion + audit evidence same-transaction；
- legacy Safety direct Writer blockade；
- legacy Real-send direct frequency/audit Writer removal；
- legacy transaction canonical orchestration delegation；
- W1C Routes 继续 capability-off。

## Business Writer inventory 重新审计

```text
business_writer_baseline_surface_files=27
business_writer_post_w1c_closed_or_terminal_files=9
business_writer_post_w1c_pending_review_files=18

w2_care_pending_files=2
provisioning_review_pending_files=1
w3_knowledge_pending_files=9
w5_analytics_pending_files=1
w6_institution_system_pending_files=5

business_writer_phase_complete=false
```

证据：

`docs/operations/base02-business-writer-post-w1c-inventory-audit-20260809.csv`

## 为什么下一任务是 W2 Care

W1 symbol audit 已明确：

```text
src/modules/institution/server/treatment-summary-repository.ts
  classification=real_writer_wrong_slice
  proposed_owner=Care
  proposed_action=reassign_W2_CARE
```

同时：

`src/modules/institution/server/tenant-business-repository.ts`

虽然 Customers core 已完成 canonical Writer 收口，但仍属于 mixed legacy aggregate，需要在 W2 对 Care / Follow-up residual direct Writer 做逐符号拆分审查。

`src/modules/institution/server/trial-provisioning-service.ts` 保留独立 Provisioning review，不自动并入 W2 Runtime。

## W2 本轮只做 admission

必须：

1. 对 Care / Follow-up mutation symbols 逐方法复核；
2. 枚举 production callers / routes / services / transactions；
3. 分离 tenant-business residual Care Writer；
4. 确认 treatment-summary canonical Owner；
5. 识别并关闭 old Writer / dual-write / bypass；
6. 冻结 exact Runtime implementation allowlist；
7. 冻结 negative / tenant+institution / CAS / atomicity tests；
8. 如需要 Schema/Migration，单独重新准入。

当前仍禁止：

```text
w2_care_runtime_authorized=false
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

本任务不是 W2 Runtime 授权。
