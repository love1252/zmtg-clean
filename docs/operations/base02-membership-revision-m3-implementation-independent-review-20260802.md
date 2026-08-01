# BASE-02 Membership Revision M3 实施独立审查

> 状态：`current independent review evidence`
>
> 审查日期与时区：2026-08-02，Asia/Shanghai
>
> 审查基线：`f8909e098def3810e0e336c9491facf83d4c3a57`
>
> 被审查实施：PR #880、PR #881

## 1. 审查定位

本审查独立核对 Membership Revision M3 是否完成两个原子回退域：正式 onboarding 在既有单一
外层事务内委托 Access Control 唯一 Membership Owner command，以及 trial reset、核心 Demo Seed、
低敏 Demo Seed 与 CLI 等旧 Writer／Deleter 固定 fail-closed；同时核验
`AQ008_MEMBERSHIP_DIRECT_WRITER` 是否把 Owner 外 direct Membership mutation 收敛为零。

审查只读取已合并实现、测试、架构规则、Git／GitHub 交付证据和已接受 A-full／P01～P12 决策。
本审查不修改被审查 Runtime，不连接数据库，不执行 DDL、DML、Migration、Seed，不签发 Lease，
不校准 legacy Membership，也不启动 M4～M7、BASE-B1～B6 或项目级 Writer／Reader。

## 2. 冻结交付证据

### 2.1 M3-A：正式 onboarding 委托

- PR：#880；
- Base：`5b8afc3d48932872714afc736f9c4f02f1fec675`；
- Head：`c690789f341434fd7bb33e819151849e6c2a7afa`；
- Required Check：Run `30711226980`／Job `91398940037`，成功；
- Merge Commit：`2d34177f0d2eb77ccaba0829ab3224e69911853f`；
- 范围：1 个提交、9 个文件。

M3-A 精确修改：

1. `src/app/api/v1/open-platform/tenants/_membership-command-composition.ts`；
2. `src/app/api/v1/open-platform/tenants/route.ts`；
3. `src/modules/access-control/server/membership-command-external-transaction.ts`；
4. `src/modules/access-control/tests/MembershipCommandExternalTransaction.test.ts`；
5. `src/modules/open-platform/server/tenant-plan-binding-repository.ts`；
6. `src/modules/open-platform/server/tenant-plan-binding-service.ts`；
7. `src/modules/open-platform/tests/TenantPlanBindingApiRoute.test.ts`；
8. `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`；
9. `src/modules/open-platform/tests/TenantPlanBindingService.test.ts`。

### 2.2 M3-B：旧 Writer／Deleter 封堵与架构门禁

- PR：#881；
- Base：`2d34177f0d2eb77ccaba0829ab3224e69911853f`；
- Head：`b405403d6fea87e1d022d7e027e22d9f8600ae61`；
- Required Check：Run `30714150218`／Job `91406737286`，成功；
- Merge Commit：`f8909e098def3810e0e336c9491facf83d4c3a57`；
- 范围：1 个提交、11 个文件。

M3-B 精确修改：

1. `scripts/demo/seed-v06-low-sensitive-demo.test.ts`；
2. `scripts/demo/seed-v06-low-sensitive-demo.ts`；
3. `scripts/verify/architecture-quality.mjs`；
4. `scripts/verify/architecture-quality.test.mjs`；
5. `src/app/api/v1/open-platform/trial-data-reset/route.ts`；
6. `src/modules/open-platform/server/trial-data-reset-service.ts`；
7. `src/modules/open-platform/tests/TrialDataResetService.test.ts`；
8. `src/server/db/seed-demo-data.ts`；
9. `src/server/db/tests/ProductionReadinessDocs.test.ts`；
10. `src/server/db/tests/Schema.test.ts`；
11. `src/server/db/tests/SeedGuard.test.ts`。

两个 Merge Commit 均具有对应 Base 与冻结 Head 两个父提交，Merge tree 与各自 Head tree 精确一致。
本地 `main` 与 `origin/main` 已同步到 M3-B Merge Commit，两个已合并工作分支均已清理，全部
`backup/*` 保留。

