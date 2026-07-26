# 第十一阶段：API 路径版本化治理规划

- 日期：2026-07-26
- 分支：`refactor/api-version-governance-plan-20260726-114436`
- 基线：`32a8a02b08a88b5ae37216b2a8495cc3476df0ca`
- `API_VERSION_REVIEW` 候选：91
- 版本化路由：0
- 非版本化路由：88
- 非路由支持文件：3
- 精确版本化／非版本化重叠族：0
- 有运行时字面量调用证据的路由：65
- 动态参数路由：36
- 本阶段 API 文件移动：0

## 目标

建立 API 路径版本化治理基线，区分版本化、非版本化和精确重叠路由族，记录当前可见调用方证据，并明确后续兼容迁移的准入条件。

本阶段只做规划与审计，不新增、删除、重命名或移动任何 API 路由。


## 审计范围说明

- 本轮清单只覆盖迁移矩阵中标记为 `API_VERSION_REVIEW` 的 91 个候选，不等于仓库全部 API 路由。
- 候选中实际 `route.ts` 为 88 个，非路由支持文件为 3 个。
- 候选内版本化路由为 0 个，非版本化路由为 88 个。
- 当前“版本化路由为 0”和“精确重叠族为 0”只适用于本轮候选范围。
- 全仓当前共有 145 个 `src/app/api/**/route.ts`。
- 全仓版本化 `route.ts` 为 56 个，非版本化 `route.ts` 为 89 个。
- 其中有 56 个版本化路由未被当前 `API_VERSION_REVIEW` 候选覆盖。
- 因此，本阶段不能据此断言仓库不存在版本化路由，也不能据此完成全仓新旧路径重叠判断。
- 下一步应先补齐版本化路由的矩阵分类，再决定完整的 API 版本治理范围。

## 核心结论

- 91 个候选均继续保持当前位置。
- 当前候选范围没有发现精确重叠族；该结果不代表全仓不存在版本化／非版本化重叠。
- 字面量调用扫描只能作为调用方下限，不能证明没有运行时调用。
- 动态路由、拼接 URL、配置生成 URL 和外部客户端调用需要后续逐族补充证据。
- API 版本治理必须先定义兼容期、弃用信号、回退方式和客户端影响范围。

## 版本分类

| 分类 | 数量 |
|---|---:|
| `non_route_support` | 3 |
| `unversioned` | 88 |

## 路由领域分布

| 领域 | 候选数 |
|---|---:|
| `institution` | 78 |
| `open-platform` | 6 |
| `auth` | 3 |
| `unknown` | 3 |
| `version` | 1 |

## 精确重叠路由族

- 当前未发现路径后缀完全相同的版本化／非版本化路由族。

## 运行时字面量引用较多的路由

| 路由 | 引用文件数 | 版本分类 | 优先级 |
|---|---:|---|---|
| `/api/institution/his-connections` | 5 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/his-connections/[connectionId]` | 5 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/his-connections/[connectionId]/credentials` | 3 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/knowledge-management/items` | 3 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/auth/session` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/customers` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/entitlement-usage` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/followups` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/knowledge-management/items/[knowledgeId]/files` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/knowledge-management/upload` | 2 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/auth/login` | 1 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/auth/logout` | 1 | `unversioned` | `P1_unversioned_runtime_consumers` |
| `/api/institution/ai-service-usage` | 1 | `unversioned` | `P1_unversioned_runtime_consumers` |

## 治理优先级

| 优先级 | 数量 | 含义 |
|---|---:|---|
| `P1_unversioned_runtime_consumers` | 65 | 非版本化路径存在运行时字面量调用证据 |
| `P2_unversioned_no_literal_consumer` | 23 | 非版本化路径暂未发现运行时字面量调用 |
| `P4_manual_review` | 3 | 无法直接映射为 route.ts 的支持文件 |

## 后续兼容契约必须包含

1. 当前调用方和客户端范围。
2. 新旧入口的行为、权限、租户隔离和错误响应等价性。
3. 是否使用代理入口、共享 Handler 或显式重定向。
4. 兼容期起止条件和弃用提示。
5. 指标、日志和审计观测方式。
6. 回退到原路径的明确操作。
7. 动态路由参数和查询参数兼容性。
8. 不读取或输出真实凭证及客户数据。

## 下一阶段建议

- 从 `P0_exact_overlap` 路由族中选择一个单一族做兼容契约设计。
- 若不存在精确重叠族，则选择一个有明确运行时调用证据的非版本化路由族。
- 下一阶段仍先做文档、调用方和测试契约，不直接移动 API 文件。

## 证据限制

- 本轮调用方扫描仅覆盖仓库内受 Git 跟踪的 TypeScript 和 JavaScript 文件。
- 字面量和模板字符串可以被识别，但复杂 URL 拼接、运行时配置和仓库外客户端可能无法识别。
- 引用文件数为审计下限，不代表完整生产调用量。

## 安全边界

- 未修改迁移矩阵。
- 未修改或移动 API、源码、测试或脚本。
- 未修改 Schema、Migration、package 或锁文件。
- 未执行数据库连接、Seed 或 Migration。
- 未调用 HIS、企业微信或真实外部服务。
- 未读取或输出 `.env.local`、DATABASE_URL 或真实凭证内容。

详细逐路由清单：`docs/refactor/phase-11-api-version-route-inventory.csv`。

详细路由族清单：`docs/refactor/phase-11-api-version-family-summary.csv`。
