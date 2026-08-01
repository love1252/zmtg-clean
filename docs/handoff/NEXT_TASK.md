# 智美天工唯一下一任务

## 当前交接状态

BASE-02 Membership Revision 的 M2 Access Control Owner Writer／CAS 已完成实现与独立审查：

- PR #877：M2 实施，Head `828ebb69e62267a67dff2d8cc21d7ddafb1d454b`，Run `30708477043`／Job `91391614603`，Merge Commit `e6add6403a7a502192c450615397304a74c4b8e7`；
- PR #878：M2 实施独立审查，Head `ac76fe06ad5700d52e86f7c3622a2db65bbd441c`，Run `30708982932`／Job `91392949050`，Merge Commit `287b1d7cf66550424e304c6cc1354df334bb1e56`；
- `tenant_members` 继续是 Access Control 唯一 canonical Membership current，`tenant_membership_transitions` 只保存 immutable transition evidence；
- create／refresh／revoke／reactivate／delete 五类 Owner command、expected-absence／`expectedRevision` CAS、transaction-bound UoW、必要 Binding version CAS 与 transition evidence 同事务边界已经建立；
- 定向测试 3 文件／41 项、架构自测 67／67、完整测试 425 文件／6235 项、build 101／101 均通过；
- `base02_membership_revision_m2_implementation_review=passed`；
- M2 未连接数据库，Schema、Migration、journal、snapshot、scripts、CI、package 和 lock 修改均为 `0`。

M2 没有迁移或封堵 Owner 外旧 Writer／Deleter。当前静态影响面仍为 `4 个文件／6 个符号`：

| 分类 | 符号 | 当前动作 |
|---|---|---|
| 正式 onboarding | `createTenantWithPlanAuthorization` | 必须迁移为在既有外层事务内委托 M2 Owner command |
| trial reset | `resetTrialData` | Service 不得使用传入 database；POST Route 必须在 `getDatabase()` 前 fail-closed |
| 主 Seed 清理 | `cleanupLegacyDemoSeedRecords` | 必须删除旧 Membership DML；调用链不得使用已传入 database |
| 主 Seed 写入 | `seedDemoData` | 必须在 transaction／DML 前拒绝；`runSeed` 必须在创建 client 前拒绝 |
| 低敏 Seed 写入 | `applyDemoSeed` | 必须在 transaction／DML 前拒绝；CLI apply 必须在创建 client 前拒绝 |
| 低敏 Seed 清理 | `cleanupDemoSeed` | 必须在 transaction／DML 前拒绝；CLI cleanup 必须在创建 client 前拒绝 |

以上计数是 M3 的启动基线，不得在完成代码与架构门禁前写成已经归零。

## 唯一下一任务

```text
BASE-02 Membership Revision M3 onboarding 委托、旧 Writer／Deleter 封堵
```

仓库当前没有该任务的正式 `V2-*` 编号，本 handoff 不自行创造编号。

当前状态：**尚未启动；已由当前 ULTRA 用户指令授权在本 handoff 合并后启动**。

M3 只完成两件事：

1. 将唯一正式 onboarding Membership INSERT 委托给 M2 transaction-bound Access Control Owner command，并保留租户开通既有单一外层事务；
2. 封堵 reset／Seed／CLI 的 5 个旧 Membership mutation 符号：可控 Route／CLI 入口必须在取得 client 前拒绝；接收既有 database／client 的内部函数必须不使用它，并在 transaction／DML 前拒绝；同时新增架构质量规则证明 Owner 外 direct Membership mutation 精确为 `0`。

M3 不执行 legacy calibration、Reader 切换、Schema、Migration、数据库、orphan 修复、A2-P2 FK `VALIDATE` 或 BASE-B1。

## 一、不得重开的 accepted 约束

