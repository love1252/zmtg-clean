# Customers CUS-01 只读 Fresh Admission

- 日期：2026-08-15
- 阶段：S28
- 流：`customers`
- 切片：`CUS_01_READONLY`
- 基线：`73edd17666426dd4aedf304fcc7f89dd2b075369`
- 性质：docs-only + repository fresh audit + original `127.0.0.1:55433` transaction-read-only audit
- 结论：Reader/API exact Runtime Admission ready；page release 继续隐藏；本阶段不实施 Runtime

## 一、结论

```text
STAGE=S28
STREAM=customers
SLICE=CUS_01_READONLY
TASK=SEVEN_STREAM_CUSTOMERS_CUS_01_READONLY_FRESH_ADMISSION
COMPLETION_MODE=ADMISSION_READY_READER_API_PAGE_HIDDEN
BASELINE=73edd17666426dd4aedf304fcc7f89dd2b075369

S27_PR=1225
S27_HEAD=d9741603cff3639032fcfd8359874204dae973da
S27_MERGE=73edd17666426dd4aedf304fcc7f89dd2b075369
S27_REQUIRED_CHECKS=passed
S27_ACTIONABLE_P0_P1_P2_P3=0
S27_POST_MERGE_REVIEW_DEBT=0
S27_COMPLETE=true
S27_FORMAL_CLOSURE=true

CUS01_DATA_READINESS=ready
CUS01_READER_ADMISSION_READY=true
CUS01_API_ADMISSION_READY=true
CUS01_PAGE_RELEASE_ADMISSION_READY=false
CUS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=true
CUS01_RUNTIME_IMPLEMENTATION=false
```

current source 虽仍是 legacy `0037` DB，但 9/9 customer rows 已持久化 exact `tenant_id + institution_id`，与 S24 verified pair evidence 一致；System rebuild 尚未执行不构成把这些 facts 改判为 blocked 的理由。未来 candidate preservation、formal Scope/Context 与 live acceptance 仍由 System 流独立负责。

当前没有 formal list Reader，legacy `/api/institution/customers` 只返回 `503 capability_disabled`，`/api/v1/institution/customers` 不存在，canonical page 由 capability-off catch-all 渲染。S28 只冻结一个新的 versioned Reader/API slice；不修改旧 mixed-method compatibility route，不发布页面。

## 二、ownership fresh decision

```text
CUS01_FACT_OWNER=public.customers
CUS01_COMMAND_OWNER=src/modules/customers
CUS01_REPOSITORY_OWNER=src/modules/customers
CUS01_READ_MODEL_OWNER=src/modules/customer-center
CUS01_PRESENTATION_OWNER=src/modules/customer-center

LEGACY_INSTITUTION_TENANT_BUSINESS_REPOSITORY_ROLE=compatibility_only_for_existing_callers
GENERIC_REPOSITORY_REQUIRED=false
```

- `public.customers` 是唯一 authoritative customer fact table。
- `src/modules/customers/**` 已持有 command service、command repository 与 customer object fact Reader；future formal list repository 也归该 owner。
- `src/modules/customer-center/**` 已持有 query、low-sensitive projection 与 list-item contract，因此正式 read model/presentation 归 customer-center。
- `src/modules/institution/server/tenant-business-repository.ts` 的 list 方法返回 legacy full `CustomerRecordSummary`，并包含 phone/medical/notes 等不属于 CUS-01 list DTO 的字段；它只保留现有 compatibility caller，不作为 formal future owner，也不在 allowlist。
- cross-owner authorization、formal scope 与 repository composition 只位于 `src/server/orchestration/**`；module 不反向 import orchestration。

## 三、Reader/API/page current state

```text
CUS01_FORMAL_LIST_READER_EXISTS=false

CUS01_CURRENT_API=/api/institution/customers
CUS01_CURRENT_API_STATE=capability_off_compatibility_only_503
CUS01_VERSIONED_API_EXISTS=false
CUS01_TARGET_VERSIONED_API=/api/v1/institution/customers

CUS01_CANONICAL_PAGE=/hospital/customers
CUS01_CAPABILITY_KEY=page_customer_list
CUS01_CURRENT_PAGE_STATE=hidden/not_released
CUS01_PAGE_RUNTIME_FILE_EXISTS=false
```

object-fact Reader 只验证指定 customer 的 current tenant/institution pair，不能等同 list Reader。legacy repository 的 `listCustomersByTenantAndInstitution()` 虽有 pair predicate 与 limit，但没有正式 request/role composition、low-sensitive wire boundary、pageInfo 或 versioned API，不能冒充 formal Reader。

## 四、角色、request 与 object/institution guard

```text
TENANT_ADMIN_CUS01_ALLOWED=true
TENANT_OPERATOR_CUS01_ALLOWED=true
CONSULTANT_CUS01_ALLOWED=true
CUSTOMER_SERVICE_CUS01_ALLOWED=true

CUS01_LIST_ACTION=customer/read
CUS01_OBJECT_ACTION=customer/read
CAPABILITY_SUBSTITUTES_AUTHORIZATION=false
```

