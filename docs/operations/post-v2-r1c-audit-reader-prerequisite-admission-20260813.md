# POST-V2-R1C 机构范围审计只读读取器前置审计与精确 Runtime 准入

> 日期：2026-08-13
>
> 基线：`92dfd1695f155d2485313ee825978e1c1488ca6f`
>
> 任务：`POST_V2_R1C_AUDIT_READER_PREREQUISITE_FULL_AUDIT_AND_EXACT_RUNTIME_ADMISSION`
>
> 类型：仅文档（docs-only）fresh audit + Runtime Admission
>
> Runtime 授权：false

## 1. 准入结论

```text
POST_V2_R1C_AUDIT_READER_FRESH_AUDIT=passed

AUDIT_READER_EXISTING_ARCHITECTURE_IDENTIFIED=true
AUDIT_READER_DATA_SOURCE_IDENTIFIED=true
AUDIT_READER_AUTHORIZATION_BOUNDARY_IDENTIFIED=true
AUDIT_READER_OWNER_IDENTIFIED=true
AUDIT_READER_EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_READER_EXACT_RUNTIME_ADMISSION=passed

RECOMMENDED_RUNTIME_DESIGN=方案 C：通过 src/server/orchestration/** 组合正式机构授权与 Audit Owner Repository

EXACT_RUNTIME_FILE_COUNT=8
EXISTING_RUNTIME_FILE_COUNT=6
NEW_RUNTIME_FILE_COUNT=2
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=4
EXACT_TEST_FILE_COUNT=4

ARCHITECTURE_EXCEPTION_REQUIRED=false

DATABASE_CONNECTION_REQUIRED_FOR_RUNTIME=true
DATABASE_CONNECTION_REQUIRED_FOR_ADMISSION=false
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false

AUDIT_READER_RUNTIME_AUTHORIZED=false
AUDIT_READER_RUNTIME_IMPLEMENTED=false

PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本阶段只冻结后续 Reader Runtime 的唯一最小闭包，不实施其中任何文件。

## 2. 当前读取链与固定 503 原因

当前 `/api/institution/audit-events` 的真实链路在 Route Guard 后主动终止：

```text
/api/institution/audit-events
  -> withInstitutionSectionRouteGuardV1({ sectionId: 'system' })
  -> 固定低敏 503 institution_audit_events_capability_disabled
  -> 不读取 Request
  -> 不解析查询
  -> 不解析 demo access context
  -> 不创建 Repository
  -> 不取得数据库连接
