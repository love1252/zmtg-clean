# 项目重构历史

## 2026-08-07：BASE-B5 跨 tenant Membership／Transfer 决策准入收口

- 决策准入 PR #1052 合并：`426a320957389b248c43e2f868a8feee1f7ca07c`；
- 独立审查 PR #1053 合并：`696c3541a013e703431485caed51c7880545f448`；
- XT01–XT08 完成 accepted / preplanning admission；
- XT09 因 retained revoked Binding、immutable tuple、no-delete 与 relation-orphan `1→0` 成功标准冲突而保持 blocked；
- XT10 随 XT09 保持 blocked；
- transfer orchestration 设计前置已准入，但 implementation/execution 未授权；
- 本轮未连接数据库，未执行 DDL、DML、Migration、Seed、FK VALIDATE、Membership/Binding 写入或 remediation；
- BASE-B5、BASE-02、Reader 和业务 Capability 继续关闭；
- 下一任务：BASE-B5 跨 tenant relation-orphan 终态处置分支与成功标准 ADR 决策。


## 2026-08-07：BASE-B5 目标 Scope 业务关联确认与跨 tenant 阻断收口

- 业务负责人确认当前 A2-P1 唯一已批准并落库 Scope 与已准入目标机构一致；
- 业务关联确认／阻断审计 PR #1049 合并：`5760a39d2167ed37cc1344b201422b19acb2aa6f`；
- 独立审查 PR #1050 合并：`5ee3674f37863aebe6a8de78722fee7d0fa10dbc`；
- A2-P1 Triplet canonical digest、Scope active、revision／version／approval shape：通过；
- historical orphan 与目标 Scope tenant 不一致；
- target tenant Membership 和同账号 target-tenant active Binding 均为 0；
- 当前 `rebind` transition 不能直接表示跨 tenant replacement；
- selected branch 仍为 `B5_DETERMINISTIC_REBIND`，但 execution ready 为 false；
- 未连接数据库，未执行 DDL、DML、Migration、Seed、FK VALIDATE 或重绑；
- BASE-B5、BASE-02、Reader 和业务 Capability 继续关闭；
- 下一任务：BASE-B5 跨 tenant Membership 权威决策与重绑语义准入。


## 2026-08-07：BASE-B5 确定性重绑权威依据准入

- 权威依据提交与初审 PR #1046 合并：`d5da4a409d728d6cf4b7263e96d9f489a68e2b86`；
- 独立准入审查 PR #1047 合并：`c86f879616d723888167d716ca0197f913e38e88`；
- authority evidence submitted／admitted：`1／1`；
- selected branch 更新为 `B5_DETERMINISTIC_REBIND`；
- BASE-B5 仍未完成；
- historical orphan remediation 仍未授权；
- live readonly reprobe required，尚未执行；
- 未连接数据库，未执行 Migration、DML、Seed 或 FK VALIDATE；
- Reader、业务 Capability 和 BASE-02 完成状态继续关闭。


## 2026-08-06：BASE-B5 无权威业务依据输入提交

- 输入与准入 PR #1043 合并：`712c2385d85844a4f1f4299dc956cd436dcf2aa9`；
- 独立审查 PR #1044 合并：`9dfdc8438d36046b42eb0435b48278b94f402cc8`；
- 输入表接收数量：1；
- authority evidence submitted／admitted：`0／0`；
- selected branch 继续为 `B5_KEEP_BLOCKED`；
- 未启动 live readonly reprobe；
- 未连接数据库，未执行 Migration、DML、Seed 或 FK VALIDATE；
- Reader、业务 Capability、BASE-B5 和 BASE-02 完成状态继续关闭。


## 2026-08-06：BASE-B5 仓库外权威业务依据提交契约

- 提交契约 PR #1040 合并：`93517235c307c86b22ded333bb741a788b2a6984`；
- 独立审查 PR #1041 合并：`71eb0162f901170a23e38b6efe1f9d89f58b4aa4`；
- contract/template 已 ready，空白模板不计为证据，当前提交／准入仍为 `0／0`；
- `B5_KEEP_BLOCKED`、Reader 关闭和 BASE-02 未完成状态保持不变；
- 未连接数据库，未执行 Migration、DML、Seed 或 FK VALIDATE。


## 2026-08-06：BASE-B5 historical orphan 权威处置决策门

- 权威决策 PR #1037 合并：`7171acc1ad603a00a840f3fbffc211556424544a`；
- 独立审查 PR #1038 合并：`ae1013d5836903fd3d5266f3050b92e5e0597199`；
- 本轮未收到仓库外权威业务依据，证据提交／准入为 `0／0`；
- 明确选择 `B5_KEEP_BLOCKED`；
- BASE-B5 已启动但未完成，remediation 继续未授权；
- 未连接数据库，未执行 Migration、DML、Seed 或 FK VALIDATE；
- Reader、业务 Capability 与 BASE-02 完成状态继续关闭。


## 2026-07-25

- 创建目录重构基线。
- 保存本地目录审计快照。
- 创建逐文件迁移矩阵。
- 建立交接文档与架构边界。
- 本轮未移动正式源码。
- 基线提交：`1613c4b320b185fb1ebe79dbc9899be4acca647d`

## 2026-07-25：第二阶段低风险资产

- 验证三组静态资源内容完全一致。
- 统一首页背景与两类品牌 Logo 的资源命名。
- 删除三份重复静态资源。
- 更新品牌资源映射和迁移矩阵。
- 生成脚本及数据分类报告。
- 未移动业务模块。

## 2026-07-25：第三阶段脚本入口与实现分层

- 保留测试服务器部署脚本的稳定入口。
- 部署实现下沉至 `scripts/deploy/`。
- 保留 Node 运行时解析脚本的稳定入口。
- 运行时实现下沉至 `scripts/runtime/`。
- 新增脚本目录说明。
- 未修改 package、锁文件、数据库或业务模块。

## 2026-07-25：第四阶段运行与测试命令入口分层

- 保留 Next.js 命令的稳定入口。
- Next.js 实现下沉至 `scripts/runtime/`。
- 保留 Vitest 命令的稳定入口。
- Vitest 实现下沉至 `scripts/testing/`。
- 更新脚本目录说明和迁移矩阵。
- 未修改依赖配置、数据库或业务模块。

## 2026-07-26：第五阶段 Demo、Mock、Fixture、Seed 调用关系审计

- 复核第二阶段列出的 44 个候选文件。
- 生成逐文件引用关系、运行时可达性和风险清单。
- 更新迁移矩阵中的 44 条审计记录。
- 所有候选均标记为本阶段不移动。
- 未修改源码、脚本、依赖配置、数据库或运行时行为。

## 2026-07-26：第六阶段历史文档与纯测试文件归属确认

- 确认 14 个历史文档的文档职责归属。
- 确认 11 个纯测试文件的模块或脚本目录归属。
- 生成 25 个候选的逐文件归属清单。
- 更新迁移矩阵中的 25 条归属确认记录。
- 25 个候选均保留当前位置，本阶段未移动文件。
- 未修改源码、测试内容、数据库或运行时行为。

## 2026-07-26：第七阶段模块 Mock 运行时与测试调用边界审核

- 审核 5 个开放平台模块 Mock 候选。
- 区分运行时值依赖、运行时类型依赖和测试值依赖。
- 确认 4 个运行时受控样例 Provider。
- 确认 1 个运行时类型契约来源与测试值样例。
- 更新迁移矩阵中的 5 条边界确认记录。
- 5 个候选均保留当前位置，本阶段未移动文件。

## 2026-07-26：第八阶段运行时 Demo 边界复核

- 审核 11 个原运行时 Demo 候选。
- 依据当前调用证据确认 10 个运行时边界。
- 将 1 个过时运行时标记重分类为仅测试调用的休眠领域 Mock。
- 确认 API 路由职责 2 个。
- 确认认证职责 2 个。
- 确认领域职责候选 5 个。
- 确认服务职责 2 个。
- 更新迁移矩阵中的 11 条边界记录。
- 11 个候选均保留当前位置，本阶段未移动文件。

## 2026-07-26：第九阶段 Demo 脚本与 Seed 安全边界审核

- 审核最后 3 个第五阶段候选。
- 确认 Demo CLI 默认 dry-run，并在写入或清理前执行内部守卫。
- 确认数据库 Seed 入口在创建 Client 前执行核心 Seed Guard。
- 确认核心 Seed Guard 只允许 loopback、本地目标和固定人工确认。
- 记录 Demo CLI 地址策略比核心 Seed Guard 更宽的治理风险。
- 第五阶段 `audit_completed` 候选归零。
- 未执行 Seed、Migration、数据库连接或真实数据写入。
- 3 个候选均保留当前位置，本阶段未移动文件。

## 2026-07-26：第十阶段目录重构阶段性闭环审计

- 核对第一至第九阶段重构记录。
- 确认第五阶段 44 个候选由第六至第九阶段完整覆盖。
- 确认第五阶段 `audit_completed` 剩余数量为 0。
- 生成迁移矩阵状态计数。
- 生成目录重构遗留风险登记。
- 确认第一轮盘点、低风险整理和边界审核阶段性闭环。
- 未修改迁移矩阵原记录。
- 未移动源码、API、Seed 或数据库文件。

## 2026-07-26：第十一阶段 API 路径版本化治理规划

- 纳入 91 个 `API_VERSION_REVIEW` 候选。
- 明确 91 个 `API_VERSION_REVIEW` 候选不等于全仓 API，并补充全仓路由范围对照。
- 区分版本化和非版本化 API 路径。
- 按去除版本号后的路径建立路由族。
- 识别精确版本化／非版本化重叠族。
- 记录仓库内运行时、测试和脚本调用方证据。
- 建立 API 兼容、弃用、观测和回退准入条件。
- 未修改迁移矩阵。
- 未移动或修改任何 API 文件。

## 2026-07-26：第十二阶段全仓 API 路由分类补全审计

- 将全仓 145 个 `route.ts` 纳入统一分类。
- 确认版本化路由 56 个、非版本化路由 89 个。
- 确认第十一阶段候选内路由 88 个。
- 识别候选范围之外的分类缺口 57 个。
- 缺口包含 56 个版本化路由和 1 个非版本化路由。
- 建立全仓版本化／非版本化路由族对照。
- 生成 57 条迁移矩阵分类修改建议。
- 未修改迁移矩阵。
- 未移动或修改任何 API 文件。

## 2026-07-26：第十三阶段 API 矩阵分类建议审核

- 审核第十二阶段 57 条分类建议。
- 批准 55 条 action-only 迁移矩阵候选。
- 保留 2 条既有运行时边界结论。
- 确认唯一重叠族为 `/api/open-platform/tenants`。
- 确认两个入口分别承担 GET 读取和 POST 创建职责。
- 确认两个入口不是行为等价兼容别名。
- 未修改迁移矩阵。
- 未移动或修改任何 API 文件。

## 2026-07-26：第十四阶段 API 版本治理矩阵动作应用

- 应用 55 条审核通过的矩阵动作修改。
- 仅将 `recommended_action` 从 `KEEP_REVIEW` 修改为 `API_VERSION_REVIEW`。
- 修改前 `API_VERSION_REVIEW` 为 91 条。
- 修改后 `API_VERSION_REVIEW` 为 146 条。
- 风险、阶段、状态、目标路径、人工审核要求和 notes 均保持不变。
- 两条运行时边界记录保持原动作和状态。
- 未新增或删除迁移矩阵记录。
- 未修改或移动任何 API 文件。
- 未修改 API 源码。

## 2026-07-26：第十五阶段 API 版本治理辅助标记方案规划

- 确认两条运行时边界记录需要非覆盖式 API 版本治理标记。
- 拒绝覆盖主 `recommended_action`。
- 拒绝使用复合动作字符串。
- 暂缓修改 1509 行迁移矩阵结构。
- 推荐独立 sidecar 辅助标记注册表。
- 建议标记为 `api_version_governance=review_required`。
- 本阶段未创建正式辅助标记注册表。
- 未修改迁移矩阵。
- 未修改或移动任何 API 文件。

## 2026-07-26：第十六阶段正式 API 版本治理辅助标记注册表

- 创建 `docs/refactor/api-version-governance-auxiliary-markers.csv`。
- 首次登记 2 条运行时边界记录。
- 固定标记为 `api_version_governance=review_required`。
- 标记权威级别为 `supplemental_non_overriding`。
- 主动作和主状态均保持不变。
- 未修改迁移矩阵。
- 未修改或移动任何 API 文件。
- PR #759 已合并。
- 合并提交：`f5802888ec70c1fc02e21b2938de0d740411c933`。

## 2026-07-26：第十七阶段交接更新与后续路线图固化

- 更新 `CURRENT_STATUS.md`。
- 更新 `NEXT_TASK.md`。
- 更新 `RELEASE_HISTORY.md`。
- 创建第十七至第三十一阶段目录重构路线图。
- 明确最终完成不等于移动全部文件，
  已确认归属并保留当前位置也可视为闭环。
- 明确数据库、Schema、Migration 和 Seed 继续保持保护边界。
- 本阶段未修改迁移矩阵、API 或正式业务源码。

## 2026-07-26：第十八阶段 API 调用方与兼容策略基线

- 覆盖全仓 145 个 `route.ts` 和 144 个路由族。
- 保持 146 条主治理候选和 2 条辅助标记可追溯。
- 生成 145 条逐路由兼容基线。
- 生成 144 条路由族兼容基线。
- 生成 148 条治理候选追踪记录。
- 建立五类兼容策略、最低观测、退役和回退要求。
- 第十九阶段只推荐一个相对低风险试点：
  `/api/institution/wecom-official-dry-run`。
- 未修改迁移矩阵。
- 未修改或移动任何 API 文件。
- 未改变运行时行为。

## 2026-07-26：第十九阶段 WeCom official dry-run API 试点设计

- 唯一路由族：`/api/institution/wecom-official-dry-run`。
- 建议目标：`/api/v1/institution/wecom-official-dry-run`。
- 采用直接 re-export 旧 `GET` 的兼容方案。
- 旧入口继续保留，不设置 sunset 日期。
- 明确第二十阶段 5 个文件白名单。
- 未修改 API、调用方或迁移矩阵。
- 未改变运行时行为。

## 2026-07-26：第二十阶段 WeCom official dry-run v1 兼容入口试点实施

- 新增版本化入口：`/api/v1/institution/wecom-official-dry-run`。
- 新路由直接 re-export 旧 `GET`。
- 新旧入口保持同一函数引用。
- 旧入口 `/api/institution/wecom-official-dry-run` 保持原样并继续可用。
- 固定低敏 `503`、响应 JSON 和 `Cache-Control=no-store` 保持不变。
- 新增独立兼容契约测试。
- 未修改旧路由、现有测试或调用方。
- 未修改迁移矩阵、Schema、Migration、package 或锁文件。
- 未连接数据库或真实外部服务。
- 本阶段只实施一个路由族。

## 2026-07-26：第二十一阶段 API 试点闭环与后续批次计划

- 第二十阶段单一路由族试点闭环通过。
- 全仓 `route.ts` 实测为 146。
- 版本化路由 57，
  非版本化路由 89。
- 路由族 144，
  精确重叠族 2。
- 形成 10 条试点契约复核记录。
- 形成 5 条 API 数量变化记录。
- 形成 143 条剩余路由族批次计划。
- 严格可复制试点模式候选为 0。
- 需要客户端迁移 64，观测后退役 2，
  保持当前 54，人工阻断 23。
- 旧入口继续保留，未授权退役。
- 未修改 API、调用方或迁移矩阵。
- 未实施第二个路由族。

## 2026-07-26：第二十二阶段机构端职责与依赖图审计

- 审计 `src/modules/institution/` 共 323 个文件。
- 形成 1325 条内部及跨模块依赖边。
- 跨模块内部依赖边 384 条。
- 反向依赖边 4 条。
- 循环依赖组 2 个，涉及文件 8 个。
- 识别领域所有者 14 个。
- 基础纯领域／纯类型安全候选文件 22 个。
- 第二十三阶段唯一候选：
  `src/modules/institution/domain/appointments.ts`。
- 建议目标：`src/modules/institution/domain/appointment/appointments.ts`。
- 候选确认为纯领域空态模型，不是纯类型文件。
- 选择层级：`B_pure_domain_with_existing_tests`。
- 未修改机构端源码、API 或迁移矩阵。
- 未连接数据库或真实外部服务。

## 2026-07-26：第二十三阶段机构端预约空态领域模型试点

- 将 `src/modules/institution/domain/appointments.ts` 移动至
  `src/modules/institution/domain/appointment/appointments.ts`。
- 移动前后 blob 均为 `d5d88fcc24bec0a92c09223e5da4a329a462676f`。
- 3 个 type 与 2 个运行时空数组 export 保持不变。
- 唯一直接调用方 `src/modules/institution/tests/InstitutionBusinessDomain.test.ts` 仅修正 import。
- 旧源码 import 已归零，新源码 import 恰好 1 个。
- 候选内部 import 为 0，未新增循环依赖或反向依赖。
- 正式业务源码累计移动 1 个。
- 未修改 API、数据库、权限、租户隔离或错误响应。
- 未修改 `file-migration-matrix.csv`。
- 未实施第二个机构端候选。

## 2026-07-26：第二十四阶段机构端套餐额度只读服务边界试点

- 先完成实施前预检：
  `docs/refactor/phase-24-institution-service-pilot-preflight.md`。
- 精确白名单：
  `docs/refactor/phase-24-institution-service-pilot-allowed-files.csv`。
- 将 `src/modules/institution/server/package-ai-quota-readonly-source.ts` 移动至
  `src/modules/institution/entitlement/package-ai-quota-readonly-source.ts`。
