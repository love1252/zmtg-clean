# POST-V2-R1C Audit Owner 机构归因契约 fresh audit 与精确 Runtime 准入

> 日期：2026-08-13
>
> 阶段：S7
>
> 基线：`090574425a5d67642421b8743376f6390b24ed99`
>
> 类型：fresh audit / docs-only Admission

## 1. 唯一结论

```text
AUDIT_OWNER_ATTRIBUTION_CONTRACT_FRESH_AUDIT=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_ELIGIBLE=true
ADMISSION_MODE=ADMISSION_READY
EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXACT_RUNTIME_ADMISSION=passed

RECOMMENDED_RUNTIME_DESIGN=方案 B：保留 legacy TenantAuditEvent + record 路径，新增 Audit-owned discriminated attributed contract + recordAttributed 路径
CANONICAL_ATTRIBUTION_CONTRACT_OWNER=src/modules/audit

LEGACY_WRITER_COMPATIBILITY_STRATEGY=legacy TenantAuditEvent and record remain temporarily and map explicit NULL institution columns; a separate attributed contract and recordAttributed path accept only verified or not_applicable; retire legacy record only after classified caller migration proves zero production residual
LEGACY_CALLER_CAN_WRITE_VERIFIED=false
LEGACY_UNATTRIBUTED_NEW_WRITE_ALLOWED=false
LEGACY_RECORD_PATH_EXIT_CONDITION=classified caller migration proves PRODUCTION_LEGACY_WRITER_RESIDUAL=0 and all transaction Platform Auth and institution regressions pass then a separately authorized cleanup removes the legacy persistence entry

AUDIT_CONTRACT_PROVES_FORMAL_SCOPE=false
AUDIT_OWNER_IMPORTS_SCOPE_PORT=false
PLATFORM_NOT_APPLICABLE_CONTRACT_SAFE=true
AUTH_NOT_APPLICABLE_CONTRACT_SAFE=true

EXACT_RUNTIME_FILE_COUNT=4
EXISTING_RUNTIME_FILE_COUNT=4
NEW_RUNTIME_FILE_COUNT=0
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=2

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
```

现有 Audit Owner 可以在不修改 19 个生产 caller 的情况下，先建立有意义、可测试且可回滚的显式归因契约。关键是不要立即给现有 `TenantAuditEvent` 增加必填字段，也不要让单一 `record()` 同时接受无法区分信任级别的宽松 union；应新增独立 attributed 类型、严格 factory / validator、独立 mapper 与 `recordAttributed()`，同时把现有 legacy mapper 的数据库语义冻结为 `institutionId=null`、`institutionAttribution=null`。

## 2. 启动门禁与继承状态

```text
EXPECTED_BASELINE=090574425a5d67642421b8743376f6390b24ed99
LOCAL_MAIN=090574425a5d67642421b8743376f6390b24ed99
ORIGIN_MAIN=090574425a5d67642421b8743376f6390b24ed99
WORKTREE_AT_START=clean

PR1176_REVIEW_THREAD_COUNT=0
PR1176_REVIEW_COUNT=0
PR1177_REVIEW_THREAD_COUNT=0
PR1177_REVIEW_COUNT=0

POST_V2_R1C_AUDIT_WRITER_SCOPE_PORT_RUNTIME=passed
AUDIT_WRITER_SCOPE_PORT_INDEPENDENT_VERIFICATION=passed
AUDIT_WRITER_SCOPE_PORT_HANDOFF_COMPLETE=true
```

PR #1176 与 PR #1177 没有新增 actionable Review debt。S6 formal scope port 已提供一次性 `tenantId + institutionId + observedAt` consumption，并保持 `CAPABILITY_COUPLING=false` 与 `WRITER_SCOPE_PORT_IS_AUTHORIZATION_REPLACEMENT=false`。

## 3. 当前 Audit Owner 与 Schema 事实

当前 canonical persistence 链为：

