# POST-V2-R1C `page_system_audit` 只读放行重新审计阻断

> 日期：2026-08-13
>
> 审计基线：`95f539722315a27c74b45a65171e422b8c8d6119`
>
> 类型：fresh re-audit / release eligibility blocker / 仅文档

## 1. 唯一结论

```text
POST_V2_R1C_PAGE_SYSTEM_AUDIT_RELEASE_REAUDIT=passed
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false

PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false

BLOCKING_PREREQUISITE_COUNT=1
PRIMARY_BLOCKING_PREREQUISITE=Audit Writer institution attribution closure
BLOCKING_OWNER=src/modules/audit
```

机构范围 Audit Reader 已具备安全成功路径，但 canonical Audit Writer 尚不写入机构归属；当前数据库中的空读取结果无法证明“该机构权威地没有审计事件”。因此本阶段不能冻结页面 Runtime allowlist，也不能生成页面 Runtime Admission。

## 2. Reader readiness 与数据 readiness 分离

```text
AUDIT_READER_SUCCESS_PATH_EXISTS=true
AUDIT_READER_READINESS=ready
AUDIT_DATA_READINESS=false

PAGE_SYSTEM_AUDIT_DATA_RELEASE_REQUIREMENT=canonical Writer emits verified institution attribution and Reader can prove an authoritative institution-scoped result or authoritative empty set
PAGE_SYSTEM_AUDIT_DATA_BLOCKER=canonical Writer omits institutionId and institutionAttribution so zero visible rows cannot distinguish no events from unattributed events
```

当前成功调用链为：

```text
/api/institution/audit-events
-> existing system Section Guard
-> existing query parser
-> institution-audit-reader
-> formal one-shot institution context
-> tenantId + institutionId
-> Audit Owner Repository
-> tenant + institution + verified
-> low-sensitive response
```

独立核验确认：

- API 不再固定返回 capability-disabled 503；
- `system` Section Guard 仍存在；
- caller 提交的 `tenantId`、`institutionId`、`scope`、`role` 均不能成为授权范围；
- institution Reader 只使用正式 one-shot opaque context 中的 tenant / institution；
- Repository 同时强制 tenant、institution 与 `institution_attribution='verified'`；
- 机构响应不输出 `tenantId`、`institutionId`、attribution、SQL、stack、连接串或 secret；
- Platform Audit Route、跨租户 scope 与 `tenantId` 输出语义未改变。

这证明 Reader readiness 为 ready，但不证明业务数据 readiness。

## 3. 本地 PostgreSQL 只读证据

```text
DATABASE_ENVIRONMENT=local_development
DATABASE_SOURCE=repository_local_acceptance_container
DATABASE_ENDPOINT_CLASS=loopback
DATABASE_READONLY_CONNECTION=passed
DATABASE_READONLY_TRANSACTION=on

AUDIT_TOTAL_ROW_COUNT=275
AUDIT_TENANT_ROW_COUNT=275
AUDIT_INSTITUTION_ID_PRESENT_ROW_COUNT=0
VERIFIED_ATTRIBUTED_ROW_COUNT=0
LEGACY_UNATTRIBUTED_ROW_COUNT=0
NOT_APPLICABLE_ROW_COUNT=0
NULL_ATTRIBUTION_ROW_COUNT=275

DATABASE_WRITE_EXECUTION=false
```

验证仅查询计数与归属分布，没有读取或输出事件业务字段。275 条现有记录全部缺少 attribution，且没有任何记录具有 `institutionId`；因此 Reader 的 0 条结果是“无可见归属数据”，不是权威空集合。

## 4. Writer 与历史数据边界

```text
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
```

`mapAuditEventToInsert()` 当前写入 tenant、scope、resource、action、result 等字段，但不写入 `institutionId` 或 `institutionAttribution`。现有直接与事务型 Audit Writer 均复用该映射，新增机构事件也不会自然进入 Reader 的 `verified` 集合。

本阶段不实施 Writer、不回填历史数据。阻断计数只冻结首个必要前置条件：先完成 Audit Writer institution attribution 的 fresh audit 与 exact Runtime admission。Writer 闭环后必须再次判断历史 backfill、时间边界或明确的历史不完整声明是否仍构成页面 release prerequisite；当前不得提前把 backfill 标记为已满足或不需要。

## 5. Capability Authority 与 Workbench

```text
WORKBENCH_MULTI_CAPABILITY_SAFE=false
```

当前 Authority 只放行 `page_workbench`，其他 35 项保持 hidden。若未来直接增加 `page_system_audit` 可见摘要，`buildWorkbenchCapabilityProjection()` 会合法产生两条摘要，但 `/hospital` 的 `isExactReadonlyWorkbenchProjection()` 仍要求 `summaries.length === 1`，会丢弃整个 Workbench 投影。

这与历史 PR #1163 的 P1 证据一致。该问题可在未来页面 Runtime Admission 时通过小范围、以 capability key 选择 Workbench 自身摘要的方式重新审计；当前不需要 generic capability framework，也不允许在本 docs-only 阶段修改 Runtime。由于数据前置条件已先行阻断，当前不冻结页面 Runtime scope。

## 6. Canonical Route 与 UI / Shell

```text
CANONICAL_ROUTE=/hospital/system/audit
ROUTE_STRATEGY=dedicated_static_route_after_data_prerequisite
CANONICAL_ROUTE_SAFE=true

SHELL_READONLY_SAFE=true
AUDIT_READER_API_AUTHORIZATION_SAFE=true
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=false
LOW_SENSITIVE_OUTPUT_SAFE=true
```

- Registry 继续把 `page_system_audit` 的 canonical route 固定为 `/hospital/system/audit`；
- 当前 shared catch-all 正确承接 capability-off；未来真正放行时应使用 dedicated static Route，避免改变其余未放行页面；
- `InstitutionAuditEventsShell` 只有筛选、刷新和分页，只调用 GET-only client；
- client 只请求 `/api/institution/audit-events`，没有 POST / PUT / PATCH / DELETE；
- Shell 已覆盖 loading、权威成功空态、错误、分页与晚到响应失效语义；
- Reader/API 边界已通过 `system` Section Guard、formal institution context、tenant/institution scope 与低敏响应验证；
- 页面授权尚未验证，仍需独立核对正式 `system` navigation authorization、exact capability authority、canonical page Route 与 multi-capability projection，不能从 Reader 成功反推页面授权。

## 7. Architecture 与禁止范围

```text
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

OPEN_PLATFORM_AUDIT_CHANGE=false
AQ004_PRESENT=true
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本阶段未修改 `src/**`、Schema、`drizzle/**`、Architecture rules 或 Platform Audit。Audit Writer attribution 前置条件应先独立 fresh audit；本结论不授权其 Runtime 实现。

## 8. 验证

```text
TARGETED_TEST_FILES=10
TARGETED_TESTS=215
TARGETED_TESTS=passed

TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
```

定向测试覆盖 Audit Repository、Reader、机构 API、Platform API、Route wiring、Capability Authority、Workbench projection、`/hospital` 入口、机构 Route shell 与 Audit UI shell。

## 9. 下一任务

```text
NEXT_TASK=POST-V2-R1C Audit Writer institution attribution prerequisite fresh audit + exact Runtime admission
AUDIT_WRITER_ATTRIBUTION_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

下一任务只能审计 Writer owner、正式 institution scope 来源、事务边界、现有调用方、历史行语义、精确 Runtime/Test 闭包以及是否需要 Schema/Migration。没有新的明确授权不得实施 Writer、backfill 或页面 Runtime。