- 移动前后 blob 均为 `177ad4c2d5ef7fb849d955996755beba12b3cc0f`。
- 4 个 type 与 6 个 function export 保持不变。
- 候选唯一 import 继续指向机构端套餐额度 domain 契约。
- 运行时调用方 `src/modules/institution/server/institution-ai-service-usage.ts` 仅修正 import。
- 直接测试 `src/modules/institution/tests/PackageAiQuotaReadonlySource.test.ts` 仅修正 import。
- 旧源码 import 已归零，新源码 import 恰好 2 个。
- 跨模块出向依赖为 0，未新增循环依赖或反向依赖。
- 正式业务源码累计移动 2 个。
- 未修改 API、数据库、权限、租户隔离或错误响应。
- 未修改 `file-migration-matrix.csv`。
- 未实施第二个服务候选。

## 2026-07-26：第二十五阶段机构端阶段闭环

- 完成第二十二至第二十四阶段闭环审计：
  `docs/refactor/phase-25-institution-stage-closeout.md`。
- 生成 323 条机构端治理分类：
  `docs/refactor/phase-25-institution-remaining-classification.csv`。
- 生成两个试点追溯表：
  `docs/refactor/phase-25-institution-pilot-traceability.csv`。
- 生成非阻断 backlog：
  `docs/refactor/phase-25-institution-nonblocking-backlog.csv`。
- 已完成试点：2。
- 可迁移：22。
- 保持当前位置：195。
- 保护边界：96。
- 延期处理：8。
- 剩余文件：321。
- 未分类文件：0。
- 正式业务源码累计移动 2 个。
- 本阶段未修改或移动 `src/` 文件。
- 未修改 API、迁移矩阵、Schema、Migration、package 或锁文件。
- 机构端剩余项不阻断第二十六阶段开放平台审计。

## 2026-07-26：第二十六阶段开放平台职责与依赖图

- 只读审计 `src/modules/open-platform/`。
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
- 第二十七阶段唯一候选：`src/modules/open-platform/domain/tenant-plan-change.ts`。
- 建议目标：`src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`。
- 候选 blob：`59c7d6bed836ed8b56cc0376b3203b156c41eb88`。
- 未修改或移动 `src/` 文件。
- 未修改 API、迁移矩阵、Schema、Migration、package 或锁文件。
- 第二十七阶段试点未授权。

## 2026-07-26：第二十七阶段开放平台商业权益领域试点

- 纯移动：
  `src/modules/open-platform/domain/tenant-plan-change.ts`
  → `src/modules/open-platform/domain/commercial_entitlement/tenant-plan-change.ts`。
- 移动前后 blob：`59c7d6bed836ed8b56cc0376b3203b156c41eb88`。
- 候选 import：1 个 type-only。
- type export：4。
- function export：3。
- 直接调用方：4。
- 直接测试：1。
- 旧 import：0。
- 新 import：4。
- 未新增跨模块依赖、循环依赖或反向依赖。
- 未修改 API、迁移矩阵、Schema、Migration、package 或锁文件。
- 正式业务源码累计移动 3 个。
- 下一阶段为第二十八阶段开放平台阶段闭环。

## 2026-07-27：第二十八阶段开放平台阶段闭环

- 只读复核第二十六至第二十七阶段。
- 开放平台文件基线：186。
- 已完成试点：1。
- 可迁移：1。
- 保持当前位置：27。
- 保护边界：156。
- 延期处理：1。
- 剩余文件：185。
- 未分类文件：0。
- 第二十七阶段试点 blob、import、export、调用方、测试和回退证据可追溯。
- 未修改或移动 `src/` 文件。
- 未修改 API、迁移矩阵、Schema、Migration、package 或锁文件。
- 正式业务源码累计移动 3 个。
- 下一阶段为第二十九阶段下一模块选择与审计启动决策。
- 动态模块路径补扫：规范化已移动源路径后，确认 25 个遗漏依赖对，影响 11 个开放平台目标文件。
- 机器证据修正：PR #772 已合并（merge commit `54520f62dd3c3c7c7d7c9bc7e63de0a68571296b`），已修正移动文件新旧路径的重复消费者计数。

## 2026-07-27：第二十九阶段跨模块职责重新对齐

- 完成知识库与工作台、客户与随访、页面与领域、公共类型与共享服务四类跨模块链路统一审计。
- 去重后依赖边 501 条，覆盖 7 个模块对。
- 排除伪循环后未发现安全试点候选。
- 决策：`no_safe_candidate`。
- 本阶段未修改或移动正式源码。

## 2026-07-27：第三十阶段遗留安全治理闭环

- Demo Seed CLI 已统一复用核心 Seed Guard。
- Demo 认证测试已按当前数据库 Mock、显式 scope 和真实 Session 结构治理。
- 修复平台 Demo 登录与真实 Demo Session 恢复链路。
- R06、R07 已解决；R08 已解释为受治理的后续审计输入。
- 原迁移矩阵保持只读。
- 第三十阶段已闭环。

## 2026-07-27：第三十一阶段最终目录重构闭环审计

- 审计 Git 跟踪文件 1528 个，`src/` 文件 959 个。
- 复核原迁移矩阵 1509 条。
- 核对 3 个正式业务源码迁移、旧路径、内部 import、循环依赖、重复运行时文件、孤立候选、交接入口和 R01—R08 证据。
- 初始自动发现项：17；逐项复核后真实阻断为 0。
- 最终决策：`closed`；目录重构总任务：`completed`。
- 本阶段只修改审计、架构、交接和发布历史 Markdown 文档。
- 未修改生产源码、测试、脚本、配置、原迁移矩阵、Schema、Migration、package 或锁文件。


## 2026-07-27：架构 V2 第一阶段统一基线

- 在已完成的目录治理基础上启动独立的架构 V2 演进计划。
- 冻结最终逻辑结构、当前到目标模块映射和旧目录写入政策。
- 将机构端七线按“领域 → 持久化／权威 reader → API → 页面 → 权限审计 → capability → 验收”重新建立完成尺度。
- 固定 MIG-02～MIG-06 串行队列。
- 固定 `institution` 不再新增业务事实、`open-platform` 不再新增跨领域巨型文件。
- 固定 HIS、企业微信、AI、Excel 和 webhook 进入 `src/integrations/`。
- 正式发布保持 0/7。
- 本阶段未修改 runtime、Schema、Migration、package 或锁文件。

## 2026-07-28：架构 V2 文档第一阶段收口

- PR #782：架构代码证据审计与文档顺序校准。
- PR #783：`V2-ARCH-DOCS-01`。
- PR #783 merge commit：`47136da59c5d4cfe7a8727f4f8c2c1d12a547213`。
- 新增架构索引、业务架构和应用架构。
- runtime、Schema、Migration 修改均为 0。
- 下一阶段为 `V2-ARCH-DOCS-02` 数据架构、软件架构与部署架构建设。

## 2026-07-28：架构 V2 文档第二阶段收口

- PR #784：收口 `V2-ARCH-DOCS-01` 并切换至 `V2-ARCH-DOCS-02`。
- PR #784 merge commit：`5ceb3eb69f2d755c2ec20a4414c8d57c5ebd4961`。
- PR #785：`V2-ARCH-DOCS-02`。
- PR #785 merge commit：`1159be40e25e4a36639731c81fedf826bc26e479`。
- 新增数据架构、软件架构和部署架构。
- runtime、Schema、Migration 修改均为 0。
- 下一阶段为 `V2-ARCH-DOCS-03` 开发架构、项目入口与状态同步。

## 2026-07-28：架构 V2 文档第三阶段与治理收口

- PR #786：DOCS-02 收口、Codex 主开发与中文优先治理。
- PR #786 Merge Commit：`27ff132dd850dba790bc1d7c2e6776b882722b5d`。
- PR #787：`V2-ARCH-DOCS-03`。
- PR #787 Merge Commit：`401a4fc5522c2ab6ca4dfe00791817ae1534360c`。
- 新增开发架构。
- 根 README 已重写为项目入口。
- 六类架构视图完成 `6/6`。
- Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-02B-MIG01-CLOSURE-PREFLIGHT`；本次只完成 handoff，尚未启动该任务。

## 2026-07-28：V2-02B MIG-01 关闭预检收口

- PR #788：DOCS-03 交接收口并切换至 V2-02B。
- PR #788 Merge Commit：`1d2691a60fd021af815a7449af8c5c1b33d8d274`。
- PR #789：V2-02B MIG-01 完整关闭链静态预检。
- PR #789 Merge Commit：`af9393d15bbfb10391576640a01f9bd5e57f1206`。
- MIG-01A1 仓库静态证据已具备，A2 缺失，BASE-02 部分具备，Writer、Audit／模板、B、C、Reader 均为阻断。
- Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-02C-PLATFORM-AUTH-ROUTE-PREFLIGHT`。
- 平台授权 Runtime、Architecture／Quality CI、MIG-01A2 和机构端旧任务均未启动。

## 2026-07-28：V2-02C 平台授权与路由族预检收口

- PR #790：V2-02B 交接收口并切换至 V2-02C。
- PR #790 Merge Commit：`677177d8551546ed7142aaffb07f911c43ad095c`。
- PR #791：V2-02C 平台正式授权与路由族静态预检。
- PR #791 Merge Commit：`99560c98faa987ecf79e66d18a4df1aa76d77c9e`。
- 正式平台服务端授权根为 `缺失`，平台 Runtime／发布准入为 `阻断`。
- Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-QUALITY-CI-01-MINIMUM-ARCHITECTURE-QUALITY-GATE`。
- 七个平台候选实施切片、MIG-01A2 和机构端旧任务均未启动。

## 2026-07-29：V2-QUALITY-CI-01 最小架构与质量门禁收口

- PR #792：收口 V2-02C 并切换至最小架构质量 CI。
- PR #792 Merge Commit：`37c42129ceccad4dcd1680a80214df7ea92348f0`。
- PR #793：修复质量门禁前置测试基线。
- PR #793 Merge Commit：`d451486804e9405659424006ca5f1bc58c43b42a`。
- PR #795：修复 Node 20 与 CI 运行器测试基线。
- PR #795 Merge Commit：`6bf4ed5b414984ad22eb3af1eb6e0c6c32770afa`。
- PR #794：建立最小架构与质量门禁。
- PR #794 Merge Commit：`f9f948d00687fa4311e625cd51c9453d87ad0820`。
- 最小增量架构检查、检查器自测及现有 lint、typecheck、完整测试、build 质量命令编排已经建立。
- GitHub Actions Run `30386375532`／Job `90366597304` 在 PR #794 Head `836465f169104e6f5943ca076d0b98b1bfde2b94` 上完成，结论为 `success`。
- PR #794 新增或修改五个质量基础设施文件，业务源码、API、UI、Schema、Migration 修改为 0。
- 本次 handoff 文档回填的 Runtime、Schema、Migration 修改均为 0。
- GitHub 只读核对结果为 `main.protected=false`，branch API 当前无可验证的 Required Check 强制；本轮未修改仓库设置。
- 唯一下一任务为 `V2-MIG01-A2-PROVISIONING-PREFLIGHT-01`；本次只完成 handoff，尚未启动 A2 实施。

## 2026-07-29：MIG-01A2 Provisioning 静态预检收口

- PR #796：收口质量 CI 并切换至 A2 预检。
- PR #796 Merge Commit：`bebdd3afca9773b4ac9764572a4372349440ea10`。
- PR #797：MIG-01A2 Provisioning 静态预检。
- PR #797 Merge Commit：`d9a47773cb4914b0f0534093f5c8f47f6516b9d6`。
- A1 仅具备静态 Expand。
- A2 Provisioning 缺失且启动受阻。
- Owner、Manifest、输入承载、Metadata、唯一 Migration lease 和仓库硬门尚未关闭。
- Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-MIG01-A2-DECISION-PACK-01` A2 关键决策包。
- A2-P1、A2-P2 和下游任务均未启动。

## 2026-07-29：MIG-01A2 关键决策接受与治理基础切换

