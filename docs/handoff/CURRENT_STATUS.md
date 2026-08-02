# 智美天工当前项目状态

<!-- ARCHITECTURE_V2_PHASE1_START -->

## BASE-02 Membership Revision M5 高水位追赶与冲突清零完成状态

- 更新日期：2026-08-02
- 本轮 handoff 基线：`ea4a59df15fa14e64d7b7c5ad8a18b80452cc0c0`
- 当前任务：`BASE-02 ULTRA：Membership Revision M0～M7、BASE-B1～B6 全链实施与最终收口`
- 当前切片：M5 实施、实施独立审查、一次受控 Migration、执行证据、执行独立审查与 handoff
- 正式任务编号：无；本轮未新增 `V2-*` 编号
- M5 实施：PR #893，Head `43440e3f38c3c6ba3576dba1788b3fad586cfb5a`，Run `30727616873`／Job `91442118293`，Merge Commit `72c7568df3fd1078b813733eda472c01b0f8672d`
- M5 实施独立审查：PR #894，Head `14c7e6e4419203dacd5d20b3bec2b3d8bc43c285`，Run `30728269902`／Job `91443866416`，Merge Commit `33c52ee41e20385e8541594fa92b4c5c6ce21cf9`
- M5 执行证据：PR #895，Head `53e7f1c0ad257fdff935d3ce1234be0054a19b34`，Run `30729433131`／Job `91446923309`，Merge Commit `804444789d135903a737bc0721c452bcc74511b5`
- M5 执行独立审查：PR #896，Head `a768ddac965d42c96e59f2a2881a66961d9f3cf7`，Run `30729838933`／Job `91448020103`，Merge Commit `ea4a59df15fa14e64d7b7c5ad8a18b80452cc0c0`
- 四个 PR 的环境核对、依赖安装、架构自测、增量检查、lint、typecheck、完整测试与 build 均实际执行并成功
- 本次 handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package、lock 修改均为 `0`

### M5 current 终态