Fresh source evidence 同时成立：customers section audience 为四角色；Security `InstitutionActionPolicyV1` 对 `customer/read` 的 roles 为四角色；legacy `canAccessResource` 对四角色均允许 customer `read` / `read_own_tenant`。Runtime 必须仍按每次 request fail closed，不得从静态 role manifest 推出已授权。

正式 list operation 的安全顺序冻结为：

```text
formal server-session request provenance
→ current membership + active institution anchor
→ customers section + customer/read role authorization
→ one-shot tenantId/institutionId pair
→ exact pair-scoped repository SELECT
→ verify every returned row pair equals formal pair
→ low-sensitive projection
```

list 没有 caller-supplied customer object ID，不执行逐 row ownership query；repository 的 exact pair predicate与 Reader 的 row-pair corroboration共同 fail closed。future object route 必须继续使用现有 customer object fact Reader 验证 request pair与 customer pair，不得用 capability、tenant-only query、当前单机构假设或目录位置替代 object authorization。

## 五、original `55433` customer data readiness

连接只从 local secret source 取得 URL，先验证 exact host/port；未输出 customer ID、姓名、phone、email、notes、tenant/institution ID 或完整 URL。

```text
ORIGINAL_DATABASE_IDENTITY=127.0.0.1:55433
CLIENT_STARTUP_DEFAULT_TRANSACTION_READ_ONLY=on
TRANSACTION=BEGIN_TRANSACTION_READ_ONLY
FIRST_SELECT_TRANSACTION_READ_ONLY=on
QUERY_CLASS=aggregate_only
TRANSACTION_END=ROLLBACK

CUSTOMER_COUNT=9
CUSTOMER_NULL_INSTITUTION_COUNT=0
CUSTOMER_NULL_TENANT_COUNT=0
CUSTOMER_DISTINCT_TENANT_COUNT=2
CUSTOMER_DISTINCT_TENANT_INSTITUTION_PAIR_COUNT=2
CUSTOMER_TENANT_ORPHAN_COUNT=0
CUSTOMER_DUPLICATE_PRIMARY_KEY_COUNT=0

CUS01_DATA_READINESS=ready
DATABASE_CONNECTION=true
DATABASE_TRANSACTION_READ_ONLY=true
DATABASE_WRITE_ON_ORIGINAL_55433=false
```

S24 已证明 9/9 customer facts 的 persisted pair 可作为 customer owner chain 的 verified evidence；S28 fresh aggregates 与该证据完全一致。source 缺 current formal Scope/Context 是 System rebuild 的独立 live-environment prerequisite，不否定 customer facts 本身，也不授权从 customer pair生成 Scope/Binding。

## 六、V1 DTO、pagination 与 filters

```text
CUS01_LOW_SENSITIVE_DTO=contractVersion,customerId,displayName,lifecycle,priority,updatedAt
CUS01_DTO_EXCLUDED=phone,email,maskedPhone,medicalRecordNo,maskedMedicalRecordNo,notes,birthDate,gender,referralSource,lastTouchSummary,nextAction,ownerUserId,projectInterest,tags,externalIdentifiers,tenantId,institutionId

CUS01_SORT=updated_at_desc_then_customer_id_asc
CUS01_PAGE_SIZE=20
CUS01_MAX_PAGE=100
CUS01_PAGINATION_STRATEGY=bounded_offset_page_with_limit_plus_one
CUS01_MAX_OFFSET=1980

CUS01_V1_FILTERS=lifecycle,priority
CUS01_V1_SEARCH=not_in_first_slice
CUS01_UNKNOWN_QUERY_PARAMETER=400_invalid_customer_query
```

`customerId` 是本系统 canonical object locator，不是 external identifier；tenant/institution pair 只用于 server authorization 与 corroboration，不进入 DTO。Reader 必须 exact-select DTO 所需字段与 pair corroboration字段，不能先加载 legacy full record 后再删敏感字段。

第一切片不承诺 free-text search。现有 UI 的本地 search intent 与 owner/project/tag/date filters 不构成 server V1 授权；page 仍隐藏，因此本 slice 只接受 lifecycle、priority 与 bounded page。后续如需 search，必须另证低敏字段、索引、query cost 与 injection-safe semantics。

## 七、Schema / Migration 与 release split

```text
CUS01_SCHEMA_CHANGE_REQUIRED=false
CUS01_MIGRATION_REQUIRED=false
CUS01_DML_BACKFILL_REQUIRED=false

CUS01_READER_ADMISSION_READY=true
CUS01_API_ADMISSION_READY=true
CUS01_PAGE_RELEASE_ADMISSION_READY=false
CUS01_PAGE_STATE=hidden/not_released
```

现有 `customers` columns、tenant FK、primary key、tenant/institution/id unique contract 与 source data 足以实现 pair-scoped list。Runtime slice 不得修改 `src/server/db/schema.ts`、`drizzle/**` 或 original DB。page release 与 API release 独立：本 allowlist 没有 page或 Capability Authority 文件，故 page 必须继续 hidden/not_released。

## 八、exact Runtime allowlist

