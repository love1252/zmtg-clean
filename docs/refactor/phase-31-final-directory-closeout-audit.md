# 第三十一阶段：最终目录重构闭环审计

- 日期：2026-07-27
- 审计基线：`5ecc41dea5fe4ef0ba33731137449a875d32bb34`
- 迁移矩阵初始基线：`1613c4b320b185fb1ebe79dbc9899be4acca647d`
- 执行模式：`audit_only`
- 生产源码、测试、脚本、配置和原迁移矩阵修改：0
- 最终决策：`closed`
- 阻断项数量：0
- 初始发现项数量：17
- 经复核非阻断项：17

## 一、全仓文件盘点

- Git 跟踪文件：1528
- `src/` 文件：959
- 代码依赖图节点：969
- 已解析内部依赖边：2607
- 当前循环依赖组：3
- 已知组成：机构端 2 组、开放平台 1 组
- 处置：均已在既有阶段归入 `protected_boundary`
- 涉及重构后变更源码的循环组：0

### 顶层目录

| 目录 | 文件数 |
|---|---:|
| `src` | 959 |
| `docs` | 472 |
| `drizzle` | 55 |
| `scripts` | 14 |
| `public` | 11 |
| `.claude` | 3 |
| `.env.example` | 1 |
| `.gitignore` | 1 |
| `AGENTS.md` | 1 |
| `CLAUDE.md` | 1 |
| `README.md` | 1 |
| `drizzle.config.ts` | 1 |
| `eslint.config.mjs` | 1 |
| `next-env.d.ts` | 1 |
| `next.config.ts` | 1 |
| `package.json` | 1 |
| `pnpm-lock.yaml` | 1 |
| `postcss.config.mjs` | 1 |
| `tsconfig.json` | 1 |
| `vitest.config.ts` | 1 |

### `src/` 主要区域

| 区域 | 文件数 |
|---|---:|
| `src/modules/institution` | 323 |
| `src/modules/open-platform` | 186 |
| `src/app` | 161 |
| `src/modules/security` | 39 |
| `src/modules/workspace` | 29 |
| `src/modules/institution-conversations` | 24 |
| `src/modules/knowledge-base` | 24 |
| `src/modules/institution-contracts` | 22 |
| `src/modules/institution-workbench` | 22 |
| `src/modules/auth` | 20 |
| `src/modules/institution-system` | 20 |
| `src/modules/institution-analytics` | 18 |
| `src/modules/care` | 14 |
| `src/modules/customer-center` | 14 |
| `src/modules/audit` | 12 |
| `src/server` | 10 |
| `src/modules/institution-knowledge` | 8 |
| `src/modules/marketing` | 4 |
| `src/shared` | 3 |
| `src/modules/deployment` | 2 |
| `src/modules/platform-homepage` | 2 |
| `src/modules/branding` | 1 |
| `src/test` | 1 |

## 二、迁移矩阵最终对账

- 矩阵记录：1509
- 矩阵中对应 Git 跟踪文件：1409
- 矩阵中本地存在但未跟踪的路径：87
- 已由后续移动／删除解释的缺失旧路径：6
- 自动检测的历史元数据缺失路径：7（均已在第六节解释为非阻断）
- 矩阵重复 `current_path`：0
- 基线后新增且不在原矩阵的受治理文件：119
- 基线时已跟踪但未纳入矩阵的文件：0

### 状态分布

| 状态 | 数量 |
|---|---:|
| `boundary_confirmed` | 5 |
| `completed` | 10 |
| `dormant_boundary_confirmed` | 1 |
| `ownership_confirmed` | 25 |
| `pending` | 1455 |
| `runtime_boundary_confirmed` | 10 |
| `script_boundary_confirmed` | 1 |
| `seed_entry_boundary_confirmed` | 1 |
| `seed_guard_boundary_confirmed` | 1 |

### 风险分布

| 风险 | 数量 |
|---|---:|
| `high` | 693 |
| `low` | 574 |
| `medium` | 242 |

## 三、正式源码移动与旧路径

| 试点 | 旧路径存在 | 新路径存在 | 结论 |
|---|---:|---:|---|
| 预约纯领域 | 否 | 是 | 通过 |
| 套餐额度只读服务 | 否 | 是 | 通过 |
| 租户套餐变更领域 | 否 | 是 | 通过 |

- 源码中的旧路径引用：0
- 内部 import 无法解析：0
- 自动检测的孤立候选：5（均已在第六节解释为稳定入口或休眠注册表）
- 涉及变更源码的精确重复运行时组：0

## 四、机构端与开放平台治理分类

### 机构端

- `total`：323
- `completed_pilot`：2
- `defer`：8
- `keep_current`：195
- `migrate_candidate`：22
- `protected_boundary`：96

### 开放平台

- `total`：186
- `completed_pilot`：1
- `defer`：1
- `keep_current`：27
- `migrate_candidate`：1
- `protected_boundary`：156