- 实时 Migration 编号为 `0042`；仓库／固定 localhost-only local_acceptance 环境 journal 均为 `43／0042`，snapshot 保持 `0026`
- `0042` 的唯一目标 guarded Migration 调用为 `1`，直接 SQL 与第二次目标调用为 `0`，自动重试为 `0`，执行结果已知
- 执行前合法 all-null residual 为 `0`；零候选结果 `planned／created／reused／conflict／unexpected=0／0／0／0／0`，且 `planned=created+reused`
- Membership total／all-null／partial／complete 保持 `1／0／0／1`；transition／exact current-head／M4 baseline 保持 `1／1／1`
- duplicate command／revision、identity mismatch 与 tenant／user parent 缺失均保持 `0`
- Membership identity、tenant／user 归属、role、display_name、created_at 与 updated_at 稳定指纹未变化；八张关键业务表稳定指纹前后相同，业务 DML 为 `0`
- Binding／Scope／Context Version／Context Head 保持 `1／1／1／1`
- active historical orphan／Scope relation orphan 保持 `1／1`；A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`
- 全新执行前／后恢复点各 `1／1`，非空、parse、完整性和隔离恢复均通过；原目标 Restore 为 `0`，隔离数据库活动残留为 `0`
- Allocation Lease 未消费、已释放且 active=`0`；Execution Lease claim／consume／renewal／release／active 为 `1／1／0／1／0`
- client、进程组、Lease／run lock、attempt marker、Helper、私有配置副本与隔离数据库活动残留均为 `0`；不可覆盖 terminal record 保持 `1`
- `0042` 已消费且不可改写；后续发现只能使用独立 forward-fix

### F01／F02 与独立审查

- F01：恢复点 dump／restore deparser 只对一个公开 CHECK 去除一对冗余括号；token 顺序、validated 状态及其他 Catalog／Shape 精确一致，该窄范围规则不得泛化；F01 已关闭
- F02：编排器首次因私有输入权限不满足门禁而在目标调用、数据库连接和 Lease claim 前拒绝；目标调用、Lease、DDL／DML 和数据库变化均为 `0`，从头重检后完成唯一目标调用；F02 已关闭
- 执行前 helper 校准的 `9` 次未通过隔离验证均发生在 Lease 与目标调用之前，未 Restore 原目标，临时隔离数据库均已删除，不构成 Migration attempt 或自动重试
- 当前主动私有参数披露、Secret、Token、密码、私钥、PII、真实凭证披露与非 localhost 连接均为 `0`
- 独立审查结论为 `base02_membership_revision_m5_execution_review=passed`
- `m5_execution_complete=true`，本 handoff 合并后 `m5_handoff_complete=true`
- `eligible_for_m6_after_handoff=true`；M6 尚未启动，本 handoff 合并后按当前 ULTRA 授权继续，但不得绕过动态硬门

### 持续阻断

- M6、M7 尚未启动；M6 完成前既有 Auth Reader 继续保留 `updated_at` 兼容读取，不得把本 handoff 写成 Reader 已切换
- BASE-B1 Runtime 继续 `blocked`；BASE-B2～B6 均未启动
- active historical orphan 与 Scope relation orphan 保持 `1／1`，未修改、未授权修复
- A2-P2 Scope FK 保持 `NOT VALID`／`convalidated=false`，未执行 `VALIDATE`
- 项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与业务 Reader 继续阻断
- 正式平台服务端授权根仍为独立缺口，七线正式发布仍为 `0/7`

### 唯一下一任务

- 任务名称：`BASE-02 Membership Revision M6 Reader 从 updated_at 切换到显式 revision＋lifecycle`
- 任务编号：仓库尚无正式编号，本 handoff 不自行创造
- 当前状态：仅冻结且尚未启动；本 handoff 合并后已由当前 ULTRA 用户指令授权继续
- 任务边界：将 Access Control authoritative Membership Reader 从 `updated_at` 授权 fallback 切换到显式 identity／revision／lifecycle／role；Formal Session 只保留 selector／provenance，每次请求重读 Membership、Binding 与 Scope，并使非 active、revision 漂移或 Provider 不可用 fail-closed
- M6 启动前必须重新冻结最新 main、M1～M5 证据链、当前 Reader／Session／Guard 影响面和 15 个核心链＋2 个次级 Reader 测试；不得创建 Migration Lease、连接数据库、处理 orphan、执行 FK `VALIDATE` 或夹带 M7／BASE-B1

```text
membership_revision_direction=A-full_same_table_lifecycle
membership_revision_decision_accepted=true
membership_revision_physical_model_accepted=true
membership_revision_migration_sequence=M0_to_M7_accepted
m0_complete=true
m1_complete=true
m1_expand_migration_executed=true
m1_catalog_state=all_exact
m2_owner_writer_implemented=true
m2_transactional_cas_verified=true
m2_replay_fail_closed=true
m2_database_execution=false
m2_implementation_review=passed
m2_complete=true
m3_onboarding_delegated=true
m3_single_outer_transaction_verified=true
m3_legacy_writer_deleter_blocked=true
m3_owner_outside_direct_writer_files=0
m3_owner_outside_direct_writer_symbols=0
m3_owner_allowlist_files=1
m3_aq008_membership_direct_writer_passed=true
m3_implementation_review=passed
m3_database_execution=false
m3_complete=true
m4_migration=0041
m4_environment_journal_entries=42
m4_target_guarded_migration_calls_cumulative=3
m4_automatic_retry_count=0
m4_planned=1
m4_created=1
m4_reused=0
m4_conflict=0
m4_unexpected=0
m4_current_envelope_complete=1
m4_baseline_transition_count=1
m4_execution_review=passed
m4_execution_complete=true
m4_handoff_complete=true
m4_non_target_guard_bootstrap_rejections=1
m4_fourth_target_migration_started=false
m4_lease_active=false
m4_outcome_known=true
m4_complete=true
eligible_for_m5_after_handoff=true
m5_started=true
m5_authorized_under_ultra=true
m5_migration=0042
m5_environment_journal_entries=43
m5_environment_latest=0042
m5_snapshot_latest=0026
m5_zero_candidate_branch=true
m5_planned=0
m5_created=0
m5_reused=0
m5_conflict=0
m5_unexpected=0
m5_target_guarded_migration_calls_cumulative=1
m5_automatic_retry_count=0
m5_allocation_lease_consumed=false
m5_allocation_lease_released=true
m5_allocation_lease_active=false
m5_execution_lease_claim=1
m5_execution_lease_consume=1
m5_execution_lease_renewal=0
m5_execution_lease_release=1
m5_execution_lease_active=false
m5_current_envelope_complete=1
m5_transition_count=1
m5_exact_current_head_count=1
m5_active_historical_orphan=1
m5_scope_relation_orphan=1
m5_scope_fk_validated=false
m5_execution_review=passed
m5_execution_complete=true
m5_handoff_complete=true
m5_outcome_known=true
m5_complete=true
eligible_for_m6_after_handoff=true
m6_started=false
m6_authorized_under_ultra=true
m7_started=false
eligible_for_base_b1_runtime=false
base_b1_runtime=blocked
base_b2_started=false
base_b3_started=false
base_b4_started=false
base_b5_started=false
base_b6_complete=false
base02_complete=false
orphan_remediation_authorized=false
active_historical_orphan_count=1
scope_relation_orphan_count=1
a2_p2_scope_fk_validated=false
project_writer_started=false
reader_started=false
eligible_for_reader=false
next_task=BASE-02 Membership Revision M6 Reader 从 updated_at 切换到显式 revision＋lifecycle
next_task_started=false
next_task_authorized_under_ultra=true
```

<!-- ARCHITECTURE_V2_PHASE1_END -->

<!-- PHASE31_FINAL_AUDIT_START -->

## 第三十一阶段最终目录重构审计状态

- 更新日期：2026-07-27
- 审计基线：`5ecc41dea5fe4ef0ba33731137449a875d32bb34`
- 执行模式：`audit_only`
- 最终决策：`closed`
- 阻断项数量：0
- 初始发现项：17（全部已解释为非阻断）
- 审计证据：`docs/refactor/phase-31-final-directory-closeout-audit.md`
- 正式业务源码累计移动：3
- 本阶段 runtime 修改：0
<!-- PHASE31_FINAL_AUDIT_END -->

<!-- PHASE30_CLOSEOUT_START -->

## 第三十阶段遗留安全治理闭环状态

- 更新日期：2026-07-27
- 阶段 C 启动基线：`6720a6511f38a7b23ade9960723eaf309a3644df`
- R06 Demo Seed Guard：`resolved_in_phase30b`
- R07 DemoAuthRoutes：`resolved_in_phase30c`
- R08 迁移矩阵：`explained_governed_backlog`
- 迁移矩阵：总数 1509，pending 1455，high risk 693
- 最终证据：`docs/refactor/phase-30-closeout.md`
- 第三十阶段剩余正式分支：0
- 正式认证源码修改：2（`login` 平台 Demo scope + `session` Demo Session 结构对齐）
- Seed／Migration／数据库连接：0
<!-- PHASE30_CLOSEOUT_END -->

<!-- PHASE29_REALIGNMENT_START -->

## 第二十九阶段重新对齐状态

- 更新日期：2026-07-27
- 启动基线：`e324b0cc691f24ed417913b716af602c716190d6`
- 原逐模块串行审计方案：`superseded`
- `platform-homepage`：已闭环，`no_candidate`
- 四类跨模块链路：已完成去重后的统一审计
- 依赖边去重键：`source_path + target_path + specifier`
- 伪模块循环：已排除
- 候选淘汰证据：`docs/refactor/phase-29-cross-module-pilot-candidates.csv`
- 试点决策：`no_safe_candidate`
- 决策原因：`no_eligible_candidate`
- 唯一试点：`none`
- 源码修改：0
- 第二十九阶段剩余正式分支：0
<!-- PHASE29_REALIGNMENT_END -->


- 更新时间：2026-07-27
- 仓库：`love1252/zmtg-clean`
- 当前重构分支：`main`
- 重构基线：`5ecc41dea5fe4ef0ba33731137449a875d32bb34`
- 当前阶段：第三十一阶段，最终目录重构已闭环
- 下一阶段：无新的目录重构编号阶段；后续仅按独立业务需求处理非阻断 backlog
- 架构形态：模块化单体
- 数据库迁移目录：`drizzle/`
- 数据库运行时入口：`src/server/db/`

## 当前重点问题

1. `src/modules/institution/` 体积较大，混合页面、领域、服务和业务能力。
2. `src/modules/open-platform/` 聚合了较多平台端职责。
3. 客户、随访、知识库和工作台存在职责重叠。
4. API 同时存在版本化与非版本化路径。
5. 正式业务源码移动累计为 3，已完成预约纯领域、套餐额度只读服务和开放平台租户套餐变更领域三个单文件试点。

## 当前重构边界

- 不修改 Schema。
- 不修改 Migration。
- 不修改 package.json 或 lockfile。
- 不连接真实数据库。
- 不调用真实 HIS。
- 不调用真实企业微信。
- 不改变租户隔离和权限模型。
- 未经单独授权，不批量移动正式业务源码。

## 第二阶段低风险资产状态

- 三组重复静态资源已完成哈希核验。
- 统一保留 `zmtg-*` 品牌资源。
- 品牌资源映射已更新为统一路径。
- scripts、Seed、Fixture、Demo 仅完成分类审计。

## 第三阶段脚本目录状态

- 根目录脚本继续作为稳定兼容入口。
- 测试服务器部署实现已下沉至 `scripts/deploy/`。
- Node 运行时解析实现已下沉至 `scripts/runtime/`。
- `package.json` 和锁文件保持不变。
- 未执行真实部署、数据库迁移或 Seed。

## 第四阶段脚本目录状态

- `scripts/run-next.mjs` 保留为稳定兼容入口。
- Next.js 命令实现已下沉至 `scripts/runtime/`。
- `scripts/run-vitest.mjs` 保留为稳定兼容入口。
- Vitest 命令实现已下沉至 `scripts/testing/`。
- `package.json` 和锁文件保持不变。
- 未执行真实部署、数据库迁移或 Seed。

## 第五阶段 Demo、Mock、Fixture、Seed 审计状态

- 已复核第二阶段列出的 44 个候选文件。
- 已生成逐文件调用关系和风险分组清单。
- 已更新迁移矩阵中的 44 条审计记录。
- 本阶段移动业务文件数量为 0。
- Seed、认证和运行时 API 候选继续保持原位。
- 未运行 Migration、Seed 或真实外部调用。

## 第六阶段文档与测试归属状态

- 14 个历史文档已完成职责归属确认。
- 11 个纯测试文件已完成模块归属确认。
- 25 个候选均确认继续保留当前位置。
- 本阶段文件移动数量为 0。
- Seed、认证、运行时 API 和 Mock 未修改。
- 第五阶段仍有 19 个候选等待后续边界审核。

## 第七阶段模块 Mock 边界状态

- 5 个开放平台模块 Mock 已完成调用边界审核。
- 4 个候选属于运行时可达的受控样例 Provider。
- 1 个候选属于运行时类型契约来源与测试值样例。
- 5 个候选均继续保留当前位置。
- 本阶段文件移动数量为 0。
- 第五阶段仍有 14 个候选等待后续审核。

## 第八阶段运行时 Demo 边界状态

- 11 个原运行时 Demo 候选已完成当前调用证据复核。
- 其中 10 个确认属于运行时边界。
- 1 个重分类为仅测试调用的休眠领域 Mock。
- API 路由边界 2 个。
- 认证边界 2 个。
- 领域职责候选 5 个。
- 服务边界 2 个。
- 11 个候选均继续保留当前位置。
- 本阶段文件移动数量为 0。
- 第五阶段仍有 3 个 Demo 脚本或 Seed 候选等待审核。

## 第九阶段 Demo 脚本与 Seed 安全边界状态

- 最后 3 个第五阶段候选已完成边界审核。
- Demo Seed CLI 边界 1 个。
- 数据库 Seed 写入入口 1 个。
- Seed 安全守卫 1 个。
- 发现 Demo CLI 守卫策略比核心 Seed Guard 更宽，已记录为后续治理项。
- 第五阶段 `audit_completed` 候选已归零。
- 本阶段未执行 Seed、Migration 或数据库连接。
- 本阶段文件移动数量为 0。

## 第十阶段目录重构阶段性闭环状态

- 第一至第九阶段记录已完成一致性核对。
- 第五阶段 44 个候选已由第六至第九阶段完整覆盖。
- 第五阶段 `audit_completed` 剩余数量为 0。
- 第一轮盘点、低风险整理和候选边界审核已阶段性闭环。
- 业务模块、API 路径和跨模块职责重构尚未完成。
- 机构端、开放平台、API 版本和数据库边界仍列入风险登记。
- 本阶段未修改迁移矩阵原记录。
- 本阶段未移动正式业务源码。

## 第十一阶段 API 路径版本化治理规划状态

- 已纳入 `API_VERSION_REVIEW` 候选 91 个。
- 版本化路由：0 个。
- 非版本化路由：88 个。
- 上述版本分类只覆盖 `API_VERSION_REVIEW` 候选，不代表全仓 API。
- 全仓 `route.ts`：145 个。
- 全仓版本化 `route.ts`：56 个。
- 全仓非版本化 `route.ts`：89 个。
- 候选外版本化 `route.ts`：56 个。
- 精确版本化／非版本化重叠族：0 个。
- 有运行时字面量调用证据的路由：65 个。
- 已生成逐路由清单和路由族清单。
- 本阶段未修改迁移矩阵。
- 本阶段未移动或修改 API 文件。

## 第十二阶段全仓 API 路由分类补全状态

- 全仓 `route.ts`：145 个。
- 全仓版本化路由：56 个。
- 全仓非版本化路由：89 个。
- 第十一阶段候选内路由：88 个。
- 第十二阶段分类缺口：57 个。
- 缺口内版本化路由：56 个。
- 缺口内非版本化路由：1 个。
- 全仓路由族：144 个。
- 版本化／非版本化重叠族：1 个。
- 57 条缺口只生成矩阵分类建议，尚未修改迁移矩阵。
- 本阶段未移动或修改 API 文件。

## 第十三阶段 API 矩阵分类建议审核状态

- 已审核第十二阶段 57 条分类建议。
- 55 条批准为仅修改 `recommended_action` 的候选。
- 2 条必须保留既有运行时边界结论。
- 唯一重叠族为 `/api/open-platform/tenants`。
- 该路由族分别承担 GET 列表读取和 POST 租户创建。
- 两个入口不是行为等价的兼容别名。
- 本阶段未修改迁移矩阵。
- 本阶段未移动或修改 API 文件。

## 第十四阶段 API 版本治理矩阵动作应用状态

- 已应用 55 条审核通过的矩阵动作修改。
- 55 条记录仅将 `recommended_action` 从 `KEEP_REVIEW` 修改为 `API_VERSION_REVIEW`。
- 修改前 `API_VERSION_REVIEW`：91 条。
- 修改后 `API_VERSION_REVIEW`：146 条。
- 两条运行时边界记录保持原动作和状态。
- 迁移矩阵行数和路径集合均未变化。
- 本阶段未修改或移动 API 文件。
- 本阶段未修改 API 源码。

## 第十五阶段 API 版本治理辅助标记规划状态

- 已确认需要辅助标记的运行时边界记录为 2 条。
- 推荐使用独立 sidecar 注册表，不覆盖迁移矩阵主动作。
- 建议标记为 `api_version_governance=review_required`。
- 标记权威级别为 `supplemental_non_overriding`。
- 本阶段未创建正式辅助标记注册表。
- 本阶段未修改迁移矩阵。
- 本阶段未修改或移动 API 文件。

## 第十六阶段正式辅助标记注册表状态

- PR #759 已合并。
- 合并提交：`f5802888ec70c1fc02e21b2938de0d740411c933`。
- 已创建正式注册表：
  `docs/refactor/api-version-governance-auxiliary-markers.csv`。
- 注册表首次恰好包含 2 条记录。
- 两条记录的 `current_path` 唯一。
- 固定辅助标记为：
  `api_version_governance=review_required`。
- 标记权威级别为：
  `supplemental_non_overriding`。
- 两条主动作继续保持：
  `RUNTIME_BOUNDARY_CONFIRMED_KEEP_CURRENT`。
- 两条主状态继续保持：
  `runtime_boundary_confirmed`。
- 迁移矩阵修改：0。
- API 文件移动：0。
- API 源码修改：0。

## 第十七阶段路线图固化状态

- 已更新统一交接状态、下一任务和发布历史。
- 已固化第十七至第三十一阶段目录重构路线图。
- 路线图覆盖 API、机构端、开放平台、跨模块职责、
  遗留安全治理和最终闭环审计。
- 路线图不自动授权后续源码移动。
- 每一阶段仍需独立工作分支、本地回退分支、
  验证、Draft PR、Ready 授权和合并授权。
- 正式业务源码移动仍为 0。
- 本阶段不修改迁移矩阵、API、业务源码、测试或脚本。

## 第十八阶段 API 调用方与兼容策略基线状态

- 已覆盖全仓 145 个 `route.ts` 和 144 个路由族。
- 已保持 146 条主治理候选和 2 条辅助标记可追溯。
- 已生成 148 条治理追踪记录。
- 已建立页面组件、运行时代码、测试、脚本、
  产品文档和仓库外未知客户端证据分类。
- 已建立五类兼容策略、兼容期、退役条件、
  最低观测要求和回退要求。
- 第十九阶段唯一试点候选：
  `/api/institution/wecom-official-dry-run`。
- 试点路由文件：
  `src/app/api/institution/wecom-official-dry-run/route.ts`。
- 该试点只是相对低风险设计候选，不构成迁移授权。
- 迁移矩阵修改：0。
- API 文件移动：0。
- API 源码修改：0。
- 运行时行为修改：0。

## 第十九阶段 WeCom official dry-run 试点设计状态

- 唯一路由族：`/api/institution/wecom-official-dry-run`。
- 建议目标：`/api/v1/institution/wecom-official-dry-run`。
- 采用直接 re-export 旧 `GET` 的方案。
- 旧入口继续可用，不设置 sunset 日期。
- 已形成兼容契约、调用方计划、5 文件白名单、验证和回退计划。
- API 修改：0。
- 调用方修改：0。
- 迁移矩阵修改：0。
- 运行时行为修改：0。

## 第二十阶段 WeCom official dry-run v1 兼容入口状态

- 已新增版本化入口：`/api/v1/institution/wecom-official-dry-run`。
- 新路由文件：`src/app/api/v1/institution/wecom-official-dry-run/route.ts`。
- 新入口直接 re-export 旧 `GET`。
- 新旧入口为同一函数引用。
- 旧入口 `/api/institution/wecom-official-dry-run` 保持原样并继续可用。
- HTTP `503`、`code=capability_disabled`、
  固定低敏错误信息和 `Cache-Control=no-store` 保持不变。
- Request 读取、下游初始化、数据库和外部调用仍为 0。
- 已新增独立兼容契约测试：`src/modules/institution/tests/V1WeComOfficialDryRunCompatibilityApiRoute.test.ts`。
- 未修改旧路由、现有测试或调用方。
- 未修改迁移矩阵、Schema、Migration、package 或锁文件。
- 本阶段只实施一个路由族。

## 第二十一阶段 API 试点闭环状态

- 第二十阶段试点闭环：通过。
- 全仓 `route.ts`：146。
- 版本化路由：57。
- 非版本化路由：89。
- 路由族：144。
- 精确版本化／非版本化重叠族：2。
- 剩余路由族批次计划：143 条。
- 可复制试点模式候选：0。
- 需要客户端迁移：64。
- 需要观测后退役：2。
- 保持当前：54。
- 阻断，等待人工决策：23。
- 旧入口继续保留，未授权退役。
- API、调用方和迁移矩阵修改：0。
- 第二个路由族实施：0。

## 第二十二阶段机构端职责与依赖图状态

- 受审计机构端文件：323。
- 依赖边：1325。
- 跨模块内部依赖边：384。
- 反向依赖边：4。
- 循环依赖组：2。
- 涉及循环文件：8。
- 基础纯领域／纯类型安全候选文件：22。
- 领域所有者：14。
- 第二十三阶段唯一候选：`src/modules/institution/domain/appointments.ts`。
- 候选性质：纯领域空态模型，不是纯类型文件。
- 选择层级：`B_pure_domain_with_existing_tests`。
- 建议目标：`src/modules/institution/domain/appointment/appointments.ts`。
- 第二十三阶段当前授权：否。
- 机构端源码、API 和迁移矩阵修改：0。

## 第二十三阶段机构端纯领域试点状态

- 唯一候选原路径：`src/modules/institution/domain/appointments.ts`。
- 稳定目标路径：`src/modules/institution/domain/appointment/appointments.ts`。
- 候选性质：纯领域空态模型。
- 文件内容 blob：`d5d88fcc24bec0a92c09223e5da4a329a462676f`，移动前后完全一致。
- export 契约：3 个 type、2 个运行时空数组，共 5 个，保持不变。
- 直接调用方：`src/modules/institution/tests/InstitutionBusinessDomain.test.ts`，仅修正 import。
- 旧源码 import：0。
- 新源码 import：1。
- 候选内部 import：0。
- 新增循环依赖：0。
- 新增反向依赖：0。
- 正式业务源码累计移动：1 个。
- API、数据库、权限、租户隔离和错误响应修改：0。
- `file-migration-matrix.csv` 修改：0。
- 第二个机构端候选实施：0。

## 第二十四阶段机构端服务边界试点状态

- 预检文档：`docs/refactor/phase-24-institution-service-pilot-preflight.md`。
- 精确白名单：`docs/refactor/phase-24-institution-service-pilot-allowed-files.csv`。
- 唯一候选原路径：`src/modules/institution/server/package-ai-quota-readonly-source.ts`。
- 稳定目标路径：`src/modules/institution/entitlement/package-ai-quota-readonly-source.ts`。
- 候选职责：`server_service`。
- 领域所有者：`entitlement`。
- 文件内容 blob：`177ad4c2d5ef7fb849d955996755beba12b3cc0f`，移动前后完全一致。
- export 契约：4 个 type、6 个 function，共 10 个，保持不变。
- 候选 import：仅依赖机构端套餐额度 domain 契约，保持不变。
- 运行时调用方：`src/modules/institution/server/institution-ai-service-usage.ts`，仅修正 import。
- 直接测试：`src/modules/institution/tests/PackageAiQuotaReadonlySource.test.ts`，仅修正 import。
- 旧源码 import：0。
- 新源码 import：2。
- 跨模块出向依赖：0。
- 新增循环依赖：0。
- 新增反向依赖：0。
- 正式业务源码累计移动：2 个。
- API、数据库、权限、租户隔离和错误响应修改：0。
- `file-migration-matrix.csv` 修改：0。
- 第二个服务候选实施：0。

## 第二十五阶段机构端阶段闭环状态

- 闭环审计：`docs/refactor/phase-25-institution-stage-closeout.md`。
- 剩余治理分类：`docs/refactor/phase-25-institution-remaining-classification.csv`。
- 两个试点追溯表：`docs/refactor/phase-25-institution-pilot-traceability.csv`。
- 非阻断 backlog：`docs/refactor/phase-25-institution-nonblocking-backlog.csv`。
- 机构端文件基线：323。
- 已完成试点：2。
- 可迁移：22。
- 保持当前位置：195。
- 保护边界：96。
- 延期处理：8。
- 剩余文件：321。
- 未分类文件：0。
- 正式业务源码累计移动：2 个。
- 第二十五阶段源码移动：0。
- `src/` 修改：0。
- API 修改：0。
- `file-migration-matrix.csv` 修改：0。
- 机构端剩余项均为非阻断 backlog。

## 第二十六阶段开放平台职责与依赖图状态

- 逐文件职责：`docs/refactor/phase-26-open-platform-file-responsibility-inventory.csv`。
- 依赖边：`docs/refactor/phase-26-open-platform-dependency-edges.csv`。
- 领域所有权：`docs/refactor/phase-26-open-platform-domain-ownership.csv`。
- 审计结论：`docs/refactor/phase-26-open-platform-responsibility-dependency-audit.md`。
- 第二十七阶段候选：`docs/refactor/phase-26-open-platform-phase27-candidate.md`。
- 第二十七阶段白名单：`docs/refactor/phase-26-open-platform-phase27-allowed-files.csv`。
- 开放平台文件：186。
- 依赖边：684。
- 领域所有者：9。
- 运行时边界文件：139。
- 跨模块出向文件：67。
- 跨模块入向文件：29。
- 反向依赖文件：11。
- 循环依赖组：1。
- 循环依赖文件：8。
- 安全候选总数：2。
- 唯一候选：`src/modules/open-platform/domain/tenant-plan-change.ts`。
- 建议目标：`src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`。
- 候选 blob：`59c7d6bed836ed8b56cc0376b3203b156c41eb88`。
- 第二十六阶段源码修改：0。
- API、迁移矩阵和运行时配置修改：0。
- 第二十七阶段当前授权：否。

## 第二十七阶段开放平台商业权益领域试点状态

- 原路径：`src/modules/open-platform/domain/tenant-plan-change.ts`。
- 当前路径：`src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`。
- 文件 blob：`59c7d6bed836ed8b56cc0376b3203b156c41eb88`。
- 职责：`domain`。
- 领域所有者：`commercial_entitlement`。
- type export：4。
- function export：3。
- export 总数：7。
- 候选 import：1 个 type-only。
- 直接调用方：4。
- 直接测试：1。
- 旧 import：0。
- 新 import：4。
- 移动前后 blob：一致。
- 新增跨模块依赖：0。
- 新增循环依赖：0。
- 新增反向依赖：0。
- 正式业务源码累计移动：3 个。
- 第二十七阶段源码移动：1 个。
- API、迁移矩阵和运行时配置修改：0。

## 第二十八阶段开放平台阶段闭环状态

- 闭环文档：`docs/refactor/phase-28-open-platform-stage-closeout.md`。
- 剩余分类：`docs/refactor/phase-28-open-platform-remaining-classification.csv`。
- 试点追溯：`docs/refactor/phase-28-open-platform-pilot-traceability.csv`。
- 非阻断 backlog：`docs/refactor/phase-28-open-platform-nonblocking-backlog.csv`。
- 开放平台文件基线：186。
- 已完成试点：1。
- 可迁移：1。
- 保持当前位置：27。
- 保护边界：156。
- 延期处理：1。
- 剩余文件：185。
- 未分类文件：0。
- 正式业务源码累计移动：3 个。
- 第二十八阶段源码移动：0。
- `src/` 修改：0。
- API 修改：0。
- `file-migration-matrix.csv` 修改：0。
- 开放平台剩余项均为非阻断 backlog。
- 动态模块路径补扫：规范化已移动源路径后，确认 25 个遗漏依赖对，影响 11 个开放平台目标文件。
- 机器证据修正：PR #772 已合并（merge commit `54520f62dd3c3c7c7d7c9bc7e63de0a68571296b`），已修正移动文件新旧路径的重复消费者计数。
