# BASE-B4 全量入口 Guard／绕过闭环终检前置预检

> 日期：`2026-08-05`
>
> 审计 Base：`446dcf5b2bd293dd8cd339c12adf3b5970cf9ffc`
>
> 任务性质：只读静态审计、全量清单重建、剩余缺口判定与下一切片冻结

## 1. 结论

```text
base02_b4_full_entry_bypass_closure_preflight=passed
entry_count=83
api_route_count=81
page_count=2
server_action_count=0
formal_guarded_entry_count=16
formal_route_guarded_count=14
route_review_candidate_count=56
capability_off_unwired_count=52
lifecycle_candidate_count=38
operational_candidate_count=31
owner_outside_direct_writer_count=1
lifecycle_unresolved_count=4
base_b4_completion_candidate=false
base_b4_complete=false
base_b5_started=false
business_reader_release=false
business_capability_release=false
database_connection=false
schema_change=false
migration_change=false
next_task_decision_reason=owner_outside_direct_writer
next_task=BASE-B4 Owner 外 Membership／Binding Writer／Deleter 关闭前置预检
```

## 2. 审计覆盖面

本轮重新枚举：

- `src/app/api/institution/**/route.ts`
- `src/app/api/v1/institution/**/route.ts`
- 机构 Page
- 含 `use server` 的 Server Action
- `src/**` 与 `scripts/**` 中的 onboarding、reset、Seed、fixture、
  import、maintenance、Membership 与 Binding 接触路径
- `tenant_members`
- `auth_account_institution_bindings`
- `auth_account_institution_binding_transitions`

入口清单：

`docs/operations/base02-b4-full-entry-guard-inventory-20260805.csv`

生命周期／绕过清单：

`docs/operations/base02-b4-lifecycle-bypass-inventory-20260805.csv`

## 3. 入口分类统计

- `capability_off_unwired`：52
- `demo_or_fixture`：5
- `dynamic_object_review`：4
- `formal_guarded`：14
- `formal_guarded_page`：2
- `legacy_or_retired`：3
- `versioned_reexport`：3

`formal_route_guarded_count` 不得低于三批累计基线 `14`。

## 4. 生命周期与运维入口分类

- `canonical_owner_writer`：1
- `delegated_to_access_control_owner`：2
- `disabled_by_contract`：4
- `lifecycle_review_required`：3
- `operational_entry_no_protected_touch`：24
- `owner_outside_direct_writer`：1
- `read_only_consumer`：3

### Owner 外直接 Writer／Deleter

1. `scripts/verify/architecture-quality.test.mjs`

### 尚未关闭的生命周期入口

1. `scripts/verify/architecture-quality.mjs`
2. `scripts/verify/architecture-quality.test.mjs`
3. `src/modules/auth/server/auth-account-service.ts`
4. `src/modules/open-platform/components/TrialDataResetPanel.tsx`

### 运维候选入口

1. `scripts/db/mig01-a2-provisioning-runner.mjs`
2. `scripts/db/mig01-a2-provisioning-runner.test.mjs`
3. `scripts/demo/seed-v06-low-sensitive-demo.ts`
4. `src/app/api/institution/customers/import/route.ts`
5. `src/app/api/v1/open-platform/trial-data-reset/route.ts`
6. `src/modules/institution/domain/customer-import.ts`
7. `src/modules/institution/server/customer-import.ts`
8. `src/modules/institution/server/trial-provisioning-service.ts`
9. `src/modules/open-platform/components/TrialDataResetPanel.tsx`
10. `src/modules/open-platform/domain/tenant-plan-binding.ts`
11. `src/modules/open-platform/server/tenant-account-management-repository.ts`
12. `src/modules/open-platform/server/tenant-account-management-service.ts`
13. `src/modules/open-platform/server/tenant-plan-binding-repository.ts`
14. `src/modules/open-platform/server/tenant-plan-binding-service.ts`
15. `src/modules/open-platform/server/trial-data-reset-service.ts`
16. `src/modules/tenancy/provisioning/provisioning-candidate-canonicalization.ts`
17. `src/modules/tenancy/provisioning/provisioning-candidate-manifest.ts`
18. `src/modules/tenancy/provisioning/provisioning-candidate-source.ts`
19. `src/modules/tenancy/provisioning/provisioning-candidate-v2-canonicalization.ts`
20. `src/modules/tenancy/provisioning/provisioning-candidate-v2-manifest.ts`
21. `src/modules/tenancy/provisioning/provisioning-candidate-v2-source.ts`
22. `src/modules/tenancy/provisioning/provisioning-canonicalization.ts`
23. `src/modules/tenancy/provisioning/provisioning-context-policy.ts`
24. `src/modules/tenancy/provisioning/provisioning-kernel.ts`
25. `src/modules/tenancy/provisioning/provisioning-lease.ts`
26. `src/modules/tenancy/provisioning/provisioning-manifest.ts`
27. `src/modules/tenancy/provisioning/provisioning-ports.ts`
28. `src/modules/tenancy/provisioning/server/provisioning-readonly-postgres-adapter.ts`
29. `src/modules/tenancy/provisioning/server/provisioning-write-postgres-adapter.ts`
30. `src/server/db/seed-demo-data.ts`
31. `src/server/db/seed-guard.ts`