```text
createAuditEvent / createDeniedAccessAuditEvent
-> TenantAuditEvent
-> AuditEventRepository.record
-> mapAuditEventToInsert
-> audit_events
```

Fresh source audit 确认：

- `TenantAuditEvent` 只有 `tenantId: string | null`，没有 `institutionId` 或 `institutionAttribution`；
- `createAuditEvent()` 与 `createDeniedAccessAuditEvent()` 只从普通 `AccessContext` 形成 legacy event，不能证明 formal current institution；
- `mapAuditEventToInsert()` 当前未显式写入两个归因列，因此 legacy production write 持久化为数据库 `NULL/NULL`；
- `AuditEventRepository.record()` 使用 caller-provided `TenantDatabase` 直接 insert，不自行开启 transaction；
- Institution Reader 已强制 `tenantId + institutionId + institutionAttribution='verified'`，Platform Reader 语义独立；
- Schema 已有 nullable `institution_id`、nullable `institution_attribution`，enum 已含 `not_applicable | verified | legacy_unattributed`。

因此 contract Runtime 不需要 Schema、Migration、DDL 或 DML。

## 4. Fresh caller 与事务兼容性复核

仓库级 union search 重新确认：

```text
CALLER_INVENTORY_REAUDIT=passed
HELPER_CONSTRUCTION_CALLER_FILE_COUNT=16
DIRECT_OBJECT_CONSTRUCTION_CALLER_FILE_COUNT=3
PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=11
PRODUCTION_PLATFORM_AUDIT_WRITER_CALLER_FILE_COUNT=7
PRODUCTION_NON_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=1
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10
```

直接把 `institutionId` 与 `institutionAttribution` 设为现有 `TenantAuditEvent` 的 required fields 会迫使 19 callers 同步修改，违反 `scope port -> Audit Owner contract -> caller migration` 的原子拆分。独立 attributed path 则能让 19 callers 在本切片保持编译和运行语义不变，后续再按 Institution、Platform、Auth 与 transaction composition 分类迁移。

现有 10 个 transaction 文件继续把 caller-provided transaction database 交给 Audit persistence；新 contract 只改变 event representation、validation 与 insert mapping，不调用 `database.transaction()`，不查询业务 Owner。Audit insert 失败仍由现有 caller transaction 决定是否回滚；Auth 和部分 Platform 的 best-effort / response isolation 也不会被本 contract 改写。

## 5. 方案比较

| 维度 | 方案 A：现有 `TenantAuditEvent` 立即增加必填归因 | 方案 B：独立 attributed contract + `recordAttributed`，legacy path 临时保留 | 方案 C：单一 `record()` 接受 versioned union | 方案 D：Repository 推断归因 |
| --- | --- | --- | --- | --- |
| Owner correctness | Audit Owner 正确 | Audit Owner 正确 | Audit Owner 正确 | Repository 越权到业务 Owner |
| Type safety | 强，但一次破坏 19 callers | 新路径强；旧路径清晰隔离 | union 可表达，但入口容易被 legacy branch 长期滥用 | 弱，事实不足 |
| Trust boundary | 普通 caller 可自报 `verified` | 明确声明 contract 不证明 provenance；future orchestration 负责 formal proof | provenance 与 legacy branch 混在一个入口 | 通过推断伪造 trust |
| Legacy compatibility | 无法独立实施 | 19 callers 零改动 | 可兼容，但边界和退出证明较弱 | 表面兼容、实际误归因 |
| Caller migration burden | 当前切片立即迁移全部 | 后续独立分类迁移 | 后续仍需迁移，但残留难统计 | 隐式迁移、不可审计 |
| Repository semantics | 单一新 shape | `record` / `recordAttributed` 明确分离 | 单 mapper 分支更复杂 | 引入跨 Owner 查询或猜测 |
| Transaction compatibility | 大面积同步风险 | 沿用 caller-provided database | 可保持但入口语义模糊 | 可能增加 transaction / N+1 |
| Platform / Auth | 必须本切片同步修改 | 后续显式 `not_applicable` | union 可表达 | 容易把未知误标为 `not_applicable` |
| Testability | 与 19 callers 纠缠 | 4 文件即可完整验证 | 可测但 legacy bypass 更难锁定 | 需要大量集成事实 |
| Architecture rules | Audit Owner 内可行 | Audit Owner 内可行 | Audit Owner 内可行 | 跨模块 private dependency 风险 |
| Rollback | 会连带 callers | 回退 exact 4 files 即可 | 回退 mapper union | 回退查询与事务变化复杂 |
| Overdevelopment risk | 高 | 低 | 中 | 高 |
| 结论 | 拒绝 | **唯一推荐** | 不采用 | 拒绝 |