1. `tenant_members` 是 Access Control 唯一 canonical Membership current；`tenant_membership_transitions` 只保存 immutable transition evidence。
2. Access Control 唯一拥有 Membership 与 Binding 生命周期；Identity、Tenancy、Security 的既有 Owner 边界不重开。
3. Membership revision、Binding version 与 Scope revision 是三个独立版本域，互不替代。
4. create／refresh／revoke／reactivate／delete 只能通过 M2 Owner command 修改 Membership。
5. M3 调用方只能提交业务意图和必要上下文，不得自行构造 revision、current provenance、transition identity 或 transition evidence。
6. onboarding 必须复用既有外层事务；M3 不允许在 Access Control 内开启嵌套事务或跨事务补偿。
7. current、必要 Binding 与 transition evidence 任一步骤失败时，租户开通全事务必须回滚。
8. legacy all-null Membership 在 M4 前继续 fail-closed；M3 不校准历史行。
9. 旧 reset／Seed／CLI 路径不得通过默认 dry-run、路由 Guard 或未调用分支虚报封堵；可控入口必须在取得 client 前拒绝，接收既有 client 的内部函数必须证明未使用该 client 且在 transaction／DML 前拒绝。
10. 本轮唯一 Membership DML allowlist 只能是 `src/modules/access-control/server/membership-command-repository.ts`，exceptions 必须保持空。

## 二、M3 原子实施队列

### M3-A：正式 onboarding 委托

候选文件范围：

1. `src/modules/access-control/server/membership-command-external-transaction.ts`（新增，仅承载调用方既有事务适配）；
2. `src/modules/access-control/tests/MembershipCommandExternalTransaction.test.ts`（新增）；
3. `src/app/api/v1/open-platform/tenants/_membership-command-composition.ts`（新增，app-level 组合根）；
4. `src/app/api/v1/open-platform/tenants/route.ts`；
5. `src/modules/open-platform/server/tenant-plan-binding-service.ts`；
6. `src/modules/open-platform/server/tenant-plan-binding-repository.ts`；
7. `src/modules/open-platform/tests/TenantPlanBindingApiRoute.test.ts`；
8. `src/modules/open-platform/tests/TenantPlanBindingService.test.ts`；
9. `src/modules/open-platform/tests/TenantPlanBindingRepository.test.ts`。

以上为 5 个核心 Runtime 文件与 4 个紧密对应测试文件，构成不可拆开的外层事务接线回退域；其他文件不得因便利扩大。

固定实现边界：

- M2 自有事务的既有品牌转换继续保留在 `membership-command-repository.ts`；新增 Access Control external-transaction Adapter 是 M3 调用方既有事务接入的唯一新增品牌转换点；
- app-level 组合根只负责把 Access Control external-transaction Adapter 注入 open-platform Repository；`open-platform/server` 不得直接导入 `access-control/server`，不得增加 AQ007 例外；
- 普通调用方不得使用类型断言伪造 transaction-bound UoW，品牌类型不得跨出 Access Control server Adapter；
- `createTenantWithPlanAuthorization` 继续拥有租户、订阅与 Access Control 命令的单一外层事务编排，但不再直接 INSERT `tenant_members`；
- 该单一外层事务必须为 serializable／read-write，并在首个 DML 前设置 M2 已冻结的 statement／lock／idle-in-transaction timeout；Access Control Adapter 不得另开事务；
- Membership create 必须调用 M2 Owner command，结果必须为 `applied`；任何低敏错误、CAS 失败或 evidence 失败都回滚整个开通事务；
- 调用方不得传入 revision／lifecycle envelope／provenance／transition evidence；
- 不修改外部 Route、响应契约、认证政策或公开 URL。

完成门禁：

- onboarding 唯一 direct INSERT 从 Owner 外移除；
- 事务 begin／commit 仍精确为 `1／1`，不得出现嵌套事务；
- serializable／read-write 与三项 M2 timeout 在首个 DML 前生效；
- 失败场景 commit 为 `0`，租户、计划、Membership、Binding 与 transition evidence 均无部分成功；
- M3 新增的外部事务品牌转换只存在于 Access Control external-transaction Adapter；app-level 组合根和 open-platform 调用方均不得持有品牌类型；
- M3-A 增量架构检查不得出现 `AQ007_CROSS_MODULE_SERVER_REPOSITORY`，`architecture-quality-rules.json` exceptions 继续为空；
- M2 timeout、CAS、重放与 affected rows 精确为 1 的契约不被弱化。

