# POST-V2-R1C Audit Writer 正式机构范围端口 fresh audit 与精确 Runtime 准入

> 日期：2026-08-13
>
> S5 启动基线：`9a85304c8fdd19c685cee7f40b6c6a9c429deeca`
>
> Phase 1 审计基线：`654b241ce021ecaf08891a98c590867c0393372a`
>
> 任务：`POST_V2_R1C_AUDIT_WRITER_FORMAL_INSTITUTION_SCOPE_PORT_FULL_AUDIT_AND_EXACT_RUNTIME_ADMISSION`
>
> 类型：仅文档（docs-only）fresh audit + Runtime Admission
>
> Runtime 授权：false

## 1. 唯一结论

```text
AUDIT_WRITER_SCOPE_PORT_FRESH_AUDIT=passed
AUDIT_WRITER_SCOPE_PORT_RUNTIME_ELIGIBLE=true
ADMISSION_MODE=ADMISSION_READY
EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_WRITER_SCOPE_PORT_EXACT_RUNTIME_ADMISSION=passed

RECOMMENDED_RUNTIME_DESIGN=方案 B：src/server/orchestration 持有的无输入 one-shot formal scope port
FORMAL_SCOPE_SOURCE=formal server-session verified claims corroborated by current authoritative Identity + active Membership/Binding + active Tenancy Institution Scope
PORT_OWNER=src/server/orchestration
HANDLE_OWNER=src/server/orchestration/institution-audit-writer-scope.ts
HANDLE_CREATOR=resolveInstitutionAuditWriterFormalScopeV1
HANDLE_CONSUMER=consumeInstitutionAuditWriterFormalScopeV1
CONSUMPTION_COUNT=1

WRITER_SCOPE_PORT_IS_AUTHORIZATION_REPLACEMENT=false
CAPABILITY_COUPLING=false
PAIR_REVALIDATION_REQUIRED=false

EXACT_RUNTIME_FILE_COUNT=2
EXISTING_RUNTIME_FILE_COUNT=0
NEW_RUNTIME_FILE_COUNT=2
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=1
EXACT_TEST_FILE_COUNT=1

DATABASE_ENVIRONMENT=not_connected
DATABASE_READONLY_CONNECTION=not_used
DATABASE_WRITE_EXECUTION=false

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AUDIT_WRITER_SCOPE_PORT_RUNTIME_AUTHORIZED=false
AUDIT_WRITER_SCOPE_PORT_RUNTIME_IMPLEMENTED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_AUTHORIZED=false
CALLER_MIGRATION_AUTHORIZED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

Fresh audit 证明现有正式 Session 与 authoritative facts 已足以关闭第一个原子前置；不需要把 Workbench／Capability Authority、Audit Owner contract、caller migration 或数据库变更塞入本端口。因此冻结 exact 2-file Runtime Admission，但 S5 只交付文档，不实施这两个文件。

## 2. S5 Phase 0 caller inventory 修正已闭环

```text
PHASE0_CALLER_INVENTORY_FIX_PR=1174
PHASE0_CALLER_INVENTORY_FIX_HEAD=3c9501da62ef19f2f79a3811672aed29e115d34f
PHASE0_CALLER_INVENTORY_FIX_MERGE=654b241ce021ecaf08891a98c590867c0393372a
PHASE0_REQUIRED_CHECK=passed
PHASE0_ACTIONABLE_P0_P1=0
PR1173_POST_MERGE_P2_RESOLVED=true

