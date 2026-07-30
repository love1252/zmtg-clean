# 智美天工当前项目状态

<!-- ARCHITECTURE_V2_PHASE1_START -->

## 架构 V2 第一阶段与 MIG-01A2 本地就绪修复 Stage A 收口状态

- 更新日期：2026-07-30
- V2-01 启动基线：`035c4516f448ca3bfcd95ba835c32ac367e0d964`
- 当前阶段：`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-A-COMPLETE` 已完成并合并
- 完成 PR：#811
- PR Head：`50b007820b7fdb68ff35b6ef0e2a53b9e8e61880`
- Merge Commit：`fc08de343456a1f0d05092f1aedd389118b32b26`
- Required Check：Run `30514884226`／Job `90782386213`，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功
- Stage A 报告：`docs/operations/mig01-a2-local-acceptance-stage-a-20260730.md`
- 报告性质：`current evidence`；只证明固定 localhost-only 本地验收环境的 Stage A 结果，不构成 Stage B 或 A2-P1 授权

### 已接受边界与治理基础

- accepted 决策 PR：#801，Merge Commit `56638dc3595d7bd60a47b08810c50df256d0b87c`
- accepted 组合：D01-A、D02-A、D03-A、D04-A、D05-A、D06-B、D07-B、D08-C、D09-A、D10-B、D11-B、D12-A（方向）
- Owner：Tenancy 是 Scope、Context Version／Head、Manifest、Scope Revision 与 Provisioning Provenance 原始事实的唯一语义 Owner
- Access Control：只通过版本化 Port／Reader 和低敏投影单向消费，不建立第二套事实源
- Manifest／canonicalization：`mig01-a2/v1`、`c14n-v1`、exact shape、SHA-256 和低敏白名单
- 治理 Stage A：PR #804／#805 已完成 `main` 保护、Required Check 和 handoff
- 治理 Stage B：PR #807／#808 已完成 Runner、Port、Lease 低敏契约、合成测试、Runbook 和 handoff
- `main` 保护：`protected=true`、`strict=true`、`enforce_admins=true`、required approvals `0`
- Required Check：`最小架构与质量门禁`，App ID `15368`
- 保护边界：禁止 direct push、force push 和删除 `main`；无管理员 bypass
- Workflow：`.github/workflows/architecture-quality.yml`
- 检查器：`scripts/verify/architecture-quality.mjs`
- 架构规则：`AQ001`～`AQ007` 已进入 `main`

### 本地验收环境 Stage A 结果

- 本地验收容器：`zmtg-local-acceptance-pg`
- 网络边界：仅 `127.0.0.1:55432` 映射至容器 PostgreSQL
- 仓库 Journal：39 项，最新为 `0038_mig_01a1_institution_isolation_expand`
- 本地验收库 Journal：39 项，最新项内部匹配 0038
- Migration snapshot：到 `0026`，且不覆盖 A1
- `tenants` Shape：与仓库期望一致
- `tenants` 低敏计数：2
- A1 三表：`institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts` Shape 均与 0038／Schema 一致
- A1 三表低敏计数：均为 0
- 迁移前备份：`zmtg_clean_local_acceptance-pre-0038-20260730-124114`
- 迁移前隔离恢复验证：通过；Journal 38 严格匹配仓库前缀、`tenants` 为 2、A1 三表缺失
- 迁移后备份：`zmtg_clean_local_acceptance-post-0038-20260730-124114`
- 迁移后隔离恢复验证：通过；Journal 39 完整匹配 0038、`tenants` 为 2、A1 三表存在且为空、Catalog 与原验收库一致
- 备份状态：两个备份及其 hash／metadata 均保留，删除需独立授权
- 临时恢复数据库：两次验证后均已删除
- real Manifest：`real_manifest_missing`
- synthetic Manifest：`synthetic_contract_validation=pass`
- 只读 Repository Adapter：`readonly_adapter_unavailable`
- 真实 Runner dry-run：`real_environment_dry_run_unavailable`
- 本地数据库变更：只通过既有脚本应用仓库已有 0038 Migration；原数据库未 Restore
- 本轮未创建 Migration，未运行 `db:generate`、Seed、Reset、原数据库 Drop、Runner dry-run 或 `--execute`
- 执行 Lease／Migration Lease：均未签发

### 当前阻断与实施状态

- Stage A 已关闭：`journal_not_at_0038`、`schema_shape_missing`、`backup_recovery_point_missing`
- 仍阻断：`real_manifest_missing`、`readonly_adapter_unavailable`、`real_environment_dry_run_unavailable`
- A1 状态：仓库静态 Expand 已在固定本地验收环境应用到 0038；归属、Provisioning、回填、Enforce 和 Reader 放行均未因此完成
- A2 状态：治理决策、仓库硬门、Runner 基础、只读预检和本地就绪修复 Stage A 已完成；Stage B、Stage C、Stage D、A2-P1、A2-P2 均未启动
- 本次 handoff 的 Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package、lock 修改：0
- 正式平台服务端授权根：`缺失`
- 平台 Runtime／发布准入：`阻断`
- 七线业务综合完成度：约 25%（规划估算）
- 公共底座完成度：约 65%（规划估算）
- 正式发布：0/7

### 不变的 MIG 与发布门禁

- MIG-01 尚未关闭，内部顺序保持 A2 → BASE-02 → Writer → Audit／模板 → B → C → Reader
- Customers／Institution System Reader：等待 MIG-01C 与当前成员服务端双键上下文
- Care：等待 MIG-02
- Knowledge 正式 Reader：等待 MIG-03
- Conversations：等待 MIG-04
- Analytics 事实／确定性聚合：等待 MIG-05
- Analytics Snapshot／正式 Provider／五页 UI：等待 MIG-06 + AN-03C
- Workbench：最后接线，只消费正式 Provider
- API 路径政策：新实现默认 v1；旧七线非版本化端点仅允许逐路由薄兼容例外
- Migration metadata 门禁：`db:generate` 与 snapshot-diff Migration 继续阻断

### 唯一下一任务

- 任务编号：`V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B`
- 任务名称：MIG-01A2 只读 Repository Adapter 与 Context Policy
- 当前状态：Stage A 已收口；Stage B 尚未启动
- 启动边界：必须独立授权、冻结 Base、精确 runtime／测试范围、独立分支和独立 PR
- 当前未启动：只读 Adapter、Context Policy、Stage C、Stage D、Manifest 候选、真实 dry-run、执行 Lease／Migration Lease、A2-P1、A2-P2、BASE-02、Writer、Audit／模板、MIG-01B、MIG-01C、Reader、平台切片和机构端旧任务
- 权威架构：`docs/architecture/architecture-v2.md`
- 代码证据审计：`docs/architecture/architecture-v2-evidence-audit-20260728.md`
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
