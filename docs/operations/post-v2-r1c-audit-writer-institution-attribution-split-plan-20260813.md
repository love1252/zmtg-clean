# POST-V2-R1C Audit Writer 机构归因 fresh audit 与拆分方案

> 日期：2026-08-13
>
> S4 基线：`f4fa212ba6e27eb13926c5f6f05c9059a26bbfee`
>
> Phase 1 审计基线：`44b2f3653fbfd5cc4dd02f33e5c2c8fc80f292cb`
>
> 类型：fresh audit / split-required blocker / 仅文档

## 1. 唯一结论

```text
AUDIT_WRITER_ATTRIBUTION_FRESH_AUDIT=passed
AUDIT_WRITER_ATTRIBUTION_RUNTIME_ELIGIBLE=false
ADMISSION_MODE=SPLIT_REQUIRED

BLOCKING_PREREQUISITE_COUNT=3
PRIMARY_BLOCKING_PREREQUISITE=formal institution Audit Writer scope port
BLOCKING_OWNER=src/server/orchestration + src/modules/security + src/modules/audit

AUDIT_WRITER_ATTRIBUTION_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

完整 Writer closure 不能安全压缩为单个 mapper 改动，也不适合把跨 Audit、Security、Auth、Open Platform、冻结 Institution 与多个事务组合根的改动塞入一个巨型 Runtime PR。当前缺失的第一项原子前置是：复用既有正式 Session / Membership / Scope 授权链，向 Audit Writer 提供 one-shot opaque formal institution pair；在该 port 合并前，任何普通 `AccessContext`、body、query、header、cookie 或 Repository 推断都不得被提升为 `verified`。

## 2. S4 Phase 0 Review 债务已闭环

```text
PR1171_POST_MERGE_P1_RESOLVED=true
PR1171_POST_MERGE_P2_RESOLVED=true
PHASE0_FIX_PR=1172
PHASE0_FIX_HEAD=9f87b7493ca61a70999d6571f9f7f1bc03f56a10
PHASE0_FIX_MERGE=44b2f3653fbfd5cc4dd02f33e5c2c8fc80f292cb
PHASE0_REQUIRED_CHECK=passed
PHASE0_ACTIONABLE_P0_P1=0
```

PR #1172 已将宽泛的 `AUTHORIZATION_SAFE=true` 拆成：

```text
AUDIT_READER_API_AUTHORIZATION_SAFE=true
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=false
```

并明确 Handoff 只定义或建议下一任务，不能成为 Runtime、数据库、GitHub 写入或后续任务授权来源。合并后仅对 PR #1171 的 `PRRT_kwDOSrGMn86YzJfF` 与 `PRRT_kwDOSrGMn86YzJfG` 回复并解决，两者只读复核均为 `isResolved=true`。

## 3. Canonical Writer 当前链路

当前唯一 Audit persistence Owner 仍是：

```text
createAuditEvent / createDeniedAccessAuditEvent
-> TenantAuditEvent
-> AuditEventRepository.record
-> mapAuditEventToInsert
-> audit_events
```

`TenantAuditEvent` 没有 `institutionId` / `institutionAttribution`，`createAuditEvent()` 只从普通 `AccessContext` 提取 tenant scope；`mapAuditEventToInsert()` 也不写两个机构归因列。修改 Repository 根据 resource、actor、当前账号绑定或“租户只有一个机构”推断，既没有所需事实，也会破坏 Owner 与事务语义。

现有 Schema 已提供 nullable `institution_id` 与 `institution_attribution`，enum 为 `not_applicable | verified | legacy_unattributed`。因此 Writer 关闭不需要 Schema、Migration、DDL 或 DML。

## 4. 生产调用面清单

本报告把“生产 Writer caller”定义为：非测试源码中直接构造 `TenantAuditEvent` 的文件；既包括调用 `createAuditEvent` / `createDeniedAccessAuditEvent` 的文件，也包括直接构造 typed / inferred event object 的文件。Repository 与事务组合文件单独统计，type-only、Reader-only、test、demo fixture 与 mock 均不计入 caller。

S5 Phase 0 重新执行仓库级 union search 后确认：helper 构造文件为 16，另有 3 个未使用 helper、直接构造 event object 的 Open Platform service；S4 原计数遗漏了后三者，现已修正为 exact count。

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

### 4.1 Institution 业务面：11 文件

| 文件 | 当前事实 | 目标分类 | 未来分类要求 |
| --- | --- | --- | --- |
| `src/modules/institution/server/followup-message-draft-api.ts` | helper 只接收普通 `AccessContext` | `INSTITUTION_VERIFIED`；无法取得 formal pair 的前置授权拒绝为 `NOT_APPLICABLE` | 正式机构调用必须由 formal scope port 提供 pair 后才可 `verified` |
| `src/modules/institution/server/followup-message-draft-service.ts` | 部分写入检查 tenant/institution shape 并与业务对象同 pair，但无 formal provenance | `INSTITUTION_VERIFIED` | formal pair 与 transaction-bound object pair 一致时 `verified` |
| `src/modules/institution/server/his-connection-credential-service.ts` | 当前 HIS connection 只按 tenant 管理 | `NOT_APPLICABLE` | 当前语义为 tenant control-plane；未来若改为机构对象必须另行准入 |
| `src/modules/institution/server/his-connection-status-service.ts` | 当前只持有 tenantId / connectionId | `NOT_APPLICABLE` | 不得伪造 institution |
| `src/modules/institution/server/his-connection-test-connection-service.ts` | tenant reader/writer，Audit 不与 health update 共用 transaction | `NOT_APPLICABLE` | 不得从 connectionId 猜 institution |
| `src/modules/institution/server/his-connection-write-service.ts` | tenant-scoped HIS connection transaction | `NOT_APPLICABLE` | 不得因位于 Institution 模块就标为 `verified` |
| `src/modules/institution/server/tenant-business-api.ts` | legacy tenant-wide helper；customer/appointment/follow-up 本应机构化，但 helper 不要求 formal institution | 机构业务事件为 `INSTITUTION_VERIFIED`；缺少 formal pair 的 pre-scope 授权拒绝为 `NOT_APPLICABLE` | 新正式机构调用禁止继续写 legacy；必须先迁移到 formal pair |
| `src/modules/institution/server/trusted-reachout-safety-service.ts` | context 与 scope 分开传入，业务 Repository 用 tenant/institution pair | `INSTITUTION_VERIFIED` | formal pair 与 scope pair 必须一致，否则 fail-closed |
| `src/modules/institution/server/wecom-customer-mapping-service.ts` | context 与明确 tenant/institution 分开传入 | `INSTITUTION_VERIFIED` | formal pair 与 mapping/customer pair 必须一致后 `verified` |
| `src/modules/institution/server/wecom-dry-run-snapshot-service.ts` | context 与 snapshot pair 分开传入 | `INSTITUTION_VERIFIED` | formal pair 与 snapshot pair 必须一致后 `verified` |
| `src/modules/institution/server/wecom-real-send-proof-service.ts` | 已要求 `server_session` 与 tenant/institution，并核对 ready source | `INSTITUTION_VERIFIED` | 当前最接近目标，但仍不是 opaque current authorization；必须接入同一 formal port |

这些服务大多位于当前 capability-off Route 后或没有生产 Route caller；“当前不可达”不能替代 Writer 契约。未来重新启用时，类型与运行时边界必须阻止未验证的机构写入。

没有任何新生产事件获准使用 `LEGACY_UNATTRIBUTED`：

```text
PRODUCTION_LEGACY_UNATTRIBUTED_NEW_WRITER_CALLER_FILE_COUNT=0
```

### 4.2 Platform：7 文件

以下事件属于 platform / tenant control-plane，不属于单一正式 institution，未来应显式写 `institutionId=null` 与 `institutionAttribution=not_applicable`：

- `src/app/api/v1/open-platform/ai-model-config/route.ts`
- `src/app/api/v1/open-platform/ai-model-config/sync/route.ts`
- `src/app/api/v1/open-platform/ai-model-config/test/route.ts`
- `src/modules/open-platform/server/platform-knowledge-management-service.ts`
- `src/modules/open-platform/server/tenant-account-management-service.ts`
- `src/modules/open-platform/server/tenant-plan-binding-service.ts`
- `src/modules/open-platform/server/tenant-plan-change-service.ts`

新增确认的三个 caller 逐项证据如下：

| Service | Event 构造 | Canonical persistence / transaction Repository | Production Route | 目标分类 | Downstream tests |
| --- | --- | --- | --- | --- | --- |
| `tenant-account-management-service.ts` | `buildAuditEvent(): TenantAuditEvent` 直接返回 object | `tenant-account-management-repository.ts` 在 account mutation transaction 内调用 `mapAuditEventToInsert()` | `src/app/api/v1/open-platform/tenants/[tenantId]/account/route.ts` | `NOT_APPLICABLE` | `TenantAccountManagementService.test.ts`、`TenantAccountManagementRepository.test.ts`、`TenantAccountManagementApiRoute.test.ts` |
| `tenant-plan-binding-service.ts` | 直接构造 `auditEvent` 与 `accountAuditEvent` 两个 object | `tenant-plan-binding-repository.ts` 在 tenant onboarding transaction 内两次调用 `mapAuditEventToInsert()` | `src/app/api/v1/open-platform/tenants/route.ts`，经 `_membership-command-composition.ts` 创建 Repository | `NOT_APPLICABLE` | `TenantPlanBindingService.test.ts`、`TenantPlanBindingRepository.test.ts`、`TenantPlanBindingApiRoute.test.ts` |
| `tenant-plan-change-service.ts` | initial assignment 与 plan change 分支均直接构造 `auditEvent` object | `tenant-plan-change-repository.ts` 在两个 plan mutation transaction 内调用 `mapAuditEventToInsert()` | `src/app/api/v1/open-platform/tenants/[tenantId]/plan-change/route.ts`，经 `_plan-change-shared.ts` 创建 Repository | `NOT_APPLICABLE` | `TenantPlanChangeService.test.ts`、`TenantPlanChangeRepository.test.ts`、`TenantPlanChangeApiRoute.test.ts` |

这些事件描述的是平台操作者对 tenant、tenant member 与 plan lifecycle 的 control-plane 管理，不属于单一正式 institution，因此未来目标必须是 `institutionId=null` 与 `institutionAttribution=not_applicable`。不得仅依据 Open Platform 目录归类；这里的依据是 Route 强制 platform scope、业务对象为 tenant lifecycle control-plane，且事件没有经过任何正式 institution authorization chain。

Platform Audit 查询、跨租户 scope 与低敏输出语义不得改变。

### 4.3 Auth / 非机构：1 文件

- `src/app/api/auth/login/route.ts`

当前正式登录审计记录身份 / Membership 登录结果；`FormalMembershipAuditSnapshotV1` 有意只暴露 membership id、tenant 与 role，不暴露 institutionId。该事件不是已经授权的机构业务动作，当前应为 `not_applicable`，不得从当前账号绑定反推机构。

### 4.4 事务组合面：10 文件

- `src/modules/institution/server/his-connection-credential-service.ts`
- `src/modules/institution/server/his-connection-status-service.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/server/tenant-business-audit-transaction.ts`
- `src/modules/institution/server/wecom-customer-mapping-transaction.ts`
- `src/modules/open-platform/server/tenant-account-management-repository.ts`
- `src/modules/open-platform/server/tenant-plan-binding-repository.ts`
- `src/modules/open-platform/server/tenant-plan-change-repository.ts`
- `src/server/orchestration/care-follow-up-transaction.ts`
- `src/server/orchestration/wecom-reachout-transaction.ts`

前三个新增确认的 Open Platform Repository 均在 mutation transaction 内直接调用 `mapAuditEventToInsert()` 写 `audit_events`；其余路径把 `AuditEventRepository` 绑定到业务 transaction database。未来 attribution 只能作为已验证的不可变输入传入；Audit Repository 不得自行开启第二个 transaction。现有“同一事务中的 Audit 失败导致业务 mutation 回滚”必须保持。Auth 与部分 Platform Audit 当前采用 best-effort / 响应隔离语义，也不得被中央改动意外改成业务回滚。

### 4.5 新增 Platform caller 的 downstream migration 测试面

后续 classified caller migration 必须覆盖以下 9 个现有测试文件，不得只改 service object shape：

- `src/modules/open-platform/tests/TenantAccountManagementService.test.ts`
- `src/modules/open-platform/tests/TenantAccountManagementRepository.test.ts`
- `src/modules/open-platform/tests/TenantAccountManagementApiRoute.test.ts`
- `src/modules/open-platform/tests/TenantPlanBindingService.test.ts`
- `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`
- `src/modules/open-platform/tests/TenantPlanBindingApiRoute.test.ts`
- `src/modules/open-platform/tests/TenantPlanChangeService.test.ts`
- `src/modules/open-platform/tests/TenantPlanChangeRepository.test.ts`
- `src/modules/open-platform/tests/TenantPlanChangeApiRoute.test.ts`

S5 Phase 0 对该集合执行了 9 files / 54 tests，全部通过。`trial-data-reset-service.ts` 仅在当前 capability-disabled input type 中引用 `TenantAuditEvent`，不构造或持久化 event；Audit Reader、type-only 文件、test fixtures 与 mock 也均已排除。

## 5. 正式 institution pair 来源

```text
CANONICAL_WRITER_INSTITUTION_SCOPE_SOURCE=one-shot opaque formal server-session institution scope resolved from authoritative Identity + Membership/Binding + Institution Scope and passed through an orchestration-owned port
TENANT_INSTITUTION_PAIR_PROVENANCE=formal current pair first; transaction-bound business object pair is corroborating evidence and must exactly match
PAIR_REVALIDATION_REQUIRED=false
```

推荐来源复用现有正式 Session、authoritative Membership/Binding 与 Tenancy Scope 链，不建立第二套 authorization framework。port 消费后返回不可重放的 opaque pair；caller body/query/header/cookie 只能提供 selector，不能提供 attribution current。

当业务 mutation 已在同一 transaction 通过 tenant + institution 复合条件锁定对象时，Writer 只需比较该 pair 与 formal pair；不需要再发起重复 ownership query。任一缺失、过期或不一致必须在写入前 fail-closed，不得降级为 `legacy_unattributed`。

## 6. 历史 Backfill 决策

```text
HISTORICAL_BACKFILL_DECISION=required_under_current_page_release_contract
HISTORICAL_BACKFILL_REQUIRED_FOR_PAGE_RELEASE=true
DECISION_EVIDENCE=no persisted attribution enforcement epoch or Reader/API coverage metadata; 275/275 local rows have NULL attribution and Shell renders a successful zero-row response as an ordinary empty state
```

依据：本地 275 条现有记录全部为 attribution `NULL`，当前没有持久化的 Writer enforcement epoch，也没有 Reader/API coverage metadata；现有 Shell 会把成功的 0 行响应展示为普通空态。仅关闭新 Writer 后，0 条 `verified` 仍不能代表完整历史。

后续 backfill prerequisite 不表示强行把所有历史行标成 `verified`。正式分类必须遵循：唯一资源对象或事务证据可证明的行才可 `verified`；合法 platform / tenant control-plane 为 `not_applicable`；无法可靠归属的历史 tenant 事件为 `legacy_unattributed` 并继续从机构 Reader 排除。若未来要以明确 enforcement boundary 与“不含历史”的页面披露替代 backfill，必须另行改变页面完整性契约并重新准入；S4 不创建日期、不执行 DML，也不提前接受该替代方案。

## 7. 方案比较与唯一推荐

| 方案 | Owner / trust | 事务与兼容性 | 结论 |
| --- | --- | --- | --- |
| A：扩展 `TenantAuditEvent` / `createAuditEvent`，由 caller 显式提供 attribution | Audit Owner 正确，但普通 caller 可以自报 `verified`；19 个 caller 跨多个 Owner | 可以保持 transaction，但 trust 不闭合 | 单独采用不合格 |
| B：Repository / mapper 推断 | mapper 没有 formal scope、业务对象或可靠 ownership 事实；容易把当前账号、tenant-only 事件误归因 | 会引入跨 Owner 查询、额外 transaction 或 N+1 | 拒绝 |
| C：orchestration Writer boundary 接收 opaque formal scope，再调用 Audit Owner 的显式 attribution contract | 复用既有 formal authorization；Audit 继续拥有 domain/mapper/repository；caller 不能自报 current | attribution 作为数据进入既有 transaction，Platform / Auth 兼容性可显式保持 | 唯一推荐 |

```text
RECOMMENDED_RUNTIME_DESIGN=orchestration formal-scope port + Audit owner explicit attribution contract + classified caller migration
CANONICAL_AUDIT_WRITER_BOUNDARY=Audit domain event contract and AuditEventRepository mapper; institution composition belongs in src/server/orchestration
```

## 8. 为什么必须拆分

完整 closure 至少包含三个独立、可审查的原子切片：

1. formal institution Audit Writer scope port：复用既有正式 Identity / Membership / Scope 链，建立 one-shot opaque pair 与 fail-closed tests；
2. Audit Owner attribution contract：扩展事件 DTO / builders / mapper，显式区分 `verified` 与 `not_applicable`，拒绝非法 shape；
3. caller migration：按 Institution、Platform、Auth 与 10 个 transaction composition 点逐类迁移和回归，确保新正式 institution 写入不产生 `legacy_unattributed`。

把这三类跨 Owner 改动放入一个 Runtime PR 会超过项目默认审查边界，并使 formal trust、事务回滚与 caller 分类无法独立验收。S4 因此不生成虚假的“exact all-callers Runtime Admission”。

首个原子任务冻结为：

```text
NEXT_ATOMIC_TASK=POST-V2-R1C Audit Writer formal institution scope port fresh audit + exact Runtime admission
```

该任务仍只允许 fresh audit 与 docs-only Admission；是否实施 Runtime 必须由用户在后续任务中明确授权。

## 9. 本地 PostgreSQL 只读证据

```text
DATABASE_ENVIRONMENT=local_development
DATABASE_SOURCE=repository_local_acceptance_container
DATABASE_ENDPOINT_CLASS=loopback
DATABASE_READONLY_CONNECTION=passed
DATABASE_READONLY_TRANSACTION=on