CALLER_INVENTORY_REAUDIT=passed
PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=11
PRODUCTION_PLATFORM_AUDIT_WRITER_CALLER_FILE_COUNT=7
PRODUCTION_NON_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=1
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10
```

PR #1174 已补齐三个直接构造 `TenantAuditEvent` 的 Platform service、三个 transaction Repository 与九个 downstream tests。合并后仅回复并解决 PR #1173 的授权线程 `PRRT_kwDOSrGMn86YzrvG`；没有操作其他历史 Review thread。

## 3. 现有可信资产与缺口

现有正式授权根已经提供以下独立资产：

1. `verifyFormalServerSessionCookieClaimsV1()` 校验当前 server cookie 的签名、key version、签发时间与过期时间，产出不可伪造、一次性消费的 verified claims；
2. `consumeFormalServerSessionVerifiedClaimsV1()` 一次性返回 `accountId + tenantId + institutionId`；
3. `createIdentityAuthoritativeFormalSessionIdentityFactReaderV1()` 读取当前 active Identity；
4. `createAccessControlAuthoritativeMembershipFactReaderV1()` 读取 active Membership / Binding；
5. `createTenancyAuthoritativeInstitutionScopeFactReaderV1()` 读取 active Institution Scope；
6. `createFormalInstitutionSessionContextResolverV1().resolveForSession()` 对指定三元组执行 authoritative Identity、Membership / Binding 与 Scope 校验，并在返回前再次读取 facts，检测 mutation/stale；
7. `consumeFormalServerSessionUserSnapshotV1()` 一次性暴露 resolver 已确认的 authoritative session user。

当前缺口不是第二套 authorization framework，而是一个面向 Audit Writer attribution 的窄 orchestration port：它只把上述两条独立证据链收敛为不可伪造、不可重放的当前 `tenantId + institutionId` pair，不暴露 role、navigation、capability、session 或 credential。

## 4. 为什么不能直接复用 Capability Authority context

`InstitutionCapabilityAuthorityRuntimeContextV1` 当前会执行：

```text
authorizeCurrentInstitutionNavigationV1({ targetSectionId: 'workbench' })
-> require workbench allowed
-> consume availableSectionIds
-> mint capability authority context
```

它是 POST-V2-R1A 的 navigation / capability 组合结果，不是通用 formal scope provenance。Audit Writer attribution 若直接复用它，将使机构归因依赖 Workbench 可见性、navigation policy 与 capability release，导致 capability-off 的合法机构 mutation 无法取得 scope，或后续 UI 策略改变意外改变 Writer 可信边界。

```text
CAPABILITY_COUPLING=false
```

新端口不得调用 `authorizeCurrentInstitutionNavigationV1()`，不得消费或输出 `availableSectionIds`，不得要求 `workbench`、`system` 或任何 capability 被放行。

## 5. 候选设计比较

| 方案 | 信任与 Owner | Capability 耦合 | 审查范围 | 结论 |
| --- | --- | --- | --- | --- |
| A：直接复用 `InstitutionCapabilityAuthorityRuntimeContextV1` | context genuine，但其语义是 navigation / capability authority | 是；强制 `workbench` 与 `availableSectionIds` | 文件少但边界错误 | 拒绝 |
| B：新增 orchestration-owned、无输入、one-shot formal scope port | 复用 verified cookie claims，并以当前 authoritative Identity + Membership/Binding + Scope 交叉确认 | 否 | 1 个生产文件 + 1 个测试文件 | **唯一推荐** |
| C：19 个 caller 分别读取 cookie 或重复校验 facts | 跨 Owner 复制 authorization，普通 caller 容易接受 raw scope 或产生漂移 | 不固定 | caller 面巨大且无法独立验收 | 拒绝 |

方案 B 不修改 Auth、Security、Access Control、Tenancy、Institution 或 Audit owner，只在 cross-owner composition 层增加一个窄端口。

## 6. 精确公开契约

后续 Runtime 只允许在新文件 `src/server/orchestration/institution-audit-writer-scope.ts` 导出：

```ts
export type InstitutionAuditWriterFormalScopeHandleV1

export type InstitutionAuditWriterFormalScopeConsumptionV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  observedAt: string;
}>

export async function resolveInstitutionAuditWriterFormalScopeV1(): Promise<
  InstitutionAuditWriterFormalScopeHandleV1 | null
>

export function isInstitutionAuditWriterFormalScopeHandleV1(
  value: unknown,
): value is InstitutionAuditWriterFormalScopeHandleV1

