# BASE-B4 第三批 Route Guard 前置范围第二次校正

> 日期：`2026-08-04`
>
> 校正基线：`964e505a45d5258b2d1c1a3b1d9a94239986a564`
>
> 触发证据：第三批实施影响面测试 415／415 通过后，完整 typecheck 在
> `WeComCustomerMappingReadWriteBridge.test.ts` 发现公开 GET 的
> `Response | Promise<Response>` 未被 await。

## 1. 结论

```text
base02_b4_route_guard_third_batch_scope_correction_02=required
missing_compatibility_test_count=2
old_compatibility_test_count=5
corrected_compatibility_test_count=7
old_implementation_allowlist_count=13
corrected_implementation_allowlist_count=15
production_scope_change=0
shared_guard_change_required=false
v1_reexport_change_required=false
business_reader_release=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
eligible_for_independent_review=true
```

## 2. 新发现的直接兼容性测试

1. `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`
   - 直接 import `treatment-summaries/route`；
   - 已 await 公开 GET；
   - 仍需 identity mock 共享 Guard，才能继续独立验证原 503 handler。

2. `src/modules/institution/tests/WeComCustomerMappingReadWriteBridge.test.ts`
   - 直接 import `wecom/customer-mapping-candidates/route`；
   - 两处 GET 调用未 await，触发 typecheck；
   - 同时需要 identity mock 共享 Guard，才能继续验证原 GET／POST
     capability-off 一致性。

## 3. 校正后的实施范围

- 生产 Route：4，不变；
- colocated 接线测试：4，不变；
- 既有兼容性测试：5 → 7；
- 精确 implementation allowlist：13 → 15；
- 共享 Guard：不修改；
- v1 re-export：不修改。

## 4. 禁止范围

- 本校正只新增证据 Markdown 与 CSV；
- 不修改生产 Route、共享 Guard、v1 re-export 或测试代码；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 独立审查和 corrected handoff 完成前，不得恢复第三批实施。
