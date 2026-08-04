# BASE-B4 第三批 Route Guard 前置预检范围校正

> 日期：`2026-08-04`
>
> 校正基线：`db1bdef9f4db45c209fe30239d70aa429160d4fd`
>
> 原前置预检：PR #973
>
> 原独立审查：PR #974
>
> 原 handoff：PR #975

## 1. 结论

```text
base02_b4_route_guard_third_batch_scope_correction=required
scope_gap=transitive_v1_reexport_compatibility_test
missing_compatibility_test_count=1
old_compatibility_test_count=4
corrected_compatibility_test_count=5
old_implementation_allowlist_count=12
corrected_implementation_allowlist_count=13
production_scope_change=0
shared_guard_change_required=false
business_reader_release=false
business_capability_release=false
schema_change=false
migration_change=false
database_connection=false
eligible_for_independent_review=true
base_b4_complete=false
base_b5_started=false
```

## 2. 缺口

第三批前置预检已经识别生产调用面：

`src/app/api/v1/institution/wecom-official-dry-run/route.ts`

该文件精确 re-export canonical GET：

```text
/api/institution/wecom-official-dry-run
→ /api/v1/institution/wecom-official-dry-run
```

但原影响面只扫描了直接引用 canonical Route 的测试，遗漏了通过 v1
re-export 间接消费 canonical GET 的测试：

`src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`

## 3. 为什么必须纳入

第三批实施后 canonical GET 会由共享 Scope + Section Guard 包装：

- 无授权时公开 GET 返回 `Promise<Response>` 形式的 `403 / no-store`；
- 既有 compatibility test 当前直接把 `legacyGET(...)` 和
  `versionedGET(...)` 传给只接受 `Response` 的 helper；
- 测试还要求新旧入口保持同一函数引用和原 `503 capability_disabled`
  handler contract。

因此该测试必须：

1. 只 mock `src/app/api/institution/_shared/institution-route-guard.ts`
   边界为 identity handler；
2. 对 `legacyGET(...)` 和 `versionedGET(...)` 调用增加 `await`；
3. 保持 v1 re-export 源码和生产行为不变；
4. 继续验证新旧入口为同一函数引用。

不允许通过修改生产 Guard、降低 `403` 门禁或改变 v1 re-export 规避该问题。

## 4. 校正后的实施范围

生产 Route：4 个，不变。

新增 colocated 测试：4 个，不变。

兼容性测试由 4 个校正为 5 个，新增：

`src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`

精确 implementation allowlist 由 12 个校正为 13 个。

## 5. 禁止范围

- 本校正只新增证据 Markdown 与 CSV；
- 不修改生产 Route、共享 Guard、v1 re-export 或测试代码；
- 不开放业务 Reader、对象事实 Adapter 或新 Capability；
- 不修改 Schema、Migration、journal 或 snapshot；
- 不连接数据库，不执行 DDL、DML、Migration 或 Seed；
- 独立审查和 handoff 完成前不得启动第三批实施。
