# POST-V2-R1C Audit Writer 分类 caller migration 精确 Runtime 准入

## 1. 结论

```text
STAGE=S9
BASELINE=0121c38655f070943e399a19f253cf40075c48af
COMPLETION_MODE=ADMISSION_READY_SPLIT
CALLER_MIGRATION_FRESH_AUDIT=passed

PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_LEGACY_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_ATTRIBUTED_WRITER_CALLER_FILE_COUNT=0
HELPER_CONSTRUCTION_CALLER_FILE_COUNT=16
DIRECT_OBJECT_CONSTRUCTION_CALLER_FILE_COUNT=3
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10

TARGET_VERIFIED_CALLER_FILE_COUNT=5
TARGET_NOT_APPLICABLE_CALLER_FILE_COUNT=12
BLOCKED_UNCLASSIFIED_CALLER_FILE_COUNT=2

MIGRATION_STRATEGY=SPLIT
MIGRATION_STRATEGY_REASON=完整调用面跨 Institution Platform Auth 与 10 个事务持久化或组合边界，且两个 legacy 文件混有无法由现有 contract 安全表达的 institution attempted-scope 拒绝事件；Auth 正式登录是单文件、非事务、语义明确的 not_applicable 原子首切片

ADMITTED_SLICE_ID=AUTH_LOGIN_NOT_APPLICABLE_V1
ADMITTED_SLICE_DESCRIPTION=仅迁移正式 Auth 登录成功和失败审计，从 legacy record 改为显式 not_applicable 加 recordAttributed，并保持登录结果与审计失败隔离语义
ADMITTED_CALLER_FILE_COUNT=1
REMAINING_LEGACY_CALLER_FILE_COUNT_AFTER_SLICE=18

EXACT_RUNTIME_SCOPE_FROZEN=true
FIRST_SLICE_EXACT_RUNTIME_ADMISSION=passed
EXACT_RUNTIME_FILE_COUNT=2
EXISTING_RUNTIME_FILE_COUNT=2
NEW_RUNTIME_FILE_COUNT=0
DELETE_RUNTIME_FILE_COUNT=0
EXACT_PRODUCTION_FILE_COUNT=1
EXACT_TEST_FILE_COUNT=1

EXACT_DOC_FILE_COUNT=6
EXISTING_DOC_FILE_COUNT=4
NEW_DOC_FILE_COUNT=2

SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false

CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

本 Admission 只冻结下一原子 Runtime 切片，不实施任何 caller migration。S6 formal scope port 与 S8 Audit Owner contract 是已完成 Foundation，本阶段没有修改它们，也没有连接数据库。

## 2. Fresh inventory 方法与边界

从当前 `main` 重新对非测试 `src/**` 执行 union search，覆盖：

- `createAuditEvent(`、`createDeniedAccessAuditEvent(`；
- `TenantAuditEvent` 的直接对象构造与 type-only 使用；
- `.record(`、`recordAttributed(`；
- `mapAuditEventToInsert(`、`mapAttributedAuditEventToInsert(`；
- transaction database 上的 `createAuditEventRepository(...)` 与直接 `audit_events` insert。

分类规则：生产 caller 是非测试源码中直接构造 Audit event 的文件；Repository、事务组合、Reader、type-only、demo fixture 与 mock 单独排除。`trial-data-reset-service.ts` 仅引用类型，不构造、不持久化；Audit domain / Repository 是 Owner contract，不计 caller；Reader route 与 orchestration Reader 也不计 Writer caller。

Fresh 结果与历史参考数量相同，但结论来自当前源码而非复制历史清单：

```text
HELPER_CONSTRUCTION_CALLER_FILE_COUNT=16
DIRECT_OBJECT_CONSTRUCTION_CALLER_FILE_COUNT=3
PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_LEGACY_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_ATTRIBUTED_WRITER_CALLER_FILE_COUNT=0
PRODUCTION_LEGACY_UNATTRIBUTED_NEW_WRITER_CALLER_FILE_COUNT=0
```

## 3. Caller inventory：来源、构造、持久化与目标

`transaction_repository` 表示 event 会进入 caller-provided transaction database 或直接事务 Repository；`other` 表示当前文件只返回 event，生产 Route 已 capability-off。`TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10` 继续采用事务持久化／组合文件口径，详见第 6 节；它不是下表 `TRANSACTION_BOUND=true` 的构造文件行数。

| PATH | SOURCE_FAMILY | CURRENT_EVENT_CONSTRUCTION | CURRENT_PERSISTENCE | TRANSACTION_BOUND | CURRENT_PRODUCTION_REACHABILITY | TARGET_ATTRIBUTION |
| --- | --- | --- | --- | --- | --- | --- |
| `src/modules/institution/server/followup-message-draft-api.ts` | Institution | helper | other | false | capability_off | BLOCKED_UNCLASSIFIED |
| `src/modules/institution/server/followup-message-draft-service.ts` | Institution | helper | transaction_repository | true | capability_off | VERIFIED |
| `src/modules/institution/server/his-connection-credential-service.ts` | Institution | helper | transaction_repository | true | capability_off | NOT_APPLICABLE |
| `src/modules/institution/server/his-connection-status-service.ts` | Institution | helper | transaction_repository | true | capability_off | NOT_APPLICABLE |
| `src/modules/institution/server/his-connection-test-connection-service.ts` | Institution | helper | record | false | capability_off | NOT_APPLICABLE |
| `src/modules/institution/server/his-connection-write-service.ts` | Institution | helper | transaction_repository | true | capability_off | NOT_APPLICABLE |
| `src/modules/institution/server/tenant-business-api.ts` | Institution | helper | transaction_repository | true | capability_off | BLOCKED_UNCLASSIFIED |
| `src/modules/institution/server/trusted-reachout-safety-service.ts` | Institution | helper | transaction_repository | true | capability_off | VERIFIED |
| `src/modules/institution/server/wecom-customer-mapping-service.ts` | Institution | helper | transaction_repository | true | capability_off | VERIFIED |
| `src/modules/institution/server/wecom-dry-run-snapshot-service.ts` | Institution | helper | record | false | capability_off | VERIFIED |
| `src/modules/institution/server/wecom-real-send-proof-service.ts` | Institution | helper | transaction_repository | true | capability_off | VERIFIED |
| `src/app/api/v1/open-platform/ai-model-config/route.ts` | Platform | helper | record | false | active | NOT_APPLICABLE |
| `src/app/api/v1/open-platform/ai-model-config/sync/route.ts` | Platform | helper | record | false | active | NOT_APPLICABLE |
| `src/app/api/v1/open-platform/ai-model-config/test/route.ts` | Platform | helper | record | false | active | NOT_APPLICABLE |
| `src/modules/open-platform/server/platform-knowledge-management-service.ts` | Platform | helper | record | false | active | NOT_APPLICABLE |
| `src/modules/open-platform/server/tenant-account-management-service.ts` | Platform | direct_object | transaction_repository | true | active | NOT_APPLICABLE |
| `src/modules/open-platform/server/tenant-plan-binding-service.ts` | Platform | direct_object | transaction_repository | true | active | NOT_APPLICABLE |
| `src/modules/open-platform/server/tenant-plan-change-service.ts` | Platform | direct_object | transaction_repository | true | active | NOT_APPLICABLE |
| `src/app/api/auth/login/route.ts` | Auth | helper | record | false | active | NOT_APPLICABLE |

11 个 Institution production source 当前均位于 capability-off Route 后或没有 active direct Route。当前 Git history 与 Route source 没有证明它们已经 dead，也没有授权 legacy exit；因此全部保留在 migration inventory，按 future re-enable candidate 处理。只有另行证明 dead 并取得 exit 授权后，才可用删除替代迁移。

```text
CAPABILITY_OFF_CALLER_DECISION=MIGRATE_OR_CLOSE_BLOCKING_PREREQUISITE
LEGACY_EXIT_CANDIDATE_COUNT=0
PRODUCTION_LEGACY_WRITER_RESIDUAL_TARGET=0
```

## 4. Caller inventory：formal pair 与业务 pair

`FORMAL_SCOPE_CURRENTLY_AVAILABLE_AT_COMPOSITION_ROOT=false` 表示当前 legacy path 没有消费 S6 port；不是说 S6 port 不存在。对于 `NOT_APPLICABLE`，formal scope 与业务 institution pair 均不应被引入。

| PATH | FORMAL_SCOPE_REQUIRED | FORMAL_SCOPE_CURRENTLY_AVAILABLE_AT_COMPOSITION_ROOT | BUSINESS_OBJECT_PAIR_AVAILABLE | PAIR_COMPARISON_REQUIRED | TARGET_PERSISTENCE | MIGRATION_OWNER |
| --- | --- | --- | --- | --- | --- | --- |
| `src/modules/institution/server/followup-message-draft-api.ts` | true | false | false | true | recordAttributed | Institution + orchestration + Audit prerequisite |
| `src/modules/institution/server/followup-message-draft-service.ts` | true | false | true | true | recordAttributed | Institution/Care + orchestration |
| `src/modules/institution/server/his-connection-credential-service.ts` | false | false | false | false | recordAttributed | Institution HIS |
| `src/modules/institution/server/his-connection-status-service.ts` | false | false | false | false | recordAttributed | Institution HIS |
| `src/modules/institution/server/his-connection-test-connection-service.ts` | false | false | false | false | recordAttributed | Institution HIS |
| `src/modules/institution/server/his-connection-write-service.ts` | false | false | false | false | recordAttributed | Institution HIS |
| `src/modules/institution/server/tenant-business-api.ts` | true | false | false | true | recordAttributed | Institution + orchestration + Audit prerequisite |
| `src/modules/institution/server/trusted-reachout-safety-service.ts` | true | false | true | true | recordAttributed | Institution/Messaging + orchestration |
| `src/modules/institution/server/wecom-customer-mapping-service.ts` | true | false | true | true | recordAttributed | Institution + orchestration |
| `src/modules/institution/server/wecom-dry-run-snapshot-service.ts` | true | false | true | true | recordAttributed | Institution/Messaging + orchestration |
| `src/modules/institution/server/wecom-real-send-proof-service.ts` | true | false | true | true | recordAttributed | Institution/Messaging + orchestration |
| `src/app/api/v1/open-platform/ai-model-config/route.ts` | false | false | false | false | recordAttributed | Open Platform |
| `src/app/api/v1/open-platform/ai-model-config/sync/route.ts` | false | false | false | false | recordAttributed | Open Platform |
| `src/app/api/v1/open-platform/ai-model-config/test/route.ts` | false | false | false | false | recordAttributed | Open Platform |
| `src/modules/open-platform/server/platform-knowledge-management-service.ts` | false | false | false | false | recordAttributed | Open Platform |
| `src/modules/open-platform/server/tenant-account-management-service.ts` | false | false | false | false | recordAttributed | Open Platform |
| `src/modules/open-platform/server/tenant-plan-binding-service.ts` | false | false | false | false | recordAttributed | Open Platform + Access Control transaction composition |
| `src/modules/open-platform/server/tenant-plan-change-service.ts` | false | false | false | false | recordAttributed | Open Platform |
| `src/app/api/auth/login/route.ts` | false | false | false | false | recordAttributed | Auth |

### 4.1 VERIFIED 的事实要求

五个 `VERIFIED` caller 都处理具体 institution-scoped 业务对象：随访消息草稿／delivery、客户 reachout safety、客户映射、机构 dry-run snapshot、真实发送 proof。它们已有 transaction-bound 或 operation-bound `tenantId + institutionId` 业务 pair；迁移时必须由 orchestration 先且仅先消费一次 S6 formal scope，再与该 pair 完全比较，然后才创建 attributed event。业务 transaction 已有 authoritative pair 时不得追加 customer、draft、mapping 或 proof ownership query。

```text
PAIR_REVALIDATION_REQUIRED=false
FORMAL_SCOPE_RESOLUTION_CARDINALITY=exactly_once_per_top_level_operation
FORMAL_SCOPE_REUSE_WITHIN_OPERATION_SAFE=true
```

一个 top-level operation 可能产生多个 event：随访 delivery 可以记录 created、contact safety、WeCom mock 与 status 多条事件，real-send proof 也可按 gate、confirmation 与 outcome 记录多条事件。S6 handle 的 `CONSUMPTION_COUNT=1` 因此不能按 event 重复 resolve/consume；应在 operation composition root 取得一个冻结 pair，并在该 operation 内复用。pair 只含 `tenantId + institutionId + observedAt`，不替代 action/resource authorization。

### 4.2 NOT_APPLICABLE 的事实要求

- 四个 HIS connection caller 管理 tenant-wide connection、credential、status 与 test connection；当前对象没有 institutionId，不能因位于 Institution 目录而伪造 `verified`。
- 七个 Open Platform caller 管理 platform AI config、tenant knowledge、tenant account 与 plan lifecycle；现有 platform authorization、跨 tenant 行为与事务语义不变。
- Auth caller 记录 Identity/Membership 登录结果；`FormalMembershipAuditSnapshotV1` 有意不暴露 institutionId，登录不是已经授权的单一 institution action。

这些 caller 的目标统一为：

```ts
createAttributedTenantAuditEventV1({
  event,
  attribution: {
    institutionAttribution: 'not_applicable',
    tenantId: event.tenantId,
    institutionId: null,
  },
});
```

然后调用 `recordAttributed()`。`scope port unavailable`、尚未迁移或 provenance 缺失都不能被当作 `not_applicable`。

### 4.3 BLOCKED_UNCLASSIFIED 与独立 prerequisite

两个文件不能按文件级目标安全归为 `verified` 或 `not_applicable`：

1. `followup-message-draft-api.ts` 同时创建 allowed follow-up event 与 formal scope 尚未成立时的 denied event；当前只持有普通 `AccessContext`，没有可信 attempted institution pair 或业务对象 pair。
2. `tenant-business-api.ts` 同时包含 customer / appointment / follow-up 的 allowed、not-found、transition、quota 与 pre-scope access denial；有些 mutation 成功路径能进入 transaction，有些 denial 在 object pair 确认之前发生。

这些事件明确针对 institution 业务，但当前 attributed contract 只能表达 `verified` 或确实不适用的 `not_applicable`，不能表达“尝试访问某 institution，但 formal scope 因拒绝而未成立”。因此：

```text
BLOCKING_PREREQUISITE_COUNT=1
PRIMARY_BLOCKING_PREREQUISITE=Audit Owner attempted-institution denied attribution contract plus orchestration provenance admission for the two mixed pre-scope caller files
NEXT_ATOMIC_PREREQUISITE_TASK=POST-V2-R1C Audit Writer attempted institution denied attribution contract fresh audit and exact Runtime admission
```

该 prerequisite 不阻断 `AUTH_LOGIN_NOT_APPLICABLE_V1`，但在最终 residual 清零前必须单独准入。不得把这些拒绝事件降级为 `not_applicable`，也不得伪造 `verified`。

## 5. Caller future dependency 与测试面

下表是 inventory 级 dependency 记录，不是本次 Runtime allowlist。除首切片外，未来每个 slice 仍须 fresh freeze；`mixed prerequisite` 表示现有 contract 下不能形成安全文件集。

| PATH | REQUIRED_RUNTIME_FILES | REQUIRED_TEST_FILES | ARCHITECTURE_RISK | BLOCKER |
| --- | --- | --- | --- | --- |
| `src/modules/institution/server/followup-message-draft-api.ts` | not_frozen: blocked prerequisite | `src/modules/institution/tests/FollowUpMessageDraftApiRoutes.test.ts` | high: mixed pre-scope semantics and no active composition root | attempted institution denial is not representable |
| `src/modules/institution/server/followup-message-draft-service.ts` | `src/modules/institution/server/followup-message-draft-service.ts`; `src/server/orchestration/care-follow-up-transaction.ts` | `src/modules/institution/tests/FollowUpMessageDraftService.test.ts`; `src/modules/institution/tests/FollowUpMessageDraftApiRoutes.test.ts`; `src/server/orchestration/care-follow-up-transaction.test.ts` | medium: module must not import orchestration; multi-event pair reuse | none after exact composition slice |
| `src/modules/institution/server/his-connection-credential-service.ts` | `src/modules/institution/server/his-connection-credential-service.ts` | `src/modules/institution/tests/HisConnectionCredentialService.test.ts`; `src/modules/institution/tests/HisConnectionCredentialApiRoutes.test.ts` | medium: preserve provider-failure isolation and transaction rollback | none |
| `src/modules/institution/server/his-connection-status-service.ts` | `src/modules/institution/server/his-connection-status-service.ts` | `src/modules/institution/tests/HisConnectionStatusService.test.ts`; `src/modules/institution/tests/HisConnectionApiRoutes.test.ts` | low: preserve transaction rollback | none |
| `src/modules/institution/server/his-connection-test-connection-service.ts` | `src/modules/institution/server/his-connection-test-connection-service.ts` | `src/modules/institution/tests/HisConnectionTestConnectionService.test.ts`; `src/modules/institution/tests/HisConnectionTestConnectionApiRoute.test.ts` | low: preserve test response isolation | none |
| `src/modules/institution/server/his-connection-write-service.ts` | `src/modules/institution/server/his-connection-write-service.ts` | `src/modules/institution/tests/HisConnectionWriteService.test.ts`; `src/modules/institution/tests/HisConnectionApiRoutes.test.ts` | low: preserve transaction rollback | none |
| `src/modules/institution/server/tenant-business-api.ts` | not_frozen: blocked prerequisite including `src/modules/institution/server/tenant-business-audit-transaction.ts` | `src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`; future exact transaction composition regression | high: mixed pre-scope denial and partial object pair | attempted institution denial is not representable |
| `src/modules/institution/server/trusted-reachout-safety-service.ts` | `src/modules/institution/server/trusted-reachout-safety-service.ts`; `src/server/orchestration/wecom-reachout-transaction.ts` | `src/modules/institution/tests/TrustedReachOutSafetyService.test.ts`; `src/modules/institution/tests/TrustedReachOutSafetyTransaction.test.ts`; `src/server/orchestration/wecom-reachout-transaction.test.ts` | medium: cross-owner formal pair composition | none after exact composition slice |
| `src/modules/institution/server/wecom-customer-mapping-service.ts` | `src/modules/institution/server/wecom-customer-mapping-service.ts`; `src/modules/institution/server/wecom-customer-mapping-transaction.ts` | `src/modules/institution/tests/WeComCustomerMappingService.test.ts`; `src/modules/institution/tests/WeComCustomerMappingApiRoute.test.ts` | medium: pair mismatch must fail before insert | none after exact composition slice |
| `src/modules/institution/server/wecom-dry-run-snapshot-service.ts` | `src/modules/institution/server/wecom-dry-run-snapshot-service.ts`; `src/server/orchestration/wecom-reachout-transaction.ts` | `src/modules/institution/tests/WeComDryRunSnapshotService.test.ts`; `src/modules/institution/tests/WeComDryRunSnapshotApiRoute.test.ts`; `src/server/orchestration/wecom-reachout-transaction.test.ts` | medium: currently capability-off and no active composition root | none after exact composition slice |
| `src/modules/institution/server/wecom-real-send-proof-service.ts` | `src/modules/institution/server/wecom-real-send-proof-service.ts`; `src/modules/institution/server/wecom-real-send-proof-repository.ts`; `src/server/orchestration/wecom-reachout-transaction.ts` | `src/modules/institution/tests/WeComRealSendProofService.test.ts`; `src/modules/institution/tests/WeComRealSendProofRepository.test.ts`; `src/modules/institution/tests/WeComRealSendExecutionShellService.test.ts`; `src/server/orchestration/wecom-reachout-transaction.test.ts` | medium: multi-event pair reuse and transaction abort semantics | none after exact composition slice |
| `src/app/api/v1/open-platform/ai-model-config/route.ts` | `src/app/api/v1/open-platform/ai-model-config/route.ts` | `src/modules/open-platform/tests/OpenPlatformAiModelConfigPersistence.test.ts` | low: preserve best-effort response isolation | none |
| `src/app/api/v1/open-platform/ai-model-config/sync/route.ts` | `src/app/api/v1/open-platform/ai-model-config/sync/route.ts` | `src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts` | low: preserve external-operation isolation | none |
| `src/app/api/v1/open-platform/ai-model-config/test/route.ts` | `src/app/api/v1/open-platform/ai-model-config/test/route.ts` | `src/modules/open-platform/tests/OpenPlatformAiModelVendorOperations.test.ts` | low: preserve external-operation isolation | none |
| `src/modules/open-platform/server/platform-knowledge-management-service.ts` | `src/modules/open-platform/server/platform-knowledge-management-service.ts` | `src/modules/open-platform/tests/OpenPlatformKnowledgeManagementRealCore.test.ts`; `src/modules/institution/tests/KnowledgeManagementPlatformInstitutionE2EAcceptance.test.ts` | low: tenant selector remains platform control-plane | none |
| `src/modules/open-platform/server/tenant-account-management-service.ts` | `src/modules/open-platform/server/tenant-account-management-service.ts`; `src/modules/open-platform/server/tenant-account-management-repository.ts` | `src/modules/open-platform/tests/TenantAccountManagementService.test.ts`; `src/modules/open-platform/tests/TenantAccountManagementRepository.test.ts`; `src/modules/open-platform/tests/TenantAccountManagementApiRoute.test.ts` | medium: direct mapper inside transaction | none |
| `src/modules/open-platform/server/tenant-plan-binding-service.ts` | `src/modules/open-platform/server/tenant-plan-binding-service.ts`; `src/modules/open-platform/server/tenant-plan-binding-repository.ts` | `src/modules/open-platform/tests/TenantPlanBindingService.test.ts`; `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`; `src/modules/open-platform/tests/TenantPlanBindingApiRoute.test.ts` | medium: two events and Access Control external transaction | none |
| `src/modules/open-platform/server/tenant-plan-change-service.ts` | `src/modules/open-platform/server/tenant-plan-change-service.ts`; `src/modules/open-platform/server/tenant-plan-change-repository.ts` | `src/modules/open-platform/tests/TenantPlanChangeService.test.ts`; `src/modules/open-platform/tests/TenantPlanChangeRepository.test.ts`; `src/modules/open-platform/tests/TenantPlanChangeApiRoute.test.ts` | medium: two transaction branches | none |
| `src/app/api/auth/login/route.ts` | `src/app/api/auth/login/route.ts` | `src/modules/auth/tests/FormalAuthRoutes.test.ts` | low: one active non-transaction caller and existing Audit dependency | none |

## 6. Transaction boundary fresh audit

Fresh search 得到以下 exact 10 个 transaction persistence / composition 文件：

1. `src/modules/institution/server/his-connection-credential-service.ts`
2. `src/modules/institution/server/his-connection-status-service.ts`
3. `src/modules/institution/server/his-connection-write-service.ts`
4. `src/modules/institution/server/tenant-business-audit-transaction.ts`
5. `src/modules/institution/server/wecom-customer-mapping-transaction.ts`
6. `src/modules/open-platform/server/tenant-account-management-repository.ts`
7. `src/modules/open-platform/server/tenant-plan-binding-repository.ts`
8. `src/modules/open-platform/server/tenant-plan-change-repository.ts`
9. `src/server/orchestration/care-follow-up-transaction.ts`
10. `src/server/orchestration/wecom-reachout-transaction.ts`

所有 10 个路径的共同约束：

- business mutation 与 Audit insert 当前共用同一 transaction；
- Audit Repository 或直接 mapper 使用 caller-provided transaction database；
- migration 不得调用 `database.transaction()` 创建第二个 transaction；
- Audit failure 继续触发当前 transaction rollback；Auth 与 AI config 等非事务 best-effort caller 则继续隔离响应；
- `VERIFIED` future slice 在进入 transaction operation 前由 orchestration resolve/consume formal pair，transaction 内使用已有业务对象 pair交叉确认；
- mismatch 在 attributed event 创建／insert 前 fail-closed；不追加 ownership query，不产生 N+1；
- 三个 Open Platform direct-object Repository 需要将 direct mapper 改为 attributed mapper，因此必须与各自 service 同 slice；其他 transaction Repository 是否需要修改由对应 future exact slice 冻结，不允许顺手扩张。

```text
TRANSACTION_ROLLBACK_SEMANTICS_CHANGE=false
NEW_DATABASE_TRANSACTION_REQUIRED=false
PAIR_REVALIDATION_REQUIRED=false
DUPLICATE_QUERY_REQUIRED=false
N_PLUS_ONE_QUERY_REQUIRED=false
```

## 7. Migration strategy 比较

| 方案 | 文件与 Owner | 事务与信任 | 审查／回滚 | 结论 |
| --- | --- | --- | --- | --- |
| A：19 caller single wave | 至少 19 构造文件、10 个事务边界与多组测试；横跨 Auth、Open Platform、Institution、Care、Messaging、Audit、orchestration | 同时混入 `verified`、`not_applicable` 与 2 个 blocked mixed caller | 无法独立定位 rollback，Review surface 过大 | 拒绝 |
| B：先完整 NOT_APPLICABLE | 12 callers；仍含 4 个 HIS、7 个 Platform、1 个 Auth 与 6 个事务路径 | trust 清楚，但事务与 best-effort 语义差异大 | 比 single wave 小，仍不是最小原子切片 | 不作为单 wave |
| C：先 VERIFIED 非事务 | 只有 dry-run 看似非事务，但当前 capability-off、无 active composition root，仍需 formal scope 与 business pair composition | provenance 和 pair 组合尚未独立冻结 | 为追求非事务会引入新 composition scope | 拒绝首切片 |
| D：按 composition family 拆分 | Auth、Platform AI、Platform lifecycle、HIS、Care、Messaging/Reachout、tenant business 分别验收 | 每个 slice 只处理一种 classification 与 rollback 模式 | 最容易准确测试和回滚 | 采用 |

因此选择 `SPLIT`。首切片不是因为“Platform first”的预设，而是 fresh 比较后发现 Auth 登录只有 1 个 caller、1 个既有测试文件，不需要 formal scope、Schema、transaction Repository 或 Architecture exception，同时确实减少一个 active legacy residual。

## 8. First Runtime slice exact Admission

### 8.1 Exact allowlist

| path | file_class | role | change | reason |
| --- | --- | --- | --- | --- |
| `src/app/api/auth/login/route.ts` | production | Auth 正式登录 Audit caller | existing_runtime | 用 `createAttributedTenantAuditEventV1(...not_applicable...)` 与 `recordAttributed()` 替换该 caller 的 legacy `record()`，保持成功／失败与 best-effort 隔离 |
| `src/modules/auth/tests/FormalAuthRoutes.test.ts` | test | 正式登录 Route 与 Audit contract 回归 | existing_test | 证明成功与拒绝登录均写 `not_applicable`，legacy `record()` 为零，审计异常不改变认证响应且无新增 DB transaction/query |

机器可读 allowlist：`docs/operations/post-v2-r1c-audit-writer-classified-caller-migration-exact-runtime-allowlist-20260813.csv`。

任何第 3 个 Runtime/Test 文件、S6 scope port、S8 contract、Schema、Migration、Architecture rules、Workbench 或页面变更均属于 Admission drift，必须停止并重新准入。

### 8.2 Test closure

下一 Runtime 只允许修改 allowlist 中的 2 个文件，但验证至少必须覆盖：

1. `FormalAuthRoutes.test.ts`：allowed / denied formal login 都调用 `recordAttributed()`，attribution 固定为 `not_applicable + tenantId + institutionId=null`；
2. legacy `record()` 在 admitted route 中调用数为 0，非法 attributed fallback 不存在；
3. membership audit snapshot 不读取、推断或传播 institutionId；
4. Audit failure 继续被 catch，认证 HTTP status、cookie 与低敏响应不变；
5. `getDatabase()`、membership reader 与 formal context resolver 调用基数不增加；不新开 transaction、不追加 query；
6. 全仓 caller static guard 从 19 个 legacy construction files 精确减少为 18，其他 18 个 caller 不发生变化；
7. Audit domain / Repository attributed regression、S6 scope-port regression、Auth Route regression、typecheck、AQ004–AQ008、Architecture incremental 与 ProductionReadinessDocs 通过。

建议验证集合：

```text
src/modules/audit/tests/AuditEventsDomain.test.ts
src/modules/audit/tests/AuditEventRepository.test.ts
src/server/orchestration/institution-audit-writer-scope.test.ts
src/modules/auth/tests/FormalAuthRoutes.test.ts
src/modules/auth/tests/FormalInstitutionSessionContext.test.ts
src/modules/auth/tests/DemoAuthRoutes.test.ts
```

### 8.3 Exact docs scope

S9 docs-only scope 冻结为 6 文件，2 个新增、4 个既有：

1. `docs/operations/post-v2-r1c-audit-writer-classified-caller-migration-admission-20260813.md`
2. `docs/operations/post-v2-r1c-audit-writer-classified-caller-migration-exact-runtime-allowlist-20260813.csv`
3. `docs/architecture/README.md`
4. `docs/handoff/CURRENT_STATUS.md`
5. `docs/handoff/NEXT_TASK.md`
6. `docs/handoff/RELEASE_HISTORY.md`

完整 caller inventory 保留在本文，不创建额外 inventory CSV。

## 9. Architecture 与数据边界

- AQ004：不新增 Institution 文件；首切片不修改 Institution。
- AQ005：不新增 Open Platform 文件；首切片不修改 Open Platform。
- AQ006：不修改 domain layer dependency。
- AQ007：Auth Route 已有 Audit domain / server dependency；首切片不新增 module → orchestration 或跨模块 Repository 依赖。
- AQ008：不修改 Membership/Binding Writer，正式登录 authoritative Membership reader 语义不变。
- 不修改 `architecture-quality-rules.json`，不删除 AQ004，不需要 exception。
- 不连接数据库，不执行 SELECT/INSERT/UPDATE/DELETE、DDL、DML、Seed 或 backfill；Runtime 未来使用既有列与 `recordAttributed()`。

```text
FOUNDATION_DRIFT=false
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false
HISTORICAL_BACKFILL_CLOSED=false
```

## 10. 保持状态与下一任务

```text
CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false

WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1

DATABASE_CONNECTION=false
DATABASE_WRITE_EXECUTION=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false

NEXT_TASK=POST-V2-R1C Audit Writer caller migration AUTH_LOGIN_NOT_APPLICABLE_V1 exact 2-file Runtime implementation explicit authorization
```

本 Admission 不构成 Runtime 授权。只有用户对 exact 2-file slice 再次明确授权后，才能修改 Auth Route 与测试；不能自动开始 Platform、HIS、Institution 或 attempted-scope prerequisite。
