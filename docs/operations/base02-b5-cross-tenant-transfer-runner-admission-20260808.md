# BASE-B5 Cross-Tenant Transfer Controlled Execution Runner 准入

> 日期：`2026-08-08`
>
> 冻结 Base：`197c195b250a701b09d50e683c2c2ebbabed8d09`
>
> 状态：`runner_admission_passed`
>
> 本任务只冻结一次性 controlled execution runner 的代码边界、输入契约、环境门与操作协议。
> 本任务不创建 runner，不连接数据库，不执行 DDL/DML/Migration，不执行 historical orphan remediation。

## 1. 前置事实

已完成：

- relation-orphan Option 1 ADR；
- cross-tenant transfer 4-file implementation admission；
- 4-file minimal implementation PR #1061；
- implementation Independent Review PR #1062；
- implementation Handoff PR #1063；
- `implementation_foundation_complete=true`；
- `controlled_execution_entry_present=false`。

现有 4-file foundation 已经提供：

```text
application transfer orchestration
single outer SERIALIZABLE transaction
account advisory xact lock
Membership/Binding Owner reuse
Scope assertion dependency injection
command/evidence correlation
outcome-unknown classification
```

因此下一阶段不需要长期业务 API，只需要一个一次性、localhost-only、local_acceptance-only 的受控 CLI runner。

## 2. 现有本地验收环境审计

现有：

```text
scripts/dev/local-acceptance-db.sh
```

已经冻结以下 local_acceptance 约定：

```text
container=zmtg-local-acceptance-pg
database=zmtg_clean_local_acceptance
host=127.0.0.1
port=55432
user=postgres
password=postgres
image=postgres:16-alpine
ownership_label=com.zmtg.local-acceptance=true
```

该 helper：

- 不读取 `.env.local`；
- shell 中出现非 localhost `DATABASE_URL` 时 fail-closed；
- 容器只绑定 `127.0.0.1`；
- 不自动 seed/reset。

新 runner 不修改该 helper，也不通过 package script 隐式调用 migrate/seed。

## 3. 现有 runner 模式审计

现有 `scripts/db/mig01-a2-provisioning-runner.mjs` 已证明 repository 中接受以下一次性 runner 模式：

- CLI 参数严格枚举；
- dry-run 与 execute 分离；
- private manifest 使用 absolute path；
- 文件 owner/mode/type/link/size 检查；
- `O_NOFOLLOW`；
- UTF-8 fatal decode；
- duplicate JSON key reject；
- 低敏 stdout/stderr；
- execution authorization 缺失时 fail-closed；
- Runner 不作为长期 API。

BASE-B5 runner 复用这些治理原则，但不能复用 provisioning 业务内核。

## 4. Exact implementation allowlist

未来 runner 实现只允许新增 **2 个文件**：

```text
scripts/db/base02-b5-cross-tenant-transfer-runner.mjs
scripts/db/base02-b5-cross-tenant-transfer-runner.test.mjs
```

```text
exact_file_count=2
package_json_change=false
lockfile_change=false
api_change=false
composition_root_change=false
schema_change=false
migration_change=false
existing_owner_writer_change=false
existing_transfer_foundation_change=false
```

如实现证明需要第 3 个文件，必须立即停止并重新准入。

特别禁止修改：

```text
package.json
pnpm-lock.yaml
scripts/dev/local-acceptance-db.sh
src/server/db/client.ts
src/server/db/schema.ts
src/modules/access-control/application/cross-tenant-transfer-service.ts
src/modules/access-control/server/cross-tenant-transfer-transaction.ts
src/modules/access-control/server/membership-command-repository.ts
src/modules/access-control/ports/membership-command-unit-of-work.ts
src/modules/tenancy/server/transaction-bound-institution-scope.ts
scripts/verify/architecture-quality.mjs
drizzle/*
```

## 5. Runner composition contract

Runner 是 repository-level composition boundary，可以只在自身文件内组合既有实现：

```text
createPostgresClient / createDatabase
+
createCrossTenantTransferTransactionPort
+
createTransactionBoundInstitutionScopeAssertion
+
createCrossTenantTransferService
```

Scope factory 必须显式注入：

```text
createScopeAssertion(transaction, isActive)
  -> createTransactionBoundInstitutionScopeAssertion(transaction, isActive)
```

不得修改 4-file foundation 来适配 runner。

## 6. Invocation contract

未来 CLI 只允许：

```text
pnpm exec tsx scripts/db/base02-b5-cross-tenant-transfer-runner.mjs   -- --manifest-file /absolute/private/path.json --dry-run
```