AUDIT_SCHEMA_ATTRIBUTION_COLUMN_COUNT=3
AUDIT_TOTAL_ROW_COUNT=275
AUDIT_TENANT_ROW_COUNT=275
AUDIT_INSTITUTION_ID_PRESENT_ROW_COUNT=0
VERIFIED_ATTRIBUTED_ROW_COUNT=0
NOT_APPLICABLE_ROW_COUNT=0
LEGACY_UNATTRIBUTED_ROW_COUNT=0
NULL_ATTRIBUTION_ROW_COUNT=275

DATABASE_WRITE_EXECUTION=false
```

验证对象为本机 loopback `127.0.0.1:55432` 的 Docker PostgreSQL 16 local-acceptance 容器，只执行 `BEGIN READ ONLY`、metadata 与聚合计数；未读取事件 payload。

## 10. Schema 与 Architecture

```text
SCHEMA_CHANGE_REQUIRED=false
MIGRATION_REQUIRED=false
DDL_REQUIRED=false
DML_REQUIRED=false
ARCHITECTURE_EXCEPTION_REQUIRED=false

AQ004_PRESENT=true
AQ005_PRESENT=true
AQ006_PRESENT=true
AQ007_PRESENT=true
AQ008_PRESENT=true
```

推荐拆分保持 Audit Owner 在 `src/modules/audit`、cross-owner composition 在 `src/server/orchestration`，不向冻结 Institution 模块新增文件，不修改 `architecture-quality-rules.json`，也不删除 AQ004。

## 11. 验证

```text
TARGETED_TEST_FILES=18
TARGETED_TESTS=310
TARGETED_TESTS=passed
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
```

定向测试覆盖 Audit domain/repository、Formal Auth、Platform AI / Knowledge caller、Institution follow-up / HIS / WeCom caller，以及 Care / WeCom transaction composition。

## 12. 保持边界

```text
AUDIT_WRITER_ATTRIBUTION_RUNTIME_AUTHORIZED=false
AUDIT_READER_API_AUTHORIZATION_SAFE=true
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
DATABASE_WRITE_EXECUTION=false
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

S4 未实施 Writer、backfill、Schema、Migration、页面 Runtime、Workbench、Capability Authority、Staging 或 Production 变更。
