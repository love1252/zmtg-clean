# 项目重构历史

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
