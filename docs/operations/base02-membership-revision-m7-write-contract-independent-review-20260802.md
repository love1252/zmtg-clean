# BASE-02 Membership Revision M7 写入契约独立审查

## 1. 文档定位

- 审查日期：2026-08-02。
- 审查对象：PR #902。
- 实施 Base：`22a1e6cdba2b81fb8aa743c253cec1e66a28136b`。
- 冻结实施 Head：`0b09b329012100386b8bc7638eaf818fb89cf8c6`。
- 实施 Merge Commit：`24aba48ced5eb1c0588de88b45757958222cc010`。
- 实施 Required Check：Run `30737402318`／Job `91468617520`，结论为成功。
- 审查范围：M7 Schema／Migration 前的 Membership 完整 current 写入类型边界。
- 本文只记录仓库静态独立审查，不是 M7 Schema、Migration、数据库执行、BASE-B1 或发布授权。

## 2. 精确文件范围

PR #902 保持单提交、8 个文件：

### 2.1 生产与静态预览文件（5）

1. `src/modules/access-control/application/membership-command-service.ts`
2. `src/modules/access-control/domain/membership-lifecycle.ts`
3. `src/modules/access-control/ports/membership-command-unit-of-work.ts`
4. `src/modules/access-control/server/membership-command-repository.ts`
5. `src/server/db/seed-demo-data.ts`

### 2.2 测试文件（3）

1. `src/modules/access-control/tests/MembershipCommandRepository.test.ts`
2. `src/modules/access-control/tests/MembershipLifecycle.test.ts`
3. `src/server/db/tests/Schema.test.ts`

实施 diff 中 `drizzle/**`、`src/server/db/schema.ts`、journal、snapshot、数据库、CI、package 与 lock 修改均为 0。

## 3. current 类型边界复核

审查确认：

- `MembershipCurrent` 继续表示数据库读取／解析边界的 nullable candidate，未把历史 all-null 或 partial 行伪装成完整事实；
- `CompleteMembershipCurrent` 仅把六个无条件字段收紧为非空：`revision`、`lifecycleStatus`、`provenanceSource`、`provenanceReasonCode`、`provenanceCommandId`、`provenanceRecordedAt`；
- `actorId`、`provenanceOccurredAt`、`revokedAt`、`deletedAt` 继续按 lifecycle 状态条件可空；
- lifecycle `apply`／`observed`、写入 Port、Application Service 与 Repository 的 insert／CAS update 只接收完整 current；
- 生产链路已移除相关 revision／lifecycle 强转、current 非空断言与 nullable `recordedAt` 写入分支；
- 完整类型只能由 lifecycle 决策或显式完整性守卫形成，未发现默认值、cast 或非空断言绕过。

该边界兼容后续仅将六个 Schema 字段收紧为 `NOT NULL`，同时保留数据库收紧前对历史形状的防御性读取。

## 4. fail-closed、CAS 与 Owner 不变量

- legacy all-null 的非 create 命令继续返回 `legacy_membership_not_calibrated`；
- partial envelope 继续返回 `membership_current_envelope_invalid`；
- create 遇既有 Membership 不会形成新 incarnation；
- M4 已校准的 complete current 仍可进入正式命令并严格推进 revision；
- M2 的 `expectedRevision` CAS、同一旧 revision 最多一个成功、affected rows 精确为 1、无自动重试、current／Binding／transition evidence 同事务原子性未变化；
- Membership 与 Binding 版本域继续独立；Tenancy Scope revision 未被当作 Membership revision；
- M3 的唯一 Owner Writer／Deleter 与 AQ008 内建 allowlist 未扩大；
- M6 的正式 Session／Guard 权威读取顺序、non-active／stale／unavailable fail-closed 与时间戳回退 0／0 未变化。

已禁用 demo seed Membership 内容只解除对 Drizzle insert type 的静态耦合，继续保持五字段只读 preview；没有补造 revision／provenance 事实，也没有 `tenant_members` DML。

## 5. M7 后续边界

本审查只证明 Runtime 写入类型已准备好承接后续 Schema 收紧。后续 M7 仍必须独立满足：

1. 实时唯一 Migration 编号与不可续期 Lease；
2. 精确四文件范围：SQL、journal、`schema.ts`、`Schema.test.ts`；
3. Catalog 合法入口仅为 M1 predecessor 或全量精确终态，部分对象或异定义 fail-closed；
4. 仅六列 `SET NOT NULL` 与同名 current CHECK 收紧，transition DDL 为 0；
5. snapshot、`db:generate`、DML、回填、FK VALIDATE、historical orphan 处理均为 0；
6. local_acceptance 执行必须使用全新恢复点、隔离恢复验证、全新 Lease 和一次 guarded Migration，自动重试为 0。

因此，PR #902 合并不等于 M7 Migration 已实施或数据库执行已授权完成。

## 6. 验证证据

- 目标定向测试：111／111 通过。
- M6 回归矩阵：22 文件、683／683 通过。
- `pnpm check:architecture:test`：125／125 通过。
- Base→Head 增量架构检查：通过。
- `pnpm lint`：通过，仅有 4 条既有 warning。
- `pnpm typecheck`：通过。
- 完整测试：430 文件、6344／6344 通过。
- build：101／101，实际执行且未跳过。
- `git diff --check`：通过。
- 未来六列 `.notNull()` 的隔离编译实验：`typecheck` 通过，临时副本已删除。
- PR #902 的真实 Required Check 对应冻结 Head，完整测试和 build 均实际成功；PR 已使用 Merge Commit 合并。

## 7. 独立结论

未发现 nullable current 进入正式 Writer、类型断言掩盖非法 Shape、第二套 Membership current、Owner 越界、CAS／原子性弱化或范围外数据库实现。M7 Runtime 写入契约前置条件已经满足，但 M7 Schema／Migration 和数据库执行仍须在独立回滚域完成。

```text
m7_write_contract_review=passed
nullable_read_boundary_preserved=true
complete_writer_boundary=true
legacy_partial_fail_closed=true
schema_migration_change_count=0
database_change_count=0
eligible_for_m7_schema_migration=true
eligible_for_m7_database_execution=false
eligible_for_base_b1=false
```
