# 下一任务

## 唯一技术任务

```text
NEXT_TASK=POST-V2-R1C Audit Writer formal institution scope port exact 2-file Runtime implementation explicit authorization
AUDIT_WRITER_SCOPE_PORT_RUNTIME_AUTHORIZED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_AUTHORIZED=false
CALLER_MIGRATION_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
```

## 已完成准入

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

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=false
AUDIT_CALLER_MIGRATION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false
REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
PRODUCTION_CHANGE=false
PRODUCTION_DEPLOYMENT=false
```

## Exact Runtime allowlist

后续只有在用户明确授权该 Runtime 后，才可新增以下两个文件：

1. `src/server/orchestration/institution-audit-writer-scope.ts`
2. `src/server/orchestration/institution-audit-writer-scope.test.ts`

不允许修改任何既有 Runtime 文件，不允许新增第三个文件或删除文件。发现必须改动 Auth、Security、Access Control、Tenancy、Institution、Audit、Route、caller、配置或测试公共资产时，应视为 Admission drift 并停止。

## Runtime 验收重点

1. resolver 无输入，只读取当前正式 server-session cookie；
2. verified claims 的 `accountId + tenantId + institutionId` 必须经当前 authoritative Identity、active Membership / Binding 与 active Tenancy Institution Scope 交叉确认；
3. claims pair 与 authoritative session user pair 必须完全一致；
4. handle 必须 genuine、opaque、冻结、one-shot，clone / spread / plain object / JSON / Proxy 与 replay 必须失败；
5. output 只含 `tenantId + institutionId + observedAt`，不含 role、navigation、capability、session 或 credential；
6. 不得调用 Capability Authority 或 navigation，不得要求 Workbench / `system` capability；
7. config、cookie、session、Identity、Membership / Binding、Scope、stale、mismatch 与 dependency exception 均 fail-closed；
8. 端口只提供 attribution provenance，不替代 Route／section／object／action authorization，也不执行对象 ownership query 或数据库写入。

## 停止边界

- 本 Handoff 仅定义并建议下一原子任务；Handoff 自身不是 Runtime、数据库、GitHub 写入或后续任务授权；
- 未获用户当前明确授权前，不得实施 exact 2-file Runtime；
- 不得实施 Audit Owner attribution contract、caller migration 或 `page_system_audit` Runtime；
- 不得执行历史 backfill、数据库写入、Schema、Migration、DDL、DML 或 Seed；
- 不得修改 Workbench、Capability Authority、Platform Audit semantics、Architecture exception 或 AQ004～AQ008；
- 不得连接 Staging / Production；
- 不得接受普通 `AccessContext`、body、query、header、raw cookie、当前账号绑定、单机构假设或 Repository inference 作为 formal scope；
- formal scope port 合并后仍须独立准入 Audit Owner contract 与 classified caller migration，不能直接宣布 Writer closure、历史数据就绪或页面放行。