方案 B 是唯一同时满足独立原子性、legacy compatibility、显式信任边界与可审查退出条件的设计。

## 6. Canonical attribution contract

后续 Runtime 只允许在 `src/modules/audit/domain/audit-events.ts` 增加等价公开契约：

```ts
export type AuditInstitutionAttributionV1 =
  | Readonly<{
      institutionAttribution: 'verified';
      tenantId: string;
      institutionId: string;
    }>
  | Readonly<{
      institutionAttribution: 'not_applicable';
      tenantId: string | null;
      institutionId: null;
    }>;

export type AttributedTenantAuditEventV1 = Readonly<
  Omit<TenantAuditEvent, 'tenantId'> & AuditInstitutionAttributionV1
>;

export function createAttributedTenantAuditEventV1(input: {
  event: TenantAuditEvent;
  attribution: AuditInstitutionAttributionV1;
}): AttributedTenantAuditEventV1 | null;

export function isAttributedTenantAuditEventV1(
  value: unknown,
): value is AttributedTenantAuditEventV1;
```

实现必须使用字段白名单创建冻结的新对象，并执行 runtime validation；TypeScript cast、额外字段或直接 object construction 不能绕过 Repository 的二次校验。

### 6.1 `verified`

合法 shape 必须同时满足：

```text
tenantId=non-empty string
institutionId=non-empty string
institutionAttribution=verified
event.tenantId=attribution.tenantId
```

Audit contract 只能保证 shape 与 pair self-consistency，不能证明 pair 来自 genuine formal scope。后续 orchestration / caller migration 必须先消费 S6 handle，再把 formal pair 与 transaction-bound object pair 完全比较，最后调用此 contract。

### 6.2 `not_applicable`

合法 shape 必须满足：

```text
tenantId=non-empty string or null
institutionId=null
institutionAttribution=not_applicable
event.tenantId=attribution.tenantId
```

它只表示事件合法地不属于单一 institution，不能用来表示尚未迁移、provenance 缺失或 shape 错误。

### 6.3 `legacy_unattributed`

```text
LEGACY_UNATTRIBUTED_NEW_WRITE_ALLOWED=false
```

`legacy_unattributed` 只属于 historical persistence classification / future backfill vocabulary。新 attributed factory、mapper 与 `recordAttributed()` 对该值一律拒绝，不论 `institutionId` 是否为 null。现有 legacy `record()` 也不得主动写该 enum，而是继续显式写 `NULL/NULL`，准确表达“legacy caller 尚未分类”。

## 7. 非法 shape fail-closed matrix

| 输入 | 结果 |
| --- | --- |
| `verified + tenantId=null` | reject |
| `verified + tenantId=''` | reject |
| `verified + institutionId=null` | reject |
| `verified + institutionId=''` | reject |
| `verified + event.tenantId != attribution.tenantId` | reject |
| `not_applicable + institutionId non-null` | reject |
| `not_applicable + event.tenantId != attribution.tenantId` | reject |
| unknown attribution enum | reject |
| any `legacy_unattributed` new attributed event | reject |
| malformed object / missing fields / dependency throw | reject |