### M3-B：旧 Writer／Deleter 封堵与架构门禁

候选文件范围：

1. `src/modules/open-platform/server/trial-data-reset-service.ts`；
2. `src/modules/open-platform/tests/TrialDataResetService.test.ts`；
3. `src/app/api/v1/open-platform/trial-data-reset/route.ts`；
4. `src/modules/open-platform/tests/TrialDataResetApiRoute.test.ts`（新增）；
5. `src/server/db/seed-demo-data.ts`；
6. `src/server/db/tests/SeedGuard.test.ts`；
7. `src/server/db/tests/Schema.test.ts`；
8. `scripts/demo/seed-v06-low-sensitive-demo.ts`；
9. `scripts/demo/seed-v06-low-sensitive-demo.test.ts`；
10. `scripts/verify/architecture-quality.mjs`；
11. `scripts/verify/architecture-quality.test.mjs`。

`src/server/db/tests/ProductionReadinessDocs.test.ts` 仅在现有静态契约必须同步时才可纳入；架构规则配置 `scripts/verify/architecture-quality-rules.json` 的 exceptions 必须保持空，不得为旧 Writer 增加例外。

固定封堵边界：

- trial reset POST Route 必须在 `getDatabase()` 前返回固定低敏关闭结果；`resetTrialData` 即使被直接传入 database 也不得读取或写入该对象；
- `runSeed` 与低敏 CLI 的 apply／cleanup 入口必须在创建 client 前拒绝；`seedDemoData`、`applyDemoSeed`、`cleanupDemoSeed` 即使被直接传入 database／client 也必须不使用它，并在 transaction／DML 前拒绝；
- `cleanupLegacyDemoSeedRecords` 的旧 Membership DML 必须移除，且不得通过改名、helper 或 raw SQL 保留；
- 低敏 CLI 的纯解析、帮助或显式 dry-run 可以保留，但不得建立数据库连接或执行 Membership mutation；
- 不把旧实现迁移到新 helper、raw SQL、动态表名或范围外脚本；
- 不恢复 Demo／Mock Membership Writer，不创建第二套事实源。

新增架构规则：

```text
AQ008_MEMBERSHIP_DIRECT_WRITER
```

规则必须：

- 识别 Drizzle `insert`／`update`／`delete(tenantMembers)`；
- 识别 `tenantMembers` 别名导入；
- 识别 raw SQL 对 `tenant_members` 的 INSERT／UPDATE／DELETE／TRUNCATE；
- 识别 mutation helper 中的 `tenant_members` 表名字面量；
- 只允许 `src/modules/access-control/server/membership-command-repository.ts`；
- 覆盖违规路径、唯一 allowlist、别名、raw SQL、helper、字符串／注释误报和未来新增文件；
- 不增加 exceptions，不把测试文件或文档内容误报为生产 DML。

## 三、验证要求

每个原子 PR 必须执行与通过：

- 相关定向测试；
- `git diff --check`；
- 架构检查器自测；
- Base／Head 增量架构检查；
- `pnpm lint`；
- `pnpm typecheck`；
- 完整 `pnpm test`；
- `pnpm build`；
- 新 Head 的真实 Required Check，完整测试和 build 不得跳过。

M3 总体验收必须同时成立：

1. Owner 外 direct Membership mutation 文件数为 `0`；
2. Owner 外 direct Membership mutation 符号数为 `0`；
3. 唯一 allowlist 文件数为 `1`；
4. `AQ008_MEMBERSHIP_DIRECT_WRITER` 自测与仓库增量检查通过；
5. onboarding 仍为一个外层事务，失败时无部分状态；
6. 5 个旧 Writer／Deleter 均无 direct Membership DML；可控 Route／CLI 入口在取得 client 前拒绝，接收既有 client 的内部函数证明未使用它并在 transaction／DML 前拒绝；
7. Schema、Migration、journal、snapshot 和数据库修改均为 `0`；
8. M4、M5、M6、M7、BASE-B1～B6 与项目级 Writer 均未启动。

## 四、回退与 forward-fix