export function consumeInstitutionAuditWriterFormalScopeV1(
  value: unknown,
): InstitutionAuditWriterFormalScopeConsumptionV1 | null
```

契约约束：

- resolver 无参数；scope 只能来自当前 server request cookie 与 authoritative readers；
- handle 为冻结的 opaque object，由 module-private `WeakSet` 与 `WeakMap` 认证；
- clone、spread、plain object、JSON round-trip 与 Proxy 均不是 genuine handle；
- consumer 删除 `WeakMap` value 与 `WeakSet` membership 后才返回 consumption；同一 handle 精确消费一次，重放与第二次消费返回 `null`；
- consumption 只含 `tenantId`、`institutionId`、`observedAt`，不含 `accountId`、role、membership、binding、session、navigation、capability、release flag 或 credential；
- `observedAt` 记录完成交叉确认的时间，不构成客户端可提供的 trust claim；
- resolver／consumer 的失败统一关闭为 `null`，不向调用者泄露 session、membership、scope 或配置失败细节。

端口不得接受以下输入：

- body、query、header 中的 `tenantId` / `institutionId`；
- raw cookie string、客户端 session object 或普通 `AccessContext`；
- 当前账号绑定、单机构假设、Repository lookup 或 resource-id inference；
- section、object、action、role、capability 或 release claim。

## 7. 精确解析与 fail-closed 流程

```text
resolveInstitutionAuditWriterFormalScopeV1()
  -> resolveInstitutionGuardRuntimeConfigV1()
  -> read current FORMAL_SERVER_SESSION_COOKIE_V1 from next/headers cookies()
  -> verifyFormalServerSessionCookieClaimsV1()
  -> consume one-shot verified claims: accountId + tenantId + institutionId
  -> createFormalInstitutionSessionContextResolverV1({
       identityReader: createIdentityAuthoritativeFormalSessionIdentityFactReaderV1(),
       membershipReader: createAccessControlAuthoritativeMembershipFactReaderV1(),
       scopeReader: createTenancyAuthoritativeInstitutionScopeFactReaderV1()
     })
  -> resolveForSession(claimed accountId + tenantId + institutionId)
  -> require kind=resolved
  -> consumeFormalServerSessionUserSnapshotV1(snapshot)
  -> require authoritative session user tenantId + institutionId
     exactly match verified claims pair
  -> mint one-shot opaque formal scope handle
```

以下任一情况必须返回 `null` 且不得 mint handle：

- runtime config 缺失、异常或 key ring 不可用；
- cookies API 失败、cookie 缺失、格式非法、签名无效、key 不接受、未来签发或已过期；
- verified claims 不是 genuine、已消费或无法消费；
- Identity 非 active、Membership / Binding 非 active、Binding 过期、Scope 非 active；
- authoritative reader unavailable、invalid、denied 或两次读取间发生 stale mutation；
- authoritative session user snapshot 不 genuine、已消费或无法消费；
- verified claims 与 authoritative session user 的 `tenantId + institutionId` 不完全一致；
- 时间源异常、任何 dependency throw 或内部 shape 不满足精确契约。

## 8. Authorization 与事务边界

```text
WRITER_SCOPE_PORT_IS_AUTHORIZATION_REPLACEMENT=false
PAIR_REVALIDATION_REQUIRED=false
```

该端口只证明“当前正式 server session 的机构 pair 经过当前 authoritative facts 交叉确认”，不能替代具体 Route／section／object／action authorization，也不能证明某个 customer、appointment、follow-up、mapping 或其他业务对象属于该机构。

未来 transaction-bound Writer 必须：

1. 先由既有业务 authorization / Repository 在业务 transaction 内锁定或修改对象；
2. 把 transaction 已确认的对象 `tenantId + institutionId` 与 formal scope consumption 完全比较；
3. 一致才允许交给后续 Audit Owner attribution contract 标记 `verified`；
4. 缺失或不一致必须在 Audit insert 前 fail-closed，不得降级为 `legacy_unattributed`。

`PAIR_REVALIDATION_REQUIRED=false` 表示不为 attribution 再发起一遍 customer / appointment / follow-up / mapping ownership query；transaction-bound business pair 是 corroborating evidence，不是 formal current 的替代来源。端口也不得自行开启数据库 transaction。

## 9. Exact Runtime allowlist

```text
EXACT_RUNTIME_FILE_COUNT=2
EXISTING_RUNTIME_FILE_COUNT=0
NEW_RUNTIME_FILE_COUNT=2
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=1
EXACT_TEST_FILE_COUNT=1
```

唯一允许的生产文件：

1. `src/server/orchestration/institution-audit-writer-scope.ts`
   - 新增上述 formal scope handle、resolver、genuine predicate 与 one-shot consumer；
   - 只组合既有 Auth / Identity、Access Control 与 Tenancy 资产；
   - 不导入 Audit Repository、业务 Repository、Capability Authority 或 navigation。

唯一允许的测试文件：

2. `src/server/orchestration/institution-audit-writer-scope.test.ts`
   - 验证 genuine success、pair exact match、opaque / one-shot / replay protection；
   - 验证 config、cookie、session、Identity、Membership / Binding、Scope、stale、pair mismatch 与 dependency exception 全部 fail-closed；
   - 验证零 Capability Authority / navigation 耦合与零数据库写入。

机器可读证据：

`docs/operations/post-v2-r1c-audit-writer-formal-institution-scope-port-exact-runtime-allowlist-20260813.csv`

任何既有 Runtime 文件变更、第三个文件、删除文件、Audit contract 或 caller 修改都属于 Admission drift，必须停止并重新审计。

## 10. Owner、依赖方向与 Architecture Quality

```text
PORT_OWNER=src/server/orchestration
HANDLE_OWNER=src/server/orchestration/institution-audit-writer-scope.ts
ARCHITECTURE_EXCEPTION_REQUIRED=false