运维候选不等于违规。只有直接接触受保护关系且未委托唯一 Owner、
未禁用、也不是只读消费者时，才进入未关闭清单。

## 5. 剩余入口候选

### 未接线 capability-off Route

1. `src/app/api/institution/ai-service-usage/route.ts`
2. `src/app/api/institution/appointments/route.ts`
3. `src/app/api/institution/customers/[customerId]/followup-feedback/route.ts`
4. `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
5. `src/app/api/institution/customers/[customerId]/wecom-reachout-safety/route.ts`
6. `src/app/api/institution/customers/import/route.ts`
7. `src/app/api/institution/customers/route.ts`
8. `src/app/api/institution/followup-message-drafts/[draftId]/approve/route.ts`
9. `src/app/api/institution/followup-message-drafts/[draftId]/mark-sent/route.ts`
10. `src/app/api/institution/followup-message-drafts/[draftId]/reject/route.ts`
11. `src/app/api/institution/followup-message-drafts/[draftId]/route.ts`
12. `src/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route.ts`
13. `src/app/api/institution/followup-message-drafts/[draftId]/wecom-customer-broadcast-task/route.ts`
14. `src/app/api/institution/followup-message-drafts/route.ts`
15. `src/app/api/institution/followup-paths/enrollments/[enrollmentId]/cancel/route.ts`
16. `src/app/api/institution/followup-paths/enrollments/[enrollmentId]/route.ts`
17. `src/app/api/institution/followup-paths/enrollments/route.ts`
18. `src/app/api/institution/followups/route.ts`
19. `src/app/api/institution/his-connections/[connectionId]/pause/route.ts`
20. `src/app/api/institution/his-connections/[connectionId]/resume/route.ts`
21. `src/app/api/institution/his-connections/[connectionId]/revoke/route.ts`
22. `src/app/api/institution/his-connections/[connectionId]/route.ts`
23. `src/app/api/institution/his-connections/[connectionId]/test-connection/route.ts`
24. `src/app/api/institution/his-connections/route.ts`
25. `src/app/api/institution/knowledge-management/ai-call/route.ts`
26. `src/app/api/institution/knowledge-management/answer/route.ts`
27. `src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/cancel/route.ts`
28. `src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/route.ts`
29. `src/app/api/institution/knowledge-management/indexing-jobs/route.ts`
30. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route.ts`
31. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/embeddings/route.ts`
32. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route.ts`
33. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/route.ts`
34. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/route.ts`
35. `src/app/api/institution/knowledge-management/items/route.ts`
36. `src/app/api/institution/knowledge-management/qa/route.ts`
37. `src/app/api/institution/knowledge-management/upload/route.ts`
38. `src/app/api/institution/real-channel-preflight/route.ts`
39. `src/app/api/institution/safety-switch/route.ts`
40. `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
41. `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
42. `src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts`
43. `src/app/api/institution/wecom-customer-contact-precheck/route.ts`
44. `src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts`
45. `src/app/api/institution/wecom-customer-contact-readonly-proof/route.ts`
46. `src/app/api/institution/wecom-customer-mapping/route.ts`
47. `src/app/api/institution/wecom-official-dry-run-config/route.ts`
48. `src/app/api/institution/wecom-official-dry-run-snapshot/route.ts`
49. `src/app/api/institution/wecom-official-dry-run/evaluate/route.ts`
50. `src/app/api/institution/wecom-official-internal-message-proof/route.ts`
51. `src/app/api/institution/wecom-official-secret-precheck/route.ts`
52. `src/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/route.ts`

### 全部待复核入口