```

Git history 证明该状态不是未完成占位猜测：

- `f095d900...` 曾实现 demo-session + tenant-only 审计查询；
- `08b3e97c...` 以 `fix(institution): disable unsafe audit events` 删除该不安全链路并改为固定 503；
- `387fbf11...` 增加 `no-store`；
- `edbdc478...` 接入正式 `system` Section Route Guard。

当前测试同时锁定固定 503、低敏响应、`no-store` 以及零 parser／数据库／Repository／demo auth 副作用。因此固定 503 的直接原因是：正式机构范围 Reader 尚不存在，旧 tenant-only + demo-session 路径已被有意禁用。

## 3. Fresh audit 全链路识别

| 层级 | 当前真实资产 | 判定 |
| --- | --- | --- |
| API Route | `src/app/api/institution/audit-events/route.ts` | 已有，固定 503；后续必须改为薄 Route |
| Route / Request Guard | `withInstitutionSectionRouteGuardV1` | 已有，正式 `system` Section Guard，失败时低敏 403 |
| Institution Authorization | `InstitutionRequestAuthorizationV1` + formal session/membership/anchor | 已有，Security owner；不接受客户端 scope |
| 当前请求 Scope 载体 | `InstitutionCapabilityAuthorityRuntimeContextV1` | 已有 one-shot opaque context，可消费 `tenantId`、`institutionId`、`availableSectionIds` |
| Audit Query / Domain | `AuditEventQuery`、parser、cursor、filters | 已有且可复用；institution scope 目前只含 `tenantId`，需要收紧 |
| Reader Interface | `AuditEventRepository.listAuditEvents` | 已有最小 Reader 边界，不新增 generic interface |
| Reader implementation | `createAuditEventRepository` | 已有，但 institution branch 目前只按 `tenantId` 查询 |
| Repository / persistence | `src/modules/audit/server/audit-event-repository.ts` | Audit canonical Repository owner |
| 数据表 | PostgreSQL `audit_events` | 当前 canonical source |
| tenant isolation | `audit_events.tenant_id` | 已有，当前 institution query 已使用 |
| institution isolation | `institution_id` + `institution_attribution` | Schema 已有可空列；当前通用查询未使用，Writer 也未闭环 |
| 输出投影 | `mapAuditEventRowToListItem` + institution API omit `tenantId` | 既有低敏 DTO 可复用；机构 API 不得输出 scope 字段 |

## 4. 数据源与数据库静态判定

本阶段未连接数据库，只依据 Schema、Migration、Repository、tests 与架构文档完成静态判定。

### 4.1 已存在的数据结构

`audit_events` 当前已有：

- nullable `tenant_id`；
- nullable `institution_id`；
- nullable `institution_attribution`；
- attribution enum：`not_applicable | verified | legacy_unattributed`；
- tenant/time 与 tenant/resource/time 索引。

`drizzle/0038_mig_01a1_institution_isolation_expand.sql` 只完成 expand：增加列与 enum，没有回填、非空 enforce、Scope FK、attribution shape CHECK 或 institution 专用索引。

### 4.2 当前 Writer 事实

`TenantAuditEvent`、`createAuditEvent` 与 `mapAuditEventToInsert` 均未携带／写入 `institutionId` 或 `institutionAttribution`。当前通过 Audit Repository 写入的新记录仍可能得到空机构归因。因此：

```text
AUDIT_READER_SAFE_QUERY_POSSIBLE=true
AUDIT_READER_CURRENT_DATA_READINESS=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
```

安全 Reader 必须只返回同时满足以下条件的行：

```text
tenant_id = current formal tenantId
AND institution_id = current formal institutionId
AND institution_attribution = verified
```

该策略允许在不改 Schema 的前提下实现 fail-closed Reader；在 Writer／回填尚未闭环时，它可以合法返回空列表。空列表不等于数据就绪，也不构成页面放行证据。

### 4.3 数据库边界结论

```text
DATABASE_CONNECTION_REQUIRED_FOR_RUNTIME=true
DATABASE_CONNECTION_REQUIRED_FOR_ADMISSION=false

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
```

`true` 只表示未来请求时 Reader 必须经现有 `getDatabase()` 读取 canonical PostgreSQL source；本 Admission 没有数据库连接授权，也未连接数据库。

Writer attribution、历史回填、约束 enforce、索引优化与真实数据可用性属于后续独立 capability，不得塞入本 Reader Runtime。

## 5. Institution 与 Platform 必须严格分离

`src/app/api/open-platform/audit-events/route.ts` 不能作为机构 Reader 直接复用，原因如下：

- 它使用 `getDemoAccessContextFromRequest`，不是正式机构授权；
- 它允许 `platform_admin | security_auditor`，角色语义不同；
- 它允许不指定 tenant、指定 tenant 或只查 platform event，天然具有平台／跨租户语义；
- 它在 Route 内直接取得数据库并组合 Repository；
- 它的响应包含 `tenantId`，机构端必须隐藏该字段。

可复用范围只限 Audit owner 的 query/parser/DTO/Repository 资产。Platform Route、platform authorization 与 platform scope 行为保持不变。

## 6. 授权边界判定

### 6.1 当前 Route Guard 是否足够

`withInstitutionSectionRouteGuardV1({ sectionId: 'system' })` 足以保护 API 入口，但它不会把可信 scope 传给 handler，因此单独使用 Route Guard 不足以构成 Repository scope source。

### 6.2 后续 Reader 的正式 Scope source

后续 orchestration Reader 必须复用已有 server-only one-shot context：

```text
resolveInstitutionCapabilityAuthorityRuntimeContextV1()
  -> genuine formal session
  -> fresh active membership
  -> active institution anchor
  -> verified tenantId + institutionId
  -> canonical availableSectionIds

