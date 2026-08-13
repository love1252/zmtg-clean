# 智美天工当前项目状态


<!-- ARCHITECTURE_V2_PHASE1_START -->

## Post-V2 当前状态

- 更新日期：2026-08-13
- Architecture V2：已完成
- POST-V2-R1B `page_workbench`：稳定且已完成治理闭环
- POST-V2-R1C 错误放行尝试：精确 4 文件 Runtime 回滚、独立验证及两个指定 P1 审查线程均已完成治理收尾
- POST-V2-R1C Audit Reader Foundation：exact 8-file Runtime、Required Check、合并后独立验证与 Handoff 均已闭环
- POST-V2-R1C `page_system_audit`：fresh release re-audit 已通过，但 eligibility 因 Audit Writer institution attribution 未闭环而阻断
- S4 Phase 0：PR #1172 已修正 Handoff 授权来源与页面授权状态，PR #1171 两个 post-merge Review thread 已回复并解决
- S4 Phase 1 / S5 Phase 0 修正：Audit Writer attribution fresh audit 已通过；重新核算为 19 个生产 caller 与 10 个 transaction persistence / composition 点，完整 closure 仍必须拆分
- S5 Phase 0：caller inventory docs-only follow-up PR #1174 已合并；合并后仅回复并解决 PR #1173 指定 Review thread
- S5 Phase 1：首个原子前置 formal institution Audit Writer scope port fresh audit 已通过，冻结 exact 2-file Runtime Admission
- S6：formal institution Audit Writer scope port exact 2-file Runtime、Required Check、合并后独立验证与 Handoff 均已闭环
- S7：Audit Owner institution attribution contract fresh audit 已通过，冻结 exact 4-file Runtime Admission
- S8：Audit Owner institution attribution contract exact 4-file Runtime、Required Check、合并后独立验证与 Handoff 均已闭环
- S9：caller migration fresh audit 已通过，目标分为 5 `VERIFIED` / 12 `NOT_APPLICABLE` / 2 `BLOCKED_UNCLASSIFIED`；选择 composition-family split，并冻结 Auth login `not_applicable` exact 2-file 首切片
- 当前经审查接受的受治理只读页面切片：1 / 26
- 剩余未放行页面：25
- 受控创建能力放行：0 / 3
- PR #1163 两个指定 P1：均已回复并解决，目标未解决线程数为 0
- 审计读取器：机构范围 Reader 已实现，只消费正式 one-shot opaque context，并强制 tenant + institution + `verified`
- Audit Writer attribution / 历史 backfill：均未闭环
- Reader readiness：ready；Reader data readiness：false
- 本地只读验证：275 条审计记录中 `institutionId` 非空为 0、`verified` 为 0、attribution 为 `NULL` 的记录为 275
- Workbench multi-capability：当前不安全，第二条可见摘要仍会触发 `/hospital` 的 exact-one guard
- 生产就绪 / 部署：未推导、未执行