- PR #798：收口 MIG-01A2 预检并切换至关键决策包。
- PR #798 Merge Commit：`5fbeffbbbb89b2d39eaf4fc40101edbfbb12ee75`。
- PR #800：修复平台知识库问答审计异步测试竞态。
- PR #800 Merge Commit：`65b6049243adc63ada41f5c6b09d112451ec1fc5`。
- PR #799：提交 MIG-01A2 Owner 与实施门禁 proposed decision pack。
- PR #799 Merge Commit：`1438894dd07a68cf767b49207795388b0bc814a6`。
- `docs/decisions/mig01-a2-provisioning-decision-pack.md` 已合并并继续保留为 proposed 决策材料。
- 用户已接受 D01-A、D02-A、D03-A、D04-A、D05-A、D06-B、D07-B、D08-C、D09-A、D10-B、D11-B 和 D12-A（方向）。
- D12 只接受最小 Anchor Bridge 方向；精确名称、列序、Catalog Shape、编号、锁／timeout 和目标环境后置。
- 本次 accepted 决策与 handoff 的 Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-MIG01-A2-GOVERNANCE-FOUNDATION-01` MIG-01A2 仓库硬门与受控 Runner 治理基础。
- 仓库硬门、Required Check、Runner、Runbook、Lease、真实 Manifest、环境核验、A2-P1 和 A2-P2 均未启动。

## 2026-07-30：MIG-01A2 Stage A 仓库硬门完成并切换至 Stage B

- PR #801：记录 MIG-01A2 accepted 决策。
- PR #801 Head：`2a62d65393b4f96a3ead7ec6daeed5708f5a2b62`。
- PR #801 Merge Commit：`56638dc3595d7bd60a47b08810c50df256d0b87c`。
- PR #804：配置并验证 `main` 仓库硬门。
- PR #804 Head：`1948597d5349017485578723fd32535e84e2bd97`。
- PR #804 Merge Commit：`97a21fa6ba8517a9d5dd5ab28e90670b371e52cb`。
- Stage A 验证文档：`docs/verification/github-main-hard-gate-validation-20260730.md`。
- Required Check Context：`最小架构与质量门禁`。
- Required Check App：ID `15368`／slug `github-actions`。
- 最终保护：`main.protected=true`、`strict=true`、`enforce_admins=true`、required approvals `0`、禁止 force push、禁止删除、未启用 Linear History、无管理员 bypass。
- 普通 direct push、显式 force-with-lease 和删除受保护分支均被 GitHub 服务端拒绝，临时探针已清理。
- Negative Run／Job：`30481398548`／`90676107324`，预期因 `AQ001_SECOND_DATABASE_ROOT` 失败并阻断合并。
- Final Positive Run／Job：`30482219056`／`90678924630`，冻结 Head 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- Stage A 只新增低敏验证 Markdown；Runtime、Schema、Migration、CI、package、lock 修改均为 0。
- Stage B、Runner、真实 Manifest、真实 Lease、A2-P1 和 A2-P2 均未启动。
- 唯一下一任务为 `V2-MIG01-A2-GOVERNANCE-FOUNDATION-01-STAGE-B`：MIG-01A2 受控 Runner 治理、Runbook 与实现。

## 2026-07-30：MIG-01A2 Stage B Runner 治理基础完成并切换至只读环境预检

- PR #804 完成 Stage A 仓库硬门配置与验证，Head `1948597d5349017485578723fd32535e84e2bd97`，Merge Commit `97a21fa6ba8517a9d5dd5ab28e90670b371e52cb`。
- PR #805 完成 Stage A handoff；首轮 Run `30504427490`／Job `90750966473` 暴露既有开放平台知识库安全错误异步断言竞态，该失败不属于 Stage A 硬门或四份 handoff 文档缺陷。
- PR #806 独立修复上述既有测试竞态，Head `6f2dac34e4a74ee9e62c67444c0afc88d3185971`，Merge Commit `08acc2f0b5f6a10df5e7adde457c050c10bd79dd`，Run `30505183208`／Job `90753276031` 成功。
- PR #805 在四份文档内容不变的前提下重放到 PR #806 合并后的 `main`，最终 Head `5d5c4e746f9de079088f62bb8585c1856e9f0a44`，Run `30505641202`／Job `90754678015` 成功，Merge Commit `c52fef48e71f760017c8e39909b610ae6de180d8`。
- PR #807 基于 Stage A handoff main `c52fef48e71f760017c8e39909b610ae6de180d8` 建立 MIG-01A2 受控 provisioning Runner 治理基础，Head `d7abdc52c64be367b988db15bfbdaa251be33fd4`，Merge Commit `e50999ebc33dd07a4447fa8f9274e974e9beae63`。
- PR #807 精确修改 12 个文件：1 个 Runbook、1 个 package 命令、2 个 `scripts/db` Runner 文件、5 个 Tenancy provisioning 源文件和 3 个契约／内核测试文件。
- Manifest 版本为 `mig01-a2/v1`；canonicalization 版本为 `c14n-v1`，采用固定位置数组、UTF-8 稳定排序与 SHA-256，固定 digest 向量为 `sha256:a42fda705e6256a3fd36d74f2d243f27fefcb19dc0ad63c3a00970d42d16de1a`。
- dry-run 只产生 `input`、`insertedCandidate`、`reusedCandidate`、`conflict`、`unexpected` 五项低敏守恒计数；Repository／Transaction Port、原子写入顺序、提交前重检、回滚与并发漂移封堵已建立。
- Lease 版本为 `mig01-a2-execution-lease/v1`，只实现低敏契约和 Authority Port；未签发真实执行 Lease／Migration Lease。
- Stage B 本地定向 4 个文件、63 个测试通过；完整 412 个文件、5742 个测试通过；lint、typecheck、build 101/101、`git diff --check` 与增量架构检查全部通过。
- PR #807 Required Check Run `30508177604`／Job `90762357307` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部实际执行并成功。
- Stage B 未读取真实 Manifest、未连接数据库、未对真实环境执行 Runner、未签发真实 Lease、未执行 A2-P1；Schema、Migration、journal、snapshot 修改均为 0，`pnpm-lock.yaml` 未修改，新增依赖为 0。
- `main` 保护和 Required Check 继续生效；全部 `backup/*` 保留。
- 唯一下一任务为 `V2-MIG01-A2-ENVIRONMENT-MANIFEST-READONLY-PREFLIGHT-01`：真实 Manifest、环境 Journal、数据库 Shape、备份恢复点与 Dry-run 只读预检。
- 下一任务尚未启动，仍需独立授权；只读、不提交事务、不执行 P1、不创建 Migration、不签发执行 Lease，也不自动进入 A2-P1。

## 2026-07-30：MIG-01A2 只读预检收口并切换至本地就绪修复

- PR #808 完成 Stage B handoff，Merge Commit `3fe7d0991fa9d530410261270e70c9af46215222`。
- PR #809 完成 Mac 本地验收环境只读预检，Head `7ccd75a9fd20e48d424920c7545d3b8d99838cf6`，Merge Commit `e6b0a23ba3b30003f0327493b350a1929030e4fc`。
- PR #809 Required Check Run `30511790906`／Job `90773241559` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- 仓库 Journal 共 39 项且最新为 0038；localhost 本地验收库只有 38 项，未到 0038。
- `tenants` Shape 与仓库期望一致且低敏计数为 2；A1 三表缺失，缺失表计数未伪报为 0。
- real Manifest 缺失，synthetic validation 通过，CLI 以 `runner_context_policy_unavailable` fail-closed。
- 正式 backup recovery point 缺失，只读 Repository Adapter 缺失，真实 Runner dry-run 不可用。
- PR #809 和本次 handoff 的 Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01`：MIG-01A2 本地验收环境基线、Adapter、Manifest 候选与 Dry-run 就绪修复。
- 当前只冻结由四个独立原子阶段组成的大目标；备份、Migration、Adapter、Manifest、真实 dry-run、A2-P1 和 A2-P2 均未启动。

## 2026-07-30：MIG-01A2 本地就绪修复 Stage A 完成并切换至 Stage B

- PR #810 完成本地环境只读预检 handoff，Head `e2921c4f5951bb9128640cf044688d753a1eaea2`，Merge Commit `16363eb4093e72fdd8371821c12df363d624ee86`，Run `30513347110`／Job `90777852238` 成功。
- PR #811 完成固定 localhost-only 本地验收库的 Stage A 基线与恢复点证据，Head `50b007820b7fdb68ff35b6ef0e2a53b9e8e61880`，Merge Commit `fc08de343456a1f0d05092f1aedd389118b32b26`。
- PR #811 Required Check Run `30514884226`／Job `90782386213` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- 本地验收容器保持为 `zmtg-local-acceptance-pg`，只绑定 `127.0.0.1:55432`；没有连接测试服务器、生产数据库或业务外部环境。
- 本地验收库 Journal 由 38 推进到 39，最新项内部匹配 `0038_mig_01a1_institution_isolation_expand`。
- `tenants` 低敏计数迁移前后均为 2；`institution_scopes`、`institution_operating_context_versions`、`institution_operating_contexts` Shape 与 0038／Schema 一致且均为空。
- 迁移前备份 `zmtg_clean_local_acceptance-pre-0038-20260730-124114` 已完成隔离恢复验证。
- 迁移后备份 `zmtg_clean_local_acceptance-post-0038-20260730-124114` 已完成隔离恢复验证；两个备份继续保留，删除需独立授权。
- `journal_not_at_0038`、`schema_shape_missing`、`backup_recovery_point_missing` 三项本地环境阻断已关闭。
- 本阶段只对本地验收环境应用仓库既有 0038；仓库 Runtime、Schema、Migration 修改均为 0，没有创建新 Migration，没有运行 `db:generate`、Seed、Reset 或 Runner dry-run。
- `real_manifest_missing`、`readonly_adapter_unavailable`、`real_environment_dry_run_unavailable` 仍未关闭。
- 唯一下一任务为 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-B`：MIG-01A2 只读 Repository Adapter 与 Context Policy。
- Stage B、Stage C、Stage D、Manifest 候选、真实 dry-run、Lease、A2-P1 和 A2-P2 均未启动。

## 2026-07-30：MIG-01A2 本地就绪修复 Stage B 完成并切换至 Stage C

- PR #812 完成 Stage A handoff，Head `ea716f56ec2ec9619d6cd1e54dcb1d0fd6059faf`，Merge Commit `63a6ddff4fe192b0aa01c40f72dc45317889291a`，Run `30516545750`／Job `90787584951` 成功。
- PR #813 独立修复治疗摘要入口异步断言竞态，Head `3243456aa65bc0a47df2b74711d78b27e9afdb20`，Merge Commit `40836d26f79a127b5958533b65f955faa970dfcd`，Run `30516129057`／Job `90786236239` 成功；该测试修复不属于 Stage B 六文件业务范围。
- PR #814 完成本地验收 Context Policy、只读 PostgreSQL Adapter、测试、Runbook 与 Stage B 证据报告，Head `c5ad29e2775789cc28b47e0724f64e165b0eff9e`，Merge Commit `19f2dbe55799e533e609c7cece9eaad1b623babd`。
- PR #814 Required Check Run `30519856557`／Job `90797620311` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- Stage B 精确六文件：
  1. `docs/operations/mig01-a2-local-readiness-stage-b-20260730.md`
  2. `docs/operations/mig01-a2-provisioning-runbook.md`
  3. `src/modules/tenancy/provisioning/provisioning-context-policy.ts`
  4. `src/modules/tenancy/provisioning/server/provisioning-readonly-postgres-adapter.ts`
  5. `src/modules/tenancy/provisioning/tests/ProvisioningContextPolicy.test.ts`
  6. `src/modules/tenancy/provisioning/tests/ProvisioningReadonlyPostgresAdapter.test.ts`
- Context Policy version 为 `mig01-a2-local-acceptance-context-policy/v1`，目标环境只允许 `local_acceptance`，timezone 只允许 `Asia/Shanghai`，currency 只允许 `CNY`。
- 只读 Adapter 位于 Tenancy 模块，只访问 `public.tenants`、`public.institution_scopes`、`public.institution_operating_context_versions` 和 `public.institution_operating_contexts`。
- 所有读取使用 `REPEATABLE READ + READ ONLY`；statement timeout `5s`、lock timeout `1s`、idle transaction timeout `5s`，connect timeout `5s` 由调用方 client 负责；写方法永久拒绝，数据库错误只映射为固定低敏错误。
- Context Policy 23 个测试、Adapter 26 个测试、Stage B 新增 49 个测试、Provisioning 定向契约集 6 文件／112 个测试全部通过；完整测试 414 文件／5791 个通过，build 101／101。
- localhost-only smoke 结果为 `local_readonly_adapter_smoke=pass`；前后 Journal 均为 39、`tenants` 均为 2、三个 A1 表均为 0，没有数据库写入或业务数据变化。
- PR #814 新增两个 Tenancy Runtime 文件和两个测试文件；Schema、Migration、journal、snapshot、CI、package、lock、业务 API／UI 与新增依赖修改均为 0。
- 本次四文件 handoff 的 Runtime、Schema、Migration、scripts、tests、CI、package 和 lock 修改均为 0。
- `readonly_adapter_unavailable` 已关闭；`real_manifest_missing` 与 `real_environment_dry_run_unavailable` 继续阻断。当前 Runner CLI 尚未组合真实 Context Policy 与只读 Adapter。
- Stage B 未创建或读取真实 Manifest，未运行 Runner dry-run／`--execute`，未签发 Lease，未执行 Provisioning，未启动 A2-P1／A2-P2。
- 唯一下一任务为 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-C`：MIG-01A2 本地验收 Manifest 候选与审批包。
- Stage C、Stage D、Manifest 候选、真实 dry-run、Lease、A2-P1 和 A2-P2 均未启动；Stage C 完成也不得自动启动 Stage D。

## 2026-07-30：MIG-01A2 Candidate Governance／Stage C-0 完成并切换至 Stage C

- PR #816 完成 Candidate Governance 基础，Base `0be5faf5b089fdf3b5e0c84f3dac09d1283368d2`，Head `4df7cac76887b5cc3336650911dfc7f0448516e5`，Merge Commit `eb7cde613c38e262aeb8519c53e7e3d21704b18f`。
- PR #816 Required Check Run `30524750504`／Job `90813002538` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #816 精确新增 8 个文件：3 个 Candidate Runtime 模块、3 个测试文件和 2 个治理文档。
- Candidate Contract 为 `mig01-a2-candidate/v1`，domain 为 `zmtg.mig01-a2.provisioning-candidate-manifest`，Source Contract 为 `mig01-a2-candidate-source/v1`。
- 当前唯一 Source type `local_acceptance_fixture` 明确为 test-only；没有提供 Stage C 的真实 Source，没有生成真实 Candidate。
- Candidate canonicalization／SHA-256 digest 与 `mig01-a2/v1` Approved Manifest 完全分离；Candidate digest 不得复用为 Approved digest。
- Reviewer 生命周期只实现 `generated → review_pending`；当前没有 Candidate `approved` 状态，也没有创建 Approved Manifest。
- Candidate 定向契约集 3 文件／105 个测试通过；完整测试 417 文件／5896 个通过；build 101／101。
- `candidate_contract_missing` 已关闭；`real_manifest_missing` 与 `real_environment_dry_run_unavailable` 继续阻断。
- PR #816 未运行 Runner／dry-run，未签发执行 Lease／Migration Lease，未启动 A2-P1／A2-P2。
- 本次四文件 handoff 的 Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package、lock 修改均为 0。
- 唯一下一任务为 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-C`：本地验收 Manifest Candidate 生成与审批包。
- Stage C 尚未启动；它只允许从用户明确批准的真实 Source 合约与来源生成 Candidate、输出低敏审核摘要并交由用户审核，不创建 Approved Manifest、不运行 Runner、不执行 dry-run、不签发 Lease、不启动 A2-P1／A2-P2。

## 2026-07-30：MIG-01A2 Source／Candidate v2 Governance 完成并切换至 Stage C

- PR #817 完成 Stage C-0 handoff，Head `7ea19efccc5dd17a5e30c7c35571465d0d986f3f`，Merge Commit `c1be2e45389a74f653717a2a47a81a5559f3c35b`。
- PR #817 Required Check Run `30526410379`／Job `90818243458` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #818 基于 `c1be2e45389a74f653717a2a47a81a5559f3c35b` 建立 Source／Candidate v2 Governance，Head `29ee87fa7f7b3ab3749e4adedaf89457471d21ef`，Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350`。
- PR #818 Required Check Run `30529676907`／Job `90828769200` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #818 精确变更 8 个文件：3 个 Source／Candidate v2 合约模块、3 个 v2 测试文件、1 份 Source v2 治理文档和 1 份空白审批模板。
- Candidate v1 `mig01-a2-candidate/v1`、Source v1 `mig01-a2-candidate-source/v1`、test-only type `local_acceptance_fixture`、v1 测试、治理文档与固定向量均保持不变。
- Candidate v2 为 `mig01-a2-candidate/v2`，canonicalization 为 `candidate-canonicalization-v2`。
- Source v2 为 `mig01-a2-candidate-source/v2`，type 为 `local_acceptance_user_authorized_input`，canonicalization 为 `candidate-source-canonicalization-v1`。
- Source authorization、Candidate review 与 Approved Manifest 是三个独立门；Candidate v2 Review lifecycle 只允许 `generated → review_pending`。
- v2 定向契约测试 3 文件／225 个场景通过；完整测试 420 文件／6121 个测试通过；build 101／101。
- Source／Candidate v2 Governance 没有生成 Source／Candidate 实例，没有创建 Approved Manifest，没有运行 Runner／dry-run，也没有签发 Lease。
- `real_manifest_missing` 与 `real_environment_dry_run_unavailable` 继续阻断；Stage D、A2-P1 与 A2-P2 均未启动。
- 本次四文件 handoff 的 Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package 和 lock 修改均为 0。
- 唯一下一任务继续为 `V2-MIG01-A2-LOCAL-READINESS-REMEDIATION-01-STAGE-C`：使用 Source v2 生成本地验收 Candidate 并提交低敏审批包。
- 当前 Ultra 任务已授权在本 handoff 合并后串行执行 Stage C；本条记录本身未生成 Candidate，也未启动 Stage C。

## 2026-07-30：MIG-01A2 Stage C Candidate 人工审核收口并切换至 Approved Manifest 创建

- PR #818 建立 Source／Candidate v2 Governance，Head `29ee87fa7f7b3ab3749e4adedaf89457471d21ef`，Merge Commit `ff3528d703c00703998d62f69c1ded8f5f6a3350`。
- PR #819 完成 Source v2 handoff，Head `4c964a167ad4e729681067ba319e4b9cb1940d3f`，Merge Commit `2e14cfd2cec73cd3d8dc08274ba70763402798bb`，Required Check Run `30530766787`／Job `90832302970` 成功。
- PR #820 完成 Candidate 生成、私有输出卫生重新签发和用户人工审核记录，最终 Head `bc3ad6155df5ce071442183b85a301dd6366ec51`，Merge Commit `172526e15775fc99768e1d739fc3c0d947bc1363`。
- PR #820 Required Check Run `30540499970`／Job `90863892886` 对应最终 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- 当前有效 Candidate 数量为 1；Candidate version 为 `mig01-a2-candidate/v2`，Source version 为 `mig01-a2-candidate-source/v2`，Context Policy version 为 `mig01-a2-local-acceptance-context-policy/v1`。
- Source／Candidate exact shape、Source／Candidate digest、Context Policy、tenant 父记录与私有权限均已通过低敏验证。
- 用户人工审核结论为 `accepted_for_approved_manifest_preparation`；该结论只允许当前 Candidate 作为未来独立 Approved Manifest 创建任务的审核依据。
- Candidate payload 仍为 `candidate`，私有 Review State 仍为 `review_pending`；没有创建或伪造 Candidate `approved` 状态。
- Candidate digest 未被复用；未来 Approved Manifest 必须使用独立 approval 字段、`c14n-v1` 和新的 SHA-256 digest。
- `candidate_human_approval_missing` 已关闭；`real_manifest_missing` 与 `real_environment_dry_run_unavailable` 继续阻断。
- Approved Manifest 尚未创建；Runner、dry-run、`--execute`、Lease、数据库写入、Stage D、A2-P1 与 A2-P2 均未启动。
- PR #820 与本次 handoff 的 Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-MIG01-A2-APPROVED-MANIFEST-CREATION-VALIDATION-01`：基于已审核 Candidate 创建并校验独立 Approved Manifest。

## 2026-07-30：MIG-01A2 Approved Manifest 校验收口并切换至 Stage D

- PR #823 完成 Approved Manifest 独立创建与低敏校验报告，Head `78eff467a158baf4d70995cb59bd774c35327785`，Merge Commit `3f042172734c0dc9cc583a09f347e38df7db1e02`。
- PR #823 Required Check Run `30548606044`／Job `90891106206` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- Approved Manifest 数量为 1，version 为 `mig01-a2/v1`，`approvalStatus=approved`，`c14n-v1`、exact shape 和独立 digest 校验全部通过。
- Candidate 与 Approved Manifest 作为独立文件保留，Candidate digest 未被复用；Future Operator 尚未分配，后续必须与 Approver 保持职责分离。
- `real_manifest_missing`、`approved_manifest_validation_missing` 与 `approved_manifest_independent_review_pending` 已关闭；`real_environment_dry_run_unavailable` 继续阻断。
- 本阶段未运行 Runner、synthetic／真实 dry-run 或 `--execute`，未签发、读取、验证或消费 Lease，未执行数据库写入、Migration、Seed、DDL、DML 或 Provisioning。
- PR #823 与本次四文件 handoff 的 Runtime、Schema、Migration 修改均为 0。
- 唯一下一任务为 `V2-MIG01-A2-STAGE-D-LOCAL-DRY-RUN-VALIDATION-01`：基于已审核 Approved Manifest 的本地只读 dry-run 验证。
- Stage D、A2-P1、A2-P2、BASE-02、Writer、Reader、平台切片与机构端旧任务均未启动。

## 2026-07-31：MIG-01A2 Stage D 收口并冻结 A2-P1 下一任务

- PR #825 完成 Stage D 本地只读 dry-run 报告，最终 Head `151b6316e42bd6f9b0d5d6efcf96afe568675a4d`，Merge Commit `e6bfd470fb521fcd18e8093024efcdf0a56ab63c`。
- PR #825 Required Check Run `30558783297`／Job `90926083649` 对应最终 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #826 保留首轮 F01 历史并完成归因修正复审，重放后 Head `3e364afb7e1880c4b06ad92788cfb1a8d3972839`，Merge Commit `b514ee04c35c7ddb830787e0ad579f3b0469379c`。
- PR #826 Required Check Run `30561620736`／Job `90935814730` 对应重放后 Head，全部质量步骤成功，build 未跳过。
- Stage D 五项低敏计数 `input／insertedCandidate／reusedCandidate／conflict／unexpected` 为 `1／1／0／0／0`，计数守恒；dry-run 前后数据库状态一致。
- F01 已关闭；独立审查结论为 `stage_d_independent_review=passed`，Stage D handoff 准入为 `true`，A2-P1 准入仍为 `false`。
- 数据库写入、Lease、`--execute`、Migration、Seed、DDL、DML 均为 0；Stage D 已完成并收口。
- 本次四文件 handoff 的 Runtime、Schema、Migration、scripts、tests、CI、package、lock 修改均为 0。
- 唯一下一任务沿用既有名称 `A2-P1 manifest 驱动 provisioning`；仓库尚无正式任务编号，该任务尚未启动、尚未获得执行授权。

## 2026-07-31：A2-P1 受控执行计划与 Write Adapter Runtime 收口

- PR #828 建立 A2-P1 受控执行计划，Head `77be8e4ac835ce76e77a6bf5c7026c63d83b58fc`，Merge Commit `184b0320be1bedaace5d72ff0b0e453f343ad52e`。
- PR #828 Required Check Run `30565599037`／Job `90949208935` 对应冻结 Head，全部质量步骤成功。
- PR #829 建立唯一 Write Adapter、Write 合成事务测试、ReadOnly／Write parity 测试并更新 Runbook，Head `aa465a64aa146a43f766413caa53dfc88a1bd39b`，Merge Commit `bbf15be8f5acd66d80db5ac7b6e9250a57d5744e`。
- PR #829 Required Check Run `30568943508`／Job `90960419070` 对应最终 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- Write Adapter 只读取 `tenants` 与三张 A1 表，只向三张 A1 表执行参数化纯 `INSERT`，并提供单一 `SERIALIZABLE READ WRITE` 事务、固定 timeout 与双键事务级 advisory lock；既有 Kernel 强制 affected rows 逐项等于 1，并在提交前完成全批重检。
- ReadOnly Adapter 与永久拒写边界未修改；禁止 UPDATE、UPSERT、DELETE、DDL、自动重试、savepoint 和原始数据库错误泄漏。
- 定向 Write／Parity／ReadOnly／Kernel 为 4 个文件、109 个测试通过；完整 Provisioning 契约为 14 个文件、510 个测试通过；完整质量基线为 422 个测试文件、6190 个测试通过，build 101／101。
- Runtime 阶段未连接数据库、未读取真实 Manifest、未签发或消费真实 Lease、未运行 Runner dry-run／`--execute`，Migration、Seed、DDL、DML 与数据库写入均为 0。
- 本次四文件 handoff 的 Runtime、Schema、Migration、scripts、tests、CI、package、lock 修改均为 0。
- Write Adapter 进入 `main` 不表示 A2-P1 已执行或完成；真实 Authority、仓库外一次性组合根、client 生命周期、grant／revoke、真实 Lease release 与数据库执行证据仍未关闭。
- 唯一下一阶段沿用 Runbook 名称 `Authority／组合根无写准备`；当前总任务已授权在本 handoff 合并后串行执行，但本次 handoff 未启动该阶段。

## 2026-07-31：A2-P1 Authority／组合根无写准备收口

- PR #830 完成 Runtime handoff，Head `1d28b6a91bf3b7076f66478861a3a7cc46fdcb18`，Merge Commit `2ca100af132adf6676c09073f5d527c1b608d3ed`。
- PR #830 Required Check Run `30570185023`／Job `90964638309` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #831 完成 Authority／组合根无写准备与低敏证据，Head `e427b57cdf810c9021d6beb1738a69f365bd7218`，Merge Commit `2da175330a4e15601c9806f75184df303e8cf2f9`。
- PR #831 Required Check Run `30571861343`／Job `90970298323` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- 合成 Authority 矩阵为 23 个用例：1 个完整匹配允许，22 个漂移、失效、未知或不可用用例全部拒绝。
- 生命周期矩阵 12 个场景与静态边界 6 项通过；合成 Runner `--dry-run` 五项计数为 `1／1／0／0／0`。
- 无写验证中的一次性组合根只调用既有 Runner，并注入当前 Context Policy、已合并 Write Adapter、合成 Lease 与合成 Authority；不直接执行 SQL，不复制 Kernel、Manifest parser、Repository 映射或第二 Runner。
- 本阶段真实数据库连接／写入、真实 Manifest 读取、真实 Authority／Lease 操作、真实 grant／revoke、`--execute`、Migration、Seed、DDL、DML 均为 0。
- 临时 Helper、合成输入和私有临时目录已删除；低敏证据未记录私有路径、连接参数、双键、digest、角色引用、Manifest 正文、SQL、Secret、Token、凭证或 PII。
- 本次四文件 handoff 的 Runtime、Schema、Migration、scripts、tests、CI、package、lock 修改均为 0。
- Authority／组合根无写准备已完成并收口，但真实签名锚、活动 Authority 记录、Execution Lease、职责分离、权限窗口、最新恢复点和数据库执行前置仍须在唯一执行窗口实时证明。
- 唯一下一阶段沿用既有名称 `一次受控 local_acceptance execute`；本次 handoff 未连接数据库、未签发 Lease、未授予权限，也未启动 `--execute`。
- A2-P1 尚未完成；A2-P2、BASE-02、Writer、Reader、平台切片与机构端旧任务均未启动。

## 2026-07-31：A2-P1 PUBLIC TEMPORARY ACL 调整与独立审查收口

- PR #833 合并数据库级 `PUBLIC TEMPORARY` 权限阻断决策，Head `ab5762bf0ce2442ed021b638164fb258874e0d48`，Merge Commit `8afcc301bae4e4ad7eac03917b906b0ca9d18c0c`。
- PR #833 Required Check Run `30598201520`／Job `91055097125` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- 仅对固定 localhost-only 本地验收数据库执行一次已授权的 `PUBLIC TEMPORARY` 撤销；撤销次数为 `1`，条件化回退未命中，回退次数为 `0`。
- `PUBLIC TEMPORARY` 由 `true` 变为 `false`，`PUBLIC CONNECT` 保持 `true`，TEMPORARY allowlist 为 `0`。
- 其他数据库 ACL、Schema／表／序列／Default Privileges、角色目录与成员关系、Journal、A1 Shape 均未变化；固定四表低敏计数前后均为 `2／0／0／0`。
- PR #834 合并 ACL 调整低敏证据，Head `eb6e76b23afd03a4447e082b1e735c59ca3d4990`，Merge Commit `2cf55056ad1182297fb9cc1d2c5c22d4e2ee20c0`。
- PR #834 Required Check Run `30599333356`／Job `91058440874` 对应冻结 Head，全部质量步骤成功，build 未跳过。
- PR #835 合并独立审查，Head `00d460f05e8f639738a28b78d4f35d1f38d5cc94`，Merge Commit `66953dfc5086a5d5209b34f709886b0a245f7192`。
- PR #835 Required Check Run `30599838548`／Job `91059915905` 对应冻结 Head，全部质量步骤成功，build 未跳过。
- 独立审查结论为 `public_temporary_acl_independent_review=passed`，ACL handoff 准入为 `true`，专用角色预置和 A2-P1 准入仍为 `false`。
- 本阶段未创建、修改或删除数据库角色，未授予表级 SELECT／INSERT，未签发或消费 Lease，未运行 Runner、dry-run 或 `--execute`；Migration、Seed 和业务 DDL／DML 为 `0`。
- 本次四文件 handoff 的 Runtime、Schema、Migration、journal、snapshot、scripts、tests、CI、package、lock 修改均为 `0`。
- 唯一下一任务为 `V2-MIG01-A2-P1-DEDICATED-ROLE-PROVISION-AND-EXECUTE-RESUME-01`（专用角色预置与 A2-P1 恢复执行）；本次只冻结任务名称与边界，尚未启动、尚未获得任务授权。
- A2-P1 尚未执行；A2-P2、BASE-02、Writer、Reader、平台切片与机构端旧任务均未启动。

## 2026-07-31：Approved Manifest 重新签发与独立审查收口

- 任务 `V2-MIG01-A2-P1-APPROVED-MANIFEST-REISSUE-AND-REAPPROVAL-01` 在旧 Approved Manifest 不再可用后，基于当前有效 Candidate v2 重新签发全新的 Approved Manifest。
- PR #837 合并重新签发低敏证据，Head `f1c0a92c40eb2de99cb064231c76a201ebfb36eb`，Merge Commit `18bb00356a0f282ca3a9cd75c3f9c6b23f9c10e1`。
- PR #837 Required Check Run `30624937873`／Job `91137882392` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #838 合并独立审查，Head `1caa7eaaae8c533e0b957f93e6b3d86c97e18fa8`，Merge Commit `809f7273be8090dc7a8c4e0cf66087309201c10a`。
- PR #838 Required Check Run `30625623297`／Job `91140082028` 对应冻结 Head，全部质量步骤成功，build 未跳过。
- 当前 Candidate v2 和 Approved Manifest 数量均精确为 `1`；旧 Approved Manifest 没有恢复、复制或复用。
- Approved Contract 为 `mig01-a2/v1`，`approvalStatus=approved`，`canonicalization=c14n-v1`；exact shape、独立 digest、Candidate／Approved 文件与 digest 分离均通过。
- Generator、Reviewer、Approver 职责分离，Future Operator 未分配；私有权限和临时资产清理通过。
- 独立审查结论为 `approved_manifest_reissue_review=passed`，handoff 准入为 `true`，A2-P1 execute 准入为 `false`。
- 本阶段数据库连接、角色或 ACL、Lease、Runner、dry-run、`--execute`、Migration、Seed、DDL、DML 均为 `0`；Runtime、Schema、scripts、tests、CI、package、lock 修改均为 `0`。
- 唯一下一任务重新冻结为 `V2-MIG01-A2-P1-DEDICATED-ROLE-PROVISION-AND-EXECUTE-RESUME-01`；尚未启动，尚未授权角色创建、ACL、Lease、Runner、dry-run 或 `--execute`。
- A2-P1 execute 尚未启动；A2-P2、BASE-02、Writer、Reader、平台切片与机构端旧任务均未启动。

## 2026-07-31：A2-P1 受控执行、独立审查与最终 handoff 收口

- 任务 `V2-MIG01-A2-P1-DEDICATED-ROLE-PROVISION-AND-EXECUTE-RESUME-01` 在固定 localhost-only 本地验收环境完成一次专用角色 dry-run 和一次且仅一次 A2-P1 `--execute`。
- PR #840 合并 A2-P1 执行低敏证据，Head `9a6fb23f1e6a34346cc91e56eacbd6c8c14c6295`，Merge Commit `6c0839a4dc38f51f11449f03548142fa5653a80c`。
- PR #840 Required Check Run `30628614371`／Job `91149548637` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #841 合并 A2-P1 独立审查，Head `c93b9a0235f799c913bf41dae849a02a0d805867`，Merge Commit `3d18054b10eab741b4f0fd6a0d70249a6d36ca97`。
- PR #841 Required Check Run `30629405987`／Job `91152028768` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- dry-run 五项计数为 `input／insertedCandidate／reusedCandidate／conflict／unexpected = 1／1／0／0／0`；Runner dry-run 调用为 `1`，重试为 `0`。
- Execution Lease issue／claim／consume／release 均为 `1`，renewal 为 `0`，release 后重放被拒绝。
- `--execute` attempt 为 `1`、retry 为 `0`，五项计数为 `1／1／0／0／0`；提交后严格复用分类为 `1／0／1／0／0`。
- Institution Scope、Context Version 1、Context Head 1 各净新增 `1`；tenant 父表、Journal、Schema Shape 与其他公开业务表计数未发生额外变化，`conflict／unexpected = 0／0`。
- 独立审查关闭 `A2P1-F01`：`fixed_table_count_drift` 是 commit 后复用执行前零行断言产生的过时收尾断言，不是事务失败、数据库漂移或清理失败；无需回滚、前向修复、重试或第二次 `--execute`。
- Runner client 已关闭；临时角色已 NOLOGIN、撤销直接权限并删除；活动连接、direct ACL、membership、ownership、sequence 权限、凭证、Authority／Lease 状态、输入副本、Helper 与临时目录残留均为 `0`。
- 原 Candidate 与原 Approved Manifest 持续保留且未修改；最终 `PUBLIC TEMPORARY=false`、`PUBLIC CONNECT=true`。
- 本阶段 Schema、Migration、Seed、UPDATE、UPSERT、DELETE、TRUNCATE、Runtime／Runner／Kernel／Adapter 修改以及 scripts、tests、CI、package、lock 修改均为 `0`；非 localhost 连接和私有敏感输出均为 `0`。
- 独立审查结论为 `a2_p1_independent_review=passed`，最终 handoff 准入为 `true`，A2-P2 准入为 `false`。
- 本次最终 handoff 收口 A2-P1；唯一下一任务沿用既有名称 `A2-P2 复合键／索引／NOT VALID 关系`，仓库尚无正式任务编号，该任务尚未启动、尚未获得 Schema／Migration／环境／Migration Lease 或实施授权。
- D12-A 当前只接受最小 Anchor Bridge 方向；精确对象名称、列序、Catalog Shape、Migration 编号、锁／timeout 和目标环境仍须在未来独立任务中重新冻结。A2-P2 不得包含回填、`VALIDATE CONSTRAINT`、`SET NOT NULL`、Reader 放行、Audit attribution／shape 收紧或 MIG-01C。

## 2026-07-31：A2-P2 只读预检、独立审查与实施冻结 handoff

- PR #842 完成 A2-P1 最终 handoff，Head `49c2b5f25f8f9600cb3fb411b4fbc033ae783cd3`，Merge Commit `053108d995e5e0b1ac3cdd7d9ff6ae9e904821ec`。
- PR #842 Required Check Run `30630446646`／Job `91155295387` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #843 完成 A2-P2 localhost-only 显式 `READ ONLY` Catalog／数据 Shape 预检，Head `0d5cf44273d4ca6a12c857f605c8bd07e4656759`，Merge Commit `683668a584670bb9b9431582cb5eae918d38eee1`。
- PR #843 Required Check Run `30633506572`／Job `91165285987` 对应冻结 Head，全部质量步骤成功，build 未跳过。
- PR #844 完成 A2-P2 独立审查，Head `eba90d153e25f00e43651e6ce01fd8f7ef6be156`，Merge Commit `6460516d9a172a9bdaa5681b4b3407a7d212f54c`。
- PR #844 Required Check Run `30634548162`／Job `91168725451` 对应冻结 Head，全部质量步骤成功，build 未跳过。
- `institution_scopes_pk(tenant_id, institution_id)` 已冻结为唯一引用目标；普通索引 `auth_account_institution_bindings_scope_idx` 与 `NOT VALID` 外键 `auth_account_institution_bindings_scope_fk` 均为 `all_missing`。
- Binding 总行数为 `1`，NULL 和重复均为 `0`，historical orphan 为 `1`；该 orphan 已解释但未修复／未验证，支持窄范围 `NOT VALID` 创建，不支持回填、`VALIDATE`、BASE-02 完成或 Reader 放行。
- handoff 澄清 historical orphan 不属于 MIG-01B：修复 Owner／动作尚未授权，只能由未来独立授权的 Access Control／BASE-02 Binding 生命周期或专项数据修复任务处理；禁止从 Binding 反推创建 Scope，也不得由 A2-P2／MIG-01B 静默接管。
- Scope、Context Version 1、Context Head 1 保持 `1／1／1`，环境 latest 与仓库 0038 一致，A1 Shape 未漂移；snapshot 仍为 0026。
- 独立审查结论为 `a2_p2_preflight_review=passed`，handoff 准入为 `true`，Schema／Migration 执行准入为 `false`。
- metadata 实施边界冻结为独立 P0 两文件校准／handoff，再申请 P1 四文件核心 Schema／Migration；`0039` 未批准、未预留、未占用。
- 本阶段数据库写入、Schema、Migration、journal、snapshot、DDL、DML、Seed、Restore、Migration Lease 和编号占用均为 `0`；Runtime、scripts、tests、CI、package、lock 修改均为 `0`。
- 唯一下一任务为 `A2-P2 Schema／Migration 实施`，仓库尚无正式任务编号；P0、P1、数据库执行、BASE-02、Writer、MIG-01B／C 和 Reader 均未启动、未授权。

## 2026-07-31：A2-P2 P0 metadata current 校准、独立审查与 handoff

- PR #846 完成 P0 两文件 current 口径校准，Head `df15c70436f4cda3085847e1b221202a74a2b299`，Merge Commit `daf07fbd632cb4276fde911e073521483e409baf`。
- PR #846 Required Check Run `30637892951`／Job `91180059088` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #847 完成 P0 独立审查，Head `b9632ab3a8c4bc1fb83e808f4ec98af2c75cb2e9`，Merge Commit `326260fec24112ffcb2ff3828c8c4398ad43f2b9`。
- PR #847 Required Check Run `30638717649`／Job `91182885954` 对应冻结 Head，全部质量步骤成功，完整测试和 build 均实际执行。
- P0 实际修改为 `docs/operations/drizzle-migration-snapshot-strategy.md` 与 `src/server/db/tests/ProductionReadinessDocs.test.ts`；current journal 改为从 `_journal.json` 最后一条 tag 动态推导并与实际 SQL 集合核验，不再依赖陈旧编号断言。
- PR #846／#847 审查时 journal 为 `39` 条、对应 `39` 个 SQL，末项为 0038；该数值只作为合并时证据，不是永久硬编码的 current 契约。
- snapshot 保持 `0026_snapshot.json`；journal 与 snapshot 可以阶段性不同步，`db:generate` 与 snapshot-diff Migration 禁令未弱化。
- P0 修改运维文档 `1`、测试文件 `1`；Runtime、Schema、Migration SQL、journal、snapshot、数据库、CI、package 和 lock 修改均为 `0`。本次四文件 handoff 的上述修改同样均为 `0`。
- 未创建 Migration Lease，未连接数据库，未运行 `db:generate`、Migration、Seed、DDL 或 DML；`0039` 未批准、未预留、未占用，未来编号只能在独立 Migration Lease 下实时分配。
- 独立审查结论为 `a2_p2_p0_review=passed`，面向 P1 的 handoff 准入为 `true`（仅可申请授权），Schema／Migration 执行准入为 `false`。
- 唯一下一任务为 `A2-P2 P1 核心 Schema／Migration 实施`，仓库尚无正式任务编号；P1、BASE-02、Writer、MIG-01B／C 和 Reader 均未启动、未授权。

## 2026-08-01：A2-P2 P1 实施、受控 Migration、独立审查与最终 handoff

- PR #849 完成 P1 四文件核心 Schema／Migration 实施，Head `4b0a0f89f5aa36a9c2283a6a8af18a18fd12fe08`，Merge Commit `036c3198ee038186c36d19f8f57a7a45b965b963`。
- PR #849 Required Check Run `30645227980`／Job `91204848506` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #850 完成 P1 实施独立审查，Head `24370a0071dd40e01b5d601013e45a28f45d285c`，Merge Commit `57b77a76e55846d14a28bfdf3a8794ba67241a54`。
- PR #850 Required Check Run `30646526891`／Job `91209147172` 对应冻结 Head，全部质量步骤成功；审查结论为 `a2_p2_p1_implementation_review=passed`。
- 实时 Migration 编号为 `0039`；P1 实际修改 Migration SQL `1`、journal `1`、Schema `1`、Schema 测试 `1`，snapshot 修改为 `0`。
- 目标对象为普通非唯一索引 `auth_account_institution_bindings_scope_idx` 和 `NOT VALID` 外键 `auth_account_institution_bindings_scope_fk`；外键最终 `convalidated=false`。
- 固定 localhost-only 本地验收环境只调用一次 guarded `pnpm db:migrate`，attempt／retry 为 `1／0`，`planned／created／reused／conflict／unexpected = 2／2／0／0／0`。
- 环境 Applied Migration 从 `39` 到 `40`；业务 DML 为 `0`，环境 Migration journal metadata 增加 `1`。
- A2-P1 Scope／Context Version／Context Head 保持 `1／1／1`；Binding 总数／NULL／重复／historical orphan 保持 `1／0／0／1`。
- Migration Lease claim／consume／release 为 `1／1／1`，renewal／retry 为 `0／0`；执行前后恢复点、完整性与隔离恢复验证均通过。
- PR #851 合并 Migration 执行低敏证据，Head `1a832883b20f8e37879f3f740db0cc9cb098aea8`，Merge Commit `e93d180fb7e34a33d2f7e2e70eb4f2eed66790cf`。
- PR #851 Required Check Run `30648638669`／Job `91216191655` 对应冻结 Head，全部质量步骤成功，完整测试和 build 均实际执行。
- PR #852 合并执行独立审查，Head `31fdec07abbccb461e7d21299fb8f7f135add7ae`，Merge Commit `96fe2b80f75bc3c2e1f8044b27ff84df64bba2b2`。
- PR #852 Required Check Run `30649674973`／Job `91219568724` 对应冻结 Head，全部质量步骤成功，build 未跳过。
- 执行独立审查结论为 `a2_p2_p1_execution_review=passed`、`a2_p2_complete=true`、`eligible_for_base02_handoff=true`、`eligible_for_base02_implementation=false`。
- 当前主动私有参数披露和真正敏感信息披露均为 `0`；没有第二次 Migration、直接 SQL、回填、外键 `VALIDATE`、`SET NOT NULL` 或第三个人工目标对象。
- 本次四文件 handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 `0`。
- 唯一下一任务为 `BASE-02 前置规划／准入`，仓库尚无正式任务编号；该任务、historical orphan 数据修复、BASE-02 Runtime、Writer、MIG-01B／C 和 Reader 均未启动、未授权。

## 2026-08-01：BASE-02 前置规划、准入审计与实施冻结交付

- 冻结基线为 `443033b7f06ba9d5a08b37ddeddf112162cea4b8`；本阶段没有新增正式 `V2-*` 任务编号。
- PR #854 提交 BASE-02 准入方案，Head `c0265653d84fdde53d8d1bed8ce14a25620c1172`，Merge Commit `b87fad849770b83276d0572f73c7c507825c3bca`；Required Check Run `30685590234`／Job `91330576040` 的环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #855 提交独立审查，重放后 Head `33030add36f7e6d3b87784368054e24e157537bd`，Merge Commit `8e3b9de6d472be9fc586b14a2eba24e51e928dfb`；Required Check Run `30687136765`／Job `91335093086` 的全部质量步骤成功，完整测试和 build 均实际执行。
- PR #856 负责本次 handoff 收口；方案、审查与 handoff 均不授权 BASE-02 Runtime、数据修复或数据库执行。
- 只读审计确认仓库／环境 journal 为 `40`、snapshot 为 `0026`、A2-P1 三表为 `1／1／1`，A2-P2 精确索引与 `NOT VALID` 外键存在且 `convalidated=false`。
- Binding 总数／NULL／重复为 `1／0／0`，active historical orphan 与 Scope 关系 orphan 均为 `1`；tenant 父关系缺失与 Membership 父关系缺失均为 `0`。
- historical orphan 的语义 Owner 冻结为 Access Control 的 Binding 生命周期；独立数据修复专项仅可作为经授权的执行载体，Tenancy 不得从 Binding 反推创建 Scope，A2-P2 与 MIG-01B 不得静默处理。
- 实施方案冻结为 BASE-B1～B6；BASE-02 不是简单清理 orphan。具体数据修复动作、Operating Context Head／Version、Runtime 与环境操作仍须未来独立授权。
- 独立审查结论为 `base02_readiness_review=passed`、`eligible_for_base02_implementation_handoff=true`、`eligible_for_base02_implementation=false`。
- 本轮数据库写入、DDL、DML、Migration、Seed、Lease、Runner、外键 `VALIDATE`、Runtime、Schema、scripts、tests、CI、package 和 lock 修改均为 `0`；Reader 继续阻断。
- 唯一下一任务冻结为 `BASE-02 实施`；仓库尚无正式任务编号，该任务尚未启动、尚未授权，首个候选切片为 `BASE-B1 Owner、Port 与 revision 契约`。

## 2026-08-01：BASE-02 Membership Revision 决策包、独立审查与 handoff

- PR #857 记录 BASE-B1 因 Membership revision 证据不足而硬停止，Head `6eb2fb4e26371904be063463968d5744fd8edc65`，Merge Commit `1edb71ca6a87df15b284c710ef80d0442ef97fe2`；Required Check Run `30688242614`／Job `91338121169` 成功，完整测试和 build 均实际执行。
- PR #858 提交 Membership Revision Architecture Decision Pack，Head `95109315b0366f9a7f2b6bb45dd7498e4e2dbfa6`，Merge Commit `1712b357cea3ef8147e87e7812c67a39e07c13f0`；Required Check Run `30689389362`／Job `91341284170` 成功，完整测试和 build 均实际执行。
- PR #859 提交独立审查，最终 Head `e6a5e403bb8ea1f85ba763d4251ad1ed010b1e38`，Merge Commit `aa7c8d53b9605a900dac461b1859084f2219ab8f`；Required Check Run `30689872741`／Job `91342595113` 成功，完整测试和 build 均实际执行。
- 当前 `tenant_members` 没有显式、稳定、严格单调且可 CAS 的 Membership revision；`updated_at`、Binding version 与 hash／HMAC 均不能替代该事实。
- A-literal 仅可作为 BASE-B1 interim carrier；proposed 推荐为 A-full，即保持 `tenant_members` 为 Access Control 唯一 canonical current，并补齐显式 revision、lifecycle envelope、tombstone／current provenance 和同事务 immutable transition evidence。
- 永久 sidecar 作为第二套 current 事实源已排除；canonical replacement 必须 ADR-first 并具备旧表退出计划；现有字段组合方案因无法证明单调性、CAS、ABA 与并发一致性而淘汰。
- 独立审查结论为 `base02_membership_revision_architecture_review=passed`；A-full 仍为 `proposed`，`membership_revision_decision_accepted=false`。
- Identity／Access Control／Tenancy／Security Owner 边界保持冻结，Access Control 继续拥有 Membership 与 Binding 生命周期；Operating Context Head／Version 不进入本轮 BASE-02 授权组合，也不成为新的持久化 Owner。
- BASE-B1 Runtime 继续阻断；BASE-B2～B6、Membership lifecycle Writer、项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与 Reader 均未启动。
- active historical orphan 与 Scope 关系 orphan 保持 `1／1`，未修改、未授权修复；A2-P2 外键继续 `NOT VALID`／`convalidated=false`，未执行 `VALIDATE`。
- 本次决策、审查与 handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 `0`。
- 唯一下一任务更新为 `BASE-02 Membership Revision 架构决策接受`；仓库尚无正式任务编号，该任务尚未启动、尚未授权。只有用户明确接受 proposed 推荐并完成独立 handoff 后，才可另行申请 Schema／Migration 前置预检。

## 2026-08-01：BASE-02 Membership Revision A-full 接受、独立审查与 handoff

- 用户正式接受 `A-full_same_table_lifecycle`；本阶段只接受架构语义，不接受具体字段、枚举、表结构、Migration 编号、SQL、回填方案或执行环境。
- PR #861 新增 A-full Accepted Decision，Head `ac22a0bd8e5197c5641c3d0ddd8e1abd8649e841`，Merge Commit `b74cad648a46421b0a04f5f6b868f2f7a2240319`。
- PR #861 Required Check Run `30691379044`／Job `91346604424` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #862 新增接受独立审查，Head `46ec582001989416dd6cd8a7c333f13d68de3499`，Merge Commit `1478c2693d6a21216169babad5ff9d4147e3afb0`。
- PR #862 Required Check Run `30691699252`／Job `91347460065` 对应冻结 Head，全部质量步骤成功，完整测试和 build 均实际执行。
- `tenant_members` 继续作为 Access Control 唯一 canonical Membership current；Identity、Access Control、Tenancy 与 Security Owner 边界没有重开。
- Membership revision、Binding version 与 Scope revision 继续作为三个独立版本域；Operating Context Head／Version 不进入本轮 BASE-02 授权组合。
- A-full 已绑定显式严格单调 revision、`expectedRevision` CAS、完整 lifecycle、tombstone／incarnation／ABA、current provenance、同事务 immutable transition evidence 与 Access Control 唯一 Writer。
- A-literal 继续仅为 interim；永久 sidecar current 继续排除；canonical replacement 仅可由未来独立 ADR 重开；方案 C 继续淘汰。
- 独立审查结论为 `membership_revision_acceptance_review=passed`、`membership_revision_decision_accepted=true`、`membership_revision_direction=A-full_same_table_lifecycle`。
- BASE-B1 Runtime 继续 `blocked`；BASE-B2～B6、Membership lifecycle Writer、项目级 Writer、Audit／模板、MIG-01B、MIG-01C 与 Reader 均未启动。
- active historical orphan 与 Scope relation orphan 保持 `1／1`，未修改、未授权修复；A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`，未执行 `VALIDATE`。
- 本次 Accepted Decision、独立审查与 handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 `0`。
- 唯一下一任务更新为 `BASE-02 Membership Revision Schema／Migration 前置预检`；仓库尚无正式任务编号，该任务尚未启动、尚未授权。Schema、Migration、数据库、Migration Lease 与 BASE-B1 Runtime 仍未授权。

## 2026-08-01：BASE-02 Membership Revision 物理模型前置预检、独立审查与 handoff

- PR #864 完成 Schema／Migration 前置预检与 proposed 物理模型决策包，Head `3e9f2f8992e9923dc5261be8f40c8e8f9f9b18a0`，Merge Commit `59e5ef94fe9a462b29e0792f2b661a84e3d10de2`。
- PR #864 Required Check Run `30696216677`／Job `91359466603` 对应冻结 Head，环境、依赖、架构自测、增量检查、lint、typecheck、完整测试和 build 全部成功。
- PR #865 完成独立审查，Head `9e20fcef4756eae0c9cec273fe5ec7e7039236c2`，Merge Commit `511de2c22000ae3494e7745a2dac7cfe82f21042`。
- PR #865 Required Check Run `30696574699`／Job `91360387951` 对应冻结 Head，全部质量步骤成功，完整测试和 build 均实际执行。
- 静态审计确认 current `tenant_members` 为 7 列、2 索引、2 FK，没有 lifecycle、revision、provenance、tombstone、业务 CHECK 或业务 trigger；authoritative Membership Writer 为 `0`。
- direct Membership Writer 为 4 文件／6 符号，其中 `direct_writer_to_migrate=1`、`direct_writer_to_disable=5`；核心 compatibility Reader 为 6 个，正式 Guard 核心链测试为 15 个，次级 lifecycle Reader 测试为 2 个。
- journal／SQL current 为 `40／40`，snapshot 共 15 个、末项为 0026；本轮没有预留、批准或占用下一 Migration 编号，没有创建 Migration Lease。
- proposed 推荐为 `tenant_members` 规范化同表 canonical current＋`tenant_membership_transitions` append-only immutable evidence；P01～P12 冻结 revision、lifecycle、incarnation、current provenance、transition evidence、CAS、legacy calibration、Writer／Reader cutover 与 Binding 联动候选。
- proposed 串行实施候选为 M0 metadata → M1 Expand → M2 Owner Writer／CAS → M3 旧 Writer 委托／封堵 → M4 legacy calibration → M5 高水位追赶／冲突清零 → M6 Reader 切换 → M7 Enforce；每个切片仍须独立授权、审查与 handoff。
- 独立审查结论为 `membership_revision_schema_preflight_review=passed`、`eligible_for_physical_model_acceptance_handoff=true`、`eligible_for_schema_migration_implementation=false`、`eligible_for_base_b1_runtime=false`。
- P01～P12 仍为 proposed，`membership_revision_physical_model_accepted=false`；A-full、Owner 与 Membership／Binding／Scope 三个独立 revision 域没有重开。
- 本次前置预检、决策包、独立审查与四文件 handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 `0`。
- BASE-B1 Runtime 继续 `blocked`；BASE-B2～B6、Membership lifecycle Writer、项目级 Writer 和 Reader 均未启动；active historical orphan 与 Scope relation orphan 保持 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`。
- 唯一下一任务更新为 `BASE-02 Membership Revision 物理模型与 Migration 切片接受`；仓库尚无正式任务编号，该任务尚未启动、尚未授权，不自动授权 Schema、Migration、数据库、Migration Lease 或 Runtime。

## 2026-08-01：BASE-02 Membership Revision 物理模型接受与 M1 Expand 收口

- PR #866 完成物理模型前置预检 handoff，Head `6d8f3e07070a250f9b05afec9a437e89a03bc92f`，Run `30697128370`／Job `91361781557`，Merge Commit `9393ca8c0c5402ea575ab95e8f4ea6016fa41a84`。
- PR #867 接受 P01～P12 绑定组合和 M0→M7 唯一串行，Head `cc85aada6f087e755ea06497cfb24e2c9eac7a7c`，Run `30698918831`／Job `91366363952`，Merge Commit `64d4b72d6e3ccd2f0b1afd41f05788650fb3240d`。
- PR #868 完成物理模型接受独立审查，Head `bb9556dc28e413e54fcc19576b64c6172c286e91`，Run `30699359617`／Job `91367471685`，Merge Commit `734f0df0c5715134cf5d2d2c03833b4cb3fb7127`。
- PR #870 是独立质量修复，Head `81a4e3b0e72e97e29b6d4bfd411799d8072fc1e4`，Run `30700920653`／Job `91371673110`，Merge Commit `17840a7a90d712b2776256a19e90127bf3deeb89`；只修复既有测试异步收尾竞态，不归入 M1 四文件范围。
- PR #869 在 PR #870 后无冲突重放并完成 M1 四文件 Expand，Head `2b57222beb0c8734853bbef184f8566bbd032074`，Run `30701389089`／Job `91372887624`，Merge Commit `314af071bb180ce0a1095c5d21f31baa3cc15e4a`。
- PR #871 完成 M1 实施独立审查，Head `fe223f959c04cd73f5b911a0cbe0b8cf9a8514bb`，Run `30701940533`／Job `91374361799`，Merge Commit `eb71d2ab628032ef39182a96ea0b82f89b6dd49e`。
- M1 实时 Migration 编号为 `0040`；四文件范围为手写 SQL、journal、Schema 与 Schema 测试，snapshot 保持 0026，M1 不包含 legacy DML。
- 首轮 pre-entry 目标门禁拒绝发生在数据库调用前，数据库 attempt 增量为 0；首轮实际数据库尝试随后因枚举聚合类型不匹配失败，事务完整回滚，环境 journal 40、M1 `all_missing`、业务数据净变化 0，Lease `claim／consume／release=1／1／1` 后释放，自动重试 0。
- PR #872 只在所有允许环境均未消费旧 `0040` 时增加三处显式 `enumlabel::text` 并补测试，Head `fea420a03f793a8aeb1d33f1cfacbe914ce21423`，Run `30703279028`／Job `91377908764`，Merge Commit `75f3c6663e7decce63634b1ee05579a454fb97ac`；没有创建 `0041` 或修改 journal、Schema、snapshot。
- PR #873 完成纠错独立审查，Head `cb600fb3ea9c15f84f920c57af6e75a0b6487bcb`，Run `30703993626`／Job `91379807583`，Merge Commit `781fde457c38a28dc9fd8f4d8e05bd16198f46db`。
- 纠错后第二次授权执行使用全新恢复点、全新唯一 Lease、全新不可覆盖 marker 和唯一 guarded `pnpm db:migrate`；实际数据库尝试累计为 2，自动重试为 0。
- PR #874 合并执行低敏证据，Head `5f7a5f64dfb48768193ca8510392d8a9146a1b7b`，Run `30705415873`／Job `91383565350`，Merge Commit `17e1a1d04691878809d0caf533960b99705529dd`。
- PR #875 完成执行独立审查，Head `2d15e1540527dc95f71f34f3b6ecc91200ec5a32`，Run `30705922589`／Job `91384912500`，Merge Commit `7dde569cdb8d512a978dc04e63c2008f6a74d583`；结论为 `base02_membership_revision_m1_execution_review=passed`。
- 环境 journal 从 40 到 41，pending 从 1 到 0，M1 Catalog 从 `all_missing` 到 `all_exact`；`0040` 已消费且不得再次改写。
- M1 对象类别为 enum 3、current envelope 新列 10、current 新约束 2、transition table 1／列 16／约束 8／显式普通索引 1、append-only function 1／trigger 2。
- Membership／Binding 保持 `1／1`，A2-P1 三表保持 `1／1／1`，完整 envelope／transition 行保持 `0／0`，active historical orphan／Scope relation orphan 保持 `1／1`，业务 DML 为 0，A2-P2 FK 继续 `NOT VALID`。
- 第二次 Lease `claim／consume／release=1／1／1`、renewal 0、活动 Lease 0；执行前后恢复点及隔离恢复验证通过。当前主动私有参数披露 0，真正敏感信息披露 0。
- 本次四文件 handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 0。
- M1 完成并收口；唯一下一任务为 `BASE-02 Membership Revision M2 Access Control Owner Writer／CAS`。M2 在 handoff 合并前尚未启动，合并后按当前 ULTRA 用户授权继续；M3～M7、BASE-B1～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader仍未启动。

## 2026-08-02：BASE-02 Membership Revision M2 Owner Writer／CAS 收口

- PR #877 完成 Access Control Membership Owner Writer／CAS 实现，Head `828ebb69e62267a67dff2d8cc21d7ddafb1d454b`，Run `30708477043`／Job `91391614603`，Merge Commit `e6add6403a7a502192c450615397304a74c4b8e7`。
- PR #878 完成 M2 实施独立审查，Head `ac76fe06ad5700d52e86f7c3622a2db65bbd441c`，Run `30708982932`／Job `91392949050`，Merge Commit `287b1d7cf66550424e304c6cc1354df334bb1e56`。
- M2 精确新增 4 个 Runtime 文件和 3 个测试文件，共 7 个文件；create／refresh／revoke／reactivate／delete、expected-absence／`expectedRevision` CAS、transaction-bound UoW、Binding 独立 version 与同事务 transition evidence 已建立。
- 定向测试 3 个文件／41 项、架构自测 67／67、完整测试 425 个文件／6235 项及 build 101／101 均通过。
- 独立审查结论为 `base02_membership_revision_m2_implementation_review=passed`、`m2_owner_writer_implemented=true`、`m2_transactional_cas_verified=true`、`m2_replay_fail_closed=true`。
- M2 未连接数据库，Schema、Migration、journal、snapshot、scripts、CI、package、lock 修改均为 0；legacy calibration、Reader、M3～M7 与 BASE-B1～B6 均未启动。
- M1 冻结事实未被 M2 改动：仓库／环境 journal 保持 41，已消费 `0040` 不可改写，M1 Catalog 保持 `all_exact`，完整 current envelope／transition evidence 行仍为 `0／0`。
- Owner 外 direct Membership mutation 仍为 4 个文件／6 个符号，其中 onboarding 委托候选 1、必须封堵 5；不得虚报已经归零。
- 本次 docs-only handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 0。
- 唯一下一任务冻结为 `BASE-02 Membership Revision M3 onboarding 委托、旧 Writer／Deleter 封堵`；handoff 合并前 M3 尚未启动，合并后按当前 ULTRA 用户授权继续。
- M4～M7、BASE-B1～B6、active historical orphan／Scope relation orphan 修复、A2-P2 FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断。

## 2026-08-02：BASE-02 Membership Revision M3 onboarding 委托与旧 Writer／Deleter 封堵收口

- PR #880 完成 M3-A 正式 onboarding Owner 委托，Head `c690789f341434fd7bb33e819151849e6c2a7afa`，Run `30711226980`／Job `91398940037`，Merge Commit `2d34177f0d2eb77ccaba0829ab3224e69911853f`。
- PR #881 完成 M3-B 旧 Writer／Deleter 封堵与 `AQ008_MEMBERSHIP_DIRECT_WRITER`，Head `b405403d6fea87e1d022d7e027e22d9f8600ae61`，Run `30714150218`／Job `91406737286`，Merge Commit `f8909e098def3810e0e336c9491facf83d4c3a57`。
- PR #882 完成 M3 实施独立审查，Head `6f0b95b246aa115d63be49758ca66202f09ae589`，Run `30714716713`／Job `91408247113`，Merge Commit `df83b9527e3569c0997f0438a68d086592f3a36b`；结论为 `base02_membership_revision_m3_implementation_review=passed`。
- M3-A 精确修改 9 个 Runtime／测试文件；正式 onboarding 复用一个 serializable／read-write 外层事务，通过 app-level 组合根委托 Access Control external-transaction Adapter，不再直接 INSERT `tenant_members`。
- M3-B 精确修改 11 个 Runtime／测试／架构检查器文件；启动基线 1 个旧 Writer 已委托，5 个旧 Writer／Deleter 已固定 fail-closed，旧 Membership DML 未被迁移到 helper、raw SQL 或其他脚本。
- Owner 外 direct Membership mutation 文件数／符号数为 `0／0`；唯一 Owner allowlist 文件数为 `1`；AQ008 rules exceptions 保持为空。
- M3-A 定向测试 `32／32`、完整测试 426 文件／6248 项、build 101／101；M3-B 定向测试 `123／123`、架构自测 `125／125`、完整测试 426 文件／6253 项、build 101／101。三个 PR 的 Required Check 均完整成功。
- M3 没有连接数据库，没有执行 DDL、DML、Migration、Seed 或 Lease；Schema、Migration、journal、snapshot、数据库、package、lock 与 CI Workflow 修改均为 `0`。
- 继承状态未变：journal 为 `41`、最新为已消费 `0040`、snapshot 为 `0026`、legacy complete current／transition 为 `0／0`、active historical orphan／Scope relation orphan 为 `1／1`、A2-P2 Scope FK 继续 `NOT VALID`。
- 唯一下一任务冻结为 `BASE-02 Membership Revision M4 deterministic legacy calibration`；handoff 合并前 M4 尚未启动，合并后按当前 ULTRA 用户授权继续。
- M5～M7、BASE-B1～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断。

## 2026-08-02：BASE-02 Membership Revision M4 deterministic legacy calibration 收口

- PR #884／#885 完成 M4 `0041` 三文件实施与独立审查；PR #886／#887 完成 Guard CLI 启动边界精确纠错与独立审查；PR #888／#889 在所有允许环境均未消费 `0041` 的前提下完成 record／relation alias 原子纠错与独立审查。
- M4 第一次目标 guarded 调用在 shell shim 启动边界失败且未进入 PostgreSQL；第二次进入事务后失败并完整回滚，环境保持 `41／0040`；第三次经用户单独授权，使用最新 main、全新恢复点和全新唯一不可续期 Lease 成功。目标调用累计为 `3`，自动重试为 `0`，第四次目标 Migration 未启动。
- PR #890 完成 M4 执行低敏证据，Head `90ca634ced30c7386d5c0a3c5338fda5df6bd911`，Run `30725188721`／Job `91435449482`，Merge Commit `167e1193e474237e5a612a7df9860adcad8b7e8c`。
- PR #891 完成 M4 执行独立审查，Head `38c821ffe247306dc211e450923d0379f49036fe`，Run `30725621418`／Job `91436644462`，Merge Commit `4b79cdf39775fa7827be89a33fa339e8fda90faa`；结论为 `base02_membership_revision_m4_execution_review=passed`。
- 两个 PR 的环境核对、依赖安装、架构自测、增量检查、lint、typecheck、完整测试和 build 均在冻结 Head 上实际执行并成功。
- 环境 journal 从 `41／0040` 推进到 `42／0041`，snapshot 保持 `0026`；`0041` 已消费且不可改写，后续问题只能使用独立 forward-fix。
- `planned／created／reused／conflict／unexpected=1／1／0／0／0`；Membership total 保持 `1`，all-null／partial／complete 从 `1／0／0` 变为 `0／0／1`，baseline transition 从 `0` 变为 `1`。
- 唯一 revision `1` active current 与唯一 baseline transition 在同一事务原子形成；Membership identity、tenant／user 归属、role、display_name、created_at 与 updated_at 稳定指纹未变化。
- Binding／Scope／Context Version／Context Head 保持 `1／1／1／1`；active historical orphan／Scope relation orphan 保持 `1／1`；A2-P2 Scope FK 保持 `NOT VALID`／`convalidated=false`。
- 新执行前／后恢复点与隔离恢复为 `2／2`，连同目标连续性验证总隔离恢复为 `3／3`；原目标 Restore 为 `0`。
- Lease claim／consume／renewal／release／active 为 `1／1／0／1／0`；client、进程、锁、marker、Helper 和隔离数据库活动残留均为 `0`。
- 执行后 PR 描述维护期间发生一次无目标 Guard 启动拒绝；目标选择、连接参数读取、数据库连接、Lease、Migrator、SQL／DDL／DML、仓库变化与数据库变化均为 `0`，不构成第四次目标 Migration 或自动重试；F01 已由 PR #891 关闭。
- 当前主动私有参数披露为 `0`；Secret、Token、密码、私钥、PII 与真实凭证披露为 `0`。
- 本次四文件 docs-only handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 `0`。
- M4 完成并收口；唯一下一任务冻结为 `BASE-02 Membership Revision M5 高水位追赶与冲突清零`。M5 尚未启动，本 handoff 合并后按当前 ULTRA 授权和动态硬门继续。
- M6～M7、BASE-B1～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断；七线正式发布保持 `0/7`。

## 2026-08-02：BASE-02 Membership Revision M5 高水位追赶与冲突清零收口

- PR #893 完成 M5 `0042` 三文件实施，Head `43440e3f38c3c6ba3576dba1788b3fad586cfb5a`，Run `30727616873`／Job `91442118293`，Merge Commit `72c7568df3fd1078b813733eda472c01b0f8672d`。
- PR #894 完成 M5 实施独立审查，Head `14c7e6e4419203dacd5d20b3bec2b3d8bc43c285`，Run `30728269902`／Job `91443866416`，Merge Commit `33c52ee41e20385e8541594fa92b4c5c6ce21cf9`；结论为 `base02_membership_revision_m5_implementation_review=passed`。
- PR #895 完成 M5 执行低敏证据，Head `53e7f1c0ad257fdff935d3ce1234be0054a19b34`，Run `30729433131`／Job `91446923309`，Merge Commit `804444789d135903a737bc0721c452bcc74511b5`。
- PR #896 完成 M5 执行独立审查，Head `a768ddac965d42c96e59f2a2881a66961d9f3cf7`，Run `30729838933`／Job `91448020103`，Merge Commit `ea4a59df15fa14e64d7b7c5ad8a18b80452cc0c0`；结论为 `base02_membership_revision_m5_execution_review=passed`。
- 四个 PR 的环境核对、依赖安装、架构自测、增量检查、lint、typecheck、完整测试和 build 均在冻结 Head 上实际执行并成功。
- `0042` 已在固定 localhost-only local_acceptance 完成一次且仅一次授权 guarded 目标调用；自动重试、直接 SQL 与第二次目标调用均为 `0`，执行结果已知。
- 环境 journal 从 `42／0041` 推进到 `43／0042`，snapshot 保持 `0026`；`0042` 已消费且不得改写，后续问题只能使用独立 forward-fix。
- 零候选结果为 `planned／created／reused／conflict／unexpected=0／0／0／0／0`；Membership total／all-null／partial／complete 保持 `1／0／0／1`，transition／exact current-head／M4 baseline 保持 `1／1／1`。
- Membership identity、tenant／user 归属、role、display_name、created_at 与 updated_at 未变化；Binding／Scope／Context Version／Context Head 保持 `1／1／1／1`，八张关键业务表稳定，业务 DML 为 `0`。
- active historical orphan／Scope relation orphan 保持 `1／1`；A2-P2 Scope FK 保持 `NOT VALID`／`convalidated=false`，未执行 `VALIDATE`、`SET NOT NULL` 或 orphan 修复。
- 全新执行前／后恢复点各 `1／1` 并通过隔离恢复，原目标 Restore 为 `0`；Allocation Lease 未消费且已释放，Execution Lease claim／consume／renewal／release／active 为 `1／1／0／1／0`。
- client、进程组、Lease／run lock、attempt marker、Helper、私有配置副本与隔离数据库活动残留均为 `0`；不可覆盖 terminal record 保留 `1`。
- F01 已在窄范围内关闭：恢复点 round-trip 只接受单一公开 CHECK 去除一对冗余括号，token、validated 状态与其余 Catalog／Shape 保持精确一致；该规则不得泛化。
- F02 已关闭：编排器首次因私有输入权限不满足门禁而在目标调用、数据库连接和 Lease claim 前拒绝，数据库变化为 `0`；从头重检后完成唯一目标调用，不构成 Migration attempt 或自动重试。
- 当前主动私有参数披露、Secret、Token、密码、私钥、PII、真实凭证披露和非 localhost 连接均为 `0`。
- 本次四文件 docs-only handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 `0`。
- M5 完成并收口；唯一下一任务冻结为 `BASE-02 Membership Revision M6 Reader 从 updated_at 切换到显式 revision＋lifecycle`。M6 尚未启动，本 handoff 合并后按当前 ULTRA 授权和动态硬门继续。
- M7、BASE-B1～B6、active historical orphan／Scope relation orphan 修复、A2-P2 FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断；七线正式发布保持 `0/7`。

## 2026-08-02：BASE-02 Membership Revision M6 Reader／Session／Guard 切换收口

- PR #898 完成 M6 authoritative Reader、Formal Session 与 Guard 切换，Head `e1cc9e4e97c18a80d3bf8ce55ed588b259898f19`，Run `30734941015`／Job `91461924228`，Merge Commit `fe79267264f228cac217908365aa42f3f7408109`。
- PR #899 完成 M6 实施独立审查，重放后 Head `b105d566416b7d8ad5d10a38388c666d244a2f21`，Run `30735331035`／Job `91462991272`，Merge Commit `005f1bfee5e1d94b003feb47c5f1f091463c483c`；结论为 `m6_implementation_review=passed`。
- 实施范围为单提交 42 文件：生产文件 24 个、测试文件 18 个；独立审查为单提交、单个 operations Markdown。
- Access Control、Identity、Tenancy 分别提供 Membership／Binding、正式账号、Scope 的 genuine application Reader；Security 只消费 Owner Reader，不建立第二套事实源。
- 正式登录、Session 恢复与受保护请求按 `Identity I1 → Membership／Binding M1 → Scope S1 → M2 → S2 → Identity I2` 双重读取，selector、lifecycle、revision、Binding version、Scope revision 或 Provider 漂移均 fail-closed。
- `fresh_membership_reader_cutover=true`、`session_restore_refresh_reread=true`、`guard_reference_cutover=true`、`explicit_membership_revision_lifecycle_source=true`。
- `authorization_tenant_members_updated_at_reads=0`、`authorization_membership_updated_at_compatibility_mappings=0`；通用更新时间列保留普通审计语义，不再承担授权 fallback。
- M6 精确／支撑测试矩阵为 22 文件、755/755；完整测试为 430 文件、6341/6341；build 101/101。两个 PR 的 Required Check 均完整成功。
- M6 未连接数据库，没有执行 DDL、DML、Migration、Seed 或 Lease；Schema、Migration、journal、snapshot、数据库、package、lock 与 CI Workflow 修改均为 `0`。
- 继承状态未变：环境 journal 为 `43／0042`、snapshot 为 `0026`、Membership complete／transition／exact current-head 为 `1／1／1`、active historical orphan／Scope relation orphan 为 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`。
- M6 完成并收口；唯一下一任务冻结为 `BASE-02 Membership Revision M7 Enforce 与旧路径退出`。M7 尚未启动，本 handoff 合并后按当前 ULTRA 授权和动态硬门继续。
- BASE-B1～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断；七线正式发布保持 `0/7`。

## 2026-08-02：BASE-02 Membership Revision M7 Enforce 与旧路径退出收口

- PR #901 完成 M7 前置 handoff 校准，Head `7120e4d5f36e09b5b0121f4c2aafb58b8ddd2d3b`，Run `30736438955`／Job `91465972519`，Merge Commit `22a1e6cdba2b81fb8aa743c253cec1e66a28136b`。
- PR #902 完成 M7 写入契约实施，Head `0b09b329012100386b8bc7638eaf818fb89cf8c6`，Run `30737402318`／Job `91468617520`，Merge Commit `24aba48ced5eb1c0588de88b45757958222cc010`；PR #903 完成独立审查，Head `2e22955c77e0d086e1de38ffe66adba930f6960a`，Run `30737726950`／Job `91469473175`，Merge Commit `5de9dc694b0de072eb68d43f2fbccab49c5bcb37`。
- PR #904 完成 M7 `0043` Schema／Migration 实施，Head `f43ce1b9ba554ca034441440c1a57781cbddc198`，Run `30739072657`／Job `91473075000`，Merge Commit `65d12f7e0f9a47df3279a9052b9b21fb54a8e3ad`；PR #905 完成独立审查，Head `7f39cc27c7cbfd5f9587cc8881d725f767a8ac27`，Run `30739700515`／Job `91474768876`，Merge Commit `ffafaa8ac0c70f74cbf9b73ed0e43bd5aa7e6e56`。
- PR #906 完成 M7 受控执行低敏证据，Head `097a0e837c7afaf4a89c818cf5c6860aac0f08c9`，Run `30741583818`／Job `91479870752`，Merge Commit `58521283d6c28f3b7b6b0b4254109bb1340c5066`。
- PR #907 精确纠正六处 Git 证据归因，Head `571bbbdc8fe0a3b881edff25d1fbe10c27c81bd6`，Run `30741960782`／Job `91480843159`，Merge Commit `ceb7f8c3f75c06c93a845c2769cd59b199a46ebe`；没有重新连接数据库或重复 Migration。
- PR #908 完成 M7 执行独立审查，Head `1fccdb4a45b9d588c46745a57e2436ca12ef2cbb`，Run `30742394742`／Job `91482000103`，Merge Commit `1ecc84f4e3749adbd15822582d992352340a1d44`；结论为 `base02_membership_revision_m7_execution_review=passed`、`m7_execution_evidence_attribution=passed`。
- `0043` 已在固定 localhost-only local_acceptance 完成一次且仅一次授权 guarded 目标调用，自动重试与第二次目标调用均为 `0`；`planned／created／reused／conflict／unexpected=7／7／0／0／0`。
- 环境 journal 从 `43／0042` 推进到 `44／0043`，snapshot 保持 `0026`；`0043` 已消费且不得改写，后续问题只能通过独立 forward-fix。
- 六个无条件 current envelope 列均为 `NOT NULL`；Membership total／all-null／partial／complete 为 `1／0／0／1`，transition／exact current-head 为 `1／1`。
- Binding／Scope／Context Version／Context Head 保持 `1／1／1／1`；全部 `public` 表数据和序列未变化，业务 DML 为 `0`。
- active historical orphan／Scope relation orphan 保持 `1／1`；A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`，未执行 orphan 修复或 `VALIDATE`。
- Allocation Lease 和 Execution Lease 均已释放，Execution Lease claim／consume／renewal／release／active 为 `1／1／0／1／0`；client、进程、run lock、Helper、临时私有状态与隔离数据库残留为 `0`。
- 执行前后恢复点均通过同集群空隔离数据库的选定 schema／data 恢复；该证明不覆盖 ACL、全局角色、异集群或完整灾备。
- 自动本地运维元数据回显事件累计为 `2`；当前主动私有参数披露、Secret、Token、密码、私钥、PII 与真实凭证披露均为 `0`。
- M7 完成并收口；唯一下一任务冻结为 `BASE-B1 Owner／Port／revision 契约闭环`。BASE-B1 尚未独立关闭，BASE-B2～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断；七线正式发布保持 `0/7`。

## 2026-08-02：BASE-B1 Owner／Port／revision 契约闭环收口

- PR #909 完成 M7 handoff，Head `3d627c3c90cbd9da205bd2eeff80ffaed11b90ec`，Run `30742856457`／Job `91483266364`，Merge Commit `af58246675787536b6439404582d0b320ab4eba8`。
- PR #910 完成 BASE-B1 单文件关闭证据，Head `5fc7234daf6dd67fcaea72747a859aa081621b58`，Run `30743380150`／Job `91484669720`，Merge Commit `e01f62a2c413cb563c1ac3433f5cbac684147503`。
- PR #911 完成 BASE-B1 单文件独立审查，Head `8c440bc11e7c656e40146a1ca07ba34b996b7265`，Run `30743753276`／Job `91485660898`，Merge Commit `3a84c576f9c2a376c49964983d95cce9170164d6`；结论为 `base_b1_independent_review=passed`。
- BASE-B1 结论为 `base_b1_owner_port_revision_contract=all_exact`、`base_b1_runtime_change_required=false`；Access Control、Identity、Tenancy 与 Security 的 Owner／Port 边界及 Membership revision／Binding version／Scope revision 三个独立版本域完整。
- Owner 外 direct Membership Writer／Deleter、授权 `tenant_members.updated_at` 读取与时间戳兼容映射均为 `0／0`；Operating Context 未进入授权组合，第二授权事实源为 `0`，多 Membership 必须显式选择或失败关闭。
- BASE-B1 定向测试为 10 个文件、`344／344`；两个 PR 的真实 Required Check 均完整执行环境核对、依赖安装、架构自测、增量检查、lint、typecheck、完整测试和 build并成功。
- 本次四文件 docs-only handoff 的 Runtime、Schema、Migration、journal、snapshot、数据库、scripts、tests、CI、package 和 lock 修改均为 `0`。
- 继承状态未变：环境 journal 为 `44／0043`、snapshot 为 `0026`、active historical orphan／Scope relation orphan 为 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`。
- BASE-B1 完成并收口；唯一下一任务冻结为 `BASE-B2 Membership／Binding 生命周期`。BASE-B2 尚未启动，本 handoff 合并后按当前 ULTRA 授权和动态硬门继续。
- BASE-B3～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断；七线正式发布保持 `0/7`。

## 2026-08-02：BASE-B2 reactivate 安全修复与 M09-A provenance 决策收口

- PR #913 完成 Membership reactivate 的 active Binding 冲突保护，Head `b2dec88dad1d5033fd09e4a861029864f0f58b11`，Run `30744780046`／Job `91488404398`，Merge Commit `3194bc53fa5e0291d4a74f838b33e658c139d9b7`。
- PR #913 在 transaction-bound UoW 内先锁定 active Binding；存在任何 status=`active` 的 Binding 时均以 `binding_active_conflict` 失败关闭，Membership／Binding／evidence 写入为 `0`。实现只修改 2 个 Access Control 文件，定向测试 `21／21`、相关测试 `53／53` 通过。
- PR #914 接受 M09-A，Head `599b38526232c9005a867a43820087f646b75e7f`，Run `30745547158`／Job `91490427015`，Merge Commit `edc0bd8b5dacce08612b65f2dd2618fea176de58`。
- M09-A 绑定 `auth_account_institution_bindings` 为 Access Control 唯一 Binding canonical current／lifecycle history；Binding transition evidence 与 current 同 Owner、同事务、append-only，但不得回答 current 或成为第二套事实源。M09-B 的 current 冗余 `revokedBy／reason／reboundFrom` 不作为 BASE-B2 最小硬门。
- PR #915 完成独立审查，Head `b874b819d3dfbb927f8e54d96fcb48e860030ad9`，Run `30745968589`／Job `91491518552`，Merge Commit `85bac25f48f930f260dbed2ac9b8dd16b23cbe68`；结论为 `base02_binding_provenance_acceptance_review=passed`，F01～F05 全部关闭。
- 已冻结 provenanceSource／assignmentSource 分离、expire 受信任服务端时间、current identity／assignment 不可变、legacy calibration Shape、`UNIQUE (tenant_id, command_id)`、同事务 evidence 与 AQ008 扩展门禁。
- PR #914／#915 均为单文件 docs-only；Schema、Migration、journal、snapshot、数据库、Runtime、scripts、tests、CI、package 和 lock 修改为 `0`。
- 继承状态未变：环境 journal 为 `44／0043`、snapshot 为 `0026`、active historical orphan／Scope relation orphan 为 `1／1`，A2-P2 Scope FK 继续 `NOT VALID`／`convalidated=false`。
- BASE-B2 已启动但尚未完成；唯一下一任务冻结为 `BASE-B2 Binding transition evidence Schema／Migration 前置预检`，handoff 合并后按当前 ULTRA 授权和动态硬门继续。
- BASE-B3～B6、orphan 修复、FK `VALIDATE`、项目级 Writer、Audit／模板、MIG-01B／C 与业务 Reader 继续未启动或阻断；七线正式发布保持 `0/7`。


<!-- BASE02_BINDING_TRANSITION_PREFLIGHT_HISTORY_20260802 -->

## 2026-08-02：BASE-B2 Binding transition evidence 前置预检收口

- PR #917：Head `97c02f1250f5f5fbff468b17953074db5b67eb4c`，Merge Commit `77a626ed182230f91b6d27daeaa4b0f297b377d9`，Run `30750704426` 成功；
- 独立审查 PR #918：Head `749bb269393c50bc9638ab7f76f97b04df2a610b`，Merge Commit `32b08e5e7bca4331c421ac5a637a846a884e2bf1`，Run `30751540734` 成功；
- `binding_transition_evidence_preflight_review=passed`；
- `binding_physical_model_decision_required=false`；
- 未修改 Schema、Migration、Runtime 或数据库；
- 唯一下一任务切换为 Binding transition evidence Expand DDL Schema／Migration 实施。

<!-- BASE02_BINDING_TRANSITION_0044_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 Binding transition evidence `0044` 执行收口

- 实施 PR #920 与实施独立审查 PR #921 已合并；
- 执行恢复证据 PR #922：Merge Commit `8c0c7f9059a5b435b9440f40602a8d2927147b4f`；
- 执行独立审查 PR #923：Merge Commit `40256214931e5916e8566929003c3875cdb8698c`；
- `0044` 唯一受控执行成功，journal `44 → 45`；
- Catalog `all_missing → all_exact`；
- guarded command／automatic retry／second invocation：`1／0／0`；
- business DML／sequence advance：`0／0`；
- 执行前后恢复点及隔离恢复通过；
- 下一任务切换至 Binding Runtime Writer／same-transaction evidence 前置预检。

<!-- BASE02_BINDING_RUNTIME_WRITER_PREFLIGHT_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 Binding Runtime Writer 前置预检收口

- 前置预检 PR #925：Merge Commit `7de246bd41d8406a39647e2286985332558638df`；
- 独立审查 PR #926：Merge Commit `937281fa60e1f192445d8e06a7a4d9228bbf672a`；
- accepted path：`B2_W1_extend_existing_access_control_transaction_kernel`；
- 精确实施 allowlist：`13`；
- 实施准入：`true`；
- Runtime Writer：未启动；
- Schema／Migration 与数据库修改：`0`；
- 下一任务切换至 Binding Runtime Writer／same-transaction transition evidence 实施。

<!-- BASE02_BINDING_RUNTIME_WRITER_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 Binding Runtime Writer 实施收口

- 实施 PR #928：Merge Commit `105b79a172477815724e2e279e573994dae60560`；
- 独立审查 PR #929：Merge Commit `92b595f8618ce53f42cada5360c70cc4429c537f`；
- 下一任务切换至旧 Binding 写入口与 AQ008 前置预检。

<!-- BASE02_BINDING_WRITER_AQ008_PREFLIGHT_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 Binding writer AQ008 前置预检收口

- 前置预检 PR #931：Merge Commit `8aca6221163f7ca05b84bb1c2d50544c6b566044`；
- 独立审查 PR #932：Merge Commit `4df631e840e61042bfde6c93e72eab594edcb53b`；
- Owner 外 Binding Writer：`0`；
- legacy direct writers：`disabled_by_absence`；
- 精确实施 allowlist：`2`；
- 下一任务切换至 AQ008 Binding writer gate 扩展实施。

<!-- BASE02_AQ008_BINDING_WRITER_GATE_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 AQ008 Binding writer gate 实施收口

- 实施 PR #934：Merge Commit `4b55323ffeb20beb514cb9409b0701d21a334543`；
- 独立审查 PR #935：Merge Commit `cd8cc1b8438038e2e330697a4ae8961dd63c9cec`；
- Membership／Binding current／Binding evidence 共用 AQ008 Owner gate；
- Owner 外 Binding Writer：`0`；
- Runtime／Schema／Migration／数据库执行：`0`；
- 下一任务切换至 deterministic legacy Binding calibration DML Migration 前置预检。

<!-- BASE02_BINDING_LEGACY_CALIBRATION_PREFLIGHT_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 legacy Binding calibration 前置预检收口

- 前置预检 PR #937：Merge Commit `d00519e2efe1e9fa637176a46779265512378f9b`；
- 独立审查 PR #938：Merge Commit `9e63f7414b215647f9d8642c83cf288f2e2aad01`；
- latest Migration：0044；next idx 未预留；
- implementation allowlist：3；
- database connection／DML execution：0；
- 下一任务切换至 deterministic legacy Binding calibration DML Migration 实施。

<!-- BASE02_BINDING_LEGACY_CALIBRATION_IMPLEMENTATION_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 Binding legacy calibration Migration 实施收口

- 实施 PR #940：Merge Commit `b18c4fb111ed4f1828e6846b3811be0e32020fac`；
- 独立审查 PR #941：Merge Commit `855d1147e45b0015515aeec0d8cde3f8fcb79d0b`；
- Migration：0045；精确实施文件：3；
- database connection／Migration execution／DML execution：0；
- 下一任务切换至 deterministic legacy Binding calibration DML Migration 执行准备。

<!-- BASE02_BINDING_LEGACY_CALIBRATION_EXECUTION_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 Binding legacy calibration 0045 执行收口

- 执行证据 PR #943：Merge Commit `b575180a84dee3a8a1b60606835492e2d693cd15`；
- 执行独立审查 PR #944：Merge Commit `6f2ca447cbc25db4f4567d7ac941487088d6c885`；
- guarded target call／automatic retry：1／0；
- planned／created／reused／conflict／unexpected：1／1／0／0／0；
- environment journal：46／0045；
- exact legacy evidence／residual candidate：1／0；
- unauthorized business mutation：0；
- 下一任务切换至 Binding 高水位／冲突／Owner Writer 清零复核。

<!-- BASE02_B2_FINAL_CLOSURE_RELEASE_20260803 -->

## 2026-08-03｜BASE-B2 Membership／Binding 生命周期最终收口

- 清零复核 PR #946：Merge Commit `541853c8a6bb945b37e25f34a77858a323e5d63c`；
- 独立审查 PR #947：Merge Commit `0410d30565084b286bced4538188b582ed9ca524`；
- residual／conflict／Owner outside／destructive evidence／second source：全部为 0；
- legacy Binding calibration：完成；
- historical orphan：未修改；Scope FK：NOT VALID；
- BASE-B2：完成；
- 唯一下一任务切换至 BASE-B3 正式 Session／上下文刷新及三类 revision 实时重读前置预检。

<!-- BASE02_B3_SESSION_REVISION_PREFLIGHT_RELEASE_20260803 -->

## 2026-08-03｜BASE-B3 Session／revision 实时重读前置预检收口

- 前置预检 PR #949：Merge Commit `56162452faf974c041994efd946c64a7aff6d543`；
- 独立审查 PR #950：Merge Commit `d18bbfac952608ec8e5cd5df696d1aa985e0a92b`；
- login／session restore／request authorization roots：all exact；
- Membership／Binding／Scope realtime read：all exact；
- cookie／claims：selector only；
- Runtime 变更需要／implementation allowlist：false／0；
- 下一任务切换至 BASE-B3 契约关闭证据。

<!-- BASE02_B3_FINAL_CLOSURE_RELEASE_20260803 -->

## 2026-08-03｜BASE-B3 正式 Session／三类 revision 实时重读最终收口

- 契约关闭证据 PR #952：Merge Commit `12f9dd928aca1899a40d2460c402ce1276add66f`；
- 独立关闭审查 PR #953：Merge Commit `251004bb840e64f84c0ee9d0b1b281696772bdac`；
- login／session restore／request authorization roots：all exact；
- Membership／Binding／Scope realtime read 与双轮稳定性比较：all exact；
- cookie／claims selector only；第二授权 current：0；
- Runtime 变更需要／implementation allowlist：false／0；
- BASE-B3：完成；
- 唯一下一任务切换至 BASE-B4 入口／业务／对象 Guard 与绕过闭环前置预检。

<!-- BASE02_B4_GUARD_BYPASS_PREFLIGHT_RELEASE_20260803 -->

## 2026-08-03｜BASE-B4 Guard／绕过闭环前置预检收口

- 前置预检 PR #955：Merge Commit `e0d425741fc65fec58408c2319e1d0e8ddc73121`；
- 独立审查 PR #956：Merge Commit `79f52149feea8c1a056b91061228f2230f625059`；
- Scope／Section／Navigation Guard：current；
- Object Guard／Action Policy：missing／missing；
- accepted path：B4_G1_capability_off_object_action_guard；
- implementation allowlist：10；
- 下一任务切换至 BASE-B4 Action Policy／Object Guard capability-off 核心实施。

<!-- BASE02_B4_OBJECT_ACTION_GUARD_CORE_RELEASE_20260803 -->

## 2026-08-03｜BASE-B4 Action Policy／Object Guard capability-off 核心实施

- 实施 PR #958：Merge Commit `79f2a028b3173d14f5cb9be67d9c5b5ba1a2f380`；
- 独立审查 PR #959：Merge Commit `b3ef28c76732b813957b4fcdb578ad7faa2afe0d`；
- object fact Port／Action Policy／Object Guard：implemented；
- request authorization object／action methods：2；
- business Reader／Capability：off；
- changed files：10；
- 下一任务切换至机构端入口清单校准与第一批正式 Route Guard 接线前置预检。

<!-- BASE02_B4_ROUTE_GUARD_FIRST_BATCH_PREFLIGHT_RELEASE_20260803 -->

## 2026-08-03｜BASE-B4 第一批正式 Route Guard 接线前置预检

- 前置预检 PR #961：Merge Commit `e18dab5e96540a0ccd7b58fbd1110bdd652cedac`；
- 独立审查 PR #962：Merge Commit `3978f203b8b9845e43fede6a0b86e2b53b129e17`；
- first batch count：5；
- guard chain：Scope + Section；
- business Reader／Capability：off；
- implementation allowlist：12；
- 下一任务切换至第一批低风险正式 Route Guard capability-off 接线实施。

<!-- BASE02_B4_ROUTE_GUARD_FIRST_BATCH_IMPLEMENTATION_RELEASE_20260804 -->

## 2026-08-04｜BASE-B4 第一批正式 Route Guard 接线实施收口

- 实施 PR #964：Merge Commit `7798926a8f81475de9ba8f9155fab74972c01892`；
- 独立审查 PR #965：Merge Commit `eb89e44ae6a86a4543ce34f2f74df2678401efea`；
- first batch：5；
- guard chain：Scope + Section；
- Guard denial：403 / no-store；
- authorized handler contract：preserved；
- production／test／changed files：6／14／20；
- business Reader／Capability：off；
- 下一任务切换至剩余正式 Route 再校准与第二批低风险 Route Guard 前置预检。

<!-- BASE02_B4_ROUTE_GUARD_SECOND_BATCH_PREFLIGHT_RELEASE_20260804 -->

## 2026-08-04｜BASE-B4 第二批低风险 Route Guard 前置预检

- 前置预检 PR #967：Merge Commit `3670fcb66d99100b73dcc1fc12d4fc10c9490319`；
- 独立审查 PR #968：Merge Commit `1a48cd46923958cbcbbcf182af43f4d2e8229dc4`；
- second batch：5；
- guard chain：Scope + Section；
- compatibility tests：5；
- implementation allowlist：15；
- shared Guard change：false；
- business Reader／Capability：off；
- 下一任务切换至第二批低风险正式 Route Guard capability-off 接线实施。

<!-- BASE02_B4_ROUTE_GUARD_SECOND_BATCH_IMPLEMENTATION_RELEASE_20260804 -->

## 2026-08-04｜BASE-B4 第二批正式 Route Guard 接线实施收口

- 实施 PR #970：Merge Commit `9fb9fb90b81bdae9a8195feab96ef302180546df`；
- 独立审查 PR #971：Merge Commit `ca5c63de03101b098a491ad695bc8ab0fee7318a`；
- second batch：5；
- guard chain：Scope + Section；
- Guard denial：403 / no-store；
- authorized handler：原 503 capability-off contract 保持；
- changed files：15；
- shared Guard change：0；
- business Reader／Capability：off；
- 下一任务切换至剩余 4 个低风险正式 Route 再校准与第三批 Route Guard 前置预检。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_PREFLIGHT_RELEASE_20260804 -->

## 2026-08-04｜BASE-B4 第三批低风险 Route Guard 前置预检

- 前置预检 PR #973：Merge Commit `20ed0651072f2f87961038b8ce0e11f775d3a0e8`；
- 独立审查 PR #974：Merge Commit `9d6492fcbb55ae88fd9fa4eac87c48ea4fd671ff`；
- third batch：4；
- guard chain：Scope + Section；
- compatibility tests：4；
- runtime callers：3；
- implementation allowlist：12；
- shared Guard change：false；
- business Reader／Capability：off；
- 下一任务切换至第三批低风险正式 Route Guard capability-off 接线实施。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_SCOPE_CORRECTION_RELEASE_20260804 -->

## 2026-08-04｜BASE-B4 第三批 Route Guard 前置范围校正

- 校正 PR #976：Merge Commit `bdae4c00cf18fac782291266e6ba51aad54f99d2`；
- 独立审查 PR #977：Merge Commit `fe9f4170f1e2f9a7f2dcddcc176c200ddad25e59`；
- 新增传递兼容性测试：1；
- compatibility tests：5；
- implementation allowlist：13；
- production scope change：0；
- shared Guard change：false；
- 下一任务仍为第三批低风险正式 Route Guard capability-off 接线实施。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_SCOPE_CORRECTION_02_RELEASE_20260804 -->

## 2026-08-04｜BASE-B4 第三批 Route Guard 前置范围第二次校正

- 校正 PR #979：Merge Commit `2f7cd73cc169fb6c9734353c399f9728a5adbe13`；
- 独立审查 PR #980：Merge Commit `60eda4898b818691cc6155260ec261b0db365ca0`；
- 新增遗漏兼容性测试：2；
- compatibility tests：7；
- implementation allowlist：15；
- production scope change：0；
- shared Guard / v1 re-export change：0；
- 下一任务仍为第三批低风险正式 Route Guard capability-off 接线实施。

<!-- BASE02_B4_ROUTE_GUARD_THIRD_BATCH_IMPLEMENTATION_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 第三批正式 Route Guard 接线实施收口

- 第二次范围校正 PR #979：Merge Commit `2f7cd73cc169fb6c9734353c399f9728a5adbe13`；
- 校正独立审查 PR #980：Merge Commit `60eda4898b818691cc6155260ec261b0db365ca0`；
- corrected handoff PR #981：Merge Commit `b33e5e3d382bc637381e8face65ecb544c21d805`；
- 实施 PR #982：Merge Commit `772af8bd31bcf8e2a3998133bee996d419eed1f8`；
- 独立实施审查 PR #983：Merge Commit `32afafa3cee544315bc54275a3c7c216d2ef862a`；
- third batch：4；
- 三批累计正式 Route Guard：14；
- Guard chain：Scope + Section；
- Guard denial：403 / no-store；
- authorized handler：原 503 capability-off contract 保持；
- changed files：15；
- shared Guard / v1 re-export change：0；
- business Reader／Capability：off；
- 下一任务切换至全量入口 Guard／绕过闭环终检与剩余生命周期入口前置预检。

<!-- BASE02_B4_FULL_ENTRY_BYPASS_CLOSURE_PREFLIGHT_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 全量入口 Guard／绕过闭环终检前置预检

- 前置预检 PR #985：Merge Commit `51c299ba231bae5e79df4a67defc4417804c079e`；
- 独立审查 PR #986：Merge Commit `b21d775d72774c5e205f21d18e67e89d88cca285`；
- formal guarded Routes：14；
- route review candidates：56；
- capability-off unwired：52；
- Owner outside direct Writer／Deleter：1；
- lifecycle unresolved：4；
- BASE-B4 completion candidate：false；
- business Reader／Capability：off；
- 下一任务切换至：`BASE-B4 Owner 外 Membership／Binding Writer／Deleter 关闭前置预检`。

<!-- BASE02_B4_OWNER_WRITER_FALSE_POSITIVE_CALIBRATION_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 Owner 外 Writer／Deleter 静态误报校准

- 校准 PR #988：Merge Commit `cfb685c04f1f6f137d85fee2197038bcf8c60fc7`；
- 独立审查 PR #989：Merge Commit `7eb0b12c3fbbbd8b9b6c0d6d390ca3a0deb83534`；
- false positives：4；
- corrected Owner outside direct Writer／Deleter：0；
- corrected lifecycle unresolved：0；
- production change：0；
- business Reader／Capability：off；
- 下一任务切换至：`BASE-B4 剩余 capability-off 正式 Route 第四批精确校准前置预检`。

<!-- BASE02_B4_ROUTE_GUARD_FOURTH_BATCH_PREFLIGHT_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 第四批低风险 Route Guard 精确校准

- 前置预检 PR #991：Merge Commit `17406553aebf1edee4230fd3d32942d61edcaba3`；
- 独立审查 PR #992：Merge Commit `54b0997d9ce4ca62db291fd6e9c8a12547f78729`；
- broad capability-off：70；
- strict eligible：1；
- fourth batch：1；
- implementation allowlist：3；
- production change：0；
- business Reader／Capability：off；
- 下一任务切换至：`BASE-B4 第四批低风险正式 Route Guard capability-off 接线实施`。

<!-- BASE02_B4_ROUTE_GUARD_FOURTH_BATCH_IMPLEMENTATION_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 第四批正式 Route Guard 接线实施收口

- 实施 PR #994：Merge Commit `c6fa9245b703c0aaf7074c8e2be8d86f9a40c184`；
- 独立审查 PR #995：Merge Commit `d6865fa1f7ebabfcec52daf61c61e976631492cf`；
- fourth batch：1；
- formal guarded Routes：15；
- Section：system；
- Guard denial：403 / no-store；
- authorized handler：原 410 capability-off contract 保持；
- changed files：3；
- shared Guard change：0；
- business Reader／Capability：off；
- 下一任务切换至 BASE-B4 剩余正式入口分类校准与完成审计前置预检。

<!-- BASE02_B4_REMAINING_ENTRY_CLASSIFICATION_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 剩余正式入口分类校准收口

- 前置预检 PR #997：Merge Commit `78332c5add509bf2bcfb824e72c6daa339adac21`；
- 独立审查 PR #998：Merge Commit `bf85ef84537e91ca965815787fe39b4693e52003`；
- routes：81；
- formal guarded Routes：15；
- policy confirmation required：0；
- governance required：66；
- strict candidates：0；
- completion audit ready：false；
- 下一任务：`BASE-B4 剩余高风险正式入口治理决策`。

<!-- BASE02_B4_HIGH_RISK_ENTRY_GOVERNANCE_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 剩余高风险正式入口治理决策收口

- 治理决策 PR #1000：Merge Commit `471d3cbf83a37cb9851755c0224e19832c25f6fc`；
- 独立审查 PR #1001：Merge Commit `6aed9aecebe41b094cbde4f50f96fc95abff30be`；
- routes：81；
- formal guarded Routes：15；
- governance required：66；
- readonly dynamic object first slice：9；
- CSV physical newline repair：passed；
- production／database／migration／DML：0；
- 下一任务：`BASE-B4 只读动态对象正式入口 Object Guard 精确预检`。

<!-- BASE02_B4_READONLY_DYNAMIC_OBJECT_GUARD_PREFLIGHT_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 只读动态对象 Object Guard 精确预检收口

- 前置预检 PR #1003：Merge Commit `1e647a0db7f072853103d47c596fd47a23748f8e`；
- 独立审查 PR #1004：Merge Commit `806c6b4d9c5d32202c5762f610a143d23cbabaf2`；
- routes：9；
- supported direct object routes：4；
- unsupported／compound routes：5；
- implementation eligible：0；
- production Object Fact Reader Adapter：0；
- Runtime objectFactReader null：true；
- 下一任务：`BASE-B4 客户对象事实 Reader 前置设计与准入`。

<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_DESIGN_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 客户对象事实 Reader 设计准入收口

- 设计准入 PR #1006：Merge Commit `ae9a8719d886db4ba301fea32a5061aa9c5f188d`；
- 独立审查 PR #1007：Merge Commit `dc04d28bdf53bd89ec8ef28cec286b1bf054db4c`；
- admission：approved_with_exact_allowlist；
- semantic owner：src/modules/customers；
- implementation allowlist：8；
- Schema／Migration／Route wiring：0；
- production／database／DML：0；
- 下一任务：`BASE-B4 客户对象事实 Reader 核心实施`。


<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_AQ007_AMENDMENT_RELEASE_20260805 -->

## 2026-08-05｜BASE-B4 客户对象事实 Reader AQ007 架构修正

- 触发：`AQ007_CROSS_MODULE_SERVER_REPOSITORY`；
- 修正：Customers Application → Security Application façade；
- allowlist：7 → 8；
- architecture exception：0；
- Route／Policy／Schema／Migration／database execution：0。

<!-- BASE02_B4_CUSTOMER_OBJECT_FACT_READER_CORE_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 客户对象事实 Reader 核心实施收口

- AQ007 修正规范 PR #1009：Merge Commit `f30ce93ae33503ae809fa9a7bdd31c9fe9958a7e`；
- 核心实施 PR #1010：Merge Commit `d1608b0898689b2fb9fd0ef135719b44f41024c7`；
- 独立审查 PR #1011：Merge Commit `1b49e7f9eb4648e8701e14a5583a7e48ecb75772`；
- implementation file count：8；
- Security Application façade：implemented；
- architecture exception：0；
- production Object Fact Reader Adapter：1；
- Runtime reader wired／lazy：true／true；
- customer Route wiring：0；
- Schema／Migration／Seed／database execution：0；
- 下一任务：`BASE-B4 客户只读动态对象 Route Object Guard 接线前置预检`。

<!-- BASE02_B4_CUSTOMER_ROUTE_OBJECT_GUARD_PREFLIGHT_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 客户 Route Object Guard 前置预检收口

- 前置预检 PR #1013：Merge Commit `d2ebbba20de588fce4f9303704005943118dd100`；
- 独立审查 PR #1014：Merge Commit `75313609f776f39abea8cbefac89e5556093dbbc`；
- customer routes：3；
- current Section/Object wiring：0／0；
- fresh Authorization per gate：frozen；
- first slice：客户完整时间线；
- first-slice allowlist：4；
- production／Route wiring／Capability release：0；
- 下一任务：`BASE-B4 客户完整时间线 Route Object Guard 最小接线`。

<!-- BASE02_B4_CUSTOMER_TIMELINE_OBJECT_GUARD_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 客户完整时间线 Object Guard 最小接线收口

- 实施 PR #1016：Merge Commit `8ee7007a38cce52bab664dd609b2e93ff7073b2a`；
- 独立审查 PR #1017：Merge Commit `f66bbfbd1a8ccc29d33be2954eb760ce9fe236ea`；
- implementation files：4；
- shared Object Route Guard：implemented；
- current customer Section/Object wiring：1／1；
- remaining unwired customer Routes：2；
- 原 503 capability-disabled Handler：保留；
- business Capability／Schema／Migration／database execution：0；
- 下一任务：`BASE-B4 客户随访概览 Route Object Guard 接线前置准入`。

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_OVERVIEW_OBJECT_GUARD_ADMISSION_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 客户随访概览 Object Guard 准入收口

- 准入 PR #1019：Merge Commit `4fa1c0af8910ab8defee40d68fc4138b55cdf73d`；
- 独立审查 PR #1020：Merge Commit `7c5f9dd99d9ad75a452f8c2def88c915a105cd60`；
- current customer Section/Object wiring：1／1；
- followup overview current wiring：0／0；
- implementation allowlist：2；
- shared Guard change：forbidden；
- production／Route wiring／Capability release：0；
- 下一任务：`BASE-B4 客户随访概览 Route Object Guard 最小接线`。

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_OVERVIEW_OBJECT_GUARD_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 客户随访概览 Object Guard 最小接线收口

- 实施 PR #1022：Merge Commit `c137a4ff73ea3298c0a89eb917ff38b3eb75ebc8`；
- 独立审查 PR #1023：Merge Commit `f21f77ac21be66810aca688f7e1de27aba96de67`；
- implementation files：2；
- shared Object Route Guard：reused unchanged；
- current customer Section/Object wiring：2／2；
- remaining unwired customer Routes：1；
- 原 503 capability-disabled Handler：保留；
- business Capability／Schema／Migration／database execution：0；
- 下一任务：`BASE-B4 客户随访时间线 Route Object Guard 接线前置准入`。

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_TIMELINE_OBJECT_GUARD_ADMISSION_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 客户随访时间线 Object Guard 接线准入收口

- 准入 PR #1025：Merge Commit `fbe04ffa90fb64ffe0046cca3fdd941509f2f997`；
- 独立审查 PR #1026：Merge Commit `414ed67e50fdef1ce07377599a2542d0023ce693`；
- current customer Section/Object wiring：2／2；
- followup timeline current wiring：0／0；
- implementation allowlist：2；
- shared Guard change：forbidden；
- production／Route wiring／Capability release：0；
- 下一任务：`BASE-B4 客户随访时间线 Route Object Guard 最小接线`。

<!-- BASE02_B4_CUSTOMER_FOLLOWUP_TIMELINE_OBJECT_GUARD_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 客户三路 Object Guard 接线收口

- 实施 PR #1028：Merge Commit `f36eced8f9631b99e6576dc66d18f4023375c8be`；
- 独立审查 PR #1029：Merge Commit `3a9a752527c274d7b057c1cdf418beec85a58da7`；
- current customer Section/Object wiring：3／3；
- remaining unwired customer Routes：0；
- 三条原 503 capability-disabled Handler：保留；
- business Capability／Schema／Migration／database execution：0；
- 下一任务：`BASE-B4 全量入口 Guard／绕过闭环终检复算`。

<!-- BASE02_B4_FULL_ENTRY_BYPASS_FINAL_RECOMPUTE_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 全量入口终检复算收口

- 终检复算 PR #1031：Merge Commit `3fc7019b292a76854844f0882580fc98e0b693c1`；
- 独立审查 PR #1032：Merge Commit `8824524652a7eafad2fa71fc2d98a6a916af79d7`；
- API Route：81；
- formal guarded／governed fail-closed／ungoverned：18／63／0；
- customer Section/Object wiring：3／3；
- Owner outside direct Writer／lifecycle unresolved：0／0；
- BASE-B4 completion candidate：true；
- BASE-B4 complete：false；
- 下一任务：`BASE-B4 完成审计与 BASE-B5 historical orphan 处置分支决策前置规划`。

<!-- BASE02_B4_COMPLETION_BASEB5_ORPHAN_PREPLAN_RELEASE_20260806 -->

## 2026-08-06｜BASE-B4 完成与 BASE-B5 orphan 决策前置规划收口

- 完成审计 PR #1034：Merge Commit `b59505681ba6230b00c44e59911e0a5c5380a49a`；
- 独立审查 PR #1035：Merge Commit `740b55d08a7bf83ee2efcc636ed4b72bf65dcb60`；
- BASE-B4 completion criteria：12／12；
- BASE-B4：complete；
- BASE-B5 decision preplanning：ready；
- historical orphan remediation：未授权；
- database／DML／Reader／Capability：0；
- 下一任务：`BASE-B5 historical orphan 权威处置分支决策与证据准入`。