1. `src/app/api/institution/ai-service-usage/route.ts`
2. `src/app/api/institution/appointments/route.ts`
3. `src/app/api/institution/customers/[customerId]/followup-feedback/route.ts`
4. `src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts`
5. `src/app/api/institution/customers/[customerId]/wecom-reachout-safety/route.ts`
6. `src/app/api/institution/customers/import/route.ts`
7. `src/app/api/institution/customers/route.ts`
8. `src/app/api/institution/followup-message-drafts/[draftId]/approve/route.ts`
9. `src/app/api/institution/followup-message-drafts/[draftId]/mark-sent/route.ts`
10. `src/app/api/institution/followup-message-drafts/[draftId]/reject/route.ts`
11. `src/app/api/institution/followup-message-drafts/[draftId]/route.ts`
12. `src/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route.ts`
13. `src/app/api/institution/followup-message-drafts/[draftId]/wecom-customer-broadcast-task/route.ts`
14. `src/app/api/institution/followup-message-drafts/route.ts`
15. `src/app/api/institution/followup-paths/enrollments/[enrollmentId]/cancel/route.ts`
16. `src/app/api/institution/followup-paths/enrollments/[enrollmentId]/route.ts`
17. `src/app/api/institution/followup-paths/enrollments/route.ts`
18. `src/app/api/institution/followups/route.ts`
19. `src/app/api/institution/his-connections/[connectionId]/credentials/clear/route.ts`
20. `src/app/api/institution/his-connections/[connectionId]/credentials/revoke/route.ts`
21. `src/app/api/institution/his-connections/[connectionId]/credentials/rotate/route.ts`
22. `src/app/api/institution/his-connections/[connectionId]/credentials/route.ts`
23. `src/app/api/institution/his-connections/[connectionId]/pause/route.ts`
24. `src/app/api/institution/his-connections/[connectionId]/resume/route.ts`
25. `src/app/api/institution/his-connections/[connectionId]/revoke/route.ts`
26. `src/app/api/institution/his-connections/[connectionId]/route.ts`
27. `src/app/api/institution/his-connections/[connectionId]/test-connection/route.ts`
28. `src/app/api/institution/his-connections/route.ts`
29. `src/app/api/institution/knowledge-management/ai-call/route.ts`
30. `src/app/api/institution/knowledge-management/answer/route.ts`
31. `src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/cancel/route.ts`
32. `src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/route.ts`
33. `src/app/api/institution/knowledge-management/indexing-jobs/route.ts`
34. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route.ts`
35. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/embeddings/route.ts`
36. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route.ts`
37. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/route.ts`
38. `src/app/api/institution/knowledge-management/items/[knowledgeId]/files/route.ts`
39. `src/app/api/institution/knowledge-management/items/route.ts`
40. `src/app/api/institution/knowledge-management/qa/route.ts`
41. `src/app/api/institution/knowledge-management/upload/route.ts`
42. `src/app/api/institution/real-channel-preflight/route.ts`
43. `src/app/api/institution/safety-switch/route.ts`
44. `src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts`
45. `src/app/api/institution/treatment-summaries/[summaryId]/route.ts`
46. `src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts`
47. `src/app/api/institution/wecom-customer-contact-precheck/route.ts`
48. `src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts`
49. `src/app/api/institution/wecom-customer-contact-readonly-proof/route.ts`
50. `src/app/api/institution/wecom-customer-mapping/route.ts`
51. `src/app/api/institution/wecom-official-dry-run-config/route.ts`
52. `src/app/api/institution/wecom-official-dry-run-snapshot/route.ts`
53. `src/app/api/institution/wecom-official-dry-run/evaluate/route.ts`
54. `src/app/api/institution/wecom-official-internal-message-proof/route.ts`
55. `src/app/api/institution/wecom-official-secret-precheck/route.ts`
56. `src/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/route.ts`

完整字段、方法、Guard、数据库、外部调用、demo 和兼容测试影响面
以 CSV 为准。

## 6. 判定

```text
decision_reason=owner_outside_direct_writer
next_task=BASE-B4 Owner 外 Membership／Binding Writer／Deleter 关闭前置预检
```

本轮不会把静态清单通过直接写成 BASE-B4 完成。

即使 `base_b4_completion_candidate=true`，仍需独立的 BASE-B4 完成审计，
之后才可形成 BASE-B5 前置规划。

## 7. 持续硬门

- 业务 Reader 与新 Capability 继续关闭；
- historical orphan 不处理；
- Scope FK 不验证；
- 不修改生产 Runtime、Route、Guard、Schema、Migration 或脚本；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 不启动 BASE-B5～B6、业务 Writer、Audit／模板或 MIG-01B／C。