非法 `verified` 不得降级为 `not_applicable` 或 `legacy_unattributed`；非法 attributed event 到达 mapper / Repository 时必须抛出固定低敏错误 `INVALID_AUDIT_INSTITUTION_ATTRIBUTION`，不得 insert。

## 8. Mapper 与 Repository 契约

后续 Runtime 在 `src/modules/audit/server/audit-event-repository.ts` 冻结以下行为：

1. 现有 `mapAuditEventToInsert(event)` 与 `record(event)` 暂时保留，只服务 legacy path；mapper 必须显式写：

```text
institutionId=null
institutionAttribution=null
```

2. 新增等价导出：

```ts
export function mapAttributedAuditEventToInsert(
  event: AttributedTenantAuditEventV1,
): typeof auditEvents.$inferInsert;
```

3. `createAuditEventRepository(database)` 新增：

```ts
recordAttributed(event: AttributedTenantAuditEventV1): Promise<void>
```

4. `mapAttributedAuditEventToInsert()` 与 `recordAttributed()` 必须再次调用 Audit-owned validator，拒绝 cast / fake / unknown / legacy shape；
5. `verified` 精确写 `tenantId + institutionId + 'verified'`；`not_applicable` 精确写 `tenantId + null + 'not_applicable'`；
6. mapper 继续字段白名单，不持久化额外字段、session、scope handle、credential 或 request body；
7. Repository 不解析 session、不导入 scope port、不查询 customer / appointment / membership、不推断归因、不自行开启 transaction；
8. Reader query、Platform scope 与低敏 DTO 语义保持不变。

## 9. Legacy path 治理与退出

```text
LEGACY_CALLER_CAN_WRITE_VERIFIED=false
PRODUCTION_LEGACY_UNATTRIBUTED_NEW_WRITER_CALLER_FILE_COUNT=0
```

临时双路径是迁移兼容机制，不是长期扩展许可：

- S7 contract Runtime 不迁移现有 callers；
- 后续 caller migration 必须把 Institution caller 迁入 formal composition + `recordAttributed(verified)`，把真正 Platform / Auth / tenant control-plane 迁入 `recordAttributed(not_applicable)`；
- 新业务不得新增 `record()` caller；该约束由后续 caller migration Admission 的 inventory guard 锁定；
- 当仓库级 union search 与 tests 证明 `PRODUCTION_LEGACY_WRITER_RESIDUAL=0`，并且 10 个 transaction、Platform、Auth 与 Institution regressions 全部通过后，才可在另行授权的 cleanup 中删除 legacy persistence entry；
- 退出条件未满足前不得声称 Audit Writer attribution closed。

## 10. Platform / Auth compatibility

```text
PLATFORM_NOT_APPLICABLE_CONTRACT_SAFE=true
AUTH_NOT_APPLICABLE_CONTRACT_SAFE=true
```

7 个 Platform caller 管理 AI configuration、tenant、tenant member 与 plan lifecycle，属于 platform / tenant control-plane。新 contract 允许 `tenantId` 为目标 tenant 或 null，同时强制 `institutionId=null` 与 `not_applicable`，不改变 Platform authorization、跨租户 query 或业务事务语义。

Auth login caller 记录 Identity / Membership 登录结果，不代表已授权的 institution action；`FormalMembershipAuditSnapshotV1` 也不暴露 institutionId。后续迁移为 `not_applicable` 安全，且不得从账号绑定反推 institution。S7 不修改上述 callers。

## 11. Trust 与依赖方向

```text
AUDIT_CONTRACT_PROVES_FORMAL_SCOPE=false
AUDIT_OWNER_IMPORTS_SCOPE_PORT=false
```

Audit Owner 负责 attribution data shape、classification、pair consistency、validation 与 persistence semantics。formal provenance 仍由 `src/server/orchestration/institution-audit-writer-scope.ts` 与 future composition 证明。`src/modules/audit/**` 不得反向 import `src/server/orchestration/**`，scope handle 也不得进入 Audit event 或数据库行。