AQ004_PRESENT=true
AQ005_PRESENT=true
AQ006_PRESENT=true
AQ007_PRESENT=true
AQ008_PRESENT=true
```

Orchestration 负责组合 Auth / Identity、Access Control Membership / Binding 与 Tenancy Institution Scope；各 owner 继续拥有事实与校验语义。新文件不进入冻结的 `src/modules/institution/**`，不增加模块间 server private import，不改 `architecture-quality-rules.json`，不删除或绕过 AQ004～AQ008。

## 11. 数据库与 Schema

```text
DATABASE_ENVIRONMENT=not_connected
DATABASE_READONLY_CONNECTION=not_used
DATABASE_WRITE_EXECUTION=false

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
```

本端口只组合既有 formal / authoritative readers；源码、契约与定向测试足以决定准入，不需要复核 `audit_events` 数据或连接 local-development PostgreSQL。S5 Phase 1 因而没有使用 A3，也没有执行数据库读写。

## 12. Fresh audit 验证

```text
TARGETED_TEST_FILES=12
TARGETED_TESTS=401
TARGETED_TESTS=passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
```

定向集合覆盖 formal session context / provenance owner、authoritative Identity / Membership / Scope、request authorization、Institution server runtime、Capability Authority 与 Institution Audit Reader。该集合证明新端口可以复用更低层的正式信任根，同时不能复用带 Workbench / navigation 语义的 capability context。

## 13. S5 保持边界与下一任务

```text
AUDIT_WRITER_SCOPE_PORT_RUNTIME_AUTHORIZED=false
AUDIT_WRITER_SCOPE_PORT_RUNTIME_IMPLEMENTED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_AUTHORIZED=false
CALLER_MIGRATION_AUTHORIZED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
WORKBENCH_CHANGE=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

唯一下一任务：

```text
NEXT_TASK=POST-V2-R1C Audit Writer formal institution scope port exact 2-file Runtime implementation explicit authorization
```

本 Admission 与 Handoff 只冻结并建议下一原子 Runtime；实际实施必须取得用户对该 exact 2-file Runtime 的当前明确授权。即使端口未来合并，也仍须分别准入 Audit Owner attribution contract 与 classified caller migration，不能据此宣布 Writer closure、历史数据就绪或 `page_system_audit` 放行。
