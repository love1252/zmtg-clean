# 第十八阶段：API 调用方与兼容策略基线

- 日期：2026-07-26
- 分支：`docs/api-caller-compatibility-baseline-20260726-175645`
- 基线：`5332a26f6aa71b91dfb4f3fe442566b31530bf10`
- 全仓 `route.ts`：145
- 路由族：144
- 版本化路由：56
- 非版本化路由：89
- 精确版本化／非版本化重叠族：1
- 主 `API_VERSION_REVIEW`：146
- 辅助治理标记：2
- 治理追踪记录：148
- 正式 API 文件移动：0
- API 源码修改：0
- 迁移矩阵修改：0

## 目标

建立统一的 API 调用方证据、兼容期、退役条件、最低观测要求和回退要求，为第十九阶段单一路由族试点设计提供依据。

本阶段只做审计和规划，不新增、删除、重命名、代理、重定向或移动任何 API 路由。

## 权威输入

- `docs/refactor/phase-12-full-api-route-inventory.csv`
- `docs/refactor/phase-12-full-api-family-summary.csv`
- `docs/refactor/phase-11-api-version-route-inventory.csv`
- `docs/refactor/file-migration-matrix.csv`
- `docs/refactor/api-version-governance-auxiliary-markers.csv`

## 覆盖完整性

| 项目 | 数量 |
|---|---:|
| Git 实际 `src/app/api/**/route.ts` | 145 |
| 逐路由兼容基线 | 145 |
| 路由族兼容基线 | 144 |
| 主治理候选 | 146 |
| 其中主治理 route.ts | 143 |
| 主治理非路由支持文件 | 3 |
| 辅助治理 route.ts | 2 |
| 治理追踪总记录 | 148 |

145 个 route.ts 均恰好属于以下一种治理范围：

- 主 `API_VERSION_REVIEW`；
- `supplemental_non_overriding` 辅助治理标记。

## 调用方证据模型

调用方分为：

1. 页面或组件；
2. 其他运行时代码；
3. 测试；
4. 脚本；
5. 产品文档；
6. 仓库外未知客户端。

| 证据 | 有证据的路由数 |
|---|---:|
| 页面或组件 | 56 |
| 其他运行时代码 | 49 |
| 测试 | 141 |
| 脚本 | 1 |
| 产品文档 | 93 |

调用方扫描只代表仓库内可见证据下限。动态 URL、配置生成路径、网关重写和仓库外客户端仍统一标记为 `external_unknown_possible`。

产品文档扫描排除了 `docs/refactor/`，避免治理清单对自身形成循环引用。

## 兼容策略

| 策略 | 路由数 | 路由族数 |
|---|---:|---:|
| `KEEP_CURRENT`（保持当前） | 54 | 54 |
| `REQUIRE_COMPATIBILITY_ENTRY`（需要兼容入口） | 21 | 21 |
| `REQUIRE_CLIENT_MIGRATION`（需要客户端迁移） | 64 | 64 |
| `REQUIRE_OBSERVE_BEFORE_RETIRE`（需要观测后退役） | 2 | 2 |
| `BLOCK_MANUAL_DECISION`（阻断，等待人工决策） | 4 | 3 |

### `KEEP_CURRENT`

当前版本化入口保持不变，不因缺少非版本化入口而自动创建兼容路径。

### `REQUIRE_COMPATIBILITY_ENTRY`

当前为非版本化唯一入口，仓库内未发现运行时调用，但存在测试、文档或外部未知客户端风险。后续若引入版本化入口，原路径必须在兼容期内保留。

### `REQUIRE_CLIENT_MIGRATION`

存在仓库内运行时代码、页面组件或脚本调用。必须先迁移调用方，再讨论旧入口退役。

### `REQUIRE_OBSERVE_BEFORE_RETIRE`

没有发现仓库内字面量调用，但不能据此判断无人使用。必须先建立路径级聚合观测。

### `BLOCK_MANUAL_DECISION`

适用于非覆盖式辅助标记、语义不等价重叠族或非路由支持文件。未经单独人工决策不得迁移、删除、代理或重定向。

## 精确重叠族

- `/api/open-platform/tenants`

该重叠族继续保持人工阻断，不作为第十九阶段试点。

## 最低观测要求

- 按 `route_url`、HTTP method、status code、认证范围和租户范围记录聚合计数。
- 不记录请求体、响应体、凭证、客户数据或其他敏感内容。
- 必须能够区分新旧入口。
- 必须能够识别鉴权失败、租户错误和服务端错误。
- 未建立观测前不得提出旧入口退役。

## 兼容期和退役条件

1. 新旧入口行为、权限、租户隔离和错误响应必须等价。
2. 所有已知调用方必须完成迁移和回归验证。
3. 仓库外未知客户端必须通过观测期降低不确定性。
4. 旧入口无有效流量后，只能进入单独人工退役审核。
5. 本阶段不设定具体日期，不构成任何自动退役授权。

## 回退要求

- 原入口在试点期间继续保留。
- 调用方修改必须能够逐项回切。
- 回退不得依赖 Schema、Migration 或数据库变更。
- 回退不得改变权限、租户隔离或错误响应。
- 回退过程不得读取或输出真实凭证与客户数据。

## 第十九阶段唯一试点候选

- 路由族：`/api/institution/wecom-official-dry-run`
- 路由文件：`src/app/api/institution/wecom-official-dry-run/route.ts`
- 路由 URL：`/api/institution/wecom-official-dry-run`
- HTTP 方法：`GET`
- 版本分类：`unversioned`
- 当前风险：`high`
- 测试引用文件数：3
- 仓库内运行时消费方：0
- 动态路径参数：0
- 选择层级：`A_unversioned_tested_no_runtime_consumer`

该候选只是基于单一路由、只读 GET、无动态参数、无仓库内运行时消费方等证据得出的**相对低风险设计候选**。它不表示生产风险为低，也不表示允许在第十八阶段修改或迁移 API。

第十九阶段只能形成该单一路由族的兼容契约、目标路径、调用方修正、观测、退役和回退设计，不得实施迁移。

## 机器可读输出

- `docs/refactor/phase-18-api-route-caller-compatibility.csv`
- `docs/refactor/phase-18-api-family-compatibility-summary.csv`
- `docs/refactor/phase-18-api-governance-candidate-traceability.csv`

## 证据限制

- 字面量扫描不能识别全部动态拼接 URL。
- 仓库内无引用不能证明生产环境无调用。
- 测试引用不能等同于运行时流量。
- 文档引用不能等同于客户端实现。
- 外部客户端、网关和集成系统继续按未知调用方处理。

## 安全边界

- 未修改 `file-migration-matrix.csv`。
- 未修改或移动任何 API 文件。
- 未新增代理、重定向或兼容入口。
- 未改变运行时行为。
- 未修改 Schema、Migration、package 或锁文件。
- 未连接数据库。
- 未执行 Seed 或 Migration。
- 未调用 HIS、企业微信或真实外部服务。
- 未读取或输出 `.env.local`、DATABASE_URL 或真实凭证。
