# 第十二阶段：全仓 API 路由分类补全审计

- 日期：2026-07-26
- 分支：`refactor/full-api-route-classification-audit-20260726-122044`
- 基线：`2bab1a8d6c9155c511e3a2d5adb7e245d9c2a76d`
- 全仓 `route.ts`：145
- 全仓版本化路由：56
- 全仓非版本化路由：89
- 第十一阶段候选内路由：88
- 第十二阶段分类缺口：57
- 缺口内版本化路由：56
- 缺口内非版本化路由：1
- 全仓路由族：144
- 版本化／非版本化重叠族：1
- 迁移矩阵缺失路径：0
- 本阶段 API 文件移动：0
- 本阶段迁移矩阵修改：0

## 目标

补齐第十一阶段候选范围之外的 API 路由分类，建立覆盖全仓 145 个 `route.ts` 的版本化／非版本化路由族对照，并生成迁移矩阵分类修改建议。

本阶段只生成审计文件和修改建议，不直接修改迁移矩阵，不新增、删除、重命名或移动 API 文件。

## 范围结论

- 第十一阶段已覆盖 88 个非版本化 `route.ts`。
- 第十二阶段识别出候选范围之外的 57 个 `route.ts`。
- 57 个缺口中包含 56 个版本化路由和 1 个非版本化路由。
- 缺口路径只生成 `API_VERSION_REVIEW` 分类建议，尚未写入迁移矩阵。
- 全仓路由族对照以移除首个 `/vN` 版本段后的路径作为族键。

## 全仓领域分布

| 领域 | 路由数 |
|---|---:|
| `institution` | 80 |
| `open-platform` | 54 |
| `knowledge-base` | 6 |
| `auth` | 3 |
| `version` | 1 |
| `workspace-dashboard` | 1 |

## 版本化／非版本化重叠族

| 路由族 | 路由数 | 运行时引用文件数 | 下一门槛 |
|---|---:|---:|---|
| `/api/open-platform/tenants` | 2 | 2 | 先形成兼容契约，禁止移动 |

## 分类缺口当前矩阵动作

| 当前动作 | 路由数 |
|---|---:|
| `KEEP_REVIEW` | 55 |
| `RUNTIME_BOUNDARY_CONFIRMED_KEEP_CURRENT` | 2 |

## 调用方证据

- 有运行时字面量引用证据的路由：100。
- 动态参数路由：52。
- 字面量扫描只能作为调用方下限。
- 复杂 URL 拼接、运行时配置、网关和仓库外客户端仍需单独核对。

## 下一阶段准入条件

1. 先审核 57 条矩阵分类修改建议。
2. 未经单独确认，不直接修改迁移矩阵。
3. 从重叠族中最多选择一个路由族形成兼容契约。
4. 兼容契约必须包含调用方、行为等价、权限、租户隔离、弃用期、观测和回退。
5. 在契约和测试门槛明确前，不移动或删除 API 文件。

## 安全边界

- 未修改迁移矩阵。
- 未修改或移动 API、源码、测试或脚本。
- 未修改 Schema、Migration、package 或锁文件。
- 未执行数据库连接、Seed 或 Migration。
- 未调用 HIS、企业微信或真实外部服务。
- 未读取或输出 `.env.local`、DATABASE_URL 或真实凭证内容。

全仓逐路由清单：`docs/refactor/phase-12-full-api-route-inventory.csv`。

全仓路由族清单：`docs/refactor/phase-12-full-api-family-summary.csv`。

迁移矩阵分类建议：`docs/refactor/phase-12-api-matrix-classification-proposal.csv`。
