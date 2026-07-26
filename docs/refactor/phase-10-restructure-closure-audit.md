# 第十阶段：目录重构阶段性闭环审计

- 日期：2026-07-26
- 分支：`refactor/restructure-closure-audit-20260726-110438`
- 基线：`cef095a3e649e49979b54d94641d50c7886bab5f`
- 迁移矩阵记录总数：1509
- 第五阶段候选总数：44
- 第六至第九阶段闭环候选：44
- 第五阶段未闭环候选：0
- 正式业务源码移动：0
- 本阶段文件移动：0

## 阶段完成情况

| 阶段 | 范围 | 数量或结果 | 状态 |
|---|---|---:|---|
| 第一阶段 | 基线、快照、迁移矩阵和交接入口 | 1 套基线 | complete |
| 第二阶段 | 重复静态资源和品牌路径 | 低风险资产已整理 | complete |
| 第三阶段 | 部署与 Node 运行脚本分层 | 保留兼容入口 | complete |
| 第四阶段 | Next.js 与 Vitest 命令分层 | 保留兼容入口 | complete |
| 第五阶段 | Demo／Mock／Fixture／Seed 审计 | 44 | complete |
| 第六阶段 | 历史文档与纯测试归属 | 25 | complete |
| 第七阶段 | 模块 Mock 边界 | 5 | complete |
| 第八阶段 | 运行时 Demo 边界 | 11 | complete |
| 第九阶段 | Demo 脚本与 Seed 边界 | 3 | complete |

## 候选闭环核对

```text
第六阶段 25
+ 第七阶段 5
+ 第八阶段 11
+ 第九阶段 3
= 第五阶段 44
```

- 四个阶段路径集合互不重复。
- 四个阶段路径并集与第五阶段 44 个候选完全一致。
- 44 个候选在迁移矩阵中均已离开 `audit_completed`。
- 第五阶段剩余 `audit_completed` 数量为 0。

## 迁移矩阵概览

- 矩阵记录总数：1509
- 当前 `pending`：1455
- 高风险 `pending`：688
- 要求人工审核：1474
- API 版本审核候选：91
- 数据库锁定边界：62

详细计数见：`docs/refactor/phase-10-matrix-status-summary.csv`。

## 阶段性结论

- 第一轮目录盘点、低风险资产整理和高敏候选边界审核已经完成。
- Demo、Mock、Fixture、Seed 的 44 个候选已全部获得明确归属或安全边界。
- 当前尚不能视为业务源码重构完成。
- 机构端、开放平台、API 路径和跨模块职责仍需要独立规划。
- 下一批工作应先做单领域迁移设计，不应直接进行批量源码移动。

## 遗留风险

| ID | 领域 | 风险 | 影响数量 | 严重度 | 当前处理 |
|---|---|---|---:|---|---|
| R01 | 机构端模块 | 页面、领域、服务和业务能力仍集中于 institution 模块 | 316 | high | not_closed |
| R02 | 开放平台模块 | 开放平台职责仍高度聚合 | 180 | high | not_closed |
| R03 | API 路径 | 版本化与非版本化 API 并存 | 91 | high | not_closed |
| R04 | 跨模块职责 | 知识库与工作台等模块仍存在职责交叉 | 45 | medium | not_closed |
| R05 | 数据库边界 | 数据库基础设施和安全边界仍被锁定 | 62 | high | protected |
| R06 | Demo Seed | Demo CLI 数据库地址策略比核心 Seed Guard 更宽 | 1 | high | recorded_not_fixed |
| R07 | 认证测试 | 旧 DemoAuthRoutes 测试与当前认证契约存在漂移 | 1 | medium | recorded_not_fixed |
| R08 | 迁移矩阵 | 仍有大量 pending 记录等待后续分域处理 | 1455 | medium | backlog |

详细风险登记见：`docs/refactor/phase-10-residual-risk-register.csv`。

## 下一阶段准入条件

1. 从遗留风险中选择单一领域，不同时启动多个大型模块。
2. 先形成调用方、依赖方向、兼容策略和回退方案。
3. API 路径迁移必须先确认兼容期和客户端调用范围。
4. 数据库、Schema、Migration、Seed 和认证边界继续保持锁定。
5. 未经单独授权，不实施业务源码移动。

## 安全边界

- 未修改迁移矩阵原有记录。
- 未修改或移动源码、测试、脚本、API、Seed 或数据库文件。
- 未修改 Schema、Migration、package 或锁文件。
- 未执行 Seed 或 Migration。
- 未创建数据库连接。
- 未调用 HIS、企业微信或其他真实外部服务。
- 未主动读取或输出 `.env.local`、DATABASE_URL 或真实凭证内容。