- M3-A 未合并前可回退该原子 PR；合并后若发现事务或 Owner 边界缺陷，必须用独立 forward-fix PR 修复，不得恢复 direct Membership INSERT。
- M3-B 未合并前可回退该原子 PR；合并后不得重新启用旧 reset／Seed／CLI Writer，必要修复只能强化 fail-closed 或架构规则。
- 任一 PR 失败不得通过放宽 CAS、重放、事务、allowlist、Seed Guard 或 Required Check 获取绿灯。
- M3 不涉及数据库数据回退、Migration rollback、orphan 处理或 FK 状态变化。

## 五、持续阻断

- M4 deterministic legacy calibration：未启动；完整 current envelope／transition evidence 的既有环境计数仍为 `0／0`；
- M5 高水位追赶与冲突清零：未启动；
- M6 Reader 切换：未启动，`updated_at` compatibility fallback 继续保留至 M6；
- M7 Enforce：未启动；
- BASE-B1 Runtime：继续 `blocked`，必须等待 M7；
- BASE-B2～B6：均未启动；
- active historical orphan／Scope relation orphan：保持 `1／1`，未授权修复；
- A2-P2 Scope FK：继续 `NOT VALID`／`convalidated=false`；
- 项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与业务 Reader：继续阻断；
- 正式平台服务端授权根仍为独立缺口，七线正式发布仍为 `0/7`。

## 六、当前禁止范围

- 修改 `drizzle/**`、Schema、Migration、journal、snapshot、数据库、Lease 或运行 `db:generate`；
- 执行 DDL、DML、Migration、Seed、回填、校准、orphan 修复或 FK `VALIDATE`；
- 启动 M4～M7、BASE-B1～B6、项目级 Writer、Audit／模板、MIG-01B／C 或业务 Reader；
- 修改 M1 已消费 `0040`；
- 创建第二套 Membership current、绕过 Access Control Owner command 或使用 `updated_at`／Binding version 替代 Membership revision；
- 通过直接 push main、`--admin`、Auto-merge、Squash 或 Rebase Merge 绕过治理；
- 输出凭证、连接参数、真实双键、自由文本 reason 或 PII。

## 七、停止条件

出现以下任一情况必须停止：

- 无法保留 onboarding 单一外层事务；
- open-platform server 直接依赖 Access Control server、需要 AQ007 例外，或 app-level 组合根无法维持模块边界；
- M3 新增的外部事务品牌转换泄漏到 Access Control external-transaction Adapter 之外；
- 调用方仍可构造 revision、current provenance 或 transition evidence；
- Owner 外 direct mutation 或架构 allowlist 不能达到 `0／1`；
- 可控 Route／CLI 入口只能在取得 client 后拒绝，或接收既有 client 的内部函数在拒绝前使用 client、开启 transaction 或执行 DML；
- 需要 Schema、Migration、数据库、Lease、M4、Reader、orphan 或 FK `VALIDATE`；
- 必须重新开放旧 Writer、扩大事实 Owner 或建立第二套 Membership current；
- current、accepted target、基线、文件范围、工作树或并发 Agent 出现无法解释的漂移；
- 出现 Secret、Token、密码、私钥、PII 或非本地敏感连接信息泄漏。

## 八、交付判定

```text
next_task=BASE-02 Membership Revision M3 onboarding 委托、旧 Writer／Deleter 封堵
next_task_started=false
next_task_authorized_under_ultra=true
m0_complete=true
m1_complete=true
m2_owner_writer_implemented=true
m2_transactional_cas_verified=true
m2_implementation_review=passed
m2_complete=true
m3_direct_writer_files_before=4
m3_direct_writer_symbols_before=6
m3_direct_writer_to_migrate_before=1
m3_direct_writer_to_disable_before=5
m3_owner_outside_writer_target=0
m3_owner_allowlist_target=1
m3_database_access_allowed=false
m3_schema_migration_allowed=false
m4_started=false
m5_started=false
m6_started=false
m7_started=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
orphan_remediation_authorized=false
a2_p2_scope_fk_validated=false
project_writer_started=false
reader_started=false
eligible_for_reader=false
```