## 五、交接入口与风险证据

- 自动检测的历史路径引用：5（均已在第六节解释为迁移历史）
- R01—R08 风险编号缺失：0
- 风险证据路径缺失：0

## 六、初始发现项复核

初始自动审计产生 17 个发现项。逐项复核后，全部属于审计模型未覆盖治理语义造成的非阻断发现，真实阻断为 0。

### 既有循环依赖复核（3 组）

- 机构端既有循环依赖：2 组，涉及 8 个文件；
- 开放平台既有循环依赖：1 组，涉及 8 个文件；
- 三组均已在第二十二、第二十六和第二十八阶段归入保护边界；
- 本轮三个正式源码迁移试点及第三十阶段认证修复均未进入这些循环组；
- 涉及重构后变更源码的循环组：0。

处置：`explained_nonblocking_protected_boundary`。

这些循环依赖属于已知受保护技术债，不是第三十一阶段新发现，也不授权在最终审计分支中进行跨模块 runtime 重构。

### `.DS_Store` 历史矩阵噪声（7）

以下路径只存在于初始本地文件快照／迁移矩阵，不属于 Git 跟踪文件，当前文件系统中也已不存在：

- `.claude/.DS_Store`
- `.gitnexus/.DS_Store`
- `docs/design/.DS_Store`
- `docs/superpowers/.DS_Store`
- `drizzle/.DS_Store`
- `public/.DS_Store`
- `var/.DS_Store`

处置：`explained_nonblocking_metadata_noise`。

这些记录用于保留初始盘点事实，不要求恢复或迁移 macOS 系统元数据，也不构成目录重构阻断。

### 稳定兼容入口与休眠注册表（5）

- `scripts/deploy-test-server.mjs`
- `scripts/run-next.mjs`
- `scripts/run-vitest.mjs`
- `scripts/runtime-node.mjs`

四个根目录脚本是第三、第四阶段明确保留的稳定兼容入口。前三个由 `package.json` 命令直接引用；四个入口均指向已下沉的实际实现。自动依赖图只统计代码 import，未将 `package.json` 命令和稳定 CLI 入口计为 inbound，因此产生孤立误报。

- `src/modules/branding/brand-assets.ts`

该文件是第二阶段静态资源去重后明确保留的 typed 品牌资源注册表。当前无静态代码调用方，但职责明确、内容低风险，作为 `keep_current_dormant_asset_registry` 保留；不需要为了消除“孤立”指标而删除。

处置：`explained_nonblocking_stable_entry_or_registry`。

### 迁移历史旧路径（5 次引用，3 个唯一旧路径）

- `src/modules/institution/domain/appointments.ts`
- `src/modules/institution/server/package-ai-quota-readonly-source.ts`
- `src/modules/open-platform/domain/tenant-plan-change.ts`

这些路径出现在交接文档中，用于记录三个正式业务源码试点的“原路径 → 当前路径”历史，不是当前文件链接。三个旧路径均已不存在，对应新路径均存在，源码旧 import 已归零。

处置：`explained_nonblocking_historical_migration_reference`。

### 复核结果

- 初始发现项：17
- 已解释非阻断项：17
- 真实旧路径／错误 import：0
- 真实孤立 runtime 文件：0
- 真实重复 runtime 实现：0
- 需要独立修复分支的阻断项：0


## 七、最终架构结论

- 当前架构继续采用模块化单体，不为追求目录形式而强制拆分微服务。
- 已完成 3 个正式业务源码单文件迁移；移动文件的旧路径、调用方和依赖状态已纳入本次复核。
- 机构端、开放平台、API、跨模块职责、数据库和 Demo 安全边界均已有治理分类。
- `pending`、`keep_current`、`protected_boundary` 和延期项属于受治理 backlog，不等同于必须立即迁移。
- 第三十一阶段不批量移动业务源码；发现真实阻断时必须另建精确白名单分支。

## 八、阶段结论

- 目录、迁移矩阵、旧路径、内部 import、既有循环依赖、交接入口和 R01—R08 证据均已有明确结论，未发现未解释阻断。
- 初始 17 个自动发现项已全部复核为已解释非阻断项。
- 所有路线图领域均已闭环、保护或明确延期。
- 第三十一阶段：`closed`。
- 第十七至第三十一阶段目录重构任务：`completed`。
- 后续可迁移候选只作为非阻断技术债，不再属于本轮目录重构必做范围。

## 九、docs-only 文件数量例外

本阶段采用 5 个 Markdown 文件的单主题原子更新，超过 `AGENTS.md` 中 docs-only 原则上的 2—3 文件建议，原因如下：

1. 最终审计证据、实际架构状态、当前状态、下一任务和发布历史共同构成最终闭环；
2. 拆分会导致架构、交接和历史记录短暂不一致；
3. 全部修改均为 Markdown 文档，未夹带 runtime、配置、矩阵或依赖改动；
4. 单提交可整体回退。