## 3. M3-A onboarding Owner 委托

独立审查确认正式 onboarding 不再直接写入 `tenant_members`：

- `createTenantWithPlanAuthorization` 继续编排租户、计划与 Membership 的一个外层事务；
- Access Control external-transaction Adapter 是调用方既有事务接入 Owner command 的唯一品牌转换点；
- app-level 组合根只注入 Adapter，`open-platform/server` 没有直接依赖 `access-control/server`，
  也没有新增 AQ007 例外；
- Access Control Adapter 不另开事务，onboarding 的 transaction begin／commit 保持精确 `1／1`；
- serializable／read-write 与 statement／lock／idle-in-transaction timeout 在首个 DML 前生效；
- 调用方只提交业务意图和必要上下文，不构造 revision、lifecycle envelope、current provenance、
  transition identity 或 transition evidence；
- Owner command 必须返回 `applied`；CAS、evidence 或任一开通步骤失败时，租户、计划、
  Membership、Binding 与 transition evidence 随同一外层事务全部回滚；
- M2 的 `expectedRevision`、重放拒绝、affected rows 精确为 1、Binding 独立版本域与低敏错误契约
  未被弱化。

因此，启动基线中的唯一正式 onboarding direct INSERT 已迁移至 Access Control 唯一 Owner 边界，
没有形成第二套 Membership current 或跨事务补偿。

## 4. M3-B 旧 Writer／Deleter 封堵

启动基线包含 5 个必须禁用的旧 mutation 符号；审查结果如下：

| 入口／符号 | 最终行为 | client／database 前置边界 |
|---|---|---|
| `resetTrialData` | 固定 `capability_disabled` | 即使直接传入 database 也不读取、不写入 |
| trial reset `POST` Route | 固定低敏 503 | 在读取 body 和 `getDatabase()` 前拒绝；认证／范围失败仍为 401／403 |
| `seedDemoData`／旧清理链 | 固定 fail-closed；旧 Membership DML 已物理移除 | 不使用传入 database，不开启 transaction |
| `runSeed` | 固定 fail-closed | 在创建 client 前拒绝 |
| `applyDemoSeed`／`cleanupDemoSeed` | 固定 fail-closed；纯计划能力保留 | 不使用传入 client，不开启 transaction |
| 低敏 CLI apply／cleanup | 固定 fail-closed；显式 dry-run 保持只读 | 在创建 client 前拒绝 |

没有把旧实现改名迁移到 helper、raw SQL、动态表名或范围外脚本；Demo／Mock Membership Writer
没有恢复。Seed fixture 与纯解析／帮助／显式 dry-run 只保留非写能力，不能建立数据库连接或执行
Membership mutation。

## 5. AQ008 与归零证明

`AQ008_MEMBERSHIP_DIRECT_WRITER` 的内建 allowlist 精确为一个文件：

`src/modules/access-control/server/membership-command-repository.ts`

`scripts/verify/architecture-quality-rules.json` 的 exceptions 保持为空。规则覆盖：

- Drizzle `insert`／`update`／`delete(tenantMembers)` 与 named、namespace、assignment、local alias；
- raw SQL 的 INSERT／UPDATE／DELETE／TRUNCATE、schema-qualified 名称、动态目标列表与
  `sql.identifier` 数组；
- 本地或导入 mutation helper、对象／类方法、default export、barrel re-export 与反向 caller；
- SQL executor／tag／const 别名、词法遮蔽与 changed generic sink；
- Reader、测试、注释、普通字符串、非 SQL tag、CSS／JSON import 与相邻表的负例；
- allowlist 文件复制或重命名后不继承豁免，rules 配置例外不能绕过内建边界。

对抗自测和 Head 增量检查均通过，证明当前冻结范围内：

