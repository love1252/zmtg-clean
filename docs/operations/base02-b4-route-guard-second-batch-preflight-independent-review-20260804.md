# BASE-B4 第二批低风险 Route Guard 前置预检独立审查

> 日期：`2026-08-04`
>
> 被审查 PR：#967
>
> 被审查 Head：`ce62fdf8da25a10d688d78e262c162b52aeb3233`
>
> 被审查 Merge Commit：`3670fcb66d99100b73dcc1fc12d4fc10c9490319`
>
> Required Check：Run `30898236616`／Job `91956160427`

## 1. 结论

```text
base02_b4_route_guard_second_batch_preflight_independent_review=passed
current_route_count=81
prior_calibration_gap_count=8
second_batch_count=5
second_batch_guard_chain=scope+section
second_batch_write_method_count=0
second_batch_dynamic_object_count=0
second_batch_direct_db_count=0
second_batch_demo_signal_count=0
second_batch_high_risk_count=0
second_batch_request_read_count=0
shared_guard_change_required=false
compatibility_test_count=5
implementation_allowlist_count=15
business_reader_release=false
business_capability_release=false
eligible_for_handoff=true
base_b4_complete=false
base_b5_started=false
```

## 2. 独立核对的第二批 Route

1. `src/app/api/institution/audit-events/route.ts` → `system`
2. `src/app/api/institution/followup-message-templates/route.ts` → `care`
3. `src/app/api/institution/followup-paths/templates/route.ts` → `care`
4. `src/app/api/institution/knowledge-management/qa/audits/route.ts` → `knowledge`
5. `src/app/api/institution/wecom/external-contacts/route.ts` → `conversations`

逐项重新核对结果：

- 仅 GET；
- 非动态对象；
- 无数据库直读；
- 无 demo access context；
- 无高风险路径；
- 非 legacy／retired；
- capability-off；
- 不解引用 Request；
- 当前未接 formal Guard；
- 只需 Scope + Section Guard。

## 3. 影响面核对

需纳入实施范围的既有 handler-contract 测试：

1. `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
2. `src/modules/institution/tests/FollowUpMessageDraftApiRoutes.test.ts`
3. `src/modules/institution/tests/FollowUpPathEnrollmentApiRoutes.test.ts`
4. `src/modules/institution/tests/WeComExternalContactReadonlyApiRoute.test.ts`
5. `src/modules/open-platform/tests/PlatformKnowledgeQaApiRoute.test.ts`

独立审查确认：

- 新增 5 个 colocated 接线测试；
- 既有 handler 测试只允许 mock 共享 Guard；
- 共享 Guard 行为仍由共享 Guard 测试负责；
- 完整 `pnpm test` 是实施必需门禁；
- 不修改共享 Guard；
- 不新增业务 Reader、对象事实 Adapter 或 Capability。

## 4. 准入

只准入：

`BASE-B4 第二批低风险正式 Route Guard capability-off 接线实施`

精确 implementation allowlist：`15` 个文件。

不得扩大至动态对象 Route、写 Route、凭证、HIS、上传下载、解析、索引或外部触达。