或在**另行取得数据库执行授权**后：

```text
pnpm exec tsx scripts/db/base02-b5-cross-tenant-transfer-runner.mjs   -- --manifest-file /absolute/private/path.json   --execution-lease-file /absolute/private/lease.json   --execute
```

规则：

- 默认模式不隐式 execute；
- `--dry-run` 与 `--execute` 互斥；
- execute 必须额外提供 `--execution-lease-file`；
- 未知参数、重复参数、相对路径全部 fail-closed；
- runner 不提供 API/HTTP entry；
- runner 不写 package.json script。

## 7. Private manifest contract

Manifest 必须在仓库外保存，禁止提交、禁止回显正文或 raw technical ids。

文件安全下限：

```text
regular_file=true
symlink=false
hardlink_count=1
owner=current_uid
mode=0400_or_0600
max_bytes=65536
absolute_path=true
O_NOFOLLOW=true
utf8_fatal=true
duplicate_json_key=false
```

Manifest v1 必须精确包含：

```text
version
task
authorityRef
expectedCodeSha
transferCommandId
accountId
sourceTenantId
sourceMembershipId
sourceExpectedMembershipRevision
sourceBindingId
sourceExpectedBindingVersion
targetTenantId
targetInstitutionId
targetMembershipId
targetBindingId
actorId
reasonCode
occurredAt
targetBindingExpiresAt
expectedJournalFingerprint
executionWindowNotAfter
```

其中 raw account/tenant/institution/membership/binding identifiers 均为 private technical values：

- 不写 repo；
- 不写 chat；
- 不写 stdout/stderr；
- 不写 PR body；
- 只在 private manifest 与进程内使用。

`authorityRef` 必须绑定已签发 BASE-B5 authority，不得由 repo demo seed 代替业务权威。

## 8. Execution lease contract

`--execute` 必须额外读取仓库外 secure lease。

Lease v1 至少精确包含：

```text
version
task
expectedCodeSha
authorityRef
manifestSha256
executionAuthorized
notBefore
notAfter
singleUseNonce
```

必须满足：

```text
executionAuthorized=true
manifestSha256 == canonical manifest sha256
expectedCodeSha == git HEAD
authorityRef == manifest.authorityRef
current_time within [notBefore, notAfter]
singleUseNonce canonical
```

Lease 只能在未来用户明确授权数据库 execution 后生成。

本 runner admission **不生成 lease，也不消费任何数据库执行授权**。

## 9. Localhost-only / local_acceptance-only gate

Runner 自身必须构造并使用固定 local acceptance endpoint，不信任 `.env.local`：

```text
postgresql://postgres:postgres@127.0.0.1:55432/zmtg_clean_local_acceptance
```

安全门：

1. 不读取 `.env.local`；
2. shell 中存在非 localhost `DATABASE_URL` -> fail-closed；
3. runner 实际 client 只使用内建 local acceptance URL；
4. `expectedCodeSha` 必须等于 clean worktree 的 `git rev-parse HEAD`；
5. worktree dirty -> fail-closed；
6. `git HEAD` 必须是未来已审查 runner implementation merge；
7. 数据库 identity/journal/schema fingerprint 必须匹配 private manifest 的 expected fingerprint；
8. 任一不匹配都不得进入 mutation。

Runner 不启动 Docker、不创建数据库、不 migrate、不 seed。

## 10. Dry-run protocol

`--dry-run` 允许连接 **localhost-only local_acceptance**，但只允许 read-only transaction / SELECT。

Dry-run 不调用 transfer mutation service。

它必须重新验证：

```text
source Membership = exactly 1 active complete
source Membership revision = expected
source active Binding = exactly 1
source Binding version = expected
source Binding account = expected account

target Membership = 0
target active Binding = 0
target Scope = exactly 1 active
same global account = true

command replay source tenant = 0
command replay target tenant = 0

concurrent writer = 0
prepared transaction = 0
journal/schema fingerprint = expected
```

输出只允许低敏结果：

```text
mode=dry-run
status=ready|blocked
prestate_match=true|false
journal_match=true|false
source_membership_count
source_active_binding_count
target_membership_count
target_active_binding_count
target_scope_count
source_command_replay_count
target_command_replay_count
conflict_count
unexpected_count
```

不得输出 raw ids、PII、credentials、private path、manifest digest 原值。

## 11. Execute protocol

未来只有在独立数据库 execution authorization + valid lease 后才能执行。

执行步骤固定：

