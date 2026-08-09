# W2-P2 Care / Follow-up Residual Writer Transaction / Callgraph Admission

> 日期：`2026-08-09`
>
> 状态：`admission_passed`
>
> Runtime：`not_authorized`

## 1. Fresh recompute

本 Admission 从当前源码重新计算，不复用旧计数：

```text
residual_mutation_calls=15
residual_writer_methods=15
residual_fact_tables=6
production_caller_files=5
production_call_edges=12
schema_change_required=false
```

6 张事实表：

```text
appointments
followUpTasks
followUpPathEnrollments
followUpPathStages
followUpMessageDrafts
followUpCustomerTimelineEvents
```

## 2. Canonical Owner

上述 6 张表的普通业务 canonical Writer Owner 全部冻结为：

```text
owner=care
```

`followUpCustomerTimelineEvents` 是 Care 内部低敏 evidence / `CustomerTimelineContribution` 来源；**最终客户时间线聚合所有权不转移给 Care**。

Audit 仍由 Audit canonical repository 独占；Messaging 的 consent / frequency / WeCom reach-out facts 仍由 Messaging canonical Writer 独占。

## 3. Runtime decomposition

禁止 28 文件一次性大 PR。冻结为三个独立原子 Runtime 子切片：

```text
W2-P2A Appointments
writer_methods=2
exact_runtime_file_count=6

W2-P2B Follow-up Task / Path / Timeline
writer_methods=7
exact_runtime_file_count=12

W2-P2C Message Draft / Controlled Reach-out
writer_methods=6
exact_runtime_file_count=17

aggregate_unique_runtime_file_count=28
```

每个子切片都必须单独获得 Runtime 明确授权。

```text
P2A 第 7 个文件 => stop / re-admit
P2B 第 13 个文件 => stop / re-admit
P2C 第 18 个文件 => stop / re-admit
aggregate 第 29 个唯一文件 => stop / re-admit
```

## 4. Production caller rewire

Fresh caller-aware callgraph 冻结 5 个 production caller：

```text
src/modules/institution/server/followup-path-enrollment-service.ts
src/modules/institution/server/treatment-followup-confirmation.ts
src/modules/institution/server/followup-customer-timeline-service.ts
src/modules/institution/server/followup-message-draft-service.ts
src/modules/institution/server/wecom-controlled-reachout-service.ts
```

责任：

- Path enrollment service：P2B，改接 Care application port + `care-follow-up-transaction`；
- Treatment follow-up confirmation：P2B，改接 Care source-task command；
- Follow-up customer timeline service：P2B/P2C compatibility facade，写入改接 Care evidence port；
- Follow-up message draft service：P2C，draft lifecycle + timeline + Audit 进入 Care transaction；
- WeCom controlled reach-out service：P2C，draft CAS 改接 Care port，但必须继续处于既有 Messaging frequency + Audit transaction。

## 5. Institution attribution

所有 canonical command 必须使用 server-side：

```text
tenantId + institutionId
```

不得接受客户端机构归属覆盖。

必须按事实类型验证：

- appointment -> customer；
- follow-up task -> customer；有 treatment summary 来源时同时验证 summary；
- path enrollment -> customer + source summary；
- path stage -> enrollment；
- message draft -> task + enrollment + stage + customer；
- timeline event -> customer + typed source；
- controlled reach-out -> approved draft + customer + existing delivery / mapping / safety scope。

cross-tenant、cross-institution、missing institution、not-owned 全部 fail-closed。

## 6. CAS / stale / idempotency

冻结：

- appointment update：`expectedUpdatedAt` CAS；
- task transition：status + observed nullable `updatedAt` CAS；
- source task create：复用既有 `follow_up_tasks_active_source_unique_idx`；
- path enrollment create：复用既有 `follow_up_path_enrollments_active_source_template_unique_idx`；
- timeline evidence：复用既有 `follow_up_customer_timeline_events_source_event_unique_idx`；
- path cancel：active status + observed `updatedAt` CAS；
- draft create：锁定 scoped follow-up task `FOR UPDATE` 后再检查 active draft，避免无 Schema 情况下并发重复；
- draft edit / approve / reject / mark-sent：legal status + `expectedUpdatedAt` CAS；
- controlled reach-out：继续 `approved + expectedUpdatedAt + expectedMetadataJson` CAS。

因此本 Admission：

```text
schema_change_required=false
migration_required=false
```

若 Runtime 证明上述 no-schema 并发策略无法成立，立即停止并重新准入。

## 7. Atomicity

`docs/operations/base02-w2-p2-care-followup-transaction-groups-20260809.csv` 为冻结事务矩阵。

关键规则：

1. path enrollment + N tasks + N stages + required timeline evidence：同一 transaction，同 commit / rollback；
2. path cancel + required timeline evidence：同一 transaction；
3. task transition + required timeline evidence：同一 transaction；
4. draft create/edit/reject/mark-sent + required timeline evidence：同一 transaction；
5. draft approve + delivery timeline evidence + Audit evidence：同一 transaction，Audit 失败必须回滚；
6. controlled reach-out draft CAS 必须继续与 Messaging frequency reservation + Audit evidence 处于现有 `runWeComReachOutTransaction(...)` 同一 transaction。

Institution production code 不得直接 import `care/server`；跨 owner 组装只能在 `src/server/orchestration/**`。

## 8. Legacy blockade

`src/modules/institution/server/tenant-business-repository.ts` 分片关闭：

- P2A：`createAppointment` / `updateAppointment`；
- P2B：3 个 task writer + 3 个 path writer + timeline writer；
- P2C：6 个 message draft writer。

对应 direct Writer 必须 fail-closed；必要 read/list compatibility 保留。

P2C 完成后 tenant-business 对上述 6 张表的普通业务 direct mutation 必须归零。

## 9. Trial Provisioning

`src/modules/institution/server/trial-provisioning-service.ts` 当前对 W2-P2 表仍有独立 provisioning insert：

```text
appointments
followUpTasks
```

冻结分类：

```text
classification=separate_provisioning_review
ordinary_business_dual_write=false
trial_provisioning_change=false
```

不得并入 P2A/P2B/P2C，也不得在未单独准入前修改。

## 10. Routes / Capability

相关 appointment / follow-up / path / message draft / controlled reach-out mutation Routes 当前全部 `capability_disabled`，本 Admission 与后续 Writer migration 都不得顺带放行。

## 11. Frozen allowlists

- `docs/operations/base02-w2-p2a-appointments-exact-runtime-allowlist-20260809.csv`
- `docs/operations/base02-w2-p2b-followup-path-timeline-exact-runtime-allowlist-20260809.csv`
- `docs/operations/base02-w2-p2c-message-draft-exact-runtime-allowlist-20260809.csv`
- `docs/operations/base02-w2-p2-care-followup-aggregate-exact-runtime-allowlist-20260809.csv`

## 12. Boundary

```text
w2_p1_complete=true
w2_p2_admission=passed
w2_p2_decomposition_frozen=true

w2_p2a_runtime_authorized=false
w2_p2b_runtime_authorized=false
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

## 13. 下一任务

`W2-P2A Appointments exact 6-file Runtime implementation explicit authorization`