```text
CUS01_EXACT_RUNTIME_ALLOWLIST_FROZEN=true
CUS01_EXACT_RUNTIME_FILE_COUNT=9
CUS01_EXACT_PRODUCTION_FILE_COUNT=5
CUS01_EXACT_TEST_FILE_COUNT=4
CUS01_EXISTING_RUNTIME_FILE_COUNT=0
CUS01_NEW_RUNTIME_FILE_COUNT=9
CUS01_DELETE_RUNTIME_FILE_COUNT=0
```

| PATH | ROLE | EXISTING_OR_NEW | WHY_REQUIRED |
|---|---|---|---|
| `src/modules/customer-center/ports/customer-list-source.ts` | read-source port | new | 冻结 exact pair-scoped query、low-sensitive source row 与 bounded page result；隔离 read model 和 persistence |
| `src/modules/customer-center/application/customer-list-reader.ts` | formal list application Reader + DTO/query boundary | new | exact query parse、row pair corroboration、DTO projection、pageInfo 与 fail-closed result |
| `src/modules/customers/server/customer-list-repository.ts` | authoritative customer list repository adapter | new | 对 `public.customers` 做 exact selected columns、tenant/institution predicate、lifecycle/priority filters、stable order 与 bounded limit/offset |
| `src/server/orchestration/institution-customer-list-reader.ts` | request/role/formal scope composition | new | 同一 formal request 内完成 current membership/anchor、customers section、customer/read role、one-shot pair 与 Reader composition |
| `src/app/api/v1/institution/customers/route.ts` | versioned GET API | new | no-store、strict query、403/400/503/200 boundary；不修改 legacy mixed-method route |
| `src/modules/customer-center/tests/CustomerListReader.test.ts` | Reader unit closure | new | DTO whitelist、query/pagination、pair mismatch、extra/sensitive field与source failure fail closed |
| `src/modules/customers/tests/CustomerListRepository.test.ts` | repository unit closure | new | exact select、pair predicate、filters、stable order、limit/offset、single query与no full-row load |
| `src/server/orchestration/institution-customer-list-reader.test.ts` | authorization/composition closure | new | 四角色 allow、invalid role/request/scope denial、one-shot pair、repository not called on failure |
| `src/modules/customers/tests/InstitutionCustomersV1ApiRoute.test.ts` | API contract closure | new | exact GET response、no-store、query failure、forbidden/unavailable、no legacy route/page release drift |

不允许目录 glob。不得加入 legacy `tenant-business-repository.ts`、Capability Authority、page、client shell、schema、Migration 或 generic repository/framework。若 Runtime 实施证明第 10 个文件不可避免，必须 STOP 并重新准入。

## 九、Runtime test closure

下一执行轮至少证明：

- 四角色的 `customer/read` 与 customers section authorization逐一闭合；未知/平台/失效 session fail closed；
- formal pair exactly once，每条 row 的 tenant/institution pair均与 formal pair相等；mismatch 时 records=0 / repository result unavailable；
- repository 只做一条 bounded SELECT，无 ownership N+1、无 transaction、无 DB write；
- exact DTO 不含 phone/email/medical/notes/external identifiers/tenant/institution；
- lifecycle/priority filters、fixed sort、page 1/100、page 101、unknown parameter与 limit+1 pageInfo；
- legacy `/api/institution/customers` 继续 503 compatibility-only；new versioned route只实现 GET；
- `page_customer_list` 继续 hidden/not_released，`/hospital/customers` 继续 capability-off；
- Architecture Quality、typecheck、targeted/full regression、lint、build 与 ProductionReadinessDocs 不回归。

## 十、边界与下一任务

```text
CUS01_RUNTIME_IMPLEMENTATION=false
SYS01_BUSINESS_RUNTIME_IMPLEMENTATION=false
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION_EXECUTION=false
DDL_EXECUTION=false
DML_EXECUTION=false
SEED_EXECUTION=false
STAGING_CHANGE=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=2
SEVEN_STREAM_FORMAL_RELEASE_COUNT=0
CONTROLLED_CREATE_RELEASE_COUNT=0

NEXT_CUSTOMERS_TASK=SEVEN_STREAM_CUSTOMERS_CUS_01_READONLY_EXACT_9_FILE_RUNTIME_IMPLEMENTATION
NEXT_CUSTOMERS_TASK_AUTHORIZED=false
NEXT_SYSTEM_TASK=SEVEN_STREAM_SYSTEM_SYS_01_REBUILD_EXECUTION_PREREQUISITE_EXACT_IMPLEMENTATION_ADMISSION
NEXT_SYSTEM_TASK_AUTHORIZED=false
NEXT_CARE_TASK=SEVEN_STREAM_CARE_FORMAL_FRESH_ADMISSION
NEXT_CARE_TASK_AUTHORIZED=false
CARE_FORMAL_RUNTIME_BLOCKED_UNTIL_CUSTOMERS_READINESS=true
NEXT_STAGE_AUTO_EXECUTION=false
```

S28 只形成 Admission。Customers Runtime、System prerequisite、Care Admission 都需要下一轮显式授权。