```text
1. repeat full dry-run preflight
2. require exact ready state
3. create fresh DB client against fixed local_acceptance endpoint
4. compose transaction port + transaction-bound Scope factory
5. compose transfer service with manifest.transferCommandId
6. execute exactly once
7. never automatic retry
8. close client
9. run fresh read-only postcheck
10. emit low-sensitive result
```

禁止：

- second execute attempt；
- UPSERT；
- direct Membership/Binding SQL mutation in runner；
- FK VALIDATE；
- source fake Scope；
- old Binding tuple rewrite/delete/archive；
- migration/seed；
- API call；
- production connection。

## 12. Postcheck success model

执行成功后必须重新 SELECT 验证：

```text
source_membership_lifecycle=revoked
source_active_binding_count=0

target_membership_active_count=1
target_active_binding_count=1
target_scope_active_count=1

active_authorization_orphan_count=0
active_scope_relation_orphan_count=0

retained_revoked_historical_relation_orphan_count=1
historical_relation_classification=expected_retained_history

target_membership_evidence_count=1
target_binding_evidence_count=1
source_membership_evidence_count=1
source_binding_evidence_count=1

same_transfer_command_correlation=true
conflict_count=0
unexpected_count=0
```

物理 FK readiness **不因该成功模型自动成立**。Runner 禁止执行 FK VALIDATE。

## 13. Outcome-unknown protocol

若 service 返回：

```text
status=outcome_unknown
```

Runner 必须：

```text
automatic_retry=0
second_execute=0
```

然后只允许开启 fresh read-only verification，将现场分类为：

```text
committed
not_committed
indeterminate
```

若无法唯一分类：

```text
final_status=outcome_unknown_indeterminate
exit_nonzero=true
```

不得自动 restore/forward-fix。

## 14. Execution evidence / result log

Runner stdout 只输出一条 canonical low-sensitive JSON。

stderr 只输出一条 canonical low-sensitive error JSON。

推荐字段：

```text
task
mode
status
codeShaMatch
prestateMatch
poststateMatch
journalMatch
activeAuthorizationOrphanCount
activeScopeRelationOrphanCount
retainedHistoricalRelationOrphanCount
membershipEvidenceCount
bindingEvidenceCount
conflict
unexpected
outcomeClassification
```

外层 ChatGPT/VS Code shell 使用 `tee` 保存 result log。

Runner 自身：

- 不写 repo evidence 文件；
- 不写 private manifest 内容；
- 不写 raw IDs；
- 不写 secret；
- 不写 private path。

## 15. Test matrix

Runner tests 必须至少覆盖：

1. CLI strict parsing；
2. dry-run default/explicit mode；
3. execute requires lease；
4. manifest regular-file/mode/owner/nlink/no-symlink/O_NOFOLLOW；
5. manifest size/UTF-8/duplicate keys；
6. lease secure-file checks；
7. manifest/lease canonical SHA binding；
8. code SHA mismatch；
9. dirty worktree；
10. non-local shell DATABASE_URL；
11. fixed local_acceptance endpoint only；
12. dry-run uses SELECT/read-only only；
13. prestate exact ready；
14. source revision/version mismatch；
15. target Membership/Binding conflict；
16. target Scope missing/inactive；
17. command replay；
18. journal/schema fingerprint mismatch；
19. execute calls transfer service exactly once；
20. no direct Membership/Binding mutation SQL in runner；
21. postcheck accepted Option 1 metrics；
22. outcome_unknown no retry；
23. outcome verification committed/not_committed/indeterminate；
24. stdout/stderr low-sensitive field whitelist；
25. raw technical IDs never emitted；
26. client close on all terminal paths。

## 16. 当前准入结论

```text
controlled_execution_runner_admission_passed=true
controlled_execution_runner_exact_allowlist_frozen=true
controlled_execution_runner_exact_file_count=2

runner_type=one_shot_cli
long_lived_api=false
package_json_change_required=false
schema_change_required=false
migration_required=false
existing_transfer_foundation_change_required=false

runner_implementation_authorized=false
database_execution_authorized=false
historical_orphan_remediation_authorized=false

database_connection=false
ddl_execution=false
dml_execution=false
migration_execution=false
membership_database_write_execution=false
binding_database_write_execution=false

base_b5_execution_ready=false
base_b5_complete=false
base02_complete=false
reader_release=false
capability_release=false
```

## 17. 唯一下一任务

```text
BASE-B5 跨 tenant transfer controlled execution runner 2-file 最小实现授权与执行
```

该下一任务只授权代码实现时，仍不得连接数据库或执行 remediation。