```text
POST_V2_R1C_EXACT4_RUNTIME_ROLLBACK=passed
POST_V2_R1C_ROLLBACK_INDEPENDENT_VERIFICATION=passed

PR1163_WORKBENCH_P1_THREAD_RESOLVED=true
PR1163_AUDIT_READER_P1_THREAD_RESOLVED=true
PR1163_TARGET_P1_UNRESOLVED_COUNT=0

POST_V2_R1C_FAILED_RELEASE_ATTEMPT_GOVERNANCE_CLOSED=true
R1B_WORKBENCH_STABLE_RUNTIME_RESTORED=true

POST_V2_R1C_AUDIT_READER_RUNTIME=passed
AUDIT_READER_RUNTIME_IMPLEMENTED=true
AUDIT_READER_RUNTIME_VERIFIED=true
AUDIT_READER_RUNTIME_INDEPENDENT_VERIFICATION=passed
AUDIT_READER_RUNTIME_HANDOFF_COMPLETE=true

RUNTIME_EXACT_FILE_COUNT=8
RUNTIME_PR=1169
RUNTIME_HEAD=c927fdfc9a37a865d3df2082ec350b7e01806c45
RUNTIME_MERGE=2a45b74999784bdcf1a4777c9017ba15d2cef546
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0

ARCHITECTURE_EXCEPTION_REQUIRED=false
DATABASE_CONNECTION_USED=true
DATABASE_CONNECTION_SCOPE=local_development_only
DATABASE_READONLY_VERIFICATION=passed
DATABASE_WRITE_EXECUTION=false
SCHEMA_CHANGE=false
MIGRATION=false
DDL_EXECUTION=false
DML_EXECUTION=false

AUDIT_WRITER_ATTRIBUTION_CLOSED=false
HISTORICAL_BACKFILL_CLOSED=false
AUDIT_READER_DATA_READINESS=false

PR1171_POST_MERGE_P1_RESOLVED=true
PR1171_POST_MERGE_P2_RESOLVED=true
PHASE0_FIX_PR=1172
PHASE0_FIX_MERGE=44b2f3653fbfd5cc4dd02f33e5c2c8fc80f292cb

PHASE0_CALLER_INVENTORY_FIX_PR=1174
PHASE0_CALLER_INVENTORY_FIX_HEAD=3c9501da62ef19f2f79a3811672aed29e115d34f
PHASE0_CALLER_INVENTORY_FIX_MERGE=654b241ce021ecaf08891a98c590867c0393372a
PR1173_POST_MERGE_P2_RESOLVED=true

AUDIT_WRITER_ATTRIBUTION_FRESH_AUDIT=passed
AUDIT_WRITER_ATTRIBUTION_RUNTIME_ELIGIBLE=false
ADMISSION_MODE=SPLIT_REQUIRED
CALLER_INVENTORY_REAUDIT=passed
PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=11
PRODUCTION_PLATFORM_AUDIT_WRITER_CALLER_FILE_COUNT=7
PRODUCTION_NON_INSTITUTION_AUDIT_WRITER_CALLER_FILE_COUNT=1
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10
BLOCKING_PREREQUISITE_COUNT=3
PRIMARY_BLOCKING_PREREQUISITE=formal institution Audit Writer scope port
HISTORICAL_BACKFILL_REQUIRED_FOR_PAGE_RELEASE=true

AUDIT_WRITER_SCOPE_PORT_FRESH_AUDIT=passed
AUDIT_WRITER_SCOPE_PORT_RUNTIME_ELIGIBLE=true
ADMISSION_MODE=ADMISSION_READY
EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_WRITER_SCOPE_PORT_EXACT_RUNTIME_ADMISSION=passed

POST_V2_R1C_AUDIT_WRITER_SCOPE_PORT_RUNTIME=passed
AUDIT_WRITER_SCOPE_PORT_RUNTIME_IMPLEMENTED=true
AUDIT_WRITER_SCOPE_PORT_RUNTIME_VERIFIED=true
AUDIT_WRITER_SCOPE_PORT_INDEPENDENT_VERIFICATION=passed
AUDIT_WRITER_SCOPE_PORT_HANDOFF_COMPLETE=true

AUDIT_OWNER_ATTRIBUTION_CONTRACT_FRESH_AUDIT=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_ELIGIBLE=true
ADMISSION_MODE=ADMISSION_READY
EXACT_RUNTIME_SCOPE_FROZEN=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXACT_RUNTIME_ADMISSION=passed

POST_V2_R1C_AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_IMPLEMENTED=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_VERIFIED=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_INDEPENDENT_VERIFICATION=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_HANDOFF_COMPLETE=true
AUDIT_OWNER_ATTRIBUTION_CONTRACT_CLOSED=true

CALLER_MIGRATION_FRESH_AUDIT=passed
COMPLETION_MODE=ADMISSION_READY_SPLIT
MIGRATION_STRATEGY=SPLIT
EXACT_RUNTIME_SCOPE_FROZEN=true
FIRST_SLICE_EXACT_RUNTIME_ADMISSION=passed

PRODUCTION_AUDIT_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_LEGACY_WRITER_CALLER_FILE_COUNT=19
PRODUCTION_ATTRIBUTED_WRITER_CALLER_FILE_COUNT=0
HELPER_CONSTRUCTION_CALLER_FILE_COUNT=16
DIRECT_OBJECT_CONSTRUCTION_CALLER_FILE_COUNT=3
TRANSACTIONAL_AUDIT_WRITER_CALLER_FILE_COUNT=10

TARGET_VERIFIED_CALLER_FILE_COUNT=5
TARGET_NOT_APPLICABLE_CALLER_FILE_COUNT=12
BLOCKED_UNCLASSIFIED_CALLER_FILE_COUNT=2

FORMAL_SCOPE_RESOLUTION_CARDINALITY=exactly_once_per_top_level_operation
FORMAL_SCOPE_REUSE_WITHIN_OPERATION_SAFE=true

ADMITTED_SLICE_ID=AUTH_LOGIN_NOT_APPLICABLE_V1
ADMITTED_CALLER_FILE_COUNT=1
REMAINING_LEGACY_CALLER_FILE_COUNT_AFTER_SLICE=18
CALLER_MIGRATION_EXACT_RUNTIME_FILE_COUNT=2
CALLER_MIGRATION_EXISTING_RUNTIME_FILE_COUNT=2
CALLER_MIGRATION_NEW_RUNTIME_FILE_COUNT=0
CALLER_MIGRATION_DELETE_RUNTIME_FILE_COUNT=0
CALLER_MIGRATION_EXACT_PRODUCTION_FILE_COUNT=1
CALLER_MIGRATION_EXACT_TEST_FILE_COUNT=1
CALLER_MIGRATION_EXACT_DOC_FILE_COUNT=5
CALLER_MIGRATION_EXISTING_DOC_FILE_COUNT=4
CALLER_MIGRATION_NEW_DOC_FILE_COUNT=1

CALLER_MIGRATION_SCHEMA_CHANGE_REQUIRED=false
CALLER_MIGRATION_MIGRATION_REQUIRED=false
CALLER_MIGRATION_DDL_REQUIRED=false
CALLER_MIGRATION_DML_REQUIRED=false
CALLER_MIGRATION_ARCHITECTURE_EXCEPTION_REQUIRED=false
CALLER_MIGRATION_DATABASE_CONNECTION=false
CALLER_MIGRATION_DATABASE_WRITE_EXECUTION=false

ATTEMPTED_INSTITUTION_DENIAL_PREREQUISITE_REQUIRED=true
ATTEMPTED_INSTITUTION_DENIAL_BLOCKED_CALLER_FILE_COUNT=2
CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
AUDIT_CALLER_MIGRATION_CLOSED=false

PR1181_POST_MERGE_P1_DETECTED=true
S9_RD1_CORRECTIVE_SCOPE=修改 5 个 Markdown 文档并删除 1 个非 Markdown 独立 allowlist CSV
S9_CANONICAL_EXACT_RUNTIME_ALLOWLIST_LOCATION=docs/operations/post-v2-r1c-audit-writer-classified-caller-migration-admission-20260813.md

AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_AUTHORIZATION_USED=A2 exact 4 files
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_EXACT_FILE_COUNT=4
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_PR=1179
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_HEAD=509140180aa95e56cccba17db4d5e65db20d6cd5
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_MERGE=cba79e6bad83be4eafebc6b4359e381d98eb804a
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_REQUIRED_CHECK=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_RUNTIME_ACTIONABLE_P0_P1=0

AUDIT_OWNER_ATTRIBUTION_CONTRACT_TARGETED_TEST_FILES=16
AUDIT_OWNER_ATTRIBUTION_CONTRACT_TARGETED_TESTS=288
AUDIT_OWNER_ATTRIBUTION_CONTRACT_FULL_TEST_FILES=492
AUDIT_OWNER_ATTRIBUTION_CONTRACT_FULL_TESTS=6678
AUDIT_OWNER_ATTRIBUTION_CONTRACT_TYPECHECK=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_ARCHITECTURE_UNIT=148/148 passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_ARCHITECTURE_INCREMENTAL=passed
AUDIT_OWNER_ATTRIBUTION_CONTRACT_LINT=passed_with_4_existing_warnings
AUDIT_OWNER_ATTRIBUTION_CONTRACT_BUILD=passed

AUDIT_OWNER_ATTRIBUTION_CONTRACT_RECOMMENDED_RUNTIME_DESIGN=方案 B：保留 legacy TenantAuditEvent + record 路径，新增 Audit-owned discriminated attributed contract + recordAttributed 路径
CANONICAL_ATTRIBUTION_CONTRACT_OWNER=src/modules/audit
LEGACY_CALLER_CAN_WRITE_VERIFIED=false
LEGACY_UNATTRIBUTED_NEW_WRITE_ALLOWED=false
AUDIT_CONTRACT_PROVES_FORMAL_SCOPE=false
AUDIT_OWNER_IMPORTS_SCOPE_PORT=false
PLATFORM_NOT_APPLICABLE_CONTRACT_SAFE=true
AUTH_NOT_APPLICABLE_CONTRACT_SAFE=true

AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXACT_RUNTIME_FILE_COUNT=4
AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXISTING_RUNTIME_FILE_COUNT=4
AUDIT_OWNER_ATTRIBUTION_CONTRACT_NEW_RUNTIME_FILE_COUNT=0
AUDIT_OWNER_ATTRIBUTION_CONTRACT_DELETE_RUNTIME_FILE_COUNT=0
AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXACT_PRODUCTION_FILE_COUNT=2
AUDIT_OWNER_ATTRIBUTION_CONTRACT_EXACT_TEST_FILE_COUNT=2

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

RUNTIME_AUTHORIZATION_USED=A2 exact 2 files
RUNTIME_EXACT_FILE_COUNT=2
RUNTIME_PR=1176
RUNTIME_HEAD=77f792ae29dfaf983f77d3a246ec925943e4f016
RUNTIME_MERGE=1aea18be710f32d8589a48ae7ca23aaba0c5ecb6
RUNTIME_REQUIRED_CHECK=passed
RUNTIME_ACTIONABLE_P0_P1=0

TARGETED_TEST_FILES=10
TARGETED_TESTS=253
FULL_TEST_FILES=492
FULL_TESTS=6668
TYPECHECK=passed
ARCHITECTURE_UNIT=148/148 passed
ARCHITECTURE_INCREMENTAL=passed
LINT=passed_with_4_existing_warnings
BUILD=passed

DATABASE_CONNECTION=false
CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
AUDIT_CALLER_MIGRATION_CLOSED=false

POST_V2_R1C_PAGE_SYSTEM_AUDIT_RELEASE_REAUDIT=passed
PAGE_SYSTEM_AUDIT_RELEASE_ELIGIBLE=false
AUDIT_READER_SUCCESS_PATH_EXISTS=true
AUDIT_READER_READINESS=ready
AUDIT_DATA_READINESS=false
WORKBENCH_MULTI_CAPABILITY_SAFE=false

CANONICAL_ROUTE=/hospital/system/audit
ROUTE_STRATEGY=dedicated_static_route_after_data_prerequisite
SHELL_READONLY_SAFE=true
AUDIT_READER_API_AUTHORIZATION_SAFE=true
PAGE_SYSTEM_AUDIT_AUTHORIZATION_VERIFIED=false
LOW_SENSITIVE_OUTPUT_SAFE=true

PAGE_SYSTEM_AUDIT_BLOCKING_PREREQUISITE_COUNT=1
PAGE_SYSTEM_AUDIT_PRIMARY_BLOCKING_PREREQUISITE=Audit Writer institution attribution closure
PAGE_SYSTEM_AUDIT_BLOCKING_OWNER=src/modules/audit

PAGE_WORKBENCH_STATE=read_only/pilot_released
PAGE_SYSTEM_AUDIT_STATE=hidden/not_released
PAGE_SYSTEM_AUDIT_RELEASE=false

REVIEW_ACCEPTED_GOVERNED_PAGE_RELEASE_COUNT=1
REVIEW_ACCEPTED_REMAINING_UNRELEASED_PAGE_COUNT=25
CONTROLLED_CREATE_RELEASE_COUNT=0

PRODUCTION_READY_INFERRED=false
PRODUCTION_DEPLOYMENT=false
PRODUCTION_CHANGE=false

POST_V2_R1C_RELEASE_COMPLETE=false
```

### 唯一下一任务

`POST-V2-R1C Audit Writer caller migration AUTH_LOGIN_NOT_APPLICABLE_V1 exact 2-file Runtime implementation explicit authorization`

```text
CALLER_MIGRATION_RUNTIME_AUTHORIZED=false
PAGE_SYSTEM_AUDIT_RUNTIME_AUTHORIZED=false
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