- Owner 外 direct Membership mutation 文件数：`0`；
- Owner 外 direct Membership mutation 符号数：`0`；
- 唯一 Owner allowlist 文件数：`1`；
- 启动基线 4 个文件／6 个符号已完成 1 个委托、5 个封堵。

“Owner 外为零”不等于全仓没有 Membership DML；唯一允许的写入仍由 Access Control Owner
Repository 承担，并继续受 M2 CAS、事务和 transition evidence 约束。

## 6. 质量门禁

| 门禁 | M3-A | M3-B |
|---|---|---|
| 定向测试 | 32／32 | 123／123 |
| 架构检查器自测 | 67／67 | 125／125 |
| 增量架构检查 | 通过 | 通过 |
| lint | 0 error；4 条既有图片 warning | 0 error；4 条既有图片 warning |
| typecheck | 通过 | 通过 |
| 完整测试 | 426 文件／6248 项 | 426 文件／6253 项 |
| build | 101／101 | 101／101 |
| `git diff --check` | 通过 | 通过 |
| Required Check | Run `30711226980`／Job `91398940037`，成功 | Run `30714150218`／Job `91406737286`，成功 |

两个真实 GitHub Actions 均实际执行环境核对、依赖安装、架构检查器自测、增量架构检查、lint、
typecheck、完整测试和 build；build 未跳过。

## 7. 未执行范围与持续阻断

M3 没有连接数据库，Schema、Migration、journal、snapshot、package、lock 与 CI Workflow 修改均为
`0`。没有执行 Migration、Seed、DDL、DML、legacy calibration、orphan 修复或 FK `VALIDATE`。

以下事实继承自 M2 handoff，M3 未连接数据库、未进行新的环境探针，且未改变这些状态：

- legacy Membership current envelope／transition evidence 的环境计数仍为 `0／0`；
- M4 deterministic legacy calibration 尚未启动；
- M5 高水位追赶与冲突清零、M6 Reader 切换、M7 Enforce 均未启动；
- `updated_at` compatibility fallback 继续保留至 M6，不得在 M3 结论中写成 Reader 已切换；
- active historical orphan／Scope relation orphan 仍为 `1／1`；
- A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`；
- BASE-B1～B6、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 均未启动；
- 正式平台服务端授权根仍为独立缺口，七线正式发布仍为 `0/7`。

M3 合并后不得恢复 trial reset／Seed／CLI direct Writer。后续若发现事务、Owner 边界或 AQ008
缺陷，只能以独立 forward-fix 强化 Owner 委托、fail-closed 或架构规则，不能重新开放旧路径。

## 8. 独立审查结论

```text
base02_membership_revision_m3_implementation_review=passed
m3_onboarding_delegated=true
m3_single_outer_transaction_verified=true
m3_legacy_writer_deleter_blocked=true
m3_owner_outside_direct_writer_files=0
m3_owner_outside_direct_writer_symbols=0
m3_owner_allowlist_files=1
m3_aq008_membership_direct_writer_passed=true
m3_required_checks_passed=true
m3_database_execution=false
schema_or_migration_changed=false
legacy_calibration_executed=false
runtime_reader_changed=false
historical_orphan_modified=false
a2_p2_scope_fk_validated=false
eligible_for_m3_handoff=true
eligible_for_m4=false
eligible_for_base_b1=false
```

PR #880 与 PR #881 的实现、测试、Git／GitHub 证据与已接受 A-full／P01～P12 一致，能够证明
M3 已完成正式 onboarding Owner 委托、5 个旧 Writer／Deleter 封堵，以及 Owner 外 direct
Membership mutation `0／0` 与唯一 allowlist `1` 的静态门禁。

该结论只准入独立 M3 handoff。M4 必须由 handoff 冻结 deterministic legacy calibration 的唯一
下一任务、实时 Migration 编号、唯一 Lease、恢复点、稳定排序、计数和受控执行边界；本审查本身
不启动 M4，也不授权 BASE-B1、Reader、orphan 修复、FK `VALIDATE` 或项目级后续任务。
