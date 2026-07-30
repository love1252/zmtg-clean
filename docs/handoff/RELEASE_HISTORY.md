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