consumeInstitutionCapabilityAuthorityRuntimeContextV1(handle)
  -> one-shot consumption
  -> require availableSectionIds includes system
```

Reader 不接受 Route、query、header、cookie 的 raw `tenantId`、`institutionId`、role 或 release claim。Route Guard 与 Reader context resolution 构成双层 fail-closed；后者负责产生数据库查询所需的可信双键 Scope。

### 6.3 Authorization owner

```text
AUTHORIZATION_OWNER=src/modules/security/**
REQUEST_AUTHORIZATION=InstitutionRequestAuthorizationV1
SCOPE_CONTEXT_SOURCE=src/modules/institution/server/institution-server-runtime.ts
COMPOSITION_SURFACE=src/server/orchestration/institution-audit-reader.ts
```

不修改 Security/Auth/Access Control/Tenancy owner，也不新增平行授权模型。

## 7. Ownership 与依赖方向

```text
AUDIT_READER_OWNER=src/modules/audit
AUDIT_DATA_OWNER=src/modules/audit
AUDIT_CANONICAL_REPOSITORY=src/modules/audit/server/audit-event-repository.ts
AUDIT_CANONICAL_SOURCE=PostgreSQL audit_events
CROSS_OWNER_COMPOSITION=src/server/orchestration
API_ADAPTER=src/app/api/institution/audit-events/route.ts
```

Audit domain/repository 继续拥有审计查询语义与 persistence。Institution module 不得新增 Audit Reader；Route 不得持有 raw scope 或直接组合数据库。跨 owner 组合进入 `src/server/orchestration/**`，与既有 AQ007 修正方向一致。

## 8. 候选方案比较

| 方案 | Owner correctness | tenant / institution isolation | 依赖方向 | 文件数与复杂度 | 测试性 | Architecture Quality | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A：Route 直接复用现有 Repository / platform Reader | Audit Repository owner 尚可，但 Route 承担 composition；platform auth 错位 | 现有 institution scope 只有 tenant；platform 行为允许跨租户 | Route 直连 DB/Repository，复制历史不安全模式 | 文件少但风险高 | 易 mock，难证明 genuine scope | 不一定触发规则，但积累 legacy debt | 拒绝 |
| B：新增 institution-specific module Reader | Reader 落入错误业务 owner | 可实现双键，但会重复 Audit query/persistence | 新增 `src/modules/institution/**` 且可能跨 owner 直连 Audit server | 文件更多、重复逻辑 | 可测 | 触发 AQ004；跨 owner 依赖可能触发 AQ007 | 拒绝 |
| C：orchestration composition + 收紧 Audit Repository | Audit 保持 domain/repository owner；orchestration 只组合 | Repository 强制 tenant + institution + verified；scope 来自 opaque formal context | 符合 cross-owner composition 方向，Route 保持薄 | exact 8，最小可完整验收 | 可分别验证 Repository、orchestration、Route | AQ004-AQ008 均无需例外 | **唯一推荐** |
| D：先做 Writer / backfill / MIG-01C 再 Reader | 可最终关闭全链 | 完整但把多个 capability 混入本任务 | 涉及全 Audit writer、DB 与 Migration | 大幅超出 Reader prerequisite | 需要数据库阶段验证 | 需要独立准入 | 本任务拒绝，后续独立治理 |

```text
RECOMMENDED_RUNTIME_DESIGN=方案 C
```

方案 C 不创建通用 query framework、新 Repository abstraction、新 DSL 或完整 Audit Platform。

## 9. 推荐 Runtime 调用序列

```text
GET /api/institution/audit-events
  -> existing withInstitutionSectionRouteGuardV1(system)
  -> existing parseAuditEventQueryParams(URLSearchParams)
     -> unknown / duplicate / tenantId 参数 fail 400
  -> new readCurrentInstitutionAuditEventsV1(query)
     -> resolve + consume opaque formal context
     -> require system in availableSectionIds
     -> getDatabase()
     -> createAuditEventRepository(database)
     -> listAuditEvents({
          scope: { kind: 'institution', tenantId, institutionId },
          query
        })
        -> WHERE tenant_id = ?
           AND institution_id = ?
           AND institution_attribution = 'verified'
  -> omit tenantId from every record
  -> return existing low-sensitive fields + pageInfo
  -> context / DB / Repository failure => low-sensitive 503 no-store
```

## 10. Exact Runtime allowlist

统计口径沿用仓库既有 Admission：后续 Runtime 实施 PR 的生产文件与测试文件全部计入 `EXACT_RUNTIME_FILE_COUNT`。

```text
EXACT_RUNTIME_FILE_COUNT=8
EXISTING_RUNTIME_FILE_COUNT=6
NEW_RUNTIME_FILE_COUNT=2
DELETE_RUNTIME_FILE_COUNT=0

EXACT_PRODUCTION_FILE_COUNT=4
EXACT_TEST_FILE_COUNT=4
```

CSV 证据：

`docs/operations/post-v2-r1c-audit-reader-exact-runtime-allowlist-20260813.csv`

### 10.1 生产文件（4）

1. `src/modules/audit/domain/audit-event-query.ts`
   - role=`Audit query scope contract`
   - change=`existing production file; institution scope 增加 required institutionId`
   - reason=`从类型边界禁止 tenant-only institution query`

2. `src/modules/audit/server/audit-event-repository.ts`
   - role=`Audit canonical Reader implementation / persistence owner`
   - change=`existing production file; institution branch 增加 institutionId 与 verified attribution 条件`
   - reason=`在数据库查询层强制双键与可信归因，不依赖内存过滤`

3. `src/server/orchestration/institution-audit-reader.ts`
   - role=`current-institution cross-owner orchestration Reader`
   - change=`new production file`
   - reason=`消费 opaque formal context、检查 system、组合数据库与 Audit Repository、输出低敏机构投影`

4. `src/app/api/institution/audit-events/route.ts`
   - role=`thin institution API adapter`
   - change=`existing production file; fixed 503 改为 parser + orchestration reader adapter`
   - reason=`保留正式 system Route Guard，提供 400/200/503 低敏 HTTP 边界`

### 10.2 测试文件（4）

5. `src/modules/audit/tests/AuditEventRepository.test.ts`
   - role=`Audit Repository isolation tests`
   - change=`existing test; 锁定 tenant + institution + verified attribution 与 platform 行为不变`
   - reason=`证明数据库条件不是 tenant-only，且未污染 platform scope`

6. `src/server/orchestration/institution-audit-reader.test.ts`
   - role=`orchestration authorization/scope/projection tests`
   - change=`new test file`
   - reason=`证明只消费 genuine context、要求 system、双键传递、tenantId 隐藏与异常 fail-closed`

7. `src/modules/audit/tests/InstitutionAuditEventsApiRoute.test.ts`
   - role=`institution Audit API behavior tests`
   - change=`existing test; fixed-503 测试改为 query/reader/low-sensitive success and failure tests`
   - reason=`证明 Route 不读取 demo scope、不直连 Repository/DB，拒绝 caller tenantId，保持 no-store`

8. `src/app/api/institution/audit-events/route.test.ts`
   - role=`formal Route Guard static wiring test`
   - change=`existing test; 更新精确 imports 并保持 system Guard 断言`
   - reason=`防止 Runtime 绕过正式 Section Guard 或恢复 action/object/demo auth`

### 10.3 明确不在 Runtime allowlist

- `src/modules/audit/server/audit-event-query-parser.ts`：已满足白名单、重复项、cursor 与 limit 要求；不改；
- `src/modules/audit/server/audit-event-dto.ts`：已有低敏 DTO；不改；
- `src/modules/audit/client/institution-audit-events-client.ts`：契约已省略 `tenantId`；不改；
- `src/modules/institution/components/InstitutionAuditEventsShell.tsx`：既有只读 Shell；不改；
- `src/modules/institution/server/institution-server-runtime.ts`：只复用既有 opaque context；不改；
- `src/app/api/institution/_shared/institution-route-guard.ts`：既有 system Guard 足够；不改；
- `src/app/api/open-platform/audit-events/route.ts`：platform 行为严格隔离；不改；
- `src/server/db/schema.ts`、`drizzle/**`：不改；
- `scripts/verify/architecture-quality-rules.json`：不新增或扩大 exception。

第 9 个实现文件、任一替换文件或任一删除文件出现时必须停止并重新准入。

## 11. Architecture Quality 审计

| Rule | Fresh audit | 方案 C 结论 |
| --- | --- | --- |
| AQ004 `FROZEN_INSTITUTION_MODULE_NEW_FILE` | `src/modules/institution/**` 新文件会失败；现有唯一 W2-P2B exception 不得删除或扩大 | 新增文件均不在 Institution module；不触发 |
| AQ005 `FROZEN_PLATFORM_MODULE_NEW_FILE` | `src/modules/open-platform/**` 新文件会失败 | 不修改／新增 Platform 文件；不触发 |
| AQ006 `DOMAIN_LAYER_DEPENDENCY` | Audit domain 只能修改纯类型 contract，不导入 app/db/server | `audit-event-query.ts` 只增加 `institutionId` 字段；不触发 |
| AQ007 `CROSS_MODULE_SERVER_REPOSITORY` | module production source 禁止新增跨 module server/Repository edge | cross-owner composition 位于 `src/server/orchestration/**`；不在 module source；不触发 |
| AQ008 `MEMBERSHIP_DIRECT_WRITER` | 只约束 Membership/Binding canonical writer | 本任务只读 `audit_events`，不写受保护表；不触发 |

```text
ARCHITECTURE_EXCEPTION_REQUIRED=false
ARCHITECTURE_RULE_CHANGE_REQUIRED=false
AQ004_EXCEPTION_CHANGE=false
LEGACY_INSTITUTION_COMPATIBILITY_DEPENDENCY=false
```

## 12. 基线验证

本次 fresh audit 在未修改 Runtime 的基线执行：

```text
baseline_targeted_test_files=7
baseline_targeted_tests=62
baseline_targeted_tests=passed

baseline_typecheck=passed

architecture_quality_unit_tests=148/148
architecture_quality_unit_tests=passed

architecture_incremental_base=HEAD
architecture_incremental_head=HEAD
architecture_incremental=passed
```

定向测试覆盖 Audit domain、query parser、Repository、institution API 固定 503、platform API、formal Route Guard 与现有 capability authority context。

## 13. Runtime 完成后仍不自动成立的事项

即使未来 exact-8 Runtime 获批、实现并合并，仍不得自动推导：

- `page_system_audit` 放行；
- capability `read_only/pilot_released`；
- Audit Writer institution attribution 已闭环；
- 历史 audit event 已回填；
- data readiness；
- Schema enforce / MIG-01C；
- production readiness / deployment。

Reader Runtime 与页面放行是不同任务；本 Admission 只解决 Reader prerequisite 的精确实现授权候选。

## 14. 当前授权与唯一下一任务

```text
AUDIT_READER_RUNTIME_AUTHORIZED=false
AUDIT_READER_RUNTIME_IMPLEMENTED=false

PAGE_SYSTEM_AUDIT_RELEASE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released

NEXT_TASK=POST-V2-R1C-AUDIT-READER exact 8-file Runtime implementation explicit authorization
```