## 12. Exact Runtime allowlist

```text
EXACT_RUNTIME_FILE_COUNT=4
EXISTING_RUNTIME_FILE_COUNT=4
NEW_RUNTIME_FILE_COUNT=0
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=2
EXACT_TEST_FILE_COUNT=2
```

1. `src/modules/audit/domain/audit-events.ts`
   - `file_class=production`
   - `change=existing_runtime`
   - 新增 discriminated attribution contract、factory 与 validator；保留 legacy factory 签名。
2. `src/modules/audit/server/audit-event-repository.ts`
   - `file_class=production`
   - `change=existing_runtime`
   - 冻结 legacy NULL mapping，新增 attributed mapper 与 `recordAttributed()`；Reader 与 transaction ownership 不变。
3. `src/modules/audit/tests/AuditEventsDomain.test.ts`
   - `file_class=test`
   - `change=existing_test`
   - 验证 canonical shapes、非法组合、unknown / legacy rejection、pair consistency、冻结与低敏边界。
4. `src/modules/audit/tests/AuditEventRepository.test.ts`
   - `file_class=test`
   - `change=existing_test`
   - 验证 legacy / attributed exact insert、二次 validation、零 insert fail-closed、Reader 与 transaction semantics 不变。

机器可读证据：

`docs/operations/post-v2-r1c-audit-owner-institution-attribution-contract-exact-runtime-allowlist-20260813.csv`

任何第 5 个 Runtime/Test 文件、新文件、删除文件、caller、scope port、Schema/Migration、Workbench 或页面改动均属于 Admission drift，必须停止。

## 13. Runtime 测试设计冻结

后续 exact 4-file Runtime 至少必须证明：

1. valid `verified` shape；
2. `verified` null / blank tenant rejection；
3. `verified` null / blank institution rejection；
4. `verified` event / attribution tenant mismatch rejection；
5. valid tenant-scoped 与 global `not_applicable` shapes；
6. `not_applicable + institutionId non-null` rejection；
7. `not_applicable` tenant mismatch rejection；
8. unknown attribution rejection；
9. all `legacy_unattributed` new-write rejection；
10. no silent fallback；
11. output frozen and field-whitelisted；
12. legacy mapper exact `NULL/NULL`；
13. verified mapper exact insert shape；
14. not-applicable mapper exact insert shape；
15. cast / fake attributed event 在 mapper 与 `recordAttributed()` fail-closed 且零 insert；
16. legacy `record()` 与 existing callers 编译、写入入口保持；
17. Institution Reader 继续只读 `verified`；
18. Platform Reader query semantics unchanged；
19. caller-provided database / transaction rollback semantics unchanged；
20. no orchestration reverse import, no ownership query, no `getDatabase`, no second transaction；
21. no sensitive or scope-handle persistence。

## 14. Fresh audit 验证

```text
TARGETED_TEST_FILES=15
TARGETED_TESTS=240
TARGETED_TESTS_RESULT=passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
PRODUCTION_READINESS_DOCS=8/8 passed
GIT_DIFF_CHECK=passed
DOCS_ALLOWLIST_CONSISTENCY=passed
```

定向集合覆盖 Audit domain / Repository、S6 formal scope port、Formal Auth、Platform account / plan 三组直接 object caller 的 service / Repository / API、Platform Knowledge representative Route 与 Institution transaction Repository。未连接数据库。

## 15. 保持边界与下一任务

```text
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_AUTHORIZED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false

WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1

PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

NEXT_TASK=POST-V2-R1C Audit Owner institution attribution contract exact 4-file Runtime implementation explicit authorization
```

本 Admission 只冻结并建议 exact 4-file Runtime。实际实现必须取得用户对该范围的当前明确授权；合并 contract 后仍须单独 fresh audit + Admission caller migration，不能直接宣布 Writer closure、历史数据就绪或页面放行。
